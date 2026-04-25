const KEY   = "mm_recent_symbols_v1";
const LIMIT = 7;

export function addRecentSymbol(symbol: string): void {
  try {
    const prev = getRecentSymbols();
    // Dedup: remove existing entry, prepend new one
    const next = [symbol, ...prev.filter((s) => s !== symbol)].slice(0, LIMIT);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* quota or SSR */ }
}

export function getRecentSymbols(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}
