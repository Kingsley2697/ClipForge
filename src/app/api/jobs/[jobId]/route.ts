// src/app/api/jobs/[jobId]/route.ts — GET job details + status
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ── GET /api/jobs/:jobId ─────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    const job = await prisma.videoJob.findUnique({
      where: { id: jobId },
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
  } catch (err) {
    console.error("[GET /api/jobs/:jobId]", err);
    return NextResponse.json({ error: "Failed to fetch job" }, { status: 500 });
  }
}

// ── DELETE /api/jobs/:jobId ──────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    await prisma.videoJob.delete({ where: { id: jobId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/jobs/:jobId]", err);
    return NextResponse.json({ error: "Failed to delete job" }, { status: 500 });
  }
}
