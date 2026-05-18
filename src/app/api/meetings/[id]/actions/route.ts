import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: meetingId } = await params;

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, userId: session.user.id as string },
  });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { items: Array<{ text: string; assignee?: string; dueDate?: string }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: "items must be an array" }, { status: 400 });
  }

  // Replace all action items for this meeting
  await prisma.actionItem.deleteMany({ where: { meetingId } });

  const created = await prisma.actionItem.createMany({
    data: body.items.map((item) => ({
      meetingId,
      text: item.text,
      assignee: item.assignee ?? null,
      dueDate: item.dueDate ? new Date(item.dueDate) : null,
    })),
  });

  return NextResponse.json({ created: created.count }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: meetingId } = await params;

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, userId: session.user.id as string },
  });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { actionItemId: string; done: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updated = await prisma.actionItem.update({
    where: { id: body.actionItemId, meetingId },
    data: { done: body.done },
  });

  return NextResponse.json(updated);
}
