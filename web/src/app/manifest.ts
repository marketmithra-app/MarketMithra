import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MarketMithra",
    short_name: "MarketMithra",
    description:
      "Transparent BUY / HOLD / SELL signals for Nifty 50 stocks — NSE Delivery %, EMA stack, AI sentiment and more.",
    start_url: "/canvas",
    display: "standalone",
    background_color: "#0a0b10",
    theme_color: "#f59e0b",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    categories: ["finance", "business"],
    lang: "en-IN",
  };
}
