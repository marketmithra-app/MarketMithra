"use client";

/**
 * FreshnessBadge — compact pill showing how old the signal is.
 * Uses client-side rendering so the "ago" label is always relative
 * to the viewer's clock, not the server render time.
 */

import { useEffect, useState } from "react";
import {
  freshnessFromAsOf,
  freshnessPillClass,
  freshnessDotClass,
} from "@/lib/freshness";

interface Props {
  asOf: string | null | undefined;
  /** Smaller variant for dense layouts. */
  size?: "sm" | "md";
  /** Add a short prefix, e.g. "Data · ". */
  prefix?: string;
}

export default function FreshnessBadge({ asOf, size = "md", prefix }: Props) {
  // Re-render every 60s so the "5m ago" label stays current.
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const f = freshnessFromAsOf(asOf);
  const pill = freshnessPillClass(f.bucket);
  const dot = freshnessDotClass(f.bucket);

  const sizeClass =
    size === "sm"
      ? "text-[9px] px-1.5 py-px gap-1"
      : "text-[10px] px-2 py-0.5 gap-1.5";

  return (
    <span
      title={f.tooltip}
      className={`inline-flex items-center rounded-full border font-mono ${sizeClass} ${pill}`}
    >
      <span className={`w-1 h-1 rounded-full ${dot} ${f.bucket === "fresh" ? "animate-pulse" : ""}`} />
      {prefix && <span className="text-slate-500">{prefix}</span>}
      <span>{f.label}</span>
    </span>
  );
}
