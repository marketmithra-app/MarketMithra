"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const AUTO_RETRY_SECS = 10;     // first auto-retry after 10 s
const MAX_AUTO_RETRIES = 3;     // give up after 3 automatic attempts

export default function ApiErrorState({ symbol }: { symbol: string }) {
  const router = useRouter();
  const sym    = symbol.replace(".NS", "").replace(".BO", "");
  const isDev  = process.env.NODE_ENV === "development";

  const [retries,   setRetries]   = useState(0);
  const [countdown, setCountdown] = useState(AUTO_RETRY_SECS);

  // Auto-retry countdown — only fires while retries < MAX_AUTO_RETRIES
  useEffect(() => {
    if (retries >= MAX_AUTO_RETRIES) return;

    setCountdown(AUTO_RETRY_SECS);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          setRetries((r) => r + 1);
          router.refresh();
          return AUTO_RETRY_SECS;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retries]);

  const isGivingUp = retries >= MAX_AUTO_RETRIES;

  return (
    <div className="h-full w-full grid place-items-center p-10 text-center">
      <div className="max-w-sm rounded-xl border border-rose-500/30 bg-rose-500/5 p-7 space-y-4">
        <div className={`text-3xl ${!isGivingUp ? "animate-pulse" : ""}`}>📡</div>
        <div>
          <div className="text-sm font-semibold text-rose-300 mb-1">
            {isGivingUp ? `Could not load ${sym}` : "Connecting to signal server…"}
          </div>
          <p className="text-[12px] text-slate-500 leading-relaxed">
            {isDev
              ? "Make sure the FastAPI server is running on port 8000."
              : isGivingUp
              ? "The signal server is taking longer than usual. It may be cold-starting — please try again in a minute."
              : `The server is warming up. Auto-retrying in ${countdown}s (attempt ${retries + 1}/${MAX_AUTO_RETRIES})…`}
          </p>
        </div>

        {/* progress bar during auto-retry */}
        {!isGivingUp && (
          <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-rose-500/60 rounded-full transition-all duration-1000"
              style={{ width: `${((AUTO_RETRY_SECS - countdown) / AUTO_RETRY_SECS) * 100}%` }}
            />
          </div>
        )}

        <div className="flex items-center justify-center gap-3 pt-1">
          <button
            onClick={() => { setRetries(0); router.refresh(); }}
            className="rounded-full bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 px-4 py-1.5 text-xs font-semibold text-rose-300 transition"
          >
            {isGivingUp ? "Try again →" : "Retry now →"}
          </button>
          <button
            onClick={() => router.push("/")}
            className="text-xs text-slate-500 hover:text-slate-300 transition"
          >
            Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
