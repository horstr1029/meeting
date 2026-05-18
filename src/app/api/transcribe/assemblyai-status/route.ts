import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.id as string },
    select: { assemblyAiApiKey: true },
  });
  if (!settings?.assemblyAiApiKey) {
    return NextResponse.json({ error: "AssemblyAI API key not configured" }, { status: 400 });
  }

  let jobId: string;
  try {
    const body = await req.json() as { jobId: string };
    jobId = body.jobId;
  } catch {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`https://api.assemblyai.com/v2/transcript/${jobId}`, {
      headers: { authorization: settings.assemblyAiApiKey },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ status: "processing", error: msg });
  }

  if (!res.ok) {
    return NextResponse.json({ status: "processing" });
  }

  const data = await res.json() as {
    status: string;
    error?: string;
    text?: string;
    utterances?: { speaker: string; text: string }[];
  };

  if (data.status === "error") {
    return NextResponse.json({ status: "error", error: data.error ?? "AssemblyAI transcription failed" });
  }

  if (data.status === "completed") {
    let text = data.text ?? "";
    if (data.utterances && data.utterances.length > 0) {
      text = data.utterances.map((u) => `[Speaker ${u.speaker}]: ${u.text}`).join("\n\n");
    }
    return NextResponse.json({ status: "completed", text });
  }

  return NextResponse.json({ status: "processing" });
}
