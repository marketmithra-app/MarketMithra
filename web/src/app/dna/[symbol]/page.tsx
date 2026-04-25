import MarketMithraHeader from "@/components/MarketMithraHeader";
import Footer from "@/components/Footer";
import DNAFullPage from "./DNAFullPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  return {
    title: `${symbol.toUpperCase()} Stock DNA — MarketMithra`,
    description: `Behavioral fingerprint for ${symbol}: beta, seasonality, volatility profile, and personality type.`,
  };
}

export default async function DNAPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;

  // Attach .NS suffix if no dot in symbol (i.e., not already TCS.NS or TCS.BO)
  const symWithSuffix = symbol.includes(".") ? symbol.toUpperCase() : symbol.toUpperCase() + ".NS";
  const symClean      = symbol.toUpperCase();

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-[#0a0b10] dark:text-slate-100">
      <MarketMithraHeader
        ctaHref={`/signals/${symClean.toLowerCase()}`}
        ctaLabel={`${symClean} signal →`}
      />
      <main>
        <DNAFullPage symbol={symWithSuffix} name={symClean} />
      </main>
      <Footer />
    </div>
  );
}
