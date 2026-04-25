import { NextRequest, NextResponse } from "next/server";
import { getRazorpay, PLANS } from "@/lib/razorpay";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const razorpay = getRazorpay();
  if (!razorpay) {
    return NextResponse.json(
      { error: "Razorpay not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env.local." },
      { status: 503 }
    );
  }

  let body: { plan?: string; anonId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const plan = PLANS.find((p) => p.id === body.plan) ?? PLANS[0];

  try {
    const order = await razorpay.orders.create({
      amount:   plan.amount,
      currency: "INR",
      receipt:  `mm_${Date.now()}`,
      notes:    { anon_id: body.anonId ?? "", plan: plan.id },
    });

    return NextResponse.json({
      order_id:   order.id,
      amount:     order.amount,
      currency:   order.currency,
      key_id:     process.env.RAZORPAY_KEY_ID,
      plan_label: plan.label,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Order creation failed";
    console.error("[checkout] Razorpay error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
