import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSupabase } from "@/lib/supabase";

/**
 * GET /auth/callback?code=xxx
 *
 * Supabase redirects here after the user clicks their magic-link email.
 * We exchange the one-time code for a session and set the session cookie,
 * then redirect the user back to wherever they came from (or /canvas).
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = req.nextUrl.searchParams.get("next") ?? "/canvas";
  const origin = req.nextUrl.origin;

  if (code) {
    const cookieStore = await cookies();
    const supabase = getServerSupabase(cookieStore);

    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Something went wrong — send to home with an error flag.
  return NextResponse.redirect(`${origin}/?auth_error=1`);
}
