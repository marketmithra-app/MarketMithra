import type { StockSnapshot, AnnouncementsResult } from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

// 8-second hard timeout — prevents the Next.js server from hanging
// indefinitely when the FastAPI backend is down.
function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

export async function fetchSnapshot(symbol: string): Promise<StockSnapshot> {
  const res = await fetch(
    `${API_BASE}/snapshot/${encodeURIComponent(symbol)}`,
    {
      next: { revalidate: 300 },
      signal: withTimeout(8000),
    }
  );
  if (!res.ok) {
    throw new Error(
      `fetchSnapshot(${symbol}) failed: ${res.status} ${res.statusText}`
    );
  }
  return res.json();
}

export async function fetchRanked(limit = 10): Promise<StockSnapshot[]> {
  const res = await fetch(`${API_BASE}/ranked?limit=${limit}`, {
    next: { revalidate: 300 },
    signal: withTimeout(15000), // ranked hits all 12 tickers — needs more time
  });
  if (!res.ok) {
    throw new Error(`fetchRanked failed: ${res.status}`);
  }
  return res.json();
}

export type RemoteTickerHit = {
  symbol: string;
  name: string;
  sector?: string;
};

/** Yahoo-backed search used as a fallback when the local bundle misses. */
export async function searchRemote(
  q: string,
  signal?: AbortSignal
): Promise<RemoteTickerHit[]> {
  if (!q || q.trim().length < 2) return [];
  try {
    const combined = signal
      ? AbortSignal.any([signal, withTimeout(5000)])
      : withTimeout(5000);
    const res = await fetch(
      `${API_BASE}/search?q=${encodeURIComponent(q)}&limit=8`,
      { signal: combined }
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function fetchAnnouncements(symbol: string): Promise<AnnouncementsResult> {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? "";
  try {
    const res = await fetch(`${base}/announcements/${encodeURIComponent(symbol)}`);
    if (!res.ok) return { symbol, announcements: [] };
    return res.json() as Promise<AnnouncementsResult>;
  } catch {
    return { symbol, announcements: [] };
  }
}
