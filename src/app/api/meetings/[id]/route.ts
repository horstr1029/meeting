import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function getMeetingForUser(id: string, userId: string) {
  return prisma.meeting.findFirst({
    where: { id, userId },
    include: { actionItems: { orderBy: { createdAt: "asc" } } },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const meeting = await getMeetingForUser(id, session.user.id as string);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(meeting);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getMeetingForUser(id, session.user.id as string);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Partial<{ title: string; transcript: string; minutes: string; language: string; audioPath: string; attendees: string; agenda: string }>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updated = await prisma.meeting.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.transcript !== undefined && { transcript: body.transcript }),
      ...(body.minutes !== undefined && { minutes: body.minutes }),
      ...(body.language !== undefined && { language: body.language }),
      ...(body.audioPath !== undefined && { audioPath: body.audioPath }),
      ...(body.attendees !== undefined && { attendees: body.attendees }),
      ...(body.agenda !== undefined && { agenda: body.agenda }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getMeetingForUser(id, session.user.id as string);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.meeting.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
