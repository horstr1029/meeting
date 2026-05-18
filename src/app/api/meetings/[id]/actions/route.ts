import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function verifyMeeting(meetingId: string, userId: string) {
  return prisma.meeting.findFirst({ where: { id: meetingId, userId } });
}

// Replace all action items (used by AI extraction)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: meetingId } = await params;
  if (!await verifyMeeting(meetingId, session.user.id as string)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { items: Array<{ text: string; assignee?: string; priority?: string; dueDate?: string }> };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: "items must be an array" }, { status: 400 });
  }

  await prisma.actionItem.deleteMany({ where: { meetingId } });
  const created = await prisma.actionItem.createMany({
    data: body.items.map((item) => ({
      meetingId,
      text: item.text,
      assignee: item.assignee ?? null,
      priority: item.priority ?? "medium",
      dueDate: item.dueDate ? new Date(item.dueDate) : null,
    })),
  });

  return NextResponse.json({ created: created.count }, { status: 201 });
}

// Add a single action item
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: meetingId } = await params;
  if (!await verifyMeeting(meetingId, session.user.id as string)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { text: string; assignee?: string; priority?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.text?.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const item = await prisma.actionItem.create({
    data: {
      meetingId,
      text: body.text.trim(),
      assignee: body.assignee?.trim() || null,
      priority: body.priority ?? "medium",
    },
  });

  return NextResponse.json(item, { status: 201 });
}

// Toggle done OR delete single item OR clear all done
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: meetingId } = await params;
  if (!await verifyMeeting(meetingId, session.user.id as string)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { actionItemId: string; done: boolean };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updated = await prisma.actionItem.update({
    where: { id: body.actionItemId, meetingId },
    data: { done: body.done },
  });

  return NextResponse.json(updated);
}

// Delete single item (?id=xxx) or clear done (?clearDone=1)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: meetingId } = await params;
  if (!await verifyMeeting(meetingId, session.user.id as string)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const actionId = url.searchParams.get("id");
  const clearDone = url.searchParams.get("clearDone");

  if (clearDone) {
    const { count } = await prisma.actionItem.deleteMany({ where: { meetingId, done: true } });
    return NextResponse.json({ deleted: count });
  }

  if (actionId) {
    await prisma.actionItem.delete({ where: { id: actionId, meetingId } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Provide ?id= or ?clearDone=1" }, { status: 400 });
}
