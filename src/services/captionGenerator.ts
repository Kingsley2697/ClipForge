// src/services/captionGenerator.ts — Preset-aware SRT & ASS Subtitle & Top Banner Generator
import { WordTimestamp } from "./transcriber";
import { CampaignPreset, getPresetConfig } from "@/lib/presets";
import fs from "fs";
import path from "path";

/**
 * Format seconds to SRT timestamp (HH:MM:SS,mmm)
 */
function toSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

/**
 * Group word timestamps into caption blocks (max N words per block)
 * aligned to clip-relative timestamps.
 */
export function groupWordsIntoCaptions(
  words: WordTimestamp[],
  clipStart: number,
  clipEnd: number,
  wordsPerCaption = 4
): Array<{ start: number; end: number; text: string }> {
  const clipped = words.filter(
    (w) => w.start >= clipStart && w.end <= clipEnd + 0.5
  );

  const captions: Array<{ start: number; end: number; text: string }> = [];
  let i = 0;

  while (i < clipped.length) {
    const chunk = clipped.slice(i, i + wordsPerCaption);
    if (chunk.length === 0) break;

    const start = Math.max(0, chunk[0].start - clipStart);
    const end = Math.max(start + 0.3, chunk[chunk.length - 1].end - clipStart);
    const text = chunk.map((w) => w.word).join(" ");

    captions.push({ start, end, text });
    i += wordsPerCaption;
  }

  return captions;
}

/**
 * Generate standard SRT content for a clip.
 */
export function generateSRT(
  words: WordTimestamp[],
  clipStart: number,
  clipEnd: number,
  wordsPerCaption = 4
): string {
  const captions = groupWordsIntoCaptions(words, clipStart, clipEnd, wordsPerCaption);
  return captions
    .map((cap, idx) => {
      return [
        `${idx + 1}`,
        `${toSRTTime(cap.start)} --> ${toSRTTime(cap.end)}`,
        cap.text,
        "",
      ].join("\n");
    })
    .join("\n");
}

/**
 * Generate plain text transcript for WHOP mode companion .txt download.
 */
export function generatePlainTextTranscript(
  words: WordTimestamp[],
  clipStart: number,
  clipEnd: number,
  title?: string,
  hookText?: string
): string {
  const clipped = words.filter((w) => w.start >= clipStart && w.end <= clipEnd);
  const body = clipped.map((w) => w.word).join(" ");

  const lines = [
    `CLIP: ${title || "Viral Clip"}`,
    hookText ? `HOOK BANNER: ${hookText}` : "",
    `TIMECODE: ${clipStart.toFixed(2)}s - ${clipEnd.toFixed(2)}s`,
    "--------------------------------------------------",
    body,
  ].filter(Boolean);

  return lines.join("\n\n");
}

import { AspectRatio, getAspectDimensions } from "./videoProcessor";

/**
 * Generate ASS (Advanced SubStation Alpha) with preset-specific fonts, colors,
 * high-contrast yellow/white highlights (VYRO/SPORTS), top banner hook (WHOP),
 * and dynamic resolution matching the selected AspectRatio.
 */
export function generateASS(
  words: WordTimestamp[],
  clipStart: number,
  clipEnd: number,
  preset: CampaignPreset = "GENERAL",
  hookText?: string,
  aspectRatio: AspectRatio = "9:16"
): string {
  const { width: videoWidth, height: videoHeight } = getAspectDimensions(aspectRatio);
  const config = getPresetConfig(preset);
  const style = config.captionStyle;
  const captions = groupWordsIntoCaptions(words, clipStart, clipEnd, preset === "VYRO" ? 3 : 4);

  const toASSTime = (s: number): string => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const cs = Math.round((s % 1) * 100);
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
  };

  const clipDuration = clipEnd - clipStart;

  // Header and styles
  let script = `[Script Info]
Title: ClipForge ${preset} Captions
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,${style.fontName},${style.fontSize},${style.primaryColor},${style.secondaryColor},${style.outlineColor},${style.backColor},${style.bold ? -1 : 0},0,0,0,100,100,0,0,1,6,3,${style.alignment},60,60,${style.marginV},1
Style: TopBanner,Montserrat,68,&H00FFFFFF,&H0000FFFF,&H00000000,&HB0000000,-1,0,0,0,100,100,0,0,1,5,4,8,40,40,90,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // WHOP Mode: Add persistent Top Banner Hook
  if (config.hasTopBannerHook && hookText) {
    const sanitizedHook = hookText.toUpperCase().replace(/\n/g, "\\N");
    // Top banner displays throughout the entire clip duration with subtle fade in
    script += `Dialogue: 1,${toASSTime(0)},${toASSTime(clipDuration)},TopBanner,,0,0,0,,{\\fad(200,0)\\bord4\\shad3\\b1}${sanitizedHook}\n`;
  }

  // Spoken captions with optional color-highlighting
  for (const cap of captions) {
    let text = cap.text.replace(/\n/g, "\\N");
    // VYRO Mode: Yellow/white alternating emphasis
    if (style.highlightYellow) {
      text = `{\\c&H0000FFFF\\b1}${text}`;
    }
    script += `Dialogue: 0,${toASSTime(cap.start)},${toASSTime(cap.end)},Caption,,0,0,0,,{\\fad(80,80)}${text}\n`;
  }

  return script;
}

export function saveCaptionFile(content: string, outputPath: string): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, "utf-8");
}
