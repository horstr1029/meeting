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
  if (langOverride) {
    formData.delete("langOverride");
  }
  const language = (langOverride as string | null) ?? settings.whisperLang;

  if (transcriptionProvider === "groq") {
    return transcribeWithGroq(formData, settings.groqApiKey, language);
  }

  return transcribeWithWhisper(formData, { ...settings, whisperLang: language });
}

async function transcribeWithGroq(
  formData: FormData,
  apiKey: string,
  language: string
) {
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
