import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const VALID_PROVIDERS = ["groq", "whisper", "webspeech"];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.userSettings.upsert({
    where: { userId: session.user.id as string },
    create: { userId: session.user.id as string },
    update: {},
  });

  // Never expose the API key in full — mask it
  return NextResponse.json({
    ...settings,
    groqApiKey: settings.groqApiKey ? `${settings.groqApiKey.slice(0, 6)}${"*".repeat(20)}` : "",
  });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.transcriptionProvider && !VALID_PROVIDERS.includes(body.transcriptionProvider as string)) {
    return NextResponse.json({ error: "Invalid transcription provider" }, { status: 400 });
  }

  // Don't overwrite the stored key if the client sends back the masked value
  if (typeof body.groqApiKey === "string" && body.groqApiKey.includes("*")) {
    delete body.groqApiKey;
  }

  // Strip read-only fields
  const { id, userId, ...data } = body as Record<string, unknown> & { id?: unknown; userId?: unknown };
  void id; void userId;

  const settings = await prisma.userSettings.upsert({
    where: { userId: session.user.id as string },
    create: { userId: session.user.id as string, ...data },
    update: data,
  });

  return NextResponse.json({ success: true, id: settings.id });
}
