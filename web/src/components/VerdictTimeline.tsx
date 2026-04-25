"use client";

import { useEffect, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

type VerdictValue = "BUY" | "HOLD" | "SELL";

interface HistoryEntry {
  date: string;
  verdict: VerdictValue;
  probability: number;
  price: number;
}

interface HistoryResponse {
  symbol: string;
  history: HistoryEntry[];
}

const VERDICT_STYLES: Record<
  VerdictValue,
  { pill: string; bar: string }
> = {
  BUY: {
    pill: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    bar: "bg-emerald-500",
  },
  HOLD: {
    pill: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    bar: "bg-amber-500",
  },
  SELL: {
    pill: "bg-rose-500/15 text-rose-600 border-rose-500/30",
    bar: "bg-rose-500",
  },
};

interface Props {
  symbol: string;
}

export default function VerdictTimeline({ symbol }: Props) {
  const [rows, setRows] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setRows(null);
    setError(false);
    fetch(`${API_BASE}/history/${encodeURIComponent(symbol)}?days=30`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<HistoryResponse>;
      })
      .then((d) => {
        // Most-recent first
        const sorted = [...d.history].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setRows(sorted);
      })
      .catch(() => setError(true));
  }, [symbol]);

  // ── loading skeleton ───────────────────────────────────────────────────────
  if (!error && rows === null) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11131c] p-4 mb-8">
        <div className="mb-3">
          <div className="h-3.5 w-28 rounded bg-slate-200 dark:bg-slate-700 animate-pulse mb-1" />
          <div className="h-2.5 w-44 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
        </div>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="h-3 w-16 rounded bg-slate-100 dark:bg-slate-800" />
              <div className="h-5 w-10 rounded-full bg-slate-100 dark:bg-slate-800" />
              <div className="flex-1 h-1 rounded-full bg-slate-100 dark:bg-slate-800" />
              <div className="h-3 w-16 rounded bg-slate-100 dark:bg-slate-800" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── error / empty ──────────────────────────────────────────────────────────
  if (error || (rows !== null && rows.length === 0)) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11131c] p-4 mb-8">
        <div className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-0.5">
          Verdict history
        </div>
        <div className="text-[11px] text-slate-500 mb-4">
          Last 30 days · updates daily
        </div>
        <p className="text-[12px] text-slate-500">
          Verdict history starts building from today — check back tomorrow.
        </p>
      </div>
    );
  }

  // rows is non-null and non-empty here
  const sparse = rows!.length < 8;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11131c] p-4 mb-8">
      {/* header */}
      <div className="mb-3">
        <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
          Verdict history
        </div>
        <div className="text-[11px] text-slate-500">
          Last 30 days · updates daily
        </div>
      </div>

      {/* rows */}
      <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1">
        {rows!.map((entry) => {
          const vs = VERDICT_STYLES[entry.verdict] ?? VERDICT_STYLES["HOLD"];
          return (
            <div key={entry.date} className="flex items-center gap-3">
              {/* date */}
              <span className="text-[11px] font-mono text-slate-500 w-[72px] shrink-0">
                {entry.date}
              </span>

              {/* verdict pill */}
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${vs.pill} shrink-0`}
              >
                {entry.verdict}
              </span>

              {/* probability bar */}
              <div className="flex-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full ${vs.bar}`}
                  style={{ width: `${entry.probability * 100}%` }}
                />
              </div>

              {/* price */}
              <span className="text-[11px] font-mono text-slate-500 shrink-0 text-right">
                ₹{entry.price.toLocaleString("en-IN")}
              </span>
            </div>
          );
        })}
      </div>

      {/* sparse note */}
      {sparse && (
        <p className="mt-3 text-[10px] text-slate-400">
          📈 History grows daily — check back to see the trend.
        </p>
      )}
    </div>
  );
}
