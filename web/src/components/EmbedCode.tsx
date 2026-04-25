"use client";

import { useState } from "react";

export default function EmbedCode({ symbol }: { symbol: string }) {
  const [copied, setCopied] = useState(false);
  const code = `<iframe src="https://marketmithra.app/embed/${symbol}" width="320" height="210" frameborder="0" style="border-radius:14px"></iframe>`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c0e16] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Embed this signal
        </span>
        <button
          onClick={copy}
          className="text-[11px] font-semibold rounded-full border border-slate-300 dark:border-slate-700 px-2.5 py-0.5 text-slate-600 dark:text-slate-400 hover:border-amber-400 hover:text-amber-500 transition"
        >
          {copied ? "✓ Copied" : "Copy code"}
        </button>
      </div>
      <pre className="text-[10px] text-slate-500 dark:text-slate-500 font-mono whitespace-pre-wrap break-all leading-relaxed">
        {code}
      </pre>
    </div>
  );
}
