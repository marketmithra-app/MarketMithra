"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import MarketStatusPill from "@/components/MarketStatusPill";
import { searchTickers, type TickerEntry } from "@/lib/tickers";
import { searchRemote, type RemoteTickerHit } from "@/lib/api";
import { getUser, signOut, type AuthUser } from "@/lib/auth";
import HeaderBadge from "@/components/HeaderBadge";
import SignInModal from "@/components/SignInModal";
import { getRecentSymbols } from "@/lib/recentSymbols";
import Link from "next/link";
import { getWatchlistCount, subscribeWatchlist } from "@/lib/watchlist";

const NAV_LINKS = [
  { href: "/signals",  label: "Rankings" },
  { href: "/canvas",   label: "Canvas"   },
  { href: "/watchlist",label: "Watchlist"},
  { href: "/sectors",  label: "Sectors"  },
  { href: "/panic",    label: "Radar"    },
];

export default function TopBar({ activeSymbol }: { activeSymbol: string }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [remote, setRemote] = useState<RemoteTickerHit[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const wrapRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [recents, setRecents] = useState<string[]>([]);

  // Load recent symbols from localStorage (client-side only)
  useEffect(() => {
    setRecents(getRecentSymbols());
  }, []);

  // ⌘K / Ctrl+K focuses the search input
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const localMatches: TickerEntry[] = q ? searchTickers(q, 8) : [];

  // Debounced remote search when the local hits look thin.
  useEffect(() => {
    if (!q || q.trim().length < 2) {
      setRemote([]);
      return;
    }
    const ctrl = new AbortController();
    const handle = setTimeout(async () => {
      setRemoteLoading(true);
      const hits = await searchRemote(q, ctrl.signal);
      setRemoteLoading(false);
      // Dedupe vs local matches.
      const localSyms = new Set(localMatches.map((m) => m.symbol));
      setRemote(hits.filter((h) => !localSyms.has(h.symbol)));
    }, 250);
    return () => {
      clearTimeout(handle);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const matches: TickerEntry[] = useMemo(() => {
    // Local first (curated, fast), then remote fills the gap.
    const merged: TickerEntry[] = [...localMatches];
    for (const r of remote) {
      if (merged.length >= 10) break;
      merged.push({ symbol: r.symbol, name: r.name, sector: r.sector });
    }
    return merged;
  }, [localMatches, remote]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function openSymbol(sym: string) {
    router.push(`/canvas/${encodeURIComponent(sym)}`);
    setOpen(false);
    setQ("");
  }

  function submit() {
    if (matches.length > 0) {
      openSymbol(matches[cursor]?.symbol ?? matches[0].symbol);
      return;
    }
    // Fallback: treat raw input as a ticker, add .NS if user didn't specify.
    const cleaned = q.trim().toUpperCase();
    if (!cleaned) return;
    const withSuffix =
      cleaned.includes(".") || cleaned.startsWith("^")
        ? cleaned
        : `${cleaned}.NS`;
    openSymbol(withSuffix);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <header className="relative z-30 flex items-center justify-between gap-3 px-3 md:px-5 py-3 border-b border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-[#0a0b10]/90 backdrop-blur-sm">
      <div className="flex items-center gap-2 shrink-0">
        {/* Full horizontal lockup PNG on sm+ screens */}
        {/* Plain <img> for SVGs — next/image silently fails on SVGs without dangerouslyAllowSVG */}
        <img
          src="/icons/logo-horizontal.svg"
          alt="MarketMithra"
          className="hidden sm:block h-10 w-auto"
        />
        {/* Icon-only mark on mobile */}
        <img
          src="/icons/icon-192.svg"
          alt="MarketMithra"
          className="sm:hidden h-9 w-9 rounded-lg shrink-0"
        />
        <div className="hidden md:block ml-1">
          <MarketStatusPill size="sm" />
        </div>
      </div>

      {/* ── nav links ── */}
      <nav className="hidden lg:flex items-center gap-1 shrink-0">
        {NAV_LINKS.map(({ href, label }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                active
                  ? "bg-amber-400/15 text-amber-600 dark:text-amber-400 border border-amber-400/30"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex-1 max-w-xl relative"
        ref={wrapRef}
      >
        <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-[#11131c] px-4 py-2">
          <span className="text-slate-500 text-sm">🔍</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              setCursor(0);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKey}
            placeholder={`Search ticker or name… (${activeSymbol.replace(".NS","").replace(".BO","")})`}
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 outline-none"
          />
          <kbd className="hidden lg:flex items-center gap-0.5 rounded border border-slate-300 dark:border-slate-600 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-mono text-slate-500 dark:text-slate-400 shrink-0 select-none">
            ⌘K
          </kbd>
          <button
            type="submit"
            className="rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-amber-300"
          >
            Open
          </button>
        </div>

        {/* Recent stocks — shown when focused with empty query */}
        {open && !q && recents.length > 0 && (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-[#11131c]">
            <div className="px-3 pt-2 pb-1 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              Recent
            </div>
            <ul>
              {recents.map((sym) => (
                <li key={sym}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => openSymbol(sym)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
                  >
                    <span className="text-[11px] text-slate-400">🕐</span>
                    <span className="text-[13px] font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {sym.replace(".NS", "").replace(".BO", "")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="px-3 py-1.5 text-[10px] text-slate-500 border-t border-slate-200 dark:border-slate-800">
              Type to search all Nifty 50 · esc close
            </div>
          </div>
        )}

        {open && matches.length > 0 && (
          <ul className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-[#11131c]">
            {matches.map((t, i) => (
              <li key={t.symbol}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => openSymbol(t.symbol)}
                  onMouseEnter={() => setCursor(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition ${
                    i === cursor
                      ? "bg-amber-100 dark:bg-slate-800"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {t.name}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      {t.symbol}
                      {t.sector ? ` · ${t.sector}` : ""}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">↵</div>
                </button>
              </li>
            ))}
            <li className="px-3 py-1.5 text-[10px] text-slate-500 border-t border-slate-200 dark:border-slate-800">
              ↑↓ navigate · ↵ open · esc close
            </li>
          </ul>
        )}
        {open && q && matches.length === 0 && (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-[#11131c] p-3 text-xs text-slate-500">
            {remoteLoading ? (
              <>Searching NSE listings…</>
            ) : (
              <>
                No match. Press Enter to try{" "}
                <code className="text-slate-700 dark:text-slate-300">
                  {q.toUpperCase()}.NS
                </code>{" "}
                anyway.
              </>
            )}
          </div>
        )}
      </form>

      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 shrink-0">
        <span className="hidden lg:inline">Educational tool · not advice</span>
        <ThemeToggle />
        <HeaderBadge />
        <WatchlistPill />
        <AuthButton />
      </div>
    </header>
  );
}

// ── auth button ──────────────────────────────────────────────────────────────
function AuthButton() {
  const [user, setUser] = useState<AuthUser | null | "loading">("loading");
  const [showModal, setShowModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  if (user === "loading") return null;

  if (!user) {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-full border border-slate-600 bg-slate-800/60 px-3 py-1 text-[11px] font-semibold text-slate-400 hover:border-slate-400 hover:text-slate-200 transition"
        >
          Sign in
        </button>
        {showModal && <SignInModal onClose={() => setShowModal(false)} />}
      </>
    );
  }

  // Signed-in user
  const initial = user.email[0].toUpperCase();
  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-800/60 pl-1.5 pr-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:border-slate-400 transition"
      >
        <span className="h-5 w-5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black grid place-items-center">
          {initial}
        </span>
        {user.isPro ? <span className="text-amber-400">⚡ Pro</span> : <span>Account</span>}
      </button>

      {showMenu && (
        <>
          {/* click-away */}
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[180px] rounded-xl border border-slate-700 bg-[#0d0f18] shadow-xl p-1">
            <div className="px-3 py-2 border-b border-slate-800 mb-1">
              <div className="text-[11px] text-slate-500">Signed in as</div>
              <div className="text-[12px] text-slate-200 font-mono truncate">{user.email}</div>
            </div>
            {!user.isPro && (
              <button
                onClick={() => { setShowMenu(false); window.location.href = "/canvas?upgrade=1"; }}
                className="w-full text-left px-3 py-2 text-[12px] text-amber-400 hover:bg-slate-800/60 rounded-lg transition"
              >
                ⚡ Upgrade to Pro
              </button>
            )}
            <button
              onClick={async () => { await signOut(); setUser(null); setShowMenu(false); }}
              className="w-full text-left px-3 py-2 text-[12px] text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 rounded-lg transition"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── watchlist pill ───────────────────────────────────────────────────────────
function WatchlistPill() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    // Client-side only; avoids SSR hydration mismatch.
    setCount(getWatchlistCount());
    return subscribeWatchlist(() => setCount(getWatchlistCount()));
  }, []);

  if (count === null) return null; // SSR / pre-hydration

  return (
    <Link
      href="/watchlist"
      title={count > 0 ? `${count} watched stock${count === 1 ? "" : "s"}` : "Watchlist"}
      className="flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-[#11131c] px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-amber-400/60 hover:text-amber-600 dark:hover:text-amber-400 transition"
    >
      <span className={count > 0 ? "text-amber-500" : "text-slate-400"}>★</span>
      {count > 0 && <span className="font-mono tabular-nums">{count}</span>}
    </Link>
  );
}

