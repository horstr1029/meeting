import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SeriesControls } from "./SeriesControls";

export default async function SeriesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user!.id as string;

  const series = await prisma.meetingSeries.findFirst({
    where: { id, userId },
    include: {
      meetings: {
        orderBy: { date: "asc" },
        include: {
          actionItems: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  if (!series) notFound();

  // Carry-forward: incomplete action items from all previous meetings (not the latest one)
  const previousMeetings = series.meetings.slice(0, -1);
  const carryForward = previousMeetings.flatMap((m) =>
    m.actionItems
      .filter((a) => !a.done)
      .map((a) => ({ ...a, meetingTitle: m.title, meetingId: m.id }))
  );

  const lastMeeting = series.meetings.at(-1);
  const lastAgenda = lastMeeting?.agenda ?? "";

  const priorityColor: Record<string, string> = {
    high: "text-rose-400 bg-rose-950/40 border-rose-900/40",
    medium: "text-amber-400 bg-amber-950/40 border-amber-900/40",
    low: "text-[#6b6f8e] bg-[#1e1f35] border-[#252640]",
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/series" className="text-xs text-[#6b6f8e] hover:text-white transition mb-1 inline-block">← Series</Link>
          <h1 className="text-2xl font-bold text-white">{series.name}</h1>
          <p className="text-sm text-[#8b8fa8] mt-1">
            {series.meetings.length} meeting{series.meetings.length !== 1 ? "s" : ""}
          </p>
        </div>
        <SeriesControls
          seriesId={id}
          seriesName={series.name}
          lastAgenda={lastAgenda}
          carryForwardText={carryForward.map((a) => `- ${a.text}${a.assignee ? ` (${a.assignee})` : ""}`).join("\n")}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Meeting list */}
        <div className="xl:col-span-2 space-y-3">
          <p className="text-xs font-semibold text-[#6b6f8e] uppercase tracking-wider">Meetings</p>
          {series.meetings.length === 0 ? (
            <p className="text-sm text-[#4a4d6a] italic">No meetings in this series yet.</p>
          ) : (
            series.meetings.map((m, idx) => {
              const pending = m.actionItems.filter((a) => !a.done).length;
              const done = m.actionItems.filter((a) => a.done).length;
              return (
                <Link key={m.id} href={`/meetings/${m.id}`}
                  className="bg-[#181929] border border-[#252640] hover:border-violet-700/40 rounded-xl p-4 flex items-center justify-between gap-4 transition block">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-[#4a4d6a] w-6 text-right flex-shrink-0">#{idx + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{m.title}</p>
                      <p className="text-xs text-[#6b6f8e]">
                        {new Date(m.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 text-xs text-[#6b6f8e]">
                    {m.actionItems.length > 0 && (
                      <span>{done}/{m.actionItems.length} done</span>
                    )}
                    {pending > 0 && (
                      <span className="text-amber-400">{pending} pending</span>
                    )}
                    <span className="text-[#4a4d6a]">→</span>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* Carry-forward panel */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-[#6b6f8e] uppercase tracking-wider">
            Carry-forward items
            {carryForward.length > 0 && <span className="ml-2 text-amber-400">{carryForward.length}</span>}
          </p>
          {carryForward.length === 0 ? (
            <div className="bg-[#181929] border border-[#252640] rounded-xl p-4">
              <p className="text-xs text-[#4a4d6a] italic">No outstanding items from previous meetings.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {carryForward.map((a) => (
                <div key={a.id} className="bg-[#181929] border border-[#252640] rounded-xl p-3 space-y-1.5">
                  <p className="text-sm text-[#c5c7e8]">{a.text}</p>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {a.assignee && (
                        <span className="text-[10px] text-[#6b6f8e]">{a.assignee}</span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${priorityColor[a.priority] ?? priorityColor.low}`}>
                        {a.priority}
                      </span>
                    </div>
                    <Link href={`/meetings/${a.meetingId}`}
                      className="text-[10px] text-[#4a4d6a] hover:text-violet-400 transition truncate max-w-24">
                      {a.meetingTitle}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
