import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/embed/", "/pro-success", "/admin"],
      },
    ],
    sitemap: "https://marketmithra.app/sitemap.xml",
  };
}
