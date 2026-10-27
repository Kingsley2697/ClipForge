// src/services/videoProcessor.ts — FFmpeg 9:16 crop, preset speed modifier, subtitle burn-in & xfade transitions
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { CampaignPreset, getPresetConfig } from "@/lib/presets";
import type { CreativeEditOptions } from "@/lib/queue";
import path from "path";
import fs from "fs";

const FFMPEG_TIMEOUT_MS = Number.parseInt(process.env.FFMPEG_TIMEOUT_MS || "900000", 10);

// Set ffmpeg path from static binary or environment override
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
} else if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

export type AspectRatio = "9:16" | "1:1" | "16:9";

/**
 * All valid FFmpeg xfade transition names.
 * Kept as a Set for O(1) look-up when the user provides a custom value.
 */
export const VALID_XFADE_TRANSITIONS = new Set([
  "fade", "wipeleft", "wiperight", "wipeup", "wipedown",
  "slideleft", "slideright", "slideup", "slidedown",
  "circlecrop", "rectcrop", "distance", "fadeblack", "fadewhite",
  "radial", "smoothleft", "smoothright", "smoothup", "smoothdown",
  "circleopen", "circleclose", "vertopen", "vertclose",
  "horzopen", "horzclose", "dissolve", "pixelize",
  "diagtl", "diagtr", "diagbl", "diagbr",
  "hlslice", "hrslice", "vuslice", "vdslice",
  "hblur", "fadegrays", "wipetl", "wipetr", "wipebl", "wipebr",
  "squeezev", "squeezeh", "zoomin", "fadefast", "fadeslow",
]);

/**
 * Returns the FFmpeg crop & scale video filter graph for the chosen aspect ratio.
 */
export function getAspectCropFilter(aspectRatio: AspectRatio = "9:16"): string {
  switch (aspectRatio) {
    case "1:1":
      // Instagram / Facebook Square: crop center 1080x1080
      return "crop=min(iw\\,ih):min(iw\\,ih),scale=1080:1080";
    case "16:9":
      // YouTube Widescreen: scale maintaining 16:9 aspect ratio up to 1920x1080 with padding
      return "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2";
    case "9:16":
    default:
      // TikTok / Shorts / Reels: scale to cover the canvas, then center crop.
      // This works for both landscape and portrait input without padding.
      return "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920:(iw-1080)/2:(ih-1920)/2";
  }
}

/**
 * Returns pixel dimensions for subtitles and thumbnail generation.
 */
export function getAspectDimensions(aspectRatio: AspectRatio = "9:16"): { width: number; height: number } {
  switch (aspectRatio) {
    case "1:1":
      return { width: 1080, height: 1080 };
    case "16:9":
      return { width: 1920, height: 1080 };
    case "9:16":
    default:
      return { width: 1080, height: 1920 };
  }
}

export interface RenderOptions {
  inputPath: string;   // Source MP4
  outputPath: string;  // Output MP4
  startTime: number;   // seconds
  endTime: number;     // seconds
  aspectRatio?: AspectRatio;
  preset?: CampaignPreset;
  assPath?: string;    // ASS subtitles path (preferred)
  srtPath?: string;    // SRT subtitles path (fallback)
  /** FFmpeg xfade transition name — e.g. "fade", "wipeleft", "circlecrop" — or "none" to skip */
  transitionStyle?: string;
  /** Duration (seconds) of the xfade transition; defaults to 0.4 */
  transitionDuration?: number;
  /** Optional user-selected visual and audio styling controls. */
  creativeEdit?: CreativeEditOptions;
  onProgress?: (percent: number) => void;
}

function normalizeCreativeEdit(edit?: CreativeEditOptions): CreativeEditOptions | null {
  if (!edit?.enabled) return null;

  const speed = [0.98, 1, 1.02].includes(edit.speed) ? edit.speed : 1;
  const pitchSemitones = [-1, 0, 1].includes(edit.pitchSemitones)
    ? edit.pitchSemitones
    : 0;

  return {
    enabled: true,
    speed: speed as CreativeEditOptions["speed"],
    colorGrade: Boolean(edit.colorGrade),
    mirror: Boolean(edit.mirror),
    pitchSemitones: pitchSemitones as CreativeEditOptions["pitchSemitones"],
    commentaryVolume: Math.min(1, Math.max(0, edit.commentaryVolume)),
    backgroundAudioPath: edit.backgroundAudioPath,
    backgroundAudioVolume: Math.min(1, Math.max(0, edit.backgroundAudioVolume)),
  };
}

// ---------------------------------------------------------------------------
// xfade filter builder helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the effective xfade transition name.  Falls back to "fade" when the
 * supplied name is not in the known-valid set (unless explicitly "none").
 */
function resolveTransition(raw?: string): string {
  if (!raw || raw === "none") return "none";
  const lower = raw.trim().toLowerCase();
  // xfade has a native `zoomin` transition but no `zoomout` equivalent.
  // Keep the UI/API preset ergonomic while always emitting a valid FFmpeg graph.
  const ffmpegTransition = lower === "zoomout" ? "zoomin" : lower;
  return VALID_XFADE_TRANSITIONS.has(ffmpegTransition) ? ffmpegTransition : "fade";
}

/**
 * Build an FFmpeg -filter_complex string that:
 *   1. Applies crop/scale + optional subtitle burn-in + optional speed warp to EACH
 *      named input stream [0:v], [1:v], …
 *   2. Chains them together with the xfade filter (one xfade per consecutive pair).
 *   3. Builds a matching acrossfade audio chain so audio cuts are seamless.
 *
 * When only a single segment is passed the helper returns a simpler single-input
 * graph (no xfade needed).
 *
 * @param segments       Array of { duration: number } — one entry per input file.
 * @param scaleFilter    The crop+scale vf string (e.g. "scale=1920:-2,crop=…").
 * @param subFilter      The subtitle filter suffix string (or "").
 * @param speedModifier  1.0 means no change; 1.02 speeds up the clip (SPORTS preset).
 * @param transition     Validated xfade transition name (not "none").
 * @param xfadeDur       Duration of the xfade in seconds.
 * @returns { filterComplex, videoOut, audioOut }
 */
function buildXfadeFilterComplex(
  segments: { duration: number }[],
  scaleFilter: string,
  subFilter: string,
  speedModifier: number,
  transition: string,
  xfadeDur: number
): { filterComplex: string; videoOut: string; audioOut: string } {
  const n = segments.length;
  const lines: string[] = [];
  const speed = speedModifier !== 1.0 ? speedModifier : null;

  // ── Step 1: per-input video & audio prep ──────────────────────────────────
  for (let i = 0; i < n; i++) {
    let vChain = `[${i}:v]${scaleFilter}${subFilter}`;
    if (speed) vChain += `,setpts=PTS/${speed}`;
    vChain += `[v${i}]`;
    lines.push(vChain);

    let aChain = `[${i}:a]`;
    if (speed) aChain += `atempo=${speed},`;
    // acrossfade needs audio input labels — just normalise loudness
    aChain += `aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a${i}]`;
    lines.push(aChain);
  }

  // ── Step 2: xfade chain (video) ───────────────────────────────────────────
  // xfade offset = sum of durations of all preceding segments minus the overlap
  let videoOut: string;
  if (n === 1) {
    videoOut = "[v0]";
  } else {
    let offset = 0;
    for (let i = 0; i < n - 1; i++) {
      const segDur = speed ? segments[i].duration / speed : segments[i].duration;
      offset += segDur - xfadeDur;
      const inA = i === 0 ? "[v0]" : `[xv${i - 1}]`;
      const inB = `[v${i + 1}]`;
      const out = i === n - 2 ? "[vout]" : `[xv${i}]`;
      lines.push(
        `${inA}${inB}xfade=transition=${transition}:duration=${xfadeDur}:offset=${offset.toFixed(4)}${out}`
      );
    }
    videoOut = "[vout]";
  }

  // ── Step 3: acrossfade chain (audio) ─────────────────────────────────────
  let audioOut: string;
  if (n === 1) {
    audioOut = "[a0]";
  } else {
    for (let i = 0; i < n - 1; i++) {
      const inA = i === 0 ? "[a0]" : `[xa${i - 1}]`;
      const inB = `[a${i + 1}]`;
      const out = i === n - 2 ? "[aout]" : `[xa${i}]`;
      lines.push(
        `${inA}${inB}acrossfade=d=${xfadeDur}:c1=tri:c2=tri${out}`
      );
    }
    audioOut = "[aout]";
  }

  return { filterComplex: lines.join(";\n"), videoOut, audioOut };
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

/**
 * Render a clip with burnt-in captions, aspect ratio cropping (9:16, 1:1, 16:9),
 * preset-specific modifiers (e.g. 1.02x speed for SPORTS), and optional xfade
 * transitions between cuts.
 *
 * Single-segment clips still work exactly as before; xfade only activates when
 * multiple source segments are stitched together.
 */
export async function renderVerticalClip(
  options: RenderOptions
): Promise<string> {
  const {
    inputPath,
    outputPath,
    startTime,
    endTime,
    aspectRatio = "9:16",
    preset = "GENERAL",
    assPath,
    srtPath,
    transitionStyle,
    transitionDuration = 0.4,
    creativeEdit,
    onProgress,
  } = options;

  const duration = endTime - startTime;
  if (duration <= 0) throw new Error("Invalid clip duration");

  const config = getPresetConfig(preset);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  // 1. Aspect-ratio crop/scale filter
  const scaleFilter = getAspectCropFilter(aspectRatio);

  // 2. Subtitle filter suffix
  const subtitlePath = assPath || srtPath;
  const subFilter = subtitlePath
    ? `,ass='${subtitlePath.replace(/\\/g, "/").replace(/:/g, "\\:")}'`
    : "";

  // 3. Creative Edit controls override a preset's default speed when enabled.
  const creative = normalizeCreativeEdit(creativeEdit);
  const speedModifier = creative
    ? creative.speed
    : config.speedModifier && config.speedModifier !== 1.0
      ? config.speedModifier
      : 1.0;

  // 4. Resolve transition
  const effectiveTransition = resolveTransition(transitionStyle);
  const xfadeDur = Math.min(transitionDuration, duration / 2); // never longer than half the clip

  // ── Single-source render path (no xfade needed) ───────────────────────────
  // We always deal with a single source video per clip in the current pipeline.
  // The xfade filter logic is fully wired so that the day multiple pre-cut
  // segments are supplied (e.g. a future montage feature), it will just work.
  //
  // For now we use a single input but still build through the unified helper
  // when a real xfade transition is requested (no-op for single segment).

  const segments = [{ duration }]; // one segment = this clip

  // Determine whether to use filter_complex (xfade path) or simple vf/af
  // xfade makes no difference for a single segment — use simple path for speed.
  const useSimplePath = effectiveTransition === "none" || segments.length === 1;

  return new Promise((resolve, reject) => {
    let finished = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const complete = (callback: () => void) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      callback();
    };

    if (useSimplePath) {
      // ── Legacy simple filter path ─────────────────────────────────────────
      let videoFilters = scaleFilter;
      const audioFilters: string[] = [];

      if (creative?.colorGrade) {
        videoFilters += ",eq=contrast=1.05:brightness=0.02:saturation=1.1";
      }
      if (creative?.mirror) {
        videoFilters += ",hflip";
      }
      videoFilters += subFilter;

      if (speedModifier !== 1.0) {
        videoFilters = `${videoFilters},setpts=PTS/${speedModifier}`;
        audioFilters.push(`atempo=${speedModifier}`);
      }

      if (creative?.pitchSemitones) {
        const pitchFactor = Math.pow(2, creative.pitchSemitones / 12);
        // asetrate changes pitch; the compensating atempo keeps clip duration intact.
        audioFilters.push(
          `asetrate=48000*${pitchFactor.toFixed(8)}`,
          "aresample=48000",
          `atempo=${(1 / pitchFactor).toFixed(8)}`
        );
      }

      if (creative && creative.commentaryVolume !== 1) {
        audioFilters.push(`volume=${creative.commentaryVolume}`);
      }

      let cmd = ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(duration)
        .videoCodec("libx264")
        .addOption("-preset", "fast")
        .addOption("-crf", "22")
        .addOption("-profile:v", "high")
        .addOption("-level", "4.0")
        .audioCodec("aac")
        .audioBitrate("160k")
        .addOption("-movflags", "+faststart");

      if (creative?.backgroundAudioPath) {
        const sourceAudioFilters = audioFilters.length > 0
          ? `${audioFilters.join(",")},`
          : "";
        const filterComplex = [
          `[0:v]${videoFilters}[vout]`,
          `[0:a]${sourceAudioFilters}aformat=sample_rates=48000:channel_layouts=stereo[commentary]`,
          `[1:a]volume=${creative.backgroundAudioVolume},aformat=sample_rates=48000:channel_layouts=stereo[background]`,
          "[commentary][background]amix=inputs=2:duration=first:dropout_transition=2[aout]",
        ].join(";");

        cmd = cmd
          .input(creative.backgroundAudioPath)
          .inputOptions(["-stream_loop -1"])
          .complexFilter(filterComplex)
          .outputOptions(["-map [vout]", "-map [aout]", "-shortest"])
          .output(outputPath);
      } else {
        cmd = cmd.videoFilters(videoFilters).output(outputPath);
        if (audioFilters.length > 0) {
          cmd = cmd.audioFilters(audioFilters);
        }
      }

      if (onProgress) {
        cmd = cmd.on("progress", (info) => {
          onProgress(Math.min(100, Math.round(info.percent || 0)));
        });
      }

      timeout = setTimeout(() => {
        cmd.kill("SIGKILL");
        complete(() => reject(new Error(`FFmpeg rendering timed out after ${FFMPEG_TIMEOUT_MS / 60_000} minutes.`)));
      }, FFMPEG_TIMEOUT_MS);

      cmd
        .on("start", (cmdLine) => {
          console.log(`[FFmpeg - ${preset}] Starting (simple): ${cmdLine.slice(0, 140)}...`);
        })
        .on("end", () => {
          console.log(`[FFmpeg - ${preset}] Render complete: ${outputPath}`);
          complete(() => resolve(outputPath));
        })
        .on("error", (err, _stdout, stderr) => {
          console.error(`[FFmpeg - ${preset}] Error: ${stderr || err.message}`);
          complete(() => reject(new Error(`FFmpeg error: ${err.message}`)));
        })
        .run();

    } else {
      // ── xfade filter_complex path ─────────────────────────────────────────
      // For the current single-segment pipeline this branch is reachable only
      // when the user explicitly asks for a transition AND we later extend the
      // worker to pass multiple pre-cut files.  Guard is here for future use.

      const { filterComplex, videoOut, audioOut } = buildXfadeFilterComplex(
        segments,
        scaleFilter,
        subFilter,
        speedModifier,
        effectiveTransition,
        xfadeDur
      );

      let cmd = ffmpeg();

      // Add the single source with seek
      cmd = cmd
        .input(inputPath)
        .inputOptions([`-ss ${startTime}`, `-t ${duration}`]);

      cmd = cmd
        .complexFilter(filterComplex)
        .outputOptions([
          `-map ${videoOut}`,
          `-map ${audioOut}`,
          "-c:v libx264",
          "-preset fast",
          "-crf 22",
          "-profile:v high",
          "-level 4.0",
          "-c:a aac",
          "-b:a 160k",
          "-movflags +faststart",
        ])
        .output(outputPath);

      if (onProgress) {
        cmd = cmd.on("progress", (info) => {
          onProgress(Math.min(100, Math.round(info.percent || 0)));
        });
      }

      timeout = setTimeout(() => {
        cmd.kill("SIGKILL");
        complete(() => reject(new Error(`FFmpeg rendering timed out after ${FFMPEG_TIMEOUT_MS / 60_000} minutes.`)));
      }, FFMPEG_TIMEOUT_MS);

      cmd
        .on("start", (cmdLine) => {
          console.log(`[FFmpeg - ${preset}] Starting (xfade=${effectiveTransition}): ${cmdLine.slice(0, 160)}...`);
        })
        .on("end", () => {
          console.log(`[FFmpeg - ${preset}] Render complete (xfade): ${outputPath}`);
          complete(() => resolve(outputPath));
        })
        .on("error", (err, _stdout, stderr) => {
          console.error(`[FFmpeg - ${preset}] xfade error: ${stderr || err.message}`);
          complete(() => reject(new Error(`FFmpeg xfade error: ${err.message}`)));
        })
        .run();
    }
  });
}

// ---------------------------------------------------------------------------
// Multi-segment montage render (xfade across pre-cut clips)
// ---------------------------------------------------------------------------

export interface MontageSegment {
  /** Absolute path to the pre-cut source clip. */
  filePath: string;
  /** Duration of this segment in seconds. */
  duration: number;
}

/**
 * Stitch multiple pre-cut segment files together using FFmpeg xfade + acrossfade.
 * Each segment file is an already-cropped/scaled MP4 produced by renderVerticalClip.
 *
 * @param segments         Ordered list of segment files with their durations.
 * @param outputPath       Final output MP4 path.
 * @param transitionStyle  xfade transition name ("none" to hard-cut).
 * @param transitionDuration  xfade duration in seconds (default 0.4).
 * @param onProgress       Optional progress callback (0-100).
 */
export async function renderMontage(
  segments: MontageSegment[],
  outputPath: string,
  transitionStyle = "fade",
  transitionDuration = 0.4,
  onProgress?: (percent: number) => void
): Promise<string> {
  if (segments.length === 0) throw new Error("No segments provided for montage.");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const effectiveTransition = resolveTransition(transitionStyle);

  return new Promise((resolve, reject) => {
    let finished = false;
    const complete = (callback: () => void) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      callback();
    };

    let cmd = ffmpeg();
    for (const seg of segments) {
      cmd = cmd.input(seg.filePath);
    }

    if (effectiveTransition === "none" || segments.length === 1) {
      // Concatenate with hard cuts
      const filterParts: string[] = [];
      for (let i = 0; i < segments.length; i++) {
        filterParts.push(`[${i}:v][${i}:a]`);
      }
      const concatFilter = `${filterParts.join("")}concat=n=${segments.length}:v=1:a=1[vout][aout]`;

      cmd = cmd
        .complexFilter(concatFilter)
        .outputOptions([
          "-map [vout]", "-map [aout]",
          "-c:v libx264", "-preset fast", "-crf 22",
          "-c:a aac", "-b:a 160k", "-movflags +faststart",
        ])
        .output(outputPath);
    } else {
      const { filterComplex, videoOut, audioOut } = buildXfadeFilterComplex(
        segments,
        // identity filter — segments are already processed
        "null",
        "",
        1.0,
        effectiveTransition,
        transitionDuration
      );

      cmd = cmd
        .complexFilter(filterComplex)
        .outputOptions([
          `-map ${videoOut}`, `-map ${audioOut}`,
          "-c:v libx264", "-preset fast", "-crf 22",
          "-c:a aac", "-b:a 160k", "-movflags +faststart",
        ])
        .output(outputPath);
    }

    if (onProgress) {
      cmd = cmd.on("progress", (info) => {
        onProgress(Math.min(100, Math.round(info.percent || 0)));
      });
    }

    const timeout = setTimeout(() => {
      cmd.kill("SIGKILL");
      complete(() => reject(new Error(`FFmpeg montage timed out after ${FFMPEG_TIMEOUT_MS / 60_000} minutes.`)));
    }, FFMPEG_TIMEOUT_MS);

    cmd
      .on("start", (cmdLine) => {
        console.log(`[FFmpeg Montage] Starting: ${cmdLine.slice(0, 160)}...`);
      })
      .on("end", () => {
        console.log(`[FFmpeg Montage] Complete: ${outputPath}`);
        complete(() => resolve(outputPath));
      })
      .on("error", (err, _stdout, stderr) => {
        console.error(`[FFmpeg Montage] Error: ${stderr || err.message}`);
        complete(() => reject(new Error(`FFmpeg montage error: ${err.message}`)));
      })
      .run();
  });
}

// ---------------------------------------------------------------------------
// Thumbnail extractor
// ---------------------------------------------------------------------------

/**
 * Extract a high-res poster thumbnail from the rendered clip.
 */
export async function extractThumbnail(
  inputPath: string,
  outputPath: string,
  timestampSeconds = 1
): Promise<string> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: [timestampSeconds],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: "1080x1920",
      })
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(new Error(`Thumbnail extraction error: ${err.message}`)));
  });
}
