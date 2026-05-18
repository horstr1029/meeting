"use client";

import { useCallback, useRef, useState } from "react";

export type RecordingState = "idle" | "recording" | "paused" | "processing" | "done";
export type SourceMode = "mic_only" | "mixed";

export interface RecorderResult {
  state: RecordingState;
  duration: number;
  audioBlob: Blob | null;
  analyserNode: AnalyserNode | null;
  start: (mode: SourceMode, micDeviceId?: string, micGain?: number, tabGain?: number, preferredMimeType?: string) => Promise<void>;
  pause: () => void;
  stop: () => void;
  reset: () => void;
  error: string | null;
}

export function useRecorder(): RecorderResult {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const startTimer = () => {
    clearTimer();
    timerRef.current = setInterval(() => {
      setDuration(Date.now() - startTimeRef.current + pausedDurationRef.current);
    }, 500);
  };

  const stopAllTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    streamRef.current = null;
    audioCtxRef.current = null;
  };

  const start = useCallback(
    async (mode: SourceMode, micDeviceId?: string, micGain = 1.0, tabGain = 1.0, preferredMimeType?: string) => {
      setError(null);
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioContextClass();
        audioCtxRef.current = ctx;
        const dest = ctx.createMediaStreamDestination();

        // Mic
        const micConstraints: MediaStreamConstraints = micDeviceId
          ? { audio: { deviceId: { exact: micDeviceId } } }
          : { audio: true };
        const micStream = await navigator.mediaDevices.getUserMedia(micConstraints);
        const micSource = ctx.createMediaStreamSource(micStream);
        const micGainNode = ctx.createGain();
        micGainNode.gain.value = micGain;
        micSource.connect(micGainNode);
        micGainNode.connect(dest);

        // System/tab audio
        if (mode === "mixed") {
          try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: { suppressLocalAudioPlayback: false } as MediaTrackConstraints,
            });
            if (displayStream.getAudioTracks().length === 0) {
              setError("No audio shared — make sure 'Share audio' was checked.");
            } else {
              const tabSource = ctx.createMediaStreamSource(displayStream);
              const tabGainNode = ctx.createGain();
              tabGainNode.gain.value = tabGain;
              tabSource.connect(tabGainNode);
              tabGainNode.connect(dest);
            }
            displayStream.getVideoTracks().forEach((t) => t.stop());
          } catch {
            micStream.getTracks().forEach((t) => t.stop());
            ctx.close();
            setError("Screen capture cancelled.");
            return;
          }
        }

        streamRef.current = dest.stream;

        // Analyser for waveform
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        const mixSource = ctx.createMediaStreamSource(dest.stream);
        mixSource.connect(analyser);
        setAnalyserNode(analyser);

        // MediaRecorder
        const mimeType =
          preferredMimeType && MediaRecorder.isTypeSupported(preferredMimeType) ? preferredMimeType
          : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
          : "audio/ogg";
        chunksRef.current = [];
        const mr = new MediaRecorder(dest.stream, { mimeType, audioBitsPerSecond: 128000 });

        mr.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mr.onstop = () => {
          setRecordingState("processing");
          const blob = new Blob(chunksRef.current, { type: mimeType });
          setAudioBlob(blob);
          setRecordingState("done");
        };

        mr.start(1000);
        mediaRecorderRef.current = mr;

        pausedDurationRef.current = 0;
        startTimeRef.current = Date.now();
        setDuration(0);
        startTimer();
        setRecordingState("recording");
      } catch (e) {
        setError(`Recording failed: ${e instanceof Error ? e.message : String(e)}`);
        stopAllTracks();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const pause = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    if (recordingState === "paused") {
      mr.resume();
      startTimeRef.current = Date.now();
      startTimer();
      setRecordingState("recording");
    } else {
      mr.pause();
      pausedDurationRef.current += Date.now() - startTimeRef.current;
      clearTimer();
      setRecordingState("paused");
    }
  }, [recordingState]);

  const stop = useCallback(() => {
    clearTimer();
    mediaRecorderRef.current?.stop();
    stopAllTracks();
    setAnalyserNode(null);
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    mediaRecorderRef.current?.stop();
    stopAllTracks();
    setAnalyserNode(null);
    setRecordingState("idle");
    setAudioBlob(null);
    setDuration(0);
    setError(null);
    chunksRef.current = [];
  }, []);

  return { state: recordingState, duration, audioBlob, analyserNode, start, pause, stop, reset, error };
}
