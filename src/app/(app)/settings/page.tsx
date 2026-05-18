"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Provider = "groq" | "whisper" | "webspeech";

interface Settings {
  transcriptionProvider: Provider;
  groqApiKey: string;
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
  theme: string;
  lowMemoryMode: boolean;
}

const defaultSettings: Settings = {
  transcriptionProvider: "groq",
  groqApiKey: "",
  whisperHost: "localhost", whisperPort: "9000", whisperPath: "/transcribe",
  whisperModel: "whisper-1", whisperLang: "", whisperProto: "http",
  ollamaHost: "localhost", ollamaPort: "11434",
  ollamaModel: "llama3.2:latest", ollamaProto: "http",
  theme: "dark", lowMemoryMode: true,
};

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => { setSettings((s) => ({ ...s, ...data })); setLoading(false); });
  }, []);

  const set = (key: keyof Settings, value: string | boolean) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="flex items-center gap-3 px-8 py-4 border-b border-gray-800">
        <button onClick={() => router.push("/dashboard")} className="text-gray-400 hover:text-white text-sm transition">
          ← Dashboard
        </button>
        <h1 className="text-xl font-bold">Settings</h1>
      </header>

      <main className="max-w-2xl mx-auto px-8 py-8 space-y-8">
        {/* Transcription */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Transcription</h2>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-2">Provider</label>
              <div className="flex gap-2">
                {(["groq", "whisper", "webspeech"] as Provider[]).map((p) => (
                  <button key={p} onClick={() => set("transcriptionProvider", p)}
                    className={`flex-1 py-2 rounded-lg text-sm border transition ${
                      settings.transcriptionProvider === p
                        ? "border-blue-500 bg-blue-950 text-blue-300"
                        : "border-gray-700 text-gray-400 hover:border-gray-500"
                    }`}>
                    {p === "groq" ? "Groq (free)" : p === "whisper" ? "Self-hosted" : "Web Speech"}
                  </button>
                ))}
              </div>
            </div>

            {settings.transcriptionProvider === "groq" && (
              <div>
                <label className="text-sm text-gray-400 block mb-1">Groq API Key</label>
                <input type="password" value={settings.groqApiKey}
                  onChange={(e) => set("groqApiKey", e.target.value)}
                  placeholder="gsk_..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                <p className="text-xs text-gray-500 mt-1">Get a free key at console.groq.com</p>
              </div>
            )}

            {settings.transcriptionProvider === "whisper" && (
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Host", "whisperHost"], ["Port", "whisperPort"],
                  ["Path", "whisperPath"], ["Model", "whisperModel"],
                  ["Language", "whisperLang"],
                ].map(([label, key]) => (
                  <div key={key}>
                    <label className="text-xs text-gray-500 block mb-1">{label}</label>
                    <input value={(settings as unknown as Record<string, string>)[key]}
                      onChange={(e) => set(key as keyof Settings, e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Protocol</label>
                  <select value={settings.whisperProto} onChange={(e) => set("whisperProto", e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                  </select>
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

        {/* Ollama */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Ollama (Minutes Generation)</h2>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Host", "ollamaHost"], ["Port", "ollamaPort"], ["Model", "ollamaModel"],
              ].map(([label, key]) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 block mb-1">{label}</label>
                  <input value={(settings as unknown as Record<string, string>)[key]}
                    onChange={(e) => set(key as keyof Settings, e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Protocol</label>
                <select value={settings.ollamaProto} onChange={(e) => set("ollamaProto", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* General */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">General</h2>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-3">
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

        {/* Save */}
        <button onClick={handleSave} disabled={saving}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 font-semibold transition">
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save Settings"}
        </button>
      </main>
    </div>
  );
}
