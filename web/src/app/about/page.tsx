import type { Metadata } from "next";
import Link from "next/link";
import MarketMithraHeader from "@/components/MarketMithraHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "About MarketMithra — Transparent NSE Stock Signals",
  description:
    "MarketMithra is an educational research tool for Indian retail traders. " +
    "Learn how we fuse 6 NSE-specific indicators into one transparent BUY/HOLD/SELL verdict.",
  openGraph: {
    title: "About MarketMithra",
    description: "How 6 NSE indicators become one honest verdict.",
    url: "https://marketmithra.app/about",
  },
};

const INDICATORS = [
  {
    name: "Relative Strength vs Nifty 500",
    weight: "20%",
    icon: "📈",
    body:
      "IBD-style RS compares the stock's performance to the broader Nifty 500 index over 1 year and 3 months, blended 60/40. A stock must outperform the market to score above 0. Stocks in the bottom 50 of RS typically underperform even in bull markets — this filter alone eliminates most noise trades.",
  },
  {
    name: "NSE Delivery %",
    weight: "20%",
    icon: "📦",
    body:
      "The fraction of traded shares that went to actual delivery (not intraday). High delivery on a rising price day = institutional conviction. Low delivery on a price spike = retail speculation. This signal is unique to Indian markets and is available from BSE Bhav Copy data.",
  },
  {
    name: "EMA Stack 20 / 50 / 200",
    weight: "18%",
    icon: "📊",
    body:
      "The classic trend-following triple. 20 > 50 > 200 = full bull stack, scores +1. Any inversion scores −1. Mixed (e.g., 20 > 50 but below 200) scores 0. This is deliberate: trend ambiguity = no edge, no opinion.",
  },
  {
    name: "20-Day Momentum",
    weight: "17%",
    icon: "⚡",
    body:
      "Raw price change over 20 trading days, clamped to [−10%, +10%] and normalised to [−1, +1]. Momentum strategies have one of the longest evidence trails in academic finance. We don't overcomplicate it — price change is the cleanest read of what the crowd has decided.",
  },
  {
    name: "Volume vs Rolling VWAP",
    weight: "15%",
    icon: "🔊",
    body:
      "Price above a 20-day rolling VWAP with rising volume is the classic institutional-sponsorship signature. Volume surge alone (without price confirmation) can mean distribution; price above VWAP alone (without volume) may not sustain. The combined score captures both.",
  },
  {
    name: "AI News Sentiment",
    weight: "10%",
    icon: "🤖",
    body:
      "Claude claude-haiku-4-5 reads the 5 most recent news headlines for the stock and scores them from −1 (very bearish) to +1 (very bullish). It is deliberately underweighted at 10% — news sentiment is noisy and easily gamed. The model is given the current price, the other indicator scores, and told to be sceptical of hype.",
  },
];

export default function About() {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-[#0a0b10] dark:text-slate-100">
      <MarketMithraHeader />

      <main className="max-w-2xl mx-auto px-6 py-16">

        {/* hero */}
        <h1 className="text-3xl font-black mb-4">About MarketMithra</h1>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-10">
          MarketMithra is a transparent, educational signal dashboard for Indian
          retail traders. We take six indicators that have a track record on the
          NSE and fuse them into one honest verdict — no black box, no hidden
          algo, no paid promotions. Every weight is published. Every vote you
          cast becomes part of the public record.
        </p>

        {/* why we built it */}
        <section className="mb-12">
          <h2 className="text-xl font-black mb-3">Why we built it</h2>
          <div className="space-y-4 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
            <p>
              Most stock screeners available to Indian retail investors either
              give you a raw data dump (overwhelming) or a black-box BUY signal
              from a backtest nobody audited (useless). Neither helps you think.
            </p>
            <p>
              We wanted a tool that shows its work. Not just{" "}
              <em>&ldquo;RELIANCE is a BUY&rdquo;</em> — but{" "}
              <em>
                &ldquo;RS is bullish (+0.8), delivery is rising (+0.6), EMA stack is
                mixed (0.0), momentum is weak (−0.1) — so there&apos;s a 63%
                fusion probability on the BUY side. Here&apos;s what Claude
                thinks about the news. Now you decide.&rdquo;
              </em>
            </p>
            <p>
              The Agree / Disagree buttons are not vanity — every vote is
              logged with the verdict and date, so we can eventually show you
              whether the community was right.
            </p>
          </div>
        </section>

        {/* indicator methodology */}
        <section id="methodology" className="mb-12 scroll-mt-24">
          <h2 className="text-xl font-black mb-2">The six signals</h2>
          <p className="text-sm text-slate-500 mb-6">
            Weights sum to 100%. Each indicator scores from −1 (fully bearish)
            to +1 (fully bullish). The fusion probability is{" "}
            <code className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
              P = 0.5 + (weighted_sum / 2)
            </code>
            . P ≥ 0.60 → BUY; P ≤ 0.40 → SELL; otherwise HOLD.
          </p>

          <div className="space-y-5">
            {INDICATORS.map((ind) => (
              <div
                key={ind.name}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{ind.icon}</span>
                    <span className="font-bold text-[14px]">{ind.name}</span>
                  </div>
                  <span className="shrink-0 text-[11px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded">
                    {ind.weight}
                  </span>
                </div>
                <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  {ind.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* data sources */}
        <section className="mb-12">
          <h2 className="text-xl font-black mb-3">Data sources</h2>
          <ul className="space-y-2 text-[14px] text-slate-600 dark:text-slate-400">
            <li className="flex gap-2"><span className="text-slate-400">→</span><span><strong className="text-slate-900 dark:text-slate-100">Price &amp; volume history</strong> — Yahoo Finance (yfinance) via NSE (.NS tickers)</span></li>
            <li className="flex gap-2"><span className="text-slate-400">→</span><span><strong className="text-slate-900 dark:text-slate-100">Delivery %</strong> — BSE Bhavcopy daily CSVs (official exchange data)</span></li>
            <li className="flex gap-2"><span className="text-slate-400">→</span><span><strong className="text-slate-900 dark:text-slate-100">News sentiment</strong> — Yahoo Finance news headlines, scored by Anthropic Claude claude-haiku-4-5</span></li>
            <li className="flex gap-2"><span className="text-slate-400">→</span><span><strong className="text-slate-900 dark:text-slate-100">AI synthesis</strong> — Anthropic Claude claude-haiku-4-5 with all 6 indicator scores as context</span></li>
          </ul>
          <p className="mt-4 text-[12px] text-slate-500">
            Data is cached for 30 minutes. All prices are in INR. Past-date
            data is end-of-day; intraday updates depend on yfinance availability.
          </p>
        </section>

        {/* disclaimer */}
        <section id="disclaimer" className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c0e16] p-6 mb-10 scroll-mt-24">
          <h2 className="text-base font-bold mb-2">Disclaimer</h2>
          <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed">
            MarketMithra is an <strong>educational research tool</strong>. It is
            not investment advice, a recommendation, or a solicitation to buy or
            sell any security. The operator is not a SEBI-registered investment
            adviser or research analyst. Do your own due diligence, consult a
            SEBI-registered professional before making investment decisions, and
            understand that past performance does not guarantee future results.
            Markets are volatile — you can lose money.
          </p>
        </section>

        <div className="flex items-center gap-4 flex-wrap">
          <Link
            href="/canvas"
            className="rounded-full bg-amber-400 px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300 transition"
          >
            Open the canvas →
          </Link>
          <Link
            href="/track-record"
            className="text-sm text-slate-500 hover:text-amber-500 transition"
          >
            See the track record
          </Link>
        </div>

        <div className="mt-10 text-[12px] text-slate-500">
          Questions? Feedback? Write to{" "}
          <a
            href="mailto:hello@marketmithra.app"
            className="text-amber-600 dark:text-amber-400 underline"
          >
            hello@marketmithra.app
          </a>
        </div>
      </main>
      <Footer />
    </div>
  );
}
