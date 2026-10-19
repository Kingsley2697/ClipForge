// src/services/downloader.ts — yt-dlp wrapper for YouTube video download
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

const YTDLP_PATH = process.env.YTDLP_PATH || "yt-dlp";

export interface DownloadResult {
  filePath: string;
  title: string;
  duration: number; // seconds
  thumbnailPath?: string;
}

/**
 * Downloads a YouTube video as MP4 (best quality up to 1080p)
 * and extracts its thumbnail.
 */
export async function downloadYouTubeVideo(
  url: string,
  outputDir: string,
  jobId: string
): Promise<DownloadResult> {
  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  const outputTemplate = path.join(outputDir, `${jobId}.%(ext)s`);
  const thumbPath = path.join(outputDir, `${jobId}_thumb.jpg`);

  // Download: best mp4 up to 1080p, write thumbnail, get metadata
  const cmd = [
    YTDLP_PATH,
    `"${url}"`,
    `-f "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best"`,
    `--merge-output-format mp4`,
    `--output "${outputTemplate}"`,
    `--write-thumbnail`,
    `--convert-thumbnails jpg`,
    `--print-json`,
    `--no-playlist`,
  ].join(" ");

  let stdout: string;
  try {
    const result = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
    stdout = result.stdout;
  } catch (err: unknown) {
    const error = err as { stderr?: string; message?: string };
    throw new Error(`yt-dlp failed: ${error.stderr || error.message}`);
  }

  // Parse the JSON metadata line (last non-empty JSON line)
  const lines = stdout.trim().split("\n").filter(Boolean);
  let meta: { title?: string; duration?: number; _filename?: string } = {};
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      meta = JSON.parse(lines[i]);
      break;
    } catch {
      // not JSON, skip
    }
  }

  const filePath = path.join(outputDir, `${jobId}.mp4`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Downloaded file not found at ${filePath}`);
  }

  return {
    filePath,
    title: meta.title || "Untitled",
    duration: meta.duration || 0,
    thumbnailPath: fs.existsSync(thumbPath) ? thumbPath : undefined,
  };
}

/**
 * Get video info without downloading.
 */
export async function getVideoInfo(url: string): Promise<{ title: string; duration: number }> {
  const cmd = `${YTDLP_PATH} --print-json --skip-download "${url}"`;
  try {
    const { stdout } = await execAsync(cmd, { maxBuffer: 5 * 1024 * 1024 });
    const meta = JSON.parse(stdout.trim());
    return { title: meta.title || "Untitled", duration: meta.duration || 0 };
  } catch {
    return { title: "Unknown", duration: 0 };
  }
}
