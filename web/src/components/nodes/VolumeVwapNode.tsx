"use client";

import { Handle, Position } from "reactflow";
import MultiSparkline from "../MultiSparkline";
import type { VolumeVwapResult } from "@/lib/types";

export interface VolumeVwapNodeData {
  symbol: string;
  volume: VolumeVwapResult;
}

export default function VolumeVwapNode({ data }: { data: VolumeVwapNodeData }) {
  const bullish = data.volume.aboveVwap;
  const border = bullish ? "border-emerald-400" : "border-rose-400";
  const glow = bullish ? "rgba(52,211,153,0.4)" : "rgba(244,63,94,0.4)";
  const badge = bullish
    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
    : "bg-rose-500/15 text-rose-300 border-rose-500/40";
  const priceStroke = bullish ? "#34d399" : "#fb7185";

  // Normalize volume bars to 0..1 for the bottom strip.
  const vs = data.volume.volumeSeries;
  const vMax = Math.max(...vs) || 1;
  const barW = 216 / vs.length;

  return (
    <div
      className={`rounded-xl border ${border} bg-[#11131c]/95 backdrop-blur px-3 pt-2 pb-3 w-[240px] shadow-lg shadow-slate-900/50 ring-1 ring-white/5 hover:ring-amber-400/30 transition`}
      style={{ boxShadow: `0 0 24px -8px ${glow}` }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center justify-between text-[13px] font-semibold text-slate-100">
        <div className="flex items-center gap-1.5">
          <span>📊</span>
          <span>Volume / VWAP</span>
        </div>
        <span
          className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${badge}`}
        >
          {bullish ? "Above VWAP" : "Below VWAP"}
        </span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-mono text-slate-400">
        <span>{data.symbol}</span>
        <span>
          Δ{" "}
          <span className={bullish ? "text-emerald-300" : "text-rose-300"}>
            {data.volume.priceVsVwapPct > 0 ? "+" : ""}
            {data.volume.priceVsVwapPct.toFixed(2)}%
          </span>
        </span>
      </div>
      <MultiSparkline
        width={216}
        height={36}
        lines={[
          { data: data.volume.priceSeries, stroke: priceStroke, width: 1.5 },
          {
            data: data.volume.vwapSeries,
            stroke: "#c4b5fd",
            width: 1.2,
            opacity: 0.9,
          },
        ]}
      />
      {/* volume bars */}
      <svg width={216} height={18} className="mt-0.5 block">
        {vs.map((v, i) => {
          const h = (v / vMax) * 18;
          return (
            <rect
              key={i}
              x={i * barW}
              y={18 - h}
              width={Math.max(1, barW - 0.8)}
              height={h}
              fill="#64748b"
              opacity={0.6}
            />
          );
        })}
      </svg>
      <div className="mt-0.5 text-[10px] font-mono text-slate-400 flex justify-between">
        <span>
          vwap ₹{data.volume.vwap20.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </span>
        <span>
          vol{" "}
          <span
            className={
              data.volume.volumeTrend === "rising"
                ? "text-emerald-300"
                : data.volume.volumeTrend === "falling"
                ? "text-rose-300"
                : "text-slate-300"
            }
          >
            {data.volume.volumeTrend}
          </span>
        </span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
