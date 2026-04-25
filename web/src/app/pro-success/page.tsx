"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * /pro-success
 *
 * Shown after the Razorpay popup closes successfully.
 * verify-pro has already run inline (in PricingCTA / ProUpgradeGate),
 * so mm_pro=1 is already set in localStorage before we land here.
 * We just confirm and give the user their next step.
 */
export default function ProSuccess() {
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    setActivated(localStorage.getItem("mm_pro") === "1");
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0b10] text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#0d0f18] to-[#12100a]/60 p-10 text-center shadow-2xl shadow-amber-500/5">

        {activated ? (
          <>
            <div className="text-4xl mb-4">🎉</div>
            <h1 className="text-2xl font-black text-amber-400 mb-2">You&apos;re Pro!</h1>
            <p className="text-sm text-slate-400 mb-8">
              Unlimited stocks, full AI synthesis, and priority signals — all yours.
            </p>
            <div className="flex flex-col gap-3">
              <Link
                href="/canvas"
                className="w-full rounded-full bg-amber-400 px-6 py-3 text-sm font-bold text-slate-900 hover:bg-amber-300 transition text-center"
              >
                Open the canvas →
              </Link>
              <Link
                href="/"
                className="w-full rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-400 hover:text-slate-200 hover:border-slate-500 transition text-center"
              >
                Back to home
              </Link>
            </div>
            <p className="mt-6 text-[11px] text-slate-600">
              Questions? Email{" "}
              <a href="mailto:hello@marketmithra.app" className="text-amber-500 underline">
                hello@marketmithra.app
              </a>
            </p>
          </>
        ) : (
          <>
            <div className="text-3xl mb-4">⚠️</div>
            <h1 className="text-xl font-black mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-400 mb-6">
              Your payment may have gone through — check your email for a receipt.
              If Pro isn&apos;t activating, email{" "}
              <a href="mailto:hello@marketmithra.app" className="text-amber-400 underline">
                hello@marketmithra.app
              </a>{" "}
              and we&apos;ll sort it out.
            </p>
            <Link
              href="/"
              className="inline-block rounded-full border border-slate-700 px-5 py-2 text-sm text-slate-400 hover:text-slate-200 transition"
            >
              Go home
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
