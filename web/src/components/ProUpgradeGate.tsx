"use client";

import { useState } from "react";
import Link from "next/link";
import { FREE_DAILY_CAP, timeUntilReset } from "@/lib/usageCap";
import { getAnonId } from "@/lib/anonId";

interface Props {
  symbol: string;
}

export default function ProUpgradeGate({ symbol }: Props) {
  const cleanSym = symbol.replace(".NS", "").replace(".BO", "");
  const [plan, setPlan] = useState<"monthly" | "annual">("annual");
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#0d0f18] to-[#12100a]/60 p-8 text-center shadow-2xl shadow-amber-500/5">

        {/* icon */}
        <div className="text-4xl mb-4">🔒</div>

        {/* headline */}
        <h2 className="text-xl font-black text-slate-100 mb-2">
          Daily limit reached
        </h2>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          Free accounts get{" "}
          <span className="text-amber-400 font-semibold">
            {FREE_DAILY_CAP} full analyses per day
          </span>
          . You&apos;ve hit today&apos;s cap.{" "}
          <strong className="text-slate-200">{cleanSym}</strong> and the rest of
          the Nifty 50 are waiting.
        </p>

        {/* what you get with Pro */}
        <ul className="text-left text-sm space-y-2 mb-7">
          {[
            ["⚡", "Unlimited stocks, every day"],
            ["🔔", "Price alerts when signals change"],
            ["📊", "Portfolio-level fusion score"],
            ["🤖", "Full AI synthesis on every stock"],
            ["📬", "Weekly watchlist digest by email"],
          ].map(([icon, text]) => (
            <li key={text} className="flex items-center gap-2.5 text-slate-300">
              <span className="text-base shrink-0">{icon}</span>
              <span className="text-[13px]">{text}</span>
            </li>
          ))}
        </ul>

        {/* plan toggle */}
        <div className="flex gap-2 mb-5">
          {(["monthly", "annual"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlan(p)}
              className={`flex-1 rounded-full border py-2 text-[12px] font-semibold transition ${
                plan === p
                  ? "border-amber-400 bg-amber-400/10 text-amber-300"
                  : "border-slate-700 text-slate-500 hover:border-slate-500"
              }`}
            >
              {p === "monthly" ? "₹299 / month" : "₹2,499 / year"}
              {p === "annual" && (
                <span className="ml-1.5 text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-px rounded-full">
                  −30%
                </span>
              )}
            </button>
          ))}
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col gap-3">
          <button
            disabled={loading}
            className="w-full rounded-full bg-amber-400 px-6 py-3 text-sm font-bold text-slate-900 hover:bg-amber-300 disabled:opacity-60 transition"
            onClick={async () => {
              setLoading(true);
              try {
                // Load Razorpay popup script
                await new Promise<void>((resolve, reject) => {
                  if ((window as { Razorpay?: unknown }).Razorpay) { resolve(); return; }
                  const s = document.createElement("script");
                  s.src = "https://checkout.razorpay.com/v1/checkout.js";
                  s.onload = () => resolve();
                  s.onerror = () => reject(new Error("script"));
                  document.body.appendChild(s);
                });

                const res = await fetch("/api/checkout", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ plan, anonId: getAnonId() }),
                });
                const data = await res.json() as {
                  order_id?: string; amount?: number;
                  currency?: string; key_id?: string; plan_label?: string;
                };

                if (!data.order_id) { window.location.href = "/#waitlist"; return; }

                type RzpWindow = Window & { Razorpay: new (o: Record<string, unknown>) => { open(): void } };
                const rzp = new (window as unknown as RzpWindow).Razorpay({
                  key: data.key_id, order_id: data.order_id,
                  amount: data.amount, currency: data.currency ?? "INR",
                  name: "MarketMithra", description: `Pro ${data.plan_label ?? plan}`,
                  theme: { color: "#f59e0b" },
                  handler: async (r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
                    const v = await fetch("/api/verify-pro", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ ...r, anonId: getAnonId() }),
                    });
                    const vd = await v.json() as { ok?: boolean };
                    if (vd.ok) { localStorage.setItem("mm_pro", "1"); window.location.href = "/pro-success"; }
                  },
                  modal: { ondismiss: () => setLoading(false) },
                });
                rzp.open();
              } catch {
                setLoading(false);
                window.location.href = "/#waitlist";
              }
            }}
          >
            {loading ? "Opening checkout…" : `Upgrade to Pro (${plan}) →`}
          </button>
          <Link
            href="/"
            className="w-full rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-400 hover:text-slate-200 hover:border-slate-500 transition text-center"
          >
            Back to home
          </Link>
        </div>

        {/* fine print */}
        <p className="mt-5 text-[11px] text-slate-600">
          Cancel anytime · Secure checkout via Razorpay
        </p>
        <p className="mt-1 text-[11px] text-slate-700">
          Or wait — free cap resets in{" "}
          <span className="text-slate-500 font-mono">{timeUntilReset()}</span>
        </p>
      </div>
    </div>
  );
}
