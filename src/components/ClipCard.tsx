"use client";

import React, { useState, useRef } from "react";
import {
  Play,
  Pause,
  Download,
  Copy,
  Check,
  FileText,
  ChevronDown,
  ChevronUp,
  Trash2,
  Sparkles,
  Zap,
  Briefcase,
  Trophy,
  Globe,
} from "lucide-react";
import { Clip } from "@/types";

interface ClipCardProps {
  clip: Clip;
  onDelete?: (id: string) => void;
}

export function ClipCard({ clip, onDelete }: ClipCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const copyCaption = () => {
    const textToCopy = `${clip.title}\n\n${clip.hookText ? `[Hook: ${clip.hookText}]\n\n` : ""}#shorts #viral #clipforge #${(clip.campaignType || "viral").toLowerCase()}`;
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const getScoreBadge = (score: number) => {
    const formatted = score.toFixed(1);
    if (score >= 9.0) {
      return {
        bg: "bg-gradient-to-r from-amber-500/20 to-red-500/20 text-amber-300 border-amber-500/40",
        label: `🔥 Viral Score ${formatted}`,
        glow: "shadow-amber-500/20",
      };
    }
    if (score >= 7.5) {
      return {
        bg: "bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 text-violet-300 border-violet-500/40",
        label: `⚡ High Hook ${formatted}`,
        glow: "shadow-violet-500/20",
      };
    }
    return {
      bg: "bg-white/10 text-slate-300 border-white/20",
      label: `✨ Score ${formatted}`,
      glow: "",
    };
  };

  const getPresetBadge = (type?: string) => {
    switch (type) {
      case "VYRO":
        return { label: "VYRO 45s", icon: Zap, color: "text-amber-400 bg-amber-500/10 border-amber-500/30" };
      case "WHOP":
        return { label: "WHOP Mode", icon: Briefcase, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
      case "SPORTS":
        return { label: "SPORTS 1.02x", icon: Trophy, color: "text-blue-400 bg-blue-500/10 border-blue-500/30" };
      default:
        return { label: "GENERAL", icon: Globe, color: "text-slate-300 bg-white/5 border-white/10" };
    }
  };

  const getAspectClass = (ratio?: string) => {
    switch (ratio) {
      case "1:1":
        return "aspect-[1/1]";
      case "16:9":
        return "aspect-[16/9]";
      case "9:16":
      default:
        return "aspect-[9/16]";
    }
  };

  const scoreBadge = getScoreBadge(clip.score || 8.5);
  const presetBadge = getPresetBadge(clip.campaignType);
  const PresetIcon = presetBadge.icon;
  const formattedDuration = `${Math.round(clip.duration)}s`;
  const aspectClass = getAspectClass(clip.aspectRatio);

  return (
    <div className="group relative flex flex-col rounded-3xl bg-slate-900/90 border border-white/10 overflow-hidden shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-violet-500/40 hover:-translate-y-1">
      {/* Video Preview Container with Dynamic Aspect Ratio */}
      <div className={`relative ${aspectClass} w-full bg-slate-950 overflow-hidden`}>
        {clip.outputPath ? (
          <video
            ref={videoRef}
            src={`/api/clips/${clip.id}/download`}
            className="w-full h-full object-cover cursor-pointer"
            loop
            playsInline
            onClick={togglePlay}
            onEnded={() => setIsPlaying(false)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-500">
            <Sparkles className="w-10 h-10 text-violet-500/40 animate-pulse mb-2" />
            <p className="text-xs font-semibold text-slate-300">Rendering Clip...</p>
            <p className="text-[10px] text-slate-500 mt-1">Applying {clip.aspectRatio || "9:16"} crop & subtitles</p>
          </div>
        )}

        {/* Top Badges Overlay */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
          <div
            className={`px-2.5 py-1 rounded-full text-xs font-bold border backdrop-blur-md shadow-lg ${scoreBadge.bg} ${scoreBadge.glow}`}
          >
            {scoreBadge.label}
          </div>

          <div className="flex items-center gap-1.5">
            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold border backdrop-blur-md flex items-center gap-1 ${presetBadge.color}`}>
              <PresetIcon className="w-3 h-3" />
              <span>{clip.aspectRatio || "9:16"}</span>
            </div>

            <div className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-semibold text-slate-300">
              {formattedDuration}
            </div>
          </div>
        </div>

        {/* WHOP Mode: Top Hook Banner Overlay Preview */}
        {clip.hookText && (
          <div className="absolute top-12 left-2 right-2 z-10 pointer-events-none">
            <div className="bg-black/85 backdrop-blur-md border border-white/20 rounded-xl px-3 py-1.5 shadow-2xl text-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 drop-shadow">
                {clip.hookText}
              </span>
            </div>
          </div>
        )}

        {/* Center Play Button Overlay */}
        {clip.outputPath && (
          <button
            type="button"
            onClick={togglePlay}
            className={`absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] transition-opacity cursor-pointer ${
              isPlaying ? "opacity-0 hover:opacity-100" : "opacity-100"
            }`}
          >
            <div className="w-14 h-14 rounded-full bg-violet-600/90 hover:bg-violet-500 text-white flex items-center justify-center shadow-xl shadow-violet-600/50 transition-transform active:scale-90">
              {isPlaying ? (
                <Pause className="w-6 h-6 fill-white" />
              ) : (
                <Play className="w-6 h-6 fill-white ml-0.5" />
              )}
            </div>
          </button>
        )}
      </div>

      {/* Info & Actions */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          <h4 className="font-bold text-white text-sm line-clamp-2 leading-snug">
            {clip.title}
          </h4>

          {/* AI Reasoning Accordion */}
          {clip.reasoning && (
            <div className="mt-2.5">
              <button
                type="button"
                onClick={() => setShowReasoning(!showReasoning)}
                className="flex items-center gap-1 text-[11px] font-semibold text-violet-400 hover:text-violet-300 transition-colors"
              >
                <span>AI Hook Strategy</span>
                {showReasoning ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
              {showReasoning && (
                <p className="mt-1.5 p-2.5 rounded-xl bg-slate-950/60 border border-white/5 text-[11px] text-slate-300 leading-relaxed animate-fadeIn">
                  {clip.reasoning}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2">
          {clip.outputPath ? (
            <a
              href={`/api/clips/${clip.id}/download`}
              download
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-semibold shadow-md shadow-violet-600/20 transition-all active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>MP4</span>
            </a>
          ) : (
            <button
              disabled
              className="flex-1 py-2 px-3 rounded-xl bg-white/5 text-slate-500 text-xs font-semibold cursor-not-allowed text-center"
            >
              Rendering...
            </button>
          )}

          {/* WHOP Mode: Transcript .txt download button */}
          {clip.transcript && (
            <a
              href={`/api/clips/${clip.id}/download?format=txt`}
              download
              title="Download plain text transcript (.txt payload)"
              className="p-2 rounded-xl bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/30 text-slate-300 hover:text-emerald-400 transition-all active:scale-95 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
            </a>
          )}

          <button
            type="button"
            onClick={copyCaption}
            title="Copy viral caption & tags"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all active:scale-95 cursor-pointer"
          >
            {isCopied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>

          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(clip.id)}
              title="Delete clip"
              className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-slate-400 hover:text-red-400 transition-all active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
