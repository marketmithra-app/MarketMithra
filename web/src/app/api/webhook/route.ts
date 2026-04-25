import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getServiceSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * POST /api/webhook
 *
 * Razorpay webhook — set in Razorpay Dashboard → Webhooks.
 * Endpoint URL: https://marketmithra.app/api/webhook
 * Events: payment.captured
 *
 * This is a secondary activation path (primary is verify-pro).
 * Razorpay fires this server-to-server even if the browser closes mid-payment.
 */
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  // Graceful degradation — not configured in dev
  if (!webhookSecret) {
    return NextResponse.json({ ok: true, dev: true }, { status: 200 });
  }

  const bodyBytes = await req.arrayBuffer();
  const body      = Buffer.from(bodyBytes);
  const sig       = req.headers.get("x-razorpay-signature") ?? "";

  // Verify signature
  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(body)
    .digest("hex");

  if (expected !== sig) {
    console.error("[webhook] Signature mismatch");
    return NextResponse.json({ error: "Signature mismatch" }, { status: 400 });
  }

  let event: {
    event: string;
    payload: {
      payment?: {
        entity: {
          id:       string;
          order_id: string;
          notes:    Record<string, string>;
          email?:   string;
        };
      };
    };
  };

  try {
    event = JSON.parse(body.toString());
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event.event === "payment.captured") {
    const payment = event.payload.payment?.entity;
    if (!payment) return NextResponse.json({ received: true });

    const anon_id             = payment.notes?.anon_id ?? null;
    const razorpay_order_id   = payment.order_id;
    const razorpay_payment_id = payment.id;

    console.log("[webhook] payment.captured", { anon_id, razorpay_order_id, razorpay_payment_id });

    const supabase = getServiceSupabase();
    if (supabase) {
      const { error } = await supabase.from("pro_subscribers").insert({
        anon_id,
        razorpay_order_id,
        razorpay_payment_id,
        payment_provider: "razorpay",
        activated_at:     new Date().toISOString(),
      });
      // Ignore duplicate — verify-pro may have already inserted
      if (error && !error.message.includes("duplicate")) {
        console.error("[webhook] Supabase error:", error.message);
      }
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
