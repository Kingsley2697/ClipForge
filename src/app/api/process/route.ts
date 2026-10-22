// src/app/api/process/route.ts — Unified Video Processing API Route
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueueVideoJob } from "@/lib/queue";
import { CampaignPreset } from "@/lib/presets";
import { AspectRatio } from "@/types";
import { z } from "zod";
import path from "path";
import { writeFile } from "fs/promises";
import { mkdirSync } from "fs";
import { randomUUID } from "crypto";
import { getCurrentUser, getSubscriptionAccess } from "@/lib/auth";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const ProcessJobSchema = z.object({
  videoUrl: z.string().url().optional(),
  sourceUrl: z.string().url().optional(),
  sourceType: z.enum(["youtube", "upload"]).default("youtube"),
  preset: z.enum(["VYRO", "WHOP", "SPORTS", "GENERAL"]).default("GENERAL"),
  aspectRatio: z.enum(["9:16", "1:1", "16:9"]).default("9:16"),
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

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const formPreset = formData.get("preset") as string | null;
      const formAspect = formData.get("aspectRatio") as string | null;

      if (formPreset && ["VYRO", "WHOP", "SPORTS", "GENERAL"].includes(formPreset.toUpperCase())) {
        preset = formPreset.toUpperCase() as CampaignPreset;
      }

      if (formAspect && ["9:16", "1:1", "16:9"].includes(formAspect)) {
        aspectRatio = formAspect as AspectRatio;
      }

      if (!file) {
        return NextResponse.json({ error: "No video file provided" }, { status: 400 });
      }

      const jobId = randomUUID();
      const uploadDir = path.join(UPLOAD_DIR, jobId);
      mkdirSync(uploadDir, { recursive: true });

      const ext = path.extname(file.name) || ".mp4";
      const filePath = path.join(uploadDir, `${jobId}${ext}`);

      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);

      sourceType = "upload";
      sourceFile = filePath;

      const job = await prisma.videoJob.create({
        data: {
          id: jobId,
          userId: user.id,
          sourceType,
          sourceFile,
          preset,
          aspectRatio,
          status: "PENDING",
        },
      });

      await enqueueVideoJob({
        jobId,
        sourceType,
        sourceFile,
        preset,
        aspectRatio,
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
