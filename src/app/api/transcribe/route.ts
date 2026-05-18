import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 1800; // 30 minutes — allows long AssemblyAI polls

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.id as string },
  });

  if (!settings) {
    return NextResponse.json({ error: "Settings not configured" }, { status: 400 });
  }

  const { transcriptionProvider } = settings;

  if (transcriptionProvider === "webspeech") {
    return NextResponse.json(
      { error: "Web Speech API runs in the browser — no server call needed" },
      { status: 400 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  // Allow per-request language override from the form
  const langOverride = formData.get("langOverride");
  if (langOverride) formData.delete("langOverride");
  const language = (langOverride as string | null) ?? settings.whisperLang;

  if (transcriptionProvider === "groq") {
    return transcribeWithGroq(formData, settings.groqApiKey, language);
  }

  if (transcriptionProvider === "assemblyai") {
    return transcribeWithAssemblyAI(formData, settings.assemblyAiApiKey, language);
  }

  return transcribeWithWhisper(formData, { ...settings, whisperLang: language });
}

const GROQ_LIMIT = 24 * 1024 * 1024;   // 24 MB — stay safely under Groq's 25 MB hard limit
const CHUNK_BYTES = 18 * 1024 * 1024;  // 18 MB of audio data per chunk

// Split a PCM WAV file into multiple valid WAV blobs, each with its own header.
function splitWavBlob(buffer: ArrayBuffer): Blob[] {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const tag = (off: number, n: number) => new TextDecoder().decode(bytes.subarray(off, off + n));

  if (tag(0, 4) !== "RIFF" || tag(8, 4) !== "WAVE") throw new Error("Not a WAV file");

  let pos = 12;
  while (pos + 8 <= buffer.byteLength) {
    const id = tag(pos, 4);
    const sz = view.getUint32(pos + 4, true);
    if (id === "data") {
      // header = everything from byte 0 up to and including the "data\0\0\0\0" 8-byte marker
      const headerEnd = pos + 8;
      const header = bytes.slice(0, headerEnd);
      const audio  = bytes.slice(headerEnd, headerEnd + sz);
      const blobs: Blob[] = [];

      for (let off = 0; off < audio.length; off += CHUNK_BYTES) {
        const slice = audio.slice(off, off + CHUNK_BYTES);
        const wav = new Uint8Array(header.length + slice.length);
        wav.set(header);
        wav.set(slice, header.length);
        // Patch RIFF size (offset 4) and data chunk size (offset pos+4)
        const dv = new DataView(wav.buffer);
        dv.setUint32(4,     header.length - 8 + slice.length, true);
        dv.setUint32(pos + 4, slice.length, true);
        blobs.push(new Blob([wav], { type: "audio/wav" }));
      }
      return blobs;
    }
    pos += 8 + sz + (sz % 2); // word-align
  }
  throw new Error("No 'data' chunk in WAV");
}

async function groqTranscribeBlob(blob: Blob, apiKey: string, language: string): Promise<string> {
  const fd = new FormData();
  fd.set("file", blob, "audio.wav");
  fd.set("model", "whisper-large-v3");
  fd.set("response_format", "json");
  if (language) fd.set("language", language);

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
    signal: AbortSignal.timeout(300_000), // 5 min per chunk
  });

  if (!res.ok) {
    let msg = `Groq error ${res.status}`;
    try {
      const d = await res.json() as { error?: { message?: string } | string };
      const e = d.error;
      msg = typeof e === "string" ? e : (e?.message ?? msg);
    } catch { /* non-JSON */ }
    throw new Error(msg);
  }

  const data = await res.json() as { text?: string };
  return data.text?.trim() ?? "";
}

async function transcribeWithGroq(formData: FormData, apiKey: string, language: string) {
  if (!apiKey) {
    return NextResponse.json({ error: "Groq API key not set in settings" }, { status: 400 });
  }

  const audioFile = formData.get("file") as Blob | null;
  if (!audioFile) {
    return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
  }

  try {
    // Small file — send directly
    if (audioFile.size <= GROQ_LIMIT) {
      const text = await groqTranscribeBlob(audioFile, apiKey, language);
      return NextResponse.json({ text });
    }

    // Large file — split WAV and transcribe chunks sequentially
    const buffer = await audioFile.arrayBuffer();
    let chunks: Blob[];
    try {
      chunks = splitWavBlob(buffer);
    } catch {
      const sizeMB = Math.round(audioFile.size / 1024 / 1024);
      return NextResponse.json({
        error: `File is ${sizeMB} MB and exceeds Groq's 25 MB limit. Auto-splitting requires WAV format — the browser may not have converted your file. Try re-uploading or switch to self-hosted Whisper.`,
      }, { status: 413 });
    }
    const parts: string[] = [];
    for (const chunk of chunks) {
      parts.push(await groqTranscribeBlob(chunk, apiKey, language));
    }
    return NextResponse.json({ text: parts.join(" ") });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

async function transcribeWithAssemblyAI(formData: FormData, apiKey: string, language: string) {
  if (!apiKey) {
    return NextResponse.json({ error: "AssemblyAI API key not set in settings" }, { status: 400 });
  }

  const headers = { authorization: apiKey, "content-type": "application/json" };

  // 1. Upload audio
  const audioFile = formData.get("file") as Blob | null;
  if (!audioFile) {
    return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
  }

  let uploadUrl: string;
  try {
    const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: { authorization: apiKey, "content-type": "application/octet-stream" },
      body: audioFile,
      signal: AbortSignal.timeout(600_000), // 10 min — large files take time
    });
    if (!uploadRes.ok) {
      return NextResponse.json({ error: "AssemblyAI upload failed" }, { status: 502 });
    }
    const uploadData = await uploadRes.json() as { upload_url: string };
    uploadUrl = uploadData.upload_url;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `AssemblyAI upload failed: ${message}` }, { status: 502 });
  }

  // 2. Submit transcription with speaker diarization
  const transcriptBody: Record<string, unknown> = {
    audio_url: uploadUrl,
    speaker_labels: true,
  };
  if (language) transcriptBody.language_code = language;

  let transcriptId: string;
  try {
    const submitRes = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers,
      body: JSON.stringify(transcriptBody),
      signal: AbortSignal.timeout(30_000),
    });
    if (!submitRes.ok) {
      const err = await submitRes.json().catch(() => ({})) as { error?: string };
      return NextResponse.json({ error: err.error ?? "AssemblyAI submission failed" }, { status: 502 });
    }
    const submitData = await submitRes.json() as { id: string };
    transcriptId = submitData.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `AssemblyAI submission failed: ${message}` }, { status: 502 });
  }

  // Return job ID immediately — client polls /api/transcribe/assemblyai-status
  return NextResponse.json({ assemblyJobId: transcriptId });
}

async function transcribeWithWhisper(
  formData: FormData,
  settings: {
    whisperProto: string;
    whisperHost: string;
    whisperPort: string;
    whisperPath: string;
    whisperModel: string;
    whisperLang: string;
  }
) {
  const whisperUrl = `${settings.whisperProto}://${settings.whisperHost}:${settings.whisperPort}${settings.whisperPath}`;

  if (settings.whisperModel) formData.set("model", settings.whisperModel);
  if (settings.whisperLang) formData.set("language", settings.whisperLang);

  let response: Response;
  try {
    response = await fetch(whisperUrl, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(7_200_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Whisper unreachable: ${message}` }, { status: 502 });
  }

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
