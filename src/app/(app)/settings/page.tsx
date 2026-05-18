"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  if (state === "testing") return <button disabled className={`${base} border-gray-600 text-gray-500`}>Testing…</button>;
  if (state === "ok") return <button disabled className={`${base} border-green-700 bg-green-950 text-green-400`}>✓ Connected</button>;
  if (state === "error") return <button onClick={onClick} className={`${base} border-red-700 bg-red-950 text-red-400`}>✗ Retry</button>;
  return <button onClick={onClick} className={`${base} border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white`}>{label ?? "Test"}</button>;
}

export default function SettingsPage() {
  const router = useRouter();
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
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);
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

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="flex items-center justify-between px-8 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="text-gray-400 hover:text-white text-sm transition">← Dashboard</button>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
        <button onClick={handleReset}
          className={`text-xs px-3 py-1.5 rounded-lg border transition ${
            confirmReset ? "border-red-600 text-red-400 bg-red-950" : "border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300"
          }`}>
          {confirmReset ? "Click again to confirm reset" : "Reset to defaults"}
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-8 py-8 space-y-8">

        {/* ── Transcription ── */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Transcription</h2>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-2">Provider</label>
              <div className="grid grid-cols-2 gap-2">
                {([["groq","Groq (fast)"],["assemblyai","AssemblyAI (diarize)"],["whisper","Self-hosted"],["webspeech","Web Speech"]] as [Provider,string][]).map(([p, label]) => (
                  <button key={p} onClick={() => set("transcriptionProvider", p)}
                    className={`py-2 rounded-lg text-sm border transition ${settings.transcriptionProvider === p ? "border-blue-500 bg-blue-950 text-blue-300" : "border-gray-700 text-gray-400 hover:border-gray-500"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {settings.transcriptionProvider === "groq" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 block">Groq API Key</label>
                  <div className="flex gap-2">
                    <input type="password" value={settings.groqApiKey}
                      onChange={(e) => { set("groqApiKey", e.target.value); setGroqTest("idle"); }}
                      placeholder="gsk_…"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                    <TestButton state={groqTest} onClick={testGroq} label="Test" />
                  </div>
                  {groqTest === "error" && <p className="text-xs text-red-400">{groqError}</p>}
                  <p className="text-xs text-gray-500">Get a free key at console.groq.com</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Language</label>
                  <select value={settings.whisperLang} onChange={(e) => set("whisperLang", e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                    {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>
            )}

            {settings.transcriptionProvider === "assemblyai" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 block">AssemblyAI API Key</label>
                  <div className="flex gap-2">
                    <input type="password" value={settings.assemblyAiApiKey}
                      onChange={(e) => { set("assemblyAiApiKey", e.target.value); setAssemblyTest("idle"); }}
                      placeholder="Enter your AssemblyAI key…"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                    <TestButton state={assemblyTest} onClick={testAssemblyAI} label="Test" />
                  </div>
                  {assemblyTest === "error" && <p className="text-xs text-red-400">{assemblyError}</p>}
                  <p className="text-xs text-gray-500">Free tier: 100 hours/month · app.assemblyai.com</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Language</label>
                  <select value={settings.whisperLang} onChange={(e) => set("whisperLang", e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                    {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>
            )}

            {settings.transcriptionProvider === "whisper" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Host</label>
                    <input value={settings.whisperHost} onChange={(e) => set("whisperHost", e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Port</label>
                    <input value={settings.whisperPort} onChange={(e) => set("whisperPort", e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Endpoint path</label>
                    <select value={settings.whisperPath} onChange={(e) => set("whisperPath", e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                      {WHISPER_PATHS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Model</label>
                    <select value={settings.whisperModel} onChange={(e) => set("whisperModel", e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                      {WHISPER_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Language</label>
                    <select value={settings.whisperLang} onChange={(e) => set("whisperLang", e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                      {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Protocol</label>
                    <select value={settings.whisperProto} onChange={(e) => set("whisperProto", e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                      <option value="http">HTTP</option>
                      <option value="https">HTTPS</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {settings.transcriptionProvider === "webspeech" && (
              <p className="text-sm text-yellow-400 bg-yellow-950 px-3 py-2 rounded-lg">
                Web Speech API runs in the browser (Chrome only). No file upload — live speech only.
              </p>
            )}
          </div>
        </section>

        {/* ── Ollama ── */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Ollama (Minutes Generation)</h2>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Host</label>
                <input value={settings.ollamaHost} onChange={(e) => { set("ollamaHost", e.target.value); setOllamaTest("idle"); }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Port</label>
                <input value={settings.ollamaPort} onChange={(e) => { set("ollamaPort", e.target.value); setOllamaTest("idle"); }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Protocol</label>
                <select value={settings.ollamaProto} onChange={(e) => { set("ollamaProto", e.target.value); setOllamaTest("idle"); }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Model</label>
                {ollamaModels.length > 0 ? (
                  <select value={settings.ollamaModel} onChange={(e) => set("ollamaModel", e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                    {ollamaModels.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input value={settings.ollamaModel} onChange={(e) => set("ollamaModel", e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TestButton state={ollamaTest} onClick={testOllama} label="Test Connection" />
              {ollamaTest === "ok" && ollamaModels.length > 0 && (
                <span className="text-xs text-green-400">{ollamaModels.length} model{ollamaModels.length !== 1 ? "s" : ""} available</span>
              )}
              {ollamaTest === "error" && <span className="text-xs text-red-400">{ollamaError}</span>}
            </div>
          </div>
        </section>

        {/* ── Recording ── */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Recording</h2>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-3">
            <div>
              <label className="text-sm text-gray-400 block mb-2">Audio format</label>
              <select value={settings.audioFormat} onChange={(e) => set("audioFormat", e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                {AUDIO_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium">Low memory mode</p>
                <p className="text-xs text-gray-500">Downsample audio to 16kHz mono before transcription</p>
              </div>
              <button onClick={() => set("lowMemoryMode", !settings.lowMemoryMode)}
                className={`relative w-11 h-6 rounded-full transition ${settings.lowMemoryMode ? "bg-blue-600" : "bg-gray-700"}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.lowMemoryMode ? "translate-x-5" : ""}`} />
              </button>
            </label>
          </div>
        </section>

        {/* ── Branding & Export ── */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Branding & Export</h2>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-2">Logo (for PDF/Word exports)</label>
              <div className="flex items-center gap-3">
                {settings.logoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={settings.logoDataUrl} alt="Logo preview" className="h-12 w-auto rounded border border-gray-700 bg-gray-800 p-1 object-contain" />
                ) : (
                  <div className="h-12 w-20 rounded border border-dashed border-gray-700 flex items-center justify-center text-xs text-gray-600">No logo</div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => logoInputRef.current?.click()}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 transition">
                    {settings.logoDataUrl ? "Change" : "Upload"}
                  </button>
                  {settings.logoDataUrl && (
                    <button onClick={() => set("logoDataUrl", "")}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:border-red-700 hover:text-red-400 transition">
                      Remove
                    </button>
                  )}
                </div>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>
              <p className="text-xs text-gray-600 mt-1">Max 200 KB · PNG or SVG recommended</p>
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">Default email recipients</label>
              <input value={settings.emailRecipients} onChange={(e) => set("emailRecipients", e.target.value)}
                placeholder="team@example.com, manager@example.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              <p className="text-xs text-gray-500 mt-1">Pre-filled in email export</p>
            </div>
          </div>
        </section>

        {/* Save */}
        <button onClick={handleSave} disabled={saving}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 font-semibold transition">
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </main>
    </div>
  );
}
