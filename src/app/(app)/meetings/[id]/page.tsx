"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { useMinutesStream, parseActionItems } from "@/hooks/useMinutesStream";

type Tab = "transcript" | "minutes" | "actions";
type Language = "english" | "afrikaans";
type Priority = "high" | "medium" | "low";

interface ActionItem {
  id: string;
  text: string;
  assignee: string | null;
  done: boolean;
}

interface Meeting {
  id: string;
  title: string;
  date: string;
  transcript: string | null;
  minutes: string | null;
  language: string;
  actionItems: ActionItem[];
}

const priorityColors: Record<Priority, string> = {
  high: "bg-red-900 text-red-300",
  medium: "bg-yellow-900 text-yellow-300",
  low: "bg-gray-800 text-gray-400",
};

export default function MeetingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("transcript");
  const [language, setLanguage] = useState<Language>("english");

  // Transcript
  const [editingTranscript, setEditingTranscript] = useState(false);
  const [transcriptDraft, setTranscriptDraft] = useState("");

  // Minutes
  const { minutes, setMinutes, streaming, error: minutesError, generate } = useMinutesStream();
  const [editingMinutes, setEditingMinutes] = useState(false);
  const [minutesDraft, setMinutesDraft] = useState("");
  const [savingMinutes, setSavingMinutes] = useState(false);

  // Action items
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const loadMeeting = useCallback(async () => {
    const res = await fetch(`/api/meetings/${id}`);
    if (!res.ok) { router.push("/dashboard"); return; }
    const data: Meeting = await res.json();
    setMeeting(data);
    setTitleDraft(data.title);
    setTranscriptDraft(data.transcript ?? "");
    if (data.minutes) setMinutes(data.minutes);
    setMinutesDraft(data.minutes ?? "");
    setActionItems(data.actionItems);
    setLoading(false);
  }, [id, router, setMinutes]);

  useEffect(() => { loadMeeting(); }, [loadMeeting]);

  // Auto-save minutes while streaming
  useEffect(() => {
    if (!streaming && minutes && meeting) {
      fetch(`/api/meetings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes }),
      });
      setMinutesDraft(minutes);
    }
  }, [streaming, minutes, id, meeting]);

  const saveTranscript = async () => {
    await fetch(`/api/meetings/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: transcriptDraft }),
    });
    setMeeting((m) => m ? { ...m, transcript: transcriptDraft } : m);
    setEditingTranscript(false);
  };

  const saveMinutes = async () => {
    setSavingMinutes(true);
    await fetch(`/api/meetings/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutes: minutesDraft }),
    });
    setMinutes(minutesDraft);
    setEditingMinutes(false);
    setSavingMinutes(false);
  };

  const saveTitle = async () => {
    await fetch(`/api/meetings/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleDraft }),
    });
    setMeeting((m) => m ? { ...m, title: titleDraft } : m);
    setTitleEditing(false);
  };

  const extractActions = async () => {
    if (!minutes) return;
    setExtracting(true);
    setExtractError(null);

    const prompt = `Review these meeting minutes and identify every specific commitment or action item.
For EVERY item found, create a single line using this EXACT format:
TASK: [The action] | WHO: [Person] | PRIORITY: [high, medium, or low]

Meeting Minutes:
${minutes}

Only output TASK lines. No other text.`;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, stream: false }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Collect full non-streaming response
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let raw = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split("\n")) {
          if (!line.trim()) continue;
          try { raw += JSON.parse(line).response ?? ""; } catch { /* skip */ }
        }
      }

      const parsed = parseActionItems(raw);
      if (parsed.length === 0) {
        setExtractError("No action items found in the minutes.");
        return;
      }

      await fetch(`/api/meetings/${id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: parsed }),
      });

      await loadMeeting();
      setTab("actions");
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  const toggleAction = async (item: ActionItem) => {
    await fetch(`/api/meetings/${id}/actions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionItemId: item.id, done: !item.done }),
    });
    setActionItems((prev) =>
      prev.map((a) => (a.id === item.id ? { ...a, done: !a.done } : a))
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        Loading…
      </div>
    );
  }

  if (!meeting) return null;

  const wordCount = (meeting.transcript ?? "").trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} className="text-gray-400 hover:text-white text-sm transition">
            ← Dashboard
          </button>
          {titleEditing ? (
            <div className="flex items-center gap-2">
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setTitleEditing(false); }}
                className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1 text-white text-lg font-bold focus:outline-none focus:border-blue-500"
                autoFocus
              />
              <button onClick={saveTitle} className="text-xs text-blue-400 hover:text-blue-300">Save</button>
              <button onClick={() => setTitleEditing(false)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
            </div>
          ) : (
            <h1
              className="text-xl font-bold cursor-pointer hover:text-blue-300 transition"
              onClick={() => setTitleEditing(true)}
              title="Click to edit title"
            >
              {meeting.title}
            </h1>
          )}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
          >
            <option value="english">English</option>
            <option value="afrikaans">Afrikaans</option>
          </select>
          <Link
            href={`/meetings/${id}/export`}
            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition"
          >
            Export
          </Link>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 px-8 pt-4">
        {(["transcript", "minutes", "actions"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-t-lg text-sm font-medium border-b-2 transition ${
              tab === t
                ? "border-blue-500 text-white"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            {t === "transcript"
              ? language === "afrikaans" ? "Transkripsie" : "Transcript"
              : t === "minutes"
              ? language === "afrikaans" ? "Notule" : "Minutes"
              : language === "afrikaans" ? "Aksie-items" : "Action Items"}
            {t === "actions" && actionItems.length > 0 && (
              <span className="ml-2 text-xs bg-blue-700 text-white rounded-full px-1.5 py-0.5">
                {actionItems.filter((a) => !a.done).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <main className="max-w-4xl mx-auto px-8 py-6">

        {/* TRANSCRIPT TAB */}
        {tab === "transcript" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{wordCount} words</p>
              <div className="flex gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(meeting.transcript ?? "")}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
                >
                  Copy
                </button>
                <button
                  onClick={() => { setEditingTranscript(!editingTranscript); setTranscriptDraft(meeting.transcript ?? ""); }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
                >
                  {editingTranscript ? "Cancel" : "Edit"}
                </button>
              </div>
            </div>

            {editingTranscript ? (
              <div className="space-y-2">
                <textarea
                  value={transcriptDraft}
                  onChange={(e) => setTranscriptDraft(e.target.value)}
                  className="w-full h-96 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 resize-none focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={saveTranscript}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium transition"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="bg-gray-900 rounded-xl p-5 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap min-h-48">
                {meeting.transcript || <span className="text-gray-600 italic">No transcript yet.</span>}
              </div>
            )}

            {meeting.transcript && (
              <button
                onClick={() => { generate(meeting.transcript!, language); setTab("minutes"); }}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold transition"
              >
                {language === "afrikaans" ? "Genereer Notule" : "Generate Minutes"} →
              </button>
            )}
          </div>
        )}

        {/* MINUTES TAB */}
        {tab === "minutes" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => generate(meeting.transcript ?? "", language)}
                  disabled={streaming || !meeting.transcript}
                  className="text-sm px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition font-medium"
                >
                  {streaming
                    ? language === "afrikaans" ? "Genereer…" : "Generating…"
                    : language === "afrikaans" ? "Genereer Notule" : "Generate Minutes"}
                </button>
                {minutes && !streaming && (
                  <>
                    <button
                      onClick={() => { setEditingMinutes(!editingMinutes); setMinutesDraft(minutes); }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
                    >
                      {editingMinutes ? "Cancel" : "Edit"}
                    </button>
                    <button
                      onClick={() => navigator.clipboard.writeText(minutes)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
                    >
                      Copy
                    </button>
                  </>
                )}
              </div>
            </div>

            {minutesError && (
              <p className="text-sm text-red-400 bg-red-950 px-3 py-2 rounded-lg">{minutesError}</p>
            )}

            {editingMinutes ? (
              <div className="space-y-2">
                <textarea
                  value={minutesDraft}
                  onChange={(e) => setMinutesDraft(e.target.value)}
                  className="w-full h-96 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 resize-none focus:outline-none focus:border-blue-500 font-mono"
                />
                <button
                  onClick={saveMinutes}
                  disabled={savingMinutes}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium disabled:opacity-50 transition"
                >
                  {savingMinutes ? "Saving…" : "Save"}
                </button>
              </div>
            ) : (
              <div className="bg-gray-900 rounded-xl p-5 prose prose-invert prose-sm max-w-none min-h-48">
                {minutes ? (
                  <ReactMarkdown>{minutes}</ReactMarkdown>
                ) : (
                  <p className="text-gray-600 italic text-sm">
                    {streaming ? "Generating…" : language === "afrikaans" ? "Geen notule nog nie." : "No minutes yet. Click Generate Minutes above."}
                  </p>
                )}
              </div>
            )}

            {minutes && !streaming && (
              <button
                onClick={extractActions}
                disabled={extracting}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 font-semibold transition"
              >
                {extracting
                  ? language === "afrikaans" ? "Onttrek…" : "Extracting…"
                  : language === "afrikaans" ? "Onttrek Aksie-items" : "Extract Action Items"} →
              </button>
            )}
            {extractError && (
              <p className="text-sm text-red-400 bg-red-950 px-3 py-2 rounded-lg">{extractError}</p>
            )}
          </div>
        )}

        {/* ACTION ITEMS TAB */}
        {tab === "actions" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">
                {actionItems.filter((a) => !a.done).length} of {actionItems.length} remaining
              </p>
              {minutes && (
                <button
                  onClick={extractActions}
                  disabled={extracting}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 transition"
                >
                  {extracting ? "Extracting…" : "Re-extract"}
                </button>
              )}
            </div>

            {extractError && (
              <p className="text-sm text-red-400 bg-red-950 px-3 py-2 rounded-lg">{extractError}</p>
            )}

            {actionItems.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <p className="text-lg">No action items yet.</p>
                <p className="text-sm mt-2">Generate minutes first, then extract action items.</p>
                <button
                  onClick={() => setTab("minutes")}
                  className="mt-4 text-sm text-blue-400 hover:underline"
                >
                  Go to Minutes →
                </button>
              </div>
            ) : (
              <ul className="space-y-2">
                {actionItems.map((item) => (
                  <li
                    key={item.id}
                    className={`flex items-start gap-3 p-4 rounded-xl border transition ${
                      item.done ? "border-gray-800 opacity-50" : "border-gray-700 bg-gray-900"
                    }`}
                  >
                    <button
                      onClick={() => toggleAction(item)}
                      className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition ${
                        item.done ? "bg-green-600 border-green-600" : "border-gray-500 hover:border-green-500"
                      }`}
                    >
                      {item.done && <span className="text-white text-xs">✓</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${item.done ? "line-through text-gray-500" : "text-gray-200"}`}>
                        {item.text}
                      </p>
                      {item.assignee && (
                        <p className="text-xs text-gray-500 mt-0.5">→ {item.assignee}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
