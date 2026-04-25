import type { Metadata } from "next";
import Link from "next/link";
import MarketMithraHeader from "@/components/MarketMithraHeader";
import TrackRecordStats from "@/components/TrackRecordStats";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Track Record — MarketMithra Nifty 50 Signal History",
  description:
    "Every MarketMithra BUY / HOLD / SELL signal is timestamped and public. " +
    "See today's Nifty 50 signal distribution, top BUY picks, and the transparent fusion methodology.",
  openGraph: {
    title: "Track Record — MarketMithra",
    description: "Timestamped Nifty 50 signals — transparent, auditable, no post-hoc edits.",
    url: "https://marketmithra.app/track-record",
  },
};

const WEIGHTS = [
  { key: "rs",       label: "Relative Strength",    weight: "20%", desc: "IBD/Mansfield RS vs Nifty 500 — is the stock outperforming the market?" },
  { key: "delivery", label: "NSE Delivery %",        weight: "20%", desc: "Institutional accumulation signal unique to NSE — high delivery on rising price = conviction buying." },
  { key: "ema",      label: "EMA Stack 20/50/200",   weight: "18%", desc: "20 > 50 > 200 = full bull trend. Any inversion scores negatively." },
  { key: "momentum", label: "Momentum 20D",          weight: "17%", desc: "Raw 20-day price change. Strong momentum stocks tend to stay strong." },
  { key: "volume",   label: "Volume vs VWAP",        weight: "15%", desc: "Price above 20-day VWAP with rising volume = institutional sponsorship." },
  { key: "aiNews",   label: "AI News Sentiment",     weight: "10%", desc: "Claude claude-haiku-4-5 reads the 5 latest headlines and scores −1 to +1." },
];

export default function TrackRecord() {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-[#0a0b10] dark:text-slate-100">
      <MarketMithraHeader />

      <main className="max-w-3xl mx-auto px-6 py-12">

        {/* hero */}
        <div className="mb-10">
          <div className="inline-block rounded-full border border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 px-3 py-1 text-[11px] text-slate-600 dark:text-slate-300 font-mono mb-4">
            Transparent by design
          </div>
          <h1 className="text-3xl font-black mb-3">Track record</h1>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Every BUY / HOLD / SELL call is logged with a timestamp and fusion
            probability. Every user Agree / Disagree vote is stored. The model
            has no memory — it can&apos;t be optimised post-hoc. What you see is what
            was called, when it was called.
          </p>
        </div>

        {/* live stats — client component to avoid SSR timeout */}
        <TrackRecordStats />

        {/* methodology */}
        <div className="mb-10">
          <h2 className="text-lg font-black mb-2">How the fusion score works</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
            Each indicator scores from <strong>−1</strong> (fully bearish) to{" "}
            <strong>+1</strong> (fully bullish). Scores are weighted and summed
            into a single probability:{" "}
            <code className="text-amber-600 dark:text-amber-400 text-xs bg-amber-500/10 px-1.5 py-0.5 rounded">
              P = 0.5 + (weighted_sum / 2)
            </code>
            . P ≥ 0.60 →{" "}
            <span className="text-emerald-500 font-bold">BUY</span>, P ≤ 0.40 →{" "}
            <span className="text-rose-500 font-bold">SELL</span>, otherwise{" "}
            <span className="text-amber-500 font-bold">HOLD</span>.
          </p>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c0e16]">
                  <th className="text-left px-4 py-2.5 text-[11px] text-slate-500 font-semibold">Indicator</th>
                  <th className="text-right px-4 py-2.5 text-[11px] text-slate-500 font-semibold">Weight</th>
                  <th className="text-left px-4 py-2.5 text-[11px] text-slate-500 font-semibold hidden md:table-cell">Logic</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {WEIGHTS.map((w) => (
                  <tr key={w.key}>
                    <td className="px-4 py-3 font-semibold text-[13px]">{w.label}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-[12px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded">
                        {w.weight}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-500 leading-snug hidden md:table-cell">
                      {w.desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* community accuracy */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c0e16] p-6 mb-8">
          <h3 className="font-bold mb-2">Community accuracy stats</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Aggregate Agree / Disagree accuracy will appear here once enough
            votes have accumulated across multiple trading sessions. Every vote
            you cast on the canvas contributes to the public record.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <Link
              href="/canvas"
              className="rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-300 transition"
            >
              Cast your first vote →
            </Link>
            <span className="text-[11px] text-slate-500">No sign-in required</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 text-center">
          Educational research tool · not investment advice · past performance is
          not indicative of future results
        </div>
      </main>
      <Footer />
    </div>
  );
}
