"use client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DarvasBox {
  top: number;
  bottom: number;
  width_pct: number;
  started: string;
  ended: string | null;
  days: number;
  breakout_date: string | null;
  breakout_confirmed: boolean;
  breakdown: boolean;
}

export interface CurrentBox {
  top: number;
  bottom: number;
  width_pct: number;
  days_active: number;
  started: string;
  price_now: number;
  proximity_pct: number;
  volume_ratio: number;
}

export interface DarvasData {
  symbol: string;
  name: string;
  status: "in_box" | "approaching" | "breakout" | "below_box" | "no_box";
  status_label: string;
  current_box: CurrentBox | null;
  breakout: {
    confirmed: boolean;
    price_triggered: boolean;
    volume_confirmed: boolean;
    date: string | null;
  };
  stop_loss: number | null;
  boxes: DarvasBox[];
  as_of: string;
}

// ── Status colour map ─────────────────────────────────────────────────────────

const STATUS_STYLE: Record<
  DarvasData["status"],
  { badge: string; dot: string }
> = {
  in_box: {
    badge:
      "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    dot: "bg-amber-500",
  },
  approaching: {
    badge:
      "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/50",
    dot: "bg-amber-400 animate-ping",
  },
  breakout: {
    badge:
      "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  below_box: {
    badge:
      "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
    dot: "bg-rose-500",
  },
  no_box: {
    badge: "bg-slate-500/15 text-slate-500 border-slate-500/20",
    dot: "bg-slate-500",
  },
};

// ── Price pill ────────────────────────────────────────────────────────────────

function PricePill({
  label,
  value,
  sub,
  color,
  currency = true,
}: {
  label: string;
  value: number;
  sub?: string;
  color?: string;
  currency?: boolean;
}) {
  const formatted = currency
    ? value.toLocaleString("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      })
    : value.toLocaleString("en-IN");

  return (
    <div className="flex-1 rounded-lg bg-slate-50 dark:bg-slate-800/40 p-3 text-center">
      <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">
        {label}
      </div>
      <div className={`text-base font-black font-mono ${color ?? "text-slate-900 dark:text-slate-100"}`}>
        {formatted}
      </div>
      {sub && (
        <div className="text-[9px] text-slate-500 mt-0.5">{sub}</div>
      )}
    </div>
  );
}

// ── SVG Staircase ─────────────────────────────────────────────────────────────

function DarvasStaircase({
  boxes,
  currentBox,
  status,
}: {
  boxes: DarvasBox[];
  currentBox: CurrentBox | null;
  status: DarvasData["status"];
}) {
  // Show last 4 boxes
  const visibleBoxes = boxes.slice(-4);
  if (visibleBoxes.length === 0) return null;

  const allPrices = visibleBoxes.flatMap((b) => [b.top, b.bottom]);
  const priceMin = Math.min(...allPrices) * 0.98;
  const priceMax = Math.max(...allPrices) * 1.02;

  const toY = (price: number) =>
    160 - ((price - priceMin) / (priceMax - priceMin)) * 140 - 10;

  const numBoxes = visibleBoxes.length;
  const boxWidth = 480 / numBoxes;

  return (
    <svg
      viewBox="0 0 480 160"
      className="w-full"
      aria-label="Darvas box staircase chart"
    >
      {visibleBoxes.map((box, i) => {
        const x = i * boxWidth;
        const yTop = toY(box.top);
        const yBottom = toY(box.bottom);
        const rectHeight = Math.max(yBottom - yTop, 2);

        const isLast = i === numBoxes - 1;
        const isActive = isLast && currentBox !== null;

        let fill = "rgba(100,116,139,0.08)";
        let stroke = "#94a3b8";
        let strokeWidth = "1";
        let strokeDasharray: string | undefined;

        if (isActive) {
          fill = "rgba(245,158,11,0.12)";
          stroke = "#f59e0b";
          strokeDasharray = "4,2";
        } else if (box.breakout_confirmed) {
          fill = "rgba(16,185,129,0.1)";
          stroke = "#10b981";
          strokeWidth = "1";
        } else if (box.breakdown) {
          fill = "rgba(239,68,68,0.1)";
          stroke = "#ef4444";
          strokeWidth = "1";
        }

        // Price label at top-right of box
        const labelX = x + boxWidth - 6;
        const labelY = yTop - 3;

        return (
          <g key={`${box.started}-${i}`}>
            <rect
              x={x + 2}
              y={yTop}
              width={boxWidth - 4}
              height={rectHeight}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              rx={2}
            />
            {/* Top price label */}
            <text
              x={labelX}
              y={labelY}
              textAnchor="end"
              fontSize="8"
              fill="#94a3b8"
              fontFamily="monospace"
            >
              ₹{box.top.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </text>

            {/* Status indicator for active box */}
            {isActive && status === "breakout" && (
              <text
                x={x + boxWidth / 2}
                y={yTop - 6}
                textAnchor="middle"
                fontSize="12"
                fill="#10b981"
              >
                ↑
              </text>
            )}
            {isActive && status === "approaching" && (
              <text
                x={x + boxWidth / 2}
                y={yTop - 6}
                textAnchor="middle"
                fontSize="12"
                fill="#f59e0b"
              >
                ↗
              </text>
            )}
          </g>
        );
      })}

      {/* Current price line across full width */}
      {currentBox && (
        <line
          x1={0}
          y1={toY(currentBox.price_now)}
          x2={480}
          y2={toY(currentBox.price_now)}
          stroke="#f59e0b"
          strokeWidth="1"
          strokeDasharray="3,2"
          opacity={0.7}
        />
      )}
    </svg>
  );
}

// ── Box history table ─────────────────────────────────────────────────────────

function BoxHistoryRow({ box }: { box: DarvasBox }) {
  let chipText = "Active";
  let chipClass =
    "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";

  if (box.breakout_confirmed) {
    chipText = "✓ Broke out";
    chipClass =
      "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
  } else if (box.breakdown) {
    chipText = "↓ Broke down";
    chipClass =
      "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
  }

  const rangeText = `₹${box.bottom.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}–₹${box.top.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  return (
    <div className="flex items-center gap-3 py-2 text-[11px] border-t border-slate-100 dark:border-slate-800 first:border-t-0">
      <span className="text-slate-500 w-16 shrink-0">{box.started}</span>
      <span className="text-slate-400 w-14 shrink-0">{box.days}d</span>
      <span className="text-slate-700 dark:text-slate-300 flex-1 font-mono">
        {rangeText}
      </span>
      <span
        className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${chipClass}`}
      >
        {chipText}
      </span>
    </div>
  );
}

// ── Loading skeleton (exported) ───────────────────────────────────────────────

export function DarvasSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11131c] p-5 mb-8 animate-pulse">
      <div className="h-5 w-48 rounded bg-slate-200 dark:bg-slate-700 mb-3" />
      <div className="h-40 w-full rounded bg-slate-100 dark:bg-slate-800 mb-4" />
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 rounded-lg bg-slate-100 dark:bg-slate-800"
          />
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DarvasSection({ data }: { data: DarvasData }) {
  const style = STATUS_STYLE[data.status];
  const cb = data.current_box;

  // History table: last 4 boxes, most recent first, exclude the active one if
  // we're showing it in the staircase already
  const historyBoxes = data.boxes.length > 1 ? data.boxes.slice(-4) : [];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11131c] p-5 mb-8">

      {/* ── Header row ── */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <div className="text-base font-black text-slate-900 dark:text-slate-100">
            📦 Darvas Box Analysis
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 max-w-sm leading-snug">
            Darvas boxes identify price consolidation ranges. A breakout above
            the box top on high volume is a potential entry signal. The box
            bottom is your stop loss.
          </p>
        </div>

        {/* Status badge */}
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full border whitespace-nowrap shrink-0 ${style.badge}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
          {data.status_label}
        </span>
      </div>

      {/* ── Subtitle ── */}
      {cb && (
        <p className="text-[11px] text-slate-500 mb-4">
          Box active {cb.days_active} days&nbsp;·&nbsp;Width {cb.width_pct.toFixed(1)}%
          {data.stop_loss != null &&
            `\u00A0·\u00A0Stop loss \u20B9${data.stop_loss.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
        </p>
      )}

      {/* ── SVG staircase ── */}
      {data.boxes.length > 0 && (
        <div className="mb-4">
          <DarvasStaircase
            boxes={data.boxes}
            currentBox={cb}
            status={data.status}
          />
        </div>
      )}

      {/* ── No-box empty state ── */}
      {data.status === "no_box" && (
        <div className="text-center py-6">
          <div className="text-3xl mb-2">📦</div>
          <p className="text-sm text-slate-500">No active Darvas box detected</p>
          <p className="text-xs text-slate-400 mt-1">
            A box forms when a stock consolidates in a tight range for 5+ days.
            Check back when the stock shows clearer consolidation.
          </p>
        </div>
      )}

      {/* ── Stats pills ── */}
      {cb && (
        <div className="flex gap-3 mb-4">
          <PricePill
            label="Box Top"
            value={cb.top}
            sub={`${cb.proximity_pct.toFixed(1)}% away`}
            color="text-amber-600 dark:text-amber-400"
          />
          <PricePill
            label="Box Bottom"
            value={cb.bottom}
          />
          <PricePill
            label="Stop Loss"
            value={data.stop_loss ?? cb.bottom}
            sub="exit level"
            color="text-rose-500"
          />
          <PricePill
            label="Days Active"
            value={cb.days_active}
            sub="in box"
            currency={false}
          />
        </div>
      )}

      {/* ── Box history table ── */}
      {historyBoxes.length > 1 && (
        <div className="mt-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
            Recent boxes
          </div>
          {historyBoxes.map((box, i) => (
            <BoxHistoryRow key={`${box.started}-${i}`} box={box} />
          ))}
        </div>
      )}
    </div>
  );
}
