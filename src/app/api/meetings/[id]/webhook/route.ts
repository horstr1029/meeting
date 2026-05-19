import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/apiKeyAuth";
import { NextRequest, NextResponse } from "next/server";

function buildSlackPayload(meeting: {
  title: string;
  date: Date;
  minutes: string | null;
  attendees: string;
  actionItems: { text: string; assignee: string | null; priority: string; done: boolean }[];
}) {
  const date = new Date(meeting.date).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

  const todoItems = meeting.actionItems.filter((a) => !a.done);
  const actionBlock = todoItems.length > 0
    ? todoItems.map((a) => `• ${a.text}${a.assignee ? ` _(${a.assignee})_` : ""} [${a.priority}]`).join("\n")
    : "_No open action items_";

  const summary = meeting.minutes
    ? meeting.minutes.replace(/[*#`]/g, "").trim().slice(0, 400) + (meeting.minutes.length > 400 ? "…" : "")
    : "_No minutes generated yet._";

  return {
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `📋 ${meeting.title}`, emoji: true },
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: `${date}${meeting.attendees ? `  ·  ${meeting.attendees}` : ""}` }],
      },
      { type: "divider" },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Summary*\n${summary}` },
      },
      { type: "divider" },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Action Items*\n${actionBlock}` },
      },
    ],
  };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [meeting, settings] = await Promise.all([
    prisma.meeting.findFirst({
      where: { id, userId },
      include: { actionItems: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.userSettings.findUnique({ where: { userId } }),
  ]);

  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const webhookUrl = settings?.webhookUrl?.trim();
  if (!webhookUrl) return NextResponse.json({ error: "No webhook URL configured in settings" }, { status: 400 });

  const payload = buildSlackPayload(meeting);

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json({ error: `Webhook returned ${res.status}: ${text}` }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
