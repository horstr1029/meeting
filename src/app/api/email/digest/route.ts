import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

function fmt(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function daysAgo(d: Date) {
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id as string;

  const body = await req.json().catch(() => ({})) as { to?: string };

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings?.smtpHost) {
    return NextResponse.json({ error: "SMTP not configured — add host in Settings" }, { status: 400 });
  }

  const to = body.to?.trim() || settings.emailRecipients?.trim();
  if (!to) return NextResponse.json({ error: "No recipient — provide 'to' or set Default email recipients in Settings" }, { status: 400 });

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [weekMeetings, overdueItems] = await Promise.all([
    prisma.meeting.findMany({
      where: { userId, date: { gte: weekAgo } },
      orderBy: { date: "desc" },
      include: { _count: { select: { actionItems: { where: { done: false } } } } },
    }),
    prisma.actionItem.findMany({
      where: {
        meeting: { userId },
        done: false,
        dueDate: { lt: now },
      },
      include: { meeting: { select: { title: true } } },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  const weekStart = fmt(weekAgo);
  const weekEnd = fmt(now);

  const lines: string[] = [
    `DAB MEETINGS — WEEKLY DIGEST`,
    `${weekStart} → ${weekEnd}`,
    `${"─".repeat(50)}`,
    "",
  ];

  // Meetings this week
  lines.push(`MEETINGS THIS WEEK (${weekMeetings.length})`);
  lines.push("─".repeat(30));
  if (weekMeetings.length === 0) {
    lines.push("  No meetings recorded this week.");
  } else {
    for (const m of weekMeetings) {
      lines.push(`  • ${m.title}`);
      lines.push(`    ${fmt(new Date(m.date))}${m.attendees ? `  ·  ${m.attendees}` : ""}`);
      if (m._count.actionItems > 0) {
        lines.push(`    ${m._count.actionItems} pending action item${m._count.actionItems !== 1 ? "s" : ""}`);
      }
      lines.push("");
    }
  }

  // Overdue items
  lines.push(`OVERDUE ACTION ITEMS (${overdueItems.length})`);
  lines.push("─".repeat(30));
  if (overdueItems.length === 0) {
    lines.push("  No overdue items. Great work!");
  } else {
    for (const a of overdueItems) {
      const days = a.dueDate ? daysAgo(new Date(a.dueDate)) : 0;
      lines.push(`  • ${a.text}`);
      lines.push(`    From: ${a.meeting.title}${a.assignee ? `  ·  ${a.assignee}` : ""}  ·  ${days}d overdue`);
      lines.push("");
    }
  }

  lines.push("─".repeat(50));
  lines.push("Sent by DAB Meetings");

  const text = lines.join("\n");
  const subject = `DAB Meetings — Weekly Digest (${weekStart})`;

  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: parseInt(settings.smtpPort || "587", 10),
    secure: settings.smtpSecure,
    auth: settings.smtpUser ? { user: settings.smtpUser, pass: settings.smtpPassword } : undefined,
  });

  try {
    await transporter.sendMail({
      from: settings.smtpFrom || settings.smtpUser || "noreply@dab-meetings",
      to,
      subject,
      text,
    });
    return NextResponse.json({
      success: true,
      meetings: weekMeetings.length,
      overdue: overdueItems.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Send failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
