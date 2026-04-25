import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getWatchlist,
  getWatchlistCount,
  isWatched,
  toggleWatch,
  subscribeWatchlist,
  WATCHLIST_MAX,
  WATCHLIST_EVENT,
} from "@/lib/watchlist";

const KEY = "mm_watchlist_v1";

describe("watchlist", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getWatchlist returns empty array when storage is empty", () => {
    expect(getWatchlist()).toEqual([]);
    expect(getWatchlistCount()).toBe(0);
  });

  it("toggleWatch adds when symbol is absent", () => {
    const nowWatched = toggleWatch("RELIANCE.NS");
    expect(nowWatched).toBe(true);
    expect(getWatchlist()).toEqual(["RELIANCE.NS"]);
    expect(isWatched("RELIANCE.NS")).toBe(true);
  });

  it("toggleWatch removes when symbol is present", () => {
    toggleWatch("TCS.NS");
    const stillWatched = toggleWatch("TCS.NS");
    expect(stillWatched).toBe(false);
    expect(isWatched("TCS.NS")).toBe(false);
    expect(getWatchlist()).toEqual([]);
  });

  it("enforces 20-item cap by evicting the oldest (FIFO)", () => {
    for (let i = 0; i < WATCHLIST_MAX; i++) {
      toggleWatch(`SYM${i}.NS`);
    }
    expect(getWatchlistCount()).toBe(WATCHLIST_MAX);
    expect(getWatchlist()[0]).toBe("SYM0.NS");

    // 21st item: oldest (SYM0) should be evicted.
    toggleWatch("NEWEST.NS");
    const list = getWatchlist();
    expect(list.length).toBe(WATCHLIST_MAX);
    expect(list).not.toContain("SYM0.NS");
    expect(list[list.length - 1]).toBe("NEWEST.NS");
    expect(list[0]).toBe("SYM1.NS");
  });

  it("getWatchlistCount reflects current state after mutations", () => {
    expect(getWatchlistCount()).toBe(0);
    toggleWatch("A.NS");
    toggleWatch("B.NS");
    expect(getWatchlistCount()).toBe(2);
    toggleWatch("A.NS");
    expect(getWatchlistCount()).toBe(1);
  });

  it("isWatched reports membership accurately", () => {
    expect(isWatched("INFY.NS")).toBe(false);
    toggleWatch("INFY.NS");
    expect(isWatched("INFY.NS")).toBe(true);
    expect(isWatched("OTHER.NS")).toBe(false);
  });

  it("subscribeWatchlist fires callback on same-tab mutation", () => {
    const cb = vi.fn();
    const unsub = subscribeWatchlist(cb);
    toggleWatch("WIPRO.NS");
    expect(cb).toHaveBeenCalledTimes(1);
    toggleWatch("WIPRO.NS");
    expect(cb).toHaveBeenCalledTimes(2);
    unsub();
    toggleWatch("WIPRO.NS");
    expect(cb).toHaveBeenCalledTimes(2); // no more calls after unsub
  });

  it("subscribeWatchlist fires on cross-tab storage event for KEY", () => {
    const cb = vi.fn();
    const unsub = subscribeWatchlist(cb);
    // Simulate a `storage` event from another tab.
    const evt = new StorageEvent("storage", { key: KEY });
    window.dispatchEvent(evt);
    expect(cb).toHaveBeenCalledTimes(1);

    // Storage events with an unrelated key should be ignored.
    const other = new StorageEvent("storage", { key: "some_other_key" });
    window.dispatchEvent(other);
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
  });

  it("silently swallows localStorage quota-exceeded errors", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError", "QuotaExceededError");
    });
    // Should not throw.
    expect(() => toggleWatch("HDFCBANK.NS")).not.toThrow();
    setItemSpy.mockRestore();
  });

  it("returns [] when storage contains corrupted JSON", () => {
    localStorage.setItem(KEY, "{not valid json");
    expect(getWatchlist()).toEqual([]);
    expect(getWatchlistCount()).toBe(0);
    expect(isWatched("ANYTHING.NS")).toBe(false);
  });

  it("dispatches the mm:watchlist-change custom event on write", () => {
    const listener = vi.fn();
    window.addEventListener(WATCHLIST_EVENT, listener);
    toggleWatch("ITC.NS");
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(WATCHLIST_EVENT, listener);
  });
});
