// src/app/api/clips/[clipId]/route.ts — GET clip detail, DELETE clip
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clipId: string }> }
) {
  try {
    const { clipId } = await params;

    const clip = await prisma.clip.findUnique({
      where: { id: clipId },
      include: { job: true },
    });

    if (!clip) {
      return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    }

    return NextResponse.json(clip);
  } catch (err) {
    console.error("[GET /api/clips/:clipId]", err);
    return NextResponse.json({ error: "Failed to fetch clip" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clipId: string }> }
) {
  try {
    const { clipId } = await params;
    await prisma.clip.delete({ where: { id: clipId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/clips/:clipId]", err);
    return NextResponse.json({ error: "Failed to delete clip" }, { status: 500 });
  }
}
