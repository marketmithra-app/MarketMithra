/**
 * Dynamic per-stock OG image.
 * GET /api/og?symbol=TCS.NS
 *
 * Fetches live verdict + price from the FastAPI backend and renders a
 * 1200×630 card. Falls back to a generic branded image if the API is
 * unreachable (edge cold-start, local dev, etc.).
 */
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const SIZE = { width: 1200, height: 630 };

const VERDICT_STYLE = {
  BUY:  { badge: "#10b981", glow: "rgba(16,185,129,0.3)", label: "BUY" },
  HOLD: { badge: "#f59e0b", glow: "rgba(245,158,11,0.3)",  label: "HOLD" },
  SELL: { badge: "#f43f5e", glow: "rgba(244,63,94,0.3)",   label: "SELL" },
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const symbol   = (searchParams.get("symbol") ?? "RELIANCE.NS").toUpperCase();
  const symClean = symbol.replace(".NS", "").replace(".BO", "");

  // ── fetch live data ────────────────────────────────────────────────────────
  let name        = symClean;
  let verdict     = "HOLD" as "BUY" | "HOLD" | "SELL";
  let probability = 0.5;
  let price       = 0;
  let bull        = "";
  let bear        = "";

  try {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";
    const res = await fetch(
      `${apiBase}/snapshot/${encodeURIComponent(symbol)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const d = await res.json();
      name        = d.name        ?? symClean;
      verdict     = d.fusion?.verdict     ?? "HOLD";
      probability = d.fusion?.probability ?? 0.5;
      price       = d.price       ?? 0;
      bull        = d.fusion?.synthesis?.bull ?? "";
      bear        = d.fusion?.synthesis?.bear ?? "";
    }
  } catch {
    // API unreachable — use defaults; image still looks good
  }

  const pct   = Math.round(probability * 100);
  const vs    = VERDICT_STYLE[verdict] ?? VERDICT_STYLE.HOLD;
  const priceStr = price
    ? `₹${price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
    : "";

  // ── render ─────────────────────────────────────────────────────────────────
  // Cache for 15 min at the CDN edge — share previews don't need sub-minute freshness.
  const imgRes = new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%",
          background: "linear-gradient(135deg, #0a0b10 0%, #0d0f1a 60%, #100f0a 100%)",
          display: "flex", flexDirection: "column",
          fontFamily: "'Inter', sans-serif",
          padding: "56px 72px",
          position: "relative",
        }}
      >
        {/* ── subtle grid lines ── */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), " +
            "linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          display: "flex",
        }} />

        {/* ── verdict glow blob ── */}
        <div style={{
          position: "absolute", top: -80, right: -80,
          width: 400, height: 400, borderRadius: "50%",
          background: vs.glow,
          filter: "blur(100px)",
          display: "flex",
        }} />

        {/* ── top row: logo + branding ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "linear-gradient(135deg, #f59e0b, #a855f7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, fontWeight: 900, color: "#0a0b10",
          }}>M</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: "#e2e8f0", letterSpacing: "-0.5px" }}>
              MarketMithra
            </span>
            <span style={{ fontSize: 13, color: "#64748b", marginTop: 1 }}>
              NSE · AI-powered signals
            </span>
          </div>
        </div>

        {/* ── main content ── */}
        <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 20 }}>

          {/* stock identity */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <span style={{ fontSize: 72, fontWeight: 900, color: "#f1f5f9", letterSpacing: "-3px", lineHeight: 1 }}>
              {symClean}
            </span>
            {priceStr && (
              <span style={{ fontSize: 28, fontWeight: 600, color: "#94a3b8", fontFamily: "monospace" }}>
                {priceStr}
              </span>
            )}
          </div>

          <span style={{ fontSize: 22, color: "#94a3b8", marginTop: -8 }}>{name}</span>

          {/* verdict pill + probability bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 8 }}>
            <div style={{
              padding: "10px 28px", borderRadius: 40,
              border: `2px solid ${vs.badge}`,
              background: `${vs.badge}22`,
              color: vs.badge,
              fontSize: 28, fontWeight: 900, letterSpacing: 3,
              display: "flex",
            }}>
              {vs.label}
            </div>

            {/* probability bar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, color: "#64748b" }}>Fusion probability</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: vs.badge, fontFamily: "monospace" }}>
                  {pct}%
                </span>
              </div>
              <div style={{
                height: 10, borderRadius: 99,
                background: "rgba(255,255,255,0.08)",
                display: "flex", overflow: "hidden",
              }}>
                <div style={{
                  width: `${pct}%`, height: "100%",
                  background: vs.badge, borderRadius: 99,
                  display: "flex",
                }} />
              </div>
            </div>
          </div>

          {/* bull/bear one-liners */}
          {(bull || bear) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {bull && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>🐂</span>
                  <span style={{ fontSize: 17, color: "#6ee7b7", fontStyle: "italic" }}>
                    {bull.slice(0, 90)}{bull.length > 90 ? "…" : ""}
                  </span>
                </div>
              )}
              {bear && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>🐻</span>
                  <span style={{ fontSize: 17, color: "#fca5a5", fontStyle: "italic" }}>
                    {bear.slice(0, 90)}{bear.length > 90 ? "…" : ""}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── footer ── */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginTop: 32, paddingTop: 20,
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}>
          <span style={{ fontSize: 14, color: "#475569" }}>
            marketmithra.app · The edge you deserve · not investment advice
          </span>
          <span style={{ fontSize: 14, color: "#475569", fontFamily: "monospace" }}>
            6 signals · AI-fused
          </span>
        </div>
      </div>
    ),
    { ...SIZE }
  );
  imgRes.headers.set("Cache-Control", "public, max-age=900, stale-while-revalidate=1800");
  return imgRes;
}
