"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to monitoring when you add Sentry / Axiom
    console.error("[MarketMithra] Unhandled error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0b10] text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 text-4xl">📡</div>
      <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
      <p className="text-sm text-slate-500 mb-8 max-w-xs leading-relaxed">
        Our signal server hit an unexpected error. Your data is safe — try refreshing or return home.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-amber-400 px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300 transition"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-slate-300 dark:border-slate-700 px-5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
        >
          Back to home
        </Link>
      </div>
      {error.digest && (
        <div className="mt-6 text-[10px] text-slate-600 font-mono">
          Error ID: {error.digest}
        </div>
      )}
    </div>
  );
}
