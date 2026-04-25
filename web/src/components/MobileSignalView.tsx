"use client";

import Link from "next/link";
import type { StockSnapshot } from "@/lib/types";

const VERDICT_STYLES = {
  BUY:  { badge: "bg-emerald-500 text-white", bar: "bg-emerald-500" },
  HOLD: { badge: "bg-amber-400 text-black",   bar: "bg-amber-400"   },
  SELL: { badge: "bg-rose-500 text-white",     bar: "bg-rose-500"    },
};

function scoreColor(score: number) {
  if (score >= 0.4)  return "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30";
  if (score >= 0.1)  return "bg-teal-500/20 text-teal-300 ring-1 ring-teal-500/30";
  if (score > -0.1)  return "bg-slate-600/40 text-slate-300 ring-1 ring-slate-500/30";
  if (score > -0.4)  return "bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/30";
  return "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/30";
}

export default function MobileSignalView({ snapshot }: { snapshot: StockSnapshot }) {
  const { name, symbol, fusion, indicators } = snapshot;
  const { probability, verdict, synthesis } = fusion;
  const pct = Math.round(probability * 100);
  const vs = VERDICT_STYLES[verdict];

  const pills = [
    { key: "RS",         score: indicators.rs.score,       label: indicators.rs.label       },
    { key: "Delivery",   score: indicators.delivery.score,  label: indicators.delivery.label  },
    { key: "EMA",        score: indicators.ema.score,       label: indicators.ema.label       },
    { key: "Momentum",   score: indicators.momentum.score,  label: indicators.momentum.label  },
    { key: "VWAP",       score: indicators.volume.score,    label: indicators.volume.label    },
    { key: "News",       score: indicators.aiNews?.score ?? 0, label: indicators.aiNews?.label ?? "N/A" },
  ];

  const displaySym = symbol.replace(/\.(NS|BO)$/, "");

  return (
    <div className="min-h-screen bg-[#0a0b10] px-4 py-6 flex flex-col gap-4">
      {/* Header card */}
      <div className="rounded-xl bg-[#11131c] ring-1 ring-white/5 shadow-lg shadow-slate-900/50 p-4 flex flex-col gap-3">
        {/* Company + verdict badge */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{displaySym}</div>
            <div className="text-base font-bold text-slate-100 leading-tight mt-0.5">{name}</div>
          </div>
          <span className={`shrink-0 px-3 py-1 rounded-lg text-sm font-black tracking-wider ${vs.badge}`}>
            {verdict}
          </span>
        </div>

        {/* Probability bar */}
        <div>
          <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-1">
            <span>Signal strength</span>
            <span className="text-slate-200 font-semibold">{pct}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${vs.bar}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-[8px] text-slate-600 mt-0.5">
            <span>SELL ← 35%</span>
            <span>65% → BUY</span>
          </div>
        </div>
      </div>

      {/* AI Synthesis */}
      {synthesis && (
        <div className="rounded-xl bg-[#11131c] ring-1 ring-white/5 shadow-lg shadow-slate-900/50 p-4 flex flex-col gap-3">
          <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <span>⚡</span> AI Analysis
          </div>
          <p className="text-[13px] text-slate-200 leading-relaxed">{synthesis.verdict}</p>
          <div className="grid grid-cols-1 gap-2 mt-1">
            <div className="rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20 px-3 py-2">
              <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide mb-0.5">Bull case</div>
              <div className="text-[11px] text-slate-300 leading-snug">{synthesis.bull}</div>
            </div>
            <div className="rounded-lg bg-rose-500/10 ring-1 ring-rose-500/20 px-3 py-2">
              <div className="text-[9px] font-bold text-rose-400 uppercase tracking-wide mb-0.5">Bear case</div>
              <div className="text-[11px] text-slate-300 leading-snug">{synthesis.bear}</div>
            </div>
            {synthesis.risk && (
              <div className="rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20 px-3 py-2">
                <div className="text-[9px] font-bold text-amber-400 uppercase tracking-wide mb-0.5">Risk</div>
                <div className="text-[11px] text-slate-300 leading-snug">{synthesis.risk}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Indicator pills */}
      <div className="rounded-xl bg-[#11131c] ring-1 ring-white/5 shadow-lg shadow-slate-900/50 p-4">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">6 Indicators</div>
        <div className="grid grid-cols-2 gap-2">
          {pills.map(({ key, score, label }) => (
            <div
              key={key}
              className={`rounded-lg px-2.5 py-2 ${scoreColor(score)}`}
            >
              <div className="text-[9px] font-bold uppercase tracking-wide opacity-70 mb-0.5">{key}</div>
              <div className="text-[11px] font-mono font-semibold truncate">{label}</div>
              <div className="text-[9px] font-mono opacity-60 mt-0.5">
                {score >= 0 ? "+" : ""}{score.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <Link
        href={`/canvas?symbol=${encodeURIComponent(symbol)}`}
        className="block w-full rounded-xl bg-amber-500/10 ring-1 ring-amber-400/40 hover:ring-amber-400/70 hover:bg-amber-500/15 transition px-4 py-3 text-center text-sm font-semibold text-amber-400"
      >
        View full canvas →
      </Link>

      <p className="text-center text-[9px] text-slate-600 pb-2">
        Educational research tool · not investment advice · MarketMithra © 2026
      </p>
    </div>
  );
}
