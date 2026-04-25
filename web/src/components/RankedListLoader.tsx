"use client";

import { useEffect, useState } from "react";
import RankedList from "@/components/RankedList";
import type { StockSnapshot } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

function SkeletonRow({ wide, barPct }: { wide?: boolean; barPct?: number }) {
  return (
    <li className="flex items-center gap-2 px-3 py-2 border-l-2 border-transparent">
      <div className="w-4 shrink-0 h-2 rounded bg-slate-700/50 animate-pulse" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-1">
          <div
            className={`h-2.5 rounded bg-slate-700/60 animate-pulse ${wide ? "w-20" : "w-14"}`}
          />
          <div className="h-4 w-8 rounded bg-slate-800 animate-pulse shrink-0" />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-slate-700/80 animate-pulse"
              style={{ width: `${barPct ?? 50}%` }}
            />
          </div>
          <div className="w-7 h-2 rounded bg-slate-800 animate-pulse shrink-0" />
        </div>
      </div>
    </li>
  );
}

// Pre-generate widths so they don't change on re-render and avoid impure Math.random() in render
const ROW_WIDTHS = Array.from({ length: 15 }, (_, i) => ({
  wide: i % 3 !== 0,
  barPct: 30 + ((i * 37 + 13) % 50), // deterministic pseudo-random widths
}));

export default function RankedListLoader({ activeSymbol }: { activeSymbol: string }) {
  const [ranked, setRanked] = useState<StockSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/ranked?limit=50`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setRanked(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <aside className="w-[280px] shrink-0 border-r border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-[#0c0e16] hidden md:flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-baseline justify-between">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Nifty 50 rankings
            </div>
            <div className="h-2.5 w-16 rounded bg-slate-700/40 animate-pulse" />
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Ranked by fusion score · ☆ to watch
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ul className="divide-y divide-slate-200 dark:divide-slate-800/40">
            {ROW_WIDTHS.map(({ wide, barPct }, i) => (
              <SkeletonRow key={i} wide={wide} barPct={barPct} />
            ))}
          </ul>
        </div>
        <div className="px-4 py-2 text-[10px] text-slate-500 border-t border-slate-200 dark:border-slate-800 shrink-0">
          Live NSE · EOD via yfinance · cached 30 min
        </div>
      </aside>
    );
  }

  return <RankedList activeSymbol={activeSymbol} ranked={ranked} />;
}
