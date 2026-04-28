/**
 * Server-aware weekly usage cap for the free tier.
 *
 * Free users get FREE_WEEKLY_CAP full canvas analyses per week (Mon–Sun IST).
 * Counts are tracked server-side in Supabase `weekly_usage`.
 * Call `consumeAnalysis(symbol)` before rendering the canvas — it will return
 * `allowed: false` when the cap is reached.
 *
 * Pure date helpers (`currentWeekStartIST`, `nextMondayISTString`, `msUntilWeekReset`)
 * are exported for tests and the CapGate countdown component.
 */

export const FREE_WEEKLY_CAP = 5;

// IST = UTC+5:30
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export interface UsageResult {
  allowed: boolean;
  remaining: number;
  resetAt: string; // "YYYY-MM-DD" — date of next Monday in IST
}

/**
 * Consume one analysis unit server-side.
 * Fails open: if the server is unreachable, returns `allowed: true` so the
 * user is never hard-blocked by a network error.
 */
export async function consumeAnalysis(symbol: string): Promise<UsageResult> {
  try {
    const res = await fetch("/api/consume-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<UsageResult>;
  } catch {
    // Fail open — network/server error must not block the user
    return { allowed: true, remaining: FREE_WEEKLY_CAP, resetAt: nextMondayISTString() };
  }
}

/**
 * "YYYY-MM-DD" of the Monday that started the current IST week.
 * Sunday counts as the last day of the previous week.
 */
export function currentWeekStartIST(): string {
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  const day = nowIST.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
  const daysToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(nowIST);
  monday.setUTCDate(nowIST.getUTCDate() - daysToMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().split("T")[0];
}

/**
 * "YYYY-MM-DD" of the next Monday in IST.
 * If today is Monday, the NEXT Monday is 7 days away (cap has already reset today).
 */
export function nextMondayISTString(): string {
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  const day = nowIST.getUTCDay(); // 0=Sun … 6=Sat
  // Sun→1, Mon→7, Tue→6, Wed→5, Thu→4, Fri→3, Sat→2
  const daysUntilNextMonday = day === 0 ? 1 : 8 - day;
  const next = new Date(nowIST);
  next.setUTCDate(nowIST.getUTCDate() + daysUntilNextMonday);
  next.setUTCHours(0, 0, 0, 0);
  return next.toISOString().split("T")[0];
}

/** Milliseconds until next Monday 00:00 IST. Used by the CapGate countdown. */
export function msUntilWeekReset(): number {
  const nowIST = Date.now() + IST_OFFSET_MS;
  const nextMondayIST = new Date(nextMondayISTString() + "T00:00:00Z").getTime();
  // `nextMondayISTString()` returns "YYYY-MM-DD" parsed as midnight UTC via
  // "T00:00:00Z". `nowIST` is Date.now() shifted forward by the IST offset.
  // Subtraction gives (Mon 00:00 UTC) − (now_UTC + 5.5 h)
  //   = ms until Monday 00:00 IST
  //   (midnight IST = 2026-05-04T00:00+05:30 = 2026-05-03T18:30Z, so
  //    Mon midnight IST arrives 5.5 h before Mon midnight UTC).
  return Math.max(0, nextMondayIST - nowIST);
}

/** Format ms as "Xd Yh Zm" for the countdown display. */
export function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
