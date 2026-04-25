import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone", // Uncomment if containerising for Railway/Docker.
  //                        // Vercel doesn't need it — leave commented for now.

  async headers() {
    return [
      {
        // Security headers for all non-embed routes
        source: "/((?!embed/).*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options",        value: "DENY"    },
        ],
      },
      {
        // Embed widget pages must be iframeable from any origin.
        // CSP frame-ancestors takes precedence over X-Frame-Options in
        // modern browsers; both are set for maximum compatibility.
        source: "/embed/(.*)",
        headers: [
          { key: "X-Content-Type-Options",  value: "nosniff"           },
          { key: "Content-Security-Policy", value: "frame-ancestors *"  },
        ],
      },
    ];
  },
};

export default nextConfig;
