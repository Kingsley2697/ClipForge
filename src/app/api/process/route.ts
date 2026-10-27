// src/app/api/process/route.ts — Unified Video Processing API Route
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreativeEditOptions, enqueueVideoJob } from "@/lib/queue";
import { CampaignPreset } from "@/lib/presets";
import { AspectRatio } from "@/types";
import { z } from "zod";
import path from "path";
import { writeFile } from "fs/promises";
import { mkdirSync } from "fs";
import { randomUUID } from "crypto";
import { getCurrentUser, getSubscriptionAccess } from "@/lib/auth";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const CreativeEditSchema = z.object({
  enabled: z.boolean().default(false),
  speed: z.union([z.literal(0.98), z.literal(1), z.literal(1.02)]).default(1),
  colorGrade: z.boolean().default(false),
  mirror: z.boolean().default(false),
  pitchSemitones: z.union([z.literal(-1), z.literal(0), z.literal(1)]).default(0),
  commentaryVolume: z.number().min(0).max(1).default(1),
  backgroundAudioVolume: z.number().min(0).max(1).default(0.2),
});

const DEFAULT_CREATIVE_EDIT: CreativeEditOptions = {
  enabled: false,
  speed: 1,
  colorGrade: false,
  mirror: false,
  pitchSemitones: 0,
  commentaryVolume: 1,
  backgroundAudioVolume: 0.2,
};

function parseCreativeEdit(value: unknown): CreativeEditOptions {
  if (value === undefined || value === null || value === "") {
    return { ...DEFAULT_CREATIVE_EDIT };
  }

  const parsedValue = typeof value === "string" ? JSON.parse(value) : value;
  return CreativeEditSchema.parse(parsedValue);
}

const ProcessJobSchema = z.object({
  videoUrl: z.string().url().optional(),
  sourceUrl: z.string().url().optional(),
  sourceType: z.enum(["youtube", "upload"]).default("youtube"),
  preset: z.enum(["VYRO", "WHOP", "SPORTS", "GENERAL"]).default("GENERAL"),
  aspectRatio: z.enum(["9:16", "1:1", "16:9"]).default("9:16"),
  /** FFmpeg xfade transition name, e.g. "fade", "wipeleft", "circlecrop" or "none" */
  transitionStyle: z.string().trim().default("fade"),
  /** xfade duration in seconds */
  transitionDuration: z.coerce.number().min(0.1).max(3).default(0.4),
  creativeEdit: CreativeEditSchema.default(DEFAULT_CREATIVE_EDIT),
});

// ── GET /api/process ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (jobId) {
      const job = await prisma.videoJob.findFirst({
        where: { id: jobId, userId: user.id },
        include: {
          clips: {
            orderBy: { score: "desc" },
          },
        },
      });

      if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }

      return NextResponse.json(job);
    }

    const jobs = await prisma.videoJob.findMany({
      take: 20,
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { clips: true } },
        clips: {
          take: 4,
          orderBy: { score: "desc" },
        },
      },
    });

    return NextResponse.json({ jobs });
  } catch (err) {
    console.error("[GET /api/process]", err);
    return NextResponse.json({ error: "Failed to query process jobs" }, { status: 500 });
  }
}

// ── POST /api/process ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const subscription = await getSubscriptionAccess(user);
    if (!subscription.isActive) {
      return NextResponse.json({
        error: "Your subscription has expired. Subscribe again to continue creating clips.",
        code: "SUBSCRIPTION_EXPIRED",
        subscriptionEndsAt: subscription.subscriptionEndsAt,
      }, { status: 403 });
    }
    const contentType = req.headers.get("content-type") || "";

    let sourceType: "youtube" | "upload" = "youtube";
    let videoUrl: string | undefined;
    let sourceFile: string | undefined;
    let preset: CampaignPreset = "GENERAL";
    let aspectRatio: AspectRatio = "9:16";
    let transitionStyle = "fade";
    let transitionDuration = 0.4;
    let creativeEdit: CreativeEditOptions = { ...DEFAULT_CREATIVE_EDIT };

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const formPreset = formData.get("preset") as string | null;
      const formAspect = formData.get("aspectRatio") as string | null;
      const formTransitionStyle = formData.get("transitionStyle") as string | null;
      const formTransitionDuration = formData.get("transitionDuration") as string | null;
      const formCreativeEdit = formData.get("creativeEdit");
      const backgroundAudio = formData.get("backgroundAudio");
      const formSourceUrl = formData.get("sourceUrl") as string | null;

      if (formPreset && ["VYRO", "WHOP", "SPORTS", "GENERAL"].includes(formPreset.toUpperCase())) {
        preset = formPreset.toUpperCase() as CampaignPreset;
      }

      if (formAspect && ["9:16", "1:1", "16:9"].includes(formAspect)) {
        aspectRatio = formAspect as AspectRatio;
      }

      if (formTransitionStyle) {
        transitionStyle = formTransitionStyle.trim();
      }

      if (formTransitionDuration) {
        const parsed = parseFloat(formTransitionDuration);
        if (!isNaN(parsed) && parsed >= 0.1 && parsed <= 3) transitionDuration = parsed;
      }

      creativeEdit = parseCreativeEdit(formCreativeEdit);

      if (!file && !formSourceUrl) {
        return NextResponse.json({ error: "Provide a video file or source URL." }, { status: 400 });
      }

      const jobId = randomUUID();
      const uploadDir = path.join(UPLOAD_DIR, jobId);
      mkdirSync(uploadDir, { recursive: true });

      if (file) {
        const ext = path.extname(file.name) || ".mp4";
        const filePath = path.join(uploadDir, `${jobId}${ext}`);
        await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
        sourceType = "upload";
        sourceFile = filePath;
      } else {
        videoUrl = z.string().url().parse(formSourceUrl);
        sourceType = "youtube";
      }

      if (creativeEdit.enabled && backgroundAudio instanceof File && backgroundAudio.size > 0) {
        if (!backgroundAudio.type.startsWith("audio/")) {
          return NextResponse.json({ error: "Background audio must be an audio file." }, { status: 400 });
        }

        const audioExt = path.extname(backgroundAudio.name) || ".mp3";
        const backgroundAudioPath = path.join(uploadDir, `background-${randomUUID()}${audioExt}`);
        await writeFile(backgroundAudioPath, Buffer.from(await backgroundAudio.arrayBuffer()));
        creativeEdit.backgroundAudioPath = backgroundAudioPath;
      }

      const job = await prisma.videoJob.create({
        data: {
          id: jobId,
          userId: user.id,
          sourceType,
          sourceFile,
          videoUrl,
          sourceUrl: videoUrl,
          preset,
          aspectRatio,
          status: "PENDING",
        },
      });

      await enqueueVideoJob({
        jobId,
        sourceType,
        sourceFile,
        sourceUrl: videoUrl,
        preset,
        aspectRatio,
        transitionStyle,
        transitionDuration,
        creativeEdit,
      });

      return NextResponse.json(job, { status: 201 });
    } else {
      const body = await req.json();
      const parsed = ProcessJobSchema.parse(body);

      const targetUrl = parsed.videoUrl || parsed.sourceUrl;
      if (!targetUrl) {
        return NextResponse.json(
          { error: "videoUrl (or sourceUrl) is required" },
          { status: 400 }
        );
      }

      sourceType = parsed.sourceType;
      videoUrl = targetUrl;
      preset = parsed.preset;
      aspectRatio = parsed.aspectRatio;
      transitionStyle = parsed.transitionStyle;
      transitionDuration = parsed.transitionDuration;
      creativeEdit = parsed.creativeEdit;

      const job = await prisma.videoJob.create({
        data: {
          userId: user.id,
          videoUrl,
          sourceUrl: videoUrl,
          sourceType,
          preset,
          aspectRatio,
          status: "PENDING",
        },
      });

      await enqueueVideoJob({
        jobId: job.id,
        sourceType,
        sourceUrl: videoUrl,
        preset,
        aspectRatio,
        transitionStyle,
        transitionDuration,
        creativeEdit,
      });

      return NextResponse.json(job, { status: 201 });
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 422 });
    }
    console.error("[POST /api/process]", err);
    return NextResponse.json({ error: "Processing request failed" }, { status: 500 });
  }
}
