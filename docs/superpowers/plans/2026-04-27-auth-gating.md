# Auth & Page Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the MarketMithra canvas behind a sign-in wall with a server-enforced 5/week free cap, a frosted-glass gate UI, and a single super-admin bypass.

**Architecture:** Next.js `middleware.ts` blocks anonymous access to `/canvas`, redirecting to `/?gate=canvas`. A `POST /api/consume-analysis` route tracks weekly usage in Supabase `weekly_usage`. Two client components — `SignInGate` and `CapGate` — render frosted-glass overlays. `HeaderBadge` replaces the existing `UsagePill` with server-aware state.

**Tech Stack:** Next.js 16 / React 19 / Supabase SSR (`@supabase/ssr ^0.10.2`) / Vitest / `lucide-react` (to install) / TailwindCSS 4

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `web/src/lib/usageCap.ts` | Rewrite | `UsageResult` type, `consumeAnalysis()`, date helpers |
| `web/src/lib/__tests__/usageCap.test.ts` | Create | Unit tests for pure date helpers |
| `web/src/app/api/consume-analysis/route.ts` | Create | Server: check cap, upsert Supabase |
| `web/src/lib/auth.ts` | Modify | Add `isAdmin` to `AuthUser`, update `getUser()` |
| `web/src/middleware.ts` | Create | Edge: protect `/canvas`, `/admin` |
| `web/src/components/gates/SignInGate.tsx` | Create | Frosted glass sign-in overlay |
| `web/src/components/gates/CapGate.tsx` | Create | Frosted glass cap overlay + countdown |
| `web/src/components/gates/CanvasGateWrapper.tsx` | Create | Client: calls `consumeAnalysis`, shows right gate |
| `web/src/components/HeaderBadge.tsx` | Create | Free/Pro/Admin pill |
| `web/src/components/TopBar.tsx` | Modify | Swap `UsagePill` → `HeaderBadge` |
| `web/src/app/canvas/page.tsx` | Modify | Wrap canvas in `CanvasGateWrapper` |
| `web/src/app/page.tsx` | Modify | Show `SignInGate` when `?gate=canvas` |

---

## Task 1: Install lucide-react + create weekly_usage table

**Files:**
- `web/package.json` (updated by npm)
- Supabase SQL migration (run in Supabase dashboard SQL editor)

- [ ] **Step 1: Install lucide-react**

```bash
cd web && npm install lucide-react
```

Expected output: `added 1 package` (or similar — lucide-react has no peer deps).

- [ ] **Step 2: Run the Supabase migration**

Open the Supabase dashboard for the MarketMithra project → SQL Editor → New query. Paste and run:

```sql
-- Weekly usage tracking for the free-tier 5-analyses/week cap.
create table if not exists weekly_usage (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  week_start  date not null,  -- Monday of the current week (IST)
  count       int  not null default 0,
  updated_at  timestamptz not null default now(),
  unique (user_id, week_start)
);

-- RLS: each user can only read/write their own row.
alter table weekly_usage enable row level security;

create policy "users access own rows" on weekly_usage
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Expected: "Success. No rows returned."

- [ ] **Step 3: Verify table exists**

In the Supabase dashboard Table Editor, confirm `weekly_usage` appears with columns: `id`, `user_id`, `week_start`, `count`, `updated_at`.

- [ ] **Step 4: Commit**

```bash
git add web/package.json web/package-lock.json
git commit -m "chore: install lucide-react; add weekly_usage Supabase table (manual migration)"
```

---

## Task 2: Rewrite usageCap.ts with server-side types + date helpers

**Files:**
- Rewrite: `web/src/lib/usageCap.ts`
- Create: `web/src/lib/__tests__/usageCap.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/__tests__/usageCap.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { currentWeekStartIST, nextMondayISTString, msUntilWeekReset } from "@/lib/usageCap";

describe("currentWeekStartIST", () => {
  it("returns the Monday of the current IST week when today is Wednesday", () => {
    // 2026-04-29 is a Wednesday in IST
    vi.setSystemTime(new Date("2026-04-29T10:00:00+05:30"));
    expect(currentWeekStartIST()).toBe("2026-04-27"); // Monday
  });

  it("returns today when today is Monday", () => {
    vi.setSystemTime(new Date("2026-04-27T00:30:00+05:30")); // Monday morning IST
    expect(currentWeekStartIST()).toBe("2026-04-27");
  });

  it("returns previous Monday when today is Sunday", () => {
    vi.setSystemTime(new Date("2026-05-03T23:00:00+05:30")); // Sunday evening IST
    expect(currentWeekStartIST()).toBe("2026-04-27");
  });
});

describe("nextMondayISTString", () => {
  it("returns next Monday date string from a Wednesday", () => {
    vi.setSystemTime(new Date("2026-04-29T10:00:00+05:30")); // Wednesday
    expect(nextMondayISTString()).toBe("2026-05-04");
  });

  it("returns next Monday (7 days later) when today is Monday", () => {
    vi.setSystemTime(new Date("2026-04-27T10:00:00+05:30")); // Monday
    expect(nextMondayISTString()).toBe("2026-05-04");
  });

  it("returns tomorrow when today is Sunday", () => {
    vi.setSystemTime(new Date("2026-05-03T23:59:59+05:30")); // Sunday
    expect(nextMondayISTString()).toBe("2026-05-04");
  });
});

describe("msUntilWeekReset", () => {
  afterEach(() => vi.useRealTimers());

  it("returns positive ms when reset is in the future", () => {
    vi.setSystemTime(new Date("2026-04-29T10:00:00+05:30")); // Wednesday
    expect(msUntilWeekReset()).toBeGreaterThan(0);
  });

  it("returns roughly 5 days of ms on a Wednesday morning IST", () => {
    // Wednesday 10:00 IST → Monday 00:00 IST = ~4d14h = ~393600000ms
    vi.setSystemTime(new Date("2026-04-29T10:00:00+05:30"));
    const ms = msUntilWeekReset();
    // 4 days + 14 hours = (4*24 + 14) * 3600 * 1000 = 396000ms ... ~393600000ms
    const fourDays = 4 * 24 * 60 * 60 * 1000;
    const fiveDays = 5 * 24 * 60 * 60 * 1000;
    expect(ms).toBeGreaterThan(fourDays);
    expect(ms).toBeLessThan(fiveDays);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd web && npx vitest run src/lib/__tests__/usageCap.test.ts
```

Expected: `FAIL` — "cannot find module '@/lib/usageCap'" or missing exports.

- [ ] **Step 3: Rewrite usageCap.ts**

Replace the entire contents of `web/src/lib/usageCap.ts`:

```ts
/**
 * Server-aware weekly usage cap for the free tier.
 *
 * Free users get FREE_WEEKLY_CAP full canvas analyses per week (Mon–Sun IST).
 * Counts are tracked server-side in Supabase `weekly_usage`.
 * Call `consumeAnalysis(symbol)` before rendering the canvas — it will return
 * `allowed: false` when the cap is reached.
 *
 * Pure date helpers (`currentWeekStartIST`, `nextMondayISTString`, `msUntilWeekReset`)
 * are exported for tests and the CapGate countdown component.
 */

export const FREE_WEEKLY_CAP = 5;

// IST = UTC+5:30
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export interface UsageResult {
  allowed: boolean;
  remaining: number;
  resetAt: string; // "YYYY-MM-DD" — date of next Monday in IST
}

/**
 * Consume one analysis unit server-side.
 * Fails open: if the server is unreachable, returns `allowed: true` so the
 * user is never hard-blocked by a network error.
 */
export async function consumeAnalysis(symbol: string): Promise<UsageResult> {
  try {
    const res = await fetch("/api/consume-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<UsageResult>;
  } catch {
    // Fail open — network/server error must not block the user
    return { allowed: true, remaining: 0, resetAt: nextMondayISTString() };
  }
}

/**
 * "YYYY-MM-DD" of the Monday that started the current IST week.
 * Sunday counts as the last day of the previous week.
 */
export function currentWeekStartIST(): string {
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  const day = nowIST.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
  const daysToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(nowIST);
  monday.setUTCDate(nowIST.getUTCDate() - daysToMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().split("T")[0];
}

/**
 * "YYYY-MM-DD" of the next Monday in IST.
 * If today is Monday, the NEXT Monday is 7 days away (cap has already reset today).
 */
export function nextMondayISTString(): string {
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  const day = nowIST.getUTCDay(); // 0=Sun … 6=Sat
  // Sun→1, Mon→7, Tue→6, Wed→5, Thu→4, Fri→3, Sat→2
  const daysUntilNextMonday = day === 0 ? 1 : 8 - day;
  const next = new Date(nowIST);
  next.setUTCDate(nowIST.getUTCDate() + daysUntilNextMonday);
  next.setUTCHours(0, 0, 0, 0);
  return next.toISOString().split("T")[0];
}

/** Milliseconds until next Monday 00:00 IST. Used by the CapGate countdown. */
export function msUntilWeekReset(): number {
  const nowIST = Date.now() + IST_OFFSET_MS;
  const nextMondayIST = new Date(nextMondayISTString() + "T00:00:00Z").getTime();
  // nextMondayIST is midnight UTC of next Monday, but we want midnight IST
  // midnight IST = midnight UTC − 5.5h … but we worked in IST-shifted time
  // so nextMondayIST already represents midnight-IST in the shifted frame.
  // Convert back: subtract the IST offset to get wall-clock ms remaining.
  return Math.max(0, nextMondayIST - nowIST);
}

/** Format ms as "Xd Yh Zm" for the countdown display. */
export function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd web && npx vitest run src/lib/__tests__/usageCap.test.ts
```

Expected: `✓ 7 tests | PASS`

- [ ] **Step 5: Confirm TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing warnings).

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/usageCap.ts web/src/lib/__tests__/usageCap.test.ts
git commit -m "feat: rewrite usageCap — server-side UsageResult type and IST date helpers"
```

---

## Task 3: Create POST /api/consume-analysis route

**Files:**
- Create: `web/src/app/api/consume-analysis/route.ts`

- [ ] **Step 1: Create the route file**

Create `web/src/app/api/consume-analysis/route.ts`:

```ts
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

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = getServerSupabase({
    get: (name) => cookieStore.get(name)?.value,
    set: (name, value, options) => {
      cookieStore.set({ name, value, ...options } as Parameters<typeof cookieStore.set>[0]);
    },
  });

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
  await supabase.from("weekly_usage").upsert(
    { user_id: user.id, week_start: weekStart, count: currentCount + 1, updated_at: new Date().toISOString() },
    { onConflict: "user_id,week_start" }
  );

  return NextResponse.json({
    allowed: true,
    remaining: FREE_WEEKLY_CAP - (currentCount + 1),
    resetAt,
  });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Smoke test (requires running API server)**

```bash
cd web && npm run dev &
# Wait for "Ready" then in another terminal:
curl -s -X POST http://localhost:3000/api/consume-analysis \
  -H "Content-Type: application/json" \
  -d '{"symbol":"TCS.NS"}'
```

Expected: `{"error":"Unauthorized"}` with 401 (no session cookie).

- [ ] **Step 4: Commit**

```bash
git add web/src/app/api/consume-analysis/route.ts
git commit -m "feat: add POST /api/consume-analysis — server-side weekly cap check"
```

---

## Task 4: Update auth.ts — add isAdmin to AuthUser

**Files:**
- Modify: `web/src/lib/auth.ts`

- [ ] **Step 1: Update the AuthUser type and getUser()**

In `web/src/lib/auth.ts`, make these two changes:

Change the `AuthUser` type (line 11):
```ts
export type AuthUser = {
  id: string;
  email: string;
  isPro: boolean;
  isAdmin: boolean;
};
```

Change the `return` at the bottom of `getUser()` (last line of the function):
```ts
  const isAdmin = user.email === process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL;
  return { id: user.id, email: user.email, isPro, isAdmin };
```

> **Note:** `NEXT_PUBLIC_SUPER_ADMIN_EMAIL` is the public variant needed for client-side display (badge rendering). The server-side cap check in the API route uses `SUPER_ADMIN_EMAIL` (no NEXT_PUBLIC_ prefix) which is never sent to the client. Add both to `.env.local` with the same value (see Task 12).

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | grep "auth.ts" | head -10
```

Expected: no errors on auth.ts.

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/auth.ts
git commit -m "feat: add isAdmin to AuthUser; expose via NEXT_PUBLIC_SUPER_ADMIN_EMAIL"
```

---

## Task 5: Create middleware.ts — route protection

**Files:**
- Create: `web/src/middleware.ts`

- [ ] **Step 1: Create the middleware**

Create `web/src/middleware.ts`:

```ts
/**
 * Next.js Edge Middleware — route protection.
 *
 * /canvas  → requires Supabase auth session. Anonymous users are redirected to
 *            /?gate=canvas&symbol=<sym> where the landing page shows SignInGate.
 *
 * /admin   → requires session + email matches SUPER_ADMIN_EMAIL env var.
 *            All other users redirected to /.
 *
 * The middleware does NOT check the weekly cap — that happens client-side
 * via POST /api/consume-analysis after the page loads.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  // All routes that require a Supabase session.
  // /canvas  → weekly cap applies (handled client-side by CanvasGateWrapper)
  // /dna     → sign-in required, no cap
  // /panic   → sign-in required, no cap
  // /watchlist → sign-in required, no cap
  // /admin   → super admin only
  matcher: ["/canvas/:path*", "/dna/:path*", "/panic/:path*", "/watchlist/:path*", "/admin/:path*"],
};

export async function middleware(request: NextRequest) {
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
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // getUser() is safe for middleware — validates JWT, no DB round-trip.
  const { data: { user } } = await supabase.auth.getUser();

  // ── /canvas ──────────────────────────────────────────────────────────────
  if (request.nextUrl.pathname.startsWith("/canvas")) {
    if (!user) {
      const url = request.nextUrl.clone();
      const symbol = request.nextUrl.searchParams.get("symbol") ?? "";
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | grep "middleware.ts" | head -10
```

Expected: no errors.

- [ ] **Step 3: Smoke test — visit /canvas without a session**

Start `npm run dev`. Open an incognito window. Visit `http://localhost:3000/canvas?symbol=TCS.NS`.

Expected: browser redirects to `http://localhost:3000/?gate=canvas&symbol=TCS.NS`.

- [ ] **Step 4: Commit**

```bash
git add web/src/middleware.ts
git commit -m "feat: add Next.js middleware — protect /canvas (anon redirect) and /admin (super admin only)"
```

---

## Task 6: Create SignInGate component

**Files:**
- Create: `web/src/components/gates/SignInGate.tsx`

The gate is an overlay that sits on top of blurred placeholder content. It follows the existing `SignInModal` pattern — no external dependency, manual focus trap via `useEffect`.

- [ ] **Step 1: Create the component**

Create `web/src/components/gates/SignInGate.tsx`:

```tsx
"use client";

/**
 * SignInGate — frosted-glass overlay shown to anonymous users trying to
 * access the canvas. Displays over a blurred placeholder node graph.
 *
 * Accessibility: role="dialog", aria-modal, focus trap, ESC → does nothing
 * (user must sign in or navigate away).
 */

import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import SignInModal from "@/components/SignInModal";

interface Props {
  /** Symbol being requested, e.g. "TCS.NS". Shown in "Sign in to analyse X" */
  symbol?: string;
}

export default function SignInGate({ symbol }: Props) {
  const [showModal, setShowModal] = useState(false);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const ticker = symbol?.replace(".NS", "").replace(".BO", "") ?? "this stock";

  // Move focus into the gate on mount.
  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  // Simple focus trap: keep Tab/Shift-Tab inside the card.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        container!.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      {/* ── blurred placeholder node graph ── */}
      <div
        aria-hidden="true"
        className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-2 p-4"
        style={{ filter: "blur(5px)", opacity: 0.25 }}
      >
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="rounded-lg"
            style={{ background: i === 1 ? "#0d1f35" : i === 4 ? "#2d1f0d" : "#1e293b" }}
          />
        ))}
      </div>

      {/* ── frosted glass card ── */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="gate-title"
          aria-describedby="gate-desc"
          className="w-full max-w-[260px] rounded-2xl border border-white/[0.08] p-5 text-center shadow-[0_8px_32px_rgba(0,0,0,0.7)] animate-in fade-in zoom-in-95 duration-200"
          style={{
            background: "rgba(13,15,26,0.80)",
            // Fallback for browsers without backdrop-filter support
            ["WebkitBackdropFilter" as never]: "blur(12px)",
            backdropFilter: "blur(12px)",
          }}
        >
          <Lock
            className="mx-auto mb-2 h-5 w-5 text-amber-400"
            aria-hidden="true"
          />
          <h2
            id="gate-title"
            className="mb-1 text-[13px] font-bold text-slate-100"
          >
            Sign in to analyse {ticker}
          </h2>
          <p
            id="gate-desc"
            className="mb-3 text-[12px] text-slate-400 leading-snug"
          >
            6 indicators · AI synthesis · price targets
          </p>

          <button
            ref={primaryRef}
            onClick={() => setShowModal(true)}
            className="mb-2 w-full min-h-[44px] rounded-full bg-amber-400 px-4 py-2.5 text-[13px] font-bold text-slate-900 transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            Sign in free →
          </button>

          <p className="text-[12px] text-slate-500">
            5 analyses / week · no credit card
          </p>
        </div>
      </div>

      {showModal && (
        <SignInModal onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | grep "SignInGate" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/gates/SignInGate.tsx
git commit -m "feat: add SignInGate — frosted glass sign-in overlay for anonymous canvas visitors"
```

---

## Task 7: Create CapGate component

**Files:**
- Create: `web/src/components/gates/CapGate.tsx`

- [ ] **Step 1: Create the component**

Create `web/src/components/gates/CapGate.tsx`:

```tsx
"use client";

/**
 * CapGate — frosted-glass overlay shown when a free user has used all 5
 * weekly analyses. Shows a live countdown to Monday midnight IST + upgrade CTA.
 *
 * Accessibility: role="dialog", aria-modal, focus trap, progressbar pip dots,
 * aria-live countdown.
 */

import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { msUntilWeekReset, formatCountdown, FREE_WEEKLY_CAP } from "@/lib/usageCap";

interface Props {
  resetAt: string; // "YYYY-MM-DD" returned by consume-analysis
}

export default function CapGate({ resetAt }: Props) {
  const [countdown, setCountdown] = useState(() => formatCountdown(msUntilWeekReset()));
  const primaryRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Live countdown — updates every 60 seconds.
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(formatCountdown(msUntilWeekReset()));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Focus primary CTA on mount.
  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  // Focus trap.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        container!.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleRemindMe() {
    try {
      localStorage.setItem("mm_remind_cap_reset", resetAt);
    } catch { /* storage unavailable */ }
    // TODO Sprint 3: wire up push notification / email reminder
  }

  return (
    <>
      {/* Blurred placeholder */}
      <div
        aria-hidden="true"
        className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-2 p-4"
        style={{ filter: "blur(5px)", opacity: 0.25 }}
      >
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="rounded-lg"
            style={{ background: i === 1 ? "#0d1f35" : i === 4 ? "#2d1f0d" : "#1e293b" }}
          />
        ))}
      </div>

      {/* Frosted glass card */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cap-gate-title"
          aria-describedby="cap-gate-desc"
          className="w-full max-w-[260px] rounded-2xl border border-white/[0.08] p-5 text-center shadow-[0_8px_32px_rgba(0,0,0,0.7)] animate-in fade-in zoom-in-95 duration-200"
          style={{
            background: "rgba(13,15,26,0.80)",
            ["WebkitBackdropFilter" as never]: "blur(12px)",
            backdropFilter: "blur(12px)",
          }}
        >
          <CalendarDays
            className="mx-auto mb-2 h-5 w-5 text-slate-400"
            aria-hidden="true"
          />
          <h2
            id="cap-gate-title"
            className="mb-0.5 text-[13px] font-bold text-slate-100"
          >
            You&apos;ve used {FREE_WEEKLY_CAP} / {FREE_WEEKLY_CAP} this week
          </h2>
          <p id="cap-gate-desc" className="mb-3 text-[12px] text-slate-400">
            Resets{" "}
            <span className="font-semibold text-slate-300">
              Monday 12:00 AM IST
            </span>
          </p>

          {/* Countdown */}
          <div
            className="mb-3 rounded-lg bg-[#111827] px-3 py-2"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="text-[12px] text-slate-500 mb-0.5">Next reset in</div>
            <div className="text-[18px] font-black text-slate-100 tabular-nums">
              {countdown}
            </div>
          </div>

          {/* Pip progress bar */}
          <div
            className="mb-4 flex justify-center gap-1"
            role="progressbar"
            aria-valuenow={FREE_WEEKLY_CAP}
            aria-valuemax={FREE_WEEKLY_CAP}
            aria-label={`${FREE_WEEKLY_CAP} of ${FREE_WEEKLY_CAP} analyses used this week`}
          >
            {[...Array(FREE_WEEKLY_CAP)].map((_, i) => (
              <div
                key={i}
                className="h-1.5 w-[22px] rounded-full bg-amber-400"
                aria-hidden="true"
              />
            ))}
          </div>

          <button
            ref={primaryRef}
            onClick={() => (window.location.href = "/canvas?upgrade=1")}
            className="mb-2 w-full min-h-[44px] rounded-full bg-amber-400 px-4 py-2.5 text-[13px] font-bold text-slate-900 transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            Go unlimited — ₹299/mo
          </button>

          <button
            onClick={handleRemindMe}
            className="w-full min-h-[44px] rounded-full border border-slate-700 bg-transparent px-4 py-2 text-[12px] text-slate-500 transition hover:border-slate-500 hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
          >
            Remind me on Monday
          </button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | grep "CapGate" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/gates/CapGate.tsx
git commit -m "feat: add CapGate — frosted glass cap overlay with countdown and upgrade CTA"
```

---

## Task 8: Create CanvasGateWrapper

**Files:**
- Create: `web/src/components/gates/CanvasGateWrapper.tsx`

This client component wraps the canvas content. On mount it calls `consumeAnalysis`, then shows either the content or the `CapGate`. It also shows the verdict strip (always visible) above any gate.

- [ ] **Step 1: Create the wrapper**

Create `web/src/components/gates/CanvasGateWrapper.tsx`:

```tsx
"use client";

/**
 * CanvasGateWrapper — client component that enforces the weekly cap.
 *
 * Renders children when the user is allowed. Shows CapGate overlay when
 * the cap is reached. Shows a skeleton while the cap check is in flight.
 *
 * Usage:
 *   <CanvasGateWrapper symbol="TCS.NS">
 *     <CanvasMain snapshot={snapshot} />
 *   </CanvasGateWrapper>
 */

import { useEffect, useState } from "react";
import { consumeAnalysis, type UsageResult } from "@/lib/usageCap";
import CapGate from "@/components/gates/CapGate";

interface Props {
  symbol: string;
  children: React.ReactNode;
}

export default function CanvasGateWrapper({ symbol, children }: Props) {
  const [result, setResult] = useState<UsageResult | null>(null);

  useEffect(() => {
    consumeAnalysis(symbol).then(setResult);
  }, [symbol]);

  // While the cap check is in flight, render children immediately.
  // consumeAnalysis is fast (<200ms on local network), so the flash
  // is imperceptible. Alternatively, show a thin top-bar skeleton here.
  if (result === null) {
    return <>{children}</>;
  }

  if (!result.allowed) {
    return (
      <div className="relative flex-1 min-h-0 flex flex-col">
        {/* Blurred canvas is rendered behind the gate so the layout is stable */}
        <div aria-hidden="true" className="pointer-events-none select-none opacity-30 flex-1">
          {children}
        </div>
        <div className="absolute inset-0">
          <CapGate resetAt={result.resetAt} />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | grep "CanvasGateWrapper" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/gates/CanvasGateWrapper.tsx
git commit -m "feat: add CanvasGateWrapper — calls consume-analysis on mount, shows CapGate when capped"
```

---

## Task 9: Create HeaderBadge + update TopBar

**Files:**
- Create: `web/src/components/HeaderBadge.tsx`
- Modify: `web/src/components/TopBar.tsx`

- [ ] **Step 1: Create HeaderBadge.tsx**

Create `web/src/components/HeaderBadge.tsx`:

```tsx
"use client";

/**
 * HeaderBadge — shows the user's tier in the top bar.
 *
 * States:
 *   - Admin  → purple pill "Admin"
 *   - Pro    → green pill "Pro"
 *   - Free (analyses remaining) → slate pill "Free · N left"
 *   - Free (cap reached)        → amber pill "Free · Resets Mon"
 *   - Anonymous / loading       → nothing
 */

import { useEffect, useState } from "react";
import { getUser, type AuthUser } from "@/lib/auth";

const FREE_WEEKLY_CAP = 5;

export default function HeaderBadge() {
  const [user, setUser] = useState<AuthUser | null | "loading">("loading");
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    getUser().then((u) => {
      setUser(u);
      if (u && !u.isPro && !u.isAdmin) {
        // Fetch remaining from the server once on mount.
        // We do a GET to consume-analysis with no increment — use a lightweight
        // dedicated endpoint, or re-use the POST with a "peek" flag.
        // For now, read the last result from sessionStorage if available.
        try {
          const cached = sessionStorage.getItem("mm_usage_remaining");
          if (cached !== null) setRemaining(parseInt(cached, 10));
          else setRemaining(FREE_WEEKLY_CAP); // optimistic default
        } catch {
          setRemaining(FREE_WEEKLY_CAP);
        }
      }
    });
  }, []);

  // Listen for consume-analysis results stored by CanvasGateWrapper.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "mm_usage_remaining" && e.newValue !== null) {
        setRemaining(parseInt(e.newValue, 10));
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (user === "loading" || user === null) return null;

  if (user.isAdmin) {
    return (
      <span className="rounded-full bg-purple-500/20 border border-purple-500/40 px-2.5 py-1 text-[11px] font-semibold text-purple-400">
        Admin
      </span>
    );
  }

  if (user.isPro) {
    return (
      <span className="rounded-full bg-green-500/15 border border-green-500/40 px-2.5 py-1 text-[11px] font-semibold text-green-400">
        Pro
      </span>
    );
  }

  // Free user
  const rem = remaining ?? FREE_WEEKLY_CAP;
  const atCap = rem <= 0;

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[11px] font-mono transition ${
        atCap
          ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
          : "border-slate-600 bg-slate-800/60 text-slate-400"
      }`}
      title={`Free tier: ${rem} of ${FREE_WEEKLY_CAP} analyses remaining this week`}
    >
      {atCap ? "Free · Resets Mon" : `Free · ${rem} left`}
    </span>
  );
}
```

- [ ] **Step 2: Update CanvasGateWrapper to store remaining in sessionStorage**

Add one line to `CanvasGateWrapper.tsx` after `setResult(r)`:

```tsx
useEffect(() => {
  consumeAnalysis(symbol).then((r) => {
    setResult(r);
    // Share remaining count with HeaderBadge via sessionStorage.
    try {
      sessionStorage.setItem("mm_usage_remaining", String(r.remaining));
      window.dispatchEvent(new StorageEvent("storage", {
        key: "mm_usage_remaining",
        newValue: String(r.remaining),
      }));
    } catch { /* ignore */ }
  });
}, [symbol]);
```

This replaces the existing `useEffect` in `CanvasGateWrapper.tsx` entirely.

- [ ] **Step 3: Update TopBar.tsx — swap UsagePill for HeaderBadge**

In `web/src/components/TopBar.tsx`:

**a)** Replace the import:
```ts
// Remove:
import { getDailyCount, FREE_DAILY_CAP, isPro } from "@/lib/usageCap";
// Add:
import HeaderBadge from "@/components/HeaderBadge";
```

**b)** In the JSX return of `TopBar`, replace `<UsagePill />` with `<HeaderBadge />`:
```tsx
// Remove:
<UsagePill />
// Add:
<HeaderBadge />
```

**c)** Delete the entire `UsagePill` function (lines 392–428) from TopBar.tsx — it is no longer used.

- [ ] **Step 4: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 5: Lint**

```bash
cd web && npm run lint 2>&1 | grep -v "^$" | head -20
```

Expected: no new warnings (existing 11 intentional warnings are acceptable).

- [ ] **Step 6: Commit**

```bash
git add web/src/components/HeaderBadge.tsx \
        web/src/components/gates/CanvasGateWrapper.tsx \
        web/src/components/TopBar.tsx
git commit -m "feat: add HeaderBadge (Free/Pro/Admin pill); swap UsagePill in TopBar"
```

---

## Task 10: Update canvas page — integrate CanvasGateWrapper

**Files:**
- Modify: `web/src/app/canvas/page.tsx`

The canvas page is a Server Component. `CanvasGateWrapper` is a `"use client"` component, which is fine — Server Components can render Client Components as children.

- [ ] **Step 1: Add CanvasGateWrapper import + wrap CanvasMain**

In `web/src/app/canvas/page.tsx`:

**a)** Add import at the top (after other imports):
```ts
import CanvasGateWrapper from "@/components/gates/CanvasGateWrapper";
```

**b)** Wrap the `<CanvasMain>` element on the desktop branch:

Find this block (around line 64-66):
```tsx
          <div className="hidden md:flex flex-col flex-1 min-h-0">
            {snapshot ? <CanvasMain snapshot={snapshot} forceGate={forceGate} /> : <ApiErrorState symbol={active} />}
          </div>
```

Replace with:
```tsx
          <div className="hidden md:flex flex-col flex-1 min-h-0">
            {snapshot ? (
              <CanvasGateWrapper symbol={active}>
                <CanvasMain snapshot={snapshot} forceGate={forceGate} />
              </CanvasGateWrapper>
            ) : (
              <ApiErrorState symbol={active} />
            )}
          </div>
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | grep "canvas" | head -10
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

1. Start `npm run dev`.
2. Sign in as a free user.
3. Open `http://localhost:3000/canvas?symbol=TCS.NS` — full canvas renders.
4. To test cap gate, temporarily seed a `weekly_usage` row with `count=5` for your user in Supabase → reload canvas → cap gate should appear with countdown.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/canvas/page.tsx
git commit -m "feat: wrap CanvasMain in CanvasGateWrapper — enforces weekly cap on canvas page"
```

---

## Task 11: Update landing page — show SignInGate for ?gate=canvas

**Files:**
- Modify: `web/src/app/page.tsx`
- Create: `web/src/components/gates/LandingGateController.tsx`

The landing page is a Server Component and cannot read `searchParams` reactively. A thin client wrapper reads `useSearchParams()` and renders `SignInGate` when `gate=canvas` is present.

- [ ] **Step 1: Create LandingGateController.tsx**

Create `web/src/components/gates/LandingGateController.tsx`:

```tsx
"use client";

/**
 * LandingGateController
 *
 * Reads URL search params on the client and conditionally renders SignInGate
 * as a full-screen overlay when ?gate=canvas is present.
 *
 * The sign-in gate is shown when the Next.js middleware redirects an
 * anonymous /canvas visitor to /?gate=canvas&symbol=<sym>.
 */

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import SignInGate from "@/components/gates/SignInGate";

function Controller() {
  const params = useSearchParams();
  const gate = params.get("gate");
  const symbol = params.get("symbol") ?? undefined;

  // gate=canvas  → from /canvas redirect (show symbol-specific message)
  // gate=signin  → from /dna, /panic, /watchlist (generic sign-in)
  if (gate !== "canvas" && gate !== "signin") return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0b10]/70">
      <div className="relative h-full">
        <SignInGate symbol={symbol} />
      </div>
    </div>
  );
}

// useSearchParams() requires Suspense boundary in Next.js App Router.
export default function LandingGateController() {
  return (
    <Suspense fallback={null}>
      <Controller />
    </Suspense>
  );
}
```

- [ ] **Step 2: Add LandingGateController to landing page**

In `web/src/app/page.tsx`:

**a)** Add import after existing imports:
```ts
import LandingGateController from "@/components/gates/LandingGateController";
```

**b)** Add the component at the top of the returned JSX, inside the root `<div>`, before the `<script>` tag:
```tsx
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-[#0a0b10] dark:text-slate-100">
      <LandingGateController />
      <script ...
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | grep "page.tsx" | head -10
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

1. Open an incognito window.
2. Navigate to `http://localhost:3000/canvas?symbol=TCS.NS`.
3. Middleware redirects to `/?gate=canvas&symbol=TCS.NS`.
4. Landing page renders with `SignInGate` overlay (full-screen frosted card).
5. Click "Sign in free →" → `SignInModal` opens.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/page.tsx \
        web/src/components/gates/LandingGateController.tsx
git commit -m "feat: show SignInGate on landing page when redirected from canvas with ?gate=canvas"
```

---

## Task 12: Add env vars + full smoke test

**Files:**
- `web/.env.local` (local dev, not committed)
- Vercel project env vars (via Vercel dashboard or CLI)
- Railway env vars (via railway CLI)

- [ ] **Step 1: Add to web/.env.local**

Append to `web/.env.local` (create from `.env.local.example` if it doesn't exist):

```
SUPER_ADMIN_EMAIL=your@email.com
NEXT_PUBLIC_SUPER_ADMIN_EMAIL=your@email.com
```

Replace `your@email.com` with the actual super admin email.

- [ ] **Step 2: Add to Vercel**

```bash
# From the project root
vercel env add SUPER_ADMIN_EMAIL production
# Enter: your@email.com

vercel env add NEXT_PUBLIC_SUPER_ADMIN_EMAIL production
# Enter: your@email.com
```

- [ ] **Step 3: Add to Railway (not needed — Railway is the API, not Next.js)**

The `SUPER_ADMIN_EMAIL` is only used in the Next.js app (Vercel). Skip Railway.

- [ ] **Step 4: Restart dev server**

```bash
# Stop dev server (Ctrl+C), then restart to pick up .env.local changes
cd web && npm run dev
```

- [ ] **Step 5: Full smoke test checklist**

Run through each acceptance criterion:

```
[ ] Anonymous → /canvas?symbol=TCS.NS → redirects to /?gate=canvas&symbol=TCS.NS
[ ] Landing page shows SignInGate overlay with "Sign in to analyse TCS"
[ ] Clicking "Sign in free →" opens SignInModal
[ ] After signing in, redirect returns to /canvas?symbol=TCS.NS
[ ] Free user (0 analyses used) → canvas renders fully, HeaderBadge shows "Free · 5 left"
[ ] After 1 analysis: HeaderBadge shows "Free · 4 left"
[ ] After 5 analyses: canvas shows CapGate with countdown and "Go unlimited" button
[ ] Countdown text is visible and ticking (check after 1 minute)
[ ] SUPER_ADMIN_EMAIL user → no cap gate, HeaderBadge shows "Admin" (purple)
[ ] SUPER_ADMIN_EMAIL user → /admin → page loads (or 404 if /admin not yet built)
[ ] Non-admin user → /admin → redirect to /
[ ] "Remind me on Monday" button sets localStorage.mm_remind_cap_reset
[ ] "Go unlimited" button navigates to /canvas?upgrade=1
```

- [ ] **Step 6: Deploy to production**

```bash
# Trigger Vercel redeploy (needed to bake in NEXT_PUBLIC_SUPER_ADMIN_EMAIL)
vercel --prod
```

- [ ] **Step 7: Commit env example update**

```bash
# Add the new keys to .env.local.example (do NOT add real values)
# Append to web/.env.local.example:
# SUPER_ADMIN_EMAIL=admin@example.com
# NEXT_PUBLIC_SUPER_ADMIN_EMAIL=admin@example.com

git add web/.env.local.example
git commit -m "chore: document SUPER_ADMIN_EMAIL env vars in .env.local.example"
```

---

## Task 13: Fix post-login redirect to return to original canvas

**Files:**
- Modify: `web/src/components/SignInModal.tsx`
- Modify: `web/src/components/gates/SignInGate.tsx`

The existing `/auth/callback/route.ts` reads `?next` from the URL and redirects there. By default `SignInModal` sends no `next`, so users land on `/canvas` after sign-in. This task makes the gate pass the original symbol back through the redirect chain.

- [ ] **Step 1: Add optional redirectTo prop to SignInModal**

In `web/src/components/SignInModal.tsx`, update the interface and submit function:

```tsx
// Change Props interface (line 6-8):
interface Props {
  onClose: () => void;
  redirectTo?: string; // optional magic-link redirect override
}

// Change function signature (line 12):
export default function SignInModal({ onClose, redirectTo }: Props) {

// Change the signInWithEmail call in submit() (line 21):
    const { error } = await signInWithEmail(email.trim().toLowerCase(), redirectTo);
```

- [ ] **Step 2: Pass computed redirectTo from SignInGate**

In `web/src/components/gates/SignInGate.tsx`, compute `redirectTo` before the return statement and pass it to `SignInModal`:

```tsx
  // Compute post-login redirect destination.
  // symbol is e.g. "TCS" (already stripped of .NS in the ticker variable).
  // The auth callback's ?next param must be URL-encoded.
  const redirectTo =
    symbol
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback?next=${encodeURIComponent(`/canvas?symbol=${symbol}`)}`
      : `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`;

  // ...in the JSX:
  {showModal && <SignInModal onClose={() => setShowModal(false)} redirectTo={redirectTo} />}
```

Note: `symbol` here is the original prop value (e.g. `"TCS.NS"`), not the stripped `ticker` variable.

- [ ] **Step 3: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | grep -E "SignIn" | head -10
```

Expected: no errors.

- [ ] **Step 4: Smoke test**

1. Open incognito, navigate to `/canvas?symbol=INFY.NS`.
2. Gets redirected to `/?gate=canvas&symbol=INFY.NS`.
3. Click "Sign in free →", enter email, click magic link.
4. Verify browser lands on `/canvas?symbol=INFY.NS` (not just `/canvas`).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/SignInModal.tsx \
        web/src/components/gates/SignInGate.tsx
git commit -m "feat: pass post-login redirect through SignInGate so magic link returns to original canvas"
```
