"""
AI Synthesis — Claude Haiku reads all indicator scores together and returns
a plain-English 2-3 sentence analysis explaining the fusion verdict.

This is the "why" behind the probability number.  Compact prompt → compact
JSON output (≤ 200 tokens) → cost-efficient.

Cost per call: ~400 input + ~120 output ≈ $0.001.

Cost controls (same philosophy as ai_news.py):
  • Disk-persisted cache — survives uvicorn reloads
  • 12-hour TTL on successes, 15-min TTL on failures (self-heals)
  • Daily cap shared via AI_NEWS_DAILY_CAP env var (reuses same counter)
  • No external fetch — pure data processing, no yf_session needed
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

from anthropic import Anthropic

log = logging.getLogger(__name__)

_CACHE_DIR = Path(__file__).parent / ".cache"
_CACHE_PATH = _CACHE_DIR / "ai_synthesis.json"
_SUCCESS_TTL = 60 * 60 * 12   # 12 hours
_FAILURE_TTL = 60 * 15         # 15 min — let transient errors self-heal

_COST_INPUT = 1.0 / 1_000_000
_COST_OUTPUT = 5.0 / 1_000_000

_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_lock = Lock()
_client: Anthropic | None = None


# ── shared spend ledger (imports from ai_news at runtime to avoid circular) ─
def _get_spend_module():
    import ai_news  # lazy import — avoids circular at module level
    return ai_news


# ── cache persistence ────────────────────────────────────────────────────────
def _load_from_disk() -> None:
    try:
        if not _CACHE_PATH.exists():
            return
        data = json.loads(_CACHE_PATH.read_text())
        for sym, entry in (data.get("cache") or {}).items():
            _CACHE[sym] = (float(entry["ts"]), entry["result"])
    except Exception as e:
        log.warning(f"ai_synthesis cache load failed: {e}")


def _save_to_disk() -> None:
    try:
        _CACHE_DIR.mkdir(parents=True, exist_ok=True)
        payload = {
            "cache": {s: {"ts": ts, "result": res} for s, (ts, res) in _CACHE.items()}
        }
        _CACHE_PATH.write_text(json.dumps(payload, indent=2))
    except Exception as e:
        log.warning(f"ai_synthesis cache save failed: {e}")


_load_from_disk()


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


def _fallback(reason: str = "unavailable") -> dict[str, Any]:
    return {
        "verdict": "",
        "bull": "",
        "bear": "",
        "risk": "",
        "source": "fallback",
        "reason": reason,
    }


def _daily_cap_reached() -> bool:
    try:
        from ai_news import _DAILY_CAP, _SPEND, _today
        day = _SPEND.get(_today(), {})
        return int(day.get("calls", 0)) >= _DAILY_CAP
    except Exception:
        return False


def _track_spend(input_tokens: int, output_tokens: int) -> None:
    try:
        ai_news = _get_spend_module()
        with ai_news._lock:
            ai_news._track_spend(input_tokens, output_tokens)
            today = ai_news._SPEND[ai_news._today()]
        log.info(
            f"ai_synthesis · in={input_tokens} out={output_tokens} · "
            f"today: {today['calls']} calls, ${today['usd']:.4f}"
        )
    except Exception as e:
        log.warning(f"spend tracking failed: {e}")


# ── main entry point ─────────────────────────────────────────────────────────
def get_ai_synthesis(
    symbol: str,
    name: str,
    price: float,
    fusion: dict[str, Any],
    indicators: dict[str, Any],
) -> dict[str, Any]:
    """
    Return a plain-English analysis of why the fusion score is what it is.
    Gracefully returns an empty fallback (no verdict text) when unavailable.
    """
    sym = symbol.upper()
    now = time.time()

    # Indices don't need synthesis — their signals are market-wide, not actionable.
    if sym.startswith("^"):
        return _fallback("index — not applicable")

    # Cache check.
    with _lock:
        hit = _CACHE.get(sym)
    if hit:
        age = now - hit[0]
        is_failure = hit[1].get("source") == "fallback"
        ttl = _FAILURE_TTL if is_failure else _SUCCESS_TTL
        if age < ttl:
            return hit[1]

    if _daily_cap_reached():
        log.warning("ai_synthesis skipped — daily cap reached")
        return _fallback("daily cap reached")

    client = _get_client()
    if client is None:
        result = _fallback("ANTHROPIC_API_KEY not set")
        with _lock:
            _CACHE[sym] = (now, result)
            _save_to_disk()
        return result

    # Build compact prompt.
    prob_pct = round(fusion.get("probability", 0.5) * 100)
    verdict = fusion.get("verdict", "HOLD")

    rs = indicators.get("rs", {})
    delivery = indicators.get("delivery", {})
    ema = indicators.get("ema", {})
    momentum = indicators.get("momentum", {})
    volume = indicators.get("volume", {})
    ai_news = indicators.get("aiNews", {})

    # Actual price levels — grounded data so Claude doesn't hallucinate numbers.
    e20  = ema.get("ema20",  price)
    e50  = ema.get("ema50",  price)
    e200 = ema.get("ema200", price)
    vwap = volume.get("vwap20", price)

    news_line = ""
    if ai_news.get("source") == "claude-haiku":
        news_line = f"- News sentiment: {ai_news.get('score', 0):.2f} ({ai_news.get('label', 'Neutral')}) — {ai_news.get('summary', '')}\n"

    prompt = f"""You are a concise analyst for Indian retail stock traders (NSE/BSE).

Stock: {name} ({sym}) — ₹{price:,.2f}
Fusion probability: {prob_pct}% → {verdict}

Key price levels (use ONLY these numbers for target/stop — do NOT invent):
  EMA20: ₹{e20:,.2f} | EMA50: ₹{e50:,.2f} | EMA200: ₹{e200:,.2f} | VWAP-20D: ₹{vwap:,.2f}

Indicator scores (-1 = bearish, 0 = neutral, +1 = bullish):
- Relative Strength vs Nifty 500: {rs.get('score', 0):.2f} ({rs.get('label', '')})
- Delivery regime (accumulation): {delivery.get('score', 0):.2f} ({delivery.get('label', '')})
- EMA stack (20/50/200 trend): {ema.get('score', 0):.2f} ({ema.get('label', '')})
- Momentum 20D: {momentum.get('score', 0):.2f} ({momentum.get('label', '')})
- Volume / VWAP: {volume.get('score', 0):.2f} ({volume.get('label', '')})
{news_line}
Return ONLY this JSON (no markdown, no explanation outside it):
{{
  "verdict": "<2-3 plain sentences: what these signals mean together for a retail trader. Be specific about the dominant drivers. No hype, no disclaimers.>",
  "bull": "<strongest bull case ≤ 15 words>",
  "bear": "<strongest bear case ≤ 15 words>",
  "risk": "<primary risk factor ≤ 10 words>",
  "target": <nearest upside resistance from the price levels above as a plain number, no ₹>,
  "stop": <nearest downside support from the price levels above as a plain number, no ₹>
}}"""

    try:
        msg = _client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed = json.loads(raw)

        usage = getattr(msg, "usage", None)
        in_tok = int(getattr(usage, "input_tokens", 0)) if usage else 0
        out_tok = int(getattr(usage, "output_tokens", 0)) if usage else 0
        _track_spend(in_tok, out_tok)

    except Exception as e:
        log.warning(f"ai_synthesis failed for {sym}: {e}")
        result = _fallback("AI synthesis unavailable")
        with _lock:
            _CACHE[sym] = (now, result)
            _save_to_disk()
        return result

    # target/stop are optional numbers — Claude may not always return them.
    def _safe_float(val: Any) -> float | None:
        try:
            return round(float(val), 2) if val not in (None, "", "null") else None
        except (TypeError, ValueError):
            return None

    result: dict[str, Any] = {
        "verdict": str(parsed.get("verdict", "")),
        "bull": str(parsed.get("bull", "")),
        "bear": str(parsed.get("bear", "")),
        "risk": str(parsed.get("risk", "")),
        "source": "claude-haiku",
    }
    t = _safe_float(parsed.get("target"))
    s = _safe_float(parsed.get("stop"))
    if t is not None:
        result["target"] = t
    if s is not None:
        result["stop"] = s
    with _lock:
        _CACHE[sym] = (now, result)
        _save_to_disk()
    return result
