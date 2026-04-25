"use client";

import { Handle, Position } from "reactflow";

export interface FusionNodeData {
  probability: number;
}

export default function FusionNode({ data }: { data: FusionNodeData }) {
  const pct   = Math.round(data.probability * 100);
  const isBuy  = data.probability >= 0.60;
  const isSell = data.probability <= 0.40;

  const color  = isBuy  ? "#34d399"   : isSell  ? "#fb7185"  : "#fbbf24";
  const glow   = isBuy  ? "rgba(52,211,153,0.5)"  : isSell ? "rgba(244,63,94,0.5)"  : "rgba(251,191,36,0.45)";
  const border = isBuy  ? "border-emerald-400" : isSell ? "border-rose-400" : "border-amber-400";
  const text   = isBuy  ? "text-emerald-300"   : isSell ? "text-rose-300"   : "text-amber-300";
  const label  = isBuy  ? "Bullish bias"        : isSell ? "Bearish bias"    : "Neutral zone";

  // SVG arc — thin ring around the percentage number
  const r = 34;
  const cx = 44;
  const cy = 44;
  const circ = 2 * Math.PI * r;
  const dashLen = (pct / 100) * circ;

  return (
    <div
      className={`rounded-xl border ${border} bg-[#1a1530]/95 backdrop-blur px-4 pt-3 pb-3 w-[220px] shadow-lg shadow-slate-900/50 ring-1 ring-white/5 hover:ring-amber-400/30 transition text-center`}
      style={{ boxShadow: `0 0 28px -6px ${glow}` }}
    >
      <Handle type="target" position={Position.Left} style={{ background: color }} />

      {/* Title */}
      <div className="text-[12px] font-semibold text-indigo-300 flex items-center justify-center gap-1.5 mb-2">
        <span>⚡</span> Fusion Score
      </div>

      {/* Arc + number */}
      <div className="flex items-center justify-center">
        <svg width={88} height={88} viewBox="0 0 88 88">
          {/* background ring */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="#1e293b"
            strokeWidth={6}
          />
          {/* progress arc — rotated so it starts at 12 o'clock */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={color}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={`${dashLen} ${circ}`}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          />
          {/* percentage text */}
          <text
            x={cx} y={cy + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={18}
            fontWeight={700}
            fontFamily="ui-monospace,monospace"
            fill="white"
          >
            {pct}%
          </text>
        </svg>
      </div>

      <div className={`text-[10px] font-semibold mt-1 ${text}`}>{label}</div>
      <div className="text-[9px] text-slate-500 mt-0.5">6 weighted signals</div>

      <Handle type="source" position={Position.Right} style={{ background: color }} />
    </div>
  );
}
