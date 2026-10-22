// src/types/index.ts — Shared TypeScript types
import { CampaignPreset } from "@/lib/presets";

export type { CampaignPreset };

export type AspectRatio = "9:16" | "1:1" | "16:9";

export type JobStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "pending"
  | "downloading"
  | "transcribing"
  | "analyzing"
  | "rendering"
  | "done"
  | "failed";

export type ClipStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "pending" | "rendering" | "done" | "failed";

export interface Clip {
  id: string;
  jobId: string;
  campaignType: CampaignPreset;
  aspectRatio: AspectRatio;
  title: string;
  hookText: string | null;
  score: number; // Float, e.g. 9.5
  reasoning: string | null;
  startTime: number;
  endTime: number;
  duration: number;
  outputUrl: string | null;
  outputPath: string | null;
  transcript: string | null;
  srtPath: string | null;
  thumbnailPath: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VideoJob {
  id: string;
  userId: string | null;
  videoUrl: string | null;
  sourceType: "youtube" | "upload";
  sourceUrl: string | null;
  sourceFile: string | null;
  preset: CampaignPreset;
  aspectRatio: AspectRatio;
  status: string;
  errorMessage: string | null;
  progress: number;
  transcriptPath: string | null;
  transcriptText: string | null;
  analysisPath: string | null;
  videoTitle: string | null;
  videoDuration: number | null;
  thumbnailPath: string | null;
  createdAt: string;
  updatedAt: string;
  clips: Clip[];
}

export interface SSEUpdate {
  type: "update" | "error";
  status?: string;
  progress?: number;
  videoTitle?: string;
  preset?: CampaignPreset;
  clips?: Partial<Clip>[];
  errorMessage?: string;
  message?: string;
}

export interface PaginatedJobs {
  jobs: VideoJob[];
  total: number;
  page: number;
  limit: number;
}
