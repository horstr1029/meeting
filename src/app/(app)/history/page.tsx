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
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="flex items-center justify-between px-8 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="text-gray-400 hover:text-white text-sm transition">
            ← Dashboard
          </button>
          <h1 className="text-xl font-bold">Meeting History</h1>
        </div>
        <Link href="/record" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-semibold transition">
          + New Meeting
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-8 space-y-5">
        <input
          type="text"
          placeholder="Search by title or date…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />

        {loading ? (
          <p className="text-gray-500 text-center py-10">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 text-center py-10">
            {search ? "No meetings match your search." : "No meetings yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-800">
                  <th className="pb-3 font-medium">Title</th>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Lang</th>
                  <th className="pb-3 font-medium">Actions</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-900 transition">
                    <td className="py-3 pr-4">
                      <Link href={`/meetings/${m.id}`} className="font-medium hover:text-blue-400 transition">
                        {m.title}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-gray-400">
                      {new Date(m.date).toLocaleDateString("en-ZA", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </td>
                    <td className="py-3 pr-4 text-gray-500 uppercase text-xs">{m.language}</td>
                    <td className="py-3 pr-4 text-gray-400">{m._count.actionItems}</td>
                    <td className="py-3 pr-4">
                      <div className="flex gap-1">
                        {m.transcript && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-950 text-blue-300">T</span>
                        )}
                        {m.minutes && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-950 text-green-300">M</span>
                        )}
                        {!m.transcript && !m.minutes && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">Draft</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2 justify-end">
                        <Link
                          href={`/meetings/${m.id}/export`}
                          className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 transition"
                        >
                          Export
                        </Link>
                        <button
                          onClick={() => handleDelete(m.id, m.title)}
                          disabled={deleting === m.id}
                          className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-red-900 text-gray-400 hover:text-red-300 transition disabled:opacity-50"
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
        )}
      </main>
    </div>
  );
}
