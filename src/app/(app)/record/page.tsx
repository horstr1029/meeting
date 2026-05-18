"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useRecorder, SourceMode } from "@/hooks/useRecorder";
import { WaveformVisualizer } from "@/components/WaveformVisualizer";
import { downsampleAudio, formatDuration, formatBytes } from "@/lib/audio";
import { useToast } from "@/contexts/ToastContext";

type Tab = "record" | "upload";

export default function RecordPage() {
  const router = useRouter();
  const recorder = useRecorder();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("record");
  const [sourceMode, setSourceMode] = useState<SourceMode>("mic_only");
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [micDeviceId, setMicDeviceId] = useState("");
  const [micGain, setMicGain] = useState(1.0);
  const [tabGain, setTabGain] = useState(1.0);
  const [audioFormat, setAudioFormat] = useState("audio/webm");

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadAudioUrl, setUploadAudioUrl] = useState<string | null>(null);

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [langOverride, setLangOverride] = useState("");

  const audioBlobUrlRef = useRef<string | null>(null);

  const loadMicDevices = useCallback(() => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      setMicDevices(devices.filter((d) => d.kind === "audioinput"));
    });
  }, []);

  // Load mic devices and user audio format preference
  useEffect(() => {
    loadMicDevices();
    fetch("/api/settings").then((r) => r.json()).then((s) => {
      if (s.audioFormat) setAudioFormat(s.audioFormat);
    });
  }, [loadMicDevices]);

  // Create object URL for recorded blob
  const recordedAudioUrl =
    recorder.audioBlob && recorder.state === "done"
      ? (audioBlobUrlRef.current ??
        (audioBlobUrlRef.current = URL.createObjectURL(recorder.audioBlob)))
      : null;

  const handleStartRecording = () => {
    audioBlobUrlRef.current = null;
    recorder.start(sourceMode, micDeviceId || undefined, micGain, tabGain, audioFormat);
  };

  const handleUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (uploadAudioUrl) URL.revokeObjectURL(uploadAudioUrl);
    setUploadFile(file);
    setUploadAudioUrl(URL.createObjectURL(file));
  };

  const activeBlob = tab === "record" ? recorder.audioBlob : uploadFile;

  const handleTranscribe = async () => {
    if (!activeBlob) return;
    setIsTranscribing(true);
    setTranscribeError(null);

    try {
      // Create meeting record first
      const meetingRes = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Meeting" }),
      });
      if (!meetingRes.ok) throw new Error("Failed to create meeting");
      const meeting = await meetingRes.json();

      // Downsample audio for efficiency
      let blobToSend = activeBlob;
      try {
        blobToSend = await downsampleAudio(activeBlob, 16000);
      } catch {
        // Fall back to original blob if downsampling fails
      }

      const formData = new FormData();
      formData.append("file", blobToSend, "audio.wav");
      if (langOverride) formData.append("langOverride", langOverride);

      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!transcribeRes.ok) {
        const err = await transcribeRes.json();
        throw new Error(err.error ?? "Transcription failed");
      }

      const data = await transcribeRes.json();
      const transcript: string = data.text ?? data.transcript ?? "";

      // Save transcript to meeting
      await fetch(`/api/meetings/${meeting.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });

      toast("Transcription complete!", "success");
      router.push(`/meetings/${meeting.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setTranscribeError(msg);
      toast(msg, "error");
    } finally {
      setIsTranscribing(false);
    }
  };

  const isRecording = recorder.state === "recording";
  const isPaused = recorder.state === "paused";
  const isActive = isRecording || isPaused;
  const hasDoneRecording = recorder.state === "done" && recorder.audioBlob;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="flex items-center justify-between px-8 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="text-gray-400 hover:text-white transition text-sm">
            ← Dashboard
          </button>
          <h1 className="text-xl font-bold">New Meeting</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 p-1 rounded-xl w-fit">
          {(["record", "upload"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
                tab === t ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {t === "record" ? "Record" : "Upload File"}
            </button>
          ))}
        </div>

        {tab === "record" && (
          <div className="space-y-4">
            {/* Source mode */}
            <div className="bg-gray-900 rounded-xl p-4 space-y-3">
              <label className="text-sm text-gray-400 font-medium">Audio Source</label>
              <div className="flex gap-3">
                {(["mic_only", "mixed"] as SourceMode[]).map((m) => (
                  <button
                    key={m}
                    disabled={isActive}
                    onClick={() => setSourceMode(m)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                      sourceMode === m
                        ? "border-blue-500 bg-blue-950 text-blue-300"
                        : "border-gray-700 text-gray-400 hover:border-gray-500"
                    } disabled:opacity-50`}
                  >
                    {m === "mic_only" ? "Mic only" : "Mic + System audio"}
                  </button>
                ))}
              </div>

              {/* Mic selector */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-500">Microphone</label>
                  <button onClick={loadMicDevices} disabled={isActive}
                    className="text-xs text-gray-500 hover:text-gray-300 transition disabled:opacity-40">
                    ↻ Refresh
                  </button>
                </div>
                <select value={micDeviceId} onChange={(e) => setMicDeviceId(e.target.value)}
                  disabled={isActive}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50">
                  <option value="">Default microphone</option>
                  {micDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Mic ${d.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Audio format */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Audio format</label>
                <select value={audioFormat} onChange={(e) => setAudioFormat(e.target.value)}
                  disabled={isActive}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50">
                  <option value="audio/webm">WebM (default)</option>
                  <option value="audio/ogg">OGG</option>
                  <option value="audio/mp4">MP4</option>
                </select>
              </div>

              {/* Gain sliders */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Mic volume: {micGain.toFixed(1)}</label>
                  <input type="range" min="0" max="2" step="0.1" value={micGain}
                    onChange={(e) => setMicGain(parseFloat(e.target.value))}
                    className="w-full accent-blue-500" />
                </div>
                {sourceMode === "mixed" && (
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">System volume: {tabGain.toFixed(1)}</label>
                    <input type="range" min="0" max="2" step="0.1" value={tabGain}
                      onChange={(e) => setTabGain(parseFloat(e.target.value))}
                      className="w-full accent-blue-500" />
                  </div>
                )}
              </div>
            </div>

            {/* Waveform */}
            <WaveformVisualizer analyserNode={recorder.analyserNode} active={isActive} />

            {/* Timer */}
            <div className="text-center">
              <span className={`text-3xl font-mono font-bold ${isRecording ? "text-red-400" : isPaused ? "text-yellow-400" : "text-gray-600"}`}>
                {formatDuration(recorder.duration)}
              </span>
              <p className="text-xs text-gray-500 mt-1">
                {isRecording ? "● Recording" : isPaused ? "⏸ Paused" : recorder.state === "done" ? "Recording saved" : "Ready"}
              </p>
            </div>

            {/* Controls */}
            <div className="flex gap-3 justify-center">
              {!isActive && recorder.state !== "done" && (
                <button
                  onClick={handleStartRecording}
                  className="px-8 py-3 rounded-xl bg-red-600 hover:bg-red-700 font-semibold text-lg transition"
                >
                  Start Recording
                </button>
              )}
              {isActive && (
                <>
                  <button
                    onClick={recorder.pause}
                    className="px-5 py-3 rounded-xl bg-yellow-600 hover:bg-yellow-700 font-medium transition"
                  >
                    {isPaused ? "Resume" : "Pause"}
                  </button>
                  <button
                    onClick={recorder.stop}
                    className="px-5 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 font-medium transition"
                  >
                    Stop
                  </button>
                </>
              )}
              {recorder.state === "done" && (
                <button
                  onClick={recorder.reset}
                  className="px-5 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 font-medium transition text-sm"
                >
                  Record again
                </button>
              )}
            </div>

            {/* Error */}
            {recorder.error && (
              <p className="text-sm text-red-400 bg-red-950 px-3 py-2 rounded-lg">{recorder.error}</p>
            )}

            {/* Recorded audio playback */}
            {hasDoneRecording && recordedAudioUrl && (
              <div className="bg-gray-900 rounded-xl p-4 space-y-2">
                <p className="text-sm text-gray-400 font-medium">Recorded audio</p>
                <audio controls src={recordedAudioUrl} className="w-full" />
              </div>
            )}
          </div>
        )}

        {tab === "upload" && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-gray-700 rounded-xl p-10 text-center cursor-pointer hover:border-blue-500 transition"
              onClick={() => document.getElementById("audioFileInput")?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) {
                  if (uploadAudioUrl) URL.revokeObjectURL(uploadAudioUrl);
                  setUploadFile(file);
                  setUploadAudioUrl(URL.createObjectURL(file));
                }
              }}
            >
              <p className="text-gray-400">Drop an audio file here or <span className="text-blue-400">browse</span></p>
              <p className="text-xs text-gray-600 mt-1">MP3, WAV, M4A, OGG, WEBM supported</p>
              <input id="audioFileInput" type="file" accept="audio/*" className="hidden" onChange={handleUploadChange} />
            </div>

            {uploadFile && uploadAudioUrl && (
              <div className="bg-gray-900 rounded-xl p-4 space-y-2">
                <p className="text-sm text-gray-400 font-medium">
                  {uploadFile.name} — {formatBytes(uploadFile.size)}
                </p>
                <audio controls src={uploadAudioUrl} className="w-full" />
              </div>
            )}
          </div>
        )}

        {/* Transcribe button */}
        {activeBlob && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-500 shrink-0">Language</label>
              <select value={langOverride} onChange={(e) => setLangOverride(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                <option value="">From settings (default)</option>
                <option value="en">English</option>
                <option value="af">Afrikaans</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="es">Spanish</option>
                <option value="pt">Portuguese</option>
                <option value="nl">Dutch</option>
                <option value="zu">Zulu</option>
                <option value="xh">Xhosa</option>
              </select>
            </div>
            {transcribeError && (
              <p className="text-sm text-red-400 bg-red-950 px-3 py-2 rounded-lg">{transcribeError}</p>
            )}
            <button
              onClick={handleTranscribe}
              disabled={isTranscribing}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 font-semibold transition"
            >
              {isTranscribing ? "Transcribing…" : "Transcribe"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
