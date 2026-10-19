// src/services/analyzer.ts — Bridge to Gemini Preset Analysis
import { detectViralSegments, ViralClipCandidate } from "@/lib/gemini";
import { CampaignPreset } from "@/lib/presets";
import { TranscriptionResult } from "./transcriber";
import fs from "fs";
import path from "path";

export type { ViralClipCandidate };

export interface AnalysisResult {
  segments: ViralClipCandidate[];
  preset: CampaignPreset;
}

export async function analyzeViralMoments(
  transcript: TranscriptionResult,
  preset: CampaignPreset = "GENERAL"
): Promise<AnalysisResult> {
  const segments = await detectViralSegments(transcript, preset);
  return {
    segments,
    preset,
  };
}

export function saveAnalysis(result: AnalysisResult, outputPath: string): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8");
}

export function loadAnalysis(filePath: string): AnalysisResult {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as AnalysisResult;
}
