import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { NewSeriesButton } from "./NewSeriesButton";

export default async function SeriesPage() {
  const session = await auth();
  const userId = session!.user!.id as string;

  const allSeries = await prisma.meetingSeries.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      meetings: {
        orderBy: { date: "desc" },
        take: 1,
        select: { date: true, title: true },
      },
      _count: { select: { meetings: true } },
    },
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Meeting Series</h1>
          <p className="text-sm text-[#8b8fa8] mt-1">Group recurring meetings and track carry-forward items</p>
        </div>
        <NewSeriesButton />
      </div>

      {allSeries.length === 0 ? (
        <div className="bg-[#181929] border border-[#252640] rounded-xl p-10 text-center">
          <p className="text-[#6b6f8e] mb-4">No series yet. Create one to group recurring meetings.</p>
          <NewSeriesButton />
        </div>
      ) : (
        <div className="grid gap-4">
          {allSeries.map((s) => {
            const last = s.meetings[0];
            return (
              <Link key={s.id} href={`/series/${s.id}`}
                className="bg-[#181929] border border-[#252640] hover:border-violet-700/50 rounded-xl p-5 transition block">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-white">{s.name}</p>
                    <p className="text-xs text-[#6b6f8e] mt-1">
                      {s._count.meetings} meeting{s._count.meetings !== 1 ? "s" : ""}
                      {last ? ` · Last: ${new Date(last.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                    </p>
                  </div>
                  <span className="text-[#4a4d6a] text-sm mt-0.5">→</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
