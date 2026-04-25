"use client";

import { useEffect } from "react";

/**
 * Ensures the canvas route stays dark regardless of user preference — the
 * React Flow graph, node styles, and chart spark-lines are all tuned for
 * dark-only. Restores the user's saved theme on unmount.
 */
export default function ForceDark() {
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    html.classList.add("dark");
    return () => {
      if (!wasDark) {
        try {
          const stored = localStorage.getItem("mm_theme");
          if (stored === "light") html.classList.remove("dark");
        } catch {
          /* noop */
        }
      }
    };
  }, []);
  return null;
}
