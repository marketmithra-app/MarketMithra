"use client";

import { Handle, Position } from "reactflow";
import Sparkline from "../Sparkline";

export interface PriceNodeData {
  symbol: string;
  name: string;
  price: number;
  series: number[];
}

export default function PriceNode({ data }: { data: PriceNodeData }) {
  return (
    <div
      className="rounded-xl border border-sky-400 bg-[#0d1626]/95 backdrop-blur px-3 pt-2 pb-3 w-[260px] shadow-lg shadow-slate-900/50 ring-1 ring-white/5 hover:ring-amber-400/30 transition"
      style={{ boxShadow: "0 0 26px -8px rgba(56,189,248,0.55)" }}
    >
      <div className="flex items-center justify-between text-[13px] font-semibold text-sky-300">
        <div className="flex items-center gap-1.5">
          <span>📊</span>
          <span>Price Feed</span>
        </div>
        <span className="text-[10px] font-mono text-slate-400">
          {data.symbol}
        </span>
      </div>
      <div className="text-center text-2xl font-mono text-slate-100 mt-1">
        ₹{data.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
      </div>
      <div className="text-center text-[10px] text-slate-400 -mt-0.5 mb-1">
        {data.name} · NSE · 1D
      </div>
      <Sparkline
        data={data.series}
        stroke="#38bdf8"
        fill="rgba(56,189,248,0.18)"
        height={42}
        width={236}
      />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
