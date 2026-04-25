"use client";

import { useEffect, useState, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

type UsageData = {
  date: string;
  calls: number;
  daily_cap: number;
  cap_pct: number;
  input_tokens: number;
  output_tokens: number;
  usd: number;
  cost_per_call_avg: number;
  haiku_pricing: { input_per_1k_tokens: number; output_per_1k_tokens: number };
  tip: string;
};

type LogEntry = {
  id: number;
  session_id: string;
  timestamp: string;
  page_context: string;
  user_message: string;
  assistant_message: string;
  response_ms: number;
};

function StatCard({ label, value, sub, color = "slate" }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  const colours: Record<string, string> = {
    slate:   "bg-slate-800/40 border-slate-700/50",
    emerald: "bg-emerald-900/20 border-emerald-700/30",
    amber:   "bg-amber-900/20  border-amber-700/30",
    rose:    "bg-rose-900/20   border-rose-700/30",
  };
  return (
    <div className={`rounded-xl border p-4 ${colours[color] ?? colours.slate}`}>
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{label}</div>
      <div className="text-2xl font-black font-mono text-slate-100">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function AdminPage() {
  const [usage, setUsage]   = useState<UsageData | null>(null);
  const [logs, setLogs]     = useState<LogEntry[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [u, l] = await Promise.allSettled([
      fetch(`${API_BASE}/admin/usage`).then(r => r.json()),
      fetch(`${API_BASE}/agent/logs?limit=20`).then(r => r.json()),
    ]);
    if (u.status === "fulfilled") setUsage(u.value);
    if (l.status === "fulfilled") setLogs(Array.isArray(l.value) ? l.value : []);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  const capColor = !usage ? "slate"
    : usage.cap_pct >= 80 ? "rose"
    : usage.cap_pct >= 50 ? "amber"
    : "emerald";

  return (
    <div className="min-h-screen bg-[#080a12] text-slate-100 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black">Admin Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">MarketMithra · internal use only</p>
        </div>
        <div className="text-right">
          <button
            onClick={refresh}
            className="text-xs text-amber-400 hover:text-amber-300 transition border border-amber-400/30 rounded-lg px-3 py-1.5"
          >
            ↻ Refresh
          </button>
          {lastRefresh && (
            <p className="text-[10px] text-slate-600 mt-1">
              Updated {lastRefresh.toLocaleTimeString("en-IN")}
            </p>
          )}
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-pulse">
          {[0,1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-slate-800/40" />)}
        </div>
      )}

      {/* Usage stats */}
      {usage && (
        <section className="mb-8">
          <h2 className="text-xs uppercase tracking-widest text-slate-500 mb-3">
            Anthropic API · Claude Haiku · {usage.date}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <StatCard
              label="Calls today"
              value={`${usage.calls} / ${usage.daily_cap}`}
              sub={`${usage.cap_pct}% of daily cap`}
              color={capColor}
            />
            <StatCard
              label="Spend today"
              value={`$${usage.usd.toFixed(4)}`}
              sub={`~₹${(usage.usd * 84).toFixed(2)} INR`}
              color={capColor}
            />
            <StatCard
              label="Avg per call"
              value={`$${usage.cost_per_call_avg.toFixed(5)}`}
              sub="input + output blended"
            />
            <StatCard
              label="Tokens today"
              value={(usage.input_tokens + usage.output_tokens).toLocaleString()}
              sub={`${usage.input_tokens.toLocaleString()} in / ${usage.output_tokens.toLocaleString()} out`}
            />
          </div>

          {/* Cap bar */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex justify-between text-xs text-slate-500 mb-2">
              <span>Daily cap usage</span>
              <span className={usage.cap_pct >= 80 ? "text-rose-400" : usage.cap_pct >= 50 ? "text-amber-400" : "text-emerald-400"}>
                {usage.cap_pct}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  usage.cap_pct >= 80 ? "bg-rose-500" : usage.cap_pct >= 50 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(usage.cap_pct, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-600 mt-2">{usage.tip}</p>
          </div>

          {/* Pricing reference */}
          <div className="mt-3 flex gap-4 text-[11px] text-slate-600">
            <span>Haiku input: ${usage.haiku_pricing.input_per_1k_tokens}/1K tok</span>
            <span>·</span>
            <span>Haiku output: ${usage.haiku_pricing.output_per_1k_tokens}/1K tok</span>
            <span>·</span>
            <span>Cap: {usage.daily_cap} calls/day (set AI_NEWS_DAILY_CAP)</span>
          </div>
        </section>
      )}

      {/* Mithra chat logs */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-slate-500 mb-3">
          Mithra Agent · recent conversations
        </h2>

        {logs.length === 0 && !loading && (
          <div className="rounded-xl border border-slate-800 p-6 text-center text-sm text-slate-600">
            No conversations yet — chat logs appear here as users interact with Mithra.
          </div>
        )}

        {logs.length > 0 && (
          <div className="space-y-3">
            {logs.map(entry => (
              <div key={entry.id} className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="text-[10px] font-mono text-slate-600">
                    {new Date(entry.timestamp).toLocaleString("en-IN")}
                  </span>
                  {entry.page_context && (
                    <span className="text-[10px] bg-slate-800 text-slate-400 rounded px-1.5 py-0.5">
                      /{entry.page_context.replace(/^\//, "")}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-600 ml-auto">{entry.response_ms}ms</span>
                </div>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <span className="text-[10px] text-amber-400 font-bold w-6 shrink-0 pt-0.5">U</span>
                    <p className="text-sm text-slate-300">{entry.user_message}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[10px] text-fuchsia-400 font-bold w-6 shrink-0 pt-0.5">M</span>
                    <p className="text-sm text-slate-400 line-clamp-3">{entry.assistant_message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
