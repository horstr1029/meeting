import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/apiKeyAuth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  const tag = req.nextUrl.searchParams.get("tag")?.trim() || "";

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
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { title?: string; language?: string; agenda?: string; attendees?: string; seriesId?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const meeting = await prisma.meeting.create({
    data: {
      userId,
      title: body.title ?? "Untitled Meeting",
      language: body.language ?? "en",
      ...(body.agenda ? { agenda: body.agenda } : {}),
      ...(body.attendees ? { attendees: body.attendees } : {}),
      ...(body.seriesId ? { seriesId: body.seriesId } : {}),
    },
  });

  return NextResponse.json(meeting, { status: 201 });
}
