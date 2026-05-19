"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

type Language = "english" | "afrikaans";

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

const L = (lang: Language) => ({
  date:     lang === "afrikaans" ? "DATUM"        : "DATE",
  time:     lang === "afrikaans" ? "TYD"          : "TIME",
  att:      lang === "afrikaans" ? "TEENWOORDIG"  : "ATTENDEES",
  agenda:   lang === "afrikaans" ? "AGENDA"       : "AGENDA",
  tasks:    lang === "afrikaans" ? "Aksie-items"  : "Action Items",
  chair:    lang === "afrikaans" ? "VOORSITTER HANDTEKENING" : "CHAIRPERSON SIGNATURE",
  appr:     lang === "afrikaans" ? "DATUM GOEDGEKEUR"        : "DATE APPROVED",
  official: lang === "afrikaans" ? "Amptelike Vergaderingnotules" : "Official Meeting Minutes",
  priority: lang === "afrikaans" ? "Prioriteit"  : "Priority",
  assignee: lang === "afrikaans" ? "Toegewys"    : "Assignee",
  status:   lang === "afrikaans" ? "Status"      : "Status",
  done:     lang === "afrikaans" ? "Klaar"       : "Done",
  pending:  lang === "afrikaans" ? "Uitstaande"  : "Pending",
});

function mdToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^\* (.+)$/gm, "<li>$1</li>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hlu])/m, "<p>")
    .replace(/(?<![>])$/, "</p>");
}

interface ShareLink {
  id: string;
  token: string;
  createdAt: string;
  expiresAt: string | null;
}

export default function ExportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [language, setLanguage] = useState<Language>("english");
  const [emailTo, setEmailTo] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [creatingLink, setCreatingLink] = useState(false);

  useEffect(() => {
    fetch(`/api/meetings/${id}`)
      .then((r) => r.json())
      .then((data: Meeting) => {
        setMeeting(data);
        setLanguage((data.language === "afrikaans" ? "afrikaans" : "english") as Language);
      });
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s: { emailRecipients?: string }) => {
        if (s.emailRecipients) setEmailTo(s.emailRecipients);
      });
    fetch(`/api/meetings/${id}/share`)
      .then((r) => r.json())
      .then((links: ShareLink[]) => setShareLinks(links));
  }, [id]);

  const createShareLink = async () => {
    setCreatingLink(true);
    const res = await fetch(`/api/meetings/${id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const link: ShareLink = await res.json();
    setShareLinks((prev) => [link, ...prev]);
    setCreatingLink(false);
    copyWithFeedback(`${window.location.origin}/share/${link.token}`, `share-${link.token}`);
  };

  const revokeShareLink = async (token: string) => {
    await fetch(`/api/meetings/${id}/share?token=${token}`, { method: "DELETE" });
    setShareLinks((prev) => prev.filter((l) => l.token !== token));
  };

  if (!meeting) {
    return <div className="flex items-center justify-center py-20 text-[#8b8fa8]">Loading…</div>;
  }

  const lbl = L(language);
  const dateStr = new Date(meeting.date).toLocaleDateString("en-ZA", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = new Date(meeting.date).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
  const attendeeList = meeting.attendees ? meeting.attendees.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const hasTasks = meeting.actionItems.length > 0;

  const copyWithFeedback = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const emailBody = [
    `${language === "afrikaans" ? "VERGADERINGNOTULE" : "MEETING MINUTES"} — ${meeting.title}`,
    `${lbl.date}: ${dateStr}  ${lbl.time}: ${timeStr}`,
    attendeeList.length ? `${lbl.att}: ${attendeeList.join(", ")}` : "",
    meeting.agenda ? `${lbl.agenda}: ${meeting.agenda}` : "",
    "",
    meeting.minutes ?? (language === "afrikaans" ? "Geen notule gegenereer nie." : "No minutes generated."),
    "",
    `── ${lbl.tasks} ──`,
    hasTasks
      ? meeting.actionItems.map((t) => `[${t.done ? "✓" : " "}] ${t.text}${t.assignee ? ` (${t.assignee})` : ""}  [${t.priority}]`).join("\n")
      : language === "afrikaans" ? "Geen aksie-items nie." : "No action items.",
    "",
    "Generated by DAB Meetings",
  ].filter((l) => l !== undefined).join("\n");

  const waSummary = (meeting.minutes ?? "")
    .replace(/[#*`_[\]()]/g, "")
    .split("\n")
    .filter(Boolean)
    .slice(0, 8)
    .join("\n");

  const waTopTasks = meeting.actionItems
    .filter((t) => !t.done)
    .slice(0, 8)
    .map((t) => `• ${t.text}${t.assignee ? ` (${t.assignee})` : ""}`)
    .join("\n");

  const waMessage = [
    `📋 *${meeting.title}*`,
    `${lbl.date}: ${dateStr}`,
    attendeeList.length ? `${lbl.att}: ${attendeeList.join(", ")}` : "",
    "",
    waSummary,
    waTopTasks ? `\n*${lbl.tasks}:*\n${waTopTasks}` : "",
    "\n_Generated by DAB Meetings_",
  ].filter(Boolean).join("\n");

  const waUrl = `https://wa.me/?text=${encodeURIComponent(waMessage)}`;

  const handleCsvExport = () => {
    if (!hasTasks) return;
    const header = `Task,Assignee,Priority,Status,Meeting\n`;
    const rows = meeting.actionItems
      .map((t) =>
        [
          `"${t.text.replace(/"/g, '""')}"`,
          `"${(t.assignee ?? "").replace(/"/g, '""')}"`,
          t.priority,
          t.done ? lbl.done : lbl.pending,
          `"${meeting.title.replace(/"/g, '""')}"`,
        ].join(",")
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${meeting.title.replace(/\s+/g, "_")}_tasks.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleWordExport = () => {
    if (!meeting.minutes) return;
    const taskRows = hasTasks
      ? meeting.actionItems
          .map((t) => `<tr><td>[${t.done ? "X" : " "}]</td><td>${t.text}</td><td>${t.assignee ?? ""}</td><td>${t.priority}</td></tr>`)
          .join("")
      : `<tr><td colspan="4">${language === "afrikaans" ? "Geen aksie-items nie." : "No action items."}</td></tr>`;

    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>${meeting.title}</title>
<style>
  body{font-family:Calibri,Arial,sans-serif;line-height:1.5;color:#333;margin:40pt;}
  h1{color:#1a3a8e;font-size:22pt;border-bottom:2px solid #1a3a8e;padding-bottom:5pt;}
  h2{color:#2563eb;font-size:14pt;margin-top:16pt;}
  h3{color:#374151;font-size:12pt;}
  table{width:100%;border-collapse:collapse;margin-bottom:16pt;font-size:10pt;}
  td,th{padding:6pt 8pt;border:1pt solid #d1d5db;}
  th{background:#f3f4f6;font-weight:bold;text-align:left;}
  .meta td:first-child{font-weight:bold;color:#1a3a8e;width:80pt;background:#f8fafc;}
  .footer{font-size:8pt;color:#94a3b8;text-align:center;margin-top:40pt;border-top:1pt solid #e5e7eb;padding-top:8pt;}
  .sig table{margin-top:30pt;} .sig td{border:none;padding:0 20pt 0 0;font-size:9pt;}
</style></head>
<body>
<h1>${meeting.title}</h1>
<p><em>${lbl.official}</em></p>
<table class="meta">
  <tr><td>${lbl.date}</td><td>${dateStr}</td><td>${lbl.time}</td><td>${timeStr}</td></tr>
  ${attendeeList.length ? `<tr><td>${lbl.att}</td><td colspan="3">${attendeeList.join(", ")}</td></tr>` : ""}
  ${meeting.agenda ? `<tr><td>${lbl.agenda}</td><td colspan="3">${meeting.agenda}</td></tr>` : ""}
</table>
${mdToHtml(meeting.minutes)}
<h2>${lbl.tasks}</h2>
<table>
  <tr><th></th><th>Task</th><th>${lbl.assignee}</th><th>${lbl.priority}</th></tr>
  ${taskRows}
</table>
<div class="sig"><table><tr>
  <td><strong>${lbl.chair}</strong><br><br>_______________________</td>
  <td><strong>${lbl.appr}</strong><br><br>_______________________</td>
</tr></table></div>
<div class="footer">Generated by DAB Meetings — ${dateStr}</div>
</body></html>`;

    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${meeting.title.replace(/\s+/g, "_")}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => setTimeout(() => window.print(), 100);

  const handleEmail = () => {
    const subject = encodeURIComponent(`${language === "afrikaans" ? "Vergaderingnotule" : "Meeting Minutes"} — ${meeting.title}`);
    const body = encodeURIComponent(emailBody);
    window.location.href = `mailto:${emailTo}?subject=${subject}&body=${body}`;
  };

  const handleSendDirect = async () => {
    if (!emailTo.trim()) { setSendResult({ ok: false, msg: "Enter a recipient first" }); return; }
    setSending(true);
    setSendResult(null);
    const subject = `${language === "afrikaans" ? "Vergaderingnotule" : "Meeting Minutes"} — ${meeting.title}`;
    const res = await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: emailTo, subject, text: emailBody }),
    });
    const data = await res.json() as { success?: boolean; error?: string };
    setSendResult(res.ok ? { ok: true, msg: "Email sent!" } : { ok: false, msg: data.error ?? "Send failed" });
    setSending(false);
    if (res.ok) setTimeout(() => setSendResult(null), 4000);
  };

  const cardCls = "bg-[#181929] rounded-xl p-5 border border-[#252640]";
  const btnPrimary = "px-4 py-2 rounded-lg text-sm font-medium transition shrink-0 disabled:opacity-40";

  return (
    <>
      {/* Print layout */}
      <div ref={printRef} className="hidden print:block p-12 font-sans text-black bg-white text-sm">
        <div className="flex justify-between items-start border-b-2 border-blue-900 pb-5 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">{meeting.title}</h1>
            <p className="text-blue-700 text-sm font-semibold mt-1">{lbl.official}</p>
          </div>
        </div>
        <table className="w-full border-collapse text-xs mb-6" style={{ borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td className="font-bold text-blue-900 py-1 pr-4 w-24">{lbl.date}</td>
              <td className="py-1">{dateStr}</td>
              <td className="font-bold text-blue-900 py-1 pr-4 pl-8">{lbl.time}</td>
              <td className="py-1">{timeStr}</td>
            </tr>
            {attendeeList.length > 0 && (
              <tr>
                <td className="font-bold text-blue-900 py-1">{lbl.att}</td>
                <td colSpan={3} className="py-1">{attendeeList.join(", ")}</td>
              </tr>
            )}
            {meeting.agenda && (
              <tr>
                <td className="font-bold text-blue-900 py-1">{lbl.agenda}</td>
                <td colSpan={3} className="py-1">{meeting.agenda}</td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="leading-relaxed text-gray-800 mb-8 whitespace-pre-wrap">
          {meeting.minutes ?? (language === "afrikaans" ? "Geen notule gegenereer nie." : "No minutes generated.")}
        </div>
        {hasTasks && (
          <>
            <h2 className="font-bold text-blue-900 text-base mb-2">{lbl.tasks}</h2>
            <table className="w-full text-xs border-collapse mb-8" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-1 text-left w-6"></th>
                  <th className="border border-gray-300 p-1 text-left">Task</th>
                  <th className="border border-gray-300 p-1 text-left w-28">{lbl.assignee}</th>
                  <th className="border border-gray-300 p-1 text-left w-20">{lbl.priority}</th>
                </tr>
              </thead>
              <tbody>
                {meeting.actionItems.map((t) => (
                  <tr key={t.id}>
                    <td className="border border-gray-300 p-1 text-center">{t.done ? "✓" : ""}</td>
                    <td className="border border-gray-300 p-1">{t.text}</td>
                    <td className="border border-gray-300 p-1">{t.assignee ?? ""}</td>
                    <td className="border border-gray-300 p-1 capitalize">{t.priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <div className="grid grid-cols-2 gap-16 mt-16 border-t border-gray-300 pt-6 text-xs font-bold text-gray-700">
          <div>{lbl.chair}<div className="mt-8 border-t border-gray-500 w-48"></div></div>
          <div>{lbl.appr}<div className="mt-8 border-t border-gray-500 w-48"></div></div>
        </div>
        <div className="text-center text-gray-400 text-xs mt-10 border-t border-gray-200 pt-4">
          Generated by DAB Meetings — {dateStr}
        </div>
      </div>

      {/* Screen UI */}
      <div className="print:hidden p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Page header */}
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <button onClick={() => router.back()} className="text-xs text-[#6b6f8e] hover:text-[#c5c7e8] transition mb-2">← Back</button>
              <h1 className="text-2xl font-bold text-white truncate">Export</h1>
              <p className="text-sm text-[#8b8fa8] mt-1 truncate">{meeting.title} · {dateStr}</p>
            </div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="bg-[#252640] border border-[#2f3158] rounded-lg px-3 py-1.5 text-sm text-white ml-4 flex-shrink-0"
            >
              <option value="english">English</option>
              <option value="afrikaans">Afrikaans</option>
            </select>
          </div>

          {/* PDF */}
          <div className={`${cardCls} flex items-center justify-between gap-4`}>
            <div>
              <p className="font-medium text-white">📄 PDF</p>
              <p className="text-xs text-[#6b6f8e] mt-0.5">Formatted layout with signature lines · Print to PDF via browser</p>
            </div>
            <button onClick={handlePrint} disabled={!meeting.minutes}
              className={`${btnPrimary} bg-violet-600 hover:bg-violet-700 text-white`}>
              Print / Save PDF
            </button>
          </div>

          {/* Word */}
          <div className={`${cardCls} flex items-center justify-between gap-4`}>
            <div>
              <p className="font-medium text-white">📝 Word Document</p>
              <p className="text-xs text-[#6b6f8e] mt-0.5">Styled .doc with metadata table, minutes and task list</p>
            </div>
            <button onClick={handleWordExport} disabled={!meeting.minutes}
              className={`${btnPrimary} bg-indigo-600 hover:bg-indigo-700 text-white`}>
              Download .doc
            </button>
          </div>

          {/* CSV */}
          <div className={`${cardCls} flex items-center justify-between gap-4`}>
            <div>
              <p className="font-medium text-white">📊 CSV — Task List</p>
              <p className="text-xs text-[#6b6f8e] mt-0.5">
                {hasTasks ? `${meeting.actionItems.length} tasks with assignee, priority and status` : "No action items yet"}
              </p>
            </div>
            <button onClick={handleCsvExport} disabled={!hasTasks}
              className={`${btnPrimary} bg-emerald-700 hover:bg-emerald-600 text-white`}>
              Download .csv
            </button>
          </div>

          {/* Email */}
          <div className={`${cardCls} space-y-3`}>
            <div>
              <p className="font-medium text-white">✉️ Email</p>
              <p className="text-xs text-[#6b6f8e] mt-0.5">Open in your default email client or copy the body</p>
            </div>
            <input type="email" placeholder="Recipient (optional)" value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              className="w-full bg-[#252640] border border-[#2f3158] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4a4d6a] focus:outline-none focus:border-violet-500" />
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleSendDirect} disabled={sending}
                className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-sm font-medium transition text-white min-w-28">
                {sending ? "Sending…" : "Send directly"}
              </button>
              <button onClick={handleEmail}
                className="flex-1 py-2 rounded-lg bg-[#252640] hover:bg-[#2f3158] text-sm font-medium transition text-[#c5c7e8] min-w-28">
                Open mail client
              </button>
              <button onClick={() => copyWithFeedback(emailBody, "email")}
                className="px-4 py-2 rounded-lg bg-[#252640] hover:bg-[#2f3158] text-sm transition text-[#c5c7e8]">
                {copied === "email" ? "Copied ✓" : "Copy body"}
              </button>
            </div>
            {sendResult && (
              <p className={`text-xs px-3 py-2 rounded-lg border ${sendResult.ok ? "text-emerald-300 bg-emerald-950/40 border-emerald-900/40" : "text-red-400 bg-red-950/50 border-red-900/50"}`}>
                {sendResult.msg}
              </p>
            )}
          </div>

          {/* WhatsApp */}
          <div className={`${cardCls} space-y-3`}>
            <div>
              <p className="font-medium text-white">💬 WhatsApp</p>
              <p className="text-xs text-[#6b6f8e] mt-0.5">Share a summary + action items via WhatsApp Web</p>
            </div>
            <div className="flex gap-2">
              <a href={waUrl} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-sm font-medium transition text-center text-white">
                Share on WhatsApp
              </a>
              <button onClick={() => copyWithFeedback(waMessage, "wa")}
                className="px-4 py-2 rounded-lg bg-[#252640] hover:bg-[#2f3158] text-sm transition text-[#c5c7e8]">
                {copied === "wa" ? "Copied ✓" : "Copy"}
              </button>
            </div>
          </div>

          {/* Share Link */}
          <div className={`${cardCls} space-y-3`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">🔗 Share Link</p>
                <p className="text-xs text-[#6b6f8e] mt-0.5">Read-only public link — no login required</p>
              </div>
              <button onClick={createShareLink} disabled={creatingLink}
                className={`${btnPrimary} bg-[#252640] hover:bg-[#2f3158] text-[#c5c7e8] disabled:opacity-50`}>
                {creatingLink ? "Creating…" : "+ New Link"}
              </button>
            </div>
            {shareLinks.length > 0 && (
              <ul className="space-y-2">
                {shareLinks.map((link) => {
                  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/share/${link.token}`;
                  const isExpired = link.expiresAt ? new Date(link.expiresAt) < new Date() : false;
                  return (
                    <li key={link.token} className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-[#111223] border ${isExpired ? "border-red-900/40 opacity-60" : "border-[#252640]"}`}>
                      <span className="flex-1 text-xs text-[#8b8fa8] truncate font-mono">{url}</span>
                      {isExpired && <span className="text-[10px] text-red-400 flex-shrink-0">expired</span>}
                      <button onClick={() => copyWithFeedback(url, `share-${link.token}`)}
                        className="text-xs px-2 py-1 rounded bg-[#252640] hover:bg-[#2f3158] text-[#c5c7e8] flex-shrink-0">
                        {copied === `share-${link.token}` ? "Copied ✓" : "Copy"}
                      </button>
                      <button onClick={() => revokeShareLink(link.token)}
                        className="text-xs px-2 py-1 rounded bg-[#252640] hover:bg-red-950 text-[#8b8fa8] hover:text-red-400 flex-shrink-0">
                        Revoke
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Preview */}
          {meeting.minutes && (
            <details className={cardCls}>
              <summary className="cursor-pointer text-sm text-[#8b8fa8] hover:text-white select-none">
                Preview minutes
              </summary>
              <div className="mt-4 prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{meeting.minutes}</ReactMarkdown>
              </div>
            </details>
          )}
        </div>
      </div>
    </>
  );
}
