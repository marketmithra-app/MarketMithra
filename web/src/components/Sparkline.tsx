"use client";

interface Props {
  data: number[];
  stroke?: string;
  fill?: string;
  height?: number;
  width?: number;
}

export default function Sparkline({
  data,
  stroke = "#a78bfa",
  fill = "rgba(167,139,250,0.18)",
  height = 36,
  width = 180,
}: Props) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1 || 1);

  const points = data
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const area = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} className="block">
      <polygon points={area} fill={fill} />
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
