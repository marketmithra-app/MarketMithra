"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { StockSnapshot, Verdict } from "@/lib/types";
import VerdictFlipHistory from "@/components/VerdictFlipHistory";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

const VC: Record<Verdict, { bg: string; text: string; bar: string }> = {
  BUY:  { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" },
  HOLD: { bg: "bg-amber-500/10",   text: "text-amber-600 dark:text-amber-400",     bar: "bg-amber-500"  },
  SELL: { bg: "bg-rose-500/10",    text: "text-rose-600 dark:text-rose-400",       bar: "bg-rose-500"   },
};

export default function TrackRecordStats() {
  const [ranked, setRanked] = useState<StockSnapshot[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/ranked?limit=50`)
      .then((r) => r.json())
      .then((d) => { setRanked(d); setLoading(false); })
      .catch(() => { setRanked([]); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <>
        {/* distribution card skeleton */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c0e16] p-6 mb-8">
          <div className="h-3 w-48 rounded bg-slate-700/40 animate-pulse mb-4" />
          <div className="grid grid-cols-3 gap-4 mb-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-lg bg-slate-800/30 p-4 text-center">
                <div className="h-9 w-10 rounded bg-slate-700/50 animate-pulse mx-auto mb-1" />
                <div className="h-2.5 w-8 rounded bg-slate-700/40 animate-pulse mx-auto" />
              </div>
            ))}
          </div>
          <div className="h-2 rounded-full bg-slate-800 animate-pulse" />
        </div>

        {/* top buys table skeleton */}
        <div className="mb-10">
          <div className="h-5 w-44 rounded bg-slate-700/40 animate-pulse mb-4" />
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="h-9 bg-slate-50 dark:bg-[#0c0e16] border-b border-slate-200 dark:border-slate-800" />
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 last:border-0">
                <div className="w-4 h-3 rounded bg-slate-700/40 animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className={`h-3 rounded bg-slate-700/60 animate-pulse ${i % 2 === 0 ? "w-20" : "w-28"}`} />
                  <div className="h-2 w-32 rounded bg-slate-700/30 animate-pulse" />
                </div>
                <div className="h-3 w-10 rounded bg-slate-700/40 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (!ranked || ranked.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-6 text-center mb-8 text-sm text-slate-500">
        Live stats unavailable — API offline.
      </div>
    );
  }

  const counts = ranked.reduce(
    (acc, s) => { acc[s.fusion.verdict] = (acc[s.fusion.verdict] ?? 0) + 1; return acc; },
    {} as Record<string, number>
  );
  const total = ranked.length;

  const buys = ranked
    .filter((s) => s.fusion.verdict === "BUY")
    .sort((a, b) => b.fusion.probability - a.fusion.probability)
    .slice(0, 5);

  const today = new Date().toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <>
      {/* signal distribution */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c0e16] p-6 mb-8">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-4">
          Live Nifty 50 signal distribution · {today}
        </div>
        <div className="grid grid-cols-3 gap-4 mb-5">
          {(["BUY", "HOLD", "SELL"] as Verdict[]).map((v) => {
            const n = counts[v] ?? 0;
            const pct = Math.round((n / total) * 100);
            const c = VC[v];
            return (
              <div key={v} className={`rounded-lg ${c.bg} p-4 text-center`}>
                <div className={`text-3xl font-black font-mono ${c.text}`}>{n}</div>
                <div className={`text-xs font-bold ${c.text} mt-0.5`}>{v}</div>
                <div className="text-[10px] text-slate-500 mt-1">{pct}% of Nifty 50</div>
              </div>
            );
          })}
        </div>
        {/* stacked bar */}
        <div className="h-2 rounded-full overflow-hidden flex">
          {(["BUY", "HOLD", "SELL"] as Verdict[]).map((v) => {
            const pct = Math.round(((counts[v] ?? 0) / total) * 100);
            return pct > 0 ? (
              <div key={v} className={`h-full ${VC[v].bar}`} style={{ width: `${pct}%` }} />
            ) : null;
          })}
        </div>
        <div className="mt-2 text-[10px] text-slate-500">
          Based on end-of-day NSE data · {total} stocks · cached 30 min
        </div>
      </div>

      {/* top BUY picks */}
      {buys.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-black mb-4">
            Today&apos;s top BUY signals
          </h2>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c0e16]">
                  <th className="text-left px-4 py-2.5 text-[11px] text-slate-500 font-semibold">#</th>
                  <th className="text-left px-4 py-2.5 text-[11px] text-slate-500 font-semibold">Stock</th>
                  <th className="text-right px-4 py-2.5 text-[11px] text-slate-500 font-semibold">Fusion prob.</th>
                  <th className="text-right px-4 py-2.5 text-[11px] text-slate-500 font-semibold">Price</th>
                  <th className="text-right px-4 py-2.5 text-[11px] text-slate-500 font-semibold hidden md:table-cell">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {buys.map((s, i) => {
                  const pct = Math.round(s.fusion.probability * 100);
                  const target = s.fusion.synthesis?.target ?? s.fusion.priceLevels?.target;
                  return (
                    <tr key={s.symbol} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3 text-[12px] text-slate-500 font-mono">{i + 1}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/canvas?symbol=${encodeURIComponent(s.symbol)}`}
                          className="font-semibold text-slate-900 dark:text-slate-100 hover:text-amber-600 dark:hover:text-amber-400 transition text-[13px]"
                        >
                          {s.symbol.replace(".NS", "").replace(".BO", "")}
                        </Link>
                        <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                          {s.name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[12px] font-mono text-emerald-500 font-semibold w-8">
                            {pct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-[12px] font-mono text-slate-700 dark:text-slate-300">
                        {s.price.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-3 text-right text-[12px] font-mono text-emerald-500 hidden md:table-cell">
                        {target
                          ? target.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Click any stock to open its full signal canvas · Educational only, not advice
          </p>
        </div>
      )}

      <VerdictFlipHistory />
    </>
  );
}
