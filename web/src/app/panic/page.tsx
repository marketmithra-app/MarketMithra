import type { Metadata } from "next";
import MarketMithraHeader from "@/components/MarketMithraHeader";
import Footer from "@/components/Footer";
import PanicPage from "./PanicPage";

export const metadata: Metadata = {
  title: "Panic-O-Meter — MarketMithra",
  description:
    "India's composite market fear & greed index. Tracks VIX, breadth, delivery strength and momentum across Nifty 50.",
  openGraph: {
    title: "Panic-O-Meter — MarketMithra",
    description:
      "Real-time composite fear & greed index for Indian retail traders — fusing India VIX, market breadth, NSE delivery strength and momentum breadth.",
    url: "https://marketmithra.app/panic",
  },
};

export default function PanicOmeterPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-[#0a0b10] dark:text-slate-100">
      <MarketMithraHeader />

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="mb-10 text-center">
          <div className="inline-block rounded-full border border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 px-3 py-1 text-[11px] text-slate-600 dark:text-slate-300 font-mono mb-4">
            Nifty 50 · composite index · live
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">
            📡 Panic-O-Meter
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-[15px] leading-relaxed max-w-xl mx-auto">
            India&apos;s composite fear &amp; greed index &middot; updates every 30 minutes
          </p>
          <p className="mt-2 text-[12px] text-slate-500 dark:text-slate-500 max-w-2xl mx-auto">
            Fuses India VIX, market breadth, NSE delivery strength and momentum breadth
            into a single 0–100 score. Below 40 = greed. Above 60 = fear. Act accordingly.
          </p>
        </div>

        <PanicPage />
      </main>

      <Footer />
    </div>
  );
}
