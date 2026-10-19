import OpenAI from "openai";
import fs from "fs";
import path from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface WordTimestamp {
  word: string;
  start: number; // seconds
  end: number;   // seconds
}

export interface TranscriptionResult {
  text: string;
  words: WordTimestamp[];
  language: string;
  duration: number; // seconds
}

/**
 * Transcribe a video/audio file using OpenAI Whisper API
 * with word-level timestamps.
 */
export async function transcribeVideo(
  filePath: string,
  language = "en"
): Promise<TranscriptionResult> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found for transcription: ${filePath}`);
  }

  const fileStream = fs.createReadStream(filePath);

  // Use verbose_json to get word-level timestamps
  const response = await openai.audio.transcriptions.create({
    file: fileStream,
    model: "whisper-1",
    language,
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
  });

  // openai SDK returns a typed object
  const result = response as unknown as {
    text: string;
    language: string;
    duration: number;
    words: Array<{ word: string; start: number; end: number }>;
  };

  const words: WordTimestamp[] =
    result.words?.map((w) => ({
      word: w.word.trim(),
      start: w.start,
      end: w.end,
    })) || [];

  return {
    text: result.text || "",
    words,
    language: result.language || language,
    duration: result.duration || 0,
  };
}

/**
 * Save transcription result to JSON file.
 */
export function saveTranscription(
  result: TranscriptionResult,
  outputPath: string
): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8");
}

/**
 * Load transcription from JSON file.
 */
export function loadTranscription(filePath: string): TranscriptionResult {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as TranscriptionResult;
}
