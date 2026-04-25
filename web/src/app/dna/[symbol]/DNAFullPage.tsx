"use client";

import { useEffect, useState } from "react";
import { SeasonalStrip } from "@/components/StockDNACard";
import DarvasSection, { DarvasSkeleton, type DarvasData } from "@/components/DarvasSection";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

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

const PERSONALITY_COLORS: Record<string, string> = {
  emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  amber:   "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  sky:     "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
  rose:    "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  violet:  "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30",
  slate:   "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30",
};

const PERSONALITY_EXPLAINERS: Record<string, string> = {
  "Defensive Compounder":
    "This stock tends to fall less than the market during corrections and often outperforms during uncertainty. Ideal for long-term holders who want equity exposure without roller-coaster swings. Delivery % tends to be high — institutions accumulate quietly.",
  "Momentum Rocket":
    "This stock amplifies market moves — it rises faster in bull runs but falls harder in corrections. Best suited for traders with a clear stop-loss discipline. FII activity tends to be a leading indicator.",
  "Steady Grinder":
    "Moves closely with the Nifty 50 and rarely surprises on either side. A reliable benchmark-hugger — useful for investors who want market returns with lower individual stock risk.",
  "Volatile Wild Card":
    "High-energy stock with frequent large moves. Can double or halve in a cycle. Requires active monitoring and tight risk management. Not for the faint-hearted.",
  "Macro Bet":
    "Sensitive to macro events — budget announcements, commodity cycles, RBI rate decisions, and global risk sentiment. Can be very rewarding if you have a macro view.",
  "Balanced Player":
    "No single dominant trait — adapts reasonably well to different market conditions. Study the seasonal data to find its edges.",
};

function SeasonalCalendar({
  seasonality,
  best_months,
  worst_months,
}: {
  seasonality: Record<string, number>;
  best_months: string[];
  worst_months: string[];
}) {
  return (
    <div className="flex gap-0.5 w-full">
      {MONTHS.map((m) => {
        const val      = seasonality[m] ?? 0;
        const isBest   = best_months.includes(m);
        const isWorst  = worst_months.includes(m);
        const sign     = val >= 0 ? "+" : "";

        let bgClass = "bg-slate-200 dark:bg-slate-700";
        if (val > 1.5)   bgClass = "bg-emerald-500";
        else if (val > 0.5)  bgClass = "bg-emerald-200 dark:bg-emerald-900";
        else if (val >= -0.5) bgClass = "bg-slate-200 dark:bg-slate-700";
        else if (val >= -1.5) bgClass = "bg-rose-200 dark:bg-rose-900";
        else bgClass = "bg-rose-500";

        const borderClass = isBest
          ? "border-b-2 border-emerald-600"
          : isWorst
          ? "border-b-2 border-rose-600"
          : "";

        const textColor = val >= 0
          ? "text-emerald-900 dark:text-emerald-100"
          : "text-rose-900 dark:text-rose-100";

        return (
          <div key={m} className="flex-1 flex flex-col items-center gap-0.5">
            {isBest && (
              <span className="text-[8px] text-emerald-600 font-bold leading-none">★</span>
            )}
            {!isBest && <span className="text-[8px] leading-none opacity-0">★</span>}
            <div
              className={`w-full h-16 rounded-sm ${bgClass} ${borderClass} flex items-center justify-center`}
              title={`${sign}${val.toFixed(1)}%`}
            >
              <span className={`text-[9px] font-bold leading-none ${textColor}`}>
                {sign}{val.toFixed(1)}
              </span>
            </div>
            <span className="text-[9px] text-slate-500 text-center leading-none">{m}</span>
          </div>
        );
      })}
    </div>
  );
}

function StatCard({
  label,
  value,
  description,
  valueClass,
}: {
  label: string;
  value: string;
  description: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0d0f1a] p-4">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-black mb-1 ${valueClass ?? "text-slate-900 dark:text-slate-100"}`}>{value}</div>
      <div className="text-[11px] text-slate-500 leading-relaxed">{description}</div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10 animate-pulse">
      <div className="h-16 w-16 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto mb-4" />
      <div className="h-8 w-48 rounded bg-slate-200 dark:bg-slate-700 mx-auto mb-3" />
      <div className="h-4 w-64 rounded bg-slate-100 dark:bg-slate-800 mx-auto mb-6" />
      <div className="h-20 w-full rounded bg-slate-100 dark:bg-slate-800 mb-8" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[1,2,3,4].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
      <div className="h-32 w-full rounded bg-slate-100 dark:bg-slate-800 mb-8" />
      <DarvasSkeleton />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DNAFullPage({ symbol, name }: { symbol: string; name: string }) {
  const [data, setData]       = useState<DNAData | null>(null);
  const [error, setError]     = useState(false);
  const [loading, setLoading] = useState(true);
  const [darvas, setDarvas]   = useState<DarvasData | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setData(null);
    setDarvas(null);

    Promise.allSettled([
      fetch(`${API_BASE}/dna/${encodeURIComponent(symbol)}`).then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<DNAData>;
      }),
      fetch(`${API_BASE}/darvas/${encodeURIComponent(symbol)}`)
        .then((r) => (r.ok ? (r.json() as Promise<DarvasData>) : null))
        .catch(() => null),
    ]).then(([dnaRes, darvasRes]) => {
      if (dnaRes.status === "fulfilled") {
        setData(dnaRes.value);
      } else {
        setError(true);
      }
      setDarvas(darvasRes.status === "fulfilled" ? darvasRes.value : null);
      setLoading(false);
    });
  }, [symbol]);

  if (loading) return <Skeleton />;

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <div className="text-4xl mb-4">🧬</div>
        <h2 className="text-xl font-bold mb-2 text-slate-700 dark:text-slate-300">DNA profile unavailable</h2>
        <p className="text-sm text-slate-500">
          We couldn&apos;t load the behavioral fingerprint for {name}. Please try again later.
        </p>
      </div>
    );
  }

  const badgeClass = PERSONALITY_COLORS[data.personality_color] ?? PERSONALITY_COLORS["slate"];
  const explainer  = PERSONALITY_EXPLAINERS[data.personality_type] ?? "";

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">

      {/* ── Hero section ── */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">{data.personality_icon}</div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-1">{data.personality_type}</h1>
        <p className="text-slate-500 italic mb-3">{data.tagline}</p>
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1 rounded-full border ${badgeClass}`}>
          {data.symbol} · {data.name}
        </span>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 mt-3 mb-6 max-w-xl mx-auto">
          {data.narrative}
        </p>
      </div>

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Beta"
          value={data.stats.beta.toFixed(2)}
          description="vs Nifty 50 — how much it amplifies market moves"
        />
        <StatCard
          label="Volatility"
          value={data.stats.volatility_rank}
          description={`Avg daily range: ${data.stats.avg_atr_pct.toFixed(1)}%`}
        />
        <StatCard
          label="Max Drawdown"
          value={`${data.stats.max_drawdown_pct.toFixed(1)}%`}
          description={`Recovered in ${data.stats.recovery_days} days`}
          valueClass="text-rose-500"
        />
        <StatCard
          label="Nifty Correlation"
          value={data.stats.correlation_nifty.toFixed(2)}
          description="1.0 = moves in lockstep with the index"
        />
      </div>

      {/* ── Seasonal calendar ── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11131c] p-5 mb-8">
        <div className="mb-3">
          <div className="text-base font-black text-slate-900 dark:text-slate-100">Seasonal strength</div>
          <div className="text-[11px] text-slate-500">
            Average monthly return over {data.stats.data_years} years of NSE data
          </div>
        </div>
        <SeasonalCalendar
          seasonality={data.seasonality}
          best_months={data.best_months}
          worst_months={data.worst_months}
        />
        <div className="flex gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
            <span className="text-[10px] text-slate-500">Strong ({">"}1.5%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-rose-500" />
            <span className="text-[10px] text-slate-500">Weak ({"<"}-1.5%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-emerald-600 font-bold">★</span>
            <span className="text-[10px] text-slate-500">Best months</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-rose-600" />
            <span className="text-[10px] text-slate-500">Worst months</span>
          </div>
        </div>
      </div>

      {/* ── Darvas Box Analysis ── */}
      {darvas && <DarvasSection data={darvas} />}

      {/* ── Personality explainer ── */}
      {explainer && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11131c] p-5 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">{data.personality_icon}</span>
            <div className="text-base font-black text-slate-900 dark:text-slate-100">
              What &ldquo;{data.personality_type}&rdquo; means for you
            </div>
          </div>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{explainer}</p>
        </div>
      )}

      {/* ── Footer note ── */}
      <p className="text-[11px] text-slate-400 text-center leading-relaxed">
        Based on {data.stats.data_years} years of NSE price data. Past seasonal patterns don&apos;t guarantee future
        results. Educational only.
      </p>
    </div>
  );
}
