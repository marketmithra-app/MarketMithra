"use client";

import { useState } from "react";
import { getAnonId } from "@/lib/anonId";

// ── Razorpay checkout.js global type ─────────────────────────────────────────
declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }
    const script    = document.createElement("script");
    script.src      = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload   = () => resolve(true);
    script.onerror  = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function PricingCTA({
  plan,
  label,
  className,
}: {
  plan: "monthly" | "annual";
  label: string;
  className: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      // 1. Load Razorpay popup script
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Razorpay script failed to load");

      // 2. Create order on our backend
      const res = await fetch("/api/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ plan, anonId: getAnonId() }),
      });
      const data = await res.json() as {
        order_id?: string;
        amount?: number;
        currency?: string;
        key_id?: string;
        plan_label?: string;
        error?: string;
      };

      if (!data.order_id) {
        // Not configured yet — fall back to waitlist
        window.location.href = "/#waitlist";
        return;
      }

      // 3. Open Razorpay popup
      const rzp = new window.Razorpay({
        key:         data.key_id,
        order_id:    data.order_id,
        amount:      data.amount,
        currency:    data.currency ?? "INR",
        name:        "MarketMithra",
        description: `Pro ${data.plan_label ?? plan}`,
        theme:       { color: "#f59e0b" },

        // 4. On successful payment: verify server-side, activate Pro
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id:   string;
          razorpay_signature:  string;
        }) => {
          const vRes = await fetch("/api/verify-pro", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_signature:  response.razorpay_signature,
              anonId:              getAnonId(),
            }),
          });
          const vData = await vRes.json() as { ok?: boolean };
          if (vData.ok) {
            localStorage.setItem("mm_pro", "1");
            window.location.href = "/pro-success";
          }
        },

        modal: {
          ondismiss: () => setLoading(false),
        },
      });

      rzp.open();
    } catch {
      setLoading(false);
      window.location.href = "/#waitlist";
    }
  }

  return (
    <button onClick={handleClick} disabled={loading} className={className}>
      {loading ? "Opening checkout…" : label}
    </button>
  );
}
