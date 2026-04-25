"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

interface DNAStats {
  beta: number;
  correlation_nifty: number;
  avg_atr_pct: number;
  volatility_rank: string;
  gap_frequency: number;
  momentum_persistence: number;
  max_drawdown_pct: number;
  recovery_days: number;
  data_years: number;
}

interface DNAData {
  symbol: string;
  name: string;
  personality_type: string;
  personality_icon: string;
  personality_color: string;
  tagline: string;
  narrative: string;
  stats: DNAStats;
  seasonality: Record<string, number>;
  best_months: string[];
  worst_months: string[];
  as_of: string;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const PERSONALITY_COLORS: Record<string, string> = {
  emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  amber:   "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  sky:     "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
  rose:    "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  violet:  "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30",
  slate:   "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30",
};

function seasonalBoxColor(val: number): string {
  if (val > 1.5)  return "bg-emerald-500";
  if (val > 0.5)  return "bg-emerald-200 dark:bg-emerald-900";
  if (val >= -0.5) return "bg-slate-200 dark:bg-slate-700";
  if (val >= -1.5) return "bg-rose-200 dark:bg-rose-900";
  return "bg-rose-500";
}

function SeasonalStrip({
  seasonality,
  best_months,
  worst_months,
  tall = false,
  showValues = false,
}: {
  seasonality: Record<string, number>;
  best_months: string[];
  worst_months: string[];
  tall?: boolean;
  showValues?: boolean;
}) {
  return (
    <div className="flex gap-0.5 w-full">
      {MONTHS.map((m) => {
        const val = seasonality[m] ?? 0;
        const isBest  = best_months.includes(m);
        const isWorst = worst_months.includes(m);
        const borderClass = isBest
          ? "border-b-2 border-emerald-600"
          : isWorst
          ? "border-b-2 border-rose-600"
          : "";
        const sign = val >= 0 ? "+" : "";
        return (
          <div
            key={m}
            className="flex-1 flex flex-col items-center gap-0.5"
          >
            <div
              className={`w-full ${tall ? "h-16" : "h-8"} rounded-sm ${seasonalBoxColor(val)} ${borderClass} flex items-center justify-center`}
              title={`${sign}${val.toFixed(1)}%`}
            >
              {showValues && (
                <span
                  className={`text-[8px] font-bold leading-none ${val >= 0 ? "text-emerald-900 dark:text-emerald-100" : "text-rose-900 dark:text-rose-100"}`}
                >
                  {sign}{val.toFixed(1)}
                </span>
              )}
            </div>
            <span className="text-[9px] text-slate-500 text-center leading-none">{m}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function DNASkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11131c] p-4 animate-pulse mb-6">
      {/* header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-6 w-36 rounded-full bg-slate-200 dark:bg-slate-700" />
      </div>
      {/* tagline */}
      <div className="h-3 w-48 rounded bg-slate-100 dark:bg-slate-800 mb-4" />
      {/* stats row */}
      <div className="flex gap-4 mb-4">
        {[1,2,3,4].map((i) => (
          <div key={i} className="flex-1">
            <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 mb-1" />
            <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>
      {/* seasonal strip */}
      <div className="flex gap-0.5 w-full">
        {MONTHS.map((m) => (
          <div key={m} className="flex-1 h-8 rounded-sm bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StockDNACard({ symbol, name }: { symbol: string; name: string }) {
  const [data, setData]     = useState<DNAData | null>(null);
  const [error, setError]   = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setData(null);
    fetch(`${API_BASE}/dna/${encodeURIComponent(symbol)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<DNAData>;
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [symbol]);

  if (loading) return <DNASkeleton />;

  if (error || !data) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11131c] p-4 mb-6">
        <div className="text-sm text-slate-400">DNA profile unavailable for this stock.</div>
      </div>
    );
  }

  const badgeClass = PERSONALITY_COLORS[data.personality_color] ?? PERSONALITY_COLORS["slate"];
  const symSlug = symbol.replace(".NS", "").replace(".BO", "");

  const maxDDClass   = "text-rose-500";
  const recoveryClass = data.stats.recovery_days > 90 ? "text-amber-500" : "text-sm font-bold";

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11131c] p-4 mb-6">
      {/* header */}
      <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">🧬 Stock DNA</span>
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border ${badgeClass}`}>
          <span>{data.personality_icon}</span>
          <span>{data.personality_type}</span>
        </span>
      </div>

      {/* tagline */}
      <p className="text-[12px] text-slate-500 italic mb-4">&ldquo;{data.tagline}&rdquo;</p>

      {/* stats row */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider leading-tight mb-0.5">Beta</div>
          <div className="text-sm font-bold">{data.stats.beta.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider leading-tight mb-0.5">Volatility</div>
          <div className="text-sm font-bold">{data.stats.volatility_rank}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider leading-tight mb-0.5">Max DD</div>
          <div className={`text-sm font-bold ${maxDDClass}`}>{data.stats.max_drawdown_pct.toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider leading-tight mb-0.5">Recovery</div>
          <div className={`text-sm font-bold ${recoveryClass}`}>{data.stats.recovery_days}d</div>
        </div>
      </div>

      {/* seasonal strip */}
      <div className="mb-1">
        <div className="text-[10px] text-slate-500 mb-1.5">Seasonal strength (avg monthly return %)</div>
        <SeasonalStrip
          seasonality={data.seasonality}
          best_months={data.best_months}
          worst_months={data.worst_months}
        />
      </div>

      {/* CTA */}
      <div className="mt-3 text-right">
        <Link
          href={`/dna/${symSlug}`}
          className="text-[11px] text-amber-600 hover:text-amber-500 font-semibold transition"
        >
          View full DNA →
        </Link>
      </div>
    </div>
  );
}

export { SeasonalStrip };
