import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  const tag = req.nextUrl.searchParams.get("tag")?.trim() || "";
  const userId = session.user.id as string;

  const meetings = await prisma.meeting.findMany({
    where: {
      userId,
      ...(q ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { transcript: { contains: q, mode: "insensitive" } },
          { attendees: { contains: q, mode: "insensitive" } },
          { minutes: { contains: q, mode: "insensitive" } },
        ],
      } : {}),
      ...(tag ? { tags: { contains: tag, mode: "insensitive" } } : {}),
    },
    orderBy: { date: "desc" },
    select: {
      id: true,
      title: true,
      date: true,
      language: true,
      tags: true,
      transcript: true,
      minutes: true,
      createdAt: true,
      _count: { select: { actionItems: true } },
    },
  });

  // Annotate with where the search term matched (for UI hint)
  const results = meetings.map((m) => ({
    ...m,
    transcript: null, // strip content from list response
    minutes: null,
    hasTranscript: !!m.transcript,
    hasMinutes: !!m.minutes,
    transcriptMatch: q
      ? !m.title.toLowerCase().includes(q.toLowerCase()) &&
        (m.transcript?.toLowerCase().includes(q.toLowerCase()) ||
          m.minutes?.toLowerCase().includes(q.toLowerCase()) || false)
      : false,
  }));

  return NextResponse.json(results);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { title?: string; language?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const meeting = await prisma.meeting.create({
    data: {
      userId: session.user.id as string,
      title: body.title ?? "Untitled Meeting",
      language: body.language ?? "en",
    },
  });

  return NextResponse.json(meeting, { status: 201 });
}
