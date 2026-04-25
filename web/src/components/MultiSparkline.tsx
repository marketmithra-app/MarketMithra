"use client";

interface Line {
  data: number[];
  stroke: string;
  width?: number;
  opacity?: number;
}

interface Props {
  lines: Line[];
  width?: number;
  height?: number;
}

// Renders multiple lines on a shared y-axis auto-fit to all values.
export default function MultiSparkline({
  lines,
  width = 206,
  height = 44,
}: Props) {
  if (!lines.length) return null;
  const all = lines.flatMap((l) => l.data);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;
  const n = Math.max(...lines.map((l) => l.data.length));
  const step = width / (n - 1 || 1);

  return (
    <svg width={width} height={height} className="block">
      {lines.map((l, i) => {
        const points = l.data
          .map((v, j) => {
            const x = j * step;
            const y = height - ((v - min) / range) * height;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(" ");
        return (
          <polyline
            key={i}
            points={points}
            fill="none"
            stroke={l.stroke}
            strokeWidth={l.width ?? 1.5}
            strokeOpacity={l.opacity ?? 1}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}
