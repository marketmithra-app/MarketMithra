# AI News Tuning — Implementation Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the AI News indicator from a thin sentiment score into a rich, actionable intelligence layer — adding richer output schema, sentiment velocity, Signal-News conflict detection, and BSE corporate announcements as a lazy-loaded overlay.

**Architecture:** Four coordinated changes across backend and frontend. The prompt upgrade and velocity tracking are self-contained in `news.py`. Signal-News Conflict is computed entirely on the frontend using data already in the snapshot. BSE Announcements is a new independent endpoint + node — completely isolated from the main snapshot so a BSE outage never degrades the core canvas.

**Tech Stack:** Python (FastAPI, Anthropic SDK, httpx), TypeScript (Next.js 16, React, ReactFlow, TailwindCSS)

---

## File Map

| File | Change |
|---|---|
| `api/services/ai/news.py` | Rewrite prompt, expand schema, add velocity (score_history) |
| `api/services/data/announcements.py` | **NEW** — BSE scrip map + announcements fetch + Haiku summarisation |
| `api/services/data/__init__.py` | Export `get_announcements` |
| `api/main.py` | Add `GET /announcements/{symbol}` route |
| `web/src/lib/types.ts` | Expand `AiNewsResult`, add `AnnouncementsResult` |
| `web/src/lib/api.ts` | Add `fetchAnnouncements(symbol)` |
| `web/src/components/nodes/AiNewsNode.tsx` | Render new fields, conflict badge |
| `web/src/components/nodes/AnnouncementsNode.tsx` | **NEW** — BSE filings node |
| `web/src/components/CanvasMain.tsx` | Pass `fusionProbability` to AiNewsNode, wire conflict edge, add AnnouncementsNode |

---

## Section 1 — Richer News Schema (`news.py`)

### 1.1 Output contract

The Haiku prompt returns this JSON — no other keys:

```json
{
  "score": 0.72,
  "label": "Bullish",
  "summary": "Strong Q4 results and new deals drive positive outlook.",
  "whyItMatters": "Revenue beat signals margin recovery ahead of FY27 guidance.",
  "watchOut": "Global IT slowdown could pressure Q1 guidance next quarter.",
  "headlines": [
    { "title": "TCS Q4 profit beats estimates by 8%", "sentiment": "bullish", "impact": "high" },
    { "title": "Management guides cautiously for FY27", "sentiment": "bearish", "impact": "medium" }
  ],
  "trend": "improving"
}
```

Field rules:
- `score`: float in [-1.0, +1.0]; 0.0 = neutral
- `label`: one of `"Very Bullish"`, `"Bullish"`, `"Neutral"`, `"Bearish"`, `"Very Bearish"`
- `summary`: ≤ 25 words, dominant sentiment in one sentence
- `whyItMatters`: ≤ 20 words, why this moves the stock price
- `watchOut`: ≤ 20 words, the bear case or key risk in the news
- `headlines`: top 3 only (not 5); each has `title` (string), `sentiment` (`"bullish"` | `"bearish"` | `"neutral"`), `impact` (`"high"` | `"medium"` | `"low"`)
- `trend`: `"improving"` | `"stable"` | `"deteriorating"` — computed locally, NOT by Haiku (see §1.2)

### 1.2 Velocity (`trend`) computation

Cache structure gains a `score_history` list stored alongside each result. This list holds up to 4 `(date_str, score)` tuples ordered oldest → newest.

On every successful Haiku call:
1. Load existing `score_history` from cache (empty list if first call)
2. Append `(today_iso, new_score)`
3. Trim to last 4 entries
4. Save back to cache

Trend derivation from last 3 history entries (requires ≥ 3 entries; otherwise `"stable"`):
- All 3 scores strictly increasing → `"improving"`
- All 3 scores strictly decreasing → `"deteriorating"`
- Otherwise → `"stable"`

**In-memory `_CACHE` type change:** The dict type annotation updates from `dict[str, tuple[float, dict]]` to `dict[str, tuple[float, dict, list]]` — a 3-tuple `(ts, result, score_history)`. Every read of `_CACHE[sym]` must unpack all three. The `_load_from_disk()` function must use `entry.get("score_history", [])` to default missing history on old cache entries (migration safety).

Cache disk format gains `score_history` key per symbol:
```json
{
  "cache": {
    "TCS.NS": {
      "ts": 1714320000,
      "result": { ... },
      "score_history": [["2026-04-27", 0.31], ["2026-04-28", 0.52], ["2026-04-29", 0.72]]
    }
  },
  "spend": { ... }
}
```

### 1.3 Prompt rewrite

`max_tokens` increases from 150 → 400. Updated prompt:

```
You are a financial news analyst covering Indian equities (NSE/BSE).
Analyse the following recent headlines for {sym} and return a JSON object with EXACTLY these keys:

- "score": float from -1.0 (very bearish) to +1.0 (very bullish), 0.0 = neutral
- "label": one of "Very Bullish", "Bullish", "Neutral", "Bearish", "Very Bearish"
- "summary": ≤ 25 words — dominant sentiment and why
- "whyItMatters": ≤ 20 words — one sentence on why this moves the stock price
- "watchOut": ≤ 20 words — the bear case or key risk in this news
- "headlines": array of the top 3 most impactful headlines, each with:
    "title" (string), "sentiment" ("bullish"|"bearish"|"neutral"), "impact" ("high"|"medium"|"low")

Headlines:
{bullet_list}

Respond ONLY with the JSON object. No explanation outside the JSON.
```

### 1.4 `_neutral()` fallback update

The neutral fallback gains the new fields with safe defaults:
```python
def _neutral(reason: str = "no news data") -> dict:
    return {
        "score": 0.0,
        "label": "Neutral",
        "summary": reason,
        "whyItMatters": "",
        "watchOut": "",
        "headlines": [],
        "trend": "stable",
        "source": "fallback",
    }
```

### 1.5 Parse defence

After JSON parsing, extract with `.get()` defaults for every new field so old cached entries don't crash:
```python
why_it_matters = str(parsed.get("whyItMatters", ""))
watch_out = str(parsed.get("watchOut", ""))
raw_headlines = parsed.get("headlines", [])
headlines = [
    {
        "title": str(h.get("title", "")),
        "sentiment": h.get("sentiment", "neutral"),
        "impact": h.get("impact", "medium"),
    }
    for h in raw_headlines[:3]
    if isinstance(h, dict)
]
```

---

## Section 2 — BSE Announcements (`announcements.py`)

### 2.1 Static NSE → BSE scrip code map

All 50 Nifty 50 symbols mapped to their 6-digit BSE codes. Hardcoded dict — these codes are permanent identifiers and almost never change. Unknown symbols return `[]` gracefully.

Example entries:
```python
NSE_TO_BSE: dict[str, str] = {
    "TCS.NS":        "532540",
    "RELIANCE.NS":   "500325",
    "HDFCBANK.NS":   "500180",
    "INFY.NS":       "500209",
    # ... all 50 Nifty stocks
}
```

### 2.2 BSE API call

Endpoint: `https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w`

Query params: `pageno=1`, `category=-1`, `subcategory=-1`, `scripcode={bse_code}`, `strdate=`, `enddate=`, `annexure=0`

Headers required to avoid 403:
```python
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://www.bseindia.com/",
    "Accept": "application/json",
}
```

Uses `httpx` with a 10s timeout. **Dependency check required:** verify `httpx` is in `api/requirements.txt`; add `httpx>=0.27` if missing. Fallback on any exception returns `[]`.

Meaningful categories to keep (filter out the rest):
`{"Results", "Dividend", "Board Meeting", "Buyback", "Rights Issue", "Bonus Issue", "QIP", "Merger/Amalgamation", "Scheme of Arrangement"}`

*Finance Agent review: Dropped `AGM`, `EGM`, `Allotment` (procedural/duplicate coverage, crowd out high-signal items). Added `Merger/Amalgamation` / `Scheme of Arrangement` — M&A is among the highest-impact events for retail traders and was missing. Check the BSE API's exact category string for M&A when implementing.*

Fetch last 10 announcements, filter to meaningful categories, keep top 5.

### 2.3 Haiku summarisation (one call for all announcements)

Send all 5 announcement titles in a single Haiku call:

```
You are a financial analyst for Indian retail investors.
Translate each BSE corporate announcement into a plain-English one-liner (≤ 15 words)
and rate its impact as "high", "medium", or "low".

Announcements for {symbol}:
1. [date] [category] — [title]
2. ...

Return a JSON array with one object per announcement:
[{"plainEnglish": "...", "impact": "high|medium|low"}, ...]

Respond ONLY with the JSON array.
```

`max_tokens`: 300. Merged with announcement metadata to produce the final response.

### 2.4 Cache and fallback

- Cache TTL: 6 hours (announcements update infrequently)
- Cache key: symbol string
- Stored in a separate `_ANN_CACHE` dict and `ann_cache.json` file in the same `.cache/` directory
- On BSE API error (timeout, 403, parse failure): return `[]` and cache the empty result for 30 minutes
- Haiku summarisation failure: return announcements with `plainEnglish: title` (raw title as fallback) and `impact: "medium"`

### 2.5 Response shape

```python
# get_announcements(symbol) -> list[dict]
[
    {
        "date": "2026-04-28",          # ISO date string
        "category": "Dividend",
        "title": "Interim Dividend declared for FY26",
        "plainEnglish": "Board approved ₹2.50 per share interim dividend.",
        "impact": "high",
    },
    ...  # up to 5 entries, empty list if none / BSE down
]
```

### 2.6 `api/services/data/__init__.py`

Add export:
```python
from services.data.announcements import get_announcements
__all__ = [..., "get_announcements"]
```

### 2.7 `api/main.py` — new route

```python
@app.get("/announcements/{symbol}")
async def announcements_endpoint(symbol: str):
    return {"symbol": symbol.upper(), "announcements": get_announcements(symbol.upper())}
```

No auth required — read-only public data.

---

## Section 3 — TypeScript Types (`types.ts`)

### 3.1 Updated `AiNewsResult`

```typescript
export interface AiNewsHeadline {
  title: string;
  sentiment: "bullish" | "bearish" | "neutral";
  impact: "high" | "medium" | "low";
}

export interface AiNewsResult {
  score: number;
  label: string;
  summary: string;
  whyItMatters: string;        // NEW
  watchOut: string;             // NEW
  headlines: AiNewsHeadline[];  // CHANGED: string[] → AiNewsHeadline[]
  trend: "improving" | "stable" | "deteriorating";  // NEW
  source: "claude-haiku" | "fallback";
}
```

### 3.2 New `AnnouncementsResult`

```typescript
export interface BSEAnnouncement {
  date: string;
  category: string;
  title: string;
  plainEnglish: string;
  impact: "high" | "medium" | "low";
}

export interface AnnouncementsResult {
  symbol: string;
  announcements: BSEAnnouncement[];
}
```

---

## Section 4 — API client (`api.ts`)

Add one new function:

```typescript
export async function fetchAnnouncements(symbol: string): Promise<AnnouncementsResult> {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? "";
  const res = await fetch(`${base}/announcements/${encodeURIComponent(symbol)}`);
  if (!res.ok) return { symbol, announcements: [] };
  return res.json();
}
```

---

## Section 5 — Frontend: `AiNewsNode.tsx`

### 5.1 New prop

Node `data` object gains `fusionProbability: number` (passed from CanvasMain).

### 5.2 Conflict detection (pure function, local)

```typescript
function hasConflict(newsScore: number, fusionProbability: number): boolean {
  const technicalScore = fusionProbability * 2 - 1; // map [0,1] → [-1,1]
  return (newsScore > 0.4 && technicalScore < -0.4)
      || (newsScore < -0.4 && technicalScore > 0.4);
}
```

*Finance Agent review: Thresholds tightened to symmetric ±0.4. The original 0.3 / -0.2 pair was asymmetric and would fire on signals barely outside the HOLD band, generating false conflict alerts on transition-zone stocks. Both sides now require a clearly directional signal (Bullish score > 0.4, fusion probability < 0.30 or > 0.70) before the badge appears.*

### 5.3 New UI rows (only rendered when `!isFallback`)

**Trend badge** — sits next to the existing label badge in the header:
```
↑ Improving  (text-teal-400)
↓ Deteriorating  (text-rose-400)
→ Stable  (text-slate-400)
```

**Why it matters row:**
```
💡  <whyItMatters text>   (text-teal-300, 10px)
```

**Watch out row** (only when `watchOut` is non-empty):
```
⚠  <watchOut text>   (text-amber-300, 10px)
```

**Headlines** — each headline item gains a coloured sentiment dot (● emerald/rose/slate) and an impact tag (`HIGH` in rose-400, `MED` in slate-400, no tag for `low`).

**Conflict badge** (bottom of node, above footer, amber, only when `hasConflict` is true):
```
⚡ Conflicts with technical signal
```
Style: `bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[9px] font-semibold rounded px-2 py-0.5`

---

## Section 6 — Frontend: `CanvasMain.tsx`

### 6.1 Pass `fusionProbability` to AiNewsNode

When building the `aiNewsNode` data object, add:
```typescript
fusionProbability: snapshot.fusion.probability,
```

### 6.2 Conflict edge styling

After building the edges array, find the edge from `aiNewsNode` to `fusionNode` and conditionally override its style:

```typescript
const newsScore = snapshot.indicators.aiNews?.score ?? 0;
const prob = snapshot.fusion.probability;
const conflict = (newsScore > 0.4 && (prob * 2 - 1) < -0.4)
              || (newsScore < -0.4 && (prob * 2 - 1) > 0.4);

// In the edges array for the aiNews→fusion edge:
{
  id: "aiNews-fusion",
  source: "aiNewsNode",
  target: "fusionNode",
  style: conflict
    ? { stroke: "#f59e0b", strokeDasharray: "5,3", strokeWidth: 1.5 }
    : undefined,
  animated: conflict,
}
```

### 6.3 AnnouncementsNode wiring

After main snapshot resolves, `CanvasMain` fires a secondary `fetchAnnouncements(symbol)` call using `useEffect`. The result is stored in local state `announcements`.

The `AnnouncementsNode` is added to the nodes array below `AiNewsNode` with a fixed relative position offset. Connected to `AiNewsNode` via a non-scoring informational edge (dotted, `stroke: "#334155"`, no arrow).

If `announcements` is `null` (loading) the node shows a skeleton. If `[]` (empty / BSE down) the node shows "No recent filings."

---

## Section 7 — Frontend: `AnnouncementsNode.tsx`

A new canvas node. Width: 240px (same as other nodes). Does NOT have a `Handle` on the right (not a scoring input).

Layout:
```
┌─────────────────────────────┐
│ 📋 BSE Filings    [source]  │
├─────────────────────────────┤
│ 28 Apr · Dividend           │
│ Board approved ₹2.50/share  │   ← plainEnglish, HIGH badge
├─────────────────────────────┤
│ 22 Apr · Results            │
│ Q4 results declared         │   ← plainEnglish, no badge (low)
└─────────────────────────────┘
```

Impact colour coding:
- `high`: rose-400 badge `HIGH`
- `medium`: amber-400 badge `MED`
- `low`: no badge

Footer: `"bse · 6h cache"` in slate-600

---

## Finance Agent Review — Findings Applied

All four items reviewed. Changes applied inline to the spec above.

1. **Conflict threshold** ✅ Tightened to symmetric ±0.4. Original 0.3/-0.2 was asymmetric and too sensitive — would trigger on transition-zone stocks barely outside HOLD band.

2. **`trend` usefulness** ✅ Keep as informational badge only. Given 12h cache TTL, 3-day history may be 2 actual observations for quiet stocks. Value exists for actively traded names; `"stable"` default when < 3 entries is the correct design. Do NOT add to fusion weighting without sample-size validation per symbol.

3. **BSE categories** ✅ Dropped `AGM`, `EGM`, `Allotment` (procedural / duplicate). Added `Merger/Amalgamation` / `Scheme of Arrangement` — M&A is highest-impact for retail traders and was missing. Implementer must verify exact category string from BSE API.

4. **`aiNews` fusion weight** ✅ Stays at 0.10. Finance Agent recommends 0.15 as the ceiling for a future sprint, taking 0.05 from `volume` (weakest signal for Indian markets). Prerequisites before increasing: 60-day backtest, sentiment bias audit (mean score across Nifty 50 over 30 days should be < 0.1), and timeliness check (< 40% of cache hits older than 6h).

---

## Error Handling Summary

| Failure | Behaviour |
|---|---|
| Haiku API down (news) | Return `_neutral("AI scoring unavailable")`, cache for 15 min |
| yfinance headlines empty | Return `_neutral("no recent headlines found")` |
| BSE API 403 / timeout | Return `[]`, cache for 30 min |
| BSE Haiku summarisation fails | Return announcements with raw titles, `impact: "medium"` |
| `fetchAnnouncements` network error (frontend) | `AnnouncementsNode` shows "No recent filings" |
| `trend` history < 3 entries | `trend: "stable"` |
| Old cached `AiNewsResult` missing new fields | `.get()` defaults prevent crash; `whyItMatters: ""`, `watchOut: ""`, `trend: "stable"` |
