"use client";

import { useState } from "react";

interface Props {
  symbol: string;
  name: string;
  verdict: "BUY" | "HOLD" | "SELL";
  probability: number;
  price: number;
}

export default function ShareBar({ symbol, name, verdict, probability, price }: Props) {
  const [copied, setCopied] = useState(false);

  const url = `https://marketmithra.app/signals/${symbol.replace(".NS", "").replace(".BO", "")}`;
  const verdictEmoji = verdict === "BUY" ? "🟢" : verdict === "SELL" ? "🔴" : "🟡";
  const text = `${verdictEmoji} ${name} — ${verdict} signal\nProbability: ${Math.round(probability * 100)}% | ₹${price.toLocaleString("en-IN")}\nFull analysis: ${url}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — silently ignore
    }
  }

  function openWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  function openTwitter() {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener"
    );
  }

  const baseBtn =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition";
  const defaultBtn =
    "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-500 dark:hover:border-slate-400";
  const copiedBtn = "border-emerald-400 text-emerald-600";

  return (
    <div className="mb-8">
      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">
        Share this signal
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleCopy}
          className={`${baseBtn} ${copied ? copiedBtn : defaultBtn}`}
        >
          {copied ? "✓ Copied!" : "📋 Copy link"}
        </button>
        <button
          type="button"
          onClick={openWhatsApp}
          className={`${baseBtn} ${defaultBtn}`}
        >
          💬 WhatsApp
        </button>
        <button
          type="button"
          onClick={openTwitter}
          className={`${baseBtn} ${defaultBtn}`}
        >
          🐦 X / Twitter
        </button>
      </div>
    </div>
  );
}
