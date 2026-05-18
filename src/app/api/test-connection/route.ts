import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { type } = body as { type: string };

  if (type === "groq") {
    // Resolve API key: use body value unless it's masked, then fall back to stored
    let apiKey: string = body.groqApiKey ?? "";
    if (!apiKey || apiKey.includes("*")) {
      const stored = await prisma.userSettings.findUnique({
        where: { userId: session.user.id as string },
        select: { groqApiKey: true },
      });
      apiKey = stored?.groqApiKey ?? "";
    }

    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "No API key configured" });
    }

    try {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return NextResponse.json({ ok: false, error: (err as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}` });
      }
      const data = await res.json() as { data: { id: string }[] };
      const whisperModels = data.data
        .filter((m) => m.id.includes("whisper"))
        .map((m) => m.id);
      return NextResponse.json({ ok: true, models: whisperModels });
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Connection failed" });
    }
  }

  if (type === "ollama") {
    const { ollamaProto, ollamaHost, ollamaPort } = body as Record<string, string>;
    const base = `${ollamaProto ?? "http"}://${ollamaHost}:${ollamaPort}`;

    try {
      const res = await fetch(`${base}/api/tags`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        return NextResponse.json({ ok: false, error: `HTTP ${res.status}` });
      }
      const data = await res.json() as { models: { name: string }[] };
      const models = (data.models ?? []).map((m) => m.name);
      return NextResponse.json({ ok: true, models });
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Connection failed" });
    }
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
