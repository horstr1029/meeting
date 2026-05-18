import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const link = await prisma.shareLink.findUnique({
    where: { token },
    include: {
      meeting: {
        include: { actionItems: { orderBy: { createdAt: "asc" } } },
      },
    },
  });

  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (link.expiresAt && link.expiresAt < new Date()) {
    return NextResponse.json({ error: "Link expired" }, { status: 410 });
  }

  const { meeting } = link;
  return NextResponse.json({
    id: meeting.id,
    title: meeting.title,
    date: meeting.date,
    attendees: meeting.attendees,
    agenda: meeting.agenda,
    minutes: meeting.minutes,
    transcript: meeting.transcript,
    language: meeting.language,
    tags: meeting.tags,
    actionItems: meeting.actionItems,
    expiresAt: link.expiresAt,
  });
}
