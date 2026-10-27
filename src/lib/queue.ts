// src/lib/queue.ts — BullMQ Video Processing Queue with Campaign Preset support
import { Queue, Job, QueueEvents } from "bullmq";
import { getRedisConfig } from "./redis";
import { CampaignPreset } from "./presets";
import { AspectRatio } from "@/types";

export const VIDEO_QUEUE_NAME = "video-processing";

/**
 * Non-destructive visual and audio styling controls applied during rendering.
 * Background audio must be a user-supplied, licensed local file.
 */
export interface CreativeEditOptions {
  enabled: boolean;
  speed: 0.98 | 1 | 1.02;
  colorGrade: boolean;
  mirror: boolean;
  /** Pitch in semitones; rendered with stock FFmpeg filters while retaining duration. */
  pitchSemitones: -1 | 0 | 1;
  /** Original-program audio gain, from 0 (muted) to 1 (unchanged). */
  commentaryVolume: number;
  /** Absolute path for an optional licensed background-audio upload. */
  backgroundAudioPath?: string;
  /** Background-audio gain, from 0 to 1. */
  backgroundAudioVolume: number;
}

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
  jobId: string;                   // VideoJob.id in DB
  sourceType: "youtube" | "upload";
  sourceUrl?: string;
  sourceFile?: string;
  preset?: CampaignPreset;
  aspectRatio?: AspectRatio;
  /** FFmpeg xfade transition name (e.g. "fade", "wipeleft", "circlecrop") or "none" */
  transitionStyle?: string;
  /** Duration of the xfade transition in seconds (default: 0.4) */
  transitionDuration?: number;
  creativeEdit?: CreativeEditOptions;
}

export interface ClipRenderPayload {
  clipId: string;
  jobId: string;
  sourceFile: string;
  startTime: number;
  endTime: number;
  preset: CampaignPreset;
  aspectRatio?: AspectRatio;
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
