"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const nav = [
  {
    section: "WORKSPACE",
    items: [
      { href: "/dashboard", icon: "🏠", label: "Dashboard" },
      { href: "/record", icon: "🎙️", label: "Record Meeting" },
    ],
  },
  {
    section: "MEETINGS",
    items: [
      { href: "/history", icon: "📋", label: "History" },
      { href: "/series", icon: "🔁", label: "Series" },
      { href: "/analytics", icon: "📊", label: "Analytics" },
    ],
  },
  {
    section: "SETTINGS",
    items: [
      { href: "/settings", icon: "⚙️", label: "Server Settings" },
      { href: "/help", icon: "❓", label: "Help & Guide" },
    ],
  },
];

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 w-52 bg-[#0d0e1c] border-r border-[#1a1b30] flex flex-col z-20 print:hidden">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-[#1a1b30]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-white text-sm font-extrabold shadow-lg shadow-violet-900/40 flex-shrink-0">
            D
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-white">DAB</p>
            <p className="text-[10px] text-[#3a3d5a] tracking-widest">AI MINUTES</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 py-4 space-y-5 overflow-y-auto">
        {nav.map(({ section, items }) => (
          <div key={section}>
            <p className="text-[10px] font-semibold text-[#363858] px-2 mb-1.5 tracking-[0.12em]">
              {section}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? "bg-[#261e6b] text-white font-medium"
                          : "text-[#8b8fa8] hover:text-white hover:bg-[#181929]"
                      }`}
                    >
                      <span className="text-[15px] w-5 flex-shrink-0 text-center">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2.5 pb-4 border-t border-[#1a1b30] pt-3 space-y-0.5">
        <p className="text-[11px] text-[#363858] px-2.5 py-1 truncate" title={email}>{email}</p>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-[#8b8fa8] hover:text-white hover:bg-[#181929] transition-colors"
        >
          <span className="text-[15px] w-5 flex-shrink-0 text-center">🚪</span>
          <span>Sign out</span>
        </button>
        <p className="text-[10px] text-[#2a2b45] px-2.5 pt-1">Press <kbd className="font-mono bg-[#1a1b2e] border border-[#252640] rounded px-1 text-[#3a3d5a]">?</kbd> for shortcuts</p>
      </div>
    </aside>
  );
}
