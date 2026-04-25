/**
 * localStorage watchlist — starred tickers persist across page loads.
 * Key: "mm_watchlist_v1"  Value: JSON array of symbol strings, max 20.
 *
 * Symbols are stored in canonical ".NS" form (e.g. "RELIANCE.NS").
 *
 * Cross-tab / cross-component sync: every write dispatches a native
 * `storage` event (fires in OTHER tabs) plus a custom `mm:watchlist-change`
 * event (fires in THE SAME tab, which `storage` never does). Use
 * `subscribeWatchlist()` to listen for both.
 */

const KEY     = "mm_watchlist_v1";
const MAX     = 20;
export const WATCHLIST_EVENT = "mm:watchlist-change";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function write(list: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch { /* storage quota */ }
  // Notify same-tab listeners (the native `storage` event only fires in
  // OTHER tabs, not the one that triggered the change).
  try {
    window.dispatchEvent(new CustomEvent(WATCHLIST_EVENT));
  } catch {
    /* very old browsers */
  }
}

export function getWatchlist(): string[] {
  return read();
}

export function getWatchlistCount(): number {
  return read().length;
}

export const WATCHLIST_MAX = MAX;

export function isWatched(symbol: string): boolean {
  return read().includes(symbol);
}

export function toggleWatch(symbol: string): boolean {
  const list = read();
  const idx  = list.indexOf(symbol);
  if (idx === -1) {
    if (list.length >= MAX) list.shift(); // evict oldest if full
    list.push(symbol);
    write(list);
    return true;   // now watched
  } else {
    list.splice(idx, 1);
    write(list);
    return false;  // removed
  }
}

/**
 * Subscribe to watchlist changes — fires on both same-tab mutations and
 * cross-tab `storage` events. Returns an unsubscribe fn.
 */
export function subscribeWatchlist(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  const onCustom = () => cb();
  window.addEventListener("storage", onStorage);
  window.addEventListener(WATCHLIST_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(WATCHLIST_EVENT, onCustom);
  };
}
