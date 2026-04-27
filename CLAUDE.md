# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MarketMithra** — an Indian stock market analytics platform that generates BUY/HOLD/SELL signals for Nifty 50 stocks. Six technical indicators (Relative Strength, NSE delivery %, EMA stack, momentum, VWAP, AI news sentiment) are fused via a weighted sigmoid into a probability, then Claude Haiku explains the verdict in plain English.

## Commands

### Backend (FastAPI)
```bash
cd api
python -m venv .venv && .venv/Scripts/activate
pip install -r requirements.txt
uvicorn main:app --reload        # http://127.0.0.1:8000
```

### Frontend (Next.js)
```bash
cd web
npm install
npm run dev                      # http://127.0.0.1:3000
npm run build
npm run lint                     # ESLint + TypeScript
```

Copy `web/.env.local.example` to `web/.env.local` and fill in Supabase, Stripe, and API base URL. See `SUPABASE_SETUP.md` for full third-party setup (schema SQL, auth config, Stripe webhooks).

> **Warning (from AGENTS.md):** Next.js v16 has breaking changes. Before touching the frontend, read the relevant docs inside `web/node_modules/next/` rather than relying on training data.

## Architecture

```
web/  (Next.js 16, React 19, TypeScript, TailwindCSS 4, Zustand)
api/  (FastAPI + uvicorn, Python 3, yfinance, Anthropic SDK)
```

### Data flow for a single stock analysis
1. Frontend calls `GET /snapshot/{symbol}` (e.g. `TCS.NS`)
2. `api/main.py → build_snapshot()` fetches 1-year daily candles via **yfinance** and computes all six indicators
3. Scores (each ∈ [-1, +1]) are fused: weighted sum → sigmoid → probability ∈ [0, 1] → verdict
4. `api/services/ai/synthesis.py` calls Claude Haiku for a 2–3 sentence explanation + bull/bear/risk + price targets
5. Full `StockSnapshot` JSON returned; frontend renders it as a ReactFlow node graph

### Backend key files
| File | Responsibility |
|---|---|
| `api/main.py` | FastAPI routing only — imports from service packages below |
| `api/services/data/` | NSE bhavcopy CSV fetcher → delivery %, OHLCV cache (TechAgent) |
| `api/services/ai/` | Claude Haiku news sentiment + synthesis, cost tracking (TechAgent) |
| `api/services/core/indicators.py` | EMA, VWAP, RS, momentum — pure indicator math (TechAgent) |
| `api/services/core/fusion.py` | FUSION_WEIGHTS + fuse_scores() — owned by FinanceAgent |

### Frontend key files
| File | Responsibility |
|---|---|
| `web/src/app/canvas/page.tsx` | Interactive signal-flow page (main product view) |
| `web/src/components/CanvasMain.tsx` | ReactFlow graph container, wires nodes together |
| `web/src/components/nodes/*.tsx` | 8 indicator node types (PriceNode, EmaStackNode, DeliveryNode, …) |
| `web/src/lib/api.ts` | Typed fetch wrappers for backend endpoints |
| `web/src/lib/types.ts` | Shared TypeScript interfaces (`StockSnapshot`, `Verdict`, etc.) |
| `web/src/lib/usageCap.ts` | Free-tier 5 analyses/day rate limiting |

### Critical implementation details

**Thread-local yfinance sessions** — `curl_cffi` requires one session per OS thread. `main.py` uses `threading.local()` to avoid session corruption under concurrent requests.

**NSE Bhavcopy cache** — In-RAM DataFrame keyed by date; avoids repeated disk reads across 49 stocks × 60-day lookback.

**AI cost controls** — Both `ai_news.py` and `ai_synthesis.py` check `AI_NEWS_DAILY_CAP` (default 100 calls/day). Disk-persisted JSON caches use 12 h TTL on success, 15 min on failure (self-healing transient errors).

**Sigmoid fusion** — `services/core/fusion.py` fuses six weighted scores into a probability via `fuse_scores()`. Verdict thresholds: ≥0.60 → BUY, 0.40–0.60 → HOLD, ≤0.40 → SELL. `FUSION_WEIGHTS` owned by FinanceAgent.

**Embed vs. main app** — `/embed/{symbol}` allows all-origin iframes (CSP configured in `next.config.ts`). The main app sets `X-Frame-Options: DENY`.

**Background refresh** — `_bg_refresh_ranked()` runs in a daemon thread, recomputing the top-N ranked list every 30 minutes without blocking FastAPI request handling.

## Deployment

- **API** → Railway (`api/railway.toml`; start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`)
- **Web** → Vercel (zero-config Next.js)

## Agent Roles

Three Claude Code session roles. Each has its own CLAUDE.md with detailed rules.

| Agent | Home | KPI | CLAUDE.md |
|---|---|---|---|
| 📊 FinanceAgent | `docs/finance/` | Signal accuracy >65% | `docs/finance/CLAUDE.md` |
| ⚙️ TechAgent | `api/` | API reliability + P95 latency | `api/CLAUDE.md` |
| 🌐 FrontendAgent | `web/` | UX clarity + Core Web Vitals | `web/CLAUDE.md` |

**Session end rule (all agents):** Save key decisions and discoveries to claude-mem under project "MaddyFlow" before closing the session.

**Graduation path:** When a second developer joins, TechAgent splits into DataAgent (`api/services/data/`), AIAgent (`api/services/ai/`), and ComputeAgent (`api/services/core/`). Folder structure already supports this.
