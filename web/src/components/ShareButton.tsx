"use client";

import { useState } from "react";

interface Props {
  symbol: string;   // e.g. "RELIANCE"
  verdict: string;  // "BUY" | "HOLD" | "SELL"
  pct: number;      // fusion probability 0-100
  url: string;      // canonical page URL
}

export default function ShareButton({ symbol, verdict, pct, url }: Props) {
  const [copied, setCopied] = useState(false);

  const emoji = verdict === "BUY" ? "🟢" : verdict === "SELL" ? "🔴" : "🟡";
  const text = `${emoji} ${symbol} is a ${verdict} today — ${pct}% fusion signal on MarketMithra`;

  async function handleShare() {
    // Web Share API (mobile / Safari)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `${symbol} ${verdict}`, text, url });
        return;
      } catch {
        // user cancelled or not supported — fall through
      }
    }

    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — open Twitter intent as last resort
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
      window.open(twitterUrl, "_blank", "noopener,noreferrer");
    }
  }

  function openTwitter() {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex items-center gap-2 mb-8">
      <button
        onClick={handleShare}
        className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/60 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:text-slate-100 transition"
      >
        {copied ? (
          <>✓ Copied</>
        ) : (
          <>
            <span>↗</span> Share signal
          </>
        )}
      </button>
      <button
        onClick={openTwitter}
        title="Share on X / Twitter"
        className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:border-slate-500 hover:text-slate-200 transition"
      >
        𝕏
      </button>
    </div>
  );
}
