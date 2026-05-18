import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;

  const [totalMeetings, withTranscript, withMinutes, pendingActions] = await Promise.all([
    prisma.meeting.count({ where: { userId } }),
    prisma.meeting.count({ where: { userId, transcript: { not: null } } }),
    prisma.meeting.count({ where: { userId, minutes: { not: null } } }),
    prisma.actionItem.count({
      where: { meeting: { userId }, done: false },
    }),
  ]);

  return NextResponse.json({ totalMeetings, withTranscript, withMinutes, pendingActions });
}
