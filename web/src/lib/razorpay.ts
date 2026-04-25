/**
 * Razorpay helpers — graceful degradation when keys are absent.
 *
 * .env.local:
 *   RAZORPAY_KEY_ID=rzp_live_...        (server + client)
 *   RAZORPAY_KEY_SECRET=...             (server only)
 *   NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_...  (exposed to browser for popup)
 *   RAZORPAY_WEBHOOK_SECRET=...         (webhook signature)
 */
import Razorpay from "razorpay";

// ── server-side client ────────────────────────────────────────────────────────
let _client: Razorpay | null = null;

export function getRazorpay(): Razorpay | null {
  const key_id     = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) return null;
  if (!_client) _client = new Razorpay({ key_id, key_secret });
  return _client;
}

export const razorpayConfigured = Boolean(
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
);

// ── plan definitions (amounts in paise = INR × 100) ──────────────────────────
export const PLANS = [
  {
    id:      "monthly" as const,
    label:   "Monthly",
    price:   "₹299",
    period:  "/month",
    amount:  29900,
    popular: false,
  },
  {
    id:      "annual" as const,
    label:   "Annual",
    price:   "₹2,499",
    period:  "/year",
    amount:  249900,
    popular: true,
    badge:   "Best value — 30% off",
  },
];

export type PlanId = "monthly" | "annual";
