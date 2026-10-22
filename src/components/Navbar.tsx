"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, Video, Zap } from "lucide-react";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-amber-400 p-[1.5px] transition-transform duration-300 group-hover:scale-105 shadow-lg shadow-violet-500/20">
            <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
              <Zap className="w-5 h-5 text-fuchsia-400 fill-fuchsia-400/20 group-hover:text-amber-300 transition-colors" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-slate-950 via-slate-700 to-slate-500 bg-clip-text text-transparent">
                ClipForge
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">Make every moment publish-ready</p>
          </div>
        </Link>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <Link href="/pricing" className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-xs font-medium text-violet-700 hover:bg-violet-500/20 transition-colors">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span>Plans & pricing</span>
          </Link>

          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-600/25 transition-all active:scale-95"
          >
            <Video className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
