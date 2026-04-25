"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toSlug } from "@/lib/nifty50";
import type { Verdict, SlimStock } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

const BADGE: Record<Verdict, string> = {
  BUY:  "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  HOLD: "border-amber-500/50  bg-amber-500/10  text-amber-600 dark:text-amber-400",
  SELL: "border-rose-500/50   bg-rose-500/10   text-rose-600 dark:text-rose-400",
};
const BAR: Record<Verdict, string> = {
  BUY:  "bg-emerald-500",
  HOLD: "bg-amber-500",
  SELL: "bg-rose-500",
};

type Filter = "ALL" | Verdict;
type SortKey = "prob" | "alpha";

function SkeletonCard() {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c0e16] px-3 py-2.5 animate-pulse">
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <div className="h-3 w-14 rounded bg-slate-300 dark:bg-slate-700" />
        <div className="h-4 w-8 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex-1 h-1 rounded-full bg-slate-200 dark:bg-slate-800" />
        <div className="h-2 w-5 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}

export default function SignalsClientFilter() {
  const [all, setAll]       = useState<SlimStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<Filter>("ALL");
  const [sort, setSort]       = useState<SortKey>("prob");

  useEffect(() => {
    fetch(`${API_BASE}/screener`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SlimStock[]) => { setAll(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // ── derived ──────────────────────────────────────────────────────────────
  const counts = all.reduce(
    (acc, s) => { acc[s.verdict] = (acc[s.verdict] ?? 0) + 1; return acc; },
    {} as Record<string, number>
  );

  const filtered = filter === "ALL" ? all : all.filter((s) => s.verdict === filter);

  const sorted = [...filtered].sort((a, b) =>
    sort === "alpha"
      ? toSlug(a.symbol).localeCompare(toSlug(b.symbol))
      : b.probability - a.probability
  );

  // ── loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {["ALL", "BUY", "HOLD", "SELL"].map((v) => (
            <div key={v} className="h-7 w-16 rounded-full bg-slate-200 dark:bg-slate-800/60 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {Array.from({ length: 15 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (all.length === 0) return null;

  return (
    <div className="mb-10">
      {/* ── top bar: filter pills + sort toggle ── */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {(["ALL", "BUY", "HOLD", "SELL"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                filter === v
                  ? v === "ALL"
                    ? "border-amber-400 bg-amber-500/10 text-amber-400"
                    : v === "BUY"
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400"
                    : v === "SELL"
                    ? "border-rose-500/60 bg-rose-500/10 text-rose-400"
                    : "border-amber-500/60 bg-amber-500/10 text-amber-400"
                  : "border-slate-300 dark:border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300 dark:hover:border-slate-500"
              }`}
            >
              {v === "ALL" ? `All ${all.length}` : `${v} ${counts[v] ?? 0}`}
            </button>
          ))}
        </div>

        {/* sort toggle */}
        <div className="flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 p-0.5">
          {([["prob", "Signal strength"], ["alpha", "A → Z"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`rounded-full px-3 py-1 text-[10px] font-semibold transition ${
                sort === key
                  ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── grid ── */}
      {sorted.length === 0 ? (
        <div className="text-sm text-slate-500 text-center py-8">
          No {filter} signals today.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {sorted.map((s) => {
            const sym = toSlug(s.symbol);
            const pct = Math.round(s.probability * 100);
            return (
              <Link
                key={s.symbol}
                href={`/signals/${sym}`}
                className="group flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c0e16] px-3 py-2.5 hover:border-amber-400/60 dark:hover:border-amber-400/40 hover:bg-amber-500/5 transition"
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[12px] font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition truncate">
                    {sym}
                  </span>
                  <span className={`shrink-0 text-[9px] font-bold px-1.5 py-px rounded border ${BADGE[s.verdict]}`}>
                    {s.verdict}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${BAR[s.verdict]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 shrink-0 w-7 text-right">{pct}%</span>
                </div>
                <div className="mt-1 text-[9px] font-mono text-slate-400 truncate">
                  ₹{s.price.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
