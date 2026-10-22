"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Briefcase, FileVideo, Globe, Loader2, Monitor, Sparkles, Square, Smartphone, Trophy, Upload, Zap } from "lucide-react";
import { CampaignPreset } from "@/lib/presets";
import { AspectRatio } from "@/types";

interface VideoUploaderProps {
  onJobCreated: (jobId: string) => void;
}

const MR_BEAST_IMAGE = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQXmhsyvUPtIWVxDQx5NbfHnMWvEyyMh4qRWFTdabc&s=0";
const ISHOWSPEED_IMAGE = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTJGVbrqrMbFulb8Ej8ZlK4n73R-JWIyHBPa2nlAcY&s=0";
const RONALDO_MESSI_IMAGE = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS8EKnaKzhyaDqHdqjg6vgy6WuORU2y8508YdzYCLs&s=0";

const aspectOptions: Array<{ id: AspectRatio; name: string; description: string; icon: React.ElementType }> = [
  { id: "9:16", name: "9:16 Vertical", description: "TikTok, Reels & Shorts", icon: Smartphone },
  { id: "1:1", name: "1:1 Square", description: "Instagram & Facebook feeds", icon: Square },
  { id: "16:9", name: "16:9 Widescreen", description: "YouTube & podcasts", icon: Monitor },
];

const ratioPreviewClasses: Record<AspectRatio, string> = {
  "9:16": "h-8 aspect-[9/16]",
  "1:1": "h-7 aspect-square",
  "16:9": "w-9 aspect-[16/9]",
};

const presetOptions: Array<{ id: CampaignPreset; name: string; badge: string; description: string; icon: React.ElementType; imageUrl?: string; creatorName?: string }> = [
  { id: "VYRO", name: "VYRO Mode", badge: "Max 45s", description: "Hyper-fast pacing, yellow/white captions & instant hook", icon: Zap, imageUrl: MR_BEAST_IMAGE, creatorName: "MrBeast" },
  { id: "WHOP", name: "WHOP Mode", badge: "Top Banner + TXT", description: "Conversion hooks, top banner overlay & transcript export", icon: Briefcase, imageUrl: ISHOWSPEED_IMAGE, creatorName: "IShowSpeed" },
  { id: "SPORTS", name: "SPORTS Mode", badge: "1.02× Speed", description: "Action spikes and dynamic motion framing", icon: Trophy, imageUrl: RONALDO_MESSI_IMAGE, creatorName: "Ronaldo & Messi" },
  { id: "GENERAL", name: "General Mode", badge: "Balanced", description: "Standard clips for podcasts, interviews & vlogs", icon: Globe },
];

function YoutubeIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>;
}

export function VideoUploader({ onJobCreated }: VideoUploaderProps) {
  const [tab, setTab] = useState<"youtube" | "upload">("youtube");
  const [selectedPreset, setSelectedPreset] = useState<CampaignPreset>("GENERAL");
  const [selectedAspect, setSelectedAspect] = useState<AspectRatio>("9:16");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submit = async (body: BodyInit, isJson = false) => {
    setError(null);
    setSubscriptionExpired(false);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/process", { method: "POST", headers: isJson ? { "Content-Type": "application/json" } : undefined, body });
      const data = await response.json();
      if (response.status === 403 && data.code === "SUBSCRIPTION_EXPIRED") {
        setSubscriptionExpired(true);
      }
      if (!response.ok) throw new Error(data.error || "Unable to create video job.");
      onJobCreated(data.id);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitYoutube = (event: React.FormEvent) => {
    event.preventDefault();
    if (!youtubeUrl.trim()) return;
    submit(JSON.stringify({ sourceType: "youtube", sourceUrl: youtubeUrl.trim(), preset: selectedPreset, aspectRatio: selectedAspect }), true);
  };

  const submitFile = () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("preset", selectedPreset);
    formData.append("aspectRatio", selectedAspect);
    submit(formData);
  };

  const selectFile = (nextFile?: File) => {
    if (!nextFile) return;
    if (!nextFile.type.startsWith("video/")) {
      setError("Please choose a valid video file.");
      return;
    }
    setFile(nextFile);
    setError(null);
  };

  return <div className="mx-auto w-full max-w-4xl space-y-6">
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 shadow-2xl backdrop-blur-xl sm:p-5">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300"><Smartphone className="h-4 w-4 text-violet-400" />Target Platform & Aspect Ratio</label>
        <span className="text-[11px] text-slate-400">Choose the layout that fits where you&apos;ll publish</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {aspectOptions.map((option) => {
          const Icon = option.icon;
          const selected = selectedAspect === option.id;
          return <button key={option.id} type="button" onClick={() => setSelectedAspect(option.id)} className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition ${selected ? "border-violet-500 bg-violet-600/20 ring-1 ring-violet-500/50" : "border-white/10 bg-slate-950/60 hover:border-white/20"}`}>
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${selected ? "bg-violet-500 text-white" : "bg-white/5 text-slate-400"}`}><span className={`block rounded-[3px] border-2 border-current ${ratioPreviewClasses[option.id]}`} aria-hidden="true" /><span className="sr-only"><Icon /></span></span>
            <span><b className="block text-xs text-white">{option.name}</b><small className="mt-0.5 block text-[11px] text-slate-400">{option.description}</small></span>
          </button>;
        })}
      </div>
    </section>

    <section>
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700"><Sparkles className="h-3.5 w-3.5 text-amber-500" />Select Campaign Optimization Preset</label>
        <span className="text-[11px] text-slate-500">Choose a creative direction for your clips</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {presetOptions.map((option) => {
          const Icon = option.icon;
          const selected = selectedPreset === option.id;
          return <button key={option.id} type="button" onClick={() => setSelectedPreset(option.id)} className={`relative overflow-hidden rounded-2xl border p-3.5 text-left transition ${selected ? "border-violet-500 bg-violet-600/20 ring-1 ring-violet-500/50" : "border-white/10 bg-slate-900/80 hover:border-white/20"}`}>
            <div className="mb-2 flex items-center justify-between gap-2"><span className={`grid h-9 w-9 place-items-center overflow-hidden rounded-lg ${selected ? "bg-violet-500 text-white" : "bg-white/5 text-slate-400"}`}>{option.imageUrl ? <img src={option.imageUrl} alt={option.creatorName || "Campaign creator"} className="h-full w-full object-cover" loading="lazy" /> : <Icon className="h-4 w-4" />}</span><span className="flex items-center gap-1.5"><small className="text-[9px] font-semibold text-amber-300">{option.creatorName}</small><small className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${selected ? "border border-violet-500/40 bg-violet-500/30 text-violet-100" : "border border-white/5 bg-white/5 text-slate-400"}`}>{option.badge}</small></span></div>
            <b className="text-xs text-white">{option.name}</b><p className="mt-1 text-[11px] leading-snug text-slate-400">{option.description}</p>
          </button>;
        })}
      </div>
    </section>

    <section className="relative rounded-3xl border border-white/10 bg-slate-900/80 p-2 shadow-2xl backdrop-blur-xl">
      <div className="flex gap-2 rounded-2xl border border-white/5 bg-black/40 p-1.5">
        <button type="button" onClick={() => { setTab("youtube"); setError(null); }} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${tab === "youtube" ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white" : "text-slate-400 hover:bg-white/5"}`}><YoutubeIcon className="h-4 w-4 text-red-400" />YouTube URL</button>
        <button type="button" onClick={() => { setTab("upload"); setError(null); }} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${tab === "upload" ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white" : "text-slate-400 hover:bg-white/5"}`}><Upload className="h-4 w-4 text-violet-400" />Upload video</button>
      </div>
      <div className="p-4 sm:p-6">
        {tab === "youtube" ? <form onSubmit={submitYoutube} className="space-y-4"><div className="relative"><YoutubeIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-red-500" /><input type="url" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} disabled={isSubmitting} placeholder="Paste a YouTube link" className="w-full rounded-2xl border border-white/10 bg-slate-950/80 py-4 pl-12 pr-5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-500" /></div><div className="flex flex-col items-center justify-between gap-3 pt-2 sm:flex-row"><span className="text-xs text-slate-400">Output: <b className="text-violet-300">{selectedAspect}</b> · {selectedPreset} mode</span><button disabled={isSubmitting || !youtubeUrl.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-amber-500 px-6 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Process clips</span><ArrowRight className="h-4 w-4" /></>}</button></div></form> : <div className="space-y-4"><input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(event) => selectFile(event.target.files?.[0])} /><button type="button" onClick={() => fileInputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); selectFile(event.dataTransfer.files?.[0]); }} className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${isDragging ? "border-violet-500 bg-violet-500/10" : "border-white/10 bg-slate-950/40 hover:border-violet-500/50"}`}><FileVideo className="mb-3 h-7 w-7 text-violet-400" /><b className="text-sm text-white">{file ? file.name : "Click to upload or drag a video here"}</b><span className="mt-1 text-xs text-slate-400">MP4, MOV or WEBM</span></button><button type="button" onClick={submitFile} disabled={isSubmitting || !file} className="ml-auto flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-amber-500 px-6 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Process {selectedAspect} clips</span><ArrowRight className="h-4 w-4" /></>}</button></div>}
        {error && <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" /><div><p>{error}</p>{subscriptionExpired && <Link href="/pricing?expired=1" className="mt-2 inline-flex font-bold text-violet-200 underline underline-offset-4 hover:text-white">View plans and resubscribe</Link>}</div></div>}
      </div>
    </section>
  </div>;
}
