"use client";

import React, { useState, useRef } from "react";
import { Upload, ArrowRight, Loader2, FileVideo, AlertCircle, Sparkles, Zap, Briefcase, Trophy, Globe } from "lucide-react";
import { CampaignPreset, CAMPAIGN_PRESETS } from "@/lib/presets";

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

interface VideoUploaderProps {
  onJobCreated: (jobId: string) => void;
}

const PRESET_OPTIONS: Array<{
  id: CampaignPreset;
  name: string;
  badge: string;
  desc: string;
  icon: React.ElementType;
}> = [
  {
    id: "VYRO",
    name: "VYRO Mode",
    badge: "Max 45s",
    desc: "Hyper-fast pacing, yellow/white captions & instant hook",
    icon: Zap,
  },
  {
    id: "WHOP",
    name: "WHOP Mode",
    badge: "Top Banner + TXT",
    desc: "Conversion hooks, top banner overlay & transcript export",
    icon: Briefcase,
  },
  {
    id: "SPORTS",
    name: "SPORTS Mode",
    badge: "1.02x Speed",
    desc: "Action spikes & 1.02x speed copyright-bypass",
    icon: Trophy,
  },
  {
    id: "GENERAL",
    name: "General Mode",
    badge: "Balanced",
    desc: "Standard 9:16 vertical clips for podcasts & vlogs",
    icon: Globe,
  },
];

export function VideoUploader({ onJobCreated }: VideoUploaderProps) {
  const [tab, setTab] = useState<"youtube" | "upload">("youtube");
  const [selectedPreset, setSelectedPreset] = useState<CampaignPreset>("GENERAL");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleYoutubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;

    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    if (!ytRegex.test(youtubeUrl.trim())) {
      setError("Please provide a valid YouTube URL (e.g. https://www.youtube.com/watch?v=...)");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "youtube",
          sourceUrl: youtubeUrl.trim(),
          preset: selectedPreset,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create video job");
      }

      const job = await res.json();
      onJobCreated(job.id);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Something went wrong";
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileSubmit = async () => {
    if (!file) return;
    setError(null);
    setIsSubmitting(true);
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("preset", selectedPreset);

      const progressTimer = setInterval(() => {
        setUploadProgress((prev: number) => (prev < 90 ? prev + 15 : prev));
      }, 300);

      const res = await fetch("/api/jobs", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressTimer);
      setUploadProgress(100);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload video");
      }

      const job = await res.json();
      onJobCreated(job.id);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Upload failed";
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith("video/")) {
        setFile(droppedFile);
        setError(null);
      } else {
        setError("Please drop a valid video file (.mp4, .mov, etc.)");
      }
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Campaign Preset Selector */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Select Campaign Optimization Preset</span>
          </label>
          <span className="text-[11px] text-slate-500">
            Presets tune Gemini hook scoring & FFmpeg render filters
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PRESET_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selectedPreset === opt.id;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedPreset(opt.id)}
                className={`p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? "bg-violet-600/20 border-violet-500 shadow-lg shadow-violet-500/20 ring-1 ring-violet-500/50"
                    : "bg-slate-900/60 border-white/10 hover:border-white/20 hover:bg-slate-900"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      isSelected
                        ? "bg-violet-500 text-white"
                        : "bg-white/5 text-slate-400"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isSelected
                        ? "bg-violet-500/30 text-violet-200 border border-violet-500/40"
                        : "bg-white/5 text-slate-400 border border-white/5"
                    }`}
                  >
                    {opt.badge}
                  </span>
                </div>

                <p className="font-bold text-xs text-white">{opt.name}</p>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  {opt.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Input Card */}
      <div className="relative rounded-3xl bg-slate-900/80 border border-white/10 p-2 shadow-2xl backdrop-blur-2xl ring-1 ring-white/5">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-amber-500 rounded-3xl blur opacity-25 -z-10" />

        {/* Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-black/40 rounded-2xl mb-4 border border-white/5">
          <button
            type="button"
            onClick={() => {
              setTab("youtube");
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
              tab === "youtube"
                ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <YoutubeIcon className="w-4 h-4 text-red-400" />
            <span>YouTube URL</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab("upload");
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
              tab === "upload"
                ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <Upload className="w-4 h-4 text-violet-400" />
            <span>Upload MP4 / MOV</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6">
          {tab === "youtube" ? (
            <form onSubmit={handleYoutubeSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type="url"
                  placeholder="Paste YouTube link (e.g. https://www.youtube.com/watch?v=...)"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-2xl px-5 py-4 pl-12 text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all shadow-inner"
                />
                <YoutubeIcon className="w-5 h-5 text-red-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Preset applied: <strong className="text-violet-300">{selectedPreset}</strong> Mode
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !youtubeUrl.trim()}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-amber-500 hover:from-violet-500 hover:via-fuchsia-500 hover:to-amber-400 text-white font-semibold text-sm shadow-xl shadow-violet-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Pipeline...</span>
                    </>
                  ) : (
                    <>
                      <span>Generate {selectedPreset} Shorts</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setFile(e.target.files[0]);
                    setError(null);
                  }
                }}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 flex flex-col items-center justify-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-violet-500 bg-violet-500/10 scale-[1.01]"
                    : "border-white/10 hover:border-violet-500/50 bg-slate-950/40 hover:bg-slate-950/60"
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600/20 to-fuchsia-600/20 border border-violet-500/30 flex items-center justify-center mb-3">
                  <FileVideo className="w-7 h-7 text-violet-400" />
                </div>
                {file ? (
                  <div className="text-center">
                    <p className="font-semibold text-white text-sm sm:text-base">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {(file.size / (1024 * 1024)).toFixed(1)} MB • Click to replace
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="font-semibold text-white text-sm sm:text-base">
                      Click to upload or drag & drop video
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      MP4, MOV, or WEBM up to 500MB
                    </p>
                  </div>
                )}
              </div>

              {isSubmitting && uploadProgress > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Uploading source video...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleFileSubmit}
                  disabled={isSubmitting || !file}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-amber-500 hover:from-violet-500 hover:via-fuchsia-500 hover:to-amber-400 text-white font-semibold text-sm shadow-xl shadow-violet-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing Video...</span>
                    </>
                  ) : (
                    <>
                      <span>Extract {selectedPreset} Shorts</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
