import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSupabase, supabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";

type Body = {
  symbol: string;
  verdict: "BUY" | "HOLD" | "SELL";
  probability: number;
  vote: "agree" | "disagree";
  asOf: string;
  anonId: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.symbol || !body.vote || !body.verdict) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  if (!supabaseConfigured) {
    // Graceful no-op — the client has already stored this locally.
    return NextResponse.json({ ok: true, persisted: "local" });
  }

  const cookieStore = await cookies();
  const supabase = getServerSupabase(cookieStore);

  if (!supabase) {
    return NextResponse.json({ ok: true, persisted: "local" });
  }

  const { data: auth } = await supabase.auth.getUser();

  const { error } = await supabase.from("judgements").insert({
    user_id: auth?.user?.id ?? null,
    anon_id: body.anonId || null,
    symbol: body.symbol,
    verdict: body.verdict,
    probability: body.probability,
    vote: body.vote,
    as_of: body.asOf,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, persisted: "supabase" });
}
