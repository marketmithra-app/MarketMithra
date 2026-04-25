/**
 * Next.js App Router icon — served at /icon as PNG.
 * Dark background (#0a0b10) + amber "M" to match the favicon.svg
 * and the overall dark-first theme.
 */
import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 7,
          background: "#0a0b10",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* Amber M glyph */}
        <div
          style={{
            fontSize: 20,
            fontWeight: 900,
            color: "#f59e0b",
            fontFamily: "Arial Black, sans-serif",
            lineHeight: 1,
            marginTop: 2,
            display: "flex",
          }}
        >
          M
        </div>
        {/* Amber accent bar */}
        <div
          style={{
            position: "absolute",
            bottom: 4,
            width: 14,
            height: 2,
            borderRadius: 1,
            background: "#f59e0b",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
