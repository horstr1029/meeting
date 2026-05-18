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
  dueDate: string | null;
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
  tags: string;
  actionItems: ActionItem[];
}

const priorityStyles: Record<Priority, string> = {
  high:   "bg-red-950/60 text-red-300 border-red-800/60",
  medium: "bg-amber-950/60 text-amber-300 border-amber-800/60",
  low:    "bg-[#252640] text-[#8b8fa8] border-[#2f3158]",
};

const inputCls = "w-full bg-[#252640] border border-[#2f3158] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-violet-500";

export default function MeetingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("transcript");
  const [language, setLanguage] = useState<Language>("english");

  const [editingTranscript, setEditingTranscript] = useState(false);
  const [transcriptDraft, setTranscriptDraft] = useState("");

  const { minutes, setMinutes, streaming, error: minutesError, generate } = useMinutesStream();
  const [editingMinutes, setEditingMinutes] = useState(false);
  const [minutesDraft, setMinutesDraft] = useState("");
  const [savingMinutes, setSavingMinutes] = useState(false);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [reading, setReading] = useState(false);

  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>("medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [attendeesDraft, setAttendeesDraft] = useState("");
  const [agendaDraft, setAgendaDraft] = useState("");
  const [editingMeta, setEditingMeta] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);

  // Tags
  const [newTag, setNewTag] = useState("");

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
      body: JSON.stringify({
        text: newTaskText,
        assignee: newTaskAssignee,
        priority: newTaskPriority,
        dueDate: newTaskDueDate || undefined,
      }),
    });
    const item: ActionItem = await res.json();
    setActionItems((prev) => [...prev, item]);
    setNewTaskText("");
    setNewTaskAssignee("");
    setNewTaskPriority("medium");
    setNewTaskDueDate("");
    setAddingTask(false);
    setShowAddForm(false);
  };

  const addTag = async (tag: string) => {
    const clean = tag.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!clean || !meeting) return;
    const existing = meeting.tags ? meeting.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
    if (existing.includes(clean)) return;
    const updated = [...existing, clean].join(", ");
    await fetch(`/api/meetings/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: updated }),
    });
    setMeeting((m) => m ? { ...m, tags: updated } : m);
    setNewTag("");
  };

  const removeTag = async (tag: string) => {
    if (!meeting) return;
    const updated = meeting.tags.split(",").map((t) => t.trim()).filter((t) => t && t !== tag).join(", ");
    await fetch(`/api/meetings/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: updated }),
    });
    setMeeting((m) => m ? { ...m, tags: updated } : m);
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
    return <div className="flex items-center justify-center py-20 text-[#8b8fa8]">Loading…</div>;
  }
  if (!meeting) return null;

  const wordCount = (meeting.transcript ?? "").trim().split(/\s+/).filter(Boolean).length;
  const attendeeList = meeting.attendees ? meeting.attendees.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const tagList = meeting.tags ? meeting.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
  const today = new Date(); today.setHours(0, 0, 0, 0);

  return (
    <div className="min-h-full">
      {/* Meeting header */}
      <div className="px-8 pt-6 pb-0 space-y-3 border-b border-[#1e1f35]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            {titleEditing ? (
              <div className="flex items-center gap-2">
                <input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setTitleEditing(false); }}
                  className="bg-[#252640] border border-[#3a3c6a] rounded-lg px-3 py-1 text-white text-lg font-bold focus:outline-none focus:border-violet-500"
                  autoFocus
                />
                <button onClick={saveTitle} className="text-xs text-violet-400 hover:text-violet-300">Save</button>
                <button onClick={() => setTitleEditing(false)} className="text-xs text-[#6b6f8e] hover:text-[#c5c7e8]">Cancel</button>
              </div>
            ) : (
              <h1
                className="text-xl font-bold text-white cursor-pointer hover:text-violet-300 transition truncate"
                onClick={() => setTitleEditing(true)}
                title="Click to edit"
              >
                {meeting.title}
              </h1>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 ml-4">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="bg-[#252640] border border-[#2f3158] rounded-lg px-3 py-1.5 text-sm text-white"
            >
              <option value="english">English</option>
              <option value="afrikaans">Afrikaans</option>
            </select>
            <Link
              href={`/meetings/${id}/export`}
              className="px-3 py-1.5 rounded-lg bg-[#252640] hover:bg-[#2f3158] text-sm text-[#c5c7e8] transition"
            >
              Export
            </Link>
          </div>
        </div>

        {/* Metadata row */}
        <div className="flex items-start gap-4 flex-wrap pb-3">
          {editingMeta ? (
            <div className="flex-1 space-y-2">
              <input value={attendeesDraft} onChange={(e) => setAttendeesDraft(e.target.value)}
                placeholder="Attendees (comma-separated)"
                className={inputCls} />
              <textarea value={agendaDraft} onChange={(e) => setAgendaDraft(e.target.value)}
                placeholder="Agenda / notes…" rows={2}
                className="w-full bg-[#252640] border border-[#2f3158] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-violet-500 resize-none" />
              <div className="flex gap-2">
                <button onClick={saveMeta} disabled={savingMeta}
                  className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 transition">
                  {savingMeta ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setEditingMeta(false)} className="text-xs px-3 py-1.5 rounded-lg bg-[#252640] hover:bg-[#2f3158] transition">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap flex-1">
              <p className="text-xs text-[#6b6f8e]">{new Date(meeting.date).toLocaleDateString()}</p>
              {attendeeList.length > 0 ? (
                <div className="flex gap-1 flex-wrap">
                  {attendeeList.map((a) => (
                    <span key={a} className="text-xs bg-[#252640] text-[#c5c7e8] px-2 py-0.5 rounded-full border border-[#2f3158]">{a}</span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-[#4a4d6a] italic">No attendees set</span>
              )}
              {meeting.agenda && (
                <span className="text-xs text-[#6b6f8e] truncate max-w-xs" title={meeting.agenda}>📋 {meeting.agenda}</span>
              )}
              <button onClick={() => setEditingMeta(true)} className="text-xs text-[#6b6f8e] hover:text-[#c5c7e8] transition">
                {attendeeList.length === 0 && !meeting.agenda ? "+ Add attendees & agenda" : "Edit"}
              </button>
            </div>
          )}

          {/* Tags row */}
          <div className="flex items-center gap-2 flex-wrap pb-1">
            {tagList.map((tag) => (
              <span key={tag} className="flex items-center gap-1 text-xs bg-indigo-950/50 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-800/40">
                # {tag}
                <button onClick={() => removeTag(tag)} className="text-indigo-500 hover:text-red-400 transition ml-0.5">×</button>
              </span>
            ))}
            <form onSubmit={(e) => { e.preventDefault(); addTag(newTag); }} className="flex items-center">
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="+ add tag"
                className="text-xs bg-transparent text-[#6b6f8e] placeholder-[#3a3d5a] focus:outline-none w-16 focus:w-24 transition-all"
              />
            </form>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {(["transcript", "minutes", "actions"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 text-sm font-medium border-b-2 transition -mb-px ${
                tab === t ? "border-violet-500 text-white" : "border-transparent text-[#8b8fa8] hover:text-white"
              }`}>
              {t === "transcript" ? (af ? "Transkripsie" : "Transcript")
                : t === "minutes" ? (af ? "Notule" : "Minutes")
                : (af ? "Aksie-items" : "Action Items")}
              {t === "actions" && actionItems.length > 0 && (
                <span className="ml-2 text-xs bg-violet-700 text-white rounded-full px-1.5 py-0.5">
                  {actionItems.filter((a) => !a.done).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-8 py-6">

        {/* ── TRANSCRIPT TAB ── */}
        {tab === "transcript" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#8b8fa8]">{wordCount} {af ? "woorde" : "words"}</p>
              <div className="flex gap-2">
                <button onClick={() => navigator.clipboard.writeText(meeting.transcript ?? "")}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[#252640] hover:bg-[#2f3158] transition text-[#c5c7e8]">
                  {af ? "Kopieer" : "Copy"}
                </button>
                <button onClick={() => { setEditingTranscript(!editingTranscript); setTranscriptDraft(meeting.transcript ?? ""); }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[#252640] hover:bg-[#2f3158] transition text-[#c5c7e8]">
                  {editingTranscript ? (af ? "Kanselleer" : "Cancel") : (af ? "Wysig" : "Edit")}
                </button>
              </div>
            </div>

            {editingTranscript ? (
              <div className="space-y-2">
                <textarea value={transcriptDraft} onChange={(e) => setTranscriptDraft(e.target.value)}
                  className="w-full h-96 bg-[#181929] border border-[#252640] rounded-xl px-4 py-3 text-sm text-[#d4d6f0] resize-none focus:outline-none focus:border-violet-500" />
                <button onClick={saveTranscript}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-sm font-medium transition">
                  {af ? "Stoor" : "Save"}
                </button>
              </div>
            ) : (
              <div className="bg-[#181929] rounded-xl p-5 text-sm text-[#c5c7e8] leading-relaxed whitespace-pre-wrap min-h-48 border border-[#252640]">
                {meeting.transcript || <span className="text-[#4a4d6a] italic">{af ? "Geen transkripsie nog nie." : "No transcript yet."}</span>}
              </div>
            )}

            {meeting.transcript && (
              <div className="space-y-2">
                <button onClick={() => setShowPromptEditor(!showPromptEditor)}
                  className="text-xs text-[#6b6f8e] hover:text-[#c5c7e8] transition">
                  {showPromptEditor ? "▲ Hide custom prompt" : "▼ Custom prompt (optional)"}
                </button>
                {showPromptEditor && (
                  <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder={af
                      ? "Skryf jou eie instruksies hier... (laat leeg vir standaard notule)"
                      : "Write your own instructions here… (leave blank for standard minutes)"}
                    rows={4}
                    className="w-full bg-[#181929] border border-[#252640] rounded-xl px-4 py-3 text-sm text-[#d4d6f0] resize-none focus:outline-none focus:border-violet-500 font-mono" />
                )}
                <button onClick={generateMinutes}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 font-semibold transition shadow-lg shadow-violet-900/30">
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
                  className="text-sm px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 transition font-medium">
                  {streaming ? (af ? "Genereer…" : "Generating…") : (af ? "Genereer Notule" : "Generate Minutes")}
                </button>
                {minutes && !streaming && (
                  <>
                    <button onClick={() => { setEditingMinutes(!editingMinutes); setMinutesDraft(minutes); }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-[#252640] hover:bg-[#2f3158] transition text-[#c5c7e8]">
                      {editingMinutes ? (af ? "Kanselleer" : "Cancel") : (af ? "Wysig" : "Edit")}
                    </button>
                    <button onClick={() => navigator.clipboard.writeText(minutes)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-[#252640] hover:bg-[#2f3158] transition text-[#c5c7e8]">
                      {af ? "Kopieer" : "Copy"}
                    </button>
                    <button onClick={reading ? stopReading : readAloud}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition ${reading ? "border-red-700 bg-red-950/50 text-red-300" : "bg-[#252640] hover:bg-[#2f3158] border-[#252640] text-[#c5c7e8]"}`}>
                      {reading ? "⏹ Stop" : "🔊 Read aloud"}
                    </button>
                  </>
                )}
              </div>
            </div>

            {minutesError && <p className="text-sm text-red-400 bg-red-950/50 px-3 py-2 rounded-lg border border-red-900/50">{minutesError}</p>}

            {editingMinutes ? (
              <div className="space-y-2">
                <textarea value={minutesDraft} onChange={(e) => setMinutesDraft(e.target.value)}
                  className="w-full h-96 bg-[#181929] border border-[#252640] rounded-xl px-4 py-3 text-sm text-[#d4d6f0] resize-none focus:outline-none focus:border-violet-500 font-mono" />
                <button onClick={saveMinutes} disabled={savingMinutes}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-sm font-medium disabled:opacity-50 transition">
                  {savingMinutes ? (af ? "Stoor…" : "Saving…") : (af ? "Stoor" : "Save")}
                </button>
              </div>
            ) : (
              <div className="bg-[#181929] rounded-xl p-5 prose prose-invert prose-sm max-w-none min-h-48 border border-[#252640]">
                {minutes ? (
                  <ReactMarkdown>{minutes}</ReactMarkdown>
                ) : (
                  <p className="text-[#4a4d6a] italic text-sm">
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
            {extractError && <p className="text-sm text-red-400 bg-red-950/50 px-3 py-2 rounded-lg border border-red-900/50">{extractError}</p>}
          </div>
        )}

        {/* ── ACTION ITEMS TAB ── */}
        {tab === "actions" && (
          <div className="space-y-4">
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
                      actionFilter === f ? "border-violet-500 bg-violet-950/50 text-violet-300" : "border-[#252640] text-[#8b8fa8] hover:border-[#3a3c6a]"
                    }`}>
                    {label}
                    {f === "all" && <span className="ml-1 text-[#4a4d6a]">({actionItems.length})</span>}
                    {f === "todo" && <span className="ml-1 text-[#4a4d6a]">({actionItems.filter((a) => !a.done).length})</span>}
                    {f === "done" && <span className="ml-1 text-[#4a4d6a]">({actionItems.filter((a) => a.done).length})</span>}
                    {f === "high" && <span className="ml-1 text-[#4a4d6a]">({actionItems.filter((a) => a.priority === "high" && !a.done).length})</span>}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {actionItems.some((a) => a.done) && (
                  <button onClick={clearDone}
                    className="text-xs px-3 py-1.5 rounded-lg border border-[#252640] text-[#8b8fa8] hover:border-red-700 hover:text-red-400 transition">
                    {af ? "Vee Klaar Uit" : "Clear Done"}
                  </button>
                )}
                {minutes && (
                  <button onClick={extractActions} disabled={extracting}
                    className="text-xs px-3 py-1.5 rounded-lg bg-[#252640] hover:bg-[#2f3158] disabled:opacity-50 transition text-[#c5c7e8]">
                    {extracting ? (af ? "Onttrek…" : "Extracting…") : (af ? "Herwin" : "Re-extract")}
                  </button>
                )}
                <button onClick={() => setShowAddForm(!showAddForm)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 transition">
                  + {af ? "Voeg By" : "Add Task"}
                </button>
              </div>
            </div>

            {extractError && <p className="text-sm text-red-400 bg-red-950/50 px-3 py-2 rounded-lg border border-red-900/50">{extractError}</p>}

            {showAddForm && (
              <div className="bg-[#181929] rounded-xl p-4 border border-[#252640] space-y-3">
                <input value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTask()}
                  placeholder={af ? "Taakbeskrywing…" : "Task description…"}
                  className={inputCls} />
                <div className="flex gap-2 flex-wrap">
                  <input value={newTaskAssignee} onChange={(e) => setNewTaskAssignee(e.target.value)}
                    placeholder={af ? "Toegewys aan…" : "Assignee…"}
                    className="flex-1 min-w-28 bg-[#252640] border border-[#2f3158] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500" />
                  <input type="date" value={newTaskDueDate} onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="bg-[#252640] border border-[#2f3158] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 [color-scheme:dark]" />
                  <select value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value as Priority)}
                    className="bg-[#252640] border border-[#2f3158] rounded-lg px-3 py-2 text-sm text-white">
                    <option value="high">{af ? "Hoog" : "High"}</option>
                    <option value="medium">{af ? "Medium" : "Medium"}</option>
                    <option value="low">{af ? "Laag" : "Low"}</option>
                  </select>
                  <button onClick={addTask} disabled={addingTask || !newTaskText.trim()}
                    className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-sm font-medium transition">
                    {addingTask ? "…" : af ? "Voeg By" : "Add"}
                  </button>
                </div>
              </div>
            )}

            {filteredActions.length === 0 && actionItems.length === 0 ? (
              <div className="text-center py-16 text-[#6b6f8e]">
                <p className="text-lg">{af ? "Geen aksie-items nog nie." : "No action items yet."}</p>
                <p className="text-sm mt-2">{af ? "Genereer notule eers, dan onttrek aksie-items." : "Generate minutes first, then extract action items."}</p>
                <button onClick={() => setTab("minutes")} className="mt-4 text-sm text-violet-400 hover:underline">
                  {af ? "Gaan na Notule →" : "Go to Minutes →"}
                </button>
              </div>
            ) : filteredActions.length === 0 ? (
              <p className="text-center py-8 text-[#6b6f8e] text-sm">{af ? "Geen items vir hierdie filter." : "No items match this filter."}</p>
            ) : (
              <ul className="space-y-2">
                {filteredActions.map((item) => {
                  const p = (item.priority || "medium") as Priority;
                  return (
                    <li key={item.id}
                      className={`flex items-start gap-3 p-4 rounded-xl border transition ${
                        item.done ? "border-[#1e1f35] opacity-50" : "border-[#252640] bg-[#181929]"
                      }`}>
                      <button onClick={() => toggleAction(item)}
                        className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition ${
                          item.done ? "bg-emerald-600 border-emerald-600" : "border-[#3a3c6a] hover:border-emerald-500"
                        }`}>
                        {item.done && <span className="text-white text-xs">✓</span>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${item.done ? "line-through text-[#6b6f8e]" : "text-[#d4d6f0]"}`}>{item.text}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${priorityStyles[p] ?? priorityStyles.medium}`}>
                            {p}
                          </span>
                          {item.assignee && <span className="text-xs text-[#6b6f8e]">→ {item.assignee}</span>}
                          {item.dueDate && !item.done && (() => {
                            const due = new Date(item.dueDate); due.setHours(0,0,0,0);
                            const isOverdue = due < today;
                            const isToday = due.getTime() === today.getTime();
                            return (
                              <span className={`text-xs px-1.5 py-0.5 rounded border ${
                                isOverdue ? "bg-red-950/60 text-red-300 border-red-800/60" :
                                isToday ? "bg-amber-950/60 text-amber-300 border-amber-800/60" :
                                "bg-[#252640] text-[#8b8fa8] border-[#2f3158]"
                              }`}>
                                {isOverdue ? "⚠ " : isToday ? "📅 Today" : "📅 "}
                                {!isToday && new Date(item.dueDate).toLocaleDateString("en-ZA", { day: "2-digit", month: "short" })}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                      <button onClick={() => deleteAction(item.id)}
                        className="text-[#4a4d6a] hover:text-red-400 transition text-xs mt-0.5 flex-shrink-0">
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
