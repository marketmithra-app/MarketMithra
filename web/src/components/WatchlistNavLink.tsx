"use client";

/**
 * WatchlistNavLink — header nav entry that shows the live watched count
 * as a small badge. Syncs across tabs via `subscribeWatchlist`.
 *
 * Server-side-safe: count is rendered as `null` during hydration so the
 * SSR markup and first-paint CSR markup match. The badge only appears once
 * localStorage has been read on the client.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { getWatchlistCount, subscribeWatchlist } from "@/lib/watchlist";

export default function WatchlistNavLink({ className = "" }: { className?: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const sync = () => setCount(getWatchlistCount());
    sync();
    return subscribeWatchlist(sync);
  }, []);

  return (
    <Link
      href="/watchlist"
      className={`hover:text-slate-900 dark:hover:text-slate-100 transition inline-flex items-center gap-1.5 ${className}`}
    >
      Watchlist
      {count !== null && count > 0 && (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-400 border border-amber-400/40 min-w-[18px] text-center leading-none">
          {count}
        </span>
      )}
    </Link>
  );
}
