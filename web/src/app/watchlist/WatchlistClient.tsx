"use client";

/**
 * WatchlistClient — renders the user's saved symbols as live verdict cards.
 *
 * Data flow: we reuse the lightweight `/screener` endpoint (same as
 * LandingTopPicks) so we don't fire N individual `/snapshot` calls for a
 * 20-item watchlist. The response contains verdicts for every covered
 * ticker; we filter client-side to the watched set.
 *
 * The page re-renders whenever the watchlist changes in this tab or any
 * other (see `subscribeWatchlist`).
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toSlug } from "@/lib/nifty50";
import DigestOptIn from "@/components/DigestOptIn";
import {
  getWatchlist,
  subscribeWatchlist,
  toggleWatch,
  WATCHLIST_MAX,
} from "@/lib/watchlist";

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

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0c0e16] p-10 text-center">
      <div className="text-4xl mb-3">⭐</div>
      <h2 className="text-lg font-bold mb-2">Your watchlist is empty</h2>
      <p className="text-[13px] text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
        Browse the signals and tap the{" "}
        <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
          <span>☆</span>Watch
        </span>{" "}
        button on any stock to pin it here. You can track up to {WATCHLIST_MAX} stocks.
      </p>
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <Link
          href="/signals"
          className="rounded-full bg-amber-400 px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300 transition"
        >
          Browse Nifty 50 signals →
        </Link>
        <Link
          href="/canvas"
          className="rounded-full border border-slate-300 dark:border-slate-700 px-5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:border-amber-400/60 transition"
        >
          Open canvas
        </Link>
      </div>
    </div>
  );
}

export default function WatchlistClient() {
  const [watched, setWatched] = useState<string[] | null>(null); // null = hydrating
  const [stocks, setStocks] = useState<SlimStock[] | null>(null);
  const [fetchFailed, setFetchFailed] = useState(false);

  // Hydrate watchlist from localStorage + subscribe to changes
  useEffect(() => {
    const sync = () => setWatched(getWatchlist());
    sync();
    return subscribeWatchlist(sync);
  }, []);

  // Fetch live verdicts once per mount. Watchlist changes don't require a
  // re-fetch — we just re-filter the same payload.
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/screener`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((all: SlimStock[]) => {
        if (!cancelled) setStocks(all);
      })
      .catch(() => {
        if (!cancelled) {
          setStocks([]);
          setFetchFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Merge watchlist with live data. Entries missing from /screener (e.g. a
  // stock dropped from coverage) are still shown, flagged as "unavailable".
  const rows = useMemo(() => {
    if (watched === null) return null;
    if (watched.length === 0) return [];
    const bySymbol = new Map((stocks ?? []).map((s) => [s.symbol, s]));
    const items = watched.map((sym) => ({
      symbol: sym,
      data: bySymbol.get(sym) ?? null,
    }));
    // Sort: live entries first (by probability desc), then unavailable ones.
    items.sort((a, b) => {
      if (a.data && !b.data) return -1;
      if (!a.data && b.data) return 1;
      if (a.data && b.data) return b.data.probability - a.data.probability;
      return a.symbol.localeCompare(b.symbol);
    });
    return items;
  }, [watched, stocks]);

  // Before localStorage resolves, render skeletons so there's no layout flash.
  if (rows === null || (watched && watched.length > 0 && stocks === null)) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState />;
  }

  const stats = (() => {
    let buy = 0, hold = 0, sell = 0, unavail = 0;
    for (const r of rows) {
      if (!r.data) unavail += 1;
      else if (r.data.verdict === "BUY") buy += 1;
      else if (r.data.verdict === "HOLD") hold += 1;
      else sell += 1;
    }
    return { buy, hold, sell, unavail };
  })();

  return (
    <>
      {/* summary strip */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-3 flex-wrap">
          <span>{rows.length} / {WATCHLIST_MAX} stocks</span>
          {stats.buy > 0 && <span className="text-emerald-600 dark:text-emerald-400">● {stats.buy} BUY</span>}
          {stats.hold > 0 && <span className="text-amber-600 dark:text-amber-400">● {stats.hold} HOLD</span>}
          {stats.sell > 0 && <span className="text-rose-600 dark:text-rose-400">● {stats.sell} SELL</span>}
          {stats.unavail > 0 && <span className="text-slate-400">● {stats.unavail} unavailable</span>}
        </div>
        {fetchFailed && (
          <span className="text-[11px] text-rose-600 dark:text-rose-400">
            Live data unavailable — verdicts may be stale.
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map(({ symbol, data }) => {
          const slug = toSlug(symbol);
          const pct = data ? Math.round(data.probability * 100) : null;

          return (
            <div
              key={symbol}
              className="group relative rounded-xl border border-slate-200 bg-white hover:border-slate-400 dark:border-slate-800 dark:bg-[#11131c] dark:hover:border-slate-600 transition overflow-hidden"
            >
              {/* remove star — absolute so it overlaps the card but doesn't nest a button in a link */}
              <button
                type="button"
                onClick={() => toggleWatch(symbol)}
                aria-label="Remove from watchlist"
                title="Remove from watchlist"
                className="absolute top-2 right-2 z-10 text-amber-500 hover:text-amber-600 text-base leading-none p-1 rounded-full hover:bg-amber-500/10 transition"
              >
                ★
              </button>

              <Link href={`/signals/${slug}`} className="block p-4">
                <div className="flex items-start justify-between mb-2.5 pr-6">
                  <div>
                    <div className="text-sm font-bold group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
                      {slug}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[140px]">
                      {data?.name ?? symbol}
                    </div>
                  </div>
                  {data ? (
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ml-2 ${VERDICT_COLOR[data.verdict] ?? ""}`}>
                      {data.verdict}
                    </div>
                  ) : (
                    <div className="text-[10px] font-bold px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-slate-500 shrink-0 ml-2">
                      —
                    </div>
                  )}
                </div>

                {data && pct !== null ? (
                  <>
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${VERDICT_BAR[data.verdict] ?? "bg-slate-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                        {pct}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <span>₹{data.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-600 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
                        View analysis →
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-slate-500 italic">
                    Live verdict unavailable — tap to open analysis.
                  </div>
                )}
              </Link>
            </div>
          );
        })}
      </div>

      {/* daily digest opt-in */}
      <div className="mt-10">
        <DigestOptIn />
      </div>
    </>
  );
}
