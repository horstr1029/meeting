import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id as string;

  const now = new Date();
  const [meetings, totalMeetings, withTranscript, pendingActions, overdueActions] = await Promise.all([
    prisma.meeting.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 8,
      include: { _count: { select: { actionItems: { where: { done: false } } } } },
    }),
    prisma.meeting.count({ where: { userId } }),
    prisma.meeting.count({ where: { userId, transcript: { not: null } } }),
    prisma.actionItem.count({ where: { meeting: { userId }, done: false } }),
    prisma.actionItem.count({ where: { meeting: { userId }, done: false, dueDate: { lt: now } } }),
  ]);

  return (
    <div className="p-8 space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          </div>
          <p className="text-sm text-[#8b8fa8]">Overview & quick start</p>
        </div>
        <Link
          href="/record"
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-sm font-semibold text-white transition shadow-lg shadow-violet-900/30"
        >
          + New Meeting
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { icon: "🎙️", value: totalMeetings,  label: "MEETINGS",      color: "text-violet-400" },
          { icon: "📝", value: withTranscript,  label: "TRANSCRIPTS",   color: "text-violet-400" },
          { icon: "✅", value: pendingActions,  label: "PENDING TASKS", color: "text-emerald-400" },
          { icon: "🔴", value: overdueActions,  label: "OVERDUE",       color: overdueActions > 0 ? "text-rose-400" : "text-[#4a4d6a]" },
        ].map(({ icon, value, label, color }) => (
          <div key={label} className="bg-[#181929] border border-[#252640] rounded-xl p-5">
            <span className="text-2xl">{icon}</span>
            <p className={`text-4xl font-bold mt-3 mb-1 ${color}`}>{value}</p>
            <p className="text-xs text-[#6b6f8e] tracking-wider font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Quick Start */}
      <div className="bg-[#181929] border border-[#252640] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span>⚡</span>
          <h2 className="text-xs font-bold text-[#c5c7e8] tracking-[0.1em]">QUICK START</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/record"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 text-sm font-semibold text-white transition shadow-lg shadow-rose-900/30"
          >
            <span className="w-2 h-2 rounded-full bg-white/80 animate-pulse" />
            Start Recording
          </Link>
          <Link
            href="/record"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-sm font-semibold text-white transition shadow-lg shadow-violet-900/30"
          >
            ⬆️ Upload Audio
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#252640] hover:bg-[#2f3158] text-sm font-semibold text-[#c5c7e8] transition"
          >
            ⚙️ Configure Servers
          </Link>
          <Link
            href="/history"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-sm font-semibold text-white transition shadow-lg shadow-cyan-900/30"
          >
            📋 All Meetings
          </Link>
        </div>
      </div>

      {/* Recent Meetings */}
      <div className="bg-[#181929] border border-[#252640] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span>📁</span>
            <h2 className="text-xs font-bold text-[#c5c7e8] tracking-[0.1em]">RECENT MEETINGS</h2>
          </div>
          <Link href="/history" className="text-xs text-violet-400 hover:text-violet-300 transition">
            View all →
          </Link>
        </div>

        {meetings.length === 0 ? (
          <div className="text-center py-14">
            <p className="text-4xl mb-3">🎙️</p>
            <p className="text-sm text-[#4a4d6a]">No meetings yet.</p>
            <Link href="/record" className="mt-3 inline-block text-sm text-violet-400 hover:text-violet-300">
              Start recording →
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {meetings.map((m) => {
              const hasTranscript = !!m.transcript;
              const hasMinutes = !!m.minutes;
              return (
                <li key={m.id}>
                  <Link
                    href={`/meetings/${m.id}`}
                    className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#111223] hover:bg-[#1a1b2c] border border-[#252640] hover:border-[#3a3c6a] transition"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{m.title}</p>
                      <p className="text-xs text-[#6b6f8e] mt-0.5">
                        {new Date(m.date).toLocaleDateString("en-ZA", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                        {m._count.actionItems > 0 && (
                          <span className="ml-2 text-violet-400">
                            {m._count.actionItems} open action{m._count.actionItems !== 1 ? "s" : ""}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-3 flex-shrink-0">
                      {hasTranscript && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-violet-950/70 text-violet-300 border border-violet-800/40">
                          Transcript
                        </span>
                      )}
                      {hasMinutes && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-800/40">
                          Minutes
                        </span>
                      )}
                      {!hasTranscript && !hasMinutes && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#252640] text-[#6b6f8e]">Draft</span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
