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

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const CreateJobSchema = z.object({
  sourceType: z.enum(["youtube", "upload"]),
  sourceUrl: z.string().url().optional(),
  preset: z.enum(["VYRO", "WHOP", "SPORTS", "GENERAL"]).default("GENERAL"),
});

// ── GET /api/jobs ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(50, parseInt(searchParams.get("limit") || "20"));
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      prisma.videoJob.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { clips: true } },
          clips: {
            select: {
              id: true,
              campaignType: true,
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
      prisma.videoJob.count(),
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
    const contentType = req.headers.get("content-type") || "";

    let sourceType: "youtube" | "upload";
    let sourceUrl: string | undefined;
    let sourceFile: string | undefined;
    let preset: CampaignPreset = "GENERAL";

    if (contentType.includes("multipart/form-data")) {
      // Handle file upload
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const formPreset = formData.get("preset") as string | null;

      if (formPreset && ["VYRO", "WHOP", "SPORTS", "GENERAL"].includes(formPreset.toUpperCase())) {
        preset = formPreset.toUpperCase() as CampaignPreset;
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
          sourceType,
          sourceFile,
          preset,
          status: "PENDING",
        },
      });

      await enqueueVideoJob({ jobId, sourceType, sourceFile, preset });
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

      const job = await prisma.videoJob.create({
        data: {
          videoUrl: sourceUrl,
          sourceUrl,
          sourceType,
          preset,
          status: "PENDING",
        },
      });

      await enqueueVideoJob({
        jobId: job.id,
        sourceType,
        sourceUrl,
        preset,
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
