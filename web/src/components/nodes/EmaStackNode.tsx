"use client";

import { Handle, Position } from "reactflow";
import MultiSparkline from "../MultiSparkline";
import type { EmaStackResult } from "@/lib/types";

export interface EmaStackNodeData {
  symbol: string;
  ema: EmaStackResult;
}

const STATUS_STYLE: Record<
  EmaStackResult["status"],
  { border: string; badge: string; glow: string }
> = {
  bullish: {
    border: "border-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
    glow: "rgba(52,211,153,0.4)",
  },
  bearish: {
    border: "border-rose-400",
    badge: "bg-rose-500/15 text-rose-300 border-rose-500/40",
    glow: "rgba(244,63,94,0.4)",
  },
  mixed: {
    border: "border-amber-400",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/40",
    glow: "rgba(251,191,36,0.4)",
  },
};

export default function EmaStackNode({ data }: { data: EmaStackNodeData }) {
  const s = STATUS_STYLE[data.ema.status];
  return (
    <div
      className={`rounded-xl border ${s.border} bg-[#11131c]/95 backdrop-blur px-3 pt-2 pb-3 w-[240px] shadow-lg shadow-slate-900/50 ring-1 ring-white/5 hover:ring-amber-400/30 transition`}
      style={{ boxShadow: `0 0 24px -8px ${s.glow}` }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center justify-between text-[13px] font-semibold text-slate-100">
        <div className="flex items-center gap-1.5">
          <span>〰️</span>
          <span>EMA Stack</span>
        </div>
        <span
          className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${s.badge}`}
        >
          {data.ema.status}
        </span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-mono text-slate-400">
        <span>{data.symbol}</span>
        <span>{data.ema.label}</span>
      </div>
      <MultiSparkline
        width={216}
        height={44}
        lines={[
          {
            data: data.ema.priceSeries,
            stroke: "#94a3b8",
            width: 1,
            opacity: 0.55,
          },
          { data: data.ema.ema20Series, stroke: "#38bdf8", width: 1.5 },
          { data: data.ema.ema50Series, stroke: "#fbbf24", width: 1.5 },
          { data: data.ema.ema200Series, stroke: "#f472b6", width: 1.5 },
        ]}
      />
      <div className="mt-1 grid grid-cols-3 gap-1 text-[10px] font-mono">
        <div className="text-sky-400">
          20: ₹{data.ema.ema20.toFixed(0)}
        </div>
        <div className="text-amber-300">
          50: ₹{data.ema.ema50.toFixed(0)}
        </div>
        <div className="text-pink-400">
          200: ₹{data.ema.ema200.toFixed(0)}
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
