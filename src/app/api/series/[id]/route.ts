import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id as string;
  const { id } = await params;

  const series = await prisma.meetingSeries.findFirst({
    where: { id, userId },
    include: {
      meetings: {
        orderBy: { date: "asc" },
        include: {
          actionItems: { orderBy: { createdAt: "asc" } },
          _count: { select: { actionItems: true } },
        },
      },
    },
  });

  if (!series) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(series);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id as string;
  const { id } = await params;

  const series = await prisma.meetingSeries.findFirst({ where: { id, userId } });
  if (!series) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Detach meetings rather than deleting them (onDelete: SetNull handles this)
  await prisma.meetingSeries.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
