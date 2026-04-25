/**
 * Apple touch icon at 180×180.
 * Dark background + amber "M" + accent bar — matches favicon.svg design.
 */
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 36,
          background: "#0a0b10",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* Amber glow */}
        <div
          style={{
            position: "absolute",
            top: 20,
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "rgba(245,158,11,0.18)",
            filter: "blur(28px)",
            display: "flex",
          }}
        />
        {/* M lettermark */}
        <div
          style={{
            fontSize: 110,
            fontWeight: 900,
            color: "#f59e0b",
            fontFamily: "Arial Black, sans-serif",
            lineHeight: 1,
            marginTop: 6,
            display: "flex",
          }}
        >
          M
        </div>
        {/* Accent bar */}
        <div
          style={{
            position: "absolute",
            bottom: 22,
            width: 72,
            height: 8,
            borderRadius: 4,
            background: "#f59e0b",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
