import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id as string;

  const series = await prisma.meetingSeries.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { meetings: true } } },
  });

  return NextResponse.json(series);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id as string;

  const { name } = await req.json() as { name?: string };
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const series = await prisma.meetingSeries.create({
    data: { userId, name: name.trim() },
  });

  return NextResponse.json(series, { status: 201 });
}
