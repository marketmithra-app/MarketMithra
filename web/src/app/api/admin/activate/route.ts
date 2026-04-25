import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/admin/activate
 *
 * Activates Pro + admin flag for the current browser session.
 * Used for testing the full product without a Stripe payment.
 * Protected by ADMIN_SECRET env var — never exposed to the client.
 *
 * Body: { key: string }
 * Response: { ok: true, email: "admin@marketmithra.app" }
 *           | { error: "Invalid key" }
 *
 * The client then stores mm_pro=1 and mm_admin=1 in localStorage,
 * exactly the same path as a real Stripe checkout completion.
 */
export async function POST(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    return NextResponse.json(
      { error: "ADMIN_SECRET is not configured on this server." },
      { status: 503 }
    );
  }

  let body: { key?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!body.key || body.key !== adminSecret) {
    // Add a small delay to deter brute-force
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ error: "Invalid key" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    email: "admin@marketmithra.app",
    message: "Admin Pro activated. mm_pro=1 and mm_admin=1 set in localStorage.",
  });
}
