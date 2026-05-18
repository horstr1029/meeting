import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meetings = await prisma.meeting.findMany({
    where: { userId: session.user.id as string },
    orderBy: { date: "desc" },
    select: {
      id: true,
      title: true,
      date: true,
      language: true,
      createdAt: true,
      _count: { select: { actionItems: true } },
    },
  });

  return NextResponse.json(meetings);
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
