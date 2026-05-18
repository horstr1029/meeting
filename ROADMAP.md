# DAB Meetings — Next.js Roadmap

## Phase 1 — Foundation ✅
- Next.js 15 App Router + TypeScript + Tailwind
- NextAuth.js v5 with email/password (bcrypt)
- Prisma + PostgreSQL schema
- Protected routes, Register/Login/Dashboard

## Phase 2 — API Routes ✅
- `/api/transcribe` — Groq, AssemblyAI (diarization), self-hosted Whisper, Web Speech
- `/api/generate` — Ollama streaming proxy
- `/api/settings` — per-user settings
- `/api/meetings` — meeting CRUD
- `/api/test-connection` — Groq / AssemblyAI / Ollama health checks

## Phase 3 — Audio Capture UI ✅
- Web Audio API / MediaRecorder (mic + system mix)
- Waveform visualizer, gain sliders, mic selector
- Upload audio file fallback
- Language override per recording

## Phase 4 — Transcript, Minutes & Action Items ✅
- Transcript view with inline editing and copy
- Streaming minutes generation (Ollama)
- Action items extraction + done toggle
- EN / AF language toggle

## Phase 5 — History & Dashboard ✅
- Dashboard with stats (total meetings, transcribed, minutes, pending actions)
- Recent meetings list
- Full history page with search and delete

## Phase 6 — Docker Deployment ✅
- Multi-stage Dockerfile, standalone Next.js output
- Docker Compose: app, PostgreSQL, Whisper, Ollama, Nginx (profile)
- override.yml for server-specific config (port 3007)
- GPU opt-in via docker-compose.gpu.yml
- entrypoint.sh: `prisma migrate deploy` on startup

---

## Phase 7 — Meeting Metadata + Action Items Polish 🔧 (current)
- Meeting attendees list (editable badges)
- Meeting agenda/notes field
- Attendees + agenda included in AI minutes prompt
- Custom prompt editor (expandable in Minutes tab)
- Action items: manual creation (text + assignee + priority)
- Action items: priority badge display (High/Medium/Low colours)
- Action items: filter buttons (All / To Do / Done / High Priority)
- Action items: delete individual task
- Action items: clear all done tasks
- Read aloud (TTS) for minutes using browser SpeechSynthesis

## Phase 8 — Export Page
- PDF export (window.print with styled layout)
- Word (.doc) export (HTML blob download)
- CSV task list export
- Email share (mailto: with pre-filled body)
- WhatsApp share (wa.me link)
- Logo upload + branding on exports

## Phase 9 — Settings Improvements
- Whisper endpoint path presets (dropdown of 6 common paths)
- Whisper model dropdown (tiny → large-v3)
- Reset settings to defaults button
- Logo upload and preview
- Email recipients pre-fill field
- Audio format selector (WebM / OGG / MP4)

## Phase 10 — UX Polish
- Theme toggle button in every page header
- Toast notification system (success / error / info, auto-dismiss)
- Persistent Whisper + Ollama status dots in nav
- Audio format selector on Record page
- Microphone list refresh button

## Phase 11 — AI Chat Assistant
- Chat sidebar on meeting detail page
- Transcript used as context for questions
- Streaming answers from Ollama
- Chat history within session
