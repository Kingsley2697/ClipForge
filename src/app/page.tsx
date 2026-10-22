"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { VideoUploader } from "@/components/VideoUploader";
import { ProcessingStatus } from "@/components/ProcessingStatus";
import { ClipCard } from "@/components/ClipCard";
import { Clip, VideoJob } from "@/types";
import {
  Sparkles,
  Flame,
  Film,
  Zap,
  TrendingUp,
  RefreshCw,
  Clock,
  FileVideo,
} from "lucide-react";

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export default function DashboardPage() {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeClips, setActiveClips] = useState<Clip[]>([]);
  const [recentJobs, setRecentJobs] = useState<VideoJob[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);

  // Fetch recent jobs
  const fetchJobs = async () => {
    setIsLoadingRecent(true);
    try {
      const res = await fetch("/api/jobs?limit=6");
      if (res.ok) {
        const data = await res.json();
        setRecentJobs(data.jobs || []);
      }
    } catch (err) {
      console.error("Failed to load recent jobs", err);
    } finally {
      setIsLoadingRecent(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleJobCreated = (jobId: string) => {
    setActiveJobId(jobId);
    setActiveClips([]);
    // Smooth scroll to processing section
    window.scrollTo({ top: 350, behavior: "smooth" });
  };

  const handleJobFinished = (clips: Clip[]) => {
    setActiveClips(clips);
    fetchJobs();
  };

  const handleClipDelete = async (clipId: string) => {
    try {
      const res = await fetch(`/api/clips/${clipId}`, { method: "DELETE" });
      if (res.ok) {
        setActiveClips((prev) => prev.filter((c) => c.id !== clipId));
      }
    } catch (err) {
      console.error("Failed to delete clip", err);
    }
  };

  const selectPastJob = async (job: VideoJob) => {
    setActiveJobId(job.id);
    setActiveClips(job.clips || []);
    window.scrollTo({ top: 350, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col selection:bg-violet-500 selection:text-white">
      <Navbar />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto pt-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-xs font-semibold text-violet-300 shadow-inner">
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: "3s" }} />
            <span>From long-form to share-worthy</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-950 leading-tight">
            Turn Any Long Video Into{" "}
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-amber-300 bg-clip-text text-transparent">
              Viral 9:16 Shorts
            </span>
          </h1>

          <p className="text-slate-600 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Transform long videos into polished, platform-ready clips with engaging captions
            and framing tailored to where you publish.
          </p>
        </div>

        {/* Input Card */}
        <section>
          <VideoUploader onJobCreated={handleJobCreated} />
        </section>

        {/* Active Pipeline Status (if job is active) */}
        {activeJobId && (
          <section className="animate-fadeIn">
            <ProcessingStatus
              jobId={activeJobId}
              onFinished={handleJobFinished}
            />
          </section>
        )}

        {/* Generated Clips Gallery */}
        {activeClips.length > 0 && (
          <section className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-400" />
                  <h2 className="text-xl font-bold text-slate-950">
                    Generated Viral Clips ({activeClips.length})
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ranked by viral hook potential with burnt-in animated captions
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Ready for TikTok, Reels & Shorts</span>
              </div>
            </div>

            {/* Clips Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {activeClips.map((clip) => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  onDelete={handleClipDelete}
                />
              ))}
            </div>
          </section>
        )}

        {/* Recent Jobs History Section */}
        {recentJobs.length > 0 && (
          <section className="space-y-4 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <h3 className="text-base font-bold text-slate-950">Recent Repurposed Videos</h3>
              </div>
              <button
                type="button"
                onClick={fetchJobs}
                disabled={isLoadingRecent}
                className="text-xs text-slate-500 hover:text-slate-950 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRecent ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentJobs.map((job) => (
                <div
                  key={job.id}
                  onClick={() => selectPastJob(job)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    activeJobId === job.id
                      ? "bg-violet-500/10 border-violet-500/40 ring-1 ring-violet-500/30"
                      : "bg-slate-900/60 border-white/10 hover:border-white/20 hover:bg-slate-900/90"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {job.sourceType === "youtube" ? (
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                          <YoutubeIcon className="w-4 h-4 text-red-400" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                          <FileVideo className="w-4 h-4 text-violet-400" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-xs text-white truncate max-w-[180px]">
                          {job.videoTitle || "Untitled Video"}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-400">
                            {new Date(job.createdAt).toLocaleDateString()}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                            {job.aspectRatio || "9:16"}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-white/5 text-slate-400 border border-white/5">
                            {job.preset || "GENERAL"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        job.status === "COMPLETED" || job.status === "done"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : job.status === "FAILED" || job.status === "failed"
                          ? "bg-red-500/20 text-red-300 border border-red-500/30"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse"
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{job.clips?.length || 0} clips generated</span>
                    <span className="text-violet-400 font-medium hover:underline">
                      View Clips →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet-400" />
            <span className="text-slate-700 font-semibold">ClipForge</span>
            <span>—</span>
            <span>Creator tools for better video distribution</span>
          </div>

          <p>© 2026 ClipForge AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
