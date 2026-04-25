import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/unsubscribe?email=... — one-click unsubscribe from digest emails. */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");

  if (!email) {
    return NextResponse.redirect(new URL("/unsubscribe?status=invalid", req.url));
  }

  const decoded = decodeURIComponent(email).toLowerCase().trim();

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.redirect(new URL("/unsubscribe?status=error", req.url));
  }

  const { error } = await supabase
    .from("waitlist")
    .delete()
    .eq("email", decoded);

  if (error) {
    console.error("[unsubscribe] Supabase error:", error.message);
    return NextResponse.redirect(new URL("/unsubscribe?status=error", req.url));
  }

  return NextResponse.redirect(
    new URL(`/unsubscribe?status=done&email=${encodeURIComponent(decoded)}`, req.url)
  );
}
