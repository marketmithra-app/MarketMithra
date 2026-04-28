"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { StockSnapshot, Verdict } from "@/lib/types";
import { getWatchlist, toggleWatch } from "@/lib/watchlist";
import MoversStrip from "@/components/MoversStrip";
import FreshnessBadge from "@/components/FreshnessBadge";

const BADGE: Record<Verdict, string> = {
  BUY:  "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  HOLD: "text-amber-300  border-amber-500/40  bg-amber-500/10",
  SELL: "text-rose-300   border-rose-500/40   bg-rose-500/10",
};
const BAR: Record<Verdict, string> = {
  BUY:  "bg-emerald-500",
  HOLD: "bg-amber-500",
  SELL: "bg-rose-500",
};

function SidebarRow({
  s,
  rank,
  isActive,
  isWatched,
  onToggleStar,
}: {
  s: StockSnapshot;
  rank: number;
  isActive: boolean;
  isWatched: boolean;
  onToggleStar: (sym: string) => void;
}) {
  const pct = Math.round(s.fusion.probability * 100);
  return (
    <li>
      <div
        className={`flex items-center gap-2 px-3 py-2 group transition ${
          isActive
            ? "bg-amber-500/5 border-l-2 border-amber-400"
            : "border-l-2 border-transparent hover:bg-slate-200/60 dark:hover:bg-slate-800/40"
        }`}
      >
        {/* rank */}
        <div className="text-[10px] text-slate-500 font-mono w-4 text-right shrink-0">
          {rank}
        </div>

        {/* clickable name + bar area — navigates */}
        <Link
          href={`/canvas/${encodeURIComponent(s.symbol)}`}
          className="flex-1 min-w-0"
        >
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-[12px] font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
              {s.symbol.replace(".NS", "").replace(".BO", "")}
            </span>
            <span
              className={`shrink-0 text-[9px] font-bold px-1.5 py-px rounded border ${BADGE[s.fusion.verdict]}`}
            >
              {s.fusion.verdict}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${BAR[s.fusion.verdict]}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-slate-500 shrink-0 w-7 text-right">
              {pct}%
            </span>
          </div>
        </Link>

        {/* star button — does NOT navigate */}
        <button
          onClick={(e) => { e.preventDefault(); onToggleStar(s.symbol); }}
          title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
          className={`shrink-0 text-[13px] transition hover:scale-110 ${
            isWatched
              ? "text-amber-400"
              : "text-slate-700 hover:text-amber-400 opacity-0 group-hover:opacity-100"
          }`}
        >
          {isWatched ? "★" : "☆"}
        </button>
      </div>
    </li>
  );
}

export default function RankedList({
  activeSymbol,
  ranked,
}: {
  activeSymbol: string;
  ranked: StockSnapshot[];
}) {
  const [watched, setWatched] = useState<Set<string>>(new Set());

  // Read from localStorage client-side only (avoids SSR mismatch).
  useEffect(() => {
    setWatched(new Set(getWatchlist()));
  }, []);

  function handleToggle(symbol: string) {
    const nowWatched = toggleWatch(symbol);
    setWatched((prev) => {
      const next = new Set(prev);
      if (nowWatched) next.add(symbol);
      else next.delete(symbol);
      return next;
    });
  }

  const buys  = ranked.filter((s) => s.fusion.verdict === "BUY").length;
  const total = ranked.length;

  // Watchlist stocks that are currently in the ranked universe
  const watchlistSnaps = ranked.filter((s) => watched.has(s.symbol));

  return (
    <aside className="w-[280px] shrink-0 border-r border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-[#0c0e16] hidden md:flex flex-col">

      {/* ── header ── */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-baseline justify-between">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Nifty 50 rankings
          </div>
          {total > 0 && (
            <div className="text-[11px] text-slate-500 font-mono">
              <span className="text-emerald-400">{buys} BUY</span>{" / "}{total}
            </div>
          )}
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          Ranked by fusion score · ☆ to watch
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── movers ── */}
        <MoversStrip context="sidebar" limit={6} />

        {/* ── watchlist section (only when non-empty) ── */}
        {watchlistSnaps.length > 0 && (
          <>
            <div className="px-3 py-1.5 text-[10px] font-semibold text-amber-500/80 uppercase tracking-wider bg-amber-500/5 border-b border-amber-500/10">
              ★ Watchlist
            </div>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800/40 border-b border-slate-200 dark:border-slate-800">
              {watchlistSnaps.map((s) => (
                <SidebarRow
                  key={`w-${s.symbol}`}
                  s={s}
                  rank={ranked.findIndex((r) => r.symbol === s.symbol) + 1}
                  isActive={s.symbol === activeSymbol}
                  isWatched={true}
                  onToggleStar={handleToggle}
                />
              ))}
            </ul>
          </>
        )}

        {/* ── all rankings ── */}
        {watchlistSnaps.length > 0 && (
          <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-100/60 dark:bg-slate-800/20">
            All Nifty 50
          </div>
        )}
        <ul className="divide-y divide-slate-200 dark:divide-slate-800/40">
          {ranked.length === 0 && (
            <li className="px-4 py-8 text-center text-xs text-slate-500">
              Rankings loading…
            </li>
          )}
          {ranked.map((s, i) => (
            <SidebarRow
              key={s.symbol}
              s={s}
              rank={i + 1}
              isActive={s.symbol === activeSymbol}
              isWatched={watched.has(s.symbol)}
              onToggleStar={handleToggle}
            />
          ))}
        </ul>
      </div>

      <div className="px-4 py-2 text-[10px] text-slate-500 border-t border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-between gap-2">
        <span>Live NSE · EOD via yfinance</span>
        {ranked.length > 0 && <FreshnessBadge asOf={ranked[0].asOf} size="sm" />}
      </div>
    </aside>
  );
}
