"use client";

/**
 * CanvasLegend — compact overlay in the top-right of the signal canvas
 * explaining the 6 indicator edge colours, their weight in the fusion score,
 * and the BUY/HOLD/SELL thresholds. Collapsible to an "ℹ" pill so power
 * users can dismiss it on repeat visits.
 *
 * Colour values MUST mirror `edgeColor` in StockCanvas.tsx — if you change
 * a hue there, change it here.
 */

import { useEffect, useState } from "react";

type Row = {
  key: string;
  label: string;
  weight: string;
  color: string;
};

const ROWS: Row[] = [
  { key: "rs",       label: "RS vs Nifty 500",  weight: "20%", color: "#34d399" },
  { key: "delivery", label: "NSE Delivery %",   weight: "20%", color: "#22d3ee" },
  { key: "ema",      label: "EMA 20/50/200",    weight: "18%", color: "#fbbf24" },
  { key: "momentum", label: "Momentum 20D",     weight: "17%", color: "#fb923c" },
  { key: "volume",   label: "Volume vs VWAP",   weight: "15%", color: "#a78bfa" },
  { key: "aiNews",   label: "AI News Sentiment", weight: "10%", color: "#e879f9" },
];

const LS_KEY = "mm.canvasLegendCollapsed";

export default function CanvasLegend() {
  const [collapsed, setCollapsed] = useState<boolean | null>(null); // null = hydrating

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LS_KEY);
      // Default: collapsed — first-time users see the ℹ pill, not a full panel eating canvas space
      setCollapsed(stored === null ? true : stored === "1");
    } catch {
      setCollapsed(true);
    }
  }, []);

  const persist = (v: boolean) => {
    setCollapsed(v);
    try {
      window.localStorage.setItem(LS_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  // Don't render anything on first paint — avoids layout flash between
  // SSR (no localStorage) and client.
  if (collapsed === null) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => persist(false)}
        className="absolute top-3 right-3 z-10 rounded-full border border-slate-300 bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur hover:bg-white dark:border-slate-700 dark:bg-[#11131c]/90 dark:text-slate-200 dark:hover:bg-[#11131c] transition"
        title="Show indicator legend"
      >
        <span className="mr-1.5">🎨</span>Legend
      </button>
    );
  }

  return (
    <div className="absolute top-3 right-3 z-10 w-[220px] rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-[#11131c]/95">
      {/* header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-[11px] font-bold text-slate-900 dark:text-slate-100">
            Signal legend
          </div>
          <div className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
            Edge colour · indicator · weight
          </div>
        </div>
        <button
          type="button"
          onClick={() => persist(true)}
          aria-label="Hide legend"
          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-base leading-none px-1"
          title="Hide"
        >
          ×
        </button>
      </div>

      {/* rows */}
      <div className="px-3 py-2 space-y-1.5">
        {ROWS.map((r) => (
          <div key={r.key} className="flex items-center gap-2 text-[11px]">
            <span
              className="h-0.5 w-4 rounded-full shrink-0"
              style={{ backgroundColor: r.color }}
            />
            <span className="flex-1 text-slate-700 dark:text-slate-300 truncate">
              {r.label}
            </span>
            <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
              {r.weight}
            </span>
          </div>
        ))}
      </div>

      {/* verdict thresholds */}
      <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
          Verdict
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">● BUY</span>
          <span className="font-mono text-slate-500">P ≥ 0.65</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-amber-600 dark:text-amber-400 font-semibold">● HOLD</span>
          <span className="font-mono text-slate-500">0.35–0.65</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-rose-600 dark:text-rose-400 font-semibold">● SELL</span>
          <span className="font-mono text-slate-500">P ≤ 0.35</span>
        </div>
      </div>
    </div>
  );
}
