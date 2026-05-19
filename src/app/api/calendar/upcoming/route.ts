import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

interface CalEvent {
  title: string;
  start: string;       // ISO string
  end: string;         // ISO string
  attendees: string;   // comma-separated display names / emails
  description: string;
}

function parseIcalDate(raw: string): Date | null {
  // Strip TZID=... prefix if present
  const val = raw.includes(":") ? raw.split(":").pop()! : raw;
  if (!val) return null;

  // Date-only: 20250519
  if (/^\d{8}$/.test(val)) {
    return new Date(`${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}T00:00:00`);
  }
  // DateTime: 20250519T103000Z or 20250519T103000
  if (/^\d{8}T\d{6}Z?$/.test(val)) {
    const s = `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}T${val.slice(9, 11)}:${val.slice(11, 13)}:${val.slice(13, 15)}${val.endsWith("Z") ? "Z" : ""}`;
    return new Date(s);
  }
  return null;
}

function unfold(raw: string): string {
  // iCal line folding: CRLF + whitespace = continuation
  return raw.replace(/\r\n[ \t]/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function parseIcal(ical: string): CalEvent[] {
  const text = unfold(ical);
  const events: CalEvent[] = [];
  const blocks = text.split("BEGIN:VEVENT");

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const get = (key: string): string => {
      const re = new RegExp(`^${key}[^:]*:(.*)$`, "m");
      return block.match(re)?.[1]?.trim() ?? "";
    };
    const getAll = (key: string): string[] => {
      const re = new RegExp(`^${key}[^:]*:(.*)$`, "gm");
      return [...block.matchAll(re)].map((m) => m[1].trim());
    };

    const summary = get("SUMMARY").replace(/\\,/g, ",").replace(/\\n/g, " ").replace(/\\/g, "");
    const dtstart = get("DTSTART");
    const dtend = get("DTEND");
    const description = get("DESCRIPTION").replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\/g, "");

    const start = parseIcalDate(dtstart);
    const end = parseIcalDate(dtend);
    if (!start || !summary) continue;

    // Attendees: CN= display name or raw email
    const rawAttendees = getAll("ATTENDEE");
    const organizer = get("ORGANIZER");
    if (organizer) rawAttendees.push(organizer);

    const attendees = rawAttendees
      .map((a) => {
        const cn = a.match(/CN=([^;:]+)/)?.[1]?.trim();
        const email = a.match(/mailto:(.+)/i)?.[1]?.trim();
        return cn && cn !== email ? cn : (email ?? "");
      })
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .join(", ");

    events.push({
      title: summary,
      start: start.toISOString(),
      end: end ? end.toISOString() : start.toISOString(),
      attendees,
      description,
    });
  }

  return events;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id as string;

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const calendarUrl = settings?.calendarUrl?.trim();
  if (!calendarUrl) return NextResponse.json({ error: "No calendar URL configured" }, { status: 400 });

  let icalText: string;
  try {
    const res = await fetch(calendarUrl, { next: { revalidate: 0 } });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    icalText = await res.text();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Fetch failed" }, { status: 502 });
  }

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + 14);

  const events = parseIcal(icalText)
    .filter((e) => {
      const start = new Date(e.start);
      return start >= now && start <= cutoff;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 20);

  return NextResponse.json(events);
}
