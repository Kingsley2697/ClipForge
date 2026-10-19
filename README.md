# 🎬 ClipForge AI — Opus Clip & Miqla Full-Stack Architecture

An AI-native SaaS platform that transforms long-form widescreen (16:9) YouTube videos or MP4 uploads into viral vertical (9:16) shorts with word-level synced burnt-in captions.

---

## ⚡ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons |
| **Backend & APIs** | Next.js API Routes, Server-Sent Events (SSE) for real-time progress |
| **Database** | Prisma ORM with SQLite (local) / PostgreSQL (production) |
| **Job Queue** | BullMQ + Redis for asynchronous distributed rendering |
| **Video Ingestion** | `yt-dlp` CLI wrapper + Next.js multipart form upload |
| **Transcription** | OpenAI Whisper API (`verbose_json` with word-level timestamps) |
| **AI Viral Detection** | Google Gemini 1.5 Flash (`@google/generative-ai`) returning top 5 hooks |
| **Video Processing** | Native FFmpeg / `fluent-ffmpeg` (16:9 to 9:16 center crop + ASS caption burn) |

---

## 📁 Scalable Production File Tree

```
fligiAI/clipforge/
├── prisma/
│   └── schema.prisma                # User, VideoJob, and Clip models
├── public/
│   ├── uploads/                     # Downloaded / uploaded video files
│   └── outputs/                     # Rendered 9:16 clips & thumbnails
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── clips/
│   │   │   │   └── [clipId]/
│   │   │   │       ├── download/
│   │   │   │       │   └── route.ts # Stream rendered MP4
│   │   │   │       └── route.ts     # Clip details & deletion
│   │   │   └── jobs/
│   │   │       ├── [jobId]/
│   │   │       │   ├── status/
│   │   │       │   │   └── route.ts # Server-Sent Events (SSE) stream
│   │   │       │   └── route.ts     # Job retrieval & deletion
│   │   │       └── route.ts         # Create job & list jobs
│   │   ├── jobs/
│   │   │   └── [jobId]/
│   │   │       └── page.tsx         # Dedicated job detail & clips viewer
│   │   ├── globals.css              # Dark mode styling & animations
│   │   ├── layout.tsx               # Root layout
│   │   └── page.tsx                 # Interactive SaaS Dashboard
│   ├── components/
│   │   ├── ClipCard.tsx             # 9:16 video preview, viral score & copy
│   │   ├── Navbar.tsx               # Glassmorphic header & credits
│   │   ├── ProcessingStatus.tsx     # Animated 4-stage pipeline stepper
│   │   └── VideoUploader.tsx        # YouTube URL & Drag-and-drop MP4
│   ├── lib/
│   │   ├── prisma.ts                # Prisma client singleton
│   │   ├── queue.ts                 # BullMQ queues & job definitions
│   │   └── redis.ts                 # Redis client singleton
│   ├── services/
│   │   ├── analyzer.ts              # Gemini 1.5 Flash viral hook detector
│   │   ├── captionGenerator.ts      # SRT & ASS subtitle generators
│   │   ├── downloader.ts            # yt-dlp downloader & metadata extractor
│   │   ├── transcriber.ts           # OpenAI Whisper word timestamps
│   │   └── videoProcessor.ts        # FFmpeg 9:16 crop & subtitle burning
│   ├── types/
│   │   └── index.ts                 # Shared TypeScript interfaces
│   └── workers/
│       └── videoWorker.ts           # BullMQ Worker executing the 5-step pipeline
├── .env.example                     # Environment variables template
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## 🚀 Quickstart Guide

### 1. Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Provide your API keys:
- `OPENAI_API_KEY`: For Whisper word-level transcription
- `GEMINI_API_KEY`: For Gemini 1.5 Flash viral segment detection
- `REDIS_HOST` / `REDIS_PORT`: For BullMQ job queue (default `localhost:6379`)

### 2. Database Migration
```bash
npx prisma db push
npx prisma generate
```

### 3. Start the Background Worker
In a dedicated terminal, launch the BullMQ video worker:
```bash
npm run worker
```

### 4. Start Next.js Development Server
In another terminal:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the dashboard!
