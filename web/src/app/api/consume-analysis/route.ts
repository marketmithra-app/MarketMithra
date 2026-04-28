/**
 * POST /api/consume-analysis
 *
 * Checks and increments the caller's weekly analysis count in Supabase.
 * Called by the canvas page before rendering the node graph.
 *
 * Request body: { symbol: string }
 * Response:     { allowed: boolean, remaining: number, resetAt: string }
 *
 * Returns HTTP 200 in all cases (allowed or not). HTTP 401 only when
 * the request arrives without a valid Supabase session.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSupabase } from "@/lib/supabase";
import { currentWeekStartIST, nextMondayISTString, FREE_WEEKLY_CAP } from "@/lib/usageCap";

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = getServerSupabase(cookieStore);

  if (!supabase) {
    // Supabase not configured — fail open (dev / CI environment)
    return NextResponse.json({ allowed: true, remaining: FREE_WEEKLY_CAP, resetAt: nextMondayISTString() });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Super admin bypasses all caps
  if (user.email === process.env.SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ allowed: true, remaining: 999, resetAt: nextMondayISTString() });
  }

  // Pro subscribers bypass the cap
  const { data: proRow } = await supabase
    .from("pro_subscribers")
    .select("id")
    .eq("email", user.email)
    .maybeSingle();

  if (proRow) {
    return NextResponse.json({ allowed: true, remaining: 999, resetAt: nextMondayISTString() });
  }

  // Free user — check and increment weekly count
  // Note: read-then-write is not atomic. Concurrent requests can over-count
  // by up to N concurrent tabs. Acceptable for the 5/week soft cap at this stage.
  // Future fix: replace with a Postgres atomic increment via Supabase RPC.
  const weekStart = currentWeekStartIST();
  const resetAt = nextMondayISTString();

  const { data: row } = await supabase
    .from("weekly_usage")
    .select("count")
    .eq("user_id", user.id)
    .eq("week_start", weekStart)
    .maybeSingle();

  const currentCount = row?.count ?? 0;

  if (currentCount >= FREE_WEEKLY_CAP) {
    return NextResponse.json({ allowed: false, remaining: 0, resetAt });
  }

  // Increment
  const { error: upsertError } = await supabase.from("weekly_usage").upsert(
    { user_id: user.id, week_start: weekStart, count: currentCount + 1, updated_at: new Date().toISOString() },
    { onConflict: "user_id,week_start" }
  );
  if (upsertError) {
    // Log but do not block the user — cap is a soft limit.
    console.error("[consume-analysis] upsert failed:", upsertError.message);
  }

  return NextResponse.json({
    allowed: true,
    remaining: FREE_WEEKLY_CAP - (currentCount + 1),
    resetAt,
  });
}
