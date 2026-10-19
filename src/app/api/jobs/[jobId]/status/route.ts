// src/app/api/jobs/[jobId]/status/route.ts — SSE real-time progress stream with Campaign Preset data
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/jobs/:jobId/status
 * Returns Server-Sent Events (SSE) stream for real-time job progress.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const encoder = new TextEncoder();
  let intervalId: NodeJS.Timeout;
  let isConnected = true;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        if (!isConnected) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          isConnected = false;
        }
      };

      const poll = async () => {
        if (!isConnected) {
          clearInterval(intervalId);
          return;
        }

        try {
          const job = await prisma.videoJob.findUnique({
            where: { id: jobId },
            include: {
              clips: {
                select: {
                  id: true,
                  campaignType: true,
                  title: true,
                  hookText: true,
                  score: true,
                  status: true,
                  outputPath: true,
                  outputUrl: true,
                  thumbnailPath: true,
                  transcript: true,
                  duration: true,
                  startTime: true,
                  endTime: true,
                  reasoning: true,
                },
                orderBy: { score: "desc" },
              },
            },
          });

          if (!job) {
            send({ type: "error", message: "Job not found" });
            clearInterval(intervalId);
            controller.close();
            return;
          }

          send({
            type: "update",
            status: job.status,
            progress: job.progress,
            videoTitle: job.videoTitle,
            preset: job.preset,
            clips: job.clips,
            errorMessage: job.errorMessage,
          });

          // Stop polling when terminal state
          const terminal = ["COMPLETED", "FAILED", "done", "failed"];
          if (terminal.includes(job.status)) {
            clearInterval(intervalId);
            setTimeout(() => {
              try { controller.close(); } catch { /* ignore */ }
            }, 500);
          }
        } catch {
          send({ type: "error", message: "Database polling error" });
          clearInterval(intervalId);
        }
      };

      // Initial poll, then every 2s
      poll();
      intervalId = setInterval(poll, 2000);
    },

    cancel() {
      isConnected = false;
      clearInterval(intervalId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
