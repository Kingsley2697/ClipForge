// src/lib/queue.ts — BullMQ Video Processing Queue with Campaign Preset support
import { Queue, Job, QueueEvents } from "bullmq";
import { getRedisConfig } from "./redis";
import { CampaignPreset } from "./presets";

export const VIDEO_QUEUE_NAME = "video-processing";

// --------------- Queue Singleton ---------------
let videoQueue: Queue | null = null;

export function getVideoQueue(): Queue {
  if (!videoQueue) {
    videoQueue = new Queue(VIDEO_QUEUE_NAME, {
      connection: getRedisConfig(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return videoQueue;
}

// --------------- Job Payload ---------------
export interface VideoJobPayload {
  jobId: string;         // VideoJob.id in DB
  sourceType: "youtube" | "upload";
  sourceUrl?: string;
  sourceFile?: string;
  preset?: CampaignPreset;
}

export interface ClipRenderPayload {
  clipId: string;
  jobId: string;
  sourceFile: string;
  startTime: number;
  endTime: number;
  preset: CampaignPreset;
  hookText?: string;
  srtContent: string;
}

// --------------- Queue Events ---------------
let queueEvents: QueueEvents | null = null;

export function getQueueEvents(): QueueEvents {
  if (!queueEvents) {
    queueEvents = new QueueEvents(VIDEO_QUEUE_NAME, {
      connection: getRedisConfig(),
    });
  }
  return queueEvents;
}

// --------------- Helper: Add Job ---------------
export async function enqueueVideoJob(payload: VideoJobPayload): Promise<Job> {
  const queue = getVideoQueue();
  return queue.add("process-video", payload, {
    jobId: `video-${payload.jobId}`,
  });
}
