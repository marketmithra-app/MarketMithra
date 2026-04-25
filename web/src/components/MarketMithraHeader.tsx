import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import MarketStatusPill from "@/components/MarketStatusPill";
import WatchlistNavLink from "@/components/WatchlistNavLink";

/**
 * Shared top nav for static pages (landing, track-record, about, signals).
 * Canvas uses TopBar instead (has search, auth, usage pill).
 */
export default function MarketMithraHeader({ ctaHref = "/canvas", ctaLabel = "Open canvas →" }: {
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800/80">
      <div className="flex items-center gap-2 sm:gap-3">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-400 to-fuchsia-500 grid place-items-center text-sm font-black text-slate-900">
            M
          </div>
          <div className="text-sm font-bold tracking-tight">MarketMithra</div>
        </Link>
        <MarketStatusPill size="sm" />
      </div>
      <nav className="flex items-center gap-3 sm:gap-5 text-xs text-slate-600 dark:text-slate-400">
        <Link href="/sectors" className="hover:text-slate-900 dark:hover:text-slate-100 transition hidden sm:inline-flex items-center gap-1.5">
          Sectors
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-500/30">NEW</span>
        </Link>
        <Link href="/panic" className="hover:text-slate-900 dark:hover:text-slate-100 transition hidden sm:inline-flex items-center gap-1.5">
          Panic-O-Meter
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">NEW</span>
        </Link>
        <Link href="/signals" className="hover:text-slate-900 dark:hover:text-slate-100 transition hidden sm:inline">
          Signals
        </Link>
        <WatchlistNavLink className="hidden sm:inline-flex" />
        <Link href="/track-record" className="hover:text-slate-900 dark:hover:text-slate-100 transition hidden sm:inline">
          Track record
        </Link>
        <Link href="/about" className="hover:text-slate-900 dark:hover:text-slate-100 transition hidden sm:inline">
          About
        </Link>
        <ThemeToggle />
        <Link
          href={ctaHref}
          className="rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-slate-900 hover:bg-amber-300 transition"
        >
          {ctaLabel}
        </Link>
      </nav>
    </header>
  );
}
