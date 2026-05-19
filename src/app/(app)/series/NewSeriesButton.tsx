"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewSeriesButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const s = await res.json() as { id: string };
      router.push(`/series/${s.id}`);
      router.refresh();
    }
    setSaving(false);
    setOpen(false);
    setName("");
  };

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-sm font-semibold text-white transition shadow-lg shadow-violet-900/30">
        + New Series
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}>
          <div className="bg-[#1a1b2e] border border-[#2f3158] rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-white mb-4">New Meeting Series</h2>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="e.g. Weekly Standup, Sprint Retro…"
              className="w-full bg-[#252640] border border-[#2f3158] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4a4d6a] focus:outline-none focus:border-violet-500 mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg text-sm text-[#8b8fa8] hover:text-white transition">
                Cancel
              </button>
              <button onClick={create} disabled={saving || !name.trim()}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-sm font-medium transition">
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
