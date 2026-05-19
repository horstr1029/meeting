"use client";

import { useState } from "react";

interface AccordionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Accordion({ title, children, defaultOpen = false }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#252640] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 bg-[#181929] hover:bg-[#1e2038] transition text-left"
      >
        <span className="font-semibold text-white text-sm">{title}</span>
        <svg
          className={`w-4 h-4 text-[#6b6f8e] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-5 pb-5 pt-3 bg-[#181929] border-t border-[#252640]">{children}</div>}
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-950 border border-violet-700 flex items-center justify-center text-violet-300 text-xs font-bold mt-0.5">
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white mb-1">{title}</p>
        <div className="text-sm text-[#8b8fa8] space-y-1">{children}</div>
      </div>
    </div>
  );
}

function Badge({ children, color = "violet" }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    violet: "bg-violet-950/60 text-violet-300 border-violet-800",
    emerald: "bg-emerald-950/60 text-emerald-300 border-emerald-800",
    amber: "bg-amber-950/60 text-amber-300 border-amber-800",
    blue: "bg-blue-950/60 text-blue-300 border-blue-800",
    rose: "bg-rose-950/60 text-rose-300 border-rose-800",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${colors[color] ?? colors.violet}`}>
      {children}
    </span>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 bg-violet-950/30 border border-violet-900/50 rounded-lg px-3 py-2.5 text-sm text-violet-200">
      <span className="flex-shrink-0 text-violet-400">💡</span>
      <span>{children}</span>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 bg-amber-950/30 border border-amber-900/50 rounded-lg px-3 py-2.5 text-sm text-amber-200">
      <span className="flex-shrink-0 text-amber-400">⚠️</span>
      <span>{children}</span>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-[#0d0e1c] border border-[#252640] rounded px-1.5 py-0.5 text-xs font-mono text-violet-300">
      {children}
    </code>
  );
}

export default function HelpPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto space-y-10 pb-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Help & Guide</h1>
        <p className="text-sm text-[#8b8fa8] mt-1">Everything you need to know about using DAB Meetings</p>
      </div>

      {/* Feature overview cards */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-[#6b6f8e] uppercase tracking-wider">What DAB Meetings Does</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: "🎙️", title: "Record Meetings", desc: "Capture microphone and system audio from any meeting using your browser." },
            { icon: "📝", title: "Auto-Transcribe", desc: "Convert audio to text using Groq, AssemblyAI, self-hosted Whisper, or browser Web Speech." },
            { icon: "🤖", title: "AI Minutes", desc: "Generate structured meeting minutes with action items using a local Ollama LLM." },
            { icon: "👥", title: "Speaker Labels", desc: "AssemblyAI identifies who said what — each speaker gets a colour-coded label." },
            { icon: "✅", title: "Action Items", desc: "Extract tasks with assignees, priorities, and due dates. Track completion." },
            { icon: "📤", title: "Export & Share", desc: "Export to PDF, Word, or CSV. Share read-only links or email minutes." },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="bg-[#181929] border border-[#252640] rounded-xl p-4 flex gap-3">
              <span className="text-xl flex-shrink-0">{icon}</span>
              <div>
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="text-xs text-[#6b6f8e] mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Settings guide */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-[#6b6f8e] uppercase tracking-wider">Settings — Step by Step</h2>
        <div className="space-y-3">

          <Accordion title="Step 1 — Choose a Transcription Provider" defaultOpen>
            <div className="space-y-4">
              <p className="text-sm text-[#8b8fa8]">
                The transcription provider converts your recorded audio into text. Go to <strong className="text-white">Settings → Transcription → Provider</strong> and pick one:
              </p>
              <div className="space-y-3">
                {[
                  {
                    badge: "Groq", color: "violet" as const,
                    title: "Groq (Recommended — fast & free)",
                    points: [
                      "Uses OpenAI Whisper large-v3 hosted by Groq.",
                      "Free tier: ~10 hours/month. Upgradeable.",
                      "Best for short-to-medium meetings (under 25 MB of audio).",
                      "Auto-splits larger files into chunks.",
                    ],
                  },
                  {
                    badge: "AssemblyAI", color: "blue" as const,
                    title: "AssemblyAI (Best quality — with speaker labels)",
                    points: [
                      "Identifies individual speakers — great for multi-person meetings.",
                      "Free tier: 100 hours/month.",
                      "Handles large files (1+ hour recordings) without size limits.",
                      "Transcription runs asynchronously — the page polls until done.",
                    ],
                  },
                  {
                    badge: "Self-hosted Whisper", color: "emerald" as const,
                    title: "Self-hosted Whisper (Private — no cloud)",
                    points: [
                      "Runs on your own server. Audio never leaves your network.",
                      "Requires a running Whisper API container (e.g. whisper-asr-webservice).",
                      "Configure host, port, and endpoint path in Settings.",
                    ],
                  },
                  {
                    badge: "Web Speech", color: "amber" as const,
                    title: "Web Speech (Browser only — no upload)",
                    points: [
                      "Uses Chrome's built-in speech recognition. No server needed.",
                      "Live transcription only — cannot transcribe uploaded files.",
                      "Quality is lower than the other options.",
                    ],
                  },
                ].map(({ badge, color, title, points }) => (
                  <div key={badge} className="bg-[#0d0e1c] rounded-lg p-4 border border-[#1e2038] space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge color={color}>{badge}</Badge>
                      <span className="text-sm font-medium text-white">{title}</span>
                    </div>
                    <ul className="space-y-1">
                      {points.map((p) => (
                        <li key={p} className="text-xs text-[#8b8fa8] flex gap-2">
                          <span className="text-[#3a3d5a] flex-shrink-0">•</span>{p}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </Accordion>

          <Accordion title="Step 2 — Configure Your API Keys">
            <div className="space-y-5">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <Badge color="violet">Groq</Badge>
                </p>
                <div className="space-y-2">
                  <Step n={1} title="Create a free account">
                    <p>Go to <span className="text-violet-300">console.groq.com</span> and sign up.</p>
                  </Step>
                  <Step n={2} title="Generate an API key">
                    <p>In the Groq console, click <strong className="text-white">API Keys → Create API Key</strong>. Copy the key — it starts with <Code>gsk_</Code>.</p>
                  </Step>
                  <Step n={3} title="Paste it in Settings">
                    <p>Open <strong className="text-white">Settings → Transcription → Groq API Key</strong>, paste it in, then click <strong className="text-white">Test</strong> to verify.</p>
                  </Step>
                </div>
              </div>

              <hr className="border-[#252640]" />

              <div className="space-y-3">
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <Badge color="blue">AssemblyAI</Badge>
                </p>
                <div className="space-y-2">
                  <Step n={1} title="Create a free account">
                    <p>Go to <span className="text-violet-300">app.assemblyai.com</span> and sign up. Free tier is 100 hours/month.</p>
                  </Step>
                  <Step n={2} title="Copy your API key">
                    <p>In the dashboard, your API key is shown on the home screen. Copy it.</p>
                  </Step>
                  <Step n={3} title="Paste it in Settings">
                    <p>Open <strong className="text-white">Settings → Transcription → AssemblyAI API Key</strong>, paste it in, then click <strong className="text-white">Test</strong>.</p>
                  </Step>
                </div>
                <Tip>AssemblyAI transcription is asynchronous. After you submit a recording, the page will poll automatically every few seconds until it&apos;s done — usually 1–3 minutes for a 1-hour meeting.</Tip>
              </div>

              <hr className="border-[#252640]" />

              <div className="space-y-3">
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <Badge color="emerald">Self-hosted Whisper</Badge>
                </p>
                <div className="space-y-2">
                  <Step n={1} title="Run a Whisper container">
                    <p>If using Docker Compose, the <Code>whisper</Code> service starts automatically. Otherwise, run <Code>onerahmet/openai-whisper-asr-webservice</Code> or similar.</p>
                  </Step>
                  <Step n={2} title="Set host, port, and path">
                    <p>In <strong className="text-white">Settings → Transcription → Self-hosted Whisper</strong>, enter the host IP/name and port. Use the path dropdown to match your container&apos;s API.</p>
                  </Step>
                  <Step n={3} title="Choose a model">
                    <p>Larger models (<Code>large-v3</Code>) are more accurate but slower. Start with <Code>base</Code> or <Code>small</Code> for speed.</p>
                  </Step>
                </div>
              </div>
            </div>
          </Accordion>

          <Accordion title="Step 3 — Set Up Ollama for AI Minutes">
            <div className="space-y-4">
              <p className="text-sm text-[#8b8fa8]">
                Ollama runs an LLM locally to generate structured meeting minutes and extract action items from your transcript. Go to <strong className="text-white">Settings → Ollama</strong>.
              </p>
              <div className="space-y-2">
                <Step n={1} title="Install Ollama on your server">
                  <p>Download from <span className="text-violet-300">ollama.com</span> and run it. It listens on port <Code>11434</Code> by default.</p>
                </Step>
                <Step n={2} title="Pull a model">
                  <p>Run <Code>ollama pull mistral:7b-instruct</Code> (or <Code>llama3.2</Code>, <Code>gemma2</Code>, etc.). The model stays on your machine — no cloud needed.</p>
                </Step>
                <Step n={3} title="Configure host and port in Settings">
                  <p>If Ollama is on the same Docker host, use <Code>172.17.0.1</Code> as the host. If on a separate machine, enter its IP address.</p>
                </Step>
                <Step n={4} title="Test the connection">
                  <p>Click <strong className="text-white">Test Connection</strong>. On success, a dropdown will appear listing all available models — select the one you want to use.</p>
                </Step>
              </div>
              <Tip>Mistral 7B Instruct gives a good balance of quality and speed. For better minutes quality on powerful hardware, try <Code>llama3.1:8b</Code> or <Code>mixtral:8x7b</Code>.</Tip>
              <Warning>If Ollama is running on your PC but the app is in Docker, use the Docker host gateway IP (<Code>172.17.0.1</Code> on Linux, <Code>host.docker.internal</Code> on Mac/Windows) — not <Code>localhost</Code>.</Warning>
            </div>
          </Accordion>

          <Accordion title="Step 4 — Recording Settings">
            <div className="space-y-4">
              <p className="text-sm text-[#8b8fa8]">
                Go to <strong className="text-white">Settings → Recording</strong> to configure audio behaviour.
              </p>
              <div className="space-y-3">
                <div className="bg-[#0d0e1c] rounded-lg p-4 border border-[#1e2038] space-y-2">
                  <p className="text-sm font-semibold text-white">Audio Format</p>
                  <ul className="space-y-1 text-xs text-[#8b8fa8]">
                    <li className="flex gap-2"><span className="text-[#3a3d5a]">•</span><span><strong className="text-white">WebM (default)</strong> — smallest file size, best quality. Use this unless you have a reason not to.</span></li>
                    <li className="flex gap-2"><span className="text-[#3a3d5a]">•</span><span><strong className="text-white">OGG</strong> — similar to WebM, useful if your Whisper server prefers it.</span></li>
                    <li className="flex gap-2"><span className="text-[#3a3d5a]">•</span><span><strong className="text-white">MP4</strong> — broader compatibility if you export and replay recordings.</span></li>
                  </ul>
                </div>
                <div className="bg-[#0d0e1c] rounded-lg p-4 border border-[#1e2038] space-y-2">
                  <p className="text-sm font-semibold text-white">Low Memory Mode</p>
                  <ul className="space-y-1 text-xs text-[#8b8fa8]">
                    <li className="flex gap-2"><span className="text-[#3a3d5a]">•</span><span><strong className="text-white">On (default)</strong> — downsamples audio to 16 kHz mono before uploading to Whisper or Groq. Reduces file size ~4×. Recommended.</span></li>
                    <li className="flex gap-2"><span className="text-[#3a3d5a]">•</span><span><strong className="text-white">Off</strong> — sends original audio. Higher quality but larger uploads. Not needed for AssemblyAI (which skips downsampling automatically).</span></li>
                  </ul>
                </div>
              </div>
            </div>
          </Accordion>

          <Accordion title="Step 5 — Branding & Export">
            <div className="space-y-3">
              <p className="text-sm text-[#8b8fa8]">
                Go to <strong className="text-white">Settings → Branding &amp; Export</strong>.
              </p>
              <div className="space-y-2">
                <Step n={1} title="Upload a logo">
                  <p>Click <strong className="text-white">Upload</strong> and select a PNG or SVG (max 200 KB). The logo appears on PDF and Word exports.</p>
                </Step>
                <Step n={2} title="Set default email recipients">
                  <p>Enter one or more email addresses (comma-separated). These pre-fill the recipient field when you use the email export on the meeting export page.</p>
                </Step>
              </div>
            </div>
          </Accordion>

          <Accordion title="Step 6 — Chrome Extension API Key (optional)">
            <div className="space-y-4">
              <p className="text-sm text-[#8b8fa8]">
                The Chrome extension lets you record Google Meet and Microsoft Teams calls with one click. It uses an API key instead of a browser session to communicate with DAB Meetings.
              </p>
              <div className="space-y-2">
                <Step n={1} title="Generate a key">
                  <p>Go to <strong className="text-white">Settings → Chrome Extension</strong> and click <strong className="text-white">Generate</strong>. A random 64-character key is created.</p>
                </Step>
                <Step n={2} title="Save Settings">
                  <p>Click <strong className="text-white">Save Settings</strong> at the bottom of the page. The key is stored in the database and linked to your account.</p>
                </Step>
                <Step n={3} title="Copy the key">
                  <p>Click <strong className="text-white">Copy to clipboard</strong> under the key field.</p>
                </Step>
                <Step n={4} title="Load the extension in Chrome">
                  <p>Open <Code>chrome://extensions</Code>, enable <strong className="text-white">Developer mode</strong>, click <strong className="text-white">Load unpacked</strong>, and select the <Code>extension/</Code> folder in the project directory.</p>
                </Step>
                <Step n={5} title="Configure the extension popup">
                  <p>Click the extension icon in the Chrome toolbar. Enter your <strong className="text-white">Server URL</strong> (e.g. <Code>https://your-server.com</Code>) and paste the API key. Click <strong className="text-white">Save Settings</strong> — it will verify the key against the server.</p>
                </Step>
                <Step n={6} title="Record a Google Meet or Teams call">
                  <p>Navigate to a meeting. A purple <strong className="text-white">Record</strong> button appears in the bottom-right corner of the page. Click it to start, click <strong className="text-white">Stop</strong> when done. The recording is automatically transcribed and saved to your meeting history.</p>
                </Step>
              </div>
              <Warning>The extension captures tab audio only (plus your microphone if permission is granted). You must be on an active meeting page — the button will not appear on the Google Meet lobby or pre-join screen.</Warning>
            </div>
          </Accordion>

        </div>
      </section>

      {/* Recording workflow */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-[#6b6f8e] uppercase tracking-wider">Recording a Meeting — Step by Step</h2>
        <div className="bg-[#181929] border border-[#252640] rounded-xl p-5 space-y-4">
          <div className="space-y-3">
            {[
              { n: 1, title: "Open Record Meeting", body: "Click Record Meeting in the sidebar." },
              { n: 2, title: "Select your microphone", body: "Choose the correct input from the microphone dropdown. You can adjust input gain with the slider." },
              { n: 3, title: "Enable system audio (optional)", body: "Toggle on System Audio to mix in audio from other apps (e.g. a video call). This requires browser permission to share a tab or window." },
              { n: 4, title: "Set attendees and agenda (optional)", body: "Fill in the Attendees and Agenda fields before recording. These are included in the AI minutes prompt for better context." },
              { n: 5, title: "Click Record", body: "The waveform visualiser shows audio is being captured. A timer tracks the session length." },
              { n: 6, title: "Click Stop", body: "Recording stops and the audio is ready for transcription." },
              { n: 7, title: "Click Transcribe", body: "The audio is sent to your configured provider. For AssemblyAI, the page polls automatically — you can leave it open." },
              { n: 8, title: "Generate Minutes", body: "Once the transcript is ready, open the Minutes tab and click Generate Minutes. Ollama streams the output in real time." },
              { n: 9, title: "Review Action Items", body: "Open the Action Items tab. Items extracted from the transcript are listed. Toggle them done, edit, or add new ones manually." },
            ].map(({ n, title, body }) => (
              <Step key={n} n={n} title={title}><p>{body}</p></Step>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-[#6b6f8e] uppercase tracking-wider">FAQ</h2>
        <div className="space-y-3">
          {[
            {
              q: "Why does transcription fail with a large file?",
              a: "Groq has a 25 MB upload limit. DAB Meetings automatically splits WAV files above this threshold. If you're using WebM format, ensure Low Memory Mode is on to keep file sizes small. For recordings over an hour, AssemblyAI (no size limit) is the most reliable choice.",
            },
            {
              q: "Can I upload an existing audio file instead of recording?",
              a: "Yes. On the Record page, scroll down to find the Upload Audio File option. Supports any browser-supported format (MP3, MP4, WAV, WebM, etc.).",
            },
            {
              q: "The minutes don't mention a specific discussion — why?",
              a: "Minutes quality depends on the transcript quality and the LLM model. Try a larger Ollama model (e.g. mistral:7b-instruct or llama3.1:8b), or edit the custom prompt in the Minutes tab to give the model more specific instructions.",
            },
            {
              q: "How do I share meeting notes with someone who doesn't have an account?",
              a: "On the meeting Export page, click Generate Share Link. This creates a read-only public URL (optionally with an expiry) that anyone can open in a browser without logging in.",
            },
            {
              q: "Speaker labels show SPEAKER_00, SPEAKER_01 — can I rename them?",
              a: "Not yet from the UI, but you can edit the transcript directly in the Transcript tab. Replace SPEAKER_00 with the person's name. Minutes generation will pick up the names from the edited transcript.",
            },
            {
              q: "I use the Microsoft Teams desktop app — will it record other participants?",
              a: "No. DAB Meetings uses the browser's Web Audio API, which can only capture audio from browser tabs — not from native desktop applications. If you use the Teams desktop app, only your microphone will be recorded; other participants' audio will not be captured and your transcript will only contain what you said. To capture both sides, open Teams in a browser tab (teams.microsoft.com) and use the system audio option in the recorder. Alternatively, a virtual audio cable such as VB-Cable can route Teams desktop audio into a virtual microphone that the browser can see.",
            },
            {
              q: "The Chrome extension button doesn't appear on my meeting page.",
              a: "The extension only injects the button on meet.google.com and teams.microsoft.com pages when an active meeting is open. Make sure you're already in the call (not on a pre-join or home screen). If it still doesn't appear, try reloading the page after the extension is installed.",
            },
          ].map(({ q, a }) => (
            <Accordion key={q} title={q}>
              <p className="text-sm text-[#8b8fa8] leading-relaxed">{a}</p>
            </Accordion>
          ))}
        </div>
      </section>

      {/* Keyboard shortcuts */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-[#6b6f8e] uppercase tracking-wider">Keyboard Shortcuts</h2>
        <div className="bg-[#181929] border border-[#252640] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-[#1e2038]">
              {[
                ["Record page", "Space", "Start / Stop recording"],
                ["Meeting detail", "E", "Focus transcript editor"],
                ["Settings", "Ctrl + S", "Save settings (via Save button)"],
              ].map(([page, key, action]) => (
                <tr key={action} className="px-5">
                  <td className="px-5 py-3 text-[#6b6f8e] text-xs w-36">{page}</td>
                  <td className="px-5 py-3">
                    <kbd className="bg-[#0d0e1c] border border-[#2f3158] rounded px-2 py-0.5 text-xs font-mono text-violet-300">{key}</kbd>
                  </td>
                  <td className="px-5 py-3 text-[#8b8fa8]">{action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
