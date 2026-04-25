"use client";

/**
 * WatchlistStar — reusable ★/☆ toggle that adds/removes a symbol from the
 * user's localStorage watchlist. Cross-tab synced via `subscribeWatchlist`.
 *
 * Variants:
 *   - "pill" (default): outlined pill suitable for the signal-detail header
 *   - "icon": bare star, tight fit (e.g. table rows)
 */

import { useEffect, useState } from "react";
import {
  isWatched,
  toggleWatch,
  subscribeWatchlist,
  WATCHLIST_MAX,
  getWatchlistCount,
} from "@/lib/watchlist";

type Variant = "pill" | "icon";

export default function WatchlistStar({
  symbol,
  variant = "pill",
  className = "",
}: {
  symbol: string;
  variant?: Variant;
  className?: string;
}) {
  // `null` during hydration → render a neutral placeholder so SSR and
  // first-paint client markup match (localStorage is unavailable server-side).
  const [on, setOn] = useState<boolean | null>(null);
  const [atCap, setAtCap] = useState(false);

  useEffect(() => {
    const sync = () => {
      setOn(isWatched(symbol));
      setAtCap(getWatchlistCount() >= WATCHLIST_MAX);
    };
    sync();
    return subscribeWatchlist(sync);
  }, [symbol]);

  const label = on ? "Remove from watchlist" : "Add to watchlist";
  const showCapHint = !on && atCap;

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (on === null) return;
    const nowOn = toggleWatch(symbol);
    setOn(nowOn);
  };

  if (on === null) {
    // Hydration placeholder — same footprint as the rendered button so
    // layout doesn't shift when state resolves.
    if (variant === "icon") {
      return <span className={`inline-block w-4 text-slate-400 ${className}`}>☆</span>;
    }
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1 text-[11px] text-slate-400 ${className}`}
      >
        ☆ Watchlist
      </span>
    );
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={showCapHint ? `Watchlist full (${WATCHLIST_MAX}) — remove one first` : label}
        className={`inline-flex items-center justify-center text-[14px] transition ${
          on
            ? "text-amber-500"
            : "text-slate-400 hover:text-amber-500"
        } ${className}`}
      >
        {on ? "★" : "☆"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={showCapHint ? `Watchlist full (${WATCHLIST_MAX}) — remove one first` : label}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
        on
          ? "border-amber-400/60 bg-amber-400/10 text-amber-600 dark:text-amber-400 hover:bg-amber-400/15"
          : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-400/60 hover:text-amber-600 dark:hover:text-amber-400"
      } ${className}`}
    >
      <span className="text-[13px] leading-none">{on ? "★" : "☆"}</span>
      <span>{on ? "Watching" : "Watch"}</span>
    </button>
  );
}
