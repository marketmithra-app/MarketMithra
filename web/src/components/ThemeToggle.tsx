"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export default function ThemeToggle({ forceDark }: { forceDark?: boolean }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (forceDark) {
      document.documentElement.classList.add("dark");
      setTheme("dark");
      return;
    }
    const stored = (localStorage.getItem("mm_theme") as Theme | null) ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(stored);
    document.documentElement.classList.toggle("dark", stored === "dark");
  }, [forceDark]);

  function toggle() {
    if (forceDark) return;
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("mm_theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }

  if (!mounted) {
    return <div className="h-7 w-12 rounded-full bg-slate-800/50" aria-hidden />;
  }

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle light / dark mode"
      onClick={toggle}
      disabled={forceDark}
      title={forceDark ? "Canvas is dark-only" : `Switch to ${isDark ? "light" : "dark"} mode`}
      className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
        isDark
          ? "border-slate-700 bg-slate-800"
          : "border-slate-300 bg-amber-100"
      } ${forceDark ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transform transition-transform ${
          isDark ? "translate-x-6" : "translate-x-1"
        }`}
      >
        <span className="text-[10px]">{isDark ? "🌙" : "☀️"}</span>
      </span>
    </button>
  );
}
