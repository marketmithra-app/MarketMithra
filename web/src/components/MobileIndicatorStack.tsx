"use client";

/**
 * MobileIndicatorStack — vertical scrollable list of indicator cards,
 * replacing the ReactFlow canvas on small screens. Each card summarises
 * one indicator in a compact row designed for thumb-scrolling.
 */

import Sparkline from "./Sparkline";
import MultiSparkline from "./MultiSparkline";
import type {
  StockSnapshot,
  DeliveryResult,
  EmaStackResult,
  RelativeStrengthResult,
  VolumeVwapResult,
  IndicatorResult,
  AiNewsResult,
} from "@/lib/types";

function scoreColor(score: number) {
  if (score >= 0.25) return "text-emerald-400";
  if (score <= -0.25) return "text-rose-400";
  return "text-slate-400";
}

function scoreBorder(score: number) {
  if (score >= 0.25) return "border-emerald-500/40";
  if (score <= -0.25) return "border-rose-500/40";
  return "border-slate-700";
}

function signed(score: number) {
  return score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2);
}

function ShellCard({
  icon,
  title,
  score,
  pill,
  pillClass,
  children,
}: {
  icon: string;
  title: string;
  score: number;
  pill?: string;
  pillClass?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border ${scoreBorder(score)} bg-[#11131c] px-3 py-2.5`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-100">
          <span>{icon}</span>
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {pill && (
            <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${pillClass ?? "text-slate-300 border-slate-600"}`}>
              {pill}
            </span>
          )}
          <span className={`text-[11px] font-mono ${scoreColor(score)}`}>
            {signed(score)}
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}

function RsCard({ rs, symbol }: { rs: RelativeStrengthResult; symbol: string }) {
  const rating = Math.round(rs.rating);
  const barColor = rating >= 70 ? "bg-emerald-500" : rating >= 40 ? "bg-amber-500" : "bg-rose-500";
  return (
    <ShellCard
      icon="📈"
      title="Relative Strength"
      score={rs.score}
      pill={`${rating}`}
      pillClass={rating >= 70 ? "text-emerald-300 border-emerald-500/40" : rating >= 40 ? "text-amber-300 border-amber-500/40" : "text-rose-300 border-rose-500/40"}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div className={`h-full ${barColor}`} style={{ width: `${rating}%` }} />
        </div>
        <span className="text-[10px] font-mono text-slate-500">{rs.label}</span>
      </div>
      <div className="flex justify-between text-[10px] font-mono text-slate-500">
        <span>{symbol.replace(".NS", "")}</span>
        <span>vs Nifty 500</span>
      </div>
    </ShellCard>
  );
}

function DeliveryCard({ d, symbol }: { d: DeliveryResult; symbol: string }) {
  const pillClass =
    d.status === "accumulating"
      ? "text-emerald-300 border-emerald-500/40"
      : d.status === "distributing"
      ? "text-rose-300 border-rose-500/40"
      : "text-slate-400 border-slate-600";
  return (
    <ShellCard icon="📦" title="Delivery %" score={d.score} pill={d.status} pillClass={pillClass}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className={`text-xl font-mono ${d.status === "accumulating" ? "text-emerald-300" : d.status === "distributing" ? "text-rose-300" : "text-slate-300"}`}>
            {d.deliveryPct.toFixed(1)}%
          </div>
          <div className="text-[10px] font-mono text-slate-500">
            5d {d.deliveryPct5d.toFixed(0)}% · 20d {d.deliveryPct20d.toFixed(0)}%
          </div>
        </div>
        <Sparkline
          data={d.series}
          width={120}
          height={32}
          stroke={d.status === "accumulating" ? "#34d399" : d.status === "distributing" ? "#fb7185" : "#94a3b8"}
          fill={d.status === "accumulating" ? "rgba(52,211,153,0.15)" : d.status === "distributing" ? "rgba(251,113,133,0.15)" : "rgba(148,163,184,0.1)"}
        />
      </div>
      <div className="mt-1 text-[10px] font-mono text-slate-500">
        {symbol.replace(".NS", "")} · regime ×{d.regime.toFixed(2)}
      </div>
    </ShellCard>
  );
}

function EmaCard({ ema, symbol }: { ema: EmaStackResult; symbol: string }) {
  const pillClass =
    ema.status === "bullish"
      ? "text-emerald-300 border-emerald-500/40"
      : ema.status === "bearish"
      ? "text-rose-300 border-rose-500/40"
      : "text-amber-300 border-amber-500/40";
  return (
    <ShellCard icon="〰️" title="EMA Stack" score={ema.score} pill={ema.status} pillClass={pillClass}>
      <MultiSparkline
        width={300}
        height={40}
        lines={[
          { data: ema.priceSeries, stroke: "#94a3b8", width: 1, opacity: 0.55 },
          { data: ema.ema20Series, stroke: "#38bdf8", width: 1.5 },
          { data: ema.ema50Series, stroke: "#fbbf24", width: 1.5 },
          { data: ema.ema200Series, stroke: "#f472b6", width: 1.5 },
        ]}
      />
      <div className="mt-1 grid grid-cols-3 gap-1 text-[10px] font-mono">
        <div className="text-sky-400">20: ₹{ema.ema20.toFixed(0)}</div>
        <div className="text-amber-300">50: ₹{ema.ema50.toFixed(0)}</div>
        <div className="text-pink-400">200: ₹{ema.ema200.toFixed(0)}</div>
      </div>
      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
        {symbol.replace(".NS", "")} · {ema.label}
      </div>
    </ShellCard>
  );
}

function MomentumCard({ m, symbol }: { m: IndicatorResult; symbol: string }) {
  return (
    <ShellCard icon="🚀" title="Momentum" score={m.score}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-mono text-orange-400">{m.label}</div>
        <Sparkline
          data={m.series}
          width={140}
          height={32}
          stroke="#fb923c"
          fill="rgba(251,146,60,0.18)"
        />
      </div>
      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
        {symbol.replace(".NS", "")} · 20D
      </div>
    </ShellCard>
  );
}

function VolumeCard({ v, symbol }: { v: VolumeVwapResult; symbol: string }) {
  const pillClass = v.aboveVwap ? "text-emerald-300 border-emerald-500/40" : "text-rose-300 border-rose-500/40";
  return (
    <ShellCard
      icon="📊"
      title="Volume / VWAP"
      score={v.score}
      pill={v.aboveVwap ? "above VWAP" : "below VWAP"}
      pillClass={pillClass}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className={`text-sm font-mono ${v.aboveVwap ? "text-emerald-300" : "text-rose-300"}`}>
            {v.priceVsVwapPct > 0 ? "+" : ""}{v.priceVsVwapPct.toFixed(1)}%
          </div>
          <div className="text-[10px] font-mono text-slate-500">
            VWAP20 ₹{v.vwap20.toFixed(1)} · vol {v.volumeTrend}
          </div>
        </div>
        <Sparkline
          data={v.priceSeries}
          width={120}
          height={32}
          stroke="#a78bfa"
          fill="rgba(167,139,250,0.15)"
        />
      </div>
      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
        {symbol.replace(".NS", "")} · {v.label}
      </div>
    </ShellCard>
  );
}

function AiNewsCard({ n, symbol }: { n: AiNewsResult; symbol: string }) {
  const pillClass =
    n.score >= 0.25
      ? "text-emerald-300 border-emerald-500/40"
      : n.score <= -0.25
      ? "text-rose-300 border-rose-500/40"
      : "text-slate-300 border-slate-600";
  return (
    <ShellCard icon="📰" title="AI News" score={n.score} pill={n.label} pillClass={pillClass}>
      <p className="text-[11px] leading-relaxed text-slate-300 line-clamp-3">
        {n.summary}
      </p>
      {n.headlines.length > 0 && (
        <div className="text-[10px] font-mono text-slate-500 mt-1 truncate">
          {symbol.replace(".NS", "")} · {n.headlines.length} headline{n.headlines.length === 1 ? "" : "s"}
        </div>
      )}
    </ShellCard>
  );
}

export default function MobileIndicatorStack({ snapshot }: { snapshot: StockSnapshot }) {
  const { indicators, symbol } = snapshot;

  return (
    <div className="md:hidden flex-1 overflow-y-auto px-3 pb-4 pt-2 space-y-2">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider px-1 pb-0.5">
        Signal breakdown · tap any indicator above for details
      </div>
      <RsCard rs={indicators.rs} symbol={symbol} />
      <DeliveryCard d={indicators.delivery} symbol={symbol} />
      <EmaCard ema={indicators.ema} symbol={symbol} />
      <MomentumCard m={indicators.momentum} symbol={symbol} />
      <VolumeCard v={indicators.volume} symbol={symbol} />
      {indicators.aiNews && <AiNewsCard n={indicators.aiNews} symbol={symbol} />}
    </div>
  );
}
