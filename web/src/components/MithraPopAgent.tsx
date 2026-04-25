"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const POP_MESSAGES: Record<string, string> = {
  "/": "New here? I can explain how MarketMithra ranks stocks 👋",
  "/signals": "Want me to explain what BUY/HOLD/SELL signals mean?",
  "/watchlist": "I can summarise the signals for your watched stocks 📋",
  "/panic": "Want to know what this Fear score means historically? 📡",
  "/track-record": "Curious how our signals have performed? Ask me! 📊",
  "/sectors": "Want me to explain sector rotation? 🔄",
  "/about": "Questions about how MarketMithra works? Ask Mithra! 🧬",
};

const DEFAULT_MESSAGE = "Have questions? I'm Mithra, your platform guide 👋";

function getMessageForPath(pathname: string): string {
  if (POP_MESSAGES[pathname]) return POP_MESSAGES[pathname];
  if (pathname.startsWith("/signals/"))
    return "Want me to explain what these indicators mean for this stock?";
  if (pathname.startsWith("/dna/"))
    return "Curious what Stock DNA tells you? Ask me! 🧬";
  return DEFAULT_MESSAGE;
}

export default function MithraPopAgent() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!pathname) return;

    // Check if already popped for this path in this session
    const storageKey = `mithra_popped_${pathname}`;
    if (sessionStorage.getItem(storageKey)) return;

    // Reset dismissed state on path change (new page, new pop opportunity)
    setDismissed(false);
    setVisible(false);

    // Show after 20 seconds
    const showTimer = setTimeout(() => {
      // Only show if the user hasn't opened the chat yet
      // (We can't directly read MithraAgent state, so we use the session flag)
      setVisible(true);
      sessionStorage.setItem(storageKey, "1");

      // Auto-dismiss after 10 seconds
      const hideTimer = setTimeout(() => {
        setVisible(false);
      }, 10_000);

      return () => clearTimeout(hideTimer);
    }, 20_000);

    return () => clearTimeout(showTimer);
  }, [pathname]);

  function handleClick() {
    setVisible(false);
    setDismissed(true);
    window.dispatchEvent(new CustomEvent("mithra:open"));
  }

  function handleDismiss(e: React.MouseEvent) {
    e.stopPropagation();
    setVisible(false);
    setDismissed(true);
  }

  if (!visible || dismissed) return null;

  const message = getMessageForPath(pathname ?? "");

  return (
    <div
      className="fixed bottom-24 right-6 z-40 max-w-[220px] cursor-pointer
        rounded-xl bg-white dark:bg-[#0d0f18]
        border border-amber-400/40 border-l-4 border-l-amber-400
        shadow-lg shadow-amber-400/10 p-3
        animate-in fade-in slide-in-from-bottom-2 duration-200"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      aria-label="Open Mithra assistant"
    >
      <div className="flex items-start gap-2">
        <p className="flex-1 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          {message}
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors mt-0.5"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
