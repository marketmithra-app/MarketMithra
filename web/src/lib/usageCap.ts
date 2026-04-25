/**
 * Client-side daily usage cap for the free tier.
 *
 * Free users get FREE_DAILY_CAP full canvas analyses per day.
 * Counts are stored in localStorage keyed by date — no server, no auth required.
 * When the user upgrades to Pro, set "mm_pro": "1" in localStorage (or via
 * Supabase session) and isPro() will bypass the cap.
 */

export const FREE_DAILY_CAP = 5;

const USAGE_KEY = "mm_usage_v1";
const PRO_KEY   = "mm_pro";

interface UsageRecord {
  date: string;   // "YYYY-MM-DD" local time
  count: number;
}

function today(): string {
  return new Date().toLocaleDateString("en-CA"); // "YYYY-MM-DD" in local TZ
}

function readRecord(): UsageRecord {
  if (typeof window === "undefined") return { date: today(), count: 0 };
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return { date: today(), count: 0 };
    const rec: UsageRecord = JSON.parse(raw);
    // New calendar day → reset
    if (rec.date !== today()) return { date: today(), count: 0 };
    return rec;
  } catch {
    return { date: today(), count: 0 };
  }
}

function writeRecord(rec: UsageRecord) {
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(rec));
  } catch { /* storage full / private mode */ }
}

/** Has the user paid for Pro? (localStorage flag; will be Supabase session later.) */
export function isPro(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(PRO_KEY) === "1";
  } catch {
    return false;
  }
}

/** How many analyses the user has consumed today. */
export function getDailyCount(): number {
  return readRecord().count;
}

/** True when free-tier cap is reached AND user is not Pro. */
export function isAtCap(): boolean {
  if (isPro()) return false;
  return readRecord().count >= FREE_DAILY_CAP;
}

/**
 * Consume one analysis unit.
 * Returns the new count.  Pro users are counted too (for stats) but cap is not enforced.
 */
export function consumeOne(): number {
  const rec = readRecord();
  rec.count += 1;
  writeRecord(rec);
  return rec.count;
}

/**
 * Milliseconds until midnight local time (when the cap resets).
 * Used by the upgrade gate to show a countdown.
 */
export function msUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

/** Formatted "Xh Ym" string until cap reset. */
export function timeUntilReset(): string {
  const ms = msUntilMidnight();
  const h  = Math.floor(ms / 3_600_000);
  const m  = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Dev helper — call from browser console to simulate Pro. */
export function devSetPro(value: boolean) {
  if (value) localStorage.setItem(PRO_KEY, "1");
  else localStorage.removeItem(PRO_KEY);
}
