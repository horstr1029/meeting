"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  seriesId: string;
  seriesName: string;
  lastAgenda: string;
  carryForwardText: string;
}

export function SeriesControls({ seriesId, seriesName, lastAgenda, carryForwardText }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleNewMeeting = () => {
    const parts: string[] = [];
    if (lastAgenda) parts.push(lastAgenda);
    if (carryForwardText) {
      parts.push(`\nCarry-forward items:\n${carryForwardText}`);
    }
    const agenda = parts.join("\n").trim();
    const params = new URLSearchParams({
      title: seriesName,
      seriesId,
      ...(agenda ? { agenda } : {}),
    });
    router.push(`/record?${params.toString()}`);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete series "${seriesName}"? Meetings will not be deleted.`)) return;
    setDeleting(true);
    await fetch(`/api/series/${seriesId}`, { method: "DELETE" });
    router.push("/series");
    router.refresh();
  };

  return (
    <div className="flex gap-2 flex-shrink-0">
      <button onClick={handleNewMeeting}
        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-sm font-semibold text-white transition shadow-lg shadow-violet-900/30">
        + New meeting
      </button>
      <button onClick={handleDelete} disabled={deleting}
        className="px-3 py-2.5 rounded-xl bg-[#181929] hover:bg-red-950/40 border border-[#252640] hover:border-red-900/50 text-sm text-[#6b6f8e] hover:text-red-400 disabled:opacity-50 transition">
        {deleting ? "…" : "Delete series"}
      </button>
    </div>
  );
}
