"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcutsModal";

export function GlobalShortcuts() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  const closeModal = useCallback(() => setShowModal(false), []);

  const shortcuts = useMemo(() => ({
    "n": () => router.push("/record"),
    "N": () => router.push("/record"),
    "d": () => router.push("/dashboard"),
    "D": () => router.push("/dashboard"),
    "h": () => router.push("/history"),
    "H": () => router.push("/history"),
    "y": () => router.push("/analytics"),
    "Y": () => router.push("/analytics"),
    "s": () => router.push("/settings"),
    "S": () => router.push("/settings"),
    "?": () => setShowModal((v) => !v),
  }), [router]);

  useKeyboardShortcuts(shortcuts);

  return showModal ? <KeyboardShortcutsModal onClose={closeModal} /> : null;
}
