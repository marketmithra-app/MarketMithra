import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import MithraAgent from "@/components/MithraAgent";
import MithraPopAgent from "@/components/MithraPopAgent";
import PageProgress from "@/components/PageProgress";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://marketmithra.app"),
  title: "MarketMithra — The Edge You Deserve",
  description:
    "The edge you deserve. BUY/HOLD/SELL signals for every Nifty 50 stock — one verdict, six reasons, zero guesswork. Powered by Claude AI. The market, translated.",
  keywords: [
    "NSE",
    "Nifty 50",
    "stock signals",
    "BUY HOLD SELL",
    "Indian stocks",
    "technical analysis",
    "delivery percentage",
    "EMA",
    "relative strength",
    "SEBI",
    "market signals",
    "stock analysis India",
  ],
  authors: [{ name: "MarketMithra" }],
  openGraph: {
    title: "MarketMithra — The Edge You Deserve",
    description:
      "The edge you deserve. BUY/HOLD/SELL signals for every Nifty 50 stock — one verdict, six reasons, zero guesswork. Powered by Claude AI.",
    url: "https://marketmithra.app",
    siteName: "MarketMithra",
    type: "website",
    locale: "en_IN",
    // opengraph-image.tsx in app/ generates this automatically
  },
  twitter: {
    card: "summary_large_image",
    title: "MarketMithra — The Edge You Deserve",
    description:
      "The edge you deserve. BUY/HOLD/SELL signals for every Nifty 50 stock — one verdict, six reasons, zero guesswork. Powered by Claude AI.",
  },
  robots: { index: true, follow: true },
  icons: {
    // SVG hint — sharp at any resolution for modern browsers
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    // apple-icon.tsx in this directory auto-generates /apple-icon (180×180 PNG)
  },
};

// Runs before React hydrates — reads the saved theme and sets the class
// synchronously so we never flash the wrong background.
const themeBootstrap = `
(function(){
  try {
    var t = localStorage.getItem('mm_theme');
    if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark', t === 'dark');
  } catch(e) {
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#f59e0b" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MarketMithra" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.svg" />
        {/* Service worker registration */}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').catch(function() {});
            });
          }
        `}} />
        {/* Plausible privacy-first analytics — no cookies, no GDPR banner needed.
            Set NEXT_PUBLIC_PLAUSIBLE_DOMAIN to your domain in .env.local.
            Safe to omit in dev — the script 404s silently. */}
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <script
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
          />
        )}
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <PageProgress />
        <MithraAgent />
        <MithraPopAgent />
      </body>
    </html>
  );
}
