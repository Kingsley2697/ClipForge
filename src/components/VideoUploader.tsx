"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowRight, Briefcase, ChevronDown, Clock,
  FileVideo, Globe, Loader2, Monitor, Pencil, Smartphone,
  Sparkles, Square, Trophy, Upload, Zap,
} from "lucide-react";
import { CampaignPreset } from "@/lib/presets";
import { AspectRatio } from "@/types";

interface VideoUploaderProps {
  onJobCreated: (jobId: string) => void;
}

// ---------------------------------------------------------------------------
// Static assets (creator thumbnails)
// ---------------------------------------------------------------------------
const MR_BEAST_IMAGE = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQXmhsyvUPtIWVxDQx5NbfHnMWvEyyMh4qRWFTdabc&s=0";
const ISHOWSPEED_IMAGE = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTJGVbrqrMbFulb8Ej8ZlK4n73R-JWIyHBPa2nlAcY&s=0";
const RONALDO_MESSI_IMAGE = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS8EKnaKzhyaDqHdqjg6vgy6WuORU2y8508YdzYCLs&s=0";

// ---------------------------------------------------------------------------
// Aspect Ratio options
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Campaign Preset options
// ---------------------------------------------------------------------------
const presetOptions: Array<{
  id: CampaignPreset;
  name: string;
  badge: string;
  description: string;
  icon: React.ElementType;
  imageUrl?: string;
  creatorName?: string;
}> = [
  { id: "VYRO", name: "VYRO Mode", badge: "Max 45s", description: "Hyper-fast pacing, yellow/white captions & instant hook", icon: Zap, imageUrl: MR_BEAST_IMAGE, creatorName: "MrBeast" },
  { id: "WHOP", name: "WHOP Mode", badge: "Top Banner + TXT", description: "Conversion hooks, top banner overlay & transcript export", icon: Briefcase, imageUrl: ISHOWSPEED_IMAGE, creatorName: "IShowSpeed" },
  { id: "SPORTS", name: "SPORTS Mode", badge: "1.02× Speed", description: "Action spikes and dynamic motion framing", icon: Trophy, imageUrl: RONALDO_MESSI_IMAGE, creatorName: "Ronaldo & Messi" },
  { id: "GENERAL", name: "General Mode", badge: "Balanced", description: "Standard clips for podcasts, interviews & vlogs", icon: Globe },
];

// ---------------------------------------------------------------------------
// Transition preset options
// ---------------------------------------------------------------------------
interface TransitionOption {
  value: string;
  label: string;
  description: string;
  emoji: string;
}

const TRANSITION_PRESETS: TransitionOption[] = [
  { value: "zoomout",   label: "Zoom Out",    description: "Dynamic pull-back",              emoji: "🔎" },
  { value: "fade",      label: "Fade",        description: "Classic cross-dissolve",          emoji: "🌅" },
  { value: "wipeleft",  label: "Wipe Left",   description: "Fast side wipe →",               emoji: "⬅️" },
  { value: "wiperight", label: "Wipe Right",  description: "Fast side wipe ←",               emoji: "➡️" },
  { value: "zoomin",    label: "Zoom In",     description: "Dynamic punch-in",               emoji: "🔍" },
  { value: "slideup",   label: "Slide Up",    description: "Vertical push from below",       emoji: "⬆️" },
  { value: "slidedown", label: "Slide Down",  description: "Vertical push from above",       emoji: "⬇️" },
  { value: "circlecrop",label: "Circle Crop", description: "Iris wipe (circular crop)",      emoji: "⭕" },
  { value: "pixelize",  label: "Pixelize",    description: "Pixel-block dissolve",           emoji: "🎮" },
  { value: "radial",    label: "Radial",      description: "Clock-sweep wipe",               emoji: "🕐" },
  { value: "diagtl",    label: "Diagonal TL", description: "Corner sweep top-left",         emoji: "↗️" },
  { value: "none",      label: "None",        description: "Hard cut — no transition",       emoji: "✂️" },
  { value: "custom",    label: "Custom…",     description: "Enter any xfade name",           emoji: "✏️" },
];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function VideoUploader({ onJobCreated }: VideoUploaderProps) {
  // Source tab
  const [tab, setTab] = useState<"youtube" | "upload">("youtube");

  // Campaign
  const [selectedPreset, setSelectedPreset] = useState<CampaignPreset>("GENERAL");
  const [selectedAspect, setSelectedAspect] = useState<AspectRatio>("9:16");

  // Transition
  const [transitionPreset, setTransitionPreset] = useState<string>("fade");
  const [customTransition, setCustomTransition]   = useState<string>("");
  const [transitionDuration, setTransitionDuration] = useState<number>(0.4);

  // Creative Edit Mode
  const [creativeEditEnabled, setCreativeEditEnabled] = useState(false);
  const [creativeSpeed, setCreativeSpeed] = useState<0.98 | 1 | 1.02>(1);
  const [colorGrade, setColorGrade] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [pitchSemitones, setPitchSemitones] = useState<-1 | 0 | 1>(0);
  const [commentaryVolume, setCommentaryVolume] = useState(1);
  const [backgroundAudio, setBackgroundAudio] = useState<File | null>(null);
  const [backgroundAudioVolume, setBackgroundAudioVolume] = useState(0.2);

  // Source inputs
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resolved transition style sent to the API
  const resolvedTransitionStyle = transitionPreset === "custom"
    ? customTransition.trim() || "fade"
    : transitionPreset;
  const creativeEdit = {
    enabled: creativeEditEnabled,
    speed: creativeSpeed,
    colorGrade,
    mirror,
    pitchSemitones,
    commentaryVolume,
    backgroundAudioVolume,
  };

  // ---------------------------------------------------------------------------
  // Submit helpers
  // ---------------------------------------------------------------------------
  const submit = async (body: BodyInit, isJson = false) => {
    setError(null);
    setSubscriptionExpired(false);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/process", {
        method: "POST",
        headers: isJson ? { "Content-Type": "application/json" } : undefined,
        body,
      });
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
    if (creativeEditEnabled && backgroundAudio) {
      const formData = new FormData();
      formData.append("sourceType", "youtube");
      formData.append("sourceUrl", youtubeUrl.trim());
      formData.append("preset", selectedPreset);
      formData.append("aspectRatio", selectedAspect);
      formData.append("transitionStyle", resolvedTransitionStyle);
      formData.append("transitionDuration", String(transitionDuration));
      formData.append("creativeEdit", JSON.stringify(creativeEdit));
      formData.append("backgroundAudio", backgroundAudio);
      submit(formData);
      return;
    }
    submit(
      JSON.stringify({
        sourceType: "youtube",
        sourceUrl: youtubeUrl.trim(),
        preset: selectedPreset,
        aspectRatio: selectedAspect,
        transitionStyle: resolvedTransitionStyle,
        transitionDuration,
        creativeEdit,
      }),
      true
    );
  };

  const submitFile = () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("preset", selectedPreset);
    formData.append("aspectRatio", selectedAspect);
    formData.append("transitionStyle", resolvedTransitionStyle);
    formData.append("transitionDuration", String(transitionDuration));
    formData.append("creativeEdit", JSON.stringify(creativeEdit));
    if (creativeEditEnabled && backgroundAudio) {
      formData.append("backgroundAudio", backgroundAudio);
    }
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

  const isCustomMode = transitionPreset === "custom";
  const selectedTransitionOption = TRANSITION_PRESETS.find((t) => t.value === transitionPreset);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">

      {/* ── Aspect Ratio ──────────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 shadow-2xl backdrop-blur-xl sm:p-5">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
            <Smartphone className="h-4 w-4 text-violet-400" />Target Platform &amp; Aspect Ratio
          </label>
          <span className="text-[11px] text-slate-400">Choose the layout that fits where you&apos;ll publish</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {aspectOptions.map((option) => {
            const Icon = option.icon;
            const selected = selectedAspect === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedAspect(option.id)}
                className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition ${selected ? "border-violet-500 bg-violet-600/20 ring-1 ring-violet-500/50" : "border-white/10 bg-slate-950/60 hover:border-white/20"}`}
              >
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${selected ? "bg-violet-500 text-white" : "bg-white/5 text-slate-400"}`}>
                  <span className={`block rounded-[3px] border-2 border-current ${ratioPreviewClasses[option.id]}`} aria-hidden="true" />
                  <span className="sr-only"><Icon /></span>
                </span>
                <span>
                  <b className="block text-xs text-white">{option.name}</b>
                  <small className="mt-0.5 block text-[11px] text-slate-400">{option.description}</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Campaign Preset ───────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />Select Campaign Optimization Preset
          </label>
          <span className="text-[11px] text-slate-500">Choose a creative direction for your clips</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {presetOptions.map((option) => {
            const Icon = option.icon;
            const selected = selectedPreset === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedPreset(option.id)}
                className={`relative overflow-hidden rounded-2xl border p-3.5 text-left transition ${selected ? "border-violet-500 bg-violet-600/20 ring-1 ring-violet-500/50" : "border-white/10 bg-slate-900/80 hover:border-white/20"}`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className={`grid h-9 w-9 place-items-center overflow-hidden rounded-lg ${selected ? "bg-violet-500 text-white" : "bg-white/5 text-slate-400"}`}>
                    {option.imageUrl
                      ? <img src={option.imageUrl} alt={option.creatorName || "Campaign creator"} className="h-full w-full object-cover" loading="lazy" />
                      : <Icon className="h-4 w-4" />}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <small className="text-[9px] font-semibold text-amber-300">{option.creatorName}</small>
                    <small className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${selected ? "border border-violet-500/40 bg-violet-500/30 text-violet-100" : "border border-white/5 bg-white/5 text-slate-400"}`}>{option.badge}</small>
                  </span>
                </div>
                <b className="text-xs text-white">{option.name}</b>
                <p className="mt-1 text-[11px] leading-snug text-slate-400">{option.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Transition Options ────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 shadow-2xl backdrop-blur-xl sm:p-5">
        {/* Header */}
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <label
            htmlFor="transition-preset-select"
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300"
          >
            <span className="text-base leading-none" aria-hidden="true">🎬</span>
            Transition Options
          </label>
          <span className="text-[11px] text-slate-400">Controls FFmpeg xfade effect between video cuts</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto]">
          {/* Preset dropdown */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="transition-preset-select" className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Effect Preset
            </label>
            <div className="relative">
              <select
                id="transition-preset-select"
                value={transitionPreset}
                onChange={(e) => setTransitionPreset(e.target.value)}
                disabled={isSubmitting}
                className="w-full appearance-none rounded-xl border border-white/10 bg-slate-950/80 py-3 pl-4 pr-10 text-sm text-white outline-none focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {TRANSITION_PRESETS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.emoji} {t.label} — {t.description}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            {selectedTransitionOption && (
              <p className="text-[10px] text-slate-500 leading-relaxed">
                {selectedTransitionOption.emoji} <span className="text-slate-400">{selectedTransitionOption.description}</span>
              </p>
            )}
          </div>

          {/* Custom transition name input */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="custom-transition-input" className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <Pencil className="h-3 w-3" />
              Custom Transition Name
            </label>
            <div className="relative">
              <input
                id="custom-transition-input"
                type="text"
                value={isCustomMode ? customTransition : (transitionPreset === "none" ? "" : transitionPreset)}
                onChange={(e) => {
                  const val = e.target.value;
                  // If user starts typing, auto-switch to custom mode
                  if (!isCustomMode) setTransitionPreset("custom");
                  setCustomTransition(val);
                }}
                onFocus={() => {
                  if (!isCustomMode) {
                    setCustomTransition(transitionPreset === "none" || transitionPreset === "custom" ? "" : transitionPreset);
                    setTransitionPreset("custom");
                  }
                }}
                disabled={isSubmitting}
                placeholder={isCustomMode ? "e.g. circlecrop, pixelize, radial..." : "Select Custom or type here"}
                className={`w-full rounded-xl border py-3 pl-4 pr-4 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-60
                  ${isCustomMode
                    ? "border-fuchsia-500/50 bg-fuchsia-950/30 text-white placeholder:text-fuchsia-500/50 focus:border-fuchsia-400"
                    : "border-white/10 bg-slate-950/80 text-slate-400 placeholder:text-slate-600 focus:border-violet-500 focus:text-white"
                  }`}
              />
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Any valid{" "}
              <a
                href="https://ffmpeg.org/ffmpeg-filters.html#xfade"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 underline underline-offset-2 hover:text-violet-300"
              >
                FFmpeg xfade
              </a>{" "}
              name — e.g. <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-[9px] text-slate-300">diagtl</code>,{" "}
              <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-[9px] text-slate-300">pixelize</code>,{" "}
              <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-[9px] text-slate-300">radial</code>
            </p>
          </div>

          {/* Duration input */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="transition-duration-input" className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <Clock className="h-3 w-3" />
              Duration (s)
            </label>
            <input
              id="transition-duration-input"
              type="number"
              min={0.1}
              max={3}
              step={0.1}
              value={transitionDuration}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val >= 0.1 && val <= 3) setTransitionDuration(val);
              }}
              disabled={isSubmitting || transitionPreset === "none"}
              className="w-24 rounded-xl border border-white/10 bg-slate-950/80 py-3 px-4 text-sm text-white outline-none focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p className="text-[10px] text-slate-500">0.1 – 3.0 s</p>
          </div>
        </div>

        {/* Live preview badge */}
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/5 bg-black/30 px-3 py-2">
          <span className="text-[11px] text-slate-500">Active transition:</span>
          <span className="rounded-full bg-violet-600/30 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-violet-300 ring-1 ring-violet-500/30">
            {resolvedTransitionStyle || "none"}
          </span>
          {resolvedTransitionStyle !== "none" && (
            <span className="text-[11px] text-slate-500">
              × <span className="text-slate-300">{transitionDuration}s</span>
            </span>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 shadow-2xl backdrop-blur-xl sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-white">Creative Edit Options</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">Optional styling for media you have the rights to use.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={creativeEditEnabled}
            onClick={() => setCreativeEditEnabled((enabled) => !enabled)}
            disabled={isSubmitting}
            className={`relative h-7 w-12 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${creativeEditEnabled ? "bg-violet-600" : "bg-slate-700"}`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${creativeEditEnabled ? "left-6" : "left-1"}`} />
            <span className="sr-only">Enable Creative Edit Options</span>
          </button>
        </div>

        {creativeEditEnabled && (
          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-white/10 pt-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Playback speed
              <select value={creativeSpeed} onChange={(event) => setCreativeSpeed(Number(event.target.value) as 0.98 | 1 | 1.02)} disabled={isSubmitting} className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm normal-case tracking-normal text-white outline-none focus:border-violet-500">
                <option value={0.98}>0.98x</option>
                <option value={1}>1.00x</option>
                <option value={1.02}>1.02x</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Voice pitch
              <select value={pitchSemitones} onChange={(event) => setPitchSemitones(Number(event.target.value) as -1 | 0 | 1)} disabled={isSubmitting} className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm normal-case tracking-normal text-white outline-none focus:border-violet-500">
                <option value={-1}>Lower (-1 semitone)</option>
                <option value={0}>Original</option>
                <option value={1}>Higher (+1 semitone)</option>
              </select>
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-3 text-sm text-slate-200">
              <span><b className="block text-xs">Color grade</b><small className="text-[10px] text-slate-500">Boost contrast and saturation</small></span>
              <input type="checkbox" checked={colorGrade} onChange={(event) => setColorGrade(event.target.checked)} disabled={isSubmitting} className="h-4 w-4 accent-violet-500" />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-3 text-sm text-slate-200">
              <span><b className="block text-xs">Mirror frame</b><small className="text-[10px] text-slate-500">Flip the video horizontally</small></span>
              <input type="checkbox" checked={mirror} onChange={(event) => setMirror(event.target.checked)} disabled={isSubmitting} className="h-4 w-4 accent-violet-500" />
            </label>

            <label className="flex flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Commentary level
              <select value={commentaryVolume} onChange={(event) => setCommentaryVolume(Number(event.target.value))} disabled={isSubmitting} className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm normal-case tracking-normal text-white outline-none focus:border-violet-500">
                <option value={1}>100% - original</option>
                <option value={0.5}>50% - ducked</option>
                <option value={0}>0% - muted</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Licensed background audio
              <input type="file" accept="audio/*" onChange={(event) => setBackgroundAudio(event.target.files?.[0] || null)} disabled={isSubmitting} className="block w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-xs normal-case tracking-normal text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600/30 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-violet-100" />
              <small className="normal-case tracking-normal text-slate-500">{backgroundAudio ? backgroundAudio.name : "Optional; upload only audio you are licensed to use."}</small>
            </label>

            <label className="flex flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 sm:col-span-2">
              Background audio level: {Math.round(backgroundAudioVolume * 100)}%
              <input type="range" min="0" max="1" step="0.05" value={backgroundAudioVolume} onChange={(event) => setBackgroundAudioVolume(Number(event.target.value))} disabled={isSubmitting || !backgroundAudio} className="accent-violet-500 disabled:opacity-50" />
            </label>
          </div>
        )}
      </section>

      {/* ── Source Input ──────────────────────────────────────────────────── */}
      <section className="relative rounded-3xl border border-white/10 bg-slate-900/80 p-2 shadow-2xl backdrop-blur-xl">
        <div className="flex gap-2 rounded-2xl border border-white/5 bg-black/40 p-1.5">
          <button
            type="button"
            onClick={() => { setTab("youtube"); setError(null); }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${tab === "youtube" ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white" : "text-slate-400 hover:bg-white/5"}`}
          >
            <YoutubeIcon className="h-4 w-4 text-red-400" />YouTube URL
          </button>
          <button
            type="button"
            onClick={() => { setTab("upload"); setError(null); }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${tab === "upload" ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white" : "text-slate-400 hover:bg-white/5"}`}
          >
            <Upload className="h-4 w-4 text-violet-400" />Upload video
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {tab === "youtube" ? (
            <form onSubmit={submitYoutube} className="space-y-4">
              <div className="relative">
                <YoutubeIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-red-500" />
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(event) => setYoutubeUrl(event.target.value)}
                  disabled={isSubmitting}
                  placeholder="Paste a YouTube link"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 py-4 pl-12 pr-5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-500"
                />
              </div>
              <div className="flex flex-col items-center justify-between gap-3 pt-2 sm:flex-row">
                <span className="text-xs text-slate-400">
                  Output: <b className="text-violet-300">{selectedAspect}</b> · {selectedPreset} mode · <b className="text-fuchsia-300">{resolvedTransitionStyle}</b>
                </span>
                <button
                  disabled={isSubmitting || !youtubeUrl.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-amber-500 px-6 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Process clips</span><ArrowRight className="h-4 w-4" /></>}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(event) => selectFile(event.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => { event.preventDefault(); setIsDragging(false); selectFile(event.dataTransfer.files?.[0]); }}
                className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${isDragging ? "border-violet-500 bg-violet-500/10" : "border-white/10 bg-slate-950/40 hover:border-violet-500/50"}`}
              >
                <FileVideo className="mb-3 h-7 w-7 text-violet-400" />
                <b className="text-sm text-white">{file ? file.name : "Click to upload or drag a video here"}</b>
                <span className="mt-1 text-xs text-slate-400">MP4, MOV or WEBM</span>
              </button>
              <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                <span className="text-xs text-slate-400">
                  Output: <b className="text-violet-300">{selectedAspect}</b> · {selectedPreset} mode · <b className="text-fuchsia-300">{resolvedTransitionStyle}</b>
                </span>
                <button
                  type="button"
                  onClick={submitFile}
                  disabled={isSubmitting || !file}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-amber-500 px-6 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Process {selectedAspect} clips</span><ArrowRight className="h-4 w-4" /></>}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <div>
                <p>{error}</p>
                {subscriptionExpired && (
                  <Link href="/pricing?expired=1" className="mt-2 inline-flex font-bold text-violet-200 underline underline-offset-4 hover:text-white">
                    View plans and resubscribe
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
