"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import type { StockSnapshot, Verdict } from "@/lib/types";
import { getWatchlist, toggleWatch } from "@/lib/watchlist";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

const BADGE: Record<Verdict, string> = {
  BUY:  "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  HOLD: "text-amber-300  border-amber-500/40  bg-amber-500/10",
  SELL: "text-rose-300   border-rose-500/40   bg-rose-500/10",
};
const BAR: Record<Verdict, string> = {
  BUY:  "bg-emerald-500",
  HOLD: "bg-amber-500",
  SELL: "bg-rose-500",
};

export default function MobileRankingsDrawer({
  activeSymbol,
}: {
  activeSymbol: string;
}) {
  const [open, setOpen]       = useState(false);
  const [ranked, setRanked]   = useState<StockSnapshot[]>([]);
  const [loaded, setLoaded]   = useState(false);
  const [watched, setWatched] = useState<Set<string>>(new Set());
  const drawerRef = useRef<HTMLDivElement>(null);

  // Fetch once on first open
  useEffect(() => {
    if (!open || loaded) return;
    fetch(`${API_BASE}/ranked?limit=50`)
      .then((r) => r.json())
      .then((data: StockSnapshot[]) => {
        setRanked(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [open, loaded]);

  // Sync watchlist from localStorage on open
  useEffect(() => {
    if (open) setWatched(new Set(getWatchlist()));
  }, [open]);

  function handleStar(e: React.MouseEvent, symbol: string) {
    e.preventDefault();
    e.stopPropagation();
    const nowWatched = toggleWatch(symbol);
    setWatched((prev) => {
      const next = new Set(prev);
      if (nowWatched) next.add(symbol); else next.delete(symbol);
      return next;
    });
  }

  // Trap body scroll while open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const buys  = ranked.filter((s) => s.fusion.verdict === "BUY").length;
  const total = ranked.length;

  return (
    <>
      {/* ── FAB — only visible on mobile ── */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full bg-[#11131c] border border-slate-700 shadow-lg px-4 py-2.5 text-[12px] font-semibold text-slate-200 hover:border-amber-400/60 hover:text-amber-300 transition"
      >
        <span className="text-[10px]">▲</span> Rankings
        {total > 0 && (
          <span className="ml-1 text-emerald-400 font-mono">{buys} BUY</span>
        )}
      </button>

      {/* ── Backdrop ── */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Drawer ── */}
      <div
        ref={drawerRef}
        className={`md:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-[#0c0e16] border-t border-slate-800 transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight: "75dvh", display: "flex", flexDirection: "column" }}
      >
        {/* header */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-800 shrink-0 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-100">
              Nifty 50 rankings
            </div>
            {total > 0 && (
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                <span className="text-emerald-400">{buys} BUY</span> / {total} stocks
              </div>
            )}
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-full border border-slate-700 px-3 py-1 text-[11px] text-slate-400 hover:text-slate-200 transition"
          >
            Close ✕
          </button>
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto">
          {!loaded ? (
            <div className="py-12 text-center text-xs text-slate-500 animate-pulse">
              Loading rankings…
            </div>
          ) : ranked.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Rankings unavailable — API may be offline.
            </div>
          ) : (() => {
            const watchlistSnaps = ranked.filter((s) => watched.has(s.symbol));
            return (
              <>
                {/* watchlist pinned section */}
                {watchlistSnaps.length > 0 && (
                  <>
                    <div className="px-4 py-1.5 text-[10px] font-semibold text-amber-500/80 uppercase tracking-wider bg-amber-500/5 border-b border-amber-500/10">
                      ★ Watchlist
                    </div>
                    <ul className="divide-y divide-slate-800/60 border-b border-slate-800">
                      {watchlistSnaps.map((s) => {
                        const pct  = Math.round(s.fusion.probability * 100);
                        const sym  = s.symbol.replace(".NS", "").replace(".BO", "");
                        const rank = ranked.findIndex((r) => r.symbol === s.symbol) + 1;
                        return (
                          <li key={`w-${s.symbol}`} className="flex items-center gap-2 px-4 py-2.5">
                            <Link
                              href={`/canvas?symbol=${encodeURIComponent(s.symbol)}`}
                              onClick={() => setOpen(false)}
                              className="flex-1 min-w-0 flex items-center gap-2"
                            >
                              <span className="text-[10px] text-slate-600 font-mono w-5 text-right shrink-0">{rank}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-[13px] font-semibold truncate text-amber-400">{sym}</span>
                                  <span className={`shrink-0 text-[9px] font-bold px-1.5 py-px rounded border ${BADGE[s.fusion.verdict]}`}>{s.fusion.verdict}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                                    <div className={`h-full rounded-full ${BAR[s.fusion.verdict]}`} style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-[9px] font-mono text-slate-500 shrink-0 w-7 text-right">{pct}%</span>
                                </div>
                              </div>
                            </Link>
                            <button onClick={(e) => handleStar(e, s.symbol)} className="text-amber-400 text-[14px] shrink-0 pl-1">★</button>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="px-4 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-800/20">
                      All Nifty 50
                    </div>
                  </>
                )}

                {/* full list */}
                <ul className="divide-y divide-slate-800/60">
                  {ranked.map((s, i) => {
                    const pct      = Math.round(s.fusion.probability * 100);
                    const sym      = s.symbol.replace(".NS", "").replace(".BO", "");
                    const isActive = s.symbol === activeSymbol;
                    const isWatched = watched.has(s.symbol);
                    return (
                      <li key={s.symbol} className="flex items-center gap-2 group">
                        <Link
                          href={`/canvas?symbol=${encodeURIComponent(s.symbol)}`}
                          onClick={() => setOpen(false)}
                          className={`flex-1 flex items-center gap-3 px-4 py-2.5 min-w-0 transition ${
                            isActive
                              ? "bg-amber-500/5 border-l-2 border-amber-400"
                              : "border-l-2 border-transparent active:bg-slate-800/40"
                          }`}
                        >
                          <span className="text-[10px] text-slate-600 font-mono w-5 text-right shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className={`text-[13px] font-semibold truncate ${isActive ? "text-amber-400" : "text-slate-100"}`}>{sym}</span>
                              <span className={`shrink-0 text-[9px] font-bold px-1.5 py-px rounded border ${BADGE[s.fusion.verdict]}`}>{s.fusion.verdict}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                                <div className={`h-full rounded-full ${BAR[s.fusion.verdict]}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[9px] font-mono text-slate-500 shrink-0 w-7 text-right">{pct}%</span>
                            </div>
                          </div>
                        </Link>
                        <button
                          onClick={(e) => handleStar(e, s.symbol)}
                          className={`shrink-0 text-[14px] pr-4 transition ${isWatched ? "text-amber-400" : "text-slate-700 opacity-0 group-hover:opacity-100"}`}
                        >
                          {isWatched ? "★" : "☆"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            );
          })()}
        </div>

        {/* footer safe area */}
        <div className="shrink-0 pb-safe border-t border-slate-800 px-4 py-2 text-[10px] text-slate-600">
          Live NSE · EOD via yfinance · cached 30 min
        </div>
      </div>
    </>
  );
}
