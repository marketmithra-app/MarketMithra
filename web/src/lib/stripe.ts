/**
 * Stripe helpers with graceful degradation.
 *
 * When STRIPE_SECRET_KEY is not set the server-side `getStripe()` returns null
 * and all checkout routes fall back to a friendly "not yet configured" message.
 *
 * Setup checklist (`.env.local`):
 *   STRIPE_SECRET_KEY=sk_live_...          (or sk_test_... for testing)
 *   STRIPE_WEBHOOK_SECRET=whsec_...
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
 *   STRIPE_MONTHLY_PRICE_ID=price_...      (Stripe Dashboard → Products)
 *   STRIPE_ANNUAL_PRICE_ID=price_...
 */
import Stripe from "stripe";

// ── server-side client ────────────────────────────────────────────────────────
let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!_stripe) _stripe = new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
  return _stripe;
}

export const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);

// ── price IDs (set in .env.local) ─────────────────────────────────────────────
export const MONTHLY_PRICE_ID = process.env.STRIPE_MONTHLY_PRICE_ID ?? "";
export const ANNUAL_PRICE_ID  = process.env.STRIPE_ANNUAL_PRICE_ID  ?? "";

// ── pricing display (shown in UI regardless of Stripe config) ─────────────────
export const PLANS = [
  {
    id: "monthly",
    label: "Monthly",
    price: "₹299",
    period: "/month",
    usd: "$3.59",
    priceId: MONTHLY_PRICE_ID,
    popular: false,
  },
  {
    id: "annual",
    label: "Annual",
    price: "₹2,499",
    period: "/year",
    usd: "$29.99",
    priceId: ANNUAL_PRICE_ID,
    popular: true,
    badge: "Best value — 30% off",
  },
] as const;
