"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";

interface ActionItem {
  id: string;
  text: string;
  assignee: string | null;
  priority: string;
  dueDate: string | null;
  done: boolean;
}

interface SharedMeeting {
  id: string;
  title: string;
  date: string;
  attendees: string;
  agenda: string | null;
  minutes: string | null;
  transcript: string | null;
  language: string;
  tags: string;
  actionItems: ActionItem[];
  expiresAt: string | null;
}

const priorityColors: Record<string, string> = {
  high:   "bg-red-950/60 text-red-300 border-red-800/60",
  medium: "bg-amber-950/60 text-amber-300 border-amber-800/60",
  low:    "bg-[#252640] text-[#8b8fa8] border-[#2f3158]",
};

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const [meeting, setMeeting] = useState<SharedMeeting | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"minutes" | "actions" | "transcript">("minutes");

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json();
          setError(d.error ?? "Failed to load");
          return;
        }
        return r.json();
      })
      .then((data) => { if (data) setMeeting(data); });
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#111223] flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-4xl mb-4">{error === "Link expired" ? "⏰" : "🔗"}</p>
          <h1 className="text-xl font-bold text-white mb-2">
            {error === "Link expired" ? "Link Expired" : "Not Found"}
          </h1>
          <p className="text-[#6b6f8e] text-sm">
            {error === "Link expired"
              ? "This share link has expired and is no longer accessible."
              : "This share link is invalid or has been revoked."}
          </p>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-[#111223] flex items-center justify-center">
        <p className="text-[#6b6f8e]">Loading…</p>
      </div>
    );
  }

  const dateStr = new Date(meeting.date).toLocaleDateString("en-ZA", { day: "2-digit", month: "long", year: "numeric" });
  const attendeeList = meeting.attendees ? meeting.attendees.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const tagList = meeting.tags ? meeting.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
  const pendingCount = meeting.actionItems.filter((a) => !a.done).length;

  return (
    <div className="min-h-screen bg-[#111223] text-white">
      {/* Header banner */}
      <div className="bg-[#0d0e1c] border-b border-[#252640] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-violet-400 font-bold text-sm">DAB Meetings</span>
          <span className="text-[#4a4d6a] text-xs">· shared view</span>
        </div>
        {meeting.expiresAt && (
          <span className="text-xs text-[#6b6f8e]">
            Expires {new Date(meeting.expiresAt).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Meeting header */}
        <div>
          <h1 className="text-2xl font-bold text-white">{meeting.title}</h1>
          <p className="text-sm text-[#8b8fa8] mt-1">{dateStr}</p>

          {attendeeList.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-3">
              {attendeeList.map((a) => (
                <span key={a} className="text-xs bg-[#252640] text-[#c5c7e8] px-2 py-0.5 rounded-full border border-[#2f3158]">
                  {a}
                </span>
              ))}
            </div>
          )}

          {tagList.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-2">
              {tagList.map((tag) => (
                <span key={tag} className="text-xs bg-indigo-950/50 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-800/40">
                  # {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[#1e1f35]">
          {([
            ["minutes", "Minutes"],
            ["actions", `Actions (${pendingCount})`],
            ["transcript", "Transcript"],
          ] as [typeof tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 text-sm font-medium border-b-2 transition -mb-px ${
                tab === t ? "border-violet-500 text-white" : "border-transparent text-[#8b8fa8] hover:text-white"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Minutes tab */}
        {tab === "minutes" && (
          <div className="bg-[#181929] rounded-xl p-6 border border-[#252640]">
            {meeting.minutes ? (
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{meeting.minutes}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-[#4a4d6a] italic text-sm">No minutes available.</p>
            )}
          </div>
        )}

        {/* Actions tab */}
        {tab === "actions" && (
          <div className="space-y-2">
            {meeting.actionItems.length === 0 ? (
              <p className="text-[#4a4d6a] italic text-sm py-6 text-center">No action items.</p>
            ) : (
              meeting.actionItems.map((item) => (
                <div key={item.id}
                  className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${
                    item.done ? "bg-[#111223] border-[#1e1f35] opacity-60" : "bg-[#181929] border-[#252640]"
                  }`}>
                  <span className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-[10px] ${
                    item.done ? "border-emerald-700 bg-emerald-900/50 text-emerald-400" : "border-[#3a3c6a]"
                  }`}>
                    {item.done && "✓"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${item.done ? "line-through text-[#6b6f8e]" : "text-white"}`}>{item.text}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {item.assignee && (
                        <span className="text-xs text-[#8b8fa8]">@{item.assignee}</span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border capitalize ${priorityColors[item.priority] ?? priorityColors.medium}`}>
                        {item.priority}
                      </span>
                      {item.dueDate && (
                        <span className="text-[10px] text-[#8b8fa8]">
                          Due {new Date(item.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Transcript tab */}
        {tab === "transcript" && (
          <div className="bg-[#181929] rounded-xl p-5 text-sm text-[#c5c7e8] leading-relaxed whitespace-pre-wrap border border-[#252640] min-h-48">
            {meeting.transcript || (
              <span className="text-[#4a4d6a] italic">No transcript available.</span>
            )}
          </div>
        )}

        <p className="text-center text-xs text-[#4a4d6a] pt-4 border-t border-[#1e1f35]">
          Generated by DAB Meetings · Read-only shared view
        </p>
      </div>
    </div>
  );
}
