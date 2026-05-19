import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function isoWeekLabel(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay() + 1); // Monday
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function BarChart({ data, color = "bg-violet-600" }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-2 h-32 pt-2">
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[10px] text-[#6b6f8e]">{d.value || ""}</span>
          <div className="w-full rounded-t-sm relative" style={{ height: "80px" }}>
            <div
              className={`absolute bottom-0 w-full rounded-t-sm transition-all ${color}`}
              style={{ height: `${Math.max((d.value / max) * 80, d.value > 0 ? 4 : 0)}px` }}
            />
          </div>
          <span className="text-[9px] text-[#4a4d6a] text-center leading-tight">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="flex items-center gap-6">
      <div className="relative flex-shrink-0">
        <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
          <circle cx="48" cy="48" r={r} fill="none" stroke="#252640" strokeWidth="12" />
          <circle
            cx="48" cy="48" r={r} fill="none"
            stroke="#7c3aed" strokeWidth="12"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-white">{pct}%</span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-violet-600" />
          <span className="text-sm text-[#c5c7e8]">{done} completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#252640]" />
          <span className="text-sm text-[#8b8fa8]">{total - done} pending</span>
        </div>
      </div>
    </div>
  );
}

export default async function AnalyticsPage() {
  const session = await auth();
  const userId = session!.user!.id as string;

  const now = new Date();
  const eightWeeksAgo = new Date(now);
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const [recentMeetings, allActionItems, priorityCounts, dayBuckets] = await Promise.all([
    prisma.meeting.findMany({
      where: { userId, date: { gte: eightWeeksAgo } },
      select: { date: true },
      orderBy: { date: "asc" },
    }),
    prisma.actionItem.findMany({
      where: { meeting: { userId } },
      select: { done: true },
    }),
    prisma.actionItem.groupBy({
      by: ["priority"],
      where: { meeting: { userId } },
      _count: { _all: true },
    }),
    prisma.meeting.findMany({
      where: { userId },
      select: { date: true },
    }),
  ]);

  // Meetings per week (last 8 weeks)
  const weekMap = new Map<string, number>();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weekMap.set(isoWeekLabel(d), 0);
  }
  for (const { date } of recentMeetings) {
    const label = isoWeekLabel(new Date(date));
    if (weekMap.has(label)) weekMap.set(label, (weekMap.get(label) ?? 0) + 1);
  }
  const weeklyData = Array.from(weekMap.entries()).map(([label, value]) => ({ label, value }));

  // Action item completion
  const totalActions = allActionItems.length;
  const doneActions = allActionItems.filter((a) => a.done).length;

  // Priority breakdown
  const priorityMap: Record<string, number> = { high: 0, medium: 0, low: 0 };
  for (const row of priorityCounts) {
    priorityMap[row.priority] = row._count._all;
  }
  const priorityData = [
    { label: "High", value: priorityMap.high, color: "bg-rose-600" },
    { label: "Medium", value: priorityMap.medium, color: "bg-amber-500" },
    { label: "Low", value: priorityMap.low, color: "bg-[#4a4d6a]" },
  ];

  // Meetings by day of week
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayCount = [0, 0, 0, 0, 0, 0, 0];
  for (const { date } of dayBuckets) dayCount[new Date(date).getDay()]++;
  const dayData = dayNames.map((label, i) => ({ label, value: dayCount[i] }));

  const totalMeetings = dayBuckets.length;
  const avgPerWeek = totalMeetings > 0
    ? (totalMeetings / Math.max(weeklyData.filter((w) => w.value > 0).length, 1)).toFixed(1)
    : "0";
  const completionRate = totalActions > 0 ? Math.round((doneActions / totalActions) * 100) : 0;
  const busiestDay = dayNames[dayCount.indexOf(Math.max(...dayCount))];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-sm text-[#8b8fa8] mt-1">Meeting trends and task performance</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "TOTAL MEETINGS",     value: totalMeetings,         color: "text-violet-400" },
          { label: "AVG / ACTIVE WEEK",  value: avgPerWeek,            color: "text-violet-400" },
          { label: "COMPLETION RATE",    value: `${completionRate}%`,  color: completionRate >= 70 ? "text-emerald-400" : "text-amber-400" },
          { label: "BUSIEST DAY",        value: busiestDay,            color: "text-cyan-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#181929] border border-[#252640] rounded-xl p-5">
            <p className={`text-4xl font-bold mt-1 mb-1 ${color}`}>{value}</p>
            <p className="text-xs text-[#6b6f8e] tracking-wider font-medium">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Meetings per week */}
        <div className="bg-[#181929] border border-[#252640] rounded-xl p-5">
          <p className="text-xs font-semibold text-[#6b6f8e] uppercase tracking-wider mb-4">Meetings per week (last 8 weeks)</p>
          <BarChart data={weeklyData} color="bg-violet-600" />
        </div>

        {/* Action item completion */}
        <div className="bg-[#181929] border border-[#252640] rounded-xl p-5">
          <p className="text-xs font-semibold text-[#6b6f8e] uppercase tracking-wider mb-4">Action item completion</p>
          {totalActions > 0 ? (
            <DonutChart done={doneActions} total={totalActions} />
          ) : (
            <p className="text-sm text-[#4a4d6a] italic pt-4">No action items yet.</p>
          )}
        </div>

        {/* Priority breakdown */}
        <div className="bg-[#181929] border border-[#252640] rounded-xl p-5">
          <p className="text-xs font-semibold text-[#6b6f8e] uppercase tracking-wider mb-4">Action items by priority</p>
          {totalActions > 0 ? (
            <div className="space-y-3">
              {priorityData.map(({ label, value, color }) => {
                const pct = totalActions > 0 ? (value / totalActions) * 100 : 0;
                return (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#8b8fa8]">{label}</span>
                      <span className="text-[#6b6f8e]">{value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#252640] overflow-hidden">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-[#4a4d6a] italic pt-4">No action items yet.</p>
          )}
        </div>

        {/* Meetings by day of week */}
        <div className="bg-[#181929] border border-[#252640] rounded-xl p-5">
          <p className="text-xs font-semibold text-[#6b6f8e] uppercase tracking-wider mb-4">Meetings by day of week</p>
          <BarChart data={dayData} color="bg-cyan-700" />
        </div>
      </div>
    </div>
  );
}
