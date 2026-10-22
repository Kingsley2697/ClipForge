// src/services/videoProcessor.ts — FFmpeg 9:16 crop, preset speed modifier & subtitle burn-in
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { CampaignPreset, getPresetConfig } from "@/lib/presets";
import path from "path";
import fs from "fs";

// Set ffmpeg path from static binary or environment override
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
} else if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

export type AspectRatio = "9:16" | "1:1" | "16:9";

/**
 * Returns the FFmpeg crop & scale video filter graph for the chosen aspect ratio.
 */
export function getAspectCropFilter(aspectRatio: AspectRatio = "9:16"): string {
  switch (aspectRatio) {
    case "1:1":
      // Instagram / Facebook Square: crop center 1080x1080
      return "crop=min(iw\\,ih):min(iw\\,ih),scale=1080:1080";
    case "16:9":
      // YouTube Widescreen: scale maintaining 16:9 aspect ratio up to 1920x1080 with padding
      return "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2";
    case "9:16":
    default:
      // TikTok / Shorts / Reels: scale width to 1920, center crop 1080x1920
      return "scale=1920:-2,crop=1080:1920:(iw-1080)/2:(ih-1920)/2";
  }
}

/**
 * Returns pixel dimensions for subtitles and thumbnail generation.
 */
export function getAspectDimensions(aspectRatio: AspectRatio = "9:16"): { width: number; height: number } {
  switch (aspectRatio) {
    case "1:1":
      return { width: 1080, height: 1080 };
    case "16:9":
      return { width: 1920, height: 1080 };
    case "9:16":
    default:
      return { width: 1080, height: 1920 };
  }
}

export interface RenderOptions {
  inputPath: string;   // Source MP4
  outputPath: string;  // Output MP4
  startTime: number;   // seconds
  endTime: number;     // seconds
  aspectRatio?: AspectRatio;
  preset?: CampaignPreset;
  assPath?: string;    // ASS subtitles path (preferred)
  srtPath?: string;    // SRT subtitles path (fallback)
  onProgress?: (percent: number) => void;
}

/**
 * Render a clip with burnt-in captions, aspect ratio cropping (9:16, 1:1, 16:9),
 * and preset-specific modifiers (e.g. 1.02x speed for SPORTS).
 */
export async function renderVerticalClip(
  options: RenderOptions
): Promise<string> {
  const {
    inputPath,
    outputPath,
    startTime,
    endTime,
    aspectRatio = "9:16",
    preset = "GENERAL",
    assPath,
    srtPath,
    onProgress,
  } = options;

  const duration = endTime - startTime;
  if (duration <= 0) throw new Error("Invalid clip duration");

  const config = getPresetConfig(preset);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  // 1. Get aspect ratio crop filter
  const scaleFilter = getAspectCropFilter(aspectRatio);

  // 2. Subtitle filter
  const subtitlePath = assPath || srtPath;
  const subFilter = subtitlePath
    ? `,ass='${subtitlePath.replace(/\\/g, "/").replace(/:/g, "\\:")}'`
    : "";

  // 3. SPORTS Preset: 1.02x speed modifier to bypass automated copyright scans
  let videoFilters = `${scaleFilter}${subFilter}`;
  let audioFilters: string[] = [];

  if (config.speedModifier && config.speedModifier !== 1.0) {
    const speed = config.speedModifier; // 1.02
    videoFilters = `${videoFilters},setpts=PTS/${speed}`;
    audioFilters = [`atempo=${speed}`];
  }

  return new Promise((resolve, reject) => {
    let cmd = ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .videoFilters(videoFilters)
      .videoCodec("libx264")
      .addOption("-preset", "fast")
      .addOption("-crf", "22")
      .addOption("-profile:v", "high")
      .addOption("-level", "4.0")
      .audioCodec("aac")
      .audioBitrate("160k")
      .addOption("-movflags", "+faststart")
      .output(outputPath);

    if (audioFilters.length > 0) {
      cmd = cmd.audioFilters(audioFilters);
    }

    if (onProgress) {
      cmd = cmd.on("progress", (info) => {
        const percent = Math.min(100, Math.round(info.percent || 0));
        onProgress(percent);
      });
    }

    cmd
      .on("start", (cmdLine) => {
        console.log(`[FFmpeg - ${preset}] Starting: ${cmdLine.slice(0, 140)}...`);
      })
      .on("end", () => {
        console.log(`[FFmpeg - ${preset}] Render complete: ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err, _stdout, stderr) => {
        console.error(`[FFmpeg - ${preset}] Error: ${stderr || err.message}`);
        reject(new Error(`FFmpeg error: ${err.message}`));
      })
      .run();
  });
}

/**
 * Extract a high-res poster thumbnail from the rendered clip.
 */
export async function extractThumbnail(
  inputPath: string,
  outputPath: string,
  timestampSeconds = 1
): Promise<string> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: [timestampSeconds],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: "1080x1920",
      })
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(new Error(`Thumbnail extraction error: ${err.message}`)));
  });
}
