"use client";

import { Handle, Position } from "reactflow";
import Sparkline from "../Sparkline";
import type { RelativeStrengthResult } from "@/lib/types";

export interface RelativeStrengthNodeData {
  symbol: string;
  rs: RelativeStrengthResult;
}

// Color ramp: <40 red, 40-60 amber, >60 green. Standard IBD convention.
function tone(rating: number) {
  if (rating >= 70)
    return {
      border: "border-emerald-400",
      text: "text-emerald-300",
      stroke: "#34d399",
      fill: "rgba(52,211,153,0.18)",
      glow: "rgba(52,211,153,0.45)",
      verdict: "Strong",
    };
  if (rating >= 50)
    return {
      border: "border-lime-400",
      text: "text-lime-300",
      stroke: "#a3e635",
      fill: "rgba(163,230,53,0.16)",
      glow: "rgba(163,230,53,0.4)",
      verdict: "Outperforming",
    };
  if (rating >= 40)
    return {
      border: "border-amber-400",
      text: "text-amber-300",
      stroke: "#fbbf24",
      fill: "rgba(251,191,36,0.16)",
      glow: "rgba(251,191,36,0.4)",
      verdict: "In-line",
    };
  return {
    border: "border-rose-400",
    text: "text-rose-300",
    stroke: "#fb7185",
    fill: "rgba(251,113,133,0.18)",
    glow: "rgba(244,63,94,0.45)",
    verdict: "Lagging",
  };
}

export default function RelativeStrengthNode({
  data,
}: {
  data: RelativeStrengthNodeData;
}) {
  const t = tone(data.rs.rating);
  return (
    <div
      className={`rounded-xl border ${t.border} bg-[#11131c]/95 backdrop-blur px-3 pt-2 pb-3 w-[240px] shadow-lg shadow-slate-900/50 ring-1 ring-white/5 hover:ring-amber-400/30 transition`}
      style={{ boxShadow: `0 0 24px -8px ${t.glow}` }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center justify-between text-[13px] font-semibold text-slate-100">
        <div className="flex items-center gap-1.5">
          <span>🏆</span>
          <span>RS vs Nifty 500</span>
        </div>
        <span className={`text-[10px] font-bold ${t.text}`}>{t.verdict}</span>
      </div>
      <div className={`text-center mt-1 text-2xl font-mono ${t.text}`}>
        {data.rs.rating}
        <span className="text-[11px] text-slate-500 ml-1">/100</span>
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-0.5 mb-1">
        <span>{data.symbol}</span>
        <span>ratio vs ^CRSLDX</span>
      </div>
      <Sparkline
        data={data.rs.ratioSeries}
        stroke={t.stroke}
        fill={t.fill}
        height={38}
        width={216}
      />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
