"use client";

import { useEffect, useRef, useState } from "react";

const CHUNK_INTERVAL_MS = 15_000;

export function useLiveTranscription(stream: MediaStream | null, enabled: boolean) {
  const [liveTranscript, setLiveTranscript] = useState("");
  const [chunkCount, setChunkCount] = useState(0);
  const [transcribing, setTranscribing] = useState(false);

  const mrRef = useRef<MediaRecorder | null>(null);
  const headerChunkRef = useRef<Blob | null>(null);
  const accumulatedRef = useRef("");

  useEffect(() => {
    if (!enabled || !stream) {
      // Clean up any running recorder
      if (mrRef.current && mrRef.current.state !== "inactive") {
        mrRef.current.stop();
      }
      mrRef.current = null;
      headerChunkRef.current = null;
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
    const mr = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64000 });
    mrRef.current = mr;

    let windowChunks: Blob[] = [];
    let isFirstChunk = true;

    mr.ondataavailable = async (e) => {
      if (!e.data || e.data.size === 0) return;

      if (isFirstChunk) {
        // First chunk always contains the WebM headers — save it so every
        // subsequent window blob is a valid standalone file.
        headerChunkRef.current = e.data;
        isFirstChunk = false;
        return;
      }

      windowChunks.push(e.data);

      // Every CHUNK_INTERVAL_MS the MediaRecorder fires once with timeslice data.
      // We treat each event as one window — prepend headers and send to Groq.
      const header = headerChunkRef.current;
      if (!header || windowChunks.length === 0) return;

      const blob = new Blob([header, ...windowChunks], { type: mimeType });
      windowChunks = [];

      setTranscribing(true);
      try {
        const form = new FormData();
        form.append("file", blob, "live-chunk.webm");
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        if (res.ok) {
          const data = await res.json() as { text?: string; transcript?: string };
          const text = (data.text ?? data.transcript ?? "").trim();
          if (text) {
            accumulatedRef.current += (accumulatedRef.current ? " " : "") + text;
            setLiveTranscript(accumulatedRef.current);
            setChunkCount((c) => c + 1);
          }
        }
      } catch {
        // Network error — silently skip this chunk
      } finally {
        setTranscribing(false);
      }
    };

    // Fires once immediately to capture headers, then every CHUNK_INTERVAL_MS
    mr.start(CHUNK_INTERVAL_MS);

    return () => {
      if (mr.state !== "inactive") mr.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, enabled]);

  const reset = () => {
    accumulatedRef.current = "";
    setLiveTranscript("");
    setChunkCount(0);
    setTranscribing(false);
  };

  return { liveTranscript, chunkCount, transcribing, reset };
}
