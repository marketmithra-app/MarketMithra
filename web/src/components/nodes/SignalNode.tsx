"use client";

import { Handle, Position } from "reactflow";
import type { Verdict } from "@/lib/types";

const STYLES: Record<Verdict, {
  border: string; text: string; glow: string;
  bg: string; badge: string; emoji: string; sub: string; shadowColor: string;
}> = {
  BUY: {
    border:      "border-emerald-400",
    text:        "text-emerald-300",
    glow:        "rgba(52,211,153,0.6)",
    bg:          "bg-emerald-500/10",
    badge:       "bg-emerald-500/20 border-emerald-400/60",
    emoji:       "🟢",
    sub:         "Bullish signal",
    shadowColor: "shadow-emerald-500/20",
  },
  HOLD: {
    border:      "border-amber-400",
    text:        "text-amber-300",
    glow:        "rgba(251,191,36,0.55)",
    bg:          "bg-amber-500/10",
    badge:       "bg-amber-500/20 border-amber-400/60",
    emoji:       "🟡",
    sub:         "Wait for confirmation",
    shadowColor: "shadow-amber-400/20",
  },
  SELL: {
    border:      "border-rose-400",
    text:        "text-rose-300",
    glow:        "rgba(244,63,94,0.6)",
    bg:          "bg-rose-500/10",
    badge:       "bg-rose-500/20 border-rose-400/60",
    emoji:       "🔴",
    sub:         "Bearish signal",
    shadowColor: "shadow-rose-500/20",
  },
};

export default function SignalNode({ data }: { data: { verdict: Verdict } }) {
  const s = STYLES[data.verdict];
  return (
    <div
      className={`rounded-xl border ${s.border} ${s.bg} backdrop-blur px-5 py-4 w-[180px] text-center shadow-lg shadow-slate-900/50 ${s.shadowColor} ring-1 ring-white/5 hover:ring-amber-400/30 transition`}
      style={{ boxShadow: `0 0 32px -4px ${s.glow}` }}
    >
      <Handle type="target" position={Position.Left} style={{ background: s.text }} />

      <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-center gap-1 mb-2">
        <span>🎯</span> Trade Signal
      </div>

      <div className={`text-4xl font-black font-mono tracking-tight ${s.text}`}
           style={{ textShadow: `0 0 20px ${s.glow}` }}>
        {data.verdict}
      </div>

      <div className={`mt-2 text-[10px] font-medium ${s.text} opacity-80`}>
        {s.sub}
      </div>
    </div>
  );
}
