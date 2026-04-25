import type { Metadata } from "next";
import Link from "next/link";
import MarketMithraHeader from "@/components/MarketMithraHeader";
import RRGChart from "@/components/RRGChart";
import SectorHeatmap from "@/components/SectorHeatmap";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Sector Rotation (RRG) — MarketMithra",
  description:
    "Relative Rotation Graph for Nifty sectors — see which sectors are " +
    "leading, weakening, lagging or improving vs. Nifty 50 at a glance. " +
    "8-week rotation trails reveal money flow across the Indian market.",
  openGraph: {
    title: "Sector Rotation — MarketMithra",
    description:
      "Where is money rotating inside the Indian market? JdK-style RRG " +
      "for every Nifty sector, updated daily.",
    url: "https://marketmithra.app/sectors",
  },
};

export default function SectorsPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-[#0a0b10] dark:text-slate-100">
      <MarketMithraHeader />

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <div className="inline-block rounded-full border border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 px-3 py-1 text-[11px] text-slate-600 dark:text-slate-300 font-mono mb-4">
            Sector rotation · 8-week trail · vs. Nifty 50
          </div>
          <h1 className="text-3xl font-black mb-3">Where is money rotating today?</h1>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
            The Relative Rotation Graph (RRG) plots each Nifty sector by its
            relative strength against Nifty 50 and how that strength is
            changing. Healthy sectors rotate <em>clockwise</em> through the
            four quadrants — Improving → Leading → Weakening → Lagging — over
            weeks to months.
          </p>
        </div>

        <RRGChart />

        {/* Quadrant cheatsheet */}
        <section className="grid md:grid-cols-4 gap-3 mt-8">
          {[
            { name: "Leading",   bg: "bg-emerald-500/5", text: "text-emerald-600 dark:text-emerald-400", hint: "Strong + getting stronger. Momentum leaders." },
            { name: "Weakening", bg: "bg-amber-500/5",   text: "text-amber-600 dark:text-amber-400",     hint: "Still strong but losing steam. Watch for rotation out." },
            { name: "Lagging",   bg: "bg-rose-500/5",    text: "text-rose-600 dark:text-rose-400",       hint: "Weak + getting weaker. Avoid unless contrarian." },
            { name: "Improving", bg: "bg-sky-500/5",     text: "text-sky-600 dark:text-sky-400",         hint: "Weak but picking up. Early rotation candidates." },
          ].map((q) => (
            <div
              key={q.name}
              className={`rounded-xl border border-slate-200 dark:border-slate-800 ${q.bg} p-4`}
            >
              <div className={`text-xs font-bold ${q.text} uppercase tracking-wider mb-1`}>
                {q.name}
              </div>
              <div className="text-[12px] text-slate-600 dark:text-slate-400 leading-snug">
                {q.hint}
              </div>
            </div>
          ))}
        </section>

        {/* Secondary: sector breadth */}
        <section className="mt-10">
          <div className="mb-3">
            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Today&apos;s breadth · BUY share per sector
            </div>
            <h2 className="text-xl font-bold mt-1">Where the bulls are hiding today</h2>
          </div>
          <SectorHeatmap />
        </section>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c0e16] p-6 mt-10 text-center">
          <div className="text-sm font-bold mb-1">Found a sector you like?</div>
          <p className="text-[13px] text-slate-600 dark:text-slate-400 mb-4">
            Drill into the individual stock signals — all 6 indicators, live
            chart, voting and price targets per ticker.
          </p>
          <Link
            href="/signals"
            className="inline-block rounded-full bg-amber-400 px-6 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-300 transition"
          >
            Browse stock signals →
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
