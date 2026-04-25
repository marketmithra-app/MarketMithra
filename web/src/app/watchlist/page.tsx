import type { Metadata } from "next";
import MarketMithraHeader from "@/components/MarketMithraHeader";
import Footer from "@/components/Footer";
import WatchlistClient from "./WatchlistClient";

export const metadata: Metadata = {
  title: "Your Watchlist — MarketMithra",
  description:
    "Track your favourite Nifty 50 stocks. Live BUY / HOLD / SELL verdicts, " +
    "fusion probability, and one-tap removal. Stored on your device — no sign-up required.",
  openGraph: {
    title: "Your Watchlist — MarketMithra",
    description: "Track your favourite Nifty 50 stocks with live signals.",
    url: "https://marketmithra.app/watchlist",
  },
  // Watchlist is per-device (localStorage) — search engines shouldn't index.
  robots: { index: false, follow: true },
};

export default function WatchlistPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-[#0a0b10] dark:text-slate-100">
      <MarketMithraHeader />

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <div className="inline-block rounded-full border border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 px-3 py-1 text-[11px] text-slate-600 dark:text-slate-300 font-mono mb-4">
            Your device · No sign-up required
          </div>
          <h1 className="text-3xl font-black mb-3">Your Watchlist</h1>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
            Stocks you&apos;ve starred, with today&apos;s verdict and fusion
            probability. Sorted most-bullish first. Watchlist is stored on this
            device — soon you&apos;ll be able to opt in to a daily email digest.
          </p>
        </div>

        <WatchlistClient />
      </main>

      <Footer />
    </div>
  );
}
