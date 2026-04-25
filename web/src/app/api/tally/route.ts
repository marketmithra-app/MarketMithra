import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";
import type { TallyResult } from "@/lib/types";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const EMPTY = (symbol: string): TallyResult => ({
  symbol,
  verdict: null,
  agree_count: 0,
  disagree_count: 0,
  total: 0,
});

const CACHE_HEADERS = { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" };

/**
 * GET /api/tally?symbol=RELIANCE.NS
 *
 * Returns aggregate agree/disagree counts from the public `judgement_tally`
 * view.  Uses the anon key — the view is granted to anon and authenticated.
 * Returns zeros gracefully when Supabase is not configured.
 */
export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  if (!supabaseConfigured) {
    return NextResponse.json(EMPTY(symbol), { headers: CACHE_HEADERS });
  }

  const cookieStore = await cookies();
  const supabase = getServerSupabase({
    get: (name) => cookieStore.get(name)?.value,
  });

  if (!supabase) {
    return NextResponse.json(EMPTY(symbol), { headers: CACHE_HEADERS });
  }

  const { data, error } = await supabase
    .from("judgement_tally")
    .select("*")
    .eq("symbol", symbol)
    .order("total", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result: TallyResult = data ?? EMPTY(symbol);
  return NextResponse.json(result, { headers: CACHE_HEADERS });
}
