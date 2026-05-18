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
  const [transcribeStatus, setTranscribeStatus] = useState<string>("");
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [langOverride, setLangOverride] = useState("");

  const audioBlobUrlRef = useRef<string | null>(null);

  const loadMicDevices = useCallback(() => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      setMicDevices(devices.filter((d) => d.kind === "audioinput"));
    });
  }, []);

  useEffect(() => {
    loadMicDevices();
    fetch("/api/settings").then((r) => r.json()).then((s) => {
      if (s.audioFormat) setAudioFormat(s.audioFormat);
    });
  }, [loadMicDevices]);

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
    setTranscribeStatus("Preparing audio…");

    try {
      const meetingRes = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Meeting" }),
      });
      if (!meetingRes.ok) throw new Error("Failed to create meeting");
      const meeting = await meetingRes.json();

      let blobToSend = activeBlob;
      try {
        setTranscribeStatus("Converting audio…");
        blobToSend = await downsampleAudio(activeBlob, 16000);
      } catch {
        // Fall back to original blob if downsampling fails
      }

      const formData = new FormData();
      formData.append("file", blobToSend, "audio.wav");
      if (langOverride) formData.append("langOverride", langOverride);

      setTranscribeStatus("Uploading…");
      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!transcribeRes.ok) {
        let errMsg = `Server error ${transcribeRes.status}`;
        try {
          const err = await transcribeRes.json();
          errMsg = typeof err.error === "string" ? err.error : errMsg;
        } catch {
          if (transcribeRes.status === 504) errMsg = "Transcription timed out — the recording may be too long.";
          else if (transcribeRes.status >= 500) errMsg = "Server error during transcription. Check server logs.";
        }
        throw new Error(errMsg);
      }

      const data = await transcribeRes.json();

      let transcript: string;

      if (data.assemblyJobId) {
        // AssemblyAI async — poll until done
        setTranscribeStatus("Transcribing… (this can take several minutes for long recordings)");
        transcript = await pollAssemblyAI(data.assemblyJobId);
      } else {
        transcript = data.text ?? data.transcript ?? "";
      }

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
      setTranscribeStatus("");
    }
  };

  const pollAssemblyAI = async (jobId: string): Promise<string> => {
    const deadline = Date.now() + 45 * 60 * 1000; // 45-minute client-side limit
    let attempts = 0;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5000));
      attempts++;
      setTranscribeStatus(`Transcribing… (${Math.floor(attempts * 5 / 60)}m ${(attempts * 5) % 60}s)`);
      const res = await fetch("/api/transcribe/assemblyai-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const result = await res.json() as { status: string; text?: string; error?: string };
      if (result.status === "completed") return result.text ?? "";
      if (result.status === "error") throw new Error(result.error ?? "AssemblyAI transcription failed");
    }
    throw new Error("Transcription timed out after 45 minutes.");
  };

  const isRecording = recorder.state === "recording";
  const isPaused = recorder.state === "paused";
  const isActive = isRecording || isPaused;
  const hasDoneRecording = recorder.state === "done" && recorder.audioBlob;

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-white">New Meeting</h1>
          <p className="text-sm text-[#8b8fa8] mt-1">Record or upload audio for transcription</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#181929] p-1 rounded-xl w-fit border border-[#252640]">
          {(["record", "upload"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
                tab === t ? "bg-violet-600 text-white shadow-lg shadow-violet-900/30" : "text-[#8b8fa8] hover:text-white"
              }`}
            >
              {t === "record" ? "Record" : "Upload File"}
            </button>
          ))}
        </div>

        {tab === "record" && (
          <div className="space-y-4">
            {/* Source mode */}
            <div className="bg-[#181929] rounded-xl p-4 space-y-3 border border-[#252640]">
              <label className="text-sm text-[#8b8fa8] font-medium">Audio Source</label>
              <div className="flex gap-3">
                {(["mic_only", "mixed"] as SourceMode[]).map((m) => (
                  <button
                    key={m}
                    disabled={isActive}
                    onClick={() => setSourceMode(m)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                      sourceMode === m
                        ? "border-violet-500 bg-violet-950/50 text-violet-300"
                        : "border-[#252640] text-[#8b8fa8] hover:border-[#3a3c6a]"
                    } disabled:opacity-50`}
                  >
                    {m === "mic_only" ? "Mic only" : "Mic + System audio"}
                  </button>
                ))}
              </div>

              {/* Mic selector */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-[#6b6f8e]">Microphone</label>
                  <button onClick={loadMicDevices} disabled={isActive}
                    className="text-xs text-[#6b6f8e] hover:text-[#c5c7e8] transition disabled:opacity-40">
                    ↻ Refresh
                  </button>
                </div>
                <select value={micDeviceId} onChange={(e) => setMicDeviceId(e.target.value)}
                  disabled={isActive}
                  className="w-full bg-[#252640] border border-[#2f3158] rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50">
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
                <label className="text-xs text-[#6b6f8e] block mb-1">Audio format</label>
                <select value={audioFormat} onChange={(e) => setAudioFormat(e.target.value)}
                  disabled={isActive}
                  className="w-full bg-[#252640] border border-[#2f3158] rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50">
                  <option value="audio/webm">WebM (default)</option>
                  <option value="audio/ogg">OGG</option>
                  <option value="audio/mp4">MP4</option>
                </select>
              </div>

              {/* Gain sliders */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#6b6f8e] block mb-1">Mic volume: {micGain.toFixed(1)}</label>
                  <input type="range" min="0" max="2" step="0.1" value={micGain}
                    onChange={(e) => setMicGain(parseFloat(e.target.value))}
                    className="w-full accent-violet-500" />
                </div>
                {sourceMode === "mixed" && (
                  <div>
                    <label className="text-xs text-[#6b6f8e] block mb-1">System volume: {tabGain.toFixed(1)}</label>
                    <input type="range" min="0" max="2" step="0.1" value={tabGain}
                      onChange={(e) => setTabGain(parseFloat(e.target.value))}
                      className="w-full accent-violet-500" />
                  </div>
                )}
              </div>
            </div>

            {/* Waveform */}
            <WaveformVisualizer analyserNode={recorder.analyserNode} active={isActive} />

            {/* Timer */}
            <div className="text-center">
              <span className={`text-3xl font-mono font-bold ${isRecording ? "text-rose-400" : isPaused ? "text-amber-400" : "text-[#4a4d6a]"}`}>
                {formatDuration(recorder.duration)}
              </span>
              <p className="text-xs text-[#6b6f8e] mt-1">
                {isRecording ? "● Recording" : isPaused ? "⏸ Paused" : recorder.state === "done" ? "Recording saved" : "Ready"}
              </p>
            </div>

            {/* Controls */}
            <div className="flex gap-3 justify-center">
              {!isActive && recorder.state !== "done" && (
                <button
                  onClick={handleStartRecording}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 font-semibold text-lg transition shadow-lg shadow-rose-900/30"
                >
                  Start Recording
                </button>
              )}
              {isActive && (
                <>
                  <button
                    onClick={recorder.pause}
                    className="px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 font-medium transition"
                  >
                    {isPaused ? "Resume" : "Pause"}
                  </button>
                  <button
                    onClick={recorder.stop}
                    className="px-5 py-3 rounded-xl bg-[#252640] hover:bg-[#2f3158] font-medium transition"
                  >
                    Stop
                  </button>
                </>
              )}
              {recorder.state === "done" && (
                <button
                  onClick={recorder.reset}
                  className="px-5 py-3 rounded-xl bg-[#252640] hover:bg-[#2f3158] font-medium transition text-sm"
                >
                  Record again
                </button>
              )}
            </div>

            {recorder.error && (
              <p className="text-sm text-red-400 bg-red-950/50 px-3 py-2 rounded-lg border border-red-900/50">{recorder.error}</p>
            )}

            {hasDoneRecording && recordedAudioUrl && (
              <div className="bg-[#181929] rounded-xl p-4 space-y-2 border border-[#252640]">
                <p className="text-sm text-[#8b8fa8] font-medium">Recorded audio</p>
                <audio controls src={recordedAudioUrl} className="w-full" />
              </div>
            )}
          </div>
        )}

        {tab === "upload" && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-[#252640] rounded-xl p-10 text-center cursor-pointer hover:border-violet-500 transition"
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
              <p className="text-[#8b8fa8]">Drop an audio file here or <span className="text-violet-400">browse</span></p>
              <p className="text-xs text-[#4a4d6a] mt-1">MP3, WAV, M4A, OGG, WEBM supported</p>
              <input id="audioFileInput" type="file" accept="audio/*" className="hidden" onChange={handleUploadChange} />
            </div>

            {uploadFile && uploadAudioUrl && (
              <div className="bg-[#181929] rounded-xl p-4 space-y-2 border border-[#252640]">
                <p className="text-sm text-[#8b8fa8] font-medium">
                  {uploadFile.name} — {formatBytes(uploadFile.size)}
                </p>
                <audio controls src={uploadAudioUrl} className="w-full" />
              </div>
            )}
          </div>
        )}

        {/* Transcribe */}
        {activeBlob && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-xs text-[#6b6f8e] shrink-0">Language</label>
              <select value={langOverride} onChange={(e) => setLangOverride(e.target.value)}
                className="flex-1 bg-[#181929] border border-[#252640] rounded-lg px-3 py-2 text-sm text-white">
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
              <p className="text-sm text-red-400 bg-red-950/50 px-3 py-2 rounded-lg border border-red-900/50">{transcribeError}</p>
            )}
            {isTranscribing && transcribeStatus && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-950/30 border border-violet-800/40">
                <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse flex-shrink-0" />
                <p className="text-sm text-violet-300">{transcribeStatus}</p>
              </div>
            )}
            <button
              onClick={handleTranscribe}
              disabled={isTranscribing}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 font-semibold transition shadow-lg shadow-violet-900/30"
            >
              {isTranscribing ? "Transcribing…" : "Transcribe"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
