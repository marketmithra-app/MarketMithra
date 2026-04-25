# MarketMithra — third-party service setup

Everything runs without Supabase or Stripe in local dev.  All routes degrade
gracefully.  The sections below unlock the production features.

---

## 1. Supabase (auth + community votes + pro subscribers)

### 1a. Create project

1. https://supabase.com → New project (free tier is fine).
2. Note the **Project URL** and **anon public** key from
   *Settings → API*.
3. Note the **service_role** key from the same page — never put this in
   client-side code or `NEXT_PUBLIC_*` vars.

### 1b. Apply schema

Supabase Dashboard → SQL Editor → paste the whole file at
`api/sql/schema.sql` and run it.

Tables created:
| Table | Purpose |
|---|---|
| `profiles` | user display names (future) |
| `judgements` | BUY/HOLD/SELL votes + agree/disagree, append-only |
| `judgement_tally` | public aggregate view (no PII) |
| `waitlist` | landing-page email signups |
| `pro_subscribers` | Stripe checkout completions |

### 1c. Enable magic-link email

Supabase Dashboard → Authentication → Providers → Email:
- **Enable email provider** ✓
- **Confirm email** — leave disabled (we use OTP one-click links)
- **Secure email change** — up to you

### 1d. Add env vars

`web/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   ← server-side only, never NEXT_PUBLIC_
```

### 1e. Verify

```bash
# Cast a vote in the canvas → row appears in public.judgements
select * from public.judgement_tally;

# Sign in via magic link → row appears in auth.users
select id, email from auth.users limit 5;
```

---

## 2. Stripe (Pro subscriptions — ₹299/month · ₹2,499/year)

### 2a. Create account & products

1. https://dashboard.stripe.com
2. Products → Add product → **MarketMithra Pro**
   - Add price 1: **₹299 INR / month** (Recurring) → copy `price_...` ID
   - Add price 2: **₹2,499 INR / year** (Recurring) → copy `price_...` ID

### 2b. Add webhook endpoint

Stripe Dashboard → Developers → Webhooks → Add endpoint:
- **URL**: `https://marketmithra.app/api/webhook`
- **Events**: `checkout.session.completed`, `customer.subscription.deleted`
- Copy the **signing secret** (`whsec_...`)

For local testing, install the Stripe CLI and forward:
```bash
stripe listen --forward-to localhost:3000/api/webhook
```

### 2c. Add env vars

`web/.env.local`:
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_MONTHLY_PRICE_ID=price_...
STRIPE_ANNUAL_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 2d. Pro flow end-to-end

1. User clicks **Upgrade to Pro** in the canvas sidebar.
2. Frontend `POST /api/checkout` with `{ plan, anonId }`.
3. API creates a Stripe Checkout session, returns `{ url }`.
4. User completes checkout → redirected to `/pro-success?session_id=...`.
5. `/pro-success` calls `GET /api/verify-pro?session_id=...` → sets `mm_pro=1` in localStorage.
6. Simultaneously, Stripe fires `checkout.session.completed` webhook.
7. `POST /api/webhook` upserts a row in `public.pro_subscribers` (service_role key bypasses RLS).
8. On next sign-in, `getUser()` checks `pro_subscribers` and syncs the `mm_pro` flag.

---

## 3. Deployment

### API → Railway

```bash
# install Railway CLI
npm install -g @railway/cli
railway login

cd api
railway init        # link or create project
railway up          # deploys via Procfile / railway.toml
```

Add env vars in Railway dashboard:
- `ANTHROPIC_API_KEY`
- `AI_NEWS_DAILY_CAP=200`

Update `web/.env.local` (or Vercel env):
```
NEXT_PUBLIC_API_BASE=https://your-project.railway.app
```

### Frontend → Vercel

```bash
npm install -g vercel
cd web
vercel --prod
```

Add all `web/.env.local.example` vars in the Vercel project dashboard
(*Settings → Environment Variables*).

**Important**: the Stripe webhook endpoint must use the live Vercel URL, and
`STRIPE_WEBHOOK_SECRET` must match the endpoint's signing secret.

---

## 4. Post-deploy checklist

- [ ] `/health` on Railway returns `{"status":"ok"}`
- [ ] Landing page loads in < 2 s on Vercel
- [ ] `/canvas?symbol=TCS.NS` shows live signal
- [ ] Magic-link email arrives within 60 s
- [ ] Stripe test checkout succeeds → `mm_pro=1` set in localStorage
- [ ] `pro_subscribers` row created in Supabase
- [ ] Stripe webhook dashboard shows `200 OK` on `checkout.session.completed`
