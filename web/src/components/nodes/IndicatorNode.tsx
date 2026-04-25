"use client";

import { Handle, Position } from "reactflow";
import Sparkline from "../Sparkline";

export interface IndicatorNodeData {
  title: string;
  symbol: string;
  value: string;
  series: number[];
  rangeLabel: string;
  accent: string; // tailwind border color e.g. "border-purple-400"
  glow: string;   // box-shadow color
  stroke: string; // sparkline stroke
  fill: string;   // sparkline fill
  emoji: string;
}

export default function IndicatorNode({ data }: { data: IndicatorNodeData }) {
  return (
    <div
      className={`rounded-xl border ${data.accent} bg-[#11131c]/95 backdrop-blur px-3 pt-2 pb-3 w-[240px] shadow-lg shadow-slate-900/50 ring-1 ring-white/5 hover:ring-amber-400/30 transition`}
      style={{ boxShadow: `0 0 24px -8px ${data.glow}` }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-100">
        <span>{data.emoji}</span>
        <span>{data.title}</span>
      </div>
      <div className="text-center text-lg font-mono text-slate-100 mt-1">
        {data.value}
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-0.5 mb-1">
        <span>{data.symbol}</span>
        <span>{data.rangeLabel}</span>
      </div>
      <Sparkline
        data={data.series}
        stroke={data.stroke}
        fill={data.fill}
        height={34}
        width={216}
      />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
