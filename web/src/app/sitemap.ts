import { MetadataRoute } from "next";
import { NIFTY50, toSlug } from "@/lib/nifty50";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://marketmithra.app";
  const now  = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base,                     lastModified: now, changeFrequency: "daily",   priority: 1.0 },
    { url: `${base}/canvas`,         lastModified: now, changeFrequency: "daily",   priority: 0.9 },
    { url: `${base}/track-record`,   lastModified: now, changeFrequency: "daily",   priority: 0.8 },
    { url: `${base}/signals`,        lastModified: now, changeFrequency: "daily",   priority: 0.8 },
    { url: `${base}/about`,          lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];

  // Signal pages — pre-rendered ISR pages with full SEO metadata.
  const signalRoutes: MetadataRoute.Sitemap = NIFTY50.map((s) => ({
    url:             `${base}/signals/${toSlug(s.symbol)}`,
    lastModified:    now,
    changeFrequency: "daily" as const,
    priority:        0.7,
  }));

  return [...staticRoutes, ...signalRoutes];
}
