"use client";

import React, { useEffect, useState } from "react";
import {
  Download,
  Mic,
  BrainCircuit,
  Film,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  Zap,
  Briefcase,
  Trophy,
  Globe,
} from "lucide-react";
import { Clip, CampaignPreset } from "@/types";

interface ProcessingStatusProps {
  jobId: string;
  onFinished?: (clips: Clip[]) => void;
}

const STEPS = [
  {
    key: "download",
    threshold: 10,
    label: "Ingesting Source",
    desc: "Fetching video and extracting audio stream",
    icon: Download,
  },
  {
    key: "transcribe",
    threshold: 30,
    label: "Whisper Transcription",
    desc: "Aligning word-level timestamps",
    icon: Mic,
  },
  {
    key: "analyze",
    threshold: 55,
    label: "Gemini Preset Analysis",
    desc: "Scoring viral hooks & speech pacing",
    icon: BrainCircuit,
  },
  {
    key: "render",
    threshold: 80,
    label: "FFmpeg 9:16 Render",
    desc: "Cropping vertical & burning dynamic captions",
    icon: Film,
  },
];

export function ProcessingStatus({ jobId, onFinished }: ProcessingStatusProps) {
  const [status, setStatus] = useState<string>("PENDING");
  const [progress, setProgress] = useState(0);
  const [preset, setPreset] = useState<CampaignPreset>("GENERAL");
  const [videoTitle, setVideoTitle] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;
    const eventSource = new EventSource(`/api/jobs/${jobId}/status`);

    eventSource.onmessage = (event) => {
      if (!isSubscribed) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === "update") {
          setStatus(data.status);
          setProgress(data.progress || 0);
          if (data.preset) setPreset(data.preset);
          if (data.videoTitle) setVideoTitle(data.videoTitle);
          if (data.errorMessage) setErrorMessage(data.errorMessage);

          if ((data.status === "COMPLETED" || data.status === "done") && onFinished && data.clips) {
            onFinished(data.clips);
          }
        } else if (data.type === "error") {
          setErrorMessage(data.message || "Pipeline error");
        }
      } catch (err) {
        console.error("SSE parse error", err);
      }
    };

    eventSource.onerror = () => {
      if (status === "COMPLETED" || status === "FAILED" || status === "done" || status === "failed") {
        eventSource.close();
      }
    };

    return () => {
      isSubscribed = false;
      eventSource.close();
    };
  }, [jobId, status, onFinished]);

  const isCompleted = status === "COMPLETED" || status === "done";
  const isFailed = status === "FAILED" || status === "failed";

  const getStepState = (threshold: number, index: number) => {
    if (isFailed) return "failed";
    if (isCompleted) return "completed";
    if (progress > threshold + 20) return "completed";
    if (progress >= threshold) return "active";
    return "pending";
  };

  const getPresetTag = () => {
    switch (preset) {
      case "VYRO":
        return { label: "VYRO Mode (Max 45s)", icon: Zap, color: "text-amber-400 bg-amber-500/10 border-amber-500/30" };
      case "WHOP":
        return { label: "WHOP Mode (Top Hook + TXT)", icon: Briefcase, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
      case "SPORTS":
        return { label: "SPORTS Mode (1.02x Speed)", icon: Trophy, color: "text-blue-400 bg-blue-500/10 border-blue-500/30" };
      default:
        return { label: "GENERAL Mode (9:16 Shorts)", icon: Globe, color: "text-slate-300 bg-white/5 border-white/10" };
    }
  };

  const presetTag = getPresetTag();
  const PresetIcon = presetTag.icon;

  return (
    <div className="w-full max-w-4xl mx-auto rounded-3xl bg-slate-900/90 border border-white/10 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isCompleted ? "bg-emerald-400" : isFailed ? "bg-red-500" : "bg-violet-400 animate-ping"}`} />
            <h3 className="font-bold text-lg text-white">
              {isCompleted
                ? "Shorts Ready for Publishing!"
                : isFailed
                ? "Processing Encountered An Issue"
                : "AI Pipeline In Progress..."}
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-md truncate">
            {videoTitle || `Job ID: ${jobId}`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${presetTag.color}`}>
            <PresetIcon className="w-3.5 h-3.5" />
            <span>{presetTag.label}</span>
          </div>

          <div className="text-right">
            <span className="text-2xl font-black bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              {progress}%
            </span>
          </div>
        </div>
      </div>

      {/* Global Progress Bar */}
      <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden mb-8 border border-white/5">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            isFailed
              ? "bg-red-500"
              : "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stepper Pipeline */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {STEPS.map((step, idx) => {
          const state = getStepState(step.threshold, idx);
          const Icon = step.icon;

          return (
            <div
              key={step.key}
              className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                state === "completed"
                  ? "bg-emerald-500/5 border-emerald-500/20"
                  : state === "active"
                  ? "bg-violet-500/10 border-violet-500/40 shadow-lg shadow-violet-500/10 ring-1 ring-violet-500/20"
                  : "bg-slate-950/40 border-white/5 opacity-50"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  state === "completed"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : state === "active"
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/40"
                    : "bg-white/5 text-slate-500 border border-white/5"
                }`}
              >
                {state === "completed" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : state === "active" ? (
                  <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm text-white truncate">
                    {step.label}
                  </h4>
                  {state === "active" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-medium">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {errorMessage && (
        <div className="mt-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-xs text-red-300">
          <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-200">Processing error:</p>
            <p className="mt-0.5 text-red-300/90">{errorMessage}</p>
          </div>
        </div>
      )}

      {isCompleted && (
        <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-200">
              Clips optimized and formatted for {preset} campaign guidelines!
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
