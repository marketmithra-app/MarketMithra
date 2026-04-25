"use client";

import { useEffect, useState } from "react";
import type { TallyResult } from "@/lib/types";

interface Props {
  symbol: string; // full symbol e.g. "RELIANCE.NS"
}

export default function VoteTally({ symbol }: Props) {
  const [tally, setTally] = useState<TallyResult | null>(null);

  useEffect(() => {
    fetch(`/api/tally?symbol=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((d: TallyResult) => setTally(d))
      .catch(() => {});
  }, [symbol]);

  if (!tally || tally.total === 0) return null;

  const { agree_count, disagree_count, total } = tally;
  const agreePct    = Math.round((agree_count    / total) * 100);
  const disagreePct = Math.round((disagree_count / total) * 100);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c0e16] p-4 mb-8">
      <div className="text-xs text-slate-500 mb-3 uppercase tracking-wider">
        Community verdict · {total} vote{total !== 1 ? "s" : ""}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-semibold text-emerald-400 w-20 shrink-0">
          👍 {agreePct}%
        </span>
        <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex">
          <div
            className="h-full bg-emerald-500 rounded-l-full"
            style={{ width: `${agreePct}%` }}
          />
          <div
            className="h-full bg-rose-500 rounded-r-full"
            style={{ width: `${disagreePct}%` }}
          />
        </div>
        <span className="text-[13px] font-semibold text-rose-400 w-20 shrink-0 text-right">
          👎 {disagreePct}%
        </span>
      </div>
      <div className="mt-2 text-[10px] text-slate-600 text-right">
        {agree_count} agree · {disagree_count} disagree
      </div>
    </div>
  );
}
