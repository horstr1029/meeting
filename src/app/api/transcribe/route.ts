import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

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

async function transcribeWithGroq(formData: FormData, apiKey: string, language: string) {
  if (!apiKey) {
    return NextResponse.json({ error: "Groq API key not set in settings" }, { status: 400 });
  }

  formData.set("model", "whisper-large-v3");
  formData.set("response_format", "json");
  if (language) formData.set("language", language);

  let response: Response;
  try {
    response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
      signal: AbortSignal.timeout(120_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Groq unreachable: ${message}` }, { status: 502 });
  }

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
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
      signal: AbortSignal.timeout(120_000),
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

  // 3. Poll until complete (max 10 minutes)
  const pollUrl = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;
  const deadline = Date.now() + 10 * 60 * 1000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));

    let result: {
      status: string;
      error?: string;
      text?: string;
      utterances?: { speaker: string; text: string }[];
    };

    try {
      const pollRes = await fetch(pollUrl, {
        headers: { authorization: apiKey },
        signal: AbortSignal.timeout(15_000),
      });
      result = await pollRes.json();
    } catch {
      continue;
    }

    if (result.status === "error") {
      return NextResponse.json({ error: result.error ?? "AssemblyAI transcription failed" }, { status: 502 });
    }

    if (result.status === "completed") {
      // Format with speaker labels if available
      let text: string;
      if (result.utterances && result.utterances.length > 0) {
        text = result.utterances
          .map((u) => `[Speaker ${u.speaker}]: ${u.text}`)
          .join("\n\n");
      } else {
        text = result.text ?? "";
      }
      return NextResponse.json({ text });
    }
  }

  return NextResponse.json({ error: "AssemblyAI timed out after 10 minutes" }, { status: 504 });
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
