/**
 * Data freshness helpers — convert an ISO timestamp into a human label
 * and a rough staleness bucket for styling.
 *
 * Indian markets close 15:30 IST on weekdays. Our /snapshot cache is
 * ~30 min, so anything within ~2h is "fresh", same-day is "today",
 * older is "stale" (likely weekend / holiday / API issue).
 */

export type FreshnessBucket = "fresh" | "today" | "stale" | "unknown";

export interface Freshness {
  bucket: FreshnessBucket;
  label: string;      // short label for the badge, e.g. "live", "2h ago", "yesterday"
  tooltip: string;    // longer description, e.g. "as of 17 Apr, 2:18 PM IST"
  ageMinutes: number; // minutes since asOf (NaN if unknown)
}

export function freshnessFromAsOf(asOf: string | null | undefined): Freshness {
  if (!asOf) {
    return {
      bucket: "unknown",
      label: "—",
      tooltip: "Freshness unknown",
      ageMinutes: NaN,
    };
  }
  const then = new Date(asOf).getTime();
  if (isNaN(then)) {
    return { bucket: "unknown", label: "—", tooltip: "Invalid timestamp", ageMinutes: NaN };
  }
  const now = Date.now();
  const ageMin = Math.max(0, Math.round((now - then) / 60_000));

  // Nice readable IST tooltip
  const tooltipDate = new Date(then).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
  const tooltip = `as of ${tooltipDate} IST`;

  let bucket: FreshnessBucket;
  let label: string;

  if (ageMin < 2) {
    bucket = "fresh";
    label = "live";
  } else if (ageMin < 60) {
    bucket = "fresh";
    label = `${ageMin}m ago`;
  } else if (ageMin < 60 * 4) {
    bucket = "fresh";
    label = `${Math.round(ageMin / 60)}h ago`;
  } else if (ageMin < 60 * 24) {
    bucket = "today";
    label = `${Math.round(ageMin / 60)}h ago`;
  } else if (ageMin < 60 * 24 * 2) {
    bucket = "stale";
    label = "yesterday";
  } else {
    bucket = "stale";
    label = `${Math.round(ageMin / (60 * 24))}d ago`;
  }

  return { bucket, label, tooltip, ageMinutes: ageMin };
}

/**
 * Tailwind class for a pill that reflects freshness. Kept in one place so
 * the badge looks consistent everywhere it shows up.
 */
export function freshnessPillClass(bucket: FreshnessBucket): string {
  switch (bucket) {
    case "fresh":
      return "text-emerald-400 border-emerald-500/30 bg-emerald-500/5";
    case "today":
      return "text-amber-400 border-amber-500/30 bg-amber-500/5";
    case "stale":
      return "text-rose-400 border-rose-500/30 bg-rose-500/5";
    case "unknown":
    default:
      return "text-slate-500 border-slate-700 bg-slate-800/30";
  }
}

export function freshnessDotClass(bucket: FreshnessBucket): string {
  switch (bucket) {
    case "fresh":
      return "bg-emerald-400";
    case "today":
      return "bg-amber-400";
    case "stale":
      return "bg-rose-400";
    case "unknown":
    default:
      return "bg-slate-500";
  }
}
