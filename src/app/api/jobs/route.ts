// src/app/api/jobs/route.ts — POST: create job, GET: list all jobs with Campaign Presets
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueueVideoJob } from "@/lib/queue";
import { CampaignPreset } from "@/lib/presets";
import { z } from "zod";
import path from "path";
import { writeFile } from "fs/promises";
import { mkdirSync } from "fs";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const CreateJobSchema = z.object({
  sourceType: z.enum(["youtube", "upload"]),
  sourceUrl: z.string().url().optional(),
  preset: z.enum(["VYRO", "WHOP", "SPORTS", "GENERAL"]).default("GENERAL"),
  aspectRatio: z.enum(["9:16", "1:1", "16:9"]).default("9:16"),
});

// ── GET /api/jobs ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(50, parseInt(searchParams.get("limit") || "20"));
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      prisma.videoJob.findMany({
        skip,
        take: limit,
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { clips: true } },
          clips: {
            select: {
              id: true,
              campaignType: true,
              aspectRatio: true,
              title: true,
              hookText: true,
              score: true,
              startTime: true,
              endTime: true,
              duration: true,
              outputUrl: true,
              status: true,
              thumbnailPath: true,
            },
            orderBy: { score: "desc" },
          },
        },
      }),
      prisma.videoJob.count({ where: { userId: user.id } }),
    ]);

    return NextResponse.json({ jobs, total, page, limit });
  } catch (err) {
    console.error("[GET /api/jobs]", err);
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}

// ── POST /api/jobs ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const contentType = req.headers.get("content-type") || "";

    let sourceType: "youtube" | "upload";
    let sourceUrl: string | undefined;
    let sourceFile: string | undefined;
    let preset: CampaignPreset = "GENERAL";
    let aspectRatio: "9:16" | "1:1" | "16:9" = "9:16";

    if (contentType.includes("multipart/form-data")) {
      // Handle file upload
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const formPreset = formData.get("preset") as string | null;
      const formAspect = formData.get("aspectRatio") as string | null;

      if (formPreset && ["VYRO", "WHOP", "SPORTS", "GENERAL"].includes(formPreset.toUpperCase())) {
        preset = formPreset.toUpperCase() as CampaignPreset;
      }

      if (formAspect && ["9:16", "1:1", "16:9"].includes(formAspect)) {
        aspectRatio = formAspect as "9:16" | "1:1" | "16:9";
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

      await enqueueVideoJob({ jobId, sourceType, sourceFile, preset, aspectRatio });
      return NextResponse.json(job, { status: 201 });
    } else {
      // JSON body — YouTube URL
      const body = await req.json();
      const parsed = CreateJobSchema.parse(body);

      if (parsed.sourceType === "youtube" && !parsed.sourceUrl) {
        return NextResponse.json(
          { error: "sourceUrl is required for YouTube jobs" },
          { status: 400 }
        );
      }

      sourceType = "youtube";
      sourceUrl = parsed.sourceUrl;
      preset = parsed.preset;
      aspectRatio = parsed.aspectRatio;

      const job = await prisma.videoJob.create({
        data: {
          userId: user.id,
          videoUrl: sourceUrl,
          sourceUrl,
          sourceType,
          preset,
          aspectRatio,
          status: "PENDING",
        },
      });

      await enqueueVideoJob({
        jobId: job.id,
        sourceType,
        sourceUrl,
        preset,
        aspectRatio,
      });

      return NextResponse.json(job, { status: 201 });
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 422 });
    }
    console.error("[POST /api/jobs]", err);
    return NextResponse.json({ error: "Failed to create video job" }, { status: 500 });
  }
}
