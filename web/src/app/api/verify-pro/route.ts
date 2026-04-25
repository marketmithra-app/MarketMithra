import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getServiceSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * POST /api/verify-pro
 *
 * Called by the frontend after Razorpay's handler fires with
 * { razorpay_payment_id, razorpay_order_id, razorpay_signature }.
 *
 * 1. Verifies the HMAC-SHA256 signature (prevents spoofing).
 * 2. Upserts a row into public.pro_subscribers.
 * 3. Returns { ok: true } → frontend sets mm_pro=1 in localStorage.
 */
export async function POST(req: NextRequest) {
  let body: {
    razorpay_order_id?:   string;
    razorpay_payment_id?: string;
    razorpay_signature?:  string;
    anonId?:              string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, anonId } = body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing payment fields" }, { status: 400 });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    // Dev mode — keys not configured, pass through
    return NextResponse.json({ ok: true, dev: true });
  }

  // ── Signature verification ───────────────────────────────────────────────────
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expected !== razorpay_signature) {
    console.error("[verify-pro] Signature mismatch");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── Record in Supabase ───────────────────────────────────────────────────────
  const supabase = getServiceSupabase();
  if (supabase) {
    const { error } = await supabase.from("pro_subscribers").insert({
      anon_id:              anonId ?? null,
      razorpay_order_id,
      razorpay_payment_id,
      payment_provider:     "razorpay",
      activated_at:         new Date().toISOString(),
    });
    if (error) console.error("[verify-pro] Supabase error:", error.message);
  }

  return NextResponse.json({ ok: true });
}
