import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import LandingGateController from "@/components/gates/LandingGateController";
import WaitlistForm from "@/components/WaitlistForm";
import OpenAppButton from "@/components/OpenAppButton";
import PricingCTA from "@/components/PricingCTA";
import LandingTopPicks from "@/components/LandingTopPicks";
import MoversStrip from "@/components/MoversStrip";
import MarketStatusPill from "@/components/MarketStatusPill";
import SectorHeatmap from "@/components/SectorHeatmap";
import Footer from "@/components/Footer";
import WatchlistNavLink from "@/components/WatchlistNavLink";

export default function Landing() {

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "MarketMithra",
    "url": "https://marketmithra.app",
    "description": "Transparent BUY / HOLD / SELL signals for Nifty 50 stocks — fusing Relative Strength, NSE Delivery %, EMA stack, Momentum, VWAP and AI news sentiment.",
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web",
    "offers": [
      { "@type": "Offer", "price": "0", "priceCurrency": "INR", "name": "Free" },
      { "@type": "Offer", "price": "299", "priceCurrency": "INR", "name": "Pro Monthly" },
      { "@type": "Offer", "price": "2499", "priceCurrency": "INR", "name": "Pro Annual" },
    ],
    "author": { "@type": "Organization", "name": "MarketMithra", "url": "https://marketmithra.app" },
    "inLanguage": "en-IN",
    "audience": { "@type": "Audience", "audienceType": "Indian retail stock traders" },
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-[#0a0b10] dark:text-slate-100">
      <LandingGateController />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />

      {/* ── nav ── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            {/* Plain <img> for SVG — next/image doesn't optimise SVGs and can render them as 0px */}
            <img
              src="/icons/logo-horizontal.svg"
              alt="MarketMithra"
              className="h-10 w-auto"
            />
          </Link>
          <MarketStatusPill size="sm" />
        </div>
        <nav className="flex items-center gap-3 sm:gap-5 text-xs text-slate-600 dark:text-slate-400">
          <Link href="/sectors" className="hover:text-slate-900 dark:hover:text-slate-100 transition hidden sm:inline-flex items-center gap-1.5">
            Sectors
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-500/30">NEW</span>
          </Link>
          <Link href="/panic" className="hover:text-slate-900 dark:hover:text-slate-100 transition hidden sm:inline-flex items-center gap-1.5">
            Radar
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">NEW</span>
          </Link>
          <Link href="/signals" className="hover:text-slate-900 dark:hover:text-slate-100 transition hidden sm:inline">Rankings</Link>
          <WatchlistNavLink className="hidden sm:inline-flex" />
          <Link href="/track-record" className="hover:text-slate-900 dark:hover:text-slate-100 transition hidden sm:inline">Track record</Link>
          <Link href="/about" className="hover:text-slate-900 dark:hover:text-slate-100 transition hidden sm:inline">About</Link>
          <ThemeToggle />
          <OpenAppButton className="rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-slate-900 hover:bg-amber-300 transition" />
        </nav>
      </header>

      {/* ── hero ── */}
      <section className="px-6 pt-16 pb-12 max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

          {/* Left — copy */}
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-block rounded-full border border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 px-3 py-1 text-[11px] text-slate-600 dark:text-slate-300 font-mono mb-6">
              NSE · Nifty 50 · powered by Claude AI
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05] mb-4">
              The edge{" "}
              <span className="bg-gradient-to-r from-amber-500 to-fuchsia-600 dark:from-amber-400 dark:to-fuchsia-500 bg-clip-text text-transparent">
                you deserve.
              </span>
            </h1>
            <p className="text-xl md:text-2xl font-semibold text-slate-700 dark:text-slate-300 mb-5">
              One verdict. Six reasons. Zero guesswork.
            </p>
            <p className="text-base text-slate-600 dark:text-slate-400 mb-4 max-w-lg">
              Clear <strong className="text-slate-800 dark:text-slate-200">BUY, HOLD, or SELL</strong>{" "}
              on every Nifty 50 stock — with plain-English reasoning you can actually
              defend at the dinner table.
            </p>
            <p className="text-[13px] text-slate-500 mb-8 max-w-md">
              6 signals fused: RS, Delivery %, EMA stack, Momentum, VWAP, AI News. The market, translated.
            </p>
            <div className="flex items-center justify-center lg:justify-start gap-3 flex-wrap">
              <OpenAppButton className="rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-amber-300 transition" />
              <Link
                href="/track-record"
                className="rounded-full border border-slate-300 dark:border-slate-700 px-6 py-3 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
              >
                See the track record
              </Link>
            </div>
            <p className="mt-5 text-[11px] text-slate-500">
              Educational research tool · not investment advice · SEBI-compliant
            </p>
          </div>

          {/* Right — mock signal card */}
          <div className="w-full lg:w-[380px] shrink-0">
            <div className="relative rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-[#11131c] shadow-2xl shadow-slate-900/20 dark:shadow-black/40 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mb-0.5">NSE · RELIANCE</div>
                  <div className="text-base font-black text-slate-900 dark:text-slate-100">Reliance Industries</div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-sm font-black text-emerald-600 dark:text-emerald-400">
                  ▲ BUY
                </span>
              </div>
              {/* Probability */}
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider">Fusion probability</span>
                  <span className="text-2xl font-black text-slate-900 dark:text-slate-100">78%</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" />
                </div>
                <div className="flex justify-between mt-1.5 text-[9px] text-slate-400 font-mono">
                  <span>SELL 0%</span><span>HOLD 35–65%</span><span>BUY 100%</span>
                </div>
              </div>
              {/* Indicators */}
              <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">6 indicators</div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "RS",       score: "+0.72", color: "emerald" },
                    { label: "Delivery", score: "+0.65", color: "emerald" },
                    { label: "EMA",      score: "+0.80", color: "emerald" },
                    { label: "Momentum", score: "+0.41", color: "amber"   },
                    { label: "VWAP",     score: "+0.55", color: "emerald" },
                    { label: "AI News",  score: "+0.38", color: "amber"   },
                  ].map(({ label, score, color }) => (
                    <span key={label} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border
                      ${color === "emerald"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"}`}>
                      {label} <span className="font-mono">{score}</span>
                    </span>
                  ))}
                </div>
              </div>
              {/* AI synthesis */}
              <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">AI synthesis</div>
                <p className="text-[12px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Strong delivery ratio signals institutional accumulation. EMA stack bullish, VWAP holding as support. Watch for breakout above ₹1,340.
                </p>
              </div>
              {/* CTA */}
              <div className="px-5 py-3 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Live · updated 4 min ago</span>
                <Link href="/canvas/RELIANCE.NS" className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-500 transition">
                  Open canvas →
                </Link>
              </div>
              {/* Glow effect */}
              <div className="absolute -inset-px rounded-2xl border border-emerald-500/10 pointer-events-none" />
            </div>
            <p className="text-center text-[10px] text-slate-400 mt-3">Live example · all Nifty 50 stocks available</p>
          </div>

        </div>
      </section>

      {/* ── movers strip ── */}
      <MoversStrip context="landing" />

      {/* ── live rankings ── */}
      <section className="px-6 pb-16 max-w-5xl mx-auto">
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Today&apos;s top picks · live
            </div>
            <div className="text-xl font-bold mt-1">Ranked by fusion score</div>
          </div>
          <Link
            href="/signals"
            className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 transition"
          >
            See all 50 →
          </Link>
        </div>

        <LandingTopPicks />
      </section>

      {/* ── sector breadth ── */}
      <section className="px-6 pb-16 max-w-5xl mx-auto">
        <div className="mb-4">
          <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Market breadth · by sector
          </div>
          <div className="text-xl font-bold mt-1">Where the bulls are hiding today</div>
        </div>
        <SectorHeatmap />
      </section>

      {/* ── NEW: RRG promo banner ── */}
      <section className="px-6 pb-16 max-w-5xl mx-auto">
        <Link
          href="/sectors"
          className="group block relative overflow-hidden rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-50 via-white to-amber-50 dark:from-fuchsia-500/[0.06] dark:via-[#0c0e16] dark:to-amber-500/[0.05] p-6 md:p-8 hover:border-fuchsia-500/50 transition"
        >
          <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <div className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-500/30 mb-3">
                NEW
              </div>
              <h3 className="text-xl md:text-2xl font-black mb-2">
                Sector Rotation — see who&apos;s leading the Nifty
              </h3>
              <p className="text-[14px] text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl mb-4">
                All 11 NSE sectors on one Relative Rotation Graph. 4-week rotation
                trails show which sectors are <strong className="text-emerald-600 dark:text-emerald-400">leading</strong>,{" "}
                <strong className="text-sky-600 dark:text-sky-400">improving</strong>,{" "}
                <strong className="text-amber-600 dark:text-amber-400">weakening</strong>, or{" "}
                <strong className="text-rose-600 dark:text-rose-400">lagging</strong> the market.
              </p>
              <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-fuchsia-600 dark:text-fuchsia-400 group-hover:gap-2.5 transition-all">
                Open the rotation graph →
              </div>
            </div>
            {/* mini quadrant legend */}
            <div className="hidden md:grid grid-cols-2 gap-1.5 w-52">
              <div className="rounded-lg bg-sky-500/10 border border-sky-500/30 px-3 py-2">
                <div className="text-[11px] text-sky-600 dark:text-sky-400 font-bold">Improving</div>
                <div className="text-[10px] text-slate-500">↗ momentum</div>
              </div>
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2">
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">Leading</div>
                <div className="text-[10px] text-slate-500">full bull</div>
              </div>
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-2">
                <div className="text-[11px] text-rose-600 dark:text-rose-400 font-bold">Lagging</div>
                <div className="text-[10px] text-slate-500">full bear</div>
              </div>
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2">
                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">Weakening</div>
                <div className="text-[10px] text-slate-500">↘ rolling over</div>
              </div>
            </div>
          </div>
        </Link>
      </section>

      {/* ── feature strip ── */}
      <section className="px-6 pb-16 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: "🔬",
              title: "Transparent fusion",
              body: "Every verdict is a weighted sum of 6 signals. No black box — see each node's score, know exactly why.",
            },
            {
              icon: "🇮🇳",
              title: "India-first signals",
              body: "NSE Delivery % for accumulation/distribution. RS vs Nifty 500. INR, IST, SEBI-aware — not a US tool with a wrapper.",
            },
            {
              icon: "🤖",
              title: "AI explains the why",
              body: "Claude reads all 6 indicator scores together and writes a plain-English verdict. The first screener that actually talks to you.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-[#0c0e16] p-5"
            >
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="text-sm font-bold mb-2">{f.title}</div>
              <div className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {f.body}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── NEW: Panic-O-Meter promo ── */}
      <section className="px-6 pb-16 max-w-5xl mx-auto">
        <Link
          href="/panic"
          className="group block relative overflow-hidden rounded-2xl border border-rose-500/25 bg-gradient-to-br from-rose-50 via-white to-orange-50 dark:from-rose-500/[0.06] dark:via-[#0c0e16] dark:to-orange-500/[0.05] p-6 md:p-8 hover:border-rose-500/50 transition"
        >
          <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <div className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 mb-3">
                NEW
              </div>
              <h3 className="text-xl md:text-2xl font-black mb-2">
                Panic-O-Meter — feel the market&apos;s pulse
              </h3>
              <p className="text-[14px] text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl mb-4">
                India&apos;s composite fear &amp; greed index. Fuses{" "}
                <strong className="text-slate-700 dark:text-slate-300">India VIX</strong>,{" "}
                <strong className="text-slate-700 dark:text-slate-300">market breadth</strong>,{" "}
                <strong className="text-slate-700 dark:text-slate-300">NSE delivery strength</strong>{" "}
                and{" "}
                <strong className="text-slate-700 dark:text-slate-300">momentum breadth</strong>{" "}
                into a single 0–100 score. Know when the crowd is panicking before you follow them.
              </p>
              <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 dark:text-rose-400 group-hover:gap-2.5 transition-all">
                Check the fear level now →
              </div>
            </div>
            {/* Zone legend */}
            <div className="hidden md:flex flex-col gap-1.5 w-40">
              {[
                { label: "Extreme Panic", color: "text-rose-500", bg: "bg-rose-500/10 border-rose-500/30" },
                { label: "Fear",          color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/30" },
                { label: "Neutral",       color: "text-amber-500",  bg: "bg-amber-500/10 border-amber-500/30" },
                { label: "Greed",         color: "text-lime-500",   bg: "bg-lime-500/10 border-lime-500/30" },
                { label: "Extreme Greed", color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/30" },
              ].map((z) => (
                <div key={z.label} className={`rounded-lg border ${z.bg} px-3 py-1.5`}>
                  <div className={`text-[11px] font-bold ${z.color}`}>{z.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Link>
      </section>

      {/* ── pricing ── */}
      <section className="px-6 pb-16 max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Pricing</div>
          <h2 className="text-2xl font-black">
            Free to explore.{" "}
            <span className="bg-gradient-to-r from-amber-500 to-fuchsia-600 dark:from-amber-400 dark:to-fuchsia-500 bg-clip-text text-transparent">
              Pro to go deep.
            </span>
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {5} free analyses per day — no sign-up required.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {/* Free */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c0e16] p-6">
            <div className="text-sm font-bold mb-1">Free</div>
            <div className="text-3xl font-black mb-1">₹0</div>
            <div className="text-[11px] text-slate-500 mb-4">always</div>
            <ul className="space-y-2 text-[13px] text-slate-600 dark:text-slate-400">
              {["5 stocks / day", "BUY · HOLD · SELL verdict", "6-signal canvas", "AI news sentiment"].map(f => (
                <li key={f} className="flex gap-2"><span className="text-emerald-500">✓</span>{f}</li>
              ))}
              {["Unlimited stocks", "Price alerts", "Portfolio signals"].map(f => (
                <li key={f} className="flex gap-2 opacity-40"><span>—</span>{f}</li>
              ))}
            </ul>
          </div>

          {/* Monthly */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c0e16] p-6">
            <div className="text-sm font-bold mb-1">Pro Monthly</div>
            <div className="text-3xl font-black mb-1">₹299</div>
            <div className="text-[11px] text-slate-500 mb-4">per month</div>
            <ul className="space-y-2 text-[13px] text-slate-600 dark:text-slate-400">
              {["Unlimited stocks / day", "BUY · HOLD · SELL verdict", "6-signal canvas", "AI news + synthesis", "AI price targets", "Price change alerts (soon)"].map(f => (
                <li key={f} className="flex gap-2"><span className="text-emerald-500">✓</span>{f}</li>
              ))}
            </ul>
            <PricingCTA
              plan="monthly"
              label="Get Pro Monthly →"
              className="mt-5 block w-full rounded-full border border-amber-400 px-4 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-400/10 disabled:opacity-60 transition text-center"
            />
          </div>

          {/* Annual — highlighted */}
          <div className="rounded-xl border-2 border-amber-400/60 bg-gradient-to-b from-amber-50/60 to-white dark:from-amber-500/5 dark:to-[#0c0e16] p-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-3 py-0.5 text-[10px] font-bold text-slate-900">
              Best value
            </div>
            <div className="text-sm font-bold mb-1">Pro Annual</div>
            <div className="text-3xl font-black mb-1">₹2,499</div>
            <div className="text-[11px] text-slate-500 mb-4">per year · save 30%</div>
            <ul className="space-y-2 text-[13px] text-slate-600 dark:text-slate-400">
              {["Everything in Pro Monthly", "Priority support", "Early access to new signals", "Portfolio-level fusion (soon)"].map(f => (
                <li key={f} className="flex gap-2"><span className="text-emerald-500">✓</span>{f}</li>
              ))}
            </ul>
            <PricingCTA
              plan="annual"
              label="Get Pro Annual →"
              className="mt-5 block w-full rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-60 transition text-center"
            />
          </div>
        </div>
      </section>

      {/* ── waitlist ── */}
      <section id="waitlist" className="px-6 pb-20 max-w-5xl mx-auto">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-gradient-to-br from-slate-50 to-amber-50/30 dark:from-[#0d0f18] dark:to-[#12100a]/60 px-8 py-10 text-center">
          <div className="text-2xl mb-3">📬</div>
          <h2 className="text-2xl font-black mb-2">
            Get early access
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6">
            We&apos;re launching a Pro tier with unlimited stocks, price alerts and
            portfolio-level signals. Join the waitlist — no spam, one email when
            we&apos;re ready.
          </p>
          <WaitlistForm />
          <p className="mt-4 text-[11px] text-slate-500">
            No credit card · no spam · unsubscribe anytime
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
