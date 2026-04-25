"use client";

/**
 * SectorHeatmap — at-a-glance view of which Nifty sectors are bullish today.
 *
 * Joins /screener (backend truth for price + verdict) with the local ticker
 * registry (has sector metadata). Groups by sector and renders a ranked list
 * of stacked B/H/S bars so a trader can read market breadth in one glance.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TICKERS, type TickerEntry } from "@/lib/tickers";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

type SlimStock = {
  symbol: string;
  verdict: "BUY" | "HOLD" | "SELL";
  probability: number;
};

type SectorAgg = {
  sector: string;
  buy: number;
  hold: number;
  sell: number;
  total: number;
  avgProb: number;
  pctBuy: number;
};

function aggregateBySector(stocks: SlimStock[], tickers: TickerEntry[]): SectorAgg[] {
  const bySymbol = new Map(tickers.map((t) => [t.symbol, t.sector]));
  const bucket = new Map<string, { buy: number; hold: number; sell: number; probSum: number }>();

  for (const s of stocks) {
    const sector = bySymbol.get(s.symbol);
    if (!sector || sector === "Index") continue;
    const b = bucket.get(sector) ?? { buy: 0, hold: 0, sell: 0, probSum: 0 };
    if (s.verdict === "BUY") b.buy += 1;
    else if (s.verdict === "HOLD") b.hold += 1;
    else b.sell += 1;
    b.probSum += s.probability;
    bucket.set(sector, b);
  }

  const rows: SectorAgg[] = [];
  for (const [sector, b] of bucket) {
    const total = b.buy + b.hold + b.sell;
    if (total === 0) continue;
    rows.push({
      sector,
      buy: b.buy,
      hold: b.hold,
      sell: b.sell,
      total,
      avgProb: b.probSum / total,
      pctBuy: b.buy / total,
    });
  }

  // Sort: strongest bullish first, but keep sectors with only 1 stock at the bottom
  // (single-stock "sectors" are noisy)
  rows.sort((a, b) => {
    if (a.total === 1 && b.total > 1) return 1;
    if (b.total === 1 && a.total > 1) return -1;
    return b.avgProb - a.avgProb;
  });
  return rows;
}

function SectorRow({ row }: { row: SectorAgg }) {
  const pctBuy = Math.round(row.pctBuy * 100);
  const buyPct = (row.buy / row.total) * 100;
  const holdPct = (row.hold / row.total) * 100;
  const sellPct = (row.sell / row.total) * 100;

  const tone =
    row.pctBuy >= 0.6
      ? "text-emerald-600 dark:text-emerald-300"
      : row.pctBuy >= 0.3
      ? "text-amber-600 dark:text-amber-300"
      : "text-rose-600 dark:text-rose-300";

  return (
    <div
      className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/40 transition"
      title={`${row.sector}: ${row.buy} BUY / ${row.hold} HOLD / ${row.sell} SELL · avg ${Math.round(row.avgProb * 100)}%`}
    >
      <div className="w-20 text-[12px] font-semibold text-slate-800 dark:text-slate-200 shrink-0 truncate">
        {row.sector}
      </div>
      <div className="flex-1 h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex">
        {buyPct > 0 && <div className="h-full bg-emerald-500" style={{ width: `${buyPct}%` }} />}
        {holdPct > 0 && <div className="h-full bg-amber-500" style={{ width: `${holdPct}%` }} />}
        {sellPct > 0 && <div className="h-full bg-rose-500" style={{ width: `${sellPct}%` }} />}
      </div>
      <div className={`w-12 text-right text-[11px] font-mono font-semibold shrink-0 ${tone}`}>
        {pctBuy}%
      </div>
      <div className="w-16 text-right text-[10px] font-mono text-slate-500 shrink-0 tabular-nums">
        {row.buy}/{row.hold}/{row.sell}
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-2 px-3 animate-pulse">
      <div className="w-20 h-3 rounded bg-slate-200 dark:bg-slate-800 shrink-0" />
      <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-800" />
      <div className="w-12 h-3 rounded bg-slate-200 dark:bg-slate-800 shrink-0" />
      <div className="w-16 h-3 rounded bg-slate-100 dark:bg-slate-800/60 shrink-0" />
    </div>
  );
}

export default function SectorHeatmap() {
  const [stocks, setStocks] = useState<SlimStock[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/screener`)
      .then((r) => (r.ok ? r.json() : []))
      .then((all: SlimStock[]) => {
        if (!cancelled) setStocks(all);
      })
      .catch(() => {
        if (!cancelled) setStocks([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(
    () => (stocks ? aggregateBySector(stocks, TICKERS) : []),
    [stocks],
  );

  // Market-wide totals for header
  const market = useMemo(() => {
    if (!stocks) return null;
    let buy = 0, hold = 0, sell = 0;
    for (const s of stocks) {
      if (s.verdict === "BUY") buy += 1;
      else if (s.verdict === "HOLD") hold += 1;
      else sell += 1;
    }
    return { buy, hold, sell, total: buy + hold + sell };
  }, [stocks]);

  const isLoading = stocks === null;
  const isEmpty = !isLoading && rows.length === 0;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11131c] p-4">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Sector breadth
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            How each Nifty sector is scoring today
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {market && market.total > 0 && (
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <span className="text-emerald-600 dark:text-emerald-400">● {market.buy} BUY</span>
              <span className="text-amber-600 dark:text-amber-400">● {market.hold} HOLD</span>
              <span className="text-rose-600 dark:text-rose-400">● {market.sell} SELL</span>
            </div>
          )}
          <Link
            href="/sectors"
            className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-500 transition"
          >
            View sector rotation →
          </Link>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-0.5">
          {Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)}
        </div>
      )}

      {isEmpty && (
        <div className="py-6 text-center text-[12px] text-slate-500">
          Sector data unavailable — open the canvas to warm up the API.
        </div>
      )}

      {!isLoading && rows.length > 0 && (
        <>
          <div className="space-y-0.5">
            {rows.map((r) => <SectorRow key={r.sector} row={r} />)}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3 text-[10px] text-slate-500 font-mono">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> BUY</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-500" /> HOLD</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-rose-500" /> SELL</span>
            <span className="ml-auto">% = share of sector rated BUY</span>
          </div>
        </>
      )}
    </div>
  );
}
