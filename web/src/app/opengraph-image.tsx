import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "MarketMithra — visual stock signals for NSE";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a0b10 0%, #0d0f18 60%, #12100a 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* subtle grid lines */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.04,
          backgroundImage: "repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 60px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 60px)",
          display: "flex",
        }} />

        {/* logo mark */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16, marginBottom: 40,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: "linear-gradient(135deg, #fbbf24, #a855f7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, fontWeight: 900, color: "#0a0b10",
          }}>M</div>
          <div style={{
            fontSize: 36, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em",
          }}>MarketMithra</div>
        </div>

        {/* headline */}
        <div style={{
          fontSize: 60, fontWeight: 900, color: "#f1f5f9",
          letterSpacing: "-0.03em", textAlign: "center", lineHeight: 1.1,
          marginBottom: 20, maxWidth: 900,
        }}>
          Every signal, on{" "}
          <span style={{ color: "#fbbf24" }}>one canvas</span>.
        </div>

        {/* sub */}
        <div style={{
          fontSize: 24, color: "#94a3b8", textAlign: "center",
          maxWidth: 720, lineHeight: 1.5, marginBottom: 48,
        }}>
          Nifty 50 · RS · Delivery % · EMA · Momentum · VWAP · AI Sentiment
        </div>

        {/* verdict pills */}
        <div style={{ display: "flex", gap: 16 }}>
          {[
            { label: "BUY",  bg: "rgba(52,211,153,0.15)", border: "rgba(52,211,153,0.5)",  text: "#6ee7b7" },
            { label: "HOLD", bg: "rgba(251,191,36,0.15)",  border: "rgba(251,191,36,0.5)",  text: "#fde68a" },
            { label: "SELL", bg: "rgba(244,63,94,0.15)",   border: "rgba(244,63,94,0.5)",   text: "#fca5a5" },
          ].map(({ label, bg, border, text }) => (
            <div key={label} style={{
              padding: "10px 28px", borderRadius: 9999,
              background: bg, border: `2px solid ${border}`,
              fontSize: 22, fontWeight: 800, color: text, letterSpacing: "0.08em",
            }}>{label}</div>
          ))}
        </div>

        {/* bottom tag */}
        <div style={{
          position: "absolute", bottom: 32,
          fontSize: 14, color: "#475569", letterSpacing: "0.05em",
        }}>
          marketmithra.app · The edge you deserve
        </div>
      </div>
    ),
    { ...size }
  );
}
