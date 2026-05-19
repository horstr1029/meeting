"use client";

import { ToastProvider } from "@/contexts/ToastContext";
import { GlobalShortcuts } from "@/components/GlobalShortcuts";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <GlobalShortcuts />
      {children}
    </ToastProvider>
  );
}
