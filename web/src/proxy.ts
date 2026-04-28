/**
 * Next.js 16 Proxy — route protection (replaces middleware.ts convention).
 *
 * /canvas    → requires Supabase auth session. Anonymous users are redirected to
 *              /?gate=canvas&symbol=<sym> where the landing page shows SignInGate.
 *
 * /dna, /panic, /watchlist
 *            → sign-in required, no cap check.
 *              Anonymous users redirected to /?gate=signin.
 *
 * /admin     → requires session + email matches SUPER_ADMIN_EMAIL env var.
 *              All other users redirected to /.
 *
 * The proxy does NOT check the weekly cap — that happens client-side
 * via POST /api/consume-analysis after the page loads.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: ["/canvas/:path*", "/dna/:path*", "/panic/:path*", "/watchlist/:path*", "/admin/:path*"],
};

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase isn't configured (local dev without .env.local), pass through.
  if (!supabaseUrl || !supabaseAnon) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
        if (headers) {
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value)
          );
        }
      },
    },
  });

  // getUser() validates JWT server-side — safe for middleware.
  const { data: { user } } = await supabase.auth.getUser();

  // ── /canvas ──────────────────────────────────────────────────────────────
  if (request.nextUrl.pathname.startsWith("/canvas")) {
    if (!user) {
      const url = request.nextUrl.clone();
      // Symbol is now in the path: /canvas/RELIANCE.NS → pathParts[2]
      const pathParts = request.nextUrl.pathname.split("/");
      const symbol = pathParts[2] ?? "";
      url.pathname = "/";
      url.searchParams.set("gate", "canvas");
      if (symbol) url.searchParams.set("symbol", symbol);
      return NextResponse.redirect(url);
    }
  }

  // ── /dna, /panic, /watchlist ──────────────────────────────────────────────
  const genericProtected = ["/dna", "/panic", "/watchlist"];
  if (genericProtected.some((p) => request.nextUrl.pathname.startsWith(p))) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("gate", "signin");
      return NextResponse.redirect(url);
    }
  }

  // ── /admin ────────────────────────────────────────────────────────────────
  if (request.nextUrl.pathname.startsWith("/admin")) {
    const adminEmail = process.env.SUPER_ADMIN_EMAIL;
    if (!user || !adminEmail || user.email !== adminEmail) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}
