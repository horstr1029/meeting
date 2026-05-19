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

## Phase 11 — AI Chat Assistant *(skipped)*

---

## Phase 12 — Due Dates + Overdue Tracking 🔧 (current)
- Due date picker on action items (add + display)
- Overdue tasks highlighted red, due-today in amber
- Dashboard overdue count stat

## Phase 13 — Full-text Transcript Search
- `/api/meetings?q=` searches title, transcript, attendees in DB
- History page debounced API search
- "Found in transcript" indicator on results

## Phase 14 — Tags & Categories ✅
- `tags` field on meetings (comma-separated pills)
- Inline tag editor on meeting detail page
- Tag filter chips on history page

## Phase 15 — Meeting Analytics ✅
- `/analytics` page — server-rendered, zero chart libraries
- Summary stats: total meetings, avg/week, completion rate, busiest day
- Inline SVG donut: action item completion rate
- CSS bar charts: meetings per week (8 weeks), meetings by day of week, priority breakdown
- Sidebar nav entry (📊) + Y keyboard shortcut

## Phase 16 — SMTP Email Delivery ✅
- 6 SMTP fields in UserSettings (host, port, user, password, from, secure) + migration
- SMTP section in settings with show/hide password + "Test connection" button (verifies via nodemailer)
- `POST /api/email/send` — sends via nodemailer; `PUT` verifies connection only
- Export page: "Send directly" button replaces mailto for server-side delivery; inline success/error feedback

## Phase 17 — Live Transcription ✅
- `useLiveTranscription` hook: parallel MediaRecorder on same stream, 15s timeslice
- First chunk (WebM headers) saved and prepended to each window — every blob is a valid standalone file
- Chunks POST to `/api/transcribe` (Groq/Whisper); text appended progressively
- Record page: opt-in toggle (Groq/Whisper only), live panel with pulse indicator + chunk count
- "⚡ Use live transcript" fast-saves accumulated text; "Re-transcribe" still available for full accuracy
- `useRecorder` updated to expose `stream: MediaStream | null`

## Phase 18 — Recurring Meeting Series ✅
- `MeetingSeries` Prisma model + `seriesId` on `Meeting` (migration applied)
- `GET/POST /api/series`, `GET/DELETE /api/series/[id]`
- `/series` list page with last-meeting date; `/series/[id]` detail page
- Carry-forward panel: incomplete action items from all prior meetings in the series
- "+ New meeting" pre-fills record page with last agenda + carry-forward items via URL params
- Meeting detail: series dropdown assigns/unassigns; "View series →" link
- Record page reads `?title`, `?agenda`, `?seriesId` params and passes `seriesId` on meeting creation
- 🔁 Series nav entry in sidebar

## Phase 19 — Webhook / n8n Integration
- Webhook URL in settings
- POST events: new meeting, transcription done, action items extracted

---

## Phase 20 — PWA (Progressive Web App) ✅
- `public/manifest.json` with app name, colors, icons
- Manifest link in root layout metadata
- Installable on desktop and mobile from browser

## Phase 21 — Shareable Read-only Links ✅
- `ShareLink` Prisma model (token + expiry)
- `POST /api/meetings/[id]/share` — create link, optional expiry
- `GET /api/share/[token]` — fetch public meeting data
- `src/app/share/[token]/page.tsx` — public read-only view (no auth)
- Share link card on export page: generate + copy URL + revoke

## Phase 22 — Speaker Diarization UI ✅
- Transcript view parses `[Speaker A]:` / `[SPEAKER_01]:` / `Speaker 1:` patterns
- Per-speaker color bands (violet / cyan / amber / emerald / rose, cycling)
- Speaker legend strip above transcript

## Phase 23 — Bulk Operations ✅
- Row checkboxes on history page
- Select-all checkbox in header
- Floating action bar: delete N selected meetings
- Bulk delete API calls with confirmation

## Phase 24 — Weekly Digest Email ✅
- `POST /api/email/digest` — queries meetings from last 7 days + all overdue action items
- Formatted plain-text email: meeting list with attendees + pending counts, overdue items with days-late
- Sends via user's SMTP settings; falls back to `emailRecipients` if no `to` provided
- "Send digest now" button in Settings SMTP section with meeting/overdue counts in success message

## Phase 25 — Theme Toggle
- Light / dark mode via CSS variables
- Theme stored in UserSettings.theme
- Toggle button in sidebar footer

## Phase 26 — Google Meet & Microsoft Teams Recording ✅
- Browser extension or tab-capture approach to record Google Meet / Teams audio
- Capture system audio + mic mix from active meeting tab
- Auto-detect meeting URL to pre-fill meeting title
- One-click "Record this meeting" button when on a Meet/Teams tab
- Seamless hand-off to existing transcription pipeline on meeting end

---

## Phase 27 — Talk-time Stats ✅
- Parse diarized transcript to count words + % per speaker
- Stats bar above transcript (speaker color, word count, % share)
- Only shown when diarization detected

## Phase 28 — Meeting Templates ✅
- Pre-built agenda templates: Standup, Retrospective, 1:1, Sales Call, Project Kickoff, Quarterly Review
- Template picker dropdown on Record page
- One-click populates title + agenda field

## Phase 29 — Transcript Chapters ✅
- Heuristic grouping: every ~200 words = one chapter
- Chapter label derived from first meaningful words (stop-words filtered)
- Scrollable pill nav above transcript; clicking jumps to chapter anchor
- Chapter divider headings injected inline; hidden when transcript is short (&lt;2 chapters)

## Phase 30 — AI Follow-up Email Draft ✅
- "✉ Follow-up email" button in minutes tab (visible once minutes exist)
- Ollama streams a professional email: subject line, decisions summary, open action items
- Collapsible panel with Copy and "Open in mail" (mailto:) buttons
- Subject parsed from draft and pre-filled in mailto link

## Phase 31 — Keyboard Shortcuts ✅
- Global shortcuts: N=new recording, D=dashboard, H=history, S=settings
- In-meeting: T=transcript tab, M=minutes tab, A=actions tab, G=generate minutes
- `?` opens/closes shortcut legend modal; Esc closes it
- Shortcuts disabled while typing in any input/textarea

## Phase 32 — Slack / Webhook Push ✅
- `webhookUrl` field in UserSettings (migration applied)
- Integrations section in settings with URL input + "Send test ping" button
- `POST /api/meetings/[id]/webhook` — builds Slack Block Kit payload (header, summary, action items) and forwards to webhook URL
- "⚡ Push to webhook" button in minutes tab; inline success/error feedback auto-clears after 4s

## Phase 33 — Full-text Transcript Search ✅
- `/api/meetings?q=` searches title, transcript, attendees, minutes in DB
- History page debounced API search
- "in transcript" badge shown on results where match was in transcript body

## Phase 34 — Calendar Sync (iCal) ✅
- `calendarUrl` field in UserSettings (migration applied) — accepts any iCal feed URL
- `GET /api/calendar/upcoming` — fetches feed server-side, parses VEVENT blocks (handles folding, TZID, date-only + datetime formats), returns next 14 days sorted by start
- Settings: Calendar section with iCal URL field + instructions for Google / Outlook / Apple
- Record page: "📅 From Calendar" button fetches events, inline picker shows title + date + attendee count; clicking pre-fills title and agenda (with attendees + description)
