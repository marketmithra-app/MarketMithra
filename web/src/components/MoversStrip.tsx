"use client";

/**
 * MoversStrip — horizontal scrollable strip of stocks that significantly
 * changed their fusion probability since the last compute cycle.
 *
 * Verdict-change movers (HOLD→BUY, BUY→SELL, etc.) are shown first and
 * tagged with an arrow indicator. Pure probability moves come after.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { toSlug } from "@/lib/nifty50";
import type { MoverResult, Verdict } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

const VERDICT_COLOR: Record<Verdict, string> = {
  BUY:  "text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  HOLD: "text-amber-600  dark:text-amber-400  border-amber-500/40  bg-amber-500/10",
  SELL: "text-rose-600   dark:text-rose-400   border-rose-500/40   bg-rose-500/10",
};

const PREV_VERDICT_COLOR: Record<Verdict, string> = {
  BUY:  "text-emerald-700 dark:text-emerald-600",
  HOLD: "text-amber-700  dark:text-amber-600",
  SELL: "text-rose-700   dark:text-rose-600",
};

function MoverCard({ m }: { m: MoverResult }) {
  const slug     = toSlug(m.symbol);
  const isUp     = m.direction === "up";
  const deltaStr = `${isUp ? "+" : ""}${m.prob_delta_pct.toFixed(1)}pp`;

  return (
    <Link
      href={`/signals/${slug}`}
      className={`flex-none w-[160px] rounded-xl border p-3 hover:scale-[1.02] transition-transform ${
        m.verdict_changed
          ? isUp
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-rose-500/30 bg-rose-500/5"
          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c0e16]"
      }`}
    >
      {/* symbol + verdict badge */}
      <div className="flex items-center justify-between gap-1 mb-2">
        <span className="text-[13px] font-black text-slate-900 dark:text-slate-100 truncate">
          {slug}
        </span>
        <span className={`shrink-0 text-[9px] font-bold px-1.5 py-px rounded border ${VERDICT_COLOR[m.verdict]}`}>
          {m.verdict}
        </span>
      </div>

      {/* verdict transition or probability */}
      {m.verdict_changed ? (
        <div className="flex items-center gap-1 mb-1.5">
          <span className={`text-[10px] font-semibold line-through opacity-60 ${PREV_VERDICT_COLOR[m.prev_verdict]}`}>
            {m.prev_verdict}
          </span>
          <span className="text-slate-500 text-[9px]">→</span>
          <span className={`text-[10px] font-bold ${VERDICT_COLOR[m.verdict].split(" ")[0]}`}>
            {m.verdict}
          </span>
        </div>
      ) : (
        <div className="text-[10px] text-slate-500 mb-1.5">
          {Math.round(m.prev_probability * 100)}% → {Math.round(m.probability * 100)}%
        </div>
      )}

      {/* delta pill */}
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-mono font-bold ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
          {isUp ? "▲" : "▼"} {deltaStr}
        </span>
        <span className="text-[9px] font-mono text-slate-500">
          ₹{m.price.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </span>
      </div>
    </Link>
  );
}

interface Props {
  /** Where this strip appears — slightly different styling for each context. */
  context?: "landing" | "sidebar";
  limit?: number;
}

export default function MoversStrip({ context = "landing", limit = 10 }: Props) {
  const [movers,  setMovers]  = useState<MoverResult[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/movers?limit=${limit}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MoverResult[]) => { setMovers(data); setLoading(false); })
      .catch(() => { setMovers([]); setLoading(false); });
  }, [limit]);

  // No movers yet (first run / nothing changed) — don't render the section at all
  if (!loading && (!movers || movers.length === 0)) return null;

  if (context === "sidebar") {
    return (
      <div className="border-b border-slate-200 dark:border-slate-800">
        <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-100/60 dark:bg-slate-800/20 flex items-center gap-1.5">
          <span className="text-amber-400">↕</span> Movers
        </div>
        <div className="px-2 py-2 flex gap-1.5 overflow-x-auto scrollbar-none">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex-none w-[140px] h-[72px] rounded-lg bg-slate-200 dark:bg-slate-800/50 animate-pulse" />
              ))
            : movers!.map((m) => (
                <SidebarMoverChip key={m.symbol} m={m} />
              ))
          }
        </div>
      </div>
    );
  }

  // Landing context — full cards in a horizontal scroll
  return (
    <section className="px-6 pb-10 max-w-5xl mx-auto">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">↕</span>
            <div className="text-xl font-bold">Today&apos;s movers</div>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Biggest fusion probability shifts since last compute cycle
          </div>
        </div>
        <Link
          href="/signals"
          className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-500 transition"
        >
          All signals →
        </Link>
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-none w-[160px] h-[96px] rounded-xl bg-slate-100 dark:bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
          {movers!.map((m) => <MoverCard key={m.symbol} m={m} />)}
        </div>
      )}
    </section>
  );
}

/** Compact chip for the sidebar context */
function SidebarMoverChip({ m }: { m: MoverResult }) {
  const slug  = toSlug(m.symbol);
  const isUp  = m.direction === "up";
  const delta = `${isUp ? "+" : ""}${m.prob_delta_pct.toFixed(1)}pp`;

  return (
    <Link
      href={`/canvas/${encodeURIComponent(m.symbol)}`}
      className={`flex-none rounded-lg border px-2.5 py-1.5 text-center hover:opacity-80 transition ${
        isUp
          ? "border-emerald-500/30 bg-emerald-500/8"
          : "border-rose-500/30 bg-rose-500/8"
      }`}
      style={{ minWidth: 80 }}
    >
      <div className="text-[11px] font-bold text-slate-100 truncate">{slug}</div>
      {m.verdict_changed && (
        <div className="text-[8px] text-slate-500 leading-none mt-0.5">
          {m.prev_verdict}→{m.verdict}
        </div>
      )}
      <div className={`text-[10px] font-mono font-bold mt-0.5 ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
        {isUp ? "▲" : "▼"} {delta}
      </div>
    </Link>
  );
}
