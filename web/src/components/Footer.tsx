import Link from "next/link";

/**
 * Shared footer across every page.
 *
 * Finance products are judged partly by footer hygiene. A bare "© 2026"
 * strip reads as "maybe a scam" to cautious Indian retail users — they
 * actively look for disclaimer, methodology and contact links.
 */
export default function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 px-6 pt-10 pb-6">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div>
            <Link href="/" className="flex items-center mb-3">
              <img
                src="/icons/logo-horizontal.svg"
                alt="MarketMithra"
                className="h-8 w-auto"
              />
            </Link>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Transparent Nifty 50 signals for Indian retail traders.
              Built in India, for India.
            </p>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Explore
            </div>
            <ul className="space-y-2 text-[13px]">
              <li><Link href="/canvas" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition">Canvas</Link></li>
              <li><Link href="/signals" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition">Signals</Link></li>
              <li><Link href="/sectors" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition">Sectors</Link></li>
              <li><Link href="/track-record" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition">Track record</Link></li>
            </ul>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Company
            </div>
            <ul className="space-y-2 text-[13px]">
              <li><Link href="/about" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition">About</Link></li>
              <li><Link href="/about#methodology" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition">Methodology</Link></li>
              <li>
                <a
                  href="mailto:hello@marketmithra.app"
                  className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Legal
            </div>
            <ul className="space-y-2 text-[13px]">
              <li><Link href="/about#disclaimer" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition">Disclaimer</Link></li>
            </ul>
            <p className="mt-4 text-[11px] text-slate-500 leading-relaxed">
              Educational research tool. Not investment advice.
              Operator is not a SEBI-registered investment adviser.
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
          <div>MarketMithra © 2026 · Made in India</div>
          <div className="font-mono opacity-75">
            Data: NSE EOD via yfinance · AI: Claude claude-haiku-4-5
          </div>
        </div>
      </div>
    </footer>
  );
}
