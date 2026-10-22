// src/workers/videoWorker.ts — BullMQ Worker: full pipeline orchestrator with Campaign Presets
import "dotenv/config";
import { Worker, Job } from "bullmq";
import path from "path";
import fs from "fs";
import { getRedisConfig } from "../lib/redis";
import { VIDEO_QUEUE_NAME, VideoJobPayload } from "../lib/queue";
import { prisma } from "../lib/prisma";
import { CampaignPreset, getPresetConfig } from "../lib/presets";
import { AspectRatio } from "../types";
import { downloadYouTubeVideo } from "../services/downloader";
import { transcribeVideo, saveTranscription } from "../services/transcriber";
import { analyzeViralMoments, saveAnalysis } from "../services/analyzer";
import {
  generateSRT,
  generateASS,
  generatePlainTextTranscript,
  saveCaptionFile,
} from "../services/captionGenerator";
import {
  renderVerticalClip,
  extractThumbnail,
} from "../services/videoProcessor";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const OUTPUT_DIR = path.join(process.cwd(), "public", "outputs");

// --------- Helpers ---------

async function updateJobStatus(
  jobId: string,
  status: string,
  extra: Partial<{
    progress: number;
    errorMessage: string;
    transcriptPath: string;
    transcriptText: string;
    analysisPath: string;
    videoTitle: string;
    videoDuration: number;
    thumbnailPath: string;
  }> = {}
) {
  await prisma.videoJob.update({
    where: { id: jobId },
    data: { status, ...extra, updatedAt: new Date() },
  });
}

// --------- Pipeline Worker Implementation ---------

async function processVideoJob(job: Job<VideoJobPayload>): Promise<void> {
  const { jobId, sourceType, sourceUrl, sourceFile, preset = "GENERAL", aspectRatio = "9:16" } = job.data;
  const campaignPreset = (preset || "GENERAL") as CampaignPreset;
  const targetAspectRatio = (aspectRatio || "9:16") as AspectRatio;
  const presetConfig = getPresetConfig(campaignPreset);

  const jobUploadDir = path.join(UPLOAD_DIR, jobId);
  const jobOutputDir = path.join(OUTPUT_DIR, jobId);
  fs.mkdirSync(jobUploadDir, { recursive: true });
  fs.mkdirSync(jobOutputDir, { recursive: true });

  console.log(`[Worker] Starting job ${jobId} | Mode: ${campaignPreset} | Ratio: ${targetAspectRatio} (${sourceType})`);

  try {
    // ── Step 1: Ingest source video ──────────────────────────────────
    await updateJobStatus(jobId, "PROCESSING", { progress: 8 });

    let videoPath: string;
    let videoTitle = "Untitled";
    let videoDuration = 0;
    let thumbnailPath: string | undefined;

    if (sourceType === "youtube" && sourceUrl) {
      const dl = await downloadYouTubeVideo(sourceUrl, jobUploadDir, jobId);
      videoPath = dl.filePath;
      videoTitle = dl.title;
      videoDuration = dl.duration;
      thumbnailPath = dl.thumbnailPath;
    } else if (sourceType === "upload" && sourceFile) {
      videoPath = sourceFile;
    } else {
      throw new Error("Invalid job parameters: missing source URL or uploaded file.");
    }

    await updateJobStatus(jobId, "PROCESSING", {
      progress: 25,
      videoTitle,
      videoDuration,
      thumbnailPath,
    });

    // ── Step 2: Transcribe via Whisper with word-level timestamps ──────
    console.log(`[Worker - ${campaignPreset}] Transcribing audio: ${videoPath}`);
    const transcript = await transcribeVideo(videoPath);
    const transcriptPath = path.join(jobUploadDir, "transcript.json");
    saveTranscription(transcript, transcriptPath);

    await updateJobStatus(jobId, "PROCESSING", {
      progress: 45,
      transcriptPath,
      transcriptText: transcript.text.slice(0, 3000),
      videoDuration: transcript.duration || videoDuration,
    });

    // ── Step 3: Analyze viral moments via Gemini with Preset Rules ─────
    console.log(`[Worker - ${campaignPreset}] Detecting viral moments using preset directives...`);
    const analysis = await analyzeViralMoments(transcript, campaignPreset);
    const analysisPath = path.join(jobUploadDir, "analysis.json");
    saveAnalysis(analysis, analysisPath);

    await updateJobStatus(jobId, "PROCESSING", {
      progress: 60,
      analysisPath,
    });

    // ── Step 4: Create Clip records in Database ───────────────────────
    for (const seg of analysis.segments) {
      await prisma.clip.create({
        data: {
          jobId,
          campaignType: campaignPreset,
          aspectRatio: targetAspectRatio,
          title: seg.title,
          hookText: seg.hookText,
          score: seg.score,
          reasoning: seg.reasoning,
          startTime: seg.startTime,
          endTime: seg.endTime,
          duration: seg.endTime - seg.startTime,
          status: "PENDING",
        },
      });
    }

    // ── Step 5: Render Clips with Preset Filters, Aspect Ratio & Captions ──
    const clips = await prisma.clip.findMany({ where: { jobId } });
    const total = clips.length;

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const clipDir = path.join(jobOutputDir, clip.id);
      fs.mkdirSync(clipDir, { recursive: true });

      const assPath = path.join(clipDir, "captions.ass");
      const srtPath = path.join(clipDir, "captions.srt");
      const clipOutputPath = path.join(clipDir, "clip.mp4");
      const thumbPath = path.join(clipDir, "thumb.jpg");
      const txtTranscriptPath = path.join(clipDir, "transcript.txt");

      // Generate standard SRT
      const srtContent = generateSRT(
        transcript.words,
        clip.startTime,
        clip.endTime
      );
      saveCaptionFile(srtContent, srtPath);

      // Generate ASS styled for this Campaign Preset & Aspect Ratio
      const assContent = generateASS(
        transcript.words,
        clip.startTime,
        clip.endTime,
        campaignPreset,
        clip.hookText || undefined,
        targetAspectRatio
      );
      saveCaptionFile(assContent, assPath);

      // WHOP Mode: Generate companion .txt transcript payload
      let transcriptPayload: string | undefined;
      if (presetConfig.generateTranscriptFile) {
        transcriptPayload = generatePlainTextTranscript(
          transcript.words,
          clip.startTime,
          clip.endTime,
          clip.title,
          clip.hookText || undefined
        );
        saveCaptionFile(transcriptPayload, txtTranscriptPath);
      }

      await prisma.clip.update({
        where: { id: clip.id },
        data: {
          status: "PROCESSING",
          srtPath,
          transcript: transcriptPayload || null,
        },
      });

      try {
        console.log(`[Worker - ${campaignPreset}] Rendering clip ${i + 1}/${total} [${clip.startTime}s - ${clip.endTime}s] (${targetAspectRatio})`);
        await renderVerticalClip({
          inputPath: videoPath,
          outputPath: clipOutputPath,
          startTime: clip.startTime,
          endTime: clip.endTime,
          aspectRatio: targetAspectRatio,
          preset: campaignPreset,
          assPath,
          onProgress: (pct) => {
            const overallProgress =
              60 + Math.round(((i + pct / 100) / total) * 35);
            job.updateProgress(overallProgress);
          },
        });

        await extractThumbnail(clipOutputPath, thumbPath, 1);

        const outputUrl = `/api/clips/${clip.id}/download`;

        await prisma.clip.update({
          where: { id: clip.id },
          data: {
            status: "COMPLETED",
            outputPath: clipOutputPath,
            outputUrl,
            thumbnailPath: thumbPath,
          },
        });
      } catch (renderErr) {
        const errMsg =
          renderErr instanceof Error ? renderErr.message : String(renderErr);
        await prisma.clip.update({
          where: { id: clip.id },
          data: { status: "FAILED", errorMessage: errMsg },
        });
        console.error(`[Worker] Clip ${clip.id} render failed: ${errMsg}`);
      }
    }

    // ── Step 6: Mark VideoJob as COMPLETED ───────────────────────────
    await updateJobStatus(jobId, "COMPLETED", { progress: 100 });
    console.log(`[Worker - ${campaignPreset}] Job ${jobId} successfully COMPLETED!`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Worker] Job ${jobId} execution failed: ${errMsg}`);
    await updateJobStatus(jobId, "FAILED", { errorMessage: errMsg });
    throw err;
  }
}

// --------- Worker Initialization ---------

const worker = new Worker<VideoJobPayload>(
  VIDEO_QUEUE_NAME,
  processVideoJob,
  {
    connection: getRedisConfig(),
    concurrency: 2,
    limiter: { max: 10, duration: 60_000 },
  }
);

worker.on("completed", (job) => {
  console.log(`[BullMQ] Video Job ${job.id} completed.`);
});

worker.on("failed", (job, err) => {
  console.error(`[BullMQ] Video Job ${job?.id} failed: ${err.message}`);
});

worker.on("error", (err) => {
  console.error(`[BullMQ] Worker process error: ${err.message}`);
});

console.log(`[BullMQ] ClipForge AI Video Worker listening on queue: ${VIDEO_QUEUE_NAME}`);

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
