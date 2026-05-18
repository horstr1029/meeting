import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id as string;

  const [meetings, totalMeetings, withTranscript, withMinutes, pendingActions] = await Promise.all([
    prisma.meeting.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 10,
      include: { _count: { select: { actionItems: true } } },
    }),
    prisma.meeting.count({ where: { userId } }),
    prisma.meeting.count({ where: { userId, transcript: { not: null } } }),
    prisma.meeting.count({ where: { userId, minutes: { not: null } } }),
    prisma.actionItem.count({ where: { meeting: { userId }, done: false } }),
  ]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="flex items-center justify-between px-8 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">DAB Meetings</h1>
        <div className="flex items-center gap-4">
          <Link href="/settings" className="text-sm text-gray-400 hover:text-white transition">Settings</Link>
          <span className="text-sm text-gray-500">{session?.user?.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className="text-sm text-gray-400 hover:text-white transition">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-10 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Meetings", value: totalMeetings },
            { label: "Transcribed", value: withTranscript },
            { label: "With Minutes", value: withMinutes },
            { label: "Pending Actions", value: pendingActions },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <p className="text-3xl font-bold text-white">{value}</p>
              <p className="text-sm text-gray-400 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Recent meetings */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Meetings</h2>
            <div className="flex gap-3">
              <Link href="/history" className="text-sm text-gray-400 hover:text-white transition">
                View all →
              </Link>
              <Link
                href="/record"
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-semibold transition"
              >
                + New Meeting
              </Link>
            </div>
          </div>

          {meetings.length === 0 ? (
            <div className="text-center py-20 text-gray-500 bg-gray-900 rounded-xl border border-gray-800">
              <p className="text-lg">No meetings yet.</p>
              <p className="text-sm mt-2">Record your first meeting to get started.</p>
              <Link href="/record" className="mt-4 inline-block text-sm text-blue-400 hover:underline">
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
                      className="flex items-center justify-between p-4 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-600 transition"
                    >
                      <div>
                        <p className="font-medium">{m.title}</p>
                        <p className="text-sm text-gray-400 mt-0.5">
                          {new Date(m.date).toLocaleDateString("en-ZA", {
                            day: "2-digit", month: "short", year: "numeric",
                          })}
                          {m._count.actionItems > 0 && (
                            <span className="ml-2 text-xs text-indigo-400">
                              {m._count.actionItems} action{m._count.actionItems !== 1 ? "s" : ""}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {hasTranscript && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-950 text-blue-300">
                            Transcript
                          </span>
                        )}
                        {hasMinutes && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-950 text-green-300">
                            Minutes
                          </span>
                        )}
                        {!hasTranscript && !hasMinutes && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">
                            Draft
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
