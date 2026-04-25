import type { Metadata } from "next";
import Link from "next/link";
import MarketMithraHeader from "@/components/MarketMithraHeader";
import SignalsClientFilter from "@/components/SignalsClientFilter";
import Footer from "@/components/Footer";
import { NIFTY50, toSlug } from "@/lib/nifty50";

export const metadata: Metadata = {
  title: "Nifty 50 Stock Signals — MarketMithra",
  description:
    "Live BUY / HOLD / SELL signals for all 48 Nifty 50 stocks. " +
    "Powered by 6 indicators: RS vs Nifty 500, NSE Delivery %, EMA stack, " +
    "Momentum, VWAP and AI news sentiment. Updated daily.",
  openGraph: {
    title: "Nifty 50 Stock Signals — MarketMithra",
    description: "Live BUY / HOLD / SELL signals for all 48 Nifty 50 stocks.",
    url: "https://marketmithra.app/signals",
  },
};

// Sectors for display grouping
const SECTOR: Record<string, string> = {
  "RELIANCE.NS": "Energy",   "ONGC.NS": "Energy",    "BPCL.NS": "Energy",     "COALINDIA.NS": "Energy",
  "NTPC.NS": "Utilities",    "POWERGRID.NS": "Utilities",
  "TCS.NS": "IT",   "INFY.NS": "IT",    "HCLTECH.NS": "IT",   "WIPRO.NS": "IT",   "TECHM.NS": "IT",
  "HDFCBANK.NS": "Finance",  "ICICIBANK.NS": "Finance", "SBIN.NS": "Finance",  "AXISBANK.NS": "Finance",
  "KOTAKBANK.NS": "Finance", "BAJFINANCE.NS": "Finance","BAJAJFINSV.NS": "Finance","HDFCLIFE.NS": "Finance",
  "SBILIFE.NS": "Finance",   "SHRIRAMFIN.NS": "Finance","INDUSINDBK.NS": "Finance","IDFCFIRSTB.NS": "Finance",
  "HINDUNILVR.NS": "FMCG",  "ITC.NS": "FMCG",   "NESTLEIND.NS": "FMCG",  "BRITANNIA.NS": "FMCG",
  "TATACONSUM.NS": "FMCG",
  "MARUTI.NS": "Auto",  "BAJAJ-AUTO.NS": "Auto",  "EICHERMOT.NS": "Auto",  "HEROMOTOCO.NS": "Auto",
  "TMCV.NS": "Auto",
  "BHARTIARTL.NS": "Telecom",
  "SUNPHARMA.NS": "Pharma",  "CIPLA.NS": "Pharma",  "DRREDDY.NS": "Pharma",  "DIVISLAB.NS": "Pharma",
  "APOLLOHOSP.NS": "Healthcare",
  "LT.NS": "Infra",   "ADANIPORTS.NS": "Infra",  "GRASIM.NS": "Infra",  "ULTRACEMCO.NS": "Infra",
  "TATASTEEL.NS": "Metal",   "JSWSTEEL.NS": "Metal",
  "ASIANPAINT.NS": "Paints",
  "TITAN.NS": "Consumer",
  "M&M.NS": "Auto",
  "ADANIENT.NS": "Conglomerate",
};

export default function SignalsIndex() {
  const sectors = Array.from(new Set(Object.values(SECTOR))).sort();

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-[#0a0b10] dark:text-slate-100">
      <MarketMithraHeader />

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* heading */}
        <div className="mb-10">
          <div className="inline-block rounded-full border border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 px-3 py-1 text-[11px] text-slate-600 dark:text-slate-300 font-mono mb-4">
            NSE · 48 stocks · updated daily
          </div>
          <h1 className="text-3xl font-black mb-3">Nifty 50 Stock Signals</h1>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
            Live BUY / HOLD / SELL verdicts for every Nifty 50 constituent.
            Each signal fuses 6 indicators — RS vs Nifty 500, NSE Delivery %,
            EMA 20/50/200 stack, 20-day Momentum, Volume vs VWAP, and AI news
            sentiment — into one transparent probability score.
          </p>
        </div>

        {/* live filter by verdict */}
        <SignalsClientFilter />

        {/* sector grid — static links (SEO + always-available fallback) */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-8 mt-2 mb-6">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Browse by sector</h2>
          <p className="text-[12px] text-slate-500 mb-6">Static index — always available even without live data.</p>
        </div>
        {sectors.map((sector) => {
          const stocks = NIFTY50.filter((s) => SECTOR[s.symbol] === sector);
          if (!stocks.length) return null;
          return (
            <div key={sector} className="mb-8">
              <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                {sector}
              </h2>
              <div className="flex flex-wrap gap-2">
                {stocks.map((s) => {
                  const slug = toSlug(s.symbol);
                  return (
                    <Link
                      key={s.symbol}
                      href={`/signals/${slug}`}
                      className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c0e16] px-4 py-3 hover:border-amber-400/60 hover:bg-amber-500/5 transition group min-w-[140px]"
                    >
                      <span className="text-[13px] font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
                        {slug}
                      </span>
                      <span className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                        {s.name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* catch-all for stocks not in SECTOR map */}
        {(() => {
          const uncat = NIFTY50.filter((s) => !SECTOR[s.symbol]);
          if (!uncat.length) return null;
          return (
            <div className="mb-8">
              <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Other
              </h2>
              <div className="flex flex-wrap gap-2">
                {uncat.map((s) => {
                  const slug = toSlug(s.symbol);
                  return (
                    <Link
                      key={s.symbol}
                      href={`/signals/${slug}`}
                      className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c0e16] px-4 py-3 hover:border-amber-400/60 hover:bg-amber-500/5 transition group min-w-[140px]"
                    >
                      <span className="text-[13px] font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
                        {slug}
                      </span>
                      <span className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                        {s.name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c0e16] p-6 mt-4 text-center">
          <div className="text-sm font-bold mb-1">Want the full interactive canvas?</div>
          <p className="text-[13px] text-slate-600 dark:text-slate-400 mb-4">
            See all 6 signal nodes, live chart, agree/disagree voting and price target in one view.
          </p>
          <Link
            href="/canvas"
            className="inline-block rounded-full bg-amber-400 px-6 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-300 transition"
          >
            Open MarketMithra canvas →
          </Link>
          <p className="mt-3 text-[11px] text-slate-500">Free · no sign-up · 5 analyses/day</p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
