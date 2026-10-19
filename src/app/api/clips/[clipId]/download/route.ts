// src/app/api/clips/[clipId]/download/route.ts — Stream clip MP4 file
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clipId: string }> }
) {
  try {
    const { clipId } = await params;

    const clip = await prisma.clip.findUnique({ where: { id: clipId } });

    if (!clip) {
      return NextResponse.json(
        { error: "Clip not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(_req.url);
    const format = searchParams.get("format");

    // WHOP Mode: Return .txt transcript file payload if requested
    if (format === "txt" && clip.transcript) {
      const txtFileName = `clip-${clipId.slice(0, 8)}-transcript.txt`;
      return new NextResponse(clip.transcript, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${txtFileName}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (!clip.outputPath) {
      return NextResponse.json(
        { error: "Clip not found or not rendered yet" },
        { status: 404 }
      );
    }

    const filePath = clip.outputPath;

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: "Clip file missing on disk" },
        { status: 404 }
      );
    }

    const stat = fs.statSync(filePath);
    const fileName = `clip-${clipId.slice(0, 8)}.mp4`;

    const fileStream = fs.createReadStream(filePath);
    const nodeStream = fileStream as unknown as ReadableStream;

    return new NextResponse(nodeStream, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(stat.size),
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[GET /api/clips/:clipId/download]", err);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
