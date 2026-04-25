"use client";

import { useEffect, useState } from "react";
import { marketStatus, type MarketStatus } from "@/lib/marketHours";

/**
 * Compact NSE session indicator.
 *
 *   ● Open · Closes in 3h 12m
 *   ● Pre-market · Opens in 45m
 *   ● Closed · Opens in 2d 16h
 *
 * Ticks every 30s so "closes in / opens in" stays honest without
 * hammering render.
 */
export default function MarketStatusPill({ size = "md" }: { size?: "sm" | "md" }) {
  const [status, setStatus] = useState<MarketStatus | null>(null);

  useEffect(() => {
    setStatus(marketStatus());
    const id = setInterval(() => setStatus(marketStatus()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!status) return null; // SSR fallback — avoid hydration mismatch

  const sizing =
    size === "sm"
      ? "text-[9px] px-1.5 py-0.5 gap-1"
      : "text-[10px] px-2 py-0.5 gap-1.5";

  const stateStyles: Record<MarketStatus["state"], { dot: string; ring: string; chip: string; title: string }> = {
    open: {
      dot: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse",
      ring: "border-emerald-500/40 bg-emerald-500/10",
      chip: "text-emerald-600 dark:text-emerald-300",
      title: "Open",
    },
    pre: {
      dot: "bg-amber-400",
      ring: "border-amber-500/40 bg-amber-500/10",
      chip: "text-amber-600 dark:text-amber-300",
      title: "Pre-market",
    },
    post: {
      dot: "bg-slate-400",
      ring: "border-slate-400/40 bg-slate-500/10",
      chip: "text-slate-500 dark:text-slate-400",
      title: "Closed",
    },
    closed: {
      dot: "bg-slate-400",
      ring: "border-slate-400/40 bg-slate-500/10",
      chip: "text-slate-500 dark:text-slate-400",
      title: "Closed",
    },
  };

  const s = stateStyles[status.state];
  return (
    <span
      title={`NSE · ${s.title} · ${status.label}`}
      className={`inline-flex items-center rounded-full border ${s.ring} ${s.chip} font-semibold ${sizing}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      <span>{s.title}</span>
      <span className="font-mono font-normal opacity-75 hidden sm:inline">
        · {status.label}
      </span>
    </span>
  );
}
