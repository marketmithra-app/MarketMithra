# Auth & Page Gating — Design Spec
**Project:** MarketMithra  
**Date:** 2026-04-27  
**Status:** Approved for implementation

---

## 1. Problem

MarketMithra's analysis canvas is fully public. Any visitor can run unlimited stock analyses, scrape all data, and share results without attribution. This blocks monetisation and makes a free-tier/Pro split impossible.

---

## 2. Goals

- Gate the full canvas analysis behind a sign-in wall (free tier: 5/week, Pro: unlimited)
- Keep the BUY/SELL/HOLD verdict and stock price publicly visible (SEO + curiosity gap)
- Enforce the weekly cap server-side (localStorage bypass is not acceptable in production)
- Give one super-admin credential that bypasses all caps and can access `/admin`
- Deliver a premium, accessible gate UI consistent with the dark fintech design system

---

## 3. Access Matrix

| Surface | Anonymous | Free (signed-in) | Pro | Super Admin |
|---|---|---|---|---|
| Landing page | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| Signals list — verdict badges (BUY/SELL/HOLD) | ✅ Public | ✅ Public | ✅ Public | ✅ Public |
| Signals list — scores / probability bars | 🔒 Hidden | ✅ Visible | ✅ Visible | ✅ Visible |
| Canvas analysis (full node graph) | 🔒 Sign-in gate | ✅ Up to 5/week | ✅ Unlimited | ✅ Unlimited |
| Stock DNA | 🔒 Sign-in gate | ✅ Unlimited (no cap) | ✅ Unlimited | ✅ Unlimited |
| Panic-O-Meter | 🔒 Sign-in gate | ✅ Visible | ✅ Visible | ✅ Visible |
| Watchlist / Darvas | 🔒 Sign-in gate | ✅ Visible | ✅ Visible | ✅ Visible |
| `/admin` | 🔒 Blocked | 🔒 Blocked | 🔒 Blocked | ✅ Full access |

**What counts as one "analysis":** Every canvas page mount calls `consume-analysis` and increments the counter. No deduplication by symbol — the counter is simple and predictable. The backend's existing 12h snapshot cache means re-analysing the same stock within a session is fast and free of API cost, but it still counts against the weekly quota.

**Weekly cap reset:** Monday 00:00 IST (UTC+5:30). Server-side only.

---

## 4. Architecture

### 4.1 Supabase — new `weekly_usage` table

```sql
create table weekly_usage (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  week_start  date not null,          -- Monday of the current week (ISO: trunc to week)
  count       int  not null default 0,
  updated_at  timestamptz default now(),
  unique (user_id, week_start)
);

-- RLS: users can only read/increment their own row
alter table weekly_usage enable row level security;
create policy "own rows" on weekly_usage
  for all using (auth.uid() = user_id);
```

`week_start` is always the Monday of the current ISO week, computed server-side in the API route.

### 4.2 Next.js middleware (`web/src/middleware.ts`)

Protects routes that require authentication. Runs on the Edge (no DB calls here).

**Protected prefixes:**
- `/canvas` — redirects anonymous users to `/?gate=canvas&symbol=<sym>`
- `/admin` — redirects to `/` unless `SUPER_ADMIN_EMAIL` matches

```ts
// Pseudo-code
export const config = { matcher: ['/canvas/:path*', '/admin/:path*'] }

export async function middleware(req: NextRequest) {
  const { data: { session } } = await supabaseMiddlewareClient(req)

  if (!session) {
    // Preserve the destination so we can redirect back post-auth
    const url = req.nextUrl.clone()
    url.pathname = '/'
    url.searchParams.set('gate', 'canvas')
    url.searchParams.set('symbol', req.nextUrl.searchParams.get('symbol') ?? '')
    return NextResponse.redirect(url)
  }

  if (req.nextUrl.pathname.startsWith('/admin')) {
    if (session.user.email !== process.env.SUPER_ADMIN_EMAIL) {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }
}
```

### 4.3 API route — `POST /api/consume-analysis`

Called by the canvas page before fetching the snapshot. Returns the updated usage or an error if the cap is reached.

**Request:** `{ symbol: string }` (authenticated via Supabase session cookie)  
**Response (success):** `{ allowed: true, remaining: number, resetAt: string }`  
**Response (cap reached):** `{ allowed: false, remaining: 0, resetAt: string }` — HTTP 200, not 429 (avoids confusing error states in the UI)

**Server logic:**
1. Get `user_id` from Supabase session
2. If `user.email === SUPER_ADMIN_EMAIL` → return `{ allowed: true, remaining: 999 }`
3. Check `pro_subscribers` table — if Pro → return `{ allowed: true, remaining: 999 }`
4. Compute `week_start` = Monday of current week (IST)
5. Upsert `weekly_usage` with `count + 1` (using `on conflict do update` + check before increment)
6. Return `{ allowed: count <= 5, remaining: max(0, 5 - count), resetAt }`

### 4.4 Frontend — `usageCap.ts` replacement

Replace the current localStorage implementation with a server-side check:

```ts
export async function consumeAnalysis(symbol: string): Promise<UsageResult> {
  const res = await fetch('/api/consume-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol }),
  })
  return res.json() // { allowed, remaining, resetAt }
}
```

Remove all existing localStorage-based quota logic from `usageCap.ts`.

### 4.5 Canvas page flow

```
User lands on /canvas?symbol=TCS
  → middleware: authenticated? → yes, proceed
  → canvas mounts, calls consumeAnalysis('TCS.NS')
    → allowed: true  → fetch /snapshot/TCS.NS → render full node graph
    → allowed: false → render cap gate overlay (see §5.2)
  → anonymous user lands on / with ?gate=canvas&symbol=TCS
    → show sign-in gate immediately (see §5.1)
```

---

## 5. Gate UI Components

> **Design system:** Dark fintech. `#0F172A` bg, `#F59E0B` amber accent, Inter font.  
> All icons from **Lucide React** — no emojis as structural icons.  
> All interactive overlays use **Radix `<Dialog>`** for built-in focus trap + ESC dismiss.

### 5.1 Sign-in Gate (anonymous user)

Shown when an unauthenticated visitor attempts canvas access.

**Layout:** Frosted glass card centred over blurred node graph placeholder. Verdict strip (BUY badge + price) pinned above the blur — always visible, even unauthenticated.

**Frosted glass card spec:**
- `background: rgba(13,15,26,0.80)` + `backdrop-filter: blur(12px)` with `@supports` fallback to `background: rgba(13,15,26,0.97)`
- `border: 1px solid rgba(255,255,255,0.08)` / `border-radius: 16px`
- `box-shadow: 0 8px 32px rgba(0,0,0,0.7)`
- Entrance animation: `scale(0.95)→1` + `opacity 0→1`, 200ms ease-out. Wrapped in `@media (prefers-reduced-motion: reduce) { animation: none }`

**Card contents:**
```
[Lock icon — Lucide Lock, 20px, amber-400, aria-hidden]
"Unlock full analysis"          ← id="gate-title", 13px 700
"6 indicators · AI synthesis · price targets"  ← id="gate-desc", 12px slate-400
[Sign in free → ]               ← amber CTA, min-h-[44px], full width
"5 analyses / week · no credit card"  ← 12px slate-500
```

**Accessibility:**
- Outer container: `role="dialog" aria-modal="true" aria-labelledby="gate-title" aria-describedby="gate-desc"`
- Use `<Dialog>` from Radix for automatic focus trap and ESC support
- On open, focus moves to the primary CTA button
- Sign-in CTA: loading state while magic link sends → "Check your inbox ✓" on success

**Sign-in flow:** Clicking the CTA opens the existing `<SignInModal>`. After successful magic link auth, redirect back to the original canvas URL.

### 5.2 Cap Gate (free user, 5/5 used)

Shown when `consumeAnalysis` returns `allowed: false`.

**Layout:** Same frosted glass card over blurred canvas, verdict strip still visible.

**Card contents:**
```
[CalendarDays icon — Lucide, 20px, slate-400, aria-hidden]
"You've used 5 / 5 this week"   ← 13px 700
"Resets Monday 12:00 AM IST"    ← 12px slate-400

[Countdown block]               ← dark surface card inside gate card
  "Next reset in"               ← 12px slate-500
  "2d 14h 32m"                  ← 18px 800, font-variant-numeric: tabular-nums
  aria-live="polite" on the countdown container

[Usage pip dots]
  role="progressbar"
  aria-valuenow={5} aria-valuemax={5}
  aria-label="5 of 5 analyses used this week"
  5 × amber-400 filled dots, 22×6px each, gap-1

[Go unlimited — ₹299/mo]        ← amber CTA, min-h-[44px], full width
[Remind me on Monday]           ← ghost secondary, min-h-[44px], full width
```

**"Remind me on Monday":** Calls the existing Supabase user preferences to set a `remind_cap_reset` flag — triggers a Monday morning push/email notification. If notifications aren't built yet: store in `localStorage` and skip silently.

### 5.3 Header badge

A small pill shown in the top-right header, right of the user avatar:

| State | Label | Style |
|---|---|---|
| Anonymous | (none) | — |
| Free, analyses remaining | `Free · N left` | slate border |
| Free, cap reached | `Free · Resets Mon` | amber border |
| Pro | `Pro` | green filled |
| Super Admin | `Admin` | purple filled |

---

## 6. Super Admin

**Mechanism:** `SUPER_ADMIN_EMAIL` environment variable (Vercel + Railway both).

**Behaviour:**
- Middleware allows `/admin` only when `session.user.email === SUPER_ADMIN_EMAIL`
- `consume-analysis` route skips the cap check
- `getUser()` in `auth.ts` returns `{ ...user, isAdmin: true }` when email matches
- Header shows purple "Admin" badge

**Security notes:**
- The env var is never exposed to the client bundle (no `NEXT_PUBLIC_` prefix)
- Admin check is server-side only (middleware + API route)
- Only one super admin — no admin management UI needed at this stage

---

## 7. What Is NOT in scope

- Google/GitHub OAuth (magic link only for launch)
- Admin user management panel (env-var approach is sufficient)
- Push notifications for "Remind me Monday" (localStorage flag now, notification later)
- Stripe/Razorpay changes (existing `<ProUpgradeGate>` component used as-is)
- Rate limiting on the `/snapshot` API endpoint itself (cap is frontend-enforced by `consume-analysis`)

---

## 8. UX Review Findings (from UI/UX Pro Max audit)

All findings incorporated into the spec above. Summary for implementers:

| # | Finding | Fix | Section |
|---|---|---|---|
| 1 | Emoji icons → Lucide SVGs | Lock, CalendarDays, Zap | §5.1, §5.2 |
| 2 | Gate card missing ARIA dialog | `role="dialog"`, `aria-modal`, Radix Dialog | §5.1, §5.2 |
| 3 | Button height <44px | `min-h-[44px]` on all gate buttons | §5.1, §5.2 |
| 4 | Pip dots inaccessible | `role="progressbar"` + aria attrs | §5.2 |
| 5 | Helper text <12px | Minimum 12px on all gate text | §5.1, §5.2 |
| 6 | No loading state on sign-in | Spinner → "Check your inbox ✓" | §5.1 |
| 7 | No `backdrop-filter` fallback | `@supports` with opaque fallback | §5.1, §5.2 |
| 8 | No gate entrance animation | scale+fade 200ms + reduced-motion | §5.1, §5.2 |

---

## 9. Files to create / modify

| File | Action | Notes |
|---|---|---|
| `web/src/middleware.ts` | Create | Route protection, admin guard |
| `web/src/app/api/consume-analysis/route.ts` | Create | Weekly cap server-side check |
| `web/src/lib/usageCap.ts` | Rewrite | Replace localStorage with server call |
| `web/src/components/gates/SignInGate.tsx` | Create | Frosted glass sign-in overlay |
| `web/src/components/gates/CapGate.tsx` | Create | Frosted glass cap overlay with countdown |
| `web/src/components/HeaderBadge.tsx` | Create | Free/Pro/Admin pill |
| `web/src/app/canvas/page.tsx` | Modify | Integrate `consumeAnalysis` + gate components |
| `web/src/lib/auth.ts` | Modify | Add `isAdmin` to user shape |
| Supabase — `weekly_usage` table | Migrate | SQL in §4.1 |
| `.env.local` / Vercel / Railway | Update | Add `SUPER_ADMIN_EMAIL` |

---

## 10. Success criteria

- Anonymous visitor on `/canvas?symbol=TCS` sees the sign-in gate; verdict strip visible
- Free user who has used 5 analyses sees the cap gate with live countdown
- Pro user has no gate shown
- Super admin (`SUPER_ADMIN_EMAIL`) bypasses all gates and can navigate to `/admin`
- Weekly usage resets automatically Monday midnight IST (server-side, not client-side)
- All gates pass WCAG AA: focus trap, keyboard navigation, ARIA labels, 4.5:1 contrast
- All gate buttons ≥44px height on mobile
