"use client";

import { useEffect, useState } from "react";
import PanicGauge from "@/components/PanicGauge";
import PanicBreakdown from "@/components/PanicBreakdown";
import PanicHistory from "@/components/PanicHistory";

interface ComponentData {
  value: number;
  score: number;
  weight: number;
  label: string;
}

interface PanicData {
  score: number;
  zone: string;
  components: Record<string, ComponentData>;
  history: { date: string; score: number; zone: string }[];
  as_of: string;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

const EXPLAINER_CARDS = [
  {
    key: "vix",
    icon: "📉",
    title: "India VIX",
    weight: "35%",
    body: "The NSE fear gauge — measures how much the options market expects the Nifty to swing over the next 30 days. A VIX above 20 signals elevated anxiety; above 30 means genuine panic. Low VIX (below 12) means the market is complacent — often a warning sign of its own.",
  },
  {
    key: "breadth",
    icon: "📊",
    title: "Market breadth",
    weight: "30%",
    body: "Counts how many Nifty 50 stocks are in a bullish vs. bearish trend. When breadth collapses — most stocks falling even if the index holds — it signals that selling is broad and structural, not just sector-specific noise.",
  },
  {
    key: "delivery",
    icon: "📦",
    title: "Delivery strength",
    weight: "20%",
    body: "NSE publishes the % of traded volume that results in actual stock delivery (vs. intraday squaring off). High delivery % means real buyers are accumulating, not just day-traders. Falling delivery during a rally often flags weak hands — a fear signal.",
  },
  {
    key: "momentum",
    icon: "⚡",
    title: "Momentum breadth",
    weight: "15%",
    body: "Tracks the ratio of Nifty 50 stocks with positive short-term price momentum. When momentum breadth shrinks, fewer stocks are participating in any rally — the market is narrowing, which historically precedes reversals or prolonged sideways action.",
  },
];

function SkeletonBreakdown() {
  return (
    <div className="grid grid-cols-1 gap-4 w-full">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-1.5 animate-pulse">
          <div className="flex justify-between">
            <div className="h-3 w-28 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-12 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
          <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default function PanicPage() {
  const [data, setData] = useState<PanicData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/panic`, { signal: AbortSignal.timeout(10000) })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      });
  }, []);

  const loading = !data && !error;

  return (
    <div className="space-y-10">
      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-rose-400/40 bg-rose-50 dark:bg-rose-500/10 px-5 py-4 text-sm text-rose-700 dark:text-rose-400">
          Could not load Panic-O-Meter data — API unreachable. ({error})
        </div>
      )}

      {/* Gauge + Breakdown */}
      <div className="grid md:grid-cols-[320px_1fr] gap-8 items-start">
        <div className="flex flex-col items-center gap-4">
          <PanicGauge
            score={data?.score ?? 50}
            zone={data?.zone ?? "Neutral"}
            loading={loading}
          />
          {data && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
              As of {data.as_of} · refreshes every 30 min
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Component breakdown
          </div>
          {loading ? (
            <SkeletonBreakdown />
          ) : data ? (
            <PanicBreakdown components={data.components} />
          ) : null}
        </div>
      </div>

      {/* History sparkline */}
      {(loading || data) && (
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
            30-day score history
          </div>
          {loading ? (
            <div className="h-[60px] w-full animate-pulse bg-slate-200 dark:bg-slate-800 rounded-lg" />
          ) : data ? (
            <PanicHistory history={data.history} />
          ) : null}
        </div>
      )}

      {/* Explainer cards */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4">
          What goes into the index?
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {EXPLAINER_CARDS.map((card) => (
            <div
              key={card.key}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c0e16] p-5"
            >
              <div className="flex items-start gap-3 mb-2">
                <span className="text-xl leading-none">{card.icon}</span>
                <div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {card.title}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                    {card.weight} of index
                  </div>
                </div>
              </div>
              <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer note */}
      <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 pb-4">
        Not investment advice &middot; Educational tool &middot; SEBI-compliant research
      </p>
    </div>
  );
}
