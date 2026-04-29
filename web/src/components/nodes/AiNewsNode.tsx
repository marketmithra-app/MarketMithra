"use client";

import { Handle, Position } from "reactflow";
import type { AiNewsResult, AiNewsHeadline } from "@/lib/types";

// Score → visual theme (matches the other indicator nodes' colour language)
function theme(score: number, isFallback: boolean) {
  if (isFallback) return {
    border: "border-slate-700",
    text:   "text-slate-400",
    badge:  "bg-slate-700/40 text-slate-400 border-slate-600",
    stroke: "#64748b",
    glow:   "rgba(100,116,139,0.25)",
    bar:    "bg-slate-600",
  };
  if (score >= 0.35) return {
    border: "border-emerald-400",
    text:   "text-emerald-300",
    badge:  "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
    stroke: "#34d399",
    glow:   "rgba(52,211,153,0.45)",
    bar:    "bg-emerald-500",
  };
  if (score >= 0.1) return {
    border: "border-teal-400",
    text:   "text-teal-300",
    badge:  "bg-teal-500/15 text-teal-300 border-teal-500/40",
    stroke: "#2dd4bf",
    glow:   "rgba(45,212,191,0.4)",
    bar:    "bg-teal-500",
  };
  if (score > -0.1) return {
    border: "border-slate-500",
    text:   "text-slate-300",
    badge:  "bg-slate-500/15 text-slate-300 border-slate-500/40",
    stroke: "#94a3b8",
    glow:   "rgba(148,163,184,0.3)",
    bar:    "bg-slate-500",
  };
  if (score > -0.35) return {
    border: "border-orange-400",
    text:   "text-orange-300",
    badge:  "bg-orange-500/15 text-orange-300 border-orange-500/40",
    stroke: "#fb923c",
    glow:   "rgba(251,146,60,0.4)",
    bar:    "bg-orange-500",
  };
  return {
    border: "border-rose-400",
    text:   "text-rose-300",
    badge:  "bg-rose-500/15 text-rose-300 border-rose-500/40",
    stroke: "#fb7185",
    glow:   "rgba(244,63,94,0.45)",
    bar:    "bg-rose-500",
  };
}

function hasConflict(newsScore: number, fusionProbability: number): boolean {
  const technicalScore = fusionProbability * 2 - 1; // map [0,1] → [-1,1]
  return (newsScore > 0.4 && technicalScore < -0.4)
      || (newsScore < -0.4 && technicalScore > 0.4);
}

const TREND_LABEL: Record<string, string> = {
  improving:     "↑ Improving",
  deteriorating: "↓ Deteriorating",
  stable:        "→ Stable",
};

const TREND_COLOR: Record<string, string> = {
  improving:     "text-teal-400",
  deteriorating: "text-rose-400",
  stable:        "text-slate-500",
};

const SENTIMENT_DOT: Record<string, string> = {
  bullish: "text-emerald-400",
  bearish: "text-rose-400",
  neutral: "text-slate-500",
};

export default function AiNewsNode({
  data,
}: {
  data: {
    label: string;
    result: AiNewsResult;
    symbol: string;
    fusionProbability: number;
  };
}) {
  const { result, symbol, fusionProbability } = data;
  const {
    score, label, summary, whyItMatters, watchOut,
    headlines, trend, source,
  } = result;
  const isFallback = source === "fallback";
  const t = theme(score, isFallback);
  const conflict = !isFallback && hasConflict(score, fusionProbability);

  // Score bar: diverging from centre
  const barPct  = Math.abs(score) * 50;
  const barLeft = score < 0;

  return (
    <div
      className={`rounded-xl border ${t.border} bg-[#11131c]/95 backdrop-blur px-3 pt-2 pb-3 w-[240px] shadow-lg shadow-slate-900/50 ring-1 ring-white/5 hover:ring-amber-400/30 transition`}
      style={{ boxShadow: `0 0 24px -8px ${t.glow}` }}
    >
      <Handle type="target" position={Position.Left} style={{ background: t.stroke }} />

      {/* Header */}
      <div className="flex items-center justify-between text-[13px] font-semibold text-slate-100">
        <div className="flex items-center gap-1.5">
          <span>🤖</span>
          <span>AI News</span>
        </div>
        <div className="flex items-center gap-1">
          {!isFallback && (
            <span className={`text-[8px] font-semibold ${TREND_COLOR[trend] ?? "text-slate-500"}`}>
              {TREND_LABEL[trend] ?? "→ Stable"}
            </span>
          )}
          <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${t.badge}`}>
            {label}
          </span>
        </div>
      </div>

      {/* Symbol + score number */}
      <div className="flex items-baseline justify-between mt-1">
        <span className="text-[10px] font-mono text-slate-400">{symbol}</span>
        <span className={`text-2xl font-mono ${t.text}`}>
          {score >= 0 ? "+" : ""}{score.toFixed(2)}
        </span>
      </div>

      {/* Diverging score bar */}
      <div className="mt-1 mb-1">
        <div className="relative h-2 w-full rounded-full bg-slate-800 overflow-hidden">
          <div className="absolute left-1/2 top-0 h-full w-px bg-slate-600/60" />
          <div
            className={`absolute top-0 h-full rounded-full transition-all ${t.bar}`}
            style={{
              width:  `${barPct}%`,
              left:   barLeft ? `${50 - barPct}%` : "50%",
            }}
          />
        </div>
        <div className="flex justify-between mt-0.5 text-[8px] text-slate-600">
          <span>Bearish −1</span>
          <span>Neutral</span>
          <span>+1 Bullish</span>
        </div>
      </div>

      {/* Summary */}
      <div className={`text-[10px] leading-snug ${isFallback ? "text-slate-500 italic" : "text-slate-300"} mb-1`}>
        {summary}
      </div>

      {/* Why it matters */}
      {!isFallback && whyItMatters && (
        <div className="text-[10px] text-teal-300 leading-snug mb-0.5 flex gap-1">
          <span className="shrink-0">💡</span>
          <span>{whyItMatters}</span>
        </div>
      )}

      {/* Watch out */}
      {!isFallback && watchOut && (
        <div className="text-[10px] text-amber-300 leading-snug mb-1 flex gap-1">
          <span className="shrink-0">⚠</span>
          <span>{watchOut}</span>
        </div>
      )}

      {/* Expandable headlines */}
      {!isFallback && headlines.length > 0 && (
        <details className="group border-t border-slate-800/70">
          <summary className="px-0 py-1.5 text-[9px] text-slate-500 cursor-pointer hover:text-slate-300 select-none list-none flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
            {headlines.length} headlines
          </summary>
          <ul className="space-y-1 pb-1">
            {headlines.map((h: AiNewsHeadline, i: number) => (
              <li
                key={i}
                className="text-[9px] text-slate-400 leading-snug border-l-2 border-slate-700 pl-1.5 flex items-start gap-1"
              >
                <span className={`shrink-0 ${SENTIMENT_DOT[h.sentiment] ?? "text-slate-500"}`}>●</span>
                <span className="flex-1 line-clamp-2">{h.title}</span>
                {h.impact === "high" && (
                  <span className="shrink-0 text-[8px] font-bold text-rose-400">HIGH</span>
                )}
                {h.impact === "medium" && (
                  <span className="shrink-0 text-[8px] font-bold text-slate-400">MED</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Conflict badge */}
      {conflict && (
        <div className="mt-1 flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-0.5">
          <span className="text-amber-400">⚡</span>
          <span className="text-[9px] font-semibold text-amber-400">Conflicts with technical signal</span>
        </div>
      )}

      {/* Footer */}
      <div className="pt-1.5 border-t border-slate-800/60 flex items-center justify-between">
        <span className="text-[8px] text-slate-600 font-mono">
          {isFallback ? "no key / fallback" : "claude-haiku · 12h cache"}
        </span>
        <span className="text-[8px] text-purple-400/70 font-mono">w=0.10</span>
      </div>

      <Handle type="source" position={Position.Right} style={{ background: t.stroke }} />
    </div>
  );
}
