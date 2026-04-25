/**
 * /embed/[symbol] — minimal embeddable signal card.
 * Designed for <iframe src="https://marketmithra.app/embed/RELIANCE" ...>.
 *
 * No nav, no layout chrome. Revalidates every 5 min.
 * Usage: <iframe src="https://marketmithra.app/embed/RELIANCE"
 *                width="320" height="220" frameborder="0"></iframe>
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchSnapshot } from "@/lib/api";
import { NIFTY50, fromSlug, toSlug } from "@/lib/nifty50";
import type { Verdict } from "@/lib/types";

export const revalidate = 300;

export function generateStaticParams() {
  return NIFTY50.map((s) => ({ symbol: toSlug(s.symbol) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol } = await params;
  const symClean = toSlug(fromSlug(symbol));
  return {
    title: `${symClean} Signal — MarketMithra`,
    robots: { index: false, follow: false },
  };
}

const VC: Record<Verdict, { bar: string; text: string }> = {
  BUY:  { bar: "#34d399", text: "#34d399" },
  HOLD: { bar: "#fbbf24", text: "#fbbf24" },
  SELL: { bar: "#fb7185", text: "#fb7185" },
};

const IND_LABELS: Record<string, string> = {
  rs: "RS",
  delivery: "Delivery",
  ema: "EMA",
  momentum: "Mom.",
  volume: "VWAP",
  aiNews: "AI News",
};

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const fullSym   = fromSlug(symbol);

  if (!NIFTY50.find((s) => s.symbol === fullSym)) notFound();

  const symClean = toSlug(fullSym);
  let snap = null;
  try { snap = await fetchSnapshot(fullSym); } catch { /* API down */ }

  const verdict = (snap?.fusion.verdict ?? "HOLD") as Verdict;
  const pct     = snap ? Math.round(snap.fusion.probability * 100) : 50;
  const vc      = VC[verdict];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0b10",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      padding: 12,
      fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
    }}>
      <div style={{
        borderRadius: 14,
        border: "1px solid rgba(100,116,139,0.25)",
        background: "#0d0f18",
        padding: "14px 16px",
        width: "100%",
        maxWidth: 320,
      }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>{symClean}</div>
            {snap && (
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{snap.name} · NSE</div>
            )}
          </div>
          {snap && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", fontFamily: "monospace" }}>
                ₹{snap.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                {new Date(snap.asOf).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </div>
            </div>
          )}
        </div>

        {/* verdict + probability bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 900, color: vc.text, letterSpacing: 2 }}>
            {verdict}
          </span>
          <div style={{ flex: 1, height: 6, borderRadius: 99, background: "#1e293b", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: vc.bar }} />
          </div>
          <span style={{ fontSize: 12, fontFamily: "monospace", color: "#94a3b8", minWidth: 32, textAlign: "right" }}>
            {pct}%
          </span>
        </div>

        {/* AI synthesis excerpt */}
        {snap?.fusion.synthesis?.verdict && (
          <div style={{
            fontSize: 11, color: "#cbd5e1", lineHeight: 1.5,
            marginBottom: 10, borderLeft: "2px solid #334155", paddingLeft: 8,
          }}>
            {snap.fusion.synthesis.verdict.slice(0, 140)}
            {snap.fusion.synthesis.verdict.length > 140 ? "…" : ""}
          </div>
        )}

        {/* indicator scores */}
        {snap && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", marginBottom: 10 }}>
            {Object.entries(snap.indicators).map(([key, ind]) => {
              const score = (ind as { score?: number }).score ?? 0;
              const color = score >= 0.25 ? "#34d399" : score <= -0.25 ? "#fb7185" : "#94a3b8";
              return (
                <span key={key} style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>
                  {IND_LABELS[key] ?? key}{" "}
                  <span style={{ color, fontWeight: 600 }}>
                    {score > 0 ? "+" : ""}{score.toFixed(2)}
                  </span>
                </span>
              );
            })}
          </div>
        )}

        {/* footer */}
        <div style={{ borderTop: "1px solid #1e293b", paddingTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, color: "#475569" }}>Educational · not advice</span>
          <a
            href={`https://marketmithra.app/signals/${symClean}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 10, color: "#f59e0b", textDecoration: "none" }}
          >
            marketmithra.app →
          </a>
        </div>
      </div>
    </div>
  );
}
