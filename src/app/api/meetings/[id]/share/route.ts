import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function verifyMeeting(meetingId: string, userId: string) {
  return prisma.meeting.findFirst({ where: { id: meetingId, userId } });
}

// GET — list share links for a meeting
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: meetingId } = await params;
  if (!await verifyMeeting(meetingId, session.user.id as string)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const links = await prisma.shareLink.findMany({
    where: { meetingId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(links);
}

// POST — create a new share link
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: meetingId } = await params;
  if (!await verifyMeeting(meetingId, session.user.id as string)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { expiresInDays?: number } = {};
  try { body = await req.json(); } catch { /* no body is fine */ }

  const expiresAt = body.expiresInDays
    ? new Date(Date.now() + body.expiresInDays * 86400000)
    : null;

  const link = await prisma.shareLink.create({
    data: { meetingId, expiresAt },
  });

  return NextResponse.json(link, { status: 201 });
}

// DELETE — revoke a share link (?token=xxx)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: meetingId } = await params;
  if (!await verifyMeeting(meetingId, session.user.id as string)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  await prisma.shareLink.deleteMany({ where: { token, meetingId } });

  return NextResponse.json({ success: true });
}
