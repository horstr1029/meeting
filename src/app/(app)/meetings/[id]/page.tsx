"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { useMinutesStream, parseActionItems } from "@/hooks/useMinutesStream";

type Tab = "transcript" | "minutes" | "actions";
type Language = "english" | "afrikaans";
type Priority = "high" | "medium" | "low";
type ActionFilter = "all" | "todo" | "done" | "high";

interface ActionItem {
  id: string;
  text: string;
  assignee: string | null;
  priority: string;
  done: boolean;
}

interface Meeting {
  id: string;
  title: string;
  date: string;
  transcript: string | null;
  minutes: string | null;
  language: string;
  attendees: string;
  agenda: string | null;
  actionItems: ActionItem[];
}

const priorityStyles: Record<Priority, string> = {
  high: "bg-red-900 text-red-300 border-red-800",
  medium: "bg-yellow-900 text-yellow-300 border-yellow-800",
  low: "bg-gray-800 text-gray-400 border-gray-700",
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
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [reading, setReading] = useState(false);

  // Action items
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>("medium");
  const [addingTask, setAddingTask] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Metadata
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [attendeesDraft, setAttendeesDraft] = useState("");
  const [agendaDraft, setAgendaDraft] = useState("");
  const [editingMeta, setEditingMeta] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);

  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  const loadMeeting = useCallback(async () => {
    const res = await fetch(`/api/meetings/${id}`);
    if (!res.ok) { router.push("/dashboard"); return; }
    const data: Meeting = await res.json();
    setMeeting(data);
    setTitleDraft(data.title);
    setAttendeesDraft(data.attendees ?? "");
    setAgendaDraft(data.agenda ?? "");
    setTranscriptDraft(data.transcript ?? "");
    if (data.minutes) setMinutes(data.minutes);
    setMinutesDraft(data.minutes ?? "");
    setActionItems(data.actionItems);
    setLoading(false);
  }, [id, router, setMinutes]);

  useEffect(() => { loadMeeting(); }, [loadMeeting]);

  // Auto-save minutes after streaming completes
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

  const saveMeta = async () => {
    setSavingMeta(true);
    await fetch(`/api/meetings/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendees: attendeesDraft, agenda: agendaDraft }),
    });
    setMeeting((m) => m ? { ...m, attendees: attendeesDraft, agenda: agendaDraft } : m);
    setEditingMeta(false);
    setSavingMeta(false);
  };

  const generateMinutes = () => {
    generate(meeting!.transcript ?? "", language, {
      attendees: meeting!.attendees,
      agenda: meeting!.agenda ?? "",
      customPrompt: customPrompt.trim() || undefined,
    });
    setTab("minutes");
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
      if (parsed.length === 0) { setExtractError("No action items found."); return; }

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
    setActionItems((prev) => prev.map((a) => a.id === item.id ? { ...a, done: !a.done } : a));
  };

  const deleteAction = async (itemId: string) => {
    await fetch(`/api/meetings/${id}/actions?id=${itemId}`, { method: "DELETE" });
    setActionItems((prev) => prev.filter((a) => a.id !== itemId));
  };

  const clearDone = async () => {
    await fetch(`/api/meetings/${id}/actions?clearDone=1`, { method: "DELETE" });
    setActionItems((prev) => prev.filter((a) => !a.done));
  };

  const addTask = async () => {
    if (!newTaskText.trim()) return;
    setAddingTask(true);
    const res = await fetch(`/api/meetings/${id}/actions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newTaskText, assignee: newTaskAssignee, priority: newTaskPriority }),
    });
    const item: ActionItem = await res.json();
    setActionItems((prev) => [...prev, item]);
    setNewTaskText("");
    setNewTaskAssignee("");
    setNewTaskPriority("medium");
    setAddingTask(false);
    setShowAddForm(false);
  };

  const readAloud = () => {
    if (!minutes) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(minutes.replace(/[#*`_[\]()]/g, ""));
    utterance.lang = language === "afrikaans" ? "af-ZA" : "en-US";
    utterance.onend = () => setReading(false);
    utterance.onerror = () => setReading(false);
    speechRef.current = utterance;
    setReading(true);
    window.speechSynthesis.speak(utterance);
  };

  const stopReading = () => {
    window.speechSynthesis.cancel();
    setReading(false);
  };

  const filteredActions = actionItems.filter((a) => {
    if (actionFilter === "todo") return !a.done;
    if (actionFilter === "done") return a.done;
    if (actionFilter === "high") return a.priority === "high" && !a.done;
    return true;
  });

  const af = language === "afrikaans";

  if (loading) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading…</div>;
  }
  if (!meeting) return null;

  const wordCount = (meeting.transcript ?? "").trim().split(/\s+/).filter(Boolean).length;
  const attendeeList = meeting.attendees ? meeting.attendees.split(",").map((s) => s.trim()).filter(Boolean) : [];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="px-8 py-4 border-b border-gray-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/dashboard")} className="text-gray-400 hover:text-white text-sm transition">
              ← Dashboard
            </button>
            {titleEditing ? (
              <div className="flex items-center gap-2">
                <input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setTitleEditing(false); }}
                  className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1 text-white text-lg font-bold focus:outline-none focus:border-blue-500"
                  autoFocus />
                <button onClick={saveTitle} className="text-xs text-blue-400 hover:text-blue-300">Save</button>
                <button onClick={() => setTitleEditing(false)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
              </div>
            ) : (
              <h1 className="text-xl font-bold cursor-pointer hover:text-blue-300 transition" onClick={() => setTitleEditing(true)} title="Click to edit">
                {meeting.title}
              </h1>
            )}
          </div>
          <div className="flex items-center gap-3">
            <select value={language} onChange={(e) => setLanguage(e.target.value as Language)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white">
              <option value="english">English</option>
              <option value="afrikaans">Afrikaans</option>
            </select>
            <Link href={`/meetings/${id}/export`} className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition">
              Export
            </Link>
          </div>
        </div>

        {/* Metadata row */}
        <div className="flex items-start gap-4 flex-wrap">
          {editingMeta ? (
            <div className="flex-1 space-y-2">
              <input value={attendeesDraft} onChange={(e) => setAttendeesDraft(e.target.value)}
                placeholder="Attendees (comma-separated)"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500" />
              <textarea value={agendaDraft} onChange={(e) => setAgendaDraft(e.target.value)}
                placeholder="Agenda / notes…" rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 resize-none" />
              <div className="flex gap-2">
                <button onClick={saveMeta} disabled={savingMeta}
                  className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition">
                  {savingMeta ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setEditingMeta(false)} className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap flex-1">
              <p className="text-xs text-gray-500">{new Date(meeting.date).toLocaleDateString()}</p>
              {attendeeList.length > 0 ? (
                <div className="flex gap-1 flex-wrap">
                  {attendeeList.map((a) => (
                    <span key={a} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full border border-gray-700">{a}</span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-gray-600 italic">No attendees set</span>
              )}
              {meeting.agenda && (
                <span className="text-xs text-gray-500 truncate max-w-xs" title={meeting.agenda}>📋 {meeting.agenda}</span>
              )}
              <button onClick={() => setEditingMeta(true)} className="text-xs text-gray-500 hover:text-gray-300 transition">
                {attendeeList.length === 0 && !meeting.agenda ? "+ Add attendees & agenda" : "Edit"}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 px-8 pt-4 border-b border-gray-800">
        {(["transcript", "minutes", "actions"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 text-sm font-medium border-b-2 transition -mb-px ${
              tab === t ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-white"
            }`}>
            {t === "transcript" ? (af ? "Transkripsie" : "Transcript")
              : t === "minutes" ? (af ? "Notule" : "Minutes")
              : (af ? "Aksie-items" : "Action Items")}
            {t === "actions" && actionItems.length > 0 && (
              <span className="ml-2 text-xs bg-blue-700 text-white rounded-full px-1.5 py-0.5">
                {actionItems.filter((a) => !a.done).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <main className="max-w-4xl mx-auto px-8 py-6">

        {/* ── TRANSCRIPT TAB ── */}
        {tab === "transcript" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{wordCount} {af ? "woorde" : "words"}</p>
              <div className="flex gap-2">
                <button onClick={() => navigator.clipboard.writeText(meeting.transcript ?? "")}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition">
                  {af ? "Kopieer" : "Copy"}
                </button>
                <button onClick={() => { setEditingTranscript(!editingTranscript); setTranscriptDraft(meeting.transcript ?? ""); }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition">
                  {editingTranscript ? (af ? "Kanselleer" : "Cancel") : (af ? "Wysig" : "Edit")}
                </button>
              </div>
            </div>

            {editingTranscript ? (
              <div className="space-y-2">
                <textarea value={transcriptDraft} onChange={(e) => setTranscriptDraft(e.target.value)}
                  className="w-full h-96 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 resize-none focus:outline-none focus:border-blue-500" />
                <button onClick={saveTranscript}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium transition">
                  {af ? "Stoor" : "Save"}
                </button>
              </div>
            ) : (
              <div className="bg-gray-900 rounded-xl p-5 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap min-h-48">
                {meeting.transcript || <span className="text-gray-600 italic">{af ? "Geen transkripsie nog nie." : "No transcript yet."}</span>}
              </div>
            )}

            {meeting.transcript && (
              <div className="space-y-2">
                {/* Custom prompt toggle */}
                <button onClick={() => setShowPromptEditor(!showPromptEditor)}
                  className="text-xs text-gray-500 hover:text-gray-300 transition">
                  {showPromptEditor ? "▲ Hide custom prompt" : "▼ Custom prompt (optional)"}
                </button>
                {showPromptEditor && (
                  <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder={af
                      ? "Skryf jou eie instruksies hier... (laat leeg vir standaard notule)"
                      : "Write your own instructions here… (leave blank for standard minutes)"}
                    rows={4}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 resize-none focus:outline-none focus:border-blue-500 font-mono" />
                )}
                <button onClick={generateMinutes}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold transition">
                  {af ? "Genereer Notule →" : "Generate Minutes →"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── MINUTES TAB ── */}
        {tab === "minutes" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-2 flex-wrap">
                <button onClick={generateMinutes} disabled={streaming || !meeting.transcript}
                  className="text-sm px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition font-medium">
                  {streaming ? (af ? "Genereer…" : "Generating…") : (af ? "Genereer Notule" : "Generate Minutes")}
                </button>
                {minutes && !streaming && (
                  <>
                    <button onClick={() => { setEditingMinutes(!editingMinutes); setMinutesDraft(minutes); }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition">
                      {editingMinutes ? (af ? "Kanselleer" : "Cancel") : (af ? "Wysig" : "Edit")}
                    </button>
                    <button onClick={() => navigator.clipboard.writeText(minutes)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition">
                      {af ? "Kopieer" : "Copy"}
                    </button>
                    <button onClick={reading ? stopReading : readAloud}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition ${reading ? "border-red-700 bg-red-950 text-red-300" : "bg-gray-800 hover:bg-gray-700 border-gray-700"}`}>
                      {reading ? "⏹ Stop" : "🔊 Read aloud"}
                    </button>
                  </>
                )}
              </div>
            </div>

            {minutesError && <p className="text-sm text-red-400 bg-red-950 px-3 py-2 rounded-lg">{minutesError}</p>}

            {editingMinutes ? (
              <div className="space-y-2">
                <textarea value={minutesDraft} onChange={(e) => setMinutesDraft(e.target.value)}
                  className="w-full h-96 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 resize-none focus:outline-none focus:border-blue-500 font-mono" />
                <button onClick={saveMinutes} disabled={savingMinutes}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium disabled:opacity-50 transition">
                  {savingMinutes ? (af ? "Stoor…" : "Saving…") : (af ? "Stoor" : "Save")}
                </button>
              </div>
            ) : (
              <div className="bg-gray-900 rounded-xl p-5 prose prose-invert prose-sm max-w-none min-h-48">
                {minutes ? (
                  <ReactMarkdown>{minutes}</ReactMarkdown>
                ) : (
                  <p className="text-gray-600 italic text-sm">
                    {streaming ? (af ? "Genereer…" : "Generating…") : (af ? "Geen notule nog nie." : "No minutes yet. Click Generate Minutes above.")}
                  </p>
                )}
              </div>
            )}

            {minutes && !streaming && (
              <button onClick={extractActions} disabled={extracting}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 font-semibold transition">
                {extracting ? (af ? "Onttrek…" : "Extracting…") : (af ? "Onttrek Aksie-items →" : "Extract Action Items →")}
              </button>
            )}
            {extractError && <p className="text-sm text-red-400 bg-red-950 px-3 py-2 rounded-lg">{extractError}</p>}
          </div>
        )}

        {/* ── ACTION ITEMS TAB ── */}
        {tab === "actions" && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-1">
                {([
                  ["all", af ? "Almal" : "All"],
                  ["todo", af ? "Te Doen" : "To Do"],
                  ["done", af ? "Klaar" : "Done"],
                  ["high", af ? "Hoog" : "High"],
                ] as [ActionFilter, string][]).map(([f, label]) => (
                  <button key={f} onClick={() => setActionFilter(f)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                      actionFilter === f ? "border-blue-500 bg-blue-950 text-blue-300" : "border-gray-700 text-gray-400 hover:border-gray-500"
                    }`}>
                    {label}
                    {f === "all" && <span className="ml-1 text-gray-500">({actionItems.length})</span>}
                    {f === "todo" && <span className="ml-1 text-gray-500">({actionItems.filter((a) => !a.done).length})</span>}
                    {f === "done" && <span className="ml-1 text-gray-500">({actionItems.filter((a) => a.done).length})</span>}
                    {f === "high" && <span className="ml-1 text-gray-500">({actionItems.filter((a) => a.priority === "high" && !a.done).length})</span>}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {actionItems.some((a) => a.done) && (
                  <button onClick={clearDone}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:border-red-700 hover:text-red-400 transition">
                    {af ? "Vee Klaar Uit" : "Clear Done"}
                  </button>
                )}
                {minutes && (
                  <button onClick={extractActions} disabled={extracting}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 transition">
                    {extracting ? (af ? "Onttrek…" : "Extracting…") : (af ? "Herwin" : "Re-extract")}
                  </button>
                )}
                <button onClick={() => setShowAddForm(!showAddForm)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 transition">
                  + {af ? "Voeg By" : "Add Task"}
                </button>
              </div>
            </div>

            {extractError && <p className="text-sm text-red-400 bg-red-950 px-3 py-2 rounded-lg">{extractError}</p>}

            {/* Add task form */}
            {showAddForm && (
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 space-y-3">
                <input value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTask()}
                  placeholder={af ? "Taakbeskrywing…" : "Task description…"}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                <div className="flex gap-2">
                  <input value={newTaskAssignee} onChange={(e) => setNewTaskAssignee(e.target.value)}
                    placeholder={af ? "Toegewys aan…" : "Assignee…"}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                  <select value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value as Priority)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                    <option value="high">{af ? "Hoog" : "High"}</option>
                    <option value="medium">{af ? "Medium" : "Medium"}</option>
                    <option value="low">{af ? "Laag" : "Low"}</option>
                  </select>
                  <button onClick={addTask} disabled={addingTask || !newTaskText.trim()}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition">
                    {addingTask ? "…" : af ? "Voeg By" : "Add"}
                  </button>
                </div>
              </div>
            )}

            {filteredActions.length === 0 && actionItems.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <p className="text-lg">{af ? "Geen aksie-items nog nie." : "No action items yet."}</p>
                <p className="text-sm mt-2">{af ? "Genereer notule eers, dan onttrek aksie-items." : "Generate minutes first, then extract action items."}</p>
                <button onClick={() => setTab("minutes")} className="mt-4 text-sm text-blue-400 hover:underline">
                  {af ? "Gaan na Notule →" : "Go to Minutes →"}
                </button>
              </div>
            ) : filteredActions.length === 0 ? (
              <p className="text-center py-8 text-gray-500 text-sm">{af ? "Geen items vir hierdie filter." : "No items match this filter."}</p>
            ) : (
              <ul className="space-y-2">
                {filteredActions.map((item) => {
                  const p = (item.priority || "medium") as Priority;
                  return (
                    <li key={item.id}
                      className={`flex items-start gap-3 p-4 rounded-xl border transition ${
                        item.done ? "border-gray-800 opacity-50" : "border-gray-700 bg-gray-900"
                      }`}>
                      <button onClick={() => toggleAction(item)}
                        className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition ${
                          item.done ? "bg-green-600 border-green-600" : "border-gray-500 hover:border-green-500"
                        }`}>
                        {item.done && <span className="text-white text-xs">✓</span>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${item.done ? "line-through text-gray-500" : "text-gray-200"}`}>{item.text}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${priorityStyles[p] ?? priorityStyles.medium}`}>
                            {p}
                          </span>
                          {item.assignee && <span className="text-xs text-gray-500">→ {item.assignee}</span>}
                        </div>
                      </div>
                      <button onClick={() => deleteAction(item.id)}
                        className="text-gray-600 hover:text-red-400 transition text-xs mt-0.5 flex-shrink-0">
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
