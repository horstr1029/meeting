"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/contexts/ToastContext";

type Provider = "groq" | "assemblyai" | "whisper" | "webspeech";
type TestState = "idle" | "testing" | "ok" | "error";

interface Settings {
  transcriptionProvider: Provider;
  groqApiKey: string;
  assemblyAiApiKey: string;
  whisperHost: string;
  whisperPort: string;
  whisperPath: string;
  whisperModel: string;
  whisperLang: string;
  whisperProto: string;
  ollamaHost: string;
  ollamaPort: string;
  ollamaModel: string;
  ollamaProto: string;
  audioFormat: string;
  emailRecipients: string;
  logoDataUrl: string;
  theme: string;
  lowMemoryMode: boolean;
  extensionApiKey: string;
  webhookUrl: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
  smtpSecure: boolean;
  calendarUrl: string;
}

const DEFAULT_SETTINGS: Settings = {
  transcriptionProvider: "groq",
  groqApiKey: "",
  assemblyAiApiKey: "",
  whisperHost: "whisper", whisperPort: "9000", whisperPath: "/v1/audio/transcriptions",
  whisperModel: "whisper-1", whisperLang: "", whisperProto: "http",
  ollamaHost: "172.17.0.1", ollamaPort: "11211",
  ollamaModel: "mistral:7b-instruct", ollamaProto: "http",
  audioFormat: "audio/webm",
  emailRecipients: "",
  logoDataUrl: "",
  theme: "dark",
  lowMemoryMode: true,
  extensionApiKey: "",
  webhookUrl: "",
  smtpHost: "",
  smtpPort: "587",
  smtpUser: "",
  smtpPassword: "",
  smtpFrom: "",
  smtpSecure: false,
  calendarUrl: "",
};

const WHISPER_MODELS = ["whisper-1", "tiny", "base", "small", "medium", "large", "large-v2", "large-v3"];
const WHISPER_PATHS = [
  { label: "/v1/audio/transcriptions  (OpenAI-compatible)", value: "/v1/audio/transcriptions" },
  { label: "/asr  (whisper-asr-webservice)", value: "/asr" },
  { label: "/transcribe", value: "/transcribe" },
  { label: "/inference", value: "/inference" },
  { label: "/api/transcribe", value: "/api/transcribe" },
  { label: "/predict", value: "/predict" },
];
const AUDIO_FORMATS = [
  { label: "WebM (default, best quality)", value: "audio/webm" },
  { label: "OGG", value: "audio/ogg" },
  { label: "MP4", value: "audio/mp4" },
];
const LANGUAGES = [
  { label: "Auto-detect", value: "" },
  { label: "English", value: "en" },
  { label: "Afrikaans", value: "af" },
  { label: "French", value: "fr" },
  { label: "German", value: "de" },
  { label: "Spanish", value: "es" },
  { label: "Portuguese", value: "pt" },
  { label: "Dutch", value: "nl" },
  { label: "Zulu", value: "zu" },
  { label: "Xhosa", value: "xh" },
];

function TestButton({ state, onClick, label }: { state: TestState; onClick: () => void; label?: string }) {
  const base = "px-3 py-1.5 rounded-lg text-xs font-medium border transition";
  if (state === "testing") return <button disabled className={`${base} border-[#2f3158] text-[#6b6f8e]`}>Testing…</button>;
  if (state === "ok") return <button disabled className={`${base} border-emerald-700 bg-emerald-950/50 text-emerald-400`}>✓ Connected</button>;
  if (state === "error") return <button onClick={onClick} className={`${base} border-red-700 bg-red-950/50 text-red-400`}>✗ Retry</button>;
  return <button onClick={onClick} className={`${base} border-[#252640] text-[#8b8fa8] hover:border-[#3a3c6a] hover:text-white`}>{label ?? "Test"}</button>;
}

const inputCls = "w-full bg-[#252640] border border-[#2f3158] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500";
const selectCls = "w-full bg-[#252640] border border-[#2f3158] rounded-lg px-3 py-2 text-sm text-white";

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groqTest, setGroqTest] = useState<TestState>("idle");
  const [groqError, setGroqError] = useState("");
  const [assemblyTest, setAssemblyTest] = useState<TestState>("idle");
  const [assemblyError, setAssemblyError] = useState("");
  const [ollamaTest, setOllamaTest] = useState<TestState>("idle");
  const [ollamaError, setOllamaError] = useState("");
  const [webhookTest, setWebhookTest] = useState<TestState>("idle");
  const [webhookError, setWebhookError] = useState("");
  const [smtpTest, setSmtpTest] = useState<TestState>("idle");
  const [smtpError, setSmtpError] = useState("");
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [digestState, setDigestState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [digestMsg, setDigestMsg] = useState("");
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings((s) => ({ ...s, ...data, logoDataUrl: data.logoDataUrl ?? "" }));
        setLoading(false);
      });
  }, []);

  const set = (key: keyof Settings, value: string | boolean) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    if (res.ok) toast("Settings saved", "success");
    else toast("Failed to save settings", "error");
  };

  const handleReset = async () => {
    if (!confirmReset) { setConfirmReset(true); setTimeout(() => setConfirmReset(false), 4000); return; }
    setSettings(DEFAULT_SETTINGS);
    setConfirmReset(false);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(DEFAULT_SETTINGS),
    });
    toast("Settings reset to defaults", "info");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024) { toast("Logo too large — max 200 KB", "error"); return; }
    const reader = new FileReader();
    reader.onload = () => set("logoDataUrl", reader.result as string);
    reader.readAsDataURL(file);
  };

  const testGroq = async () => {
    setGroqTest("testing"); setGroqError("");
    const res = await fetch("/api/test-connection", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "groq", groqApiKey: settings.groqApiKey }),
    });
    const data = await res.json() as { ok: boolean; error?: string };
    setGroqTest(data.ok ? "ok" : "error");
    if (!data.ok) setGroqError(data.error ?? "Unknown error");
  };

  const testAssemblyAI = async () => {
    setAssemblyTest("testing"); setAssemblyError("");
    const res = await fetch("/api/test-connection", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "assemblyai", assemblyAiApiKey: settings.assemblyAiApiKey }),
    });
    const data = await res.json() as { ok: boolean; error?: string };
    setAssemblyTest(data.ok ? "ok" : "error");
    if (!data.ok) setAssemblyError(data.error ?? "Unknown error");
  };

  const testOllama = async () => {
    setOllamaTest("testing"); setOllamaError(""); setOllamaModels([]);
    const res = await fetch("/api/test-connection", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "ollama", ollamaProto: settings.ollamaProto, ollamaHost: settings.ollamaHost, ollamaPort: settings.ollamaPort }),
    });
    const data = await res.json() as { ok: boolean; models?: string[]; error?: string };
    if (data.ok) {
      setOllamaTest("ok");
      setOllamaModels(data.models ?? []);
      if (data.models?.length && !data.models.includes(settings.ollamaModel)) set("ollamaModel", data.models[0]);
    } else {
      setOllamaTest("error");
      setOllamaError(data.error ?? "Unknown error");
    }
  };

  const testWebhook = async () => {
    const url = settings.webhookUrl.trim();
    if (!url) { setWebhookTest("error"); setWebhookError("Enter a webhook URL first"); return; }
    setWebhookTest("testing"); setWebhookError("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "DAB Meetings webhook test — connection OK ✓" }),
      });
      if (res.ok) { setWebhookTest("ok"); }
      else { setWebhookTest("error"); setWebhookError(`Server returned ${res.status}`); }
    } catch (e) {
      setWebhookTest("error");
      setWebhookError(e instanceof Error ? e.message : "Request failed");
    }
  };

  const testSmtp = async () => {
    if (!settings.smtpHost) { setSmtpTest("error"); setSmtpError("Enter an SMTP host first"); return; }
    setSmtpTest("testing"); setSmtpError("");
    const res = await fetch("/api/email/send", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        smtpHost: settings.smtpHost, smtpPort: settings.smtpPort,
        smtpUser: settings.smtpUser, smtpPassword: settings.smtpPassword,
        smtpSecure: settings.smtpSecure,
      }),
    });
    const data = await res.json() as { ok: boolean; error?: string };
    setSmtpTest(data.ok ? "ok" : "error");
    if (!data.ok) setSmtpError(data.error ?? "Connection failed");
  };

  const sendDigest = async () => {
    setDigestState("sending"); setDigestMsg("");
    const res = await fetch("/api/email/digest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json() as { success?: boolean; error?: string; meetings?: number; overdue?: number };
    if (res.ok) {
      setDigestState("ok");
      setDigestMsg(`Sent! ${data.meetings} meeting${data.meetings !== 1 ? "s" : ""}, ${data.overdue} overdue item${data.overdue !== 1 ? "s" : ""}.`);
      setTimeout(() => setDigestState("idle"), 6000);
    } else {
      setDigestState("error");
      setDigestMsg(data.error ?? "Send failed");
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-[#8b8fa8]">Loading…</div>
  );

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-sm text-[#8b8fa8] mt-1">Configure your AI providers and preferences</p>
          </div>
          <button
            onClick={handleReset}
            className={`text-xs px-3 py-1.5 rounded-lg border transition ${
              confirmReset
                ? "border-red-600 text-red-400 bg-red-950/50"
                : "border-[#252640] text-[#6b6f8e] hover:border-[#3a3c6a] hover:text-[#c5c7e8]"
            }`}
          >
            {confirmReset ? "Click again to confirm reset" : "Reset to defaults"}
          </button>
        </div>

        {/* ── Transcription ── */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-[#6b6f8e] uppercase tracking-wider">Transcription</h2>
          <div className="bg-[#181929] rounded-xl p-5 border border-[#252640] space-y-4">
            <div>
              <label className="text-sm text-[#8b8fa8] block mb-2">Provider</label>
              <div className="grid grid-cols-2 gap-2">
                {([["groq","Groq (fast)"],["assemblyai","AssemblyAI (diarize)"],["whisper","Self-hosted"],["webspeech","Web Speech"]] as [Provider,string][]).map(([p, label]) => (
                  <button key={p} onClick={() => set("transcriptionProvider", p)}
                    className={`py-2 rounded-lg text-sm border transition ${settings.transcriptionProvider === p ? "border-violet-500 bg-violet-950/50 text-violet-300" : "border-[#252640] text-[#8b8fa8] hover:border-[#3a3c6a]"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {settings.transcriptionProvider === "groq" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm text-[#8b8fa8] block">Groq API Key</label>
                  <div className="flex gap-2">
                    <input type="password" value={settings.groqApiKey}
                      onChange={(e) => { set("groqApiKey", e.target.value); setGroqTest("idle"); }}
                      placeholder="gsk_…"
                      className={inputCls} />
                    <TestButton state={groqTest} onClick={testGroq} label="Test" />
                  </div>
                  {groqTest === "error" && <p className="text-xs text-red-400">{groqError}</p>}
                  <p className="text-xs text-[#4a4d6a]">Get a free key at console.groq.com</p>
                </div>
                <div>
                  <label className="text-xs text-[#6b6f8e] block mb-1">Language</label>
                  <select value={settings.whisperLang} onChange={(e) => set("whisperLang", e.target.value)} className={selectCls}>
                    {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>
            )}

            {settings.transcriptionProvider === "assemblyai" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm text-[#8b8fa8] block">AssemblyAI API Key</label>
                  <div className="flex gap-2">
                    <input type="password" value={settings.assemblyAiApiKey}
                      onChange={(e) => { set("assemblyAiApiKey", e.target.value); setAssemblyTest("idle"); }}
                      placeholder="Enter your AssemblyAI key…"
                      className={inputCls} />
                    <TestButton state={assemblyTest} onClick={testAssemblyAI} label="Test" />
                  </div>
                  {assemblyTest === "error" && <p className="text-xs text-red-400">{assemblyError}</p>}
                  <p className="text-xs text-[#4a4d6a]">Free tier: 100 hours/month · app.assemblyai.com</p>
                </div>
                <div>
                  <label className="text-xs text-[#6b6f8e] block mb-1">Language</label>
                  <select value={settings.whisperLang} onChange={(e) => set("whisperLang", e.target.value)} className={selectCls}>
                    {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>
            )}

            {settings.transcriptionProvider === "whisper" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#6b6f8e] block mb-1">Host</label>
                    <input value={settings.whisperHost} onChange={(e) => set("whisperHost", e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs text-[#6b6f8e] block mb-1">Port</label>
                    <input value={settings.whisperPort} onChange={(e) => set("whisperPort", e.target.value)} className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-[#6b6f8e] block mb-1">Endpoint path</label>
                    <select value={settings.whisperPath} onChange={(e) => set("whisperPath", e.target.value)} className={selectCls}>
                      {WHISPER_PATHS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#6b6f8e] block mb-1">Model</label>
                    <select value={settings.whisperModel} onChange={(e) => set("whisperModel", e.target.value)} className={selectCls}>
                      {WHISPER_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#6b6f8e] block mb-1">Language</label>
                    <select value={settings.whisperLang} onChange={(e) => set("whisperLang", e.target.value)} className={selectCls}>
                      {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#6b6f8e] block mb-1">Protocol</label>
                    <select value={settings.whisperProto} onChange={(e) => set("whisperProto", e.target.value)} className={selectCls}>
                      <option value="http">HTTP</option>
                      <option value="https">HTTPS</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {settings.transcriptionProvider === "webspeech" && (
              <p className="text-sm text-amber-400 bg-amber-950/40 px-3 py-2 rounded-lg border border-amber-900/40">
                Web Speech API runs in the browser (Chrome only). No file upload — live speech only.
              </p>
            )}
          </div>
        </section>

        {/* ── Ollama ── */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-[#6b6f8e] uppercase tracking-wider">Ollama (Minutes Generation)</h2>
          <div className="bg-[#181929] rounded-xl p-5 border border-[#252640] space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#6b6f8e] block mb-1">Host</label>
                <input value={settings.ollamaHost} onChange={(e) => { set("ollamaHost", e.target.value); setOllamaTest("idle"); }} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-[#6b6f8e] block mb-1">Port</label>
                <input value={settings.ollamaPort} onChange={(e) => { set("ollamaPort", e.target.value); setOllamaTest("idle"); }} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-[#6b6f8e] block mb-1">Protocol</label>
                <select value={settings.ollamaProto} onChange={(e) => { set("ollamaProto", e.target.value); setOllamaTest("idle"); }} className={selectCls}>
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[#6b6f8e] block mb-1">Model</label>
                {ollamaModels.length > 0 ? (
                  <select value={settings.ollamaModel} onChange={(e) => set("ollamaModel", e.target.value)} className={selectCls}>
                    {ollamaModels.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input value={settings.ollamaModel} onChange={(e) => set("ollamaModel", e.target.value)} className={inputCls} />
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TestButton state={ollamaTest} onClick={testOllama} label="Test Connection" />
              {ollamaTest === "ok" && ollamaModels.length > 0 && (
                <span className="text-xs text-emerald-400">{ollamaModels.length} model{ollamaModels.length !== 1 ? "s" : ""} available</span>
              )}
              {ollamaTest === "error" && <span className="text-xs text-red-400">{ollamaError}</span>}
            </div>
          </div>
        </section>

        {/* ── Recording ── */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-[#6b6f8e] uppercase tracking-wider">Recording</h2>
          <div className="bg-[#181929] rounded-xl p-5 border border-[#252640] space-y-3">
            <div>
              <label className="text-sm text-[#8b8fa8] block mb-2">Audio format</label>
              <select value={settings.audioFormat} onChange={(e) => set("audioFormat", e.target.value)} className={selectCls}>
                {AUDIO_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium">Low memory mode</p>
                <p className="text-xs text-[#6b6f8e]">Downsample audio to 16kHz mono before transcription</p>
              </div>
              <button
                onClick={() => set("lowMemoryMode", !settings.lowMemoryMode)}
                className={`relative w-11 h-6 rounded-full transition ${settings.lowMemoryMode ? "bg-violet-600" : "bg-[#252640]"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.lowMemoryMode ? "translate-x-5" : ""}`} />
              </button>
            </label>
          </div>
        </section>

        {/* ── Branding & Export ── */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-[#6b6f8e] uppercase tracking-wider">Branding & Export</h2>
          <div className="bg-[#181929] rounded-xl p-5 border border-[#252640] space-y-4">
            <div>
              <label className="text-sm text-[#8b8fa8] block mb-2">Logo (for PDF/Word exports)</label>
              <div className="flex items-center gap-3">
                {settings.logoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={settings.logoDataUrl} alt="Logo preview" className="h-12 w-auto rounded border border-[#252640] bg-[#252640] p-1 object-contain" />
                ) : (
                  <div className="h-12 w-20 rounded border border-dashed border-[#252640] flex items-center justify-center text-xs text-[#4a4d6a]">No logo</div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="text-xs px-3 py-1.5 rounded-lg bg-[#252640] hover:bg-[#2f3158] border border-[#2f3158] transition text-[#c5c7e8]"
                  >
                    {settings.logoDataUrl ? "Change" : "Upload"}
                  </button>
                  {settings.logoDataUrl && (
                    <button
                      onClick={() => set("logoDataUrl", "")}
                      className="text-xs px-3 py-1.5 rounded-lg border border-[#252640] text-[#8b8fa8] hover:border-red-700 hover:text-red-400 transition"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>
              <p className="text-xs text-[#4a4d6a] mt-1">Max 200 KB · PNG or SVG recommended</p>
            </div>
            <div>
              <label className="text-sm text-[#8b8fa8] block mb-1">Default email recipients</label>
              <input
                value={settings.emailRecipients}
                onChange={(e) => set("emailRecipients", e.target.value)}
                placeholder="team@example.com, manager@example.com"
                className={inputCls}
              />
              <p className="text-xs text-[#6b6f8e] mt-1">Pre-filled in email export</p>
            </div>
          </div>
        </section>

        {/* ── Chrome Extension ── */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-[#6b6f8e] uppercase tracking-wider">Chrome Extension</h2>
          <div className="bg-[#181929] rounded-xl p-5 border border-[#252640] space-y-4">
            <p className="text-xs text-[#6b6f8e]">
              The DAB Meetings Chrome extension uses this key to authenticate with the API without requiring a browser login session.
            </p>
            <div>
              <label className="text-sm text-[#8b8fa8] block mb-2">Extension API Key</label>
              <div className="flex gap-2">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={settings.extensionApiKey}
                  onChange={(e) => set("extensionApiKey", e.target.value)}
                  placeholder="Click Generate to create a key"
                  className={inputCls}
                  readOnly
                />
                <button
                  onClick={() => setShowApiKey((v) => !v)}
                  className="px-3 py-1.5 rounded-lg text-xs border border-[#252640] text-[#8b8fa8] hover:border-[#3a3c6a] hover:text-white transition whitespace-nowrap"
                >
                  {showApiKey ? "Hide" : "Show"}
                </button>
                <button
                  onClick={() => {
                    const key = Array.from(crypto.getRandomValues(new Uint8Array(32)))
                      .map((b) => b.toString(16).padStart(2, "0")).join("");
                    set("extensionApiKey", key);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs border border-violet-700 bg-violet-950/40 text-violet-300 hover:bg-violet-900/40 transition whitespace-nowrap"
                >
                  Generate
                </button>
              </div>
              {settings.extensionApiKey && (
                <button
                  onClick={() => { navigator.clipboard.writeText(settings.extensionApiKey); toast("API key copied", "success"); }}
                  className="mt-2 text-xs text-[#6b6f8e] hover:text-white transition"
                >
                  Copy to clipboard
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ── Integrations ── */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-[#6b6f8e] uppercase tracking-wider">Integrations</h2>
          <div className="bg-[#181929] rounded-xl p-5 border border-[#252640] space-y-4">
            <div>
              <label className="text-sm text-[#8b8fa8] block mb-1">Webhook URL (Slack / Teams / custom)</label>
              <input
                value={settings.webhookUrl}
                onChange={(e) => { set("webhookUrl", e.target.value); setWebhookTest("idle"); }}
                placeholder="https://hooks.slack.com/services/…"
                className={inputCls}
              />
              <p className="text-xs text-[#6b6f8e] mt-1">
                Paste an incoming webhook URL. Meeting summaries and action items will be posted here.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <TestButton state={webhookTest} onClick={testWebhook} label="Send test ping" />
              {webhookTest === "error" && <span className="text-xs text-red-400">{webhookError}</span>}
            </div>
          </div>
        </section>

        {/* ── SMTP Email ── */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-[#6b6f8e] uppercase tracking-wider">SMTP Email</h2>
          <div className="bg-[#181929] rounded-xl p-5 border border-[#252640] space-y-4">
            <p className="text-xs text-[#6b6f8e]">Send meeting minutes directly from the app without opening your mail client.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm text-[#8b8fa8] block mb-1">SMTP Host</label>
                <input value={settings.smtpHost} onChange={(e) => { set("smtpHost", e.target.value); setSmtpTest("idle"); }}
                  placeholder="smtp.gmail.com" className={inputCls} />
              </div>
              <div>
                <label className="text-sm text-[#8b8fa8] block mb-1">Port</label>
                <input value={settings.smtpPort} onChange={(e) => set("smtpPort", e.target.value)}
                  placeholder="587" className={inputCls} />
              </div>
              <div>
                <label className="text-sm text-[#8b8fa8] block mb-1">Username</label>
                <input value={settings.smtpUser} onChange={(e) => set("smtpUser", e.target.value)}
                  placeholder="you@example.com" className={inputCls} />
              </div>
              <div>
                <label className="text-sm text-[#8b8fa8] block mb-1">Password / App password</label>
                <div className="relative">
                  <input type={showSmtpPassword ? "text" : "password"}
                    value={settings.smtpPassword} onChange={(e) => set("smtpPassword", e.target.value)}
                    placeholder="••••••••" className={`${inputCls} pr-14`} />
                  <button type="button" onClick={() => setShowSmtpPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#6b6f8e] hover:text-white transition">
                    {showSmtpPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm text-[#8b8fa8] block mb-1">From address</label>
                <input value={settings.smtpFrom} onChange={(e) => set("smtpFrom", e.target.value)}
                  placeholder="DAB Meetings <you@example.com>" className={inputCls} />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer w-fit">
              <input type="checkbox" checked={settings.smtpSecure}
                onChange={(e) => set("smtpSecure", e.target.checked)}
                className="w-4 h-4 accent-violet-600" />
              <span className="text-sm text-[#8b8fa8]">Use TLS (port 465)</span>
            </label>
            <div className="flex items-center gap-3">
              <TestButton state={smtpTest} onClick={testSmtp} label="Test connection" />
              {smtpTest === "error" && <span className="text-xs text-red-400">{smtpError}</span>}
            </div>

            <div className="border-t border-[#252640] pt-4 space-y-3">
              <div>
                <p className="text-sm text-white font-medium">Weekly Digest</p>
                <p className="text-xs text-[#6b6f8e] mt-0.5">
                  Sends a summary of meetings this week and all overdue action items to the default recipients.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={sendDigest} disabled={digestState === "sending"}
                  className="px-4 py-2 rounded-lg bg-[#252640] hover:bg-[#2f3158] disabled:opacity-50 text-sm font-medium text-[#c5c7e8] transition">
                  {digestState === "sending" ? "Sending…" : "Send digest now"}
                </button>
                {digestState === "ok" && <span className="text-xs text-emerald-400">{digestMsg}</span>}
                {digestState === "error" && <span className="text-xs text-red-400">{digestMsg}</span>}
              </div>
            </div>
          </div>
        </section>

        {/* ── Calendar ── */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-[#6b6f8e] uppercase tracking-wider">Calendar</h2>
          <div className="bg-[#181929] rounded-xl p-5 border border-[#252640] space-y-4">
            <div>
              <label className="text-sm text-[#8b8fa8] block mb-1">iCal feed URL</label>
              <input
                value={settings.calendarUrl}
                onChange={(e) => set("calendarUrl", e.target.value)}
                placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
                className={inputCls}
              />
              <p className="text-xs text-[#6b6f8e] mt-1.5 space-y-0.5">
                Works with Google Calendar, Outlook, Apple Calendar — any iCal (.ics) feed URL.
                <br />
                <span className="text-[#3a3d5a]">Google: Calendar settings → Integrate calendar → Secret address in iCal format</span>
              </p>
            </div>
          </div>
        </section>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 font-semibold transition shadow-lg shadow-violet-900/30"
        >
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
