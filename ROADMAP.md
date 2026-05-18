# DAB Meetings — Next.js Migration Roadmap

## Phase 1 — Foundation (complete)
- Next.js 15 App Router + TypeScript + Tailwind
- NextAuth.js v5 with email/password (bcrypt)
- Prisma + PostgreSQL schema (User, Meeting, ActionItem, UserSettings)
- Protected routes via middleware
- Register, Login, Dashboard pages

## Phase 2 — API Routes
- `POST /api/transcribe` — CORS proxy to Whisper server
- `POST /api/generate` — CORS proxy to Ollama
- `GET/PUT /api/settings` — per-user settings (replaces settings.php + config.json)
- `POST /api/meetings` / `GET /api/meetings/[id]` — meeting CRUD

## Phase 3 — Audio Capture UI
- Port Web Audio API / MediaRecorder logic from `assets/js/app.js`
- Mic + system/tab audio mixing
- Audio level visualizer
- Upload audio file fallback

## Phase 4 — Transcript, Minutes & Action Items
- Transcript page with inline editing
- AI minutes generation with streaming
- Action items extraction and management (assignee, due date, done toggle)
- Language toggle (EN / AF)

## Phase 5 — Export, History & Dashboard
- PDF export (react-pdf or puppeteer)
- Word export (docx)
- Email share
- Full meeting history with search/filter
- Dashboard stats (total meetings, action items, etc.)

## Phase 6 — Self-Hosted Deployment
- Docker Compose: Next.js app + PostgreSQL
- Nginx reverse proxy config
- Deployment script (replaces deploy.sh)
- Environment variable documentation
