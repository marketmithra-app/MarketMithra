"""
BSE Corporate Announcements — fetches recent filings for a stock symbol
and translates them into plain English via Claude Haiku.

Design:
  - Static NSE→BSE scrip code map (Nifty 50 only; unknown symbols → [])
  - BSE public API call with browser-mimic headers
  - One Haiku call summarises all announcements at once
  - 6h cache on success, 30min on BSE error
  - Zero impact on main /snapshot endpoint (called independently by frontend)
"""
from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path
from threading import Lock
from typing import Any

import httpx
from anthropic import Anthropic

log = logging.getLogger(__name__)

# ── tunables ─────────────────────────────────────────────────────────────────
_CACHE_DIR  = Path(__file__).parent / ".cache"
_CACHE_PATH = _CACHE_DIR / "ann_cache.json"
_SUCCESS_TTL = 60 * 60 * 6   # 6 hours
_FAILURE_TTL = 60 * 30        # 30 minutes on BSE error

KEEP_CATEGORIES: set[str] = {
    "Results", "Dividend", "Board Meeting", "Buyback",
    "Rights Issue", "Bonus Issue", "QIP",
    "Merger/Amalgamation", "Scheme of Arrangement",
}

# Nifty 50 NSE symbol → BSE scrip code mapping.
# BSE codes are permanent identifiers — update only when Nifty 50 rebalances.
NSE_TO_BSE: dict[str, str] = {
    "ADANIENT.NS":   "512599",
    "ADANIPORTS.NS": "532921",
    "APOLLOHOSP.NS": "508869",
    "ASIANPAINT.NS": "500820",
    "AXISBANK.NS":   "532215",
    "BAJAJ-AUTO.NS": "532977",
    "BAJAJFINSV.NS": "532978",
    "BAJFINANCE.NS": "500034",
    "BEL.NS":        "500049",
    "BHARTIARTL.NS": "532454",
    "BPCL.NS":       "500547",
    "BRITANNIA.NS":  "500825",
    "CIPLA.NS":      "500087",
    "COALINDIA.NS":  "533278",
    "DIVISLAB.NS":   "532488",
    "DRREDDY.NS":    "500124",
    "EICHERMOT.NS":  "505200",
    "GRASIM.NS":     "500300",
    "HCLTECH.NS":    "532281",
    "HDFCBANK.NS":   "500180",
    "HDFCLIFE.NS":   "540777",
    "HEROMOTOCO.NS": "500182",
    "HINDALCO.NS":   "500440",
    "HINDUNILVR.NS": "500696",
    "ICICIBANK.NS":  "532174",
    "INDUSINDBK.NS": "532187",
    "INFY.NS":       "500209",
    "ITC.NS":        "500875",
    "JIOFIN.NS":     "543940",
    "JSWSTEEL.NS":   "500228",
    "KOTAKBANK.NS":  "500247",
    "LICI.NS":       "543526",
    "LT.NS":         "500510",
    "M&M.NS":        "500520",
    "MARUTI.NS":     "532500",
    "NESTLEIND.NS":  "500790",
    "NTPC.NS":       "532555",
    "ONGC.NS":       "500312",
    "POWERGRID.NS":  "532898",
    "RELIANCE.NS":   "500325",
    "SBIN.NS":       "500112",
    "SBILIFE.NS":    "540719",
    "SHRIRAMFIN.NS": "511218",
    "SUNPHARMA.NS":  "524715",
    "TATAMOTORS.NS": "500570",
    "TATASTEEL.NS":  "500470",
    "TCS.NS":        "532540",
    "TECHM.NS":      "532755",
    "TITAN.NS":      "500114",
    "TRENT.NS":      "500251",
    "ULTRACEMCO.NS": "532538",
    "WIPRO.NS":      "507685",
}

# ── in-memory cache ───────────────────────────────────────────────────────────
_ANN_CACHE: dict[str, tuple[float, list]] = {}  # sym -> (ts, announcements)
_lock = Lock()
_client: Anthropic | None = None


def _load_from_disk() -> None:
    try:
        if not _CACHE_PATH.exists():
            return
        data = json.loads(_CACHE_PATH.read_text())
        for sym, entry in (data or {}).items():
            _ANN_CACHE[sym] = (float(entry["ts"]), entry["announcements"])
    except Exception as e:
        log.warning(f"ann_cache load failed: {e}")


def _save_to_disk() -> None:
    try:
        _CACHE_DIR.mkdir(parents=True, exist_ok=True)
        payload = {
            s: {"ts": ts, "announcements": ann}
            for s, (ts, ann) in _ANN_CACHE.items()
        }
        _CACHE_PATH.write_text(json.dumps(payload, indent=2))
    except Exception as e:
        log.warning(f"ann_cache save failed: {e}")


_load_from_disk()


def _get_client() -> Anthropic | None:
    global _client
    if _client is not None:
        return _client
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        return None
    _client = Anthropic(api_key=key)
    return _client


def _fetch_bse_raw(bse_code: str) -> list[dict]:
    """Fetch raw announcements from BSE API. Returns [] on any error."""
    url = "https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w"
    params = {
        "pageno": "1",
        "category": "-1",
        "subcategory": "-1",
        "scripcode": bse_code,
        "strdate": "",
        "enddate": "",
        "annexure": "0",
    }
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Referer": "https://www.bseindia.com/",
        "Accept": "application/json, text/plain, */*",
    }
    try:
        resp = httpx.get(url, params=params, headers=headers, timeout=10.0)
        resp.raise_for_status()
        data = resp.json()
        # BSE API returns {"Table": [...]} or {"Table1": [...]}
        rows = data.get("Table") or data.get("Table1") or []
        return rows if isinstance(rows, list) else []
    except Exception as e:
        log.warning(f"BSE API fetch failed for {bse_code}: {e}")
        return []


def _summarise_with_haiku(symbol: str, announcements: list[dict]) -> list[dict]:
    """
    Call Haiku once with all announcement titles → plain-English + impact.
    Falls back to raw title + "medium" impact on any failure.
    """
    client = _get_client()
    if not client or not announcements:
        return [
            {**a, "plainEnglish": a["title"], "impact": "medium"}
            for a in announcements
        ]

    lines = "\n".join(
        f"{i+1}. [{a['date']}] [{a['category']}] — {a['title']}"
        for i, a in enumerate(announcements)
    )
    prompt = f"""You are a financial analyst for Indian retail investors.
Translate each BSE corporate announcement into a plain-English one-liner (≤ 15 words) \
and rate its impact as "high", "medium", or "low".

Announcements for {symbol}:
{lines}

Return a JSON array with one object per announcement (same order):
[{{"plainEnglish": "...", "impact": "high|medium|low"}}, ...]

Respond ONLY with the JSON array."""

    try:
        msg = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed: list = json.loads(raw)
        result = []
        for i, ann in enumerate(announcements):
            summary = parsed[i] if i < len(parsed) and isinstance(parsed[i], dict) else {}
            result.append({
                **ann,
                "plainEnglish": str(summary.get("plainEnglish", ann["title"])),
                "impact": summary.get("impact", "medium"),
            })
        return result
    except Exception as e:
        log.warning(f"Haiku announcement summarisation failed for {symbol}: {e}")
        return [{**a, "plainEnglish": a["title"], "impact": "medium"} for a in announcements]


def get_announcements(symbol: str) -> list[dict]:
    """
    Return up to 5 recent BSE corporate announcements for *symbol*.
    Always returns a list (empty on unknown symbol or BSE outage).
    """
    sym = symbol.upper()
    now = time.time()

    # 1. Check cache.
    with _lock:
        hit = _ANN_CACHE.get(sym)
    if hit:
        ts, cached = hit
        # Determine TTL: empty list = error cache (short TTL), else success (long TTL)
        ttl = _FAILURE_TTL if not cached else _SUCCESS_TTL
        if now - ts < ttl:
            return cached

    # 2. Unknown symbol — no BSE code, no data.
    bse_code = NSE_TO_BSE.get(sym)
    if not bse_code:
        log.debug(f"announcements: no BSE code for {sym}")
        with _lock:
            _ANN_CACHE[sym] = (now, [])
            _save_to_disk()
        return []

    # 3. Fetch from BSE.
    raw_rows = _fetch_bse_raw(bse_code)
    if not raw_rows:
        with _lock:
            _ANN_CACHE[sym] = (now, [])
            _save_to_disk()
        return []

    # 4. Filter to meaningful categories, keep top 5.
    filtered = [
        {
            "date": str(row.get("NEWS_DT") or row.get("ANNOUNCEMENT_DATE") or "")[:10],
            "category": str(row.get("CATEGORYNAME", "")),
            "title": str(row.get("HEADLINE", row.get("SLONGNAME", ""))),
        }
        for row in raw_rows
        if row.get("CATEGORYNAME", "") in KEEP_CATEGORIES
    ][:5]

    if not filtered:
        with _lock:
            _ANN_CACHE[sym] = (now, [])
            _save_to_disk()
        return []

    # 5. Haiku summarisation (one call for all).
    result = _summarise_with_haiku(sym, filtered)

    with _lock:
        _ANN_CACHE[sym] = (now, result)
        _save_to_disk()
    return result
