"use client";

/**
 * RRGChart — Relative Rotation Graph (Julius de Kempenaer style).
 *
 * Pure SVG scatter of every Nifty sector plotted against Nifty 50 with an
 * 8-week "tail" so you can see which way each sector is rotating. The chart
 * is crossed at (100, 100) giving four quadrants:
 *
 *   Leading  (top-right)    — strong + getting stronger
 *   Weakening (bottom-right) — still strong but losing steam
 *   Lagging  (bottom-left)  — weak and getting weaker
 *   Improving (top-left)    — weak but picking up
 *
 * Healthy rotation is clockwise (Improving → Leading → Weakening → Lagging
 * → Improving). Counter-clockwise moves are typically head-fakes.
 */

import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

type TrailPoint = { rsRatio: number; rsMomentum: number };
type Quadrant = "leading" | "weakening" | "lagging" | "improving";

type Sector = {
  sector: string;
  stockCount: number;
  rsRatio: number;
  rsMomentum: number;
  quadrant: Quadrant;
  trail: TrailPoint[];
};

type RRGResponse = {
  asOf: string;
  benchmark: string;
  sectors: Sector[];
};

// Viewport bounds — centred on (100, 100).  ~2.4σ covers >98% of normal
// readings so on quiet days the axes are stable (readers build muscle
// memory of "right of centre = outperforming Nifty").  Computed per-render
// via `axisBounds()` below, which expands past the baseline when any
// sector blows past it — rare, but exactly when you want to SEE it.
const BASE_MIN = 88;
const BASE_MAX = 112;
const AX_PAD = 1.5; // breathing room past the extreme reading

// Each quadrant gets a distinct accent. Emerald/amber/rose/sky echoes the
// BUY/HOLD/SELL palette used elsewhere in the app.
const QUADRANT_COLORS: Record<Quadrant, { dot: string; text: string; bg: string }> = {
  leading:   { dot: "#10b981", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  weakening: { dot: "#f59e0b", text: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-500/10" },
  lagging:   { dot: "#f43f5e", text: "text-rose-600 dark:text-rose-400",       bg: "bg-rose-500/10" },
  improving: { dot: "#0ea5e9", text: "text-sky-600 dark:text-sky-400",         bg: "bg-sky-500/10" },
};

const QUADRANT_LABEL: Record<Quadrant, string> = {
  leading:   "Leading",
  weakening: "Weakening",
  lagging:   "Lagging",
  improving: "Improving",
};

/** Compute the visible axis range. Baseline 88–112, expanded (never
 * shrunk) to fit any outlier sector or trail point with breathing room. */
function axisBounds(sectors: Sector[]): { min: number; max: number } {
  let lo = BASE_MIN;
  let hi = BASE_MAX;
  for (const s of sectors) {
    for (const v of [s.rsRatio, s.rsMomentum]) {
      if (v - AX_PAD < lo) lo = Math.floor(v - AX_PAD);
      if (v + AX_PAD > hi) hi = Math.ceil(v + AX_PAD);
    }
    for (const t of s.trail) {
      for (const v of [t.rsRatio, t.rsMomentum]) {
        if (v - AX_PAD < lo) lo = Math.floor(v - AX_PAD);
        if (v + AX_PAD > hi) hi = Math.ceil(v + AX_PAD);
      }
    }
  }
  return { min: lo, max: hi };
}

/** Map a data coord (RS or Momentum) to SVG pixel for a given span. */
function toPx(value: number, bounds: { min: number; max: number }, span: number, pad: number): number {
  const clamped = Math.max(bounds.min, Math.min(bounds.max, value));
  return pad + ((clamped - bounds.min) / (bounds.max - bounds.min)) * span;
}

/** Pick tick positions at 5-unit intervals inside the visible range. */
function ticksFor(bounds: { min: number; max: number }): number[] {
  const out: number[] = [];
  // Snap the lowest tick to the nearest multiple of 5 at/above min.
  const start = Math.ceil(bounds.min / 5) * 5;
  for (let v = start; v <= bounds.max; v += 5) out.push(v);
  return out;
}

// ---------- subcomponents -------------------------------------------------

function RRGLegend() {
  return (
    <div className="grid grid-cols-2 gap-2 text-[11px]">
      {(["improving", "leading", "lagging", "weakening"] as Quadrant[]).map((q) => (
        <div key={q} className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: QUADRANT_COLORS[q].dot }}
          />
          <span className={`font-semibold ${QUADRANT_COLORS[q].text}`}>{QUADRANT_LABEL[q]}</span>
        </div>
      ))}
    </div>
  );
}

function SectorTableRow({ s, isHover, onHover }: {
  s: Sector;
  isHover: boolean;
  onHover: (name: string | null) => void;
}) {
  const c = QUADRANT_COLORS[s.quadrant];
  const first = s.trail[0];
  const deltaR = first ? s.rsRatio - first.rsRatio : 0;
  const deltaM = first ? s.rsMomentum - first.rsMomentum : 0;
  const rotation: "cw" | "ccw" | "flat" = (() => {
    if (s.trail.length < 3) return "flat";
    // Crude: is the path generally moving clockwise around (100,100)?
    // Use cross product of consecutive trail vectors.
    let cross = 0;
    for (let i = 1; i < s.trail.length - 1; i++) {
      const ax = s.trail[i].rsRatio - s.trail[i - 1].rsRatio;
      const ay = s.trail[i].rsMomentum - s.trail[i - 1].rsMomentum;
      const bx = s.trail[i + 1].rsRatio - s.trail[i].rsRatio;
      const by = s.trail[i + 1].rsMomentum - s.trail[i].rsMomentum;
      cross += ax * by - ay * bx;
    }
    if (Math.abs(cross) < 0.5) return "flat";
    return cross < 0 ? "cw" : "ccw";  // cw in screen coords (y-down) = negative cross in data coords (y-up); we use data coords so positive = ccw? reverse it: positive cross = ccw in data; rotation on screen reads the same way since our y-axis is inverted visually.
  })();

  return (
    <div
      className={`grid grid-cols-[80px_1fr_auto] items-center gap-2 px-2 py-1.5 rounded text-[11px] cursor-default transition ${
        isHover ? c.bg : "hover:bg-slate-100 dark:hover:bg-slate-800/40"
      }`}
      onMouseEnter={() => onHover(s.sector)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: c.dot }}
        />
        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{s.sector}</span>
      </div>
      <div className={`text-[10px] font-semibold ${c.text}`}>
        {QUADRANT_LABEL[s.quadrant]}
      </div>
      <div className="text-right font-mono text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
        <span className={deltaR >= 0 ? "text-emerald-500" : "text-rose-500"}>
          {deltaR >= 0 ? "+" : ""}{deltaR.toFixed(1)}
        </span>
        {" / "}
        <span className={deltaM >= 0 ? "text-emerald-500" : "text-rose-500"}>
          {deltaM >= 0 ? "+" : ""}{deltaM.toFixed(1)}
        </span>
        {rotation !== "flat" && (
          <span className="ml-1 opacity-60" title={rotation === "cw" ? "clockwise (healthy)" : "counter-clockwise (head-fake?)"}>
            {rotation === "cw" ? "↻" : "↺"}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------- main component ------------------------------------------------

export default function RRGChart() {
  const [data, setData] = useState<RRGResponse | null>(null);
  const [err, setErr] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/rrg`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((payload: RRGResponse) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        if (!cancelled) setErr(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Chart dims. We use SVG viewBox for crisp scaling, but pick a square area
  // since a rotation graph needs equal x/y visual weight.
  const SIZE = 520;          // px of viewBox
  const PAD = 44;            // margin for axis labels
  const SPAN = SIZE - PAD * 2;

  // Guard against `data?.sectors ?? []` producing a fresh array on every
  // render (which would thrash downstream useMemo deps).
  const sectors = useMemo(() => data?.sectors ?? [], [data]);

  // Axis range: baseline 88–112, expanded (never shrunk) to fit outliers.
  const bounds = useMemo(() => axisBounds(sectors), [sectors]);
  const ticks = useMemo(() => ticksFor(bounds), [bounds]);
  const ZERO_X = toPx(100, bounds, SPAN, PAD);
  const ZERO_Y = SIZE - toPx(100, bounds, SPAN, PAD);  // invert Y (SVG y grows down)

  // Build tooltip body when a sector is hovered
  const hoveredSector = useMemo(
    () => sectors.find((s) => s.sector === hover) ?? null,
    [hover, sectors],
  );

  if (err) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11131c] p-6 text-center text-[12px] text-slate-500">
        Sector rotation data unavailable. The API may be warming up — try again in a moment.
      </div>
    );
  }

  const isLoading = !data;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11131c] p-4">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Sector rotation
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Relative Rotation Graph · 8-week trail vs. {data?.benchmark ?? "Nifty 50"}
          </p>
        </div>
        <RRGLegend />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4">
        {/* SVG chart */}
        <div className="relative aspect-square w-full max-w-[560px] mx-auto md:mx-0">
          {isLoading && (
            <div className="absolute inset-0 grid place-items-center text-[11px] text-slate-400 font-mono animate-pulse">
              Loading rotation…
            </div>
          )}
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="w-full h-full"
            role="img"
            aria-label="Sector relative rotation graph"
          >
            {/* Arrowhead markers (one per quadrant colour) — used at the tip
                of each trail so rotation direction is read at a glance. */}
            <defs>
              {(Object.entries(QUADRANT_COLORS) as [Quadrant, typeof QUADRANT_COLORS[Quadrant]][]).map(([q, c]) => (
                <marker
                  key={q}
                  id={`rrg-arrow-${q}`}
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={c.dot} />
                </marker>
              ))}
            </defs>

            {/* Quadrant background tints */}
            <rect x={ZERO_X} y={PAD} width={SIZE - PAD - ZERO_X} height={ZERO_Y - PAD} fill="rgba(16,185,129,0.04)" />
            <rect x={ZERO_X} y={ZERO_Y} width={SIZE - PAD - ZERO_X} height={SIZE - PAD - ZERO_Y} fill="rgba(245,158,11,0.04)" />
            <rect x={PAD} y={ZERO_Y} width={ZERO_X - PAD} height={SIZE - PAD - ZERO_Y} fill="rgba(244,63,94,0.04)" />
            <rect x={PAD} y={PAD} width={ZERO_X - PAD} height={ZERO_Y - PAD} fill="rgba(14,165,233,0.04)" />

            {/* Gridlines at every 5-unit tick (skip 100 — main axis covers it) */}
            {ticks.filter((v) => v !== 100).map((v) => {
              const x = toPx(v, bounds, SPAN, PAD);
              const y = SIZE - toPx(v, bounds, SPAN, PAD);
              return (
                <g key={v}>
                  <line x1={x} y1={PAD} x2={x} y2={SIZE - PAD} stroke="currentColor" strokeWidth="0.5" className="text-slate-200 dark:text-slate-800" />
                  <line x1={PAD} y1={y} x2={SIZE - PAD} y2={y} stroke="currentColor" strokeWidth="0.5" className="text-slate-200 dark:text-slate-800" />
                </g>
              );
            })}

            {/* Axes (at 100, 100) */}
            <line x1={ZERO_X} y1={PAD} x2={ZERO_X} y2={SIZE - PAD} stroke="currentColor" strokeWidth="1" className="text-slate-400 dark:text-slate-600" />
            <line x1={PAD} y1={ZERO_Y} x2={SIZE - PAD} y2={ZERO_Y} stroke="currentColor" strokeWidth="1" className="text-slate-400 dark:text-slate-600" />

            {/* Quadrant labels */}
            <text x={SIZE - PAD - 6} y={PAD + 14}            textAnchor="end"   className="fill-emerald-600 dark:fill-emerald-400 text-[11px] font-bold">Leading</text>
            <text x={SIZE - PAD - 6} y={SIZE - PAD - 6}      textAnchor="end"   className="fill-amber-600 dark:fill-amber-400 text-[11px] font-bold">Weakening</text>
            <text x={PAD + 6}        y={SIZE - PAD - 6}      textAnchor="start" className="fill-rose-600 dark:fill-rose-400 text-[11px] font-bold">Lagging</text>
            <text x={PAD + 6}        y={PAD + 14}            textAnchor="start" className="fill-sky-600 dark:fill-sky-400 text-[11px] font-bold">Improving</text>

            {/* Axis tick labels */}
            {ticks.map((v) => (
              <g key={`xlbl-${v}`}>
                <text x={toPx(v, bounds, SPAN, PAD)} y={SIZE - PAD + 14} textAnchor="middle" className="fill-slate-500 text-[9px] font-mono">{v}</text>
              </g>
            ))}
            {ticks.map((v) => (
              <g key={`ylbl-${v}`}>
                <text x={PAD - 6} y={SIZE - toPx(v, bounds, SPAN, PAD) + 3} textAnchor="end" className="fill-slate-500 text-[9px] font-mono">{v}</text>
              </g>
            ))}

            {/* Axis titles */}
            <text x={SIZE / 2} y={SIZE - 6} textAnchor="middle" className="fill-slate-500 text-[10px] font-semibold">
              RS-Ratio (relative strength vs. Nifty 50)
            </text>
            <text
              x={-SIZE / 2}
              y={12}
              textAnchor="middle"
              transform="rotate(-90)"
              className="fill-slate-500 text-[10px] font-semibold"
            >
              RS-Momentum (rate of change)
            </text>

            {/* Sector trails + current dots */}
            {sectors.map((s) => {
              const dimmed = hover !== null && hover !== s.sector;
              const c = QUADRANT_COLORS[s.quadrant];

              // Trail path (skip if <2 points)
              const pts = s.trail.map((p) => ({
                x: toPx(p.rsRatio, bounds, SPAN, PAD),
                y: SIZE - toPx(p.rsMomentum, bounds, SPAN, PAD),
              }));
              const cx = toPx(s.rsRatio, bounds, SPAN, PAD);
              const cy = SIZE - toPx(s.rsMomentum, bounds, SPAN, PAD);

              return (
                <g key={s.sector} style={{ opacity: dimmed ? 0.15 : 1 }} className="transition-opacity">
                  {/* Trail line (all segments except the final one) */}
                  {pts.length >= 3 && (
                    <path
                      d={pts.slice(0, -1).map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
                      fill="none"
                      stroke={c.dot}
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.45}
                    />
                  )}
                  {/* Final segment with arrowhead — direction of rotation */}
                  {pts.length >= 2 && (() => {
                    const prev = pts[pts.length - 2];
                    const last = pts[pts.length - 1];
                    // Shorten the final segment by ~dot-radius so the arrow
                    // doesn't collide with the current-position dot.
                    const dx = last.x - prev.x;
                    const dy = last.y - prev.y;
                    const len = Math.hypot(dx, dy);
                    if (len < 0.5) return null;
                    const shrink = Math.min(8, len * 0.5);
                    const tx = last.x - (dx / len) * shrink;
                    const ty = last.y - (dy / len) * shrink;
                    return (
                      <line
                        x1={prev.x}
                        y1={prev.y}
                        x2={tx}
                        y2={ty}
                        stroke={c.dot}
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        opacity={0.75}
                        markerEnd={`url(#rrg-arrow-${s.quadrant})`}
                      />
                    );
                  })()}
                  {/* Trail dots (fading) */}
                  {pts.slice(0, -1).map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={2}
                      fill={c.dot}
                      opacity={0.15 + (0.55 * (i + 1)) / pts.length}
                    />
                  ))}
                  {/* Current position — solid dot + label */}
                  <circle cx={cx} cy={cy} r={6} fill={c.dot} stroke="white" strokeWidth={1.5} className="dark:stroke-[#11131c]" />
                  {/* Label with halo (stroke-first paint order) so labels
                      stay legible even when two sectors cluster close. */}
                  <text
                    x={cx + 9}
                    y={cy + 3}
                    stroke="white"
                    strokeWidth={3}
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    className="fill-slate-800 dark:fill-slate-100 dark:stroke-[#11131c] text-[10px] font-bold select-none"
                    onMouseEnter={() => setHover(s.sector)}
                    onMouseLeave={() => setHover(null)}
                  >
                    {s.sector}
                  </text>
                  {/* Hit target — larger invisible circle for easier hover */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={14}
                    fill="transparent"
                    onMouseEnter={() => setHover(s.sector)}
                    onMouseLeave={() => setHover(null)}
                    style={{ cursor: "pointer" }}
                  >
                    <title>{`${s.sector} · ${QUADRANT_LABEL[s.quadrant]} · RS ${s.rsRatio.toFixed(1)} / Mom ${s.rsMomentum.toFixed(1)} · ${s.stockCount} stocks`}</title>
                  </circle>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right-hand list: ranked by quadrant */}
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Sectors ({sectors.length}){hoveredSector ? ` · ${hoveredSector.sector}` : ""}
          </div>
          <div className="space-y-0.5 max-h-[320px] md:max-h-[480px] overflow-y-auto pr-1">
            {(["leading", "improving", "weakening", "lagging"] as Quadrant[]).flatMap((q) => {
              const bucket = sectors.filter((s) => s.quadrant === q);
              if (bucket.length === 0) return [];
              return [
                <div key={`h-${q}`} className={`text-[9px] font-bold uppercase tracking-wider pt-1 pb-0.5 ${QUADRANT_COLORS[q].text}`}>
                  {QUADRANT_LABEL[q]}
                </div>,
                ...bucket.map((s) => (
                  <SectorTableRow
                    key={s.sector}
                    s={s}
                    isHover={hover === s.sector}
                    onHover={setHover}
                  />
                )),
              ];
            })}
          </div>
          <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-800">
            Δ = 8-week change in RS / Momentum.{" "}
            <span title="Clockwise rotation is the healthy pattern; counter-clockwise often signals a head-fake.">
              ↻ clockwise · ↺ counter-clockwise
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
