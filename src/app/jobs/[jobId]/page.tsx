"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { ProcessingStatus } from "@/components/ProcessingStatus";
import { ClipCard } from "@/components/ClipCard";
import { VideoJob, Clip } from "@/types";
import { ArrowLeft, Flame, Sparkles, Loader2, Calendar, Clock, Film } from "lucide-react";
import Link from "next/link";

function JobDetailContent() {
  const params = useParams();
  const router = useRouter();
  const jobId = params?.jobId as string;

  const [job, setJob] = useState<VideoJob | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchJob = async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setJob(data);
        setClips(data.clips || []);
      }
    } catch (err) {
      console.error("Failed to load job", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJob();
  }, [jobId]);

  const handleClipDelete = async (clipId: string) => {
    try {
      const res = await fetch(`/api/clips/${clipId}`, { method: "DELETE" });
      if (res.ok) {
        setClips((prev) => prev.filter((c) => c.id !== clipId));
      }
    } catch (err) {
      console.error("Failed to delete clip", err);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* Back Link */}
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-950 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="w-8 h-8 text-violet-500 animate-spin mb-3" />
            <p className="text-sm">Loading video job details...</p>
          </div>
        ) : !job ? (
          <div className="text-center py-20 text-slate-500">
            <p className="text-lg font-semibold text-slate-950">Job not found</p>
            <Link
              href="/"
              className="mt-4 inline-block px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold"
            >
              Return Home
            </Link>
          </div>
        ) : (
          <>
            {/* Header / Meta */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
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
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    {job.preset || "GENERAL"} MODE
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/15">
                    {job.aspectRatio || "9:16"}
                  </span>
                  <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold">
                    {job.sourceType}
                  </span>
                </div>

                <h1 className="text-2xl font-black text-slate-950">
                  {job.videoTitle || "Untitled Video Processing Job"}
                </h1>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(job.createdAt).toLocaleString()}</span>
                  </div>
                  {job.videoDuration && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{Math.round(job.videoDuration)}s total duration</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5" />
                    <span>{clips.length} clips produced</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Pipeline Stepper if not done */}
            {job.status !== "COMPLETED" && job.status !== "done" && job.status !== "FAILED" && job.status !== "failed" && (
              <ProcessingStatus
                jobId={job.id}
                onFinished={(newClips) => {
                  setClips(newClips);
                  fetchJob();
                }}
              />
            )}

            {/* Clips Section */}
            {clips.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
                  <Flame className="w-5 h-5 text-amber-400" />
                  <h2 className="text-xl font-bold text-slate-950">
                    9:16 Viral Shorts ({clips.length})
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {clips.map((clip) => (
                    <ClipCard
                      key={clip.id}
                      clip={clip}
                      onDelete={handleClipDelete}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function JobDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white text-slate-900 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        </div>
      }
    >
      <JobDetailContent />
    </Suspense>
  );
}
