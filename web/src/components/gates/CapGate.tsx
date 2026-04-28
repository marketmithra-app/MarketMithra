"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { msUntilWeekReset, formatCountdown, FREE_WEEKLY_CAP } from "@/lib/usageCap";

interface Props {
  resetAt: string;
}

export default function CapGate({ resetAt }: Props) {
  const [countdown, setCountdown] = useState(() => formatCountdown(msUntilWeekReset()));
  const primaryRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setCountdown(formatCountdown(msUntilWeekReset())), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { primaryRef.current?.focus(); }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        container!.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])')
      ).filter((el) => !el.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleRemindMe() {
    try { localStorage.setItem("mm_remind_cap_reset", resetAt); } catch { /* ignore */ }
  }

  return (
    <>
      <div aria-hidden="true" className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-2 p-4"
        style={{ filter: "blur(5px)", opacity: 0.25 }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-lg"
            style={{ background: i === 1 ? "#0d1f35" : i === 4 ? "#2d1f0d" : "#1e293b" }} />
        ))}
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cap-gate-title"
          aria-describedby="cap-gate-desc"
          className="w-full max-w-[260px] rounded-2xl border border-white/[0.08] p-5 text-center shadow-[0_8px_32px_rgba(0,0,0,0.7)] animate-in fade-in zoom-in-95 duration-200"
          style={{
            background: "rgba(13,15,26,0.80)",
            ["WebkitBackdropFilter" as never]: "blur(12px)",
            backdropFilter: "blur(12px)",
          }}
        >
          <CalendarDays className="mx-auto mb-2 h-5 w-5 text-slate-400" aria-hidden="true" />
          <h2 id="cap-gate-title" className="mb-0.5 text-[13px] font-bold text-slate-100">
            You&apos;ve used {FREE_WEEKLY_CAP} / {FREE_WEEKLY_CAP} this week
          </h2>
          <p id="cap-gate-desc" className="mb-3 text-[12px] text-slate-400">
            Resets <span className="font-semibold text-slate-300">Monday 12:00 AM IST</span>
          </p>

          <div className="mb-3 rounded-lg bg-[#111827] px-3 py-2" aria-live="polite" aria-atomic="true">
            <div className="text-[12px] text-slate-500 mb-0.5">Next reset in</div>
            <div className="text-[18px] font-black text-slate-100 tabular-nums">{countdown}</div>
          </div>

          <div
            className="mb-4 flex justify-center gap-1"
            role="progressbar"
            aria-valuenow={FREE_WEEKLY_CAP}
            aria-valuemax={FREE_WEEKLY_CAP}
            aria-label={`${FREE_WEEKLY_CAP} of ${FREE_WEEKLY_CAP} analyses used this week`}
          >
            {[...Array(FREE_WEEKLY_CAP)].map((_, i) => (
              <div key={i} className="h-1.5 w-[22px] rounded-full bg-amber-400" aria-hidden="true" />
            ))}
          </div>

          <button
            ref={primaryRef}
            onClick={() => (window.location.href = window.location.pathname + "?upgrade=1")}
            className="mb-2 w-full min-h-[44px] rounded-full bg-amber-400 px-4 py-2.5 text-[13px] font-bold text-slate-900 transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            Go unlimited — ₹299/mo
          </button>

          <button
            onClick={handleRemindMe}
            className="w-full min-h-[44px] rounded-full border border-slate-700 bg-transparent px-4 py-2 text-[12px] text-slate-500 transition hover:border-slate-500 hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
          >
            Remind me on Monday
          </button>
        </div>
      </div>
    </>
  );
}
