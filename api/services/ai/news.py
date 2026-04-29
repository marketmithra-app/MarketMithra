"""
AI News Sentiment — pulls recent headlines via yfinance and scores them
with Claude claude-haiku-4-5 for speed + cost.  Returns a score in [-1, +1]
suitable for fusion with the other indicators.

Cost controls (bootstrap budget, money comes out of a personal pocket):
  • Cache to disk — survives uvicorn reloads, 12-hour TTL on hits
  • Skip indices (^NSEI, ^BSESN) — no company headlines exist for them
  • Short negative-cache TTL — failed Claude calls retry after 15 min,
    NOT 12 h (the old bug we hit today)
  • Daily spend cap — hard stop at AI_NEWS_DAILY_CAP calls/day (default 100)
  • Per-call cost log — every successful call prints tokens + running spend
"""
from __future__ import annotations

import json
import logging
import os
import time
from datetime import date
from pathlib import Path
from threading import Lock
from typing import Any

import yfinance as yf
from anthropic import Anthropic

log = logging.getLogger(__name__)

# ── tunables ────────────────────────────────────────────────────────────────
_CACHE_DIR = Path(__file__).parent / ".cache"
_CACHE_PATH = _CACHE_DIR / "ai_news.json"
_SUCCESS_TTL = 60 * 60 * 12          # 12 hours — news doesn't move that fast
_FAILURE_TTL = 60 * 15               # 15 min — let transient errors self-heal
_DAILY_CAP = int(os.environ.get("AI_NEWS_DAILY_CAP", "100"))

# Claude Haiku 4.5 pricing (USD per token) — update if Anthropic changes rates.
_COST_INPUT_PER_TOKEN = 1.0 / 1_000_000
_COST_OUTPUT_PER_TOKEN = 5.0 / 1_000_000

# ── in-memory state (mirrors on-disk cache) ────────────────────────────────
_CACHE: dict[str, tuple[float, dict[str, Any], list]] = {}  # sym -> (ts, result, score_history)
_SPEND: dict[str, dict[str, float]] = {}               # YYYY-MM-DD -> counts
_lock = Lock()

_client: Anthropic | None = None


# ── cache persistence ───────────────────────────────────────────────────────
def _load_from_disk() -> None:
    """Populate in-memory state from disk.  Silent on missing/corrupt."""
    try:
        if not _CACHE_PATH.exists():
            return
        data = json.loads(_CACHE_PATH.read_text())
        for sym, entry in (data.get("cache") or {}).items():
            history = entry.get("score_history", [])  # migration safety
            _CACHE[sym] = (float(entry["ts"]), entry["result"], history)
        for day, counts in (data.get("spend") or {}).items():
            _SPEND[day] = counts
    except Exception as e:
        log.warning(f"ai_news cache load failed: {e}")


def _save_to_disk() -> None:
    try:
        _CACHE_DIR.mkdir(parents=True, exist_ok=True)
        payload = {
            "cache": {
                s: {"ts": ts, "result": res, "score_history": hist}
                for s, (ts, res, hist) in _CACHE.items()
            },
            "spend": _SPEND,
        }
        _CACHE_PATH.write_text(json.dumps(payload, indent=2))
    except Exception as e:
        log.warning(f"ai_news cache save failed: {e}")


_load_from_disk()


# ── velocity helper ─────────────────────────────────────────────────────────
def _compute_trend(score_history: list) -> str:
    """Derive sentiment velocity from score_history [(date_str, score), ...]."""
    if len(score_history) < 3:
        return "stable"
    last3 = [s for _, s in score_history[-3:]]
    if last3[0] < last3[1] < last3[2]:
        return "improving"
    if last3[0] > last3[1] > last3[2]:
        return "deteriorating"
    return "stable"


# ── helpers ─────────────────────────────────────────────────────────────────
def _get_client() -> Anthropic | None:
    global _client
    if _client is not None:
        return _client
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        return None
    _client = Anthropic(api_key=key)
    return _client


def _neutral(reason: str = "no news data") -> dict[str, Any]:
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


def _today() -> str:
    return date.today().isoformat()


def _cap_reached() -> bool:
    day = _SPEND.get(_today(), {})
    return int(day.get("calls", 0)) >= _DAILY_CAP


def _track_spend(input_tokens: int, output_tokens: int) -> None:
    day_key = _today()
    day = _SPEND.setdefault(day_key, {"calls": 0, "input_tokens": 0, "output_tokens": 0, "usd": 0.0})
    day["calls"] = int(day.get("calls", 0)) + 1
    day["input_tokens"] = int(day.get("input_tokens", 0)) + input_tokens
    day["output_tokens"] = int(day.get("output_tokens", 0)) + output_tokens
    day["usd"] = round(
        float(day.get("usd", 0.0))
        + input_tokens * _COST_INPUT_PER_TOKEN
        + output_tokens * _COST_OUTPUT_PER_TOKEN,
        4,
    )


def get_spend_today() -> dict[str, Any]:
    """Return today's AI spend counters — handy for a /health-style endpoint."""
    return {
        "date": _today(),
        "daily_cap": _DAILY_CAP,
        **_SPEND.get(_today(), {"calls": 0, "input_tokens": 0, "output_tokens": 0, "usd": 0.0}),
    }


# ── main entry point ────────────────────────────────────────────────────────
def get_ai_news(symbol: str) -> dict[str, Any]:
    """Return AI-scored news sentiment for *symbol*.
    Falls back gracefully (score=0) when API key absent, news unavailable,
    daily cap hit, or Claude API is unhappy."""
    sym = symbol.upper()
    now = time.time()

    # 0. Skip indices — they have no stock-specific headlines.
    if sym.startswith("^"):
        return _neutral("index — not applicable")

    # 1. In-memory cache check (pre-populated from disk on import).
    with _lock:
        hit = _CACHE.get(sym)
    if hit:
        ts, cached_result, _hist = hit
        age = now - ts
        is_failure = cached_result.get("source") == "fallback"
        ttl = _FAILURE_TTL if is_failure else _SUCCESS_TTL
        if age < ttl:
            return cached_result

    # 2. Daily spend cap — belt-and-suspenders protection.
    if _cap_reached():
        log.warning(f"ai_news daily cap ({_DAILY_CAP}) reached — returning fallback")
        return _neutral(f"daily cap reached ({_DAILY_CAP} calls)")

    # 3. Client available?
    client = _get_client()
    if client is None:
        result = _neutral("ANTHROPIC_API_KEY not set")
        with _lock:
            _CACHE[sym] = (now, result, [])
            _save_to_disk()
        return result

    # 4. Fetch headlines.
    try:
        # No custom session — yfinance manages its own internally.
        # Passing a curl_cffi session triggers a .impersonate.name AttributeError
        # in curl_cffi >=0.7; news falls back gracefully to score=0 on cloud IPs.
        ticker = yf.Ticker(sym)
        raw_news = ticker.news or []
    except Exception as e:
        log.warning(f"yfinance news fetch failed for {sym}: {e}")
        result = _neutral("news fetch failed")
        with _lock:
            _CACHE[sym] = (now, result, [])
            _save_to_disk()
        return result

    headlines: list[str] = []
    for item in raw_news[:10]:
        content = item.get("content", {}) if isinstance(item, dict) else {}
        title = content.get("title") or item.get("title") or ""
        if title:
            headlines.append(title.strip())

    if not headlines:
        result = _neutral("no recent headlines found")
        with _lock:
            _CACHE[sym] = (now, result, [])
            _save_to_disk()
        return result

    bullet_list = "\n".join(f"- {h}" for h in headlines)
    prompt = f"""You are a financial news analyst covering Indian equities (NSE/BSE).
Analyse the following recent headlines for the stock symbol {sym} and return a JSON object with EXACTLY these keys:

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
Example: {{"score": 0.4, "label": "Bullish", "summary": "Strong results beat expectations.", "whyItMatters": "Margin recovery signals FY27 earnings upgrade cycle.", "watchOut": "Global slowdown may pressure Q1 guidance.", "headlines": [{{"title": "Q4 profit beats", "sentiment": "bullish", "impact": "high"}}]}}"""

    # 5. Call Claude.
    try:
        msg = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed = json.loads(raw)
        score = float(max(-1.0, min(1.0, parsed.get("score", 0.0))))
        label = str(parsed.get("label", "Neutral"))
        summary = str(parsed.get("summary", ""))
        why_it_matters = str(parsed.get("whyItMatters", ""))
        watch_out = str(parsed.get("watchOut", ""))
        raw_headlines = parsed.get("headlines", [])
        structured_headlines = [
            {
                "title": str(h.get("title", "")),
                "sentiment": h.get("sentiment", "neutral"),
                "impact": h.get("impact", "medium"),
            }
            for h in raw_headlines[:3]
            if isinstance(h, dict)
        ]

        # 6. Track spend + log it.
        usage = getattr(msg, "usage", None)
        in_tok = int(getattr(usage, "input_tokens", 0)) if usage else 0
        out_tok = int(getattr(usage, "output_tokens", 0)) if usage else 0

        # Update score_history for velocity.
        today_iso = _today()
        with _lock:
            _track_spend(in_tok, out_tok)
            today = _SPEND[_today()]
            _, _, old_history = _CACHE.get(sym, (0, {}, []))
        score_history = [e for e in old_history if e[0] != today_iso]
        score_history.append([today_iso, score])
        score_history = score_history[-4:]  # keep last 4 entries

        trend = _compute_trend(score_history)

        log.info(
            f"ai_news {sym} · in={in_tok} out={out_tok} · trend={trend} · "
            f"today: {today['calls']} calls, ${today['usd']:.4f}"
        )
    except Exception as e:
        log.warning(f"Claude news scoring failed for {sym}: {e}")
        result = _neutral("AI scoring unavailable")
        with _lock:
            _CACHE[sym] = (now, result, [])
            _save_to_disk()
        return result

    result = {
        "score": round(score, 2),
        "label": label,
        "summary": summary,
        "whyItMatters": why_it_matters,
        "watchOut": watch_out,
        "headlines": structured_headlines,
        "trend": trend,
        "source": "claude-haiku",
    }
    with _lock:
        _CACHE[sym] = (now, result, score_history)
        _save_to_disk()
    return result
