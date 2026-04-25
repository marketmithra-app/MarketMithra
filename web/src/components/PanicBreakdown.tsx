"use client";

interface ComponentData {
  value: number;
  score: number;
  weight: number;
  label: string;
}

interface PanicBreakdownProps {
  components: Record<string, ComponentData>;
}

function barColor(score: number): string {
  if (score < 40) return "bg-emerald-500";
  if (score < 60) return "bg-amber-500";
  return "bg-rose-500";
}

export default function PanicBreakdown({ components }: PanicBreakdownProps) {
  const entries = Object.entries(components);

  return (
    <div className="grid grid-cols-1 gap-4 w-full">
      {entries.map(([key, comp]) => (
        <div key={key} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              {comp.label}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-slate-400 dark:text-slate-500">
                {Math.round(comp.weight * 100)}% weight
              </span>
              <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 min-w-[2.5rem] text-right">
                {comp.score.toFixed(1)}
              </span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${barColor(comp.score)}`}
              style={{ width: `${Math.min(100, Math.max(0, comp.score))}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
            raw: {typeof comp.value === "number" && comp.value < 1 && comp.value > 0
              ? comp.value.toFixed(2)
              : comp.value.toFixed(1)}
          </div>
        </div>
      ))}
    </div>
  );
}
