"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Meeting {
  id: string;
  title: string;
  date: string;
  language: string;
  tags: string;
  hasTranscript: boolean;
  hasMinutes: boolean;
  transcriptMatch: boolean;
  _count: { actionItems: number };
}

export default function HistoryPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMeetings = useCallback((q: string, tag: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tag) params.set("tag", tag);
    fetch(`/api/meetings?${params}`)
      .then((r) => r.json())
      .then((data) => { setMeetings(data); setLoading(false); });
  }, []);

  useEffect(() => { fetchMeetings("", ""); }, [fetchMeetings]);

  const handleSearch = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchMeetings(value, tagFilter), 350);
  };

  const handleTagFilter = (tag: string) => {
    const next = tagFilter === tag ? "" : tag;
    setTagFilter(next);
    fetchMeetings(search, next);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeleting(id);
    await fetch(`/api/meetings/${id}`, { method: "DELETE" });
    setMeetings((prev) => prev.filter((m) => m.id !== id));
    setSelected((prev) => { const s = new Set(prev); s.delete(id); return s; });
    setDeleting(null);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === meetings.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(meetings.map((m) => m.id)));
    }
  };

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} meeting${selected.size !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    await Promise.all(Array.from(selected).map((id) => fetch(`/api/meetings/${id}`, { method: "DELETE" })));
    setMeetings((prev) => prev.filter((m) => !selected.has(m.id)));
    setSelected(new Set());
    setBulkDeleting(false);
  };

  // Collect all unique tags across meetings for filter chips
  const allTags = Array.from(
    new Set(
      meetings.flatMap((m) =>
        m.tags ? m.tags.split(",").map((t) => t.trim()).filter(Boolean) : []
      )
    )
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

      {/* Search */}
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4a4d6a] text-sm">🔍</span>
        <input
          type="text"
          placeholder="Search titles, transcripts, attendees…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full bg-[#181929] border border-[#252640] rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-[#4a4d6a] focus:outline-none focus:border-violet-500"
        />
        {search && (
          <button onClick={() => handleSearch("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4a4d6a] hover:text-white text-xs">
            ✕
          </button>
        )}
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => handleTagFilter(tag)}
              className={`text-xs px-3 py-1 rounded-full border transition ${
                tagFilter === tag
                  ? "border-violet-500 bg-violet-950/50 text-violet-300"
                  : "border-[#252640] text-[#8b8fa8] hover:border-[#3a3c6a] hover:text-white"
              }`}
            >
              # {tag}
            </button>
          ))}
          {tagFilter && (
            <button onClick={() => handleTagFilter("")}
              className="text-xs px-2 py-1 text-[#4a4d6a] hover:text-white transition">
              Clear filter ✕
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-[#6b6f8e] text-center py-10">Loading…</p>
      ) : meetings.length === 0 ? (
        <p className="text-[#6b6f8e] text-center py-10">
          {search || tagFilter ? "No meetings match your search." : "No meetings yet."}
        </p>
      ) : (
        <div className="bg-[#181929] border border-[#252640] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#6b6f8e] border-b border-[#252640]">
                  <th className="pb-3 pt-4 px-4 w-8">
                    <input type="checkbox"
                      checked={meetings.length > 0 && selected.size === meetings.length}
                      onChange={toggleSelectAll}
                      className="accent-violet-500 cursor-pointer"
                    />
                  </th>
                  <th className="pb-3 pt-4 px-3 font-medium">Title</th>
                  <th className="pb-3 pt-4 px-3 font-medium">Date</th>
                  <th className="pb-3 pt-4 px-3 font-medium">Tags</th>
                  <th className="pb-3 pt-4 px-3 font-medium">Actions</th>
                  <th className="pb-3 pt-4 px-3 font-medium">Status</th>
                  <th className="pb-3 pt-4 px-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1f35]">
                {meetings.map((m) => {
                  const tagList = m.tags ? m.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
                  const isSelected = selected.has(m.id);
                  return (
                    <tr
                      key={m.id}
                      className={`hover:bg-[#111223] transition cursor-pointer ${isSelected ? "bg-violet-950/20" : ""}`}
                      onClick={() => router.push(`/meetings/${m.id}`)}
                    >
                      <td className="py-3.5 px-4 w-8" onClick={(e) => { e.stopPropagation(); toggleSelect(m.id); }}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(m.id)}
                          className="accent-violet-500 cursor-pointer" />
                      </td>
                      <td className="py-3.5 px-3">
                        <div>
                          <span className="font-medium text-white hover:text-violet-300 transition">
                            {m.title}
                          </span>
                          {m.transcriptMatch && (
                            <span className="ml-2 text-[10px] text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-900/40">
                              in transcript
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-[#8b8fa8] whitespace-nowrap">
                        {new Date(m.date).toLocaleDateString("en-ZA", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex gap-1 flex-wrap">
                          {tagList.map((tag) => (
                            <button
                              key={tag}
                              onClick={(e) => { e.stopPropagation(); handleTagFilter(tag); }}
                              className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 hover:border-indigo-500 transition"
                            >
                              # {tag}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-[#8b8fa8]">{m._count.actionItems}</td>
                      <td className="py-3.5 px-3">
                        <div className="flex gap-1">
                          {m.hasTranscript && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-950/70 text-violet-300 border border-violet-800/40">T</span>
                          )}
                          {m.hasMinutes && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-800/40">M</span>
                          )}
                          {!m.hasTranscript && !m.hasMinutes && (
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#181929] border border-[#3a3c6a] shadow-xl shadow-black/50">
          <span className="text-sm text-[#c5c7e8] font-medium">
            {selected.size} selected
          </span>
          <button onClick={() => setSelected(new Set())}
            className="text-xs text-[#6b6f8e] hover:text-white transition px-2 py-1 rounded-lg hover:bg-[#252640]">
            Clear
          </button>
          <button onClick={bulkDelete} disabled={bulkDeleting}
            className="text-xs px-4 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white font-medium transition disabled:opacity-50">
            {bulkDeleting ? "Deleting…" : `Delete ${selected.size}`}
          </button>
        </div>
      )}
    </div>
  );
}
