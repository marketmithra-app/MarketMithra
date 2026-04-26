# MarketMithra — Agent Team + Microservices Architecture

**Date:** 2026-04-26
**Status:** Approved — ready for implementation planning
**Replaces:** monolithic `api/main.py` (2000+ lines, all concerns tangled)

---

## Context

MarketMithra is a solo-developer product. The current backend is a single FastAPI app deployed on Railway. It works, but every change to the NSE data layer requires redeploying the entire API. AI cost controls and indicator math are tangled in the same file. There is no formal ownership model — any session can touch anything.

This design introduces two things simultaneously:
1. **Module boundaries** — separate Python packages per concern, enforced by convention
2. **Agent roles** — Claude Code sessions operate under a named agent with a focused CLAUDE.md

The migration is a strangler fig: clean up boundaries first, extract to HTTP services only when there is a clear operational reason. Features keep shipping throughout.

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Migration strategy | Strangle as you go | Live product; can't pause features for a big-bang rewrite |
| Service isolation timeline | Module-first (Sprint 1), HTTP-later (Sprint 2+) | Extract clean code, not messy code |
| Number of agents | 3 now (FinanceAgent, TechAgent, FrontendAgent) | One developer; 5-agent model adds switching overhead without benefit |
| Internal comms (Sprint 1) | Python function calls via `__init__.py` | No latency added; same process |
| Internal comms (Sprint 2+) | HTTP (Railway private networking) | data-service gets independent deploy + cache |
| Repo structure | Monorepo (api/ + web/ together) | Polyrepo is a multi-team pattern; revisit at team scale |
| Shared agent memory | claude-mem under project "MaddyFlow" | Every session logs decisions; no agent starts cold |

---

## Folder Structure (post-Sprint 1)

```
api/
├── services/
│   ├── data/                    # DataAgent home (owned by TechAgent for now)
│   │   ├── __init__.py          # public interface — only thing main.py imports
│   │   ├── nse_client.py        # curl_cffi session + NSE cookie bootstrap
│   │   ├── bhavcopy.py          # moved from api/bhavcopy.py
│   │   ├── ohlcv.py             # get_nse_ohlcv(), index archive fetch
│   │   ├── CLAUDE.md            # DataAgent rules (used when TechAgent focuses here)
│   │   └── tests/
│   ├── ai/                      # AIAgent home (owned by TechAgent for now)
│   │   ├── __init__.py          # public interface
│   │   ├── news.py              # moved from api/ai_news.py
│   │   ├── synthesis.py         # moved from api/ai_synthesis.py
│   │   ├── cost_tracker.py      # daily cap, usage log (extracted from news.py)
│   │   ├── CLAUDE.md            # AIAgent rules
│   │   └── tests/
│   └── core/                    # ComputeAgent home (owned by TechAgent for now)
│       ├── __init__.py          # public interface
│       ├── indicators.py        # EMA, VWAP, RS, momentum — extracted from main.py
│       ├── fusion.py            # weighted sigmoid, verdict thresholds
│       ├── screener.py          # /screener endpoint logic
│       ├── CLAUDE.md            # ComputeAgent rules
│       └── tests/
├── clients/                     # HTTP client wrappers (Sprint 2 only — empty until then)
│   └── data_client.py           # same interface as services/data/__init__.py, over HTTP
├── jobs/                        # Cron jobs (Sprint 3)
│   └── refresh_ranked.py        # replaces daemon thread
├── main.py                      # FastAPI routing only (~300 lines after Sprint 1)
├── requirements.txt
└── railway.toml

docs/
└── finance/                     # FinanceAgent home
    ├── CLAUDE.md                # FinanceAgent rules + Indian market domain knowledge
    ├── accuracy-log.md          # weekly signal accuracy audit results
    ├── weight-history.md        # fusion weight changes + rationale
    └── market-notes.md          # domain observations

web/                             # FrontendAgent home — unchanged structure
└── CLAUDE.md                    # FrontendAgent rules
```

---

## Public Interfaces

The rule: **`main.py` imports only from `__init__.py` files. No cross-service imports.**
This is a convention constraint, not a technical one. CI lint check will enforce it.

```python
# services/data/__init__.py
def get_ohlcv(symbol: str, n_days: int = 390) -> pd.DataFrame: ...
def get_delivery(symbol: str) -> pd.Series: ...

# services/ai/__init__.py
def get_news_sentiment(symbol: str) -> dict: ...
def get_synthesis(symbol: str, snapshot: dict) -> dict: ...

# services/core/__init__.py
def compute_indicators(df: pd.DataFrame, delivery: pd.Series) -> dict: ...
def fuse_scores(scores: dict) -> Verdict: ...
```

When data-service moves to HTTP in Sprint 2, `clients/data_client.py` exposes the same two functions. The import line in `main.py` is the only change.

---

## Agent Roster

### 📊 FinanceAgent — Domain Overseer

**Home:** `docs/finance/`
**KPI:** Signal accuracy — % of BUY verdicts where price was higher 5 days later; % of SELL verdicts where price was lower. Random baseline is ~50%. Target: >65% (15 percentage points above random).
**Writes to:** `services/core/fusion.py` (weight recalibration), `docs/finance/` (logs)
**Read access:** all services' outputs, Supabase `verdicts` table

**Responsibilities:**
- Review indicator implementations for financial correctness (EMA, VWAP, RS, delivery %)
- Calibrate fusion weights when accuracy drops below threshold
- Audit AI synthesis text for claims inconsistent with the actual scores
- Run weekly accuracy audit: pull `verdicts` from 5 days ago → compare vs actual NSE close → append to `accuracy-log.md`
- Review any new indicator or AI feature for market correctness before it ships

**Domain knowledge baked into CLAUDE.md:**
NSE/BSE market structure and hours, delivery % significance (cash vs F&O influence), EMA crossover interpretation, VWAP deviation meaning, Nifty 50 relative strength basis, momentum decay patterns, circuit breaker and trading halt awareness, Indian market sentiment cycles, sigmoid fusion weight rationale, BUY/HOLD/SELL threshold calibration.

---

### ⚙️ TechAgent — All Backend

**Home:** `api/`
**KPI:** API reliability (uptime) + response time (P95 < 5s for cached, < 35s cold)
**Writes to:** all of `api/` — data, ai, core services + main.py + deployment config
**Does not touch:** `web/`, the weight values inside `services/core/fusion.py` (calibration is FinanceAgent's call)

**Responsibilities:**
- NSE data fetching reliability (bhavcopy, index archive, curl_cffi sessions)
- Indicator math correctness (implementation, not calibration — that's FinanceAgent)
- Claude Haiku integration, prompt management, cost cap enforcement
- FastAPI routing, caching strategy, background refresh
- Railway deployment configuration

---

### 🌐 FrontendAgent — Web Only

**Home:** `web/`
**KPI:** UX clarity + Core Web Vitals (LCP < 2.5s, CLS < 0.1)
**Writes to:** all of `web/` — components, pages, hooks, styles
**Does not touch:** `api/`, `docs/`

**Responsibilities:**
- Canvas, signals, landing, admin, auth, payments UI
- Reading API contract from `web/src/lib/types.ts` — never assumes backend shape
- Never adds backend logic; calls core-service only via `web/src/lib/api.ts`

**Graduation path:** When a second developer joins, FrontendAgent becomes their primary role. TechAgent splits into DataAgent + AIAgent + ComputeAgent. Folder structure already supports this.

---

## FinanceAgent Accuracy Tracking (Sprint 1)

Accuracy auditing requires persistence. Current `/snapshot` is stateless.

**Supabase table: `verdicts`**
```sql
create table verdicts (
  id          uuid primary key default gen_random_uuid(),
  symbol      text not null,
  verdict     text not null,           -- 'BUY' | 'HOLD' | 'SELL'
  probability float not null,
  scores      jsonb not null,          -- all 6 indicator scores
  created_at  timestamptz default now()
);
```

**Weekly accuracy script** (`docs/finance/scripts/accuracy_audit.py`):
1. Pull verdicts from 5–6 trading days ago
2. Fetch actual close price for those symbols on that date via NSE data
3. Compare: BUY accuracy = % where close[+5d] > close[verdict_date]; SELL accuracy = % where close[+5d] < close[verdict_date]
4. Append result row to `accuracy-log.md`
5. Alert (log warning) if accuracy < 55% for either direction (significantly below the 65% target; at or below random baseline is a signal quality regression)

---

## Data Flow Evolution

### Sprint 1 — One process, clean imports

```
web (Vercel) → HTTPS → Railway (one app)
                         main.py
                           ├── services.data.get_ohlcv()    # Python call
                           ├── services.ai.get_synthesis()  # Python call
                           └── services.core.fuse_scores()  # Python call
```

### Sprint 2 — data-service extracted

**Prerequisite:** bhavcopy cache pre-warmed at startup for all 50 symbols. Cold /snapshot must not wait on a cold data-service.

```
web (Vercel) → HTTPS → Railway core-service
                         main.py
                           ├── clients.data_client.get_ohlcv()  # HTTP → data-service
                           └── services.ai + services.core      # still in-process

                       Railway data-service (new)
                         services/data/ as standalone FastAPI
```

Only change in `main.py`: one import line. Zero other changes.

### Sprint 3 — ai-service extracted + cron upgrade

```
web (Vercel) → HTTPS → Railway core-service
                         main.py
                           ├── clients.data_client   # HTTP → data-service
                           └── clients.ai_client     # HTTP → ai-service

                       Railway data-service
                       Railway ai-service
                       Railway cron (ComputeAgent refresh — replaces daemon thread)
```

---

## Error Handling

| Failure | Behaviour |
|---|---|
| data-service down (Sprint 2+) | core-service returns cached snapshot (up to 30 min stale); web shows "Data from cache" badge |
| ai-service down (Sprint 3+) | core-service returns snapshot with AI fields as null; web renders verdict without synthesis; signal still works |
| core-service down | Web shows `ApiErrorState` with auto-retry countdown (already built) |
| NSE data stale > 90 min | ComputeAgent cron logs warning; `/api/refresh-status` endpoint reflects staleness |

---

## Sprint Roadmap

### Immediate (before any architecture work)
Fix Railway → Vercel canvas/panic-o-meter data loading. Live outage — users can't see data. Likely CORS misconfiguration or missing `NEXT_PUBLIC_API_BASE` on Vercel.

### Sprint 1
1. Reorganise `api/` into `services/data/`, `services/ai/`, `services/core/` packages
2. Write service-level `CLAUDE.md` files for each folder
3. Write `docs/finance/CLAUDE.md` (FinanceAgent rules + domain knowledge)
4. Update `web/CLAUDE.md` (FrontendAgent rules)
5. Update root `CLAUDE.md` to reference agent roles + mandate claude-mem save at session end
6. Create Supabase `verdicts` table; instrument `/snapshot` to log each call
7. Write `docs/finance/scripts/accuracy_audit.py`
8. Run first accuracy audit baseline (note: meaningful data requires 5+ trading days post-deploy; first run will be a structural smoke test only)

### Sprint 2
1. Pre-warm bhavcopy cache at startup for all 50 Nifty symbols (background task on boot)
2. Extract `services/data/` to standalone FastAPI service on Railway
3. Add `api/clients/data_client.py` with identical interface to `services/data/__init__.py`
4. Update single import in `main.py`; verify zero other changes needed
5. Smoke test end-to-end; confirm P95 latency unchanged

### Sprint 3
1. Extract `services/ai/` to standalone Railway service
2. Add `api/clients/ai_client.py`
3. Replace daemon thread with Railway cron job (`jobs/refresh_ranked.py`)
4. Add `/api/refresh-status` endpoint
5. Evaluate Claude Agent SDK for autonomous service agents — build only if there is a concrete use case by this point

---

## Future (not in scope)

- **Polyrepo:** Separate GitHub repos per service. Revisit when a second developer joins or when services need independent versioning.
- **Claude Agent SDK (Layer C):** Autonomous agents that call service HTTP endpoints given a plain-English task. Design once HTTP contracts are stable and tested. One-line placeholder: `agent/{name}_agent.py`.
- **5-agent model:** DataAgent, AIAgent, ComputeAgent as distinct roles. Revisit when TechAgent sessions become too broad to hold in context.

---

## Constraints

- **No cross-service imports** — `services/data/` must not import from `services/ai/` or `services/core/` and vice versa. Only `main.py` composes services. Enforced by lint check added to CI.
- **Interface stability** — changing a function signature in any `__init__.py` requires updating all callers in the same PR.
- **FinanceAgent write boundary** — only `fusion.py` weight values and `docs/finance/`. Never rewrites indicator implementations.
- **claude-mem save** — every Claude Code session ends with a mem-save observation under project "MaddyFlow". Mandated in root `CLAUDE.md`.
