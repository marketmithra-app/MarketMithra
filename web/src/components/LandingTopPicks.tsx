"use client";

/**
 * LandingTopPicks — async client component for the hero stock grid.
 *
 * Fetches the lightweight /screener endpoint (no price series) so the
 * landing page renders instantly from Vercel edge cache while the Railway
 * API warms up in the background.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { toSlug } from "@/lib/nifty50";
import FreshnessBadge from "@/components/FreshnessBadge";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

type SlimStock = {
  symbol: string;
  name: string;
  price: number;
  verdict: "BUY" | "HOLD" | "SELL";
  probability: number;
};

const VERDICT_COLOR: Record<string, string> = {
  BUY:  "text-emerald-700 dark:text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  HOLD: "text-amber-700  dark:text-amber-300  border-amber-500/40  bg-amber-500/10",
  SELL: "text-rose-700   dark:text-rose-300   border-rose-500/40   bg-rose-500/10",
};

const VERDICT_BAR: Record<string, string> = {
  BUY:  "bg-emerald-500",
  HOLD: "bg-amber-500",
  SELL: "bg-rose-500",
};

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11131c] p-4 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="space-y-1.5">
          <div className="h-3.5 w-20 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-2.5 w-32 rounded bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="h-5 w-10 rounded bg-slate-200 dark:bg-slate-700 shrink-0" />
      </div>
      <div className="flex items-center gap-2 mb-2.5">
        <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800" />
        <div className="h-2.5 w-8 rounded bg-slate-200 dark:bg-slate-700 shrink-0" />
      </div>
      <div className="flex items-center justify-between">
        <div className="h-2.5 w-16 rounded bg-slate-100 dark:bg-slate-800" />
        <div className="h-2.5 w-20 rounded bg-slate-100 dark:bg-slate-800" />
      </div>
    </div>
  );
}

export default function LandingTopPicks() {
  const [stocks, setStocks] = useState<SlimStock[] | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/screener`)
      .then((r) => (r.ok ? r.json() : []))
      .then((all: SlimStock[]) => {
        // Sort by probability desc, take top 6
        const sorted = [...all].sort((a, b) => b.probability - a.probability).slice(0, 6);
        setStocks(sorted);
      })
      .catch(() => setStocks([]));

    // Separate lightweight call — doesn't block the grid render.
    fetch(`${API_BASE}/status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { asOf: string | null } | null) => { if (s) setAsOf(s.asOf); })
      .catch(() => {});
  }, []);

  // Still loading — show skeleton grid
  if (stocks === null) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  // API unreachable or returned nothing
  if (stocks.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500">
        Live rankings warming up — open the app to fetch fresh signals.
      </div>
    );
  }

  return (
    <>
      {asOf && (
        <div className="flex justify-end mb-2">
          <FreshnessBadge asOf={asOf} size="sm" prefix="Data · " />
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {stocks.map((s) => {
        const pct      = Math.round(s.probability * 100);
        const symClean = toSlug(s.symbol);
        return (
          <Link
            key={s.symbol}
            href={`/signals/${symClean}`}
            className="group rounded-xl border border-slate-200 bg-white hover:border-slate-400 dark:border-slate-800 dark:bg-[#11131c] dark:hover:border-slate-600 p-4 transition overflow-hidden"
          >
            <div className="flex items-start justify-between mb-2.5">
              <div>
                <div className="text-sm font-bold group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
                  {symClean}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[140px]">
                  {s.name}
                </div>
              </div>
              <div className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ml-2 ${VERDICT_COLOR[s.verdict] ?? ""}`}>
                {s.verdict}
              </div>
            </div>

            {/* probability bar */}
            <div className="flex items-center gap-2 mb-2.5">
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${VERDICT_BAR[s.verdict] ?? "bg-slate-500"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                {pct}%
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
              <span>₹{s.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-600 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
                View analysis →
              </span>
            </div>
          </Link>
        );
      })}
      </div>
    </>
  );
}
