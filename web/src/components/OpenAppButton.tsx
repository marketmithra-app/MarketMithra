"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { addRecentSymbol } from "@/lib/recentSymbols";

const KEY = "mm_last_symbol";

/** Save the last-viewed symbol. Call from CanvasMain on every symbol change. */
export function saveLastSymbol(symbol: string): void {
  try {
    localStorage.setItem(KEY, symbol);
    addRecentSymbol(symbol);
  } catch { /* quota */ }
}

/** "Open app →" button that resumes at the last-viewed stock. */
export default function OpenAppButton({ className }: { className?: string }) {
  const [href, setHref] = useState("/canvas");

  useEffect(() => {
    try {
      const last = localStorage.getItem(KEY);
      if (last) setHref(`/canvas?symbol=${encodeURIComponent(last)}`);
    } catch { /* SSR / quota */ }
  }, []);

  return (
    <Link href={href} className={className}>
      Open app →
    </Link>
  );
}
