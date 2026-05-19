"use client";

import { useEffect } from "react";

interface Props {
  onClose: () => void;
}

const SECTIONS = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["N"], label: "New recording" },
      { keys: ["D"], label: "Dashboard" },
      { keys: ["H"], label: "History" },
      { keys: ["Y"], label: "Analytics" },
      { keys: ["S"], label: "Settings" },
    ],
  },
  {
    title: "Meeting detail",
    shortcuts: [
      { keys: ["T"], label: "Transcript tab" },
      { keys: ["M"], label: "Minutes tab" },
      { keys: ["A"], label: "Actions tab" },
      { keys: ["G"], label: "Generate minutes" },
    ],
  },
  {
    title: "General",
    shortcuts: [
      { keys: ["?"], label: "Show / hide shortcuts" },
      { keys: ["Esc"], label: "Close this panel" },
    ],
  },
];

export function KeyboardShortcutsModal({ onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1b2e] border border-[#2f3158] rounded-2xl p-6 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-white">Keyboard shortcuts</h2>
          <button onClick={onClose} className="text-[#6b6f8e] hover:text-white text-lg leading-none transition">×</button>
        </div>

        <div className="space-y-5">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="text-[10px] uppercase tracking-widest text-[#4a4d6a] font-semibold mb-2">
                {section.title}
              </p>
              <div className="space-y-1.5">
                {section.shortcuts.map((s) => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="text-sm text-[#8b8fa8]">{s.label}</span>
                    <div className="flex gap-1">
                      {s.keys.map((k) => (
                        <kbd
                          key={k}
                          className="px-2 py-0.5 rounded bg-[#252640] border border-[#3a3c6a] text-[11px] font-mono text-[#c5c7e8]"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-5 text-[10px] text-[#4a4d6a] text-center">
          Shortcuts are disabled while typing in a field
        </p>
      </div>
    </div>
  );
}
