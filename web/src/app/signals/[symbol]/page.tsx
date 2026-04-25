import { notFound } from "next/navigation";
import Link from "next/link";
import MarketMithraHeader from "@/components/MarketMithraHeader";
import ShareButton from "@/components/ShareButton";
import ShareBar from "@/components/ShareBar";
import EmbedCode from "@/components/EmbedCode";
import VoteTally from "@/components/VoteTally";
import FreshnessBadge from "@/components/FreshnessBadge";
import Footer from "@/components/Footer";
import WatchlistStar from "@/components/WatchlistStar";
import VerdictTimeline from "@/components/VerdictTimeline";
import StockDNACard from "@/components/StockDNACard";
import { fetchSnapshot } from "@/lib/api";
import { NIFTY50, fromSlug, toSlug } from "@/lib/nifty50";
import type { StockSnapshot, Verdict } from "@/lib/types";

// Revalidate every 5 minutes — matches the canvas page cache TTL.
export const revalidate = 300;

// Pre-render all 50 Nifty stocks at build time.
export function generateStaticParams() {
  return NIFTY50.map((s) => ({ symbol: toSlug(s.symbol) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const fullSym  = fromSlug(symbol);
  const symClean = toSlug(fullSym);
  const entry    = NIFTY50.find((s) => s.symbol === fullSym);
  const name     = entry?.name ?? symClean;

  const title       = `${symClean} Stock Signal Today — BUY / HOLD / SELL · MarketMithra`;
  const description =
    `Is ${name} (${symClean}) a buy or sell today? Live NSE signal fusing ` +
    `Relative Strength, Delivery %, EMA stack, Momentum, VWAP and AI news into one verdict.`;
  const ogImageUrl  = `https://marketmithra.app/api/og?symbol=${encodeURIComponent(fullSym)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://marketmithra.app/signals/${symClean}`,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `${symClean} signal` }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImageUrl] },
  };
}

// ── colour helpers ────────────────────────────────────────────────────────────
const VC: Record<Verdict, { badge: string; bar: string; text: string; bg: string }> = {
  BUY:  { badge: "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/5" },
  HOLD: { badge: "border-amber-500/50  bg-amber-500/10  text-amber-700 dark:text-amber-300",       bar: "bg-amber-500",  text: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-500/5"  },
  SELL: { badge: "border-rose-500/50   bg-rose-500/10   text-rose-700 dark:text-rose-300",         bar: "bg-rose-500",   text: "text-rose-600 dark:text-rose-400",       bg: "bg-rose-500/5"   },
};

const IND_LABELS: Record<string, string> = {
  rs: "Relative Strength vs Nifty 500",
  delivery: "NSE Delivery %",
  ema: "EMA Stack (20 / 50 / 200)",
  momentum: "20-day Momentum",
  volume: "Volume vs VWAP",
  aiNews: "AI News Sentiment",
};

function scoreColor(score: number) {
  if (score >= 0.25) return "text-emerald-400";
  if (score <= -0.25) return "text-rose-400";
  return "text-slate-500";
}

// ── JSON-LD structured data ───────────────────────────────────────────────────
function SignalJsonLd({ snap }: { snap: StockSnapshot }) {
  const symClean = toSlug(snap.symbol);
  const pct      = Math.round(snap.fusion.probability * 100);
  const data = {
    "@context":    "https://schema.org",
    "@type":       "Article",
    "headline":    `${symClean} ${snap.fusion.verdict} Signal — ${pct}% Fusion Probability`,
    "description": snap.fusion.synthesis?.verdict ?? `${symClean} ${snap.fusion.verdict} based on 6 NSE indicators.`,
    "author":      { "@type": "Organization", "name": "MarketMithra" },
    "publisher":   { "@type": "Organization", "name": "MarketMithra", "url": "https://marketmithra.app" },
    "dateModified": snap.asOf,
    "mainEntityOfPage": `https://marketmithra.app/signals/${symClean}`,
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ── page ─────────────────────────────────────────────────────────────────────
export default async function SignalPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const fullSym = fromSlug(symbol);

  // Return 404 for anything outside the Nifty 50 (avoids scraping arbitrary tickers)
  if (!NIFTY50.find((s) => s.symbol === fullSym)) notFound();

  let snap: StockSnapshot | null = null;
  try {
    snap = await fetchSnapshot(fullSym);
  } catch {
    /* API down — page still renders with fallback */
  }

  const symClean = toSlug(fullSym);
  const name     = snap?.name ?? NIFTY50.find((s) => s.symbol === fullSym)?.name ?? symClean;

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-[#0a0b10] dark:text-slate-100">
      {snap && <SignalJsonLd snap={snap} />}

      <MarketMithraHeader
        ctaHref={`/canvas?symbol=${encodeURIComponent(fullSym)}`}
        ctaLabel={`Open ${symClean} canvas →`}
      />

      <main className="max-w-3xl mx-auto px-6 py-12">

        {/* breadcrumb */}
        <div className="text-[11px] text-slate-500 mb-6 flex items-center gap-1.5">
          <Link href="/" className="hover:text-amber-500 transition">Home</Link>
          <span>/</span>
          <Link href="/signals" className="hover:text-amber-500 transition">Signals</Link>
          <span>/</span>
          <span>{symClean}</span>
        </div>

        {/* heading */}
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">
          {name}{" "}
          <span className="text-slate-500 font-mono text-xl">({symClean})</span>
        </h1>
        <p className="text-sm text-slate-500 mb-8 flex items-center gap-2 flex-wrap">
          <span>NSE Nifty 50 · Live signal</span>
          {snap?.asOf && <FreshnessBadge asOf={snap.asOf} size="sm" />}
          <WatchlistStar symbol={fullSym} />
        </p>

        {snap ? (
          <>
            {/* ── verdict card ── */}
            {(() => {
              const v  = snap.fusion.verdict;
              const vc = VC[v];
              const pct = Math.round(snap.fusion.probability * 100);
              return (
                <div className={`rounded-2xl border ${vc.badge} p-6 mb-8`}>
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <div className="flex items-center gap-4">
                      <span className={`text-4xl font-black tracking-widest ${vc.text}`}>{v}</span>
                      <div>
                        <div className="text-2xl font-black font-mono text-slate-900 dark:text-slate-100">
                          ₹{snap.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Current price</div>
                      </div>
                      {/* inline price sparkline — last 30 candles */}
                      {snap.priceSeries.length > 5 && (() => {
                        const series = snap.priceSeries.slice(-30);
                        const min = Math.min(...series);
                        const max = Math.max(...series);
                        const range = max - min || 1;
                        const W = 80; const H = 32;
                        const step = W / (series.length - 1 || 1);
                        const pts = series.map((v, i) =>
                          `${(i * step).toFixed(1)},${(H - ((v - min) / range) * H).toFixed(1)}`
                        ).join(" ");
                        const area = `0,${H} ${pts} ${W},${H}`;
                        // pick colour from verdict
                        const sparkStroke = v === "BUY" ? "#34d399" : v === "SELL" ? "#f43f5e" : "#f59e0b";
                        const sparkFill   = v === "BUY" ? "rgba(52,211,153,0.15)" : v === "SELL" ? "rgba(244,63,94,0.15)" : "rgba(245,158,11,0.15)";
                        return (
                          <svg width={W} height={H} className="block opacity-80">
                            <polygon points={area} fill={sparkFill} />
                            <polyline points={pts} fill="none" stroke={sparkStroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
                          </svg>
                        );
                      })()}
                    </div>
                    <div className="text-right">
                      <div className={`text-3xl font-black font-mono ${vc.text}`}>{pct}%</div>
                      <div className="text-[11px] text-slate-500">Fusion probability</div>
                    </div>
                  </div>

                  {/* probability bar */}
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden mb-4">
                    <div className={`h-full rounded-full ${vc.bar}`} style={{ width: `${pct}%` }} />
                  </div>

                  {/* AI synthesis */}
                  {snap.fusion.synthesis?.verdict && (
                    <div className="flex gap-2 mt-2">
                      <span className="text-base mt-0.5 shrink-0">🤖</span>
                      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                        {snap.fusion.synthesis.verdict}
                      </p>
                    </div>
                  )}
                  {snap.fusion.synthesis?.bull && (
                    <div className="flex gap-2 mt-2">
                      <span className="shrink-0">🐂</span>
                      <p className="text-sm text-emerald-600 dark:text-emerald-400">{snap.fusion.synthesis.bull}</p>
                    </div>
                  )}
                  {snap.fusion.synthesis?.bear && (
                    <div className="flex gap-2 mt-2">
                      <span className="shrink-0">🐻</span>
                      <p className="text-sm text-rose-600 dark:text-rose-400">{snap.fusion.synthesis.bear}</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── share bar ── */}
            <ShareBar
              symbol={fullSym}
              name={snap.name}
              verdict={snap.fusion.verdict}
              probability={snap.fusion.probability}
              price={snap.price}
            />

            {/* ── community vote tally ── */}
            <VoteTally symbol={fullSym} />

            {/* ── verdict history timeline ── */}
            <VerdictTimeline symbol={fullSym} />

            {/* ── stock DNA card ── */}
            <StockDNACard symbol={fullSym} name={snap.name} />

            {/* ── price levels ── */}
            {snap.fusion.priceLevels && (
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <div className="text-[11px] text-slate-500 mb-1">
                    {snap.fusion.verdict === "SELL" ? "Downside target" : "Target"} · {snap.fusion.priceLevels.targetLabel}
                  </div>
                  <div className="text-xl font-black font-mono text-emerald-400">
                    ₹{snap.fusion.priceLevels.target.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
                  <div className="text-[11px] text-slate-500 mb-1">
                    {snap.fusion.verdict === "SELL" ? "Cut-loss" : "Stop"} · {snap.fusion.priceLevels.stopLabel}
                  </div>
                  <div className="text-xl font-black font-mono text-rose-400">
                    ₹{snap.fusion.priceLevels.stop.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            )}

            {/* ── indicator breakdown ── */}
            <h2 className="text-lg font-black mb-4">Signal breakdown</h2>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden mb-8">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#0c0e16] border-b border-slate-200 dark:border-slate-800">
                    <th className="text-left px-4 py-2.5 text-[11px] text-slate-500 font-semibold">Indicator</th>
                    <th className="text-right px-4 py-2.5 text-[11px] text-slate-500 font-semibold">Score</th>
                    <th className="text-left px-4 py-2.5 text-[11px] text-slate-500 font-semibold hidden sm:table-cell">Reading</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {Object.entries(snap.indicators).map(([key, ind]) => {
                    const score = (ind as { score?: number }).score ?? 0;
                    const label = (ind as { label?: string }).label ?? "";
                    return (
                      <tr key={key} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition">
                        <td className="px-4 py-3 text-[13px] font-medium text-slate-700 dark:text-slate-300">
                          {IND_LABELS[key] ?? key}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-semibold text-[13px] ${scoreColor(score)}`}>
                          {score > 0 ? "+" : ""}{score.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-slate-500 hidden sm:table-cell">{label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500 mb-8">
            Live signal temporarily unavailable. Open the canvas for the latest data.
          </div>
        )}

        {/* ── CTA ── */}
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-transparent p-8 text-center">
          <div className="text-2xl mb-3">📊</div>
          <h2 className="text-xl font-black mb-2">See the full interactive canvas</h2>
          <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
            6 signal nodes, live chart, AI synthesis, agree/disagree voting and price target —
            all in one visual view.
          </p>
          <Link
            href={`/canvas?symbol=${encodeURIComponent(fullSym)}`}
            className="inline-block rounded-full bg-amber-400 px-8 py-3 text-sm font-bold text-slate-900 hover:bg-amber-300 transition"
          >
            Open {symClean} canvas →
          </Link>
          <p className="mt-4 text-[11px] text-slate-600">
            Free · no sign-up · 5 analyses/day
          </p>
        </div>

        {/* ── embed ── */}
        <div className="mt-10 mb-12">
          <EmbedCode symbol={symClean} />
        </div>

        {/* ── other stocks ── */}
        <div className="mt-12">
          <h2 className="text-base font-bold mb-4 text-slate-600 dark:text-slate-400">
            More Nifty 50 signals
          </h2>
          <div className="flex flex-wrap gap-2">
            {NIFTY50.filter((s) => s.symbol !== fullSym).slice(0, 15).map((s) => (
              <Link
                key={s.symbol}
                href={`/signals/${toSlug(s.symbol)}`}
                className="text-[12px] font-mono rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1 hover:border-amber-400 hover:text-amber-500 transition text-slate-500"
              >
                {toSlug(s.symbol)}
              </Link>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
