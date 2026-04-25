"use client";

import { Handle, Position } from "reactflow";
import Sparkline from "../Sparkline";
import type { DeliveryResult } from "@/lib/types";

export interface DeliveryNodeData {
  symbol: string;
  delivery: DeliveryResult;
}

const STYLE: Record<
  DeliveryResult["status"],
  { border: string; text: string; stroke: string; fill: string; glow: string; verdict: string }
> = {
  accumulating: {
    border: "border-emerald-400",
    text: "text-emerald-300",
    stroke: "#34d399",
    fill: "rgba(52,211,153,0.18)",
    glow: "rgba(52,211,153,0.45)",
    verdict: "Accumulating",
  },
  distributing: {
    border: "border-rose-400",
    text: "text-rose-300",
    stroke: "#fb7185",
    fill: "rgba(251,113,133,0.18)",
    glow: "rgba(244,63,94,0.45)",
    verdict: "Distributing",
  },
  noise: {
    border: "border-slate-500",
    text: "text-slate-300",
    stroke: "#94a3b8",
    fill: "rgba(148,163,184,0.15)",
    glow: "rgba(148,163,184,0.3)",
    verdict: "Noise",
  },
};

export default function DeliveryNode({ data }: { data: DeliveryNodeData }) {
  const s = STYLE[data.delivery.status];
  const regimeUp = data.delivery.regime >= 1;
  return (
    <div
      className={`rounded-xl border ${s.border} bg-[#11131c]/95 backdrop-blur px-3 pt-2 pb-3 w-[240px] shadow-lg shadow-slate-900/50 ring-1 ring-white/5 hover:ring-amber-400/30 transition`}
      style={{ boxShadow: `0 0 24px -8px ${s.glow}` }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center justify-between text-[13px] font-semibold text-slate-100">
        <div className="flex items-center gap-1.5">
          <span>📦</span>
          <span>Delivery %</span>
        </div>
        <span className={`text-[10px] font-bold ${s.text}`}>{s.verdict}</span>
      </div>
      <div className={`text-center mt-1 text-2xl font-mono ${s.text}`}>
        {data.delivery.deliveryPct.toFixed(1)}%
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-0.5 mb-1">
        <span>{data.symbol}</span>
        <span>
          5d {data.delivery.deliveryPct5d.toFixed(0)}% · 20d{" "}
          {data.delivery.deliveryPct20d.toFixed(0)}%
        </span>
      </div>
      <Sparkline
        data={data.delivery.series}
        stroke={s.stroke}
        fill={s.fill}
        height={34}
        width={216}
      />
      <div className="mt-1 text-[10px] font-mono text-slate-400 flex justify-between">
        <span>
          regime{" "}
          <span className={regimeUp ? "text-emerald-300" : "text-rose-300"}>
            ×{data.delivery.regime.toFixed(2)}
          </span>
        </span>
        <span>
          5v20 px{" "}
          <span
            className={
              data.delivery.priceDelta5v20 >= 0
                ? "text-emerald-300"
                : "text-rose-300"
            }
          >
            {data.delivery.priceDelta5v20 > 0 ? "+" : ""}
            {data.delivery.priceDelta5v20.toFixed(1)}%
          </span>
        </span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
