"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Meeting {
  id: string;
  title: string;
  date: string;
  language: string;
  _count: { actionItems: number };
  transcript: string | null;
  minutes: string | null;
}

export default function HistoryPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/meetings")
      .then((r) => r.json())
      .then((data) => { setMeetings(data); setLoading(false); });
  }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeleting(id);
    await fetch(`/api/meetings/${id}`, { method: "DELETE" });
    setMeetings((prev) => prev.filter((m) => m.id !== id));
    setDeleting(null);
  };

  const filtered = meetings.filter(
    (m) =>
      !search ||
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      new Date(m.date).toLocaleDateString().includes(search)
  );

  return (
    <div className="p-8 space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Meeting History</h1>
          <p className="text-sm text-[#8b8fa8] mt-1">Browse and manage your past meetings</p>
        </div>
        <Link
          href="/record"
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-sm font-semibold text-white transition shadow-lg shadow-violet-900/30"
        >
          + New Meeting
        </Link>
      </div>

      <input
        type="text"
        placeholder="Search by title or date…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-[#181929] border border-[#252640] rounded-xl px-4 py-3 text-sm text-white placeholder-[#4a4d6a] focus:outline-none focus:border-violet-500"
      />

      {loading ? (
        <p className="text-[#6b6f8e] text-center py-10">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-[#6b6f8e] text-center py-10">
          {search ? "No meetings match your search." : "No meetings yet."}
        </p>
      ) : (
        <div className="bg-[#181929] border border-[#252640] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#6b6f8e] border-b border-[#252640]">
                  <th className="pb-3 pt-4 px-5 font-medium">Title</th>
                  <th className="pb-3 pt-4 px-3 font-medium">Date</th>
                  <th className="pb-3 pt-4 px-3 font-medium">Lang</th>
                  <th className="pb-3 pt-4 px-3 font-medium">Actions</th>
                  <th className="pb-3 pt-4 px-3 font-medium">Status</th>
                  <th className="pb-3 pt-4 px-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1f35]">
                {filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-[#111223] transition cursor-pointer" onClick={() => router.push(`/meetings/${m.id}`)}>
                    <td className="py-3.5 px-5">
                      <span className="font-medium text-white hover:text-violet-300 transition">
                        {m.title}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-[#8b8fa8]">
                      {new Date(m.date).toLocaleDateString("en-ZA", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </td>
                    <td className="py-3.5 px-3 text-[#6b6f8e] uppercase text-xs">{m.language}</td>
                    <td className="py-3.5 px-3 text-[#8b8fa8]">{m._count.actionItems}</td>
                    <td className="py-3.5 px-3">
                      <div className="flex gap-1">
                        {m.transcript && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-950/70 text-violet-300 border border-violet-800/40">T</span>
                        )}
                        {m.minutes && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-800/40">M</span>
                        )}
                        {!m.transcript && !m.minutes && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#252640] text-[#6b6f8e]">Draft</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/meetings/${m.id}/export`}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-[#252640] hover:bg-[#2f3158] transition text-[#c5c7e8]"
                        >
                          Export
                        </Link>
                        <button
                          onClick={() => handleDelete(m.id, m.title)}
                          disabled={deleting === m.id}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-[#252640] hover:bg-red-950 text-[#8b8fa8] hover:text-red-300 transition disabled:opacity-50"
                        >
                          {deleting === m.id ? "…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
