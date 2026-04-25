"use client";

interface HistoryPoint {
  date: string;
  score: number;
  zone: string;
}

interface PanicHistoryProps {
  history: HistoryPoint[];
}

const SVG_W = 280;
const SVG_H = 60;
const PAD_LEFT = 4;
const PAD_RIGHT = 32;
const PAD_TOP = 6;
const PAD_BOTTOM = 6;

function scoreToY(score: number): number {
  // score 0 → bottom (SVG_H - PAD_BOTTOM), score 100 → top (PAD_TOP)
  return PAD_TOP + ((100 - score) / 100) * (SVG_H - PAD_TOP - PAD_BOTTOM);
}

function scoreToColor(score: number): string {
  if (score < 40) return "#10b981";
  if (score < 60) return "#f59e0b";
  return "#f97316";
}

export default function PanicHistory({ history }: PanicHistoryProps) {
  if (history.length < 2) {
    return (
      <div className="flex items-center justify-center h-[60px] text-[12px] text-slate-400 dark:text-slate-500 italic">
        History builds daily — check back tomorrow.
      </div>
    );
  }

  const last30 = history.slice(-30);
  const n = last30.length;

  const xOf = (i: number) =>
    PAD_LEFT + (i / (n - 1)) * (SVG_W - PAD_LEFT - PAD_RIGHT);

  // Polyline points string
  const points = last30
    .map((pt, i) => `${xOf(i).toFixed(1)},${scoreToY(pt.score).toFixed(1)}`)
    .join(" ");

  // Area fill path: down from last point, left along bottom, back up to first
  const firstX = xOf(0).toFixed(1);
  const lastX = xOf(n - 1).toFixed(1);
  const bottomY = (SVG_H - PAD_BOTTOM).toFixed(1);
  const areaPath = `M ${firstX} ${scoreToY(last30[0].score).toFixed(1)} L ${points.replace(/^\S+ /, "")} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

  // Neutral line at score=50
  const neutralY = scoreToY(50).toFixed(1);

  const latestScore = last30[n - 1].score;
  const latestX = xOf(n - 1);
  const latestY = scoreToY(latestScore);

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full"
        height="60"
        aria-label="Panic score history sparkline"
      >
        <defs>
          <linearGradient id="panicAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Neutral boundary */}
        <line
          x1={PAD_LEFT}
          y1={neutralY}
          x2={SVG_W - PAD_RIGHT}
          y2={neutralY}
          stroke="#94a3b8"
          strokeWidth={0.5}
          strokeDasharray="3 3"
          opacity={0.5}
        />
        <text
          x={SVG_W - PAD_RIGHT + 2}
          y={neutralY}
          fontSize={7}
          fill="#94a3b8"
          dominantBaseline="middle"
        >
          50
        </text>

        {/* Area fill */}
        <path d={areaPath} fill="url(#panicAreaGrad)" />

        {/* Sparkline polyline */}
        <polyline
          points={points}
          fill="none"
          stroke={scoreToColor(latestScore)}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Latest score dot */}
        <circle
          cx={latestX}
          cy={latestY}
          r={3}
          fill={scoreToColor(latestScore)}
        />

        {/* Latest score label */}
        <text
          x={latestX + 5}
          y={latestY}
          fontSize={8}
          fill={scoreToColor(latestScore)}
          dominantBaseline="middle"
          fontWeight={700}
        >
          {latestScore.toFixed(0)}
        </text>
      </svg>
      <div className="flex justify-between text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 px-1">
        <span>{last30[0].date}</span>
        <span>{last30[n - 1].date}</span>
      </div>
    </div>
  );
}
