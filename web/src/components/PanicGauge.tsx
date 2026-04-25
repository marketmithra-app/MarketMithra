"use client";

const ZONE_COLOR: Record<string, string> = {
  "Extreme Greed": "#10b981",
  "Greed": "#84cc16",
  "Neutral": "#f59e0b",
  "Fear": "#f97316",
  "Extreme Panic": "#f43f5e",
};

const SEGMENTS = [
  { startDeg: 0,   endDeg: 36,  color: "#10b981", label: "Extreme Greed" },
  { startDeg: 36,  endDeg: 72,  color: "#84cc16", label: "Greed" },
  { startDeg: 72,  endDeg: 108, color: "#f59e0b", label: "Neutral" },
  { startDeg: 108, endDeg: 144, color: "#f97316", label: "Fear" },
  { startDeg: 144, endDeg: 180, color: "#f43f5e", label: "Extreme Panic" },
];

const cx = 140;
const cy = 140;
const r = 110;

const toRad = (d: number) => (d * Math.PI) / 180;

// SVG angle: 0° = right, 90° = down.
// Score 0 → leftmost (SVG 180°), Score 100 → rightmost (SVG 0°).
// We map score % to degrees within the 180° arc:
//   scoreDeg = 0..180 in "arc space", where 0 = left end, 180 = right end.
// Then SVG angle = 180 - scoreDeg.
// Segments are indexed 0..4 (each 36° in arc space).

const arcX = (arcDeg: number) => cx + r * Math.cos(toRad(180 - arcDeg));
const arcY = (arcDeg: number) => cy - r * Math.sin(toRad(180 - arcDeg));

function segmentPath(startArcDeg: number, endArcDeg: number): string {
  const x1 = arcX(startArcDeg);
  const y1 = arcY(startArcDeg);
  const x2 = arcX(endArcDeg);
  const y2 = arcY(endArcDeg);
  const largeArc = endArcDeg - startArcDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

interface PanicGaugeProps {
  score: number;
  zone: string;
  loading?: boolean;
}

export default function PanicGauge({ score, zone, loading = false }: PanicGaugeProps) {
  // needle angle: score 0 → leftmost point, score 100 → rightmost point
  const needleArcDeg = (score / 100) * 180;
  const needleSvgAngleDeg = 180 - needleArcDeg;
  const needleRad = toRad(needleSvgAngleDeg);
  const needleLength = 95;
  const needleX = cx + needleLength * Math.cos(needleRad);
  const needleY = cy - needleLength * Math.sin(needleRad);

  const zoneColor = ZONE_COLOR[zone] ?? "#f59e0b";
  const displayScore = loading ? 50 : Math.round(score);
  const loadingNeedleRad = toRad(90); // 50 = middle = 90° SVG angle
  const loadingNeedleX = cx + needleLength * Math.cos(loadingNeedleRad);
  const loadingNeedleY = cy - needleLength * Math.sin(loadingNeedleRad);

  const finalNeedleX = loading ? loadingNeedleX : needleX;
  const finalNeedleY = loading ? loadingNeedleY : needleY;

  return (
    <svg
      viewBox="0 0 280 160"
      className="w-full max-w-[320px] mx-auto"
      height="auto"
      aria-label={`Panic-O-Meter: ${displayScore} — ${zone}`}
    >
      {/* Arc segments */}
      {SEGMENTS.map((seg) => (
        <path
          key={seg.label}
          d={segmentPath(seg.startDeg, seg.endDeg)}
          stroke={seg.color}
          strokeWidth={18}
          fill="none"
          strokeLinecap="round"
          opacity={0.85}
        />
      ))}

      {/* Needle */}
      <line
        x1={cx}
        y1={cy}
        x2={finalNeedleX}
        y2={finalNeedleY}
        stroke={loading ? "#94a3b8" : zoneColor}
        strokeWidth={3}
        strokeLinecap="round"
        style={{ transition: "all 1s ease-out" }}
      />

      {/* Needle hub circle */}
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill={loading ? "#94a3b8" : zoneColor}
        style={{ transition: "fill 1s ease-out" }}
      />

      {/* Score text */}
      {loading ? (
        <>
          <rect x={110} y={95} width={60} height={28} rx={6} fill="#e2e8f0" opacity={0.5}>
            <animate attributeName="opacity" values="0.3;0.7;0.3" dur="1.4s" repeatCount="indefinite" />
          </rect>
          <rect x={116} y={128} width={48} height={12} rx={4} fill="#e2e8f0" opacity={0.4}>
            <animate attributeName="opacity" values="0.2;0.6;0.2" dur="1.4s" repeatCount="indefinite" />
          </rect>
        </>
      ) : (
        <>
          <text
            x={cx}
            y={118}
            textAnchor="middle"
            fontSize={42}
            fontWeight={900}
            fill={zoneColor}
            style={{ transition: "fill 1s ease-out" }}
          >
            {displayScore}
          </text>
          <text
            x={cx}
            y={138}
            textAnchor="middle"
            fontSize={12}
            fontWeight={700}
            fill={zoneColor}
            style={{ transition: "fill 1s ease-out" }}
            letterSpacing={1}
          >
            {zone.toUpperCase()}
          </text>
        </>
      )}

      {/* Min/max labels */}
      <text x={16} y={150} fontSize={10} fill="#94a3b8" textAnchor="middle">0</text>
      <text x={264} y={150} fontSize={10} fill="#94a3b8" textAnchor="middle">100</text>
    </svg>
  );
}
