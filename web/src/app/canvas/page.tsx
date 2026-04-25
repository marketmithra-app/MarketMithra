import RankedListLoader from "@/components/RankedListLoader";
import MobileRankingsDrawer from "@/components/MobileRankingsDrawer";
import TopBar from "@/components/TopBar";
import CanvasMain from "@/components/CanvasMain";
import ApiErrorState from "@/components/ApiErrorState";
import MobileSignalView from "@/components/MobileSignalView";
import { fetchSnapshot } from "@/lib/api";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ symbol?: string }> }) {
  const { symbol } = await searchParams;
  const rawSym = (symbol ?? "RELIANCE.NS").toUpperCase();
  const sym    = rawSym.replace(".NS", "").replace(".BO", "");

  const title       = `${sym} Signal — MarketMithra`;
  const description = `BUY / HOLD / SELL signal for ${sym} on NSE. Fusion of 6 indicators: RS, Delivery %, EMA stack, Momentum, VWAP, AI News.`;

  // Per-stock dynamic OG image — shows live verdict + probability bar.
  // Absolute URL required by Open Graph spec.
  const ogImageUrl =
    `https://marketmithra.app/api/og?symbol=${encodeURIComponent(rawSym)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://marketmithra.app/canvas?symbol=${encodeURIComponent(rawSym)}`,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `${sym} signal` }],
    },
    twitter: {
      card:        "summary_large_image",
      title,
      description,
      images:      [ogImageUrl],
    },
  };
}

export default async function CanvasPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string; upgrade?: string }>;
}) {
  const { symbol, upgrade } = await searchParams;
  const active = (symbol ?? "RELIANCE.NS").toUpperCase();
  const forceGate = upgrade === "1";

  let snapshot = null;
  try {
    snapshot = await fetchSnapshot(active);
  } catch {
    // snapshot stays null; ApiErrorState renders with retry button
  }

  return (
    <div className="flex flex-col h-screen bg-white text-slate-900 dark:bg-[#0a0b10] dark:text-slate-100">
      <TopBar activeSymbol={active} />
      <div className="flex flex-1 min-h-0">
        <RankedListLoader activeSymbol={active} />
        <main className="flex-1 min-h-0 relative flex flex-col">
          {/* Mobile: show signal card */}
          {snapshot && <div className="block md:hidden"><MobileSignalView snapshot={snapshot} /></div>}
          {/* Desktop: full canvas */}
          <div className="hidden md:flex flex-col flex-1 min-h-0">
            {snapshot ? <CanvasMain snapshot={snapshot} forceGate={forceGate} /> : <ApiErrorState symbol={active} />}
          </div>
          {/* Mobile no snapshot */}
          {!snapshot && <div className="block md:hidden"><ApiErrorState symbol={active} /></div>}
          <div className="absolute bottom-2 right-4 z-10 text-[10px] text-slate-500 pointer-events-none hidden md:block">
            Educational research tool · not investment advice · MarketMithra © 2026
          </div>
        </main>
      </div>
      <MobileRankingsDrawer activeSymbol={active} />
    </div>
  );
}

