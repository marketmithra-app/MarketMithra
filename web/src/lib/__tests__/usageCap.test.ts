import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { currentWeekStartIST, nextMondayISTString, msUntilWeekReset } from "@/lib/usageCap";

describe("currentWeekStartIST", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns the Monday of the current IST week when today is Wednesday", () => {
    // 2026-04-29 is a Wednesday in IST
    vi.setSystemTime(new Date("2026-04-29T10:00:00+05:30"));
    expect(currentWeekStartIST()).toBe("2026-04-27"); // Monday
  });

  it("returns today when today is Monday", () => {
    vi.setSystemTime(new Date("2026-04-27T00:30:00+05:30")); // Monday morning IST
    expect(currentWeekStartIST()).toBe("2026-04-27");
  });

  it("returns previous Monday when today is Sunday", () => {
    vi.setSystemTime(new Date("2026-05-03T23:00:00+05:30")); // Sunday evening IST
    expect(currentWeekStartIST()).toBe("2026-04-27");
  });
});

describe("nextMondayISTString", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns next Monday date string from a Wednesday", () => {
    vi.setSystemTime(new Date("2026-04-29T10:00:00+05:30")); // Wednesday
    expect(nextMondayISTString()).toBe("2026-05-04");
  });

  it("returns next Monday (7 days later) when today is Monday", () => {
    vi.setSystemTime(new Date("2026-04-27T10:00:00+05:30")); // Monday
    expect(nextMondayISTString()).toBe("2026-05-04");
  });

  it("returns tomorrow when today is Sunday", () => {
    vi.setSystemTime(new Date("2026-05-03T23:59:59+05:30")); // Sunday
    expect(nextMondayISTString()).toBe("2026-05-04");
  });
});

describe("msUntilWeekReset", () => {
  afterEach(() => vi.useRealTimers());

  it("returns positive ms when reset is in the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T10:00:00+05:30")); // Wednesday
    expect(msUntilWeekReset()).toBeGreaterThan(0);
  });

  it("returns roughly 5 days of ms on a Wednesday morning IST", () => {
    // Wednesday 10:00 IST → Monday 00:00 IST = ~4d14h = ~393600000ms
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T10:00:00+05:30"));
    const ms = msUntilWeekReset();
    // 4 days + 14 hours = (4*24 + 14) * 3600 * 1000 = 396000ms ... ~393600000ms
    const fourDays = 4 * 24 * 60 * 60 * 1000;
    const fiveDays = 5 * 24 * 60 * 60 * 1000;
    expect(ms).toBeGreaterThan(fourDays);
    expect(ms).toBeLessThan(fiveDays);
  });
});
