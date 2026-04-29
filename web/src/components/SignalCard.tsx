"use client";

import { useEffect, useState } from "react";
import type { StockSnapshot, Verdict } from "@/lib/types";
import { appendLocalJudgement, getAnonId, latestLocalVote } from "@/lib/anonId";
import Link from "next/link";
import FreshnessBadge from "@/components/FreshnessBadge";

type Vote = "agree" | "disagree";

// ── verdict palette ──────────────────────────────────────────────────────────
const V = {
  BUY: {
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40 ring-emerald-500/20",
    border: "border-emerald-500/25",
    bar: "bg-emerald-500",
    glow: "shadow-emerald-500/10",
    dot: "bg-emerald-400",
  },
  HOLD: {
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/40 ring-amber-500/20",
    border: "border-amber-500/25",
    bar: "bg-amber-500",
    glow: "shadow-amber-500/10",
    dot: "bg-amber-400",
  },
  SELL: {
    badge: "bg-rose-500/15 text-rose-300 border-rose-500/40 ring-rose-500/20",
    border: "border-rose-500/25",
    bar: "bg-rose-500",
    glow: "shadow-rose-500/10",
    dot: "bg-rose-400",
  },
} satisfies Record<Verdict, object>;

// ── indicator meta ────────────────────────────────────────────────────────────
const IND_META: Record<string, string> = {
  rs: "RS",
  delivery: "Delivery",
  ema: "EMA",
  momentum: "Mom",
  volume: "Volume",
  aiNews: "AI News",
};

function scoreDot(score: number) {
  if (score >= 0.25) return "bg-emerald-400";
  if (score <= -0.25) return "bg-rose-400";
  return "bg-slate-500";
}

function scoreSign(score: number) {
  return score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2);
}

// ── main component ────────────────────────────────────────────────────────────
interface Props {
  snapshot: StockSnapshot;
  onToggleGraph: () => void;
  graphVisible: boolean;
}

function fmt(n: number) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

// ── price level row ───────────────────────────────────────────────────────────
// For BUY:  target = nearest resistance above (upside), stop = nearest support below
// For SELL: target = nearest support below (downside),  stop = nearest resistance above (cut-loss)
// For HOLD: target = nearest resistance, stop = nearest support
function PriceLevelRow({
  verdict,
  target,
  stop,
  targetLabel,
  stopLabel,
  aiRefined,
}: {
  verdict: Verdict;
  target: number | null;
  stop: number | null;
  targetLabel: string;
  stopLabel: string;
  aiRefined: boolean;
}) {
  const isSell = verdict === "SELL";
  const targetColor  = isSell ? "text-rose-400"    : "text-emerald-400";
  const stopColor    = isSell ? "text-amber-400"   : "text-rose-400";
  const targetPrefix = isSell ? "↓ " : "↑ ";
  const stopPrefix   = isSell ? "↑ " : "↓ ";
  const targetTitle  = isSell ? "Target (downside)" : verdict === "HOLD" ? "Resistance" : "Target";
  const stopTitle    = isSell ? "Cut-loss"          : verdict === "HOLD" ? "Support"    : "Stop";

  return (
    <div className="flex items-center gap-3 text-[11px] font-mono">
      {target != null && (
        <span className="flex items-center gap-1">
          <span className="text-slate-500">{targetTitle}</span>
          <span className={`font-semibold ${targetColor}`}>
            {targetPrefix}₹{fmt(target)}
          </span>
          {targetLabel && (
            <span className="text-[9px] text-slate-700">({targetLabel})</span>
          )}
        </span>
      )}
      {target != null && stop != null && (
        <span className="text-slate-700">·</span>
      )}
      {stop != null && (
        <span className="flex items-center gap-1">
          <span className="text-slate-500">{stopTitle}</span>
          <span className={`font-semibold ${stopColor}`}>
            {stopPrefix}₹{fmt(stop)}
          </span>
          {stopLabel && (
            <span className="text-[9px] text-slate-700">({stopLabel})</span>
          )}
        </span>
      )}
      <span className="text-[9px] text-slate-700">
        {aiRefined ? "· 🤖" : "· algo"}
      </span>
    </div>
  );
}

export default function SignalCard({ snapshot, onToggleGraph, graphVisible }: Props) {
  const { name, symbol, price, fusion, indicators } = snapshot;
  const { verdict, probability, synthesis, priceLevels } = fusion;
  const pct = Math.round(probability * 100);
  const vc = V[verdict];
  const hasSynthesis = synthesis?.source === "claude-haiku" && !!synthesis.verdict;

  // Prefer Claude's refined levels; fall back to algorithmic EMA/VWAP levels.
  const target = synthesis?.target ?? priceLevels?.target;
  const stop   = synthesis?.stop   ?? priceLevels?.stop;
  const targetLabel = priceLevels?.targetLabel ?? "";
  const stopLabel   = priceLevels?.stopLabel   ?? "";

  return (
    <div
      className={`shrink-0 mx-3 mt-3 mb-0 rounded-xl border ${vc.border} bg-[#0d0f18] shadow-lg ${vc.glow} overflow-hidden`}
    >
      {/* ── header row ── */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-800/60">
        <div className="min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-slate-100">{name}</span>
          <span className="text-[11px] font-mono text-slate-500">{symbol}</span>
          <FreshnessBadge asOf={snapshot.asOf} size="sm" />
        </div>
        <span className="text-[13px] font-mono font-semibold text-slate-200 shrink-0">
          ₹{price.toLocaleString("en-IN")}
        </span>
      </div>

      {/* ── body ── */}
      <div className="flex flex-col md:flex-row gap-0 md:divide-x divide-slate-800/60">
        {/* left — verdict + synthesis */}
        <div className="flex-1 px-4 py-3 flex flex-col gap-2.5">
          {/* verdict + probability */}
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-0.5 rounded-full border text-[13px] font-bold tracking-wider ring-1 ${vc.badge}`}
            >
              {verdict}
            </span>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${vc.bar}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[12px] font-mono text-slate-400 shrink-0">
                {pct}%
              </span>
            </div>
          </div>

          {/* target / stop */}
          {(target != null || stop != null) && (
            <PriceLevelRow
              verdict={verdict}
              target={target ?? null}
              stop={stop ?? null}
              targetLabel={!synthesis?.target ? targetLabel : ""}
              stopLabel={!synthesis?.stop ? stopLabel : ""}
              aiRefined={synthesis?.target != null}
            />
          )}

          {/* synthesis */}
          {hasSynthesis ? (
            <div className="flex gap-2">
              <span className="text-[13px] mt-0.5 shrink-0">🤖</span>
              <p className="text-[12px] leading-relaxed text-slate-300">
                {synthesis!.verdict}
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-slate-600 italic">
              AI analysis loading…
            </p>
          )}

          {/* bull / bear / risk */}
          {hasSynthesis && (
            <div className="flex flex-col gap-1">
              {synthesis!.bull && (
                <span className="text-[11px] text-emerald-400/90 flex gap-1.5">
                  <span>🐂</span><span>{synthesis!.bull}</span>
                </span>
              )}
              {synthesis!.bear && (
                <span className="text-[11px] text-rose-400/90 flex gap-1.5">
                  <span>🐻</span><span>{synthesis!.bear}</span>
                </span>
              )}
              {synthesis!.risk && (
                <span className="text-[11px] text-amber-400/80 flex gap-1.5">
                  <span>⚠</span><span>Risk: {synthesis!.risk}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* right — indicator scores */}
        <div className="w-full md:w-52 shrink-0 px-4 md:px-3 py-2 md:py-3 border-t border-slate-800/60 md:border-t-0">
          {/* Mobile: 2-column grid; Desktop: single column list */}
          <div className="grid grid-cols-2 md:grid-cols-1 gap-x-4 gap-y-1.5">
            {Object.entries(IND_META).map(([key, label]) => {
              const ind = (indicators as Record<string, { score?: number; label?: string }>)[key];
              if (!ind) return null;
              const score = ind.score ?? 0;
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-14 text-[10px] text-slate-500 shrink-0">{label}</span>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${scoreDot(score)}`} />
                  <span className={`text-[10px] font-mono shrink-0 ${
                    score >= 0.25 ? "text-emerald-400" :
                    score <= -0.25 ? "text-rose-400" : "text-slate-500"
                  }`}>
                    {scoreSign(score)}
                  </span>
                  <span className="text-[10px] text-slate-600 truncate hidden md:inline">{ind.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── footer row — graph toggle + votes ── */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800/60 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleGraph}
            className="text-[11px] text-slate-500 hover:text-slate-300 transition flex items-center gap-1.5 font-mono shrink-0"
          >
            <span>{graphVisible ? "▲" : "▼"}</span>
            <span className="hidden sm:inline">{graphVisible ? "Hide signal graph" : "View signal graph"}</span>
          </button>
          {/* Mobile-only: link to see all rankings since sidebar is hidden */}
          <Link
            href="/canvas"
            className="md:hidden text-[11px] text-amber-500/70 hover:text-amber-400 transition font-mono"
          >
            All 50 →
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <VoteButtons snapshot={snapshot} />
          <ShareButton snapshot={snapshot} />
        </div>
      </div>
    </div>
  );
}

// ── vote buttons ──────────────────────────────────────────────────────────────
function VoteButtons({ snapshot }: { snapshot: StockSnapshot }) {
  const [vote, setVote] = useState<Vote | null>(null);
  const [pending, setPending] = useState<Vote | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setVote(latestLocalVote(snapshot.symbol, snapshot.asOf));
  }, [snapshot.symbol, snapshot.asOf]);

  async function cast(v: Vote) {
    if (pending) return;
    setPending(v);
    const anonId = getAnonId();
    const payload = {
      symbol: snapshot.symbol,
      verdict: snapshot.fusion.verdict,
      probability: snapshot.fusion.probability,
      vote: v,
      asOf: snapshot.asOf,
      anonId,
    };
    appendLocalJudgement({ ...payload, createdAt: new Date().toISOString() });
    setVote(v);
    try {
      const res = await fetch("/api/judgement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      setToast(json.persisted === "supabase" ? "Logged ✓" : "Saved locally");
    } catch {
      setToast("Saved locally");
    } finally {
      setPending(null);
      setTimeout(() => setToast(null), 2000);
    }
  }

  const base = "px-2.5 py-1 rounded-md text-[11px] font-semibold border transition flex items-center gap-1";
  const idle = "border-slate-700 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200";
  const active = {
    agree: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
    disagree: "border-rose-500/50 bg-rose-500/10 text-rose-300",
  } as const;

  return (
    <div className="flex items-center gap-2">
      {toast && <span className="text-[10px] text-slate-500 font-mono">{toast}</span>}
      <button
        onClick={() => cast("agree")}
        disabled={!!pending}
        className={`${base} ${vote === "agree" ? active.agree : idle} disabled:opacity-50`}
      >
        <span>👍</span><span>Agree</span>
      </button>
      <button
        onClick={() => cast("disagree")}
        disabled={!!pending}
        className={`${base} ${vote === "disagree" ? active.disagree : idle} disabled:opacity-50`}
      >
        <span>👎</span><span>Disagree</span>
      </button>
    </div>
  );
}

// ── share button ──────────────────────────────────────────────────────────────
function ShareButton({ snapshot }: { snapshot: StockSnapshot }) {
  const [label, setLabel] = useState("Share");

  async function share() {
    const sym     = snapshot.symbol.replace(".NS", "").replace(".BO", "");
    const verdict = snapshot.fusion.verdict;
    const pct     = Math.round(snapshot.fusion.probability * 100);
    // Share the SEO-friendly signal page — has OG image, JSON-LD, works without JS.
    const url     = `https://marketmithra.app/signals/${sym}`;
    const emoji   = verdict === "BUY" ? "🟢" : verdict === "SELL" ? "🔴" : "🟡";
    const text    = `${emoji} ${sym} ${verdict} — ${pct}% fusion signal on MarketMithra`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `${sym} — MarketMithra`, text, url });
        return;
      } catch { /* user cancelled */ }
    }

    // Fallback: copy URL to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setLabel("Copied!");
      setTimeout(() => setLabel("Share"), 2000);
    } catch {
      setLabel("Share");
    }
  }

  return (
    <button
      onClick={share}
      className="px-2.5 py-1 rounded-md text-[11px] font-semibold border transition flex items-center gap-1 border-slate-700 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
    >
      <span>{label === "Copied!" ? "✓" : "↗"}</span>
      <span>{label}</span>
    </button>
  );
}
