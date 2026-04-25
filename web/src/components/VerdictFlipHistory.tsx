"use client";

/**
 * VerdictFlipHistory — shows the last 7 days of BUY/SELL/HOLD verdict changes.
 * Fetches /history/changes for each day in parallel and merges results.
 * Handles empty state gracefully (data accumulates from today forward).
 */

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

type Verdict = "BUY" | "HOLD" | "SELL";

type FlipEntry = {
  date: string;
  symbol: string;
  name: string;
  verdict_today: Verdict;
  verdict_prev: Verdict;
  prob_today: number;
  prob_prev: number;
};

const PILL: Record<Verdict, string> = {
  BUY:  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  HOLD: "bg-amber-500/15  text-amber-600  dark:text-amber-400  border-amber-500/30",
  SELL: "bg-rose-500/15   text-rose-600   dark:text-rose-400   border-rose-500/30",
};

const LEFT_BORDER: Record<Verdict, string> = {
  BUY:  "border-l-2 border-emerald-500/40",
  HOLD: "border-l-2 border-slate-300/40 dark:border-slate-700/40",
  SELL: "border-l-2 border-rose-500/40",
};

function dateMinusDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function VerdictPill({ v }: { v: Verdict }) {
  return (
    <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border ${PILL[v]}`}>
      {v}
    </span>
  );
}

export default function VerdictFlipHistory() {
  const [flips, setFlips] = useState<FlipEntry[] | null>(null);

  useEffect(() => {
    const dates = Array.from({ length: 7 }, (_, i) => dateMinusDays(i));

    Promise.allSettled(
      dates.map((date) =>
        fetch(`${API_BASE}/history/changes?date=${date}`)
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then((data: { date: string; changes: { symbol: string; verdict_today: string; verdict_prev: string; prob_today: number; prob_prev: number }[] }) =>
            (data.changes ?? []).map((c) => ({
              date: data.date,
              symbol: c.symbol,
              name: c.symbol.replace(".NS", "").replace(".BO", ""),
              verdict_today: c.verdict_today as Verdict,
              verdict_prev: c.verdict_prev as Verdict,
              prob_today: c.prob_today,
              prob_prev: c.prob_prev,
            }))
          )
      )
    ).then((results) => {
      const merged: FlipEntry[] = [];
      for (const r of results) {
        if (r.status === "fulfilled") merged.push(...r.value);
      }
      // Sort by date descending
      merged.sort((a, b) => b.date.localeCompare(a.date));
      setFlips(merged);
    });
  }, []);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c0e16] p-6 mb-8">
      <div className="mb-4">
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
          Recent signal changes
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Last 7 days — updates daily
        </p>
      </div>

      {/* Loading skeleton */}
      {flips === null && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 pl-3 animate-pulse">
              <div className="h-3 w-16 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-4 w-10 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-3 w-4 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-4 w-10 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="ml-auto h-3 w-10 rounded bg-slate-200 dark:bg-slate-800" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {flips !== null && flips.length === 0 && (
        <div className="text-center py-6 text-[12px] text-slate-500 dark:text-slate-400">
          📊 Signal history is building — verdict changes will appear here as daily data accumulates.
        </div>
      )}

      {/* Flip list */}
      {flips !== null && flips.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {flips.map((f, i) => {
            const delta = (f.prob_today - f.prob_prev) * 100;
            return (
              <div
                key={`${f.date}-${f.symbol}-${i}`}
                className={`flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg ${LEFT_BORDER[f.verdict_today]} bg-slate-50/50 dark:bg-slate-900/30`}
              >
                <span className="text-[10px] font-mono text-slate-400 w-20 shrink-0">
                  {f.date}
                </span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 min-w-[80px]">
                  {f.name}
                </span>
                <div className="flex items-center gap-1.5">
                  <VerdictPill v={f.verdict_prev} />
                  <span className="text-slate-400 text-xs">→</span>
                  <VerdictPill v={f.verdict_today} />
                </div>
                <span
                  className={`ml-auto text-[11px] font-mono font-semibold ${
                    delta >= 0 ? "text-emerald-500" : "text-rose-500"
                  }`}
                >
                  {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
