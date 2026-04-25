/**
 * NSE market hours helper.
 *
 * NSE equities session: 09:15 – 15:30 IST, Monday–Friday.
 * We intentionally do not model public holidays here — keeps the client
 * dependency-free. A closed day shows "Closed" which is still accurate;
 * we just miss the distinction between "weekend" and "Republic Day".
 */

const IST_OFFSET_MINUTES = 5 * 60 + 30;
const OPEN_MIN = 9 * 60 + 15; // 09:15
const CLOSE_MIN = 15 * 60 + 30; // 15:30

export type MarketStatus =
  | { state: "open"; label: string; closesInMin: number }
  | { state: "pre"; label: string; opensInMin: number }
  | { state: "post"; label: string; nextOpenInMin: number }
  | { state: "closed"; label: string; nextOpenInMin: number };

/** Returns current IST day-of-week (0=Sun … 6=Sat) and minute-of-day. */
function nowIst(now: Date = new Date()): { dow: number; minOfDay: number } {
  // now.getTime() is UTC ms; shift by IST offset and read with getUTC*
  // so the result is independent of the host timezone.
  const istMs = now.getTime() + IST_OFFSET_MINUTES * 60_000;
  const ist = new Date(istMs);
  return {
    dow: ist.getUTCDay(),
    minOfDay: ist.getUTCHours() * 60 + ist.getUTCMinutes(),
  };
}

/** Minutes until the next Monday–Friday 09:15 IST. */
function minutesUntilNextOpen(dow: number, minOfDay: number): number {
  // Same day, before open
  if (dow >= 1 && dow <= 5 && minOfDay < OPEN_MIN) {
    return OPEN_MIN - minOfDay;
  }
  // Walk day-by-day until we hit a weekday
  let daysAhead = 1;
  let d = (dow + 1) % 7;
  while (!(d >= 1 && d <= 5)) {
    daysAhead += 1;
    d = (d + 1) % 7;
  }
  return daysAhead * 24 * 60 - minOfDay + OPEN_MIN;
}

function fmtDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m === 0 ? `${h}h` : `${h}h ${m}m`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh === 0 ? `${d}d` : `${d}d ${rh}h`;
}

export function marketStatus(now: Date = new Date()): MarketStatus {
  const { dow, minOfDay } = nowIst(now);
  const isWeekday = dow >= 1 && dow <= 5;

  if (isWeekday && minOfDay >= OPEN_MIN && minOfDay < CLOSE_MIN) {
    const closesIn = CLOSE_MIN - minOfDay;
    return {
      state: "open",
      label: `Closes in ${fmtDuration(closesIn)}`,
      closesInMin: closesIn,
    };
  }

  if (isWeekday && minOfDay < OPEN_MIN) {
    const opensIn = OPEN_MIN - minOfDay;
    return {
      state: "pre",
      label: `Opens in ${fmtDuration(opensIn)}`,
      opensInMin: opensIn,
    };
  }

  const nextOpen = minutesUntilNextOpen(dow, minOfDay);
  // Weekday after close → "post", weekend → "closed"
  if (isWeekday && minOfDay >= CLOSE_MIN) {
    return {
      state: "post",
      label: `Opens in ${fmtDuration(nextOpen)}`,
      nextOpenInMin: nextOpen,
    };
  }
  return {
    state: "closed",
    label: `Opens in ${fmtDuration(nextOpen)}`,
    nextOpenInMin: nextOpen,
  };
}
