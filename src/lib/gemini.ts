// src/lib/gemini.ts — Gemini AI Viral Detection Engine with Campaign Preset Optimization
import { GoogleGenerativeAI } from "@google/generative-ai";
import { CampaignPreset, getPresetConfig } from "./presets";
import { TranscriptionResult } from "@/services/transcriber";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export interface ViralClipCandidate {
  title: string;
  hookText: string;
  startTime: number;
  endTime: number;
  score: number; // Float, e.g. 9.5
  reasoning: string;
}

/**
 * Analyzes video transcript with word-level timestamps using Google Gemini 1.5 Flash,
 * tailored specifically to the rules of the selected Campaign Preset.
 */
export async function detectViralSegments(
  transcript: TranscriptionResult,
  preset: CampaignPreset = "GENERAL"
): Promise<ViralClipCandidate[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not configured.");
  }

  const presetConfig = getPresetConfig(preset);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const formattedTranscript = transcript.words
    .slice(0, 1500)
    .map((w) => `[${w.start.toFixed(2)}s - ${w.end.toFixed(2)}s] ${w.word}`)
    .join(" ");

  const prompt = `You are a Principal AI Video Systems Architect and Viral Content Growth Hacker specializing in short-form video optimization (TikTok, Instagram Reels, YouTube Shorts).

YOUR CAMPAIGN PRESET RULES:
${presetConfig.aiPromptDirectives}

CONSTRAINTS:
- Allowed duration range: ${presetConfig.minDuration} seconds to ${presetConfig.maxDuration} seconds strictly.
- Total video duration: ${transcript.duration.toFixed(1)} seconds.
- You MUST evaluate speech pacing, energy curves, emotional/action spikes, and hook urgency.
- Provide a punchy "hookText" (concise, high-converting banner hook, 4-10 words, in uppercase or title case).
- Score must be a Float between 1.0 and 10.0 (e.g. 9.5, 8.8, 7.6).
- Return up to the TOP 5 best viral segments.

INPUT TRANSCRIPT:
Full Spoken Text:
"""${transcript.text.slice(0, 5000)}"""

Word-Level Timestamps:
${formattedTranscript}

OUTPUT REQUIREMENT:
Respond ONLY with a strict JSON array of objects. Do not write markdown blocks, explanations, or prologue.
Format:
[
  {
    "title": "Viral Segment Title",
    "hookText": "Attention-Grabbing Banner Hook",
    "startTime": 12.5,
    "endTime": 42.0,
    "score": 9.5,
    "reasoning": "High-energy moment with an immediate hook, ideal for campaign guidelines."
  }
]`;

  const result = await model.generateContent(prompt);
  const rawResponse = result.response.text().trim();

  // Strip code block markers if present
  const cleaned = rawResponse
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Gemini returned non-JSON payload: ${rawResponse.slice(0, 200)}`);
  }

  if (!Array.isArray(parsed)) {
    // If Gemini returned an object wrapper like { segments: [...] }, unwrap it
    if (parsed && typeof parsed === "object" && "segments" in parsed && Array.isArray((parsed as Record<string, unknown>).segments)) {
      parsed = (parsed as Record<string, unknown>).segments;
    } else {
      throw new Error("Gemini response is not a JSON array of viral segments.");
    }
  }

  const maxDuration = presetConfig.maxDuration;
  const minDuration = presetConfig.minDuration;

  const validSegments: ViralClipCandidate[] = (parsed as Array<Record<string, unknown>>)
    .map((item) => {
      const start = Math.max(0, Number(item.startTime) || 0);
      let end = Number(item.endTime) || start + 30;

      // Enforce duration boundary based on preset
      const duration = end - start;
      if (duration > maxDuration) {
        end = start + maxDuration;
      } else if (duration < minDuration) {
        end = Math.min(transcript.duration, start + minDuration);
      }

      const scoreNum = Number(item.score);
      const score = isNaN(scoreNum) ? 8.5 : Math.min(10.0, Math.max(1.0, parseFloat(scoreNum.toFixed(1))));

      return {
        title: String(item.title || "Viral Hook Moment").slice(0, 90),
        hookText: String(item.hookText || item.title || "WATCH THIS").slice(0, 80),
        startTime: parseFloat(start.toFixed(2)),
        endTime: parseFloat(end.toFixed(2)),
        score,
        reasoning: String(item.reasoning || "Optimized for viral engagement").slice(0, 300),
      };
    })
    .filter((seg) => seg.endTime > seg.startTime && (seg.endTime - seg.startTime) >= 5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return validSegments;
}
