"""
MarketMithra API — real NSE/BSE data via yfinance.

Endpoints:
  GET /health
  GET /snapshot/{symbol}   — StockSnapshot matching the frontend type shape
  GET /ranked              — top-N universe stocks ranked by fusion probability
  GET /screener            — slim ranked list for filter UI (no price series)
  GET /movers              — stocks with significant probability change since last cycle
"""
from __future__ import annotations

import logging
import os
import threading
import time
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Literal

log = logging.getLogger(__name__)

# Load .env from the api/ directory so ANTHROPIC_API_KEY is available without
# setting it system-wide (developer convenience; prod uses real env vars).
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    for _line in _env_file.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            _k, _v = _k.strip(), _v.strip()
            # Override when the existing env var is missing OR empty.
            # Windows / Claude Code sometimes pre-declares ANTHROPIC_API_KEY=""
            # at the system level, which would otherwise silently block our .env.
            if not os.environ.get(_k):
                os.environ[_k] = _v

import requests as std_requests
import numpy as np
import pandas as pd
import yfinance as yf
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from bhavcopy import get_delivery_series, delivery_trend
from ai_news import get_ai_news, get_spend_today
from ai_synthesis import get_ai_synthesis
from rrg import compute_rrg, SECTOR_MAP
import history
import panic as _panic_module
import stock_dna as _dna_module
import darvas as _darvas_module
import mithra_agent as _mithra

# One requests.Session per OS thread — thread-safe, no curl_cffi version issues.
# On cloud IPs (Railway/AWS), Yahoo Finance doesn't require TLS impersonation.
_thread_local = threading.local()

_YF_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


def _get_yf_session() -> std_requests.Session:
    """Return the current thread's requests session, creating it if needed."""
    if not hasattr(_thread_local, "yf_session"):
        s = std_requests.Session()
        s.headers.update(_YF_HEADERS)
        _thread_local.yf_session = s
    return _thread_local.yf_session

NIFTY500_TICKER = "^CRSLDX"   # Nifty 500 Index on yfinance
HISTORY_PERIOD = "1y"
HISTORY_INTERVAL = "1d"
CACHE_TTL_SECONDS = 60 * 30    # 30 min — NSE publishes EOD once a day anyway
TAIL_SPARK_LEN = 90            # bars to ship to frontend

UNIVERSE = [
    # ── Nifty 50 constituents ────────────────────────────────────────────────
    ("RELIANCE.NS",   "Reliance Industries"),
    ("TCS.NS",        "Tata Consultancy Services"),
    ("HDFCBANK.NS",   "HDFC Bank"),
    ("BHARTIARTL.NS", "Bharti Airtel"),
    ("ICICIBANK.NS",  "ICICI Bank"),
    ("INFY.NS",       "Infosys"),
    ("SBIN.NS",       "State Bank of India"),
    ("HINDUNILVR.NS", "Hindustan Unilever"),
    ("ITC.NS",        "ITC Ltd"),
    ("LT.NS",         "Larsen & Toubro"),
    ("KOTAKBANK.NS",  "Kotak Mahindra Bank"),
    ("BAJFINANCE.NS", "Bajaj Finance"),
    ("HCLTECH.NS",    "HCL Technologies"),
    ("AXISBANK.NS",   "Axis Bank"),
    ("ASIANPAINT.NS", "Asian Paints"),
    ("MARUTI.NS",     "Maruti Suzuki India"),
    ("SUNPHARMA.NS",  "Sun Pharmaceutical"),
    ("TITAN.NS",      "Titan Company"),
    ("WIPRO.NS",      "Wipro"),
    ("ULTRACEMCO.NS", "UltraTech Cement"),
    ("NESTLEIND.NS",  "Nestlé India"),
    ("POWERGRID.NS",  "Power Grid Corp"),
    ("NTPC.NS",       "NTPC"),
    ("ONGC.NS",       "ONGC"),
    ("TMCV.NS",        "Tata Motors"),
    ("TATASTEEL.NS",  "Tata Steel"),
    ("JSWSTEEL.NS",   "JSW Steel"),
    ("ADANIPORTS.NS", "Adani Ports"),
    ("BAJAJFINSV.NS", "Bajaj Finserv"),
    ("HDFCLIFE.NS",   "HDFC Life Insurance"),
    ("SBILIFE.NS",    "SBI Life Insurance"),
    ("DIVISLAB.NS",   "Divi's Laboratories"),
    ("DRREDDY.NS",    "Dr. Reddy's Labs"),
    ("CIPLA.NS",      "Cipla"),
    ("EICHERMOT.NS",  "Eicher Motors"),
    ("HEROMOTOCO.NS", "Hero MotoCorp"),
    ("BAJAJ-AUTO.NS", "Bajaj Auto"),
    ("TECHM.NS",      "Tech Mahindra"),
    ("GRASIM.NS",     "Grasim Industries"),
    ("BRITANNIA.NS",  "Britannia Industries"),
    ("COALINDIA.NS",  "Coal India"),
    ("BPCL.NS",       "BPCL"),
    ("M&M.NS",        "Mahindra & Mahindra"),
    ("TATACONSUM.NS", "Tata Consumer Products"),
    ("APOLLOHOSP.NS", "Apollo Hospitals"),
    ("INDUSINDBK.NS", "IndusInd Bank"),
    ("ADANIENT.NS",   "Adani Enterprises"),
    ("SHRIRAMFIN.NS", "Shriram Finance"),
    ("IDFCFIRSTB.NS", "IDFC First Bank"),
    # ── Indices (for relative-strength baseline only) ────────────────────────
    ("^NSEI",         "Nifty 50"),
    ("^BSESN",        "Sensex"),
]
UNIVERSE_NAMES = dict(UNIVERSE)

# ─────────────────────────── data fetching + cache ──────────────────────────
_cache: dict[str, tuple[float, pd.DataFrame]] = {}


def fetch_history(symbol: str) -> pd.DataFrame:
    now = time.time()
    hit = _cache.get(symbol)
    if hit and now - hit[0] < CACHE_TTL_SECONDS:
        return hit[1]
    df = yf.Ticker(symbol, session=_get_yf_session()).history(
        period=HISTORY_PERIOD, interval=HISTORY_INTERVAL, auto_adjust=False
    )
    if df.empty:
        raise HTTPException(status_code=404, detail=f"No data for {symbol}")
    df = df.dropna(subset=["Close"])
    _cache[symbol] = (now, df)
    return df


# ─────────────────────────── indicator math ─────────────────────────────────
def ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


def clamp(x: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return float(max(lo, min(hi, x)))


def relative_strength(stock_close: pd.Series, index_close: pd.Series) -> dict[str, Any]:
    """IBD/Mansfield-style RS vs Nifty 500. Returns a RelativeStrengthResult."""
    joined = pd.concat([stock_close, index_close], axis=1, join="inner").dropna()
    joined.columns = ["stock", "index"]
    ratio = joined["stock"] / joined["index"]
    if len(ratio) < 20:
        raise HTTPException(status_code=422, detail="Not enough history for RS")

    r_now = float(ratio.iloc[-1])
    # guard against short histories for newer listings
    back_1y = max(0, len(ratio) - 240)
    back_3m = max(0, len(ratio) - 60)
    rs_1y = r_now / float(ratio.iloc[back_1y])
    rs_3m = r_now / float(ratio.iloc[back_3m])
    blended = 0.6 * (rs_1y - 1) + 0.4 * (rs_3m - 1)
    rating = int(max(0, min(100, round(50 + blended * 180))))
    score = clamp((rating - 50) / 50)

    tail = ratio.tail(TAIL_SPARK_LEN).round(6).tolist()
    return {
        "rating": rating,
        "ratio": round(r_now, 6),
        "score": round(score, 2),
        "ratioSeries": tail,
        "label": f"RS {rating}",
    }


def ema_stack(close: pd.Series) -> dict[str, Any]:
    e20 = ema(close, 20)
    e50 = ema(close, 50)
    e200 = ema(close, 200)
    v20, v50, v200 = float(e20.iloc[-1]), float(e50.iloc[-1]), float(e200.iloc[-1])
    if v20 > v50 > v200:
        status, score, label = "bullish", 1.0, "20 > 50 > 200"
    elif v20 < v50 < v200:
        status, score, label = "bearish", -1.0, "20 < 50 < 200"
    else:
        status, score, label = "mixed", 0.0, "Mixed"
    return {
        "ema20": round(v20, 2),
        "ema50": round(v50, 2),
        "ema200": round(v200, 2),
        "status": status,
        "score": score,
        "priceSeries": close.tail(TAIL_SPARK_LEN).round(2).tolist(),
        "ema20Series": e20.tail(TAIL_SPARK_LEN).round(2).tolist(),
        "ema50Series": e50.tail(TAIL_SPARK_LEN).round(2).tolist(),
        "ema200Series": e200.tail(TAIL_SPARK_LEN).round(2).tolist(),
        "label": label,
    }


def momentum_20d(close: pd.Series) -> dict[str, Any]:
    if len(close) < 21:
        raise HTTPException(status_code=422, detail="Not enough history for momentum")
    last = float(close.iloc[-1])
    prev = float(close.iloc[-21])
    pct = (last - prev) / prev * 100.0
    return {
        "value": round(pct, 1),
        "score": round(clamp(pct / 10), 2),
        "series": close.tail(60).round(2).tolist(),
        "label": f"{'+' if pct > 0 else ''}{pct:.1f}%",
    }


def volume_vwap(close: pd.Series, volume: pd.Series) -> dict[str, Any]:
    pv = (close * volume).rolling(20, min_periods=1).sum()
    v_sum = volume.rolling(20, min_periods=1).sum().replace(0, np.nan)
    vwap = (pv / v_sum).bfill()
    last_close = float(close.iloc[-1])
    last_vwap = float(vwap.iloc[-1])
    above = last_close > last_vwap
    pct_vs_vwap = (last_close - last_vwap) / last_vwap * 100

    vol_sma5 = volume.rolling(5, min_periods=1).mean()
    vol_sma20 = volume.rolling(20, min_periods=1).mean().replace(0, np.nan)
    vol_ratio = float((vol_sma5 / vol_sma20).iloc[-1])
    if vol_ratio > 1.1:
        vol_trend = "rising"
    elif vol_ratio < 0.9:
        vol_trend = "falling"
    else:
        vol_trend = "flat"

    vwap_sub = clamp(pct_vs_vwap / 5)
    vol_sub = 0.6 if vol_trend == "rising" else -0.6 if vol_trend == "falling" else 0.0
    score = clamp(0.5 * vwap_sub + 0.5 * vol_sub * (1 if above else -1))

    return {
        "volumeTrend": vol_trend,
        "vwap20": round(last_vwap, 2),
        "priceVsVwapPct": round(pct_vs_vwap, 2),
        "aboveVwap": bool(above),
        "score": round(score, 2),
        "priceSeries": close.tail(TAIL_SPARK_LEN).round(2).tolist(),
        "vwapSeries": vwap.tail(TAIL_SPARK_LEN).round(2).tolist(),
        "volumeSeries": volume.tail(TAIL_SPARK_LEN).round(0).astype(int).tolist(),
        "label": f"{'↑' if above else '↓'} VWAP · vol {vol_trend}",
    }


def _delivery_neutral(symbol: str) -> dict[str, Any]:
    """Fallback when NSE bhavcopy is unavailable (indices, outage, unknown sym).
    Returns a honest-neutral reading so the fusion weight becomes a no-op."""
    return {
        "deliveryPct": 0.0,
        "deliveryPct5d": 0.0,
        "deliveryPct20d": 0.0,
        "regime": 1.0,
        "priceDelta5v20": 0.0,
        "status": "noise",
        "score": 0.0,
        "series": [],
        "label": "n/a · no delivery data",
        "source": "fallback",
    }


def delivery_real(symbol: str, close_yf: pd.Series) -> dict[str, Any]:
    """Compute real delivery-regime signal from NSE bhavcopy history.
    Falls back to neutral (score=0) for indices or on failure, so the API
    stays robust even when NSE archives are misbehaving."""
    rows = get_delivery_series(symbol, n_trading_days=30)
    if len(rows) < 5:
        return _delivery_neutral(symbol)

    dp = [r["deliveryPct"] for r in rows if r["deliveryPct"] is not None]
    cl = [r["close"] for r in rows if r["close"] is not None]
    if len(dp) < 5 or len(cl) < 5:
        return _delivery_neutral(symbol)

    d_now = dp[-1]
    d5 = float(np.mean(dp[-5:]))
    d20 = float(np.mean(dp[-20:])) if len(dp) >= 10 else float(np.mean(dp))
    regime = d5 / d20 if d20 else 1.0

    close5 = float(np.mean(cl[-5:]))
    close20 = float(np.mean(cl[-20:])) if len(cl) >= 10 else float(np.mean(cl))
    price_delta = (close5 - close20) / close20 if close20 else 0.0

    score = clamp(2 * (regime - 1) + 3 * price_delta)
    if score > 0.25:
        status = "accumulating"
    elif score < -0.25:
        status = "distributing"
    else:
        status = "noise"

    return {
        "deliveryPct": round(d_now, 1),
        "deliveryPct5d": round(d5, 1),
        "deliveryPct20d": round(d20, 1),
        "regime": round(regime, 2),
        "priceDelta5v20": round(price_delta * 100, 2),
        "status": status,
        "score": round(score, 2),
        "series": [round(x, 2) for x in dp],
        "label": f"{d_now:.0f}% · {status}",
        "source": "nse-bhavcopy",
    }


# ─────────────────────────── price-level helpers ────────────────────────────
def calc_price_levels(
    price: float,
    ema_data: dict[str, Any],
    vv_data: dict[str, Any],
    verdict: str,
) -> dict[str, Any]:
    """
    Derive nearest support & resistance from EMA-stack and VWAP levels.
    Returns target (nearest resistance) and stop (nearest support) plus a
    short label identifying which indicator the level comes from.

    Used as algorithmic fallback when AI synthesis is unavailable, and also
    fed into the synthesis prompt so Claude can reference real numbers.
    """
    candidates: list[tuple[float, str]] = [
        (ema_data.get("ema20",  price), "EMA20"),
        (ema_data.get("ema50",  price), "EMA50"),
        (ema_data.get("ema200", price), "EMA200"),
        (vv_data.get("vwap20",  price), "VWAP"),
    ]
    # Levels clearly above / below current price (0.2% buffer avoids noise).
    above = sorted([(v, l) for v, l in candidates if v > price * 1.002],
                   key=lambda x: x[0])   # nearest first
    below = sorted([(v, l) for v, l in candidates if v < price * 0.998],
                   key=lambda x: x[0], reverse=True)  # nearest first

    if verdict == "BUY":
        t_val, t_lbl = above[0] if above else (round(price * 1.05, 2), "est")
        s_val, s_lbl = below[0] if below else (round(price * 0.95, 2), "est")
    elif verdict == "SELL":
        t_val, t_lbl = below[0] if below else (round(price * 0.95, 2), "est")
        s_val, s_lbl = above[0] if above else (round(price * 1.05, 2), "est")
    else:  # HOLD — nearest resistance / nearest support
        t_val, t_lbl = above[0] if above else (round(price * 1.03, 2), "est")
        s_val, s_lbl = below[0] if below else (round(price * 0.97, 2), "est")

    return {
        "target": round(float(t_val), 2),
        "stop":   round(float(s_val), 2),
        "targetLabel": t_lbl,
        "stopLabel":   s_lbl,
    }


# ─────────────────────────── snapshot assembly ──────────────────────────────
FUSION_WEIGHTS = {
    "rs": 0.20,
    "delivery": 0.20,
    "ema": 0.18,
    "momentum": 0.17,
    "volume": 0.15,
    "aiNews": 0.10,
}


def build_snapshot(symbol: str, skip_synthesis: bool = False) -> dict[str, Any]:
    """Build a full StockSnapshot.

    skip_synthesis=True is used by /ranked to avoid 48+ Claude synthesis calls
    per refresh — synthesis is only needed on the single-stock canvas view.
    AI news scores are still computed (needed for fusion weighting).
    """
    symbol = symbol.upper()
    stock = fetch_history(symbol)
    idx = fetch_history(NIFTY500_TICKER)

    close = stock["Close"]
    volume = stock["Volume"]

    rs = relative_strength(close, idx["Close"])
    ema = ema_stack(close)
    mom = momentum_20d(close)
    vv = volume_vwap(close, volume)
    delivery = delivery_real(symbol, close)

    # Blend 5-day delivery-trend slope into the raw delivery score.
    _trend_result = None
    try:
        _trend_result = delivery_trend(symbol)
    except Exception as _tre:
        log.debug("delivery_trend failed for %s: %s", symbol, _tre)
    if _trend_result is not None:
        raw_delivery_score = delivery["score"]
        blended_delivery = 0.65 * raw_delivery_score + 0.35 * _trend_result["score"]
        delivery["score"] = round(blended_delivery, 2)
    delivery["delivery_trend"] = _trend_result

    ai_news = get_ai_news(symbol, _get_yf_session())

    weighted = (
        rs["score"] * FUSION_WEIGHTS["rs"]
        + delivery["score"] * FUSION_WEIGHTS["delivery"]
        + ema["score"] * FUSION_WEIGHTS["ema"]
        + mom["score"] * FUSION_WEIGHTS["momentum"]
        + vv["score"] * FUSION_WEIGHTS["volume"]
        + ai_news["score"] * FUSION_WEIGHTS["aiNews"]
    )
    probability = round(0.5 + weighted / 2, 2)
    verdict = "BUY" if probability >= 0.6 else "SELL" if probability <= 0.4 else "HOLD"

    name = UNIVERSE_NAMES.get(symbol, symbol.replace(".NS", "").replace(".BO", ""))
    price = round(float(close.iloc[-1]), 2)
    indicators = {
        "rs": rs,
        "delivery": delivery,
        "ema": ema,
        "momentum": mom,
        "volume": vv,
        "aiNews": ai_news,
    }
    fusion_data = {"probability": probability, "verdict": verdict, "weights": FUSION_WEIGHTS}

    # Always compute algorithmic levels — cheap, no API call.
    price_levels = calc_price_levels(price, ema, vv, verdict)

    if skip_synthesis:
        synthesis: dict[str, Any] = {"source": "fallback", "reason": "ranked view"}
    else:
        synthesis = get_ai_synthesis(symbol, name, price, fusion_data, indicators)

    # Persist today's verdict for the track-record / daily-digest features.
    # Idempotent UPSERT keyed by (symbol, IST date). Silent on any error so
    # a locked DB never breaks a /snapshot response.
    try:
        history.record_verdict(symbol, verdict, probability, price)
    except Exception as _hist_exc:
        log.warning("history hook failed for %s: %s", symbol, _hist_exc)

    return {
        "symbol": symbol,
        "name": name,
        "price": price,
        "currency": "INR",
        "priceSeries": close.tail(TAIL_SPARK_LEN).round(2).tolist(),
        "indicators": indicators,
        "fusion": {**fusion_data, "synthesis": synthesis, "priceLevels": price_levels},
        "asOf": datetime.utcnow().isoformat() + "Z",
    }


# ─────────────────────────── per-IP rate limiter ────────────────────────────
# Simple sliding-window counter stored in memory.  Limits /snapshot calls per
# IP to avoid burning the Anthropic API key.  The canvas already caches each
# snapshot in the browser, so legitimate users rarely exceed this.
_RATE_LIMIT_WINDOW  = 60          # seconds
_RATE_LIMIT_MAX     = 30          # requests per window per IP
_rate_buckets: dict[str, list[float]] = {}
_rate_lock = threading.Lock()


def _check_rate_limit(ip: str) -> bool:
    """Return True if the request is allowed, False if rate-limited."""
    now = time.time()
    cutoff = now - _RATE_LIMIT_WINDOW
    with _rate_lock:
        times = _rate_buckets.get(ip, [])
        # Evict old entries
        times = [t for t in times if t > cutoff]
        if len(times) >= _RATE_LIMIT_MAX:
            _rate_buckets[ip] = times
            return False
        times.append(now)
        _rate_buckets[ip] = times
        return True


# ─────────────────────────── FastAPI app ────────────────────────────────────
from contextlib import asynccontextmanager


@asynccontextmanager
async def _lifespan(app_: FastAPI):  # noqa: ARG001
    """Kick off ranked computation in the background on startup so the first
    real user request never hits the cold-start compute path."""
    def _warm():
        global _ranked_cache, _ranked_cache_ts
        try:
            fresh = _compute_ranked()
            with _ranked_cache_lock:
                _ranked_cache = fresh
                _ranked_cache_ts = time.time()
            log.info("ranked startup warm-up complete (%d stocks)", len(fresh))
        except Exception as e:
            log.warning("ranked startup warm-up failed: %s", e)

    t = threading.Thread(target=_warm, daemon=True)
    t.start()
    yield  # app runs here


app = FastAPI(title="MarketMithra API", version="0.1.0", lifespan=_lifespan)

# Allowed CORS origins. In production, set ALLOWED_ORIGINS env var to a
# comma-separated list of your domains. Defaults to wildcard for local dev.
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
_allowed_origins: list[str] = (
    [o.strip() for o in _raw_origins.split(",") if o.strip()]
    if _raw_origins
    else ["*"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health(response: Response) -> dict[str, str]:
    response.headers["Cache-Control"] = "no-store"
    return {"status": "ok", "cacheEntries": str(len(_cache))}


@app.get("/status")
def status(response: Response) -> dict[str, Any]:
    """Lightweight freshness probe for the frontend — when did the ranked
    cache last refresh, and how many stocks are in it.

    Separate from /health so the UI can poll this cheaply (30s cache) without
    interfering with our deploy-platform's health check."""
    response.headers["Cache-Control"] = "public, max-age=30, stale-while-revalidate=60"
    with _ranked_cache_lock:
        ts = _ranked_cache_ts
        n = len(_ranked_cache)
    as_of = (
        datetime.utcfromtimestamp(ts).isoformat() + "Z"
        if ts > 0
        else None
    )
    return {
        "asOf": as_of,
        "ranked": n,
        "ttlSeconds": _RANKED_TTL,
    }


@app.get("/spend")
def spend(response: Response) -> dict[str, Any]:
    """Today's AI spend — dollars, calls, tokens, remaining cap headroom."""
    response.headers["Cache-Control"] = "no-store"
    return get_spend_today()


@app.get("/universe")
def universe(response: Response) -> list[dict[str, str]]:
    """The tickers MarketMithra actively tracks. Frontend typeahead uses this."""
    response.headers["Cache-Control"] = "public, max-age=86400"
    return [{"symbol": sym, "name": name} for sym, name in UNIVERSE]


_search_cache: dict[str, tuple[float, list[dict[str, str]]]] = {}
_SEARCH_TTL = 60 * 60  # 1 hour

@app.get("/search")
def search(response: Response, q: str, limit: int = 8) -> list[dict[str, str]]:
    """Proxy to Yahoo Finance's search API, filtered to NSE/BSE listings.
    Frontend typeahead falls back to this when the local bundled list misses."""
    response.headers["Cache-Control"] = "public, max-age=3600"
    query = (q or "").strip()
    if len(query) < 2:
        return []
    key = query.lower()
    now = time.time()
    hit = _search_cache.get(key)
    if hit and now - hit[0] < _SEARCH_TTL:
        return hit[1][:limit]
    try:
        r = _get_yf_session().get(
            "https://query2.finance.yahoo.com/v1/finance/search",
            params={"q": query, "quotesCount": 20, "newsCount": 0},
            timeout=8,
        )
        data = r.json()
    except Exception:
        return []
    quotes = data.get("quotes", []) if isinstance(data, dict) else []
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for qu in quotes:
        sym = qu.get("symbol") or ""
        if not sym or sym in seen:
            continue
        # Indian listings end in .NS or .BO (yfinance convention).
        if not (sym.endswith(".NS") or sym.endswith(".BO") or sym.startswith("^")):
            continue
        name = (
            qu.get("shortname") or qu.get("longname") or qu.get("quoteType") or sym
        )
        sector = qu.get("sectorDisp") or qu.get("industryDisp") or qu.get("exchDisp") or ""
        out.append({"symbol": sym, "name": name, "sector": sector})
        seen.add(sym)
        if len(out) >= limit:
            break
    _search_cache[key] = (now, out)
    return out


@app.get("/snapshot/{symbol}")
def snapshot(symbol: str, request: Request, response: Response) -> dict[str, Any]:
    # Data refreshes at most every 30 min server-side; let CDN cache for 15 min
    # and serve stale for another 30 min while revalidating.
    response.headers["Cache-Control"] = "public, max-age=900, stale-while-revalidate=1800"

    # Rate-limit by client IP to protect the Anthropic API key.
    client_ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or request.headers.get("x-real-ip", "")
        or (request.client.host if request.client else "unknown")
    )
    if not _check_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit: max {_RATE_LIMIT_MAX} requests per {_RATE_LIMIT_WINDOW}s",
        )

    try:
        return build_snapshot(symbol)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")


# ─────────────────────────── ranked results cache ───────────────────────────
# Stale-while-revalidate: /ranked returns the last result instantly while a
# background thread recomputes.  Cold start (empty cache) computes inline.
_RANKED_TTL = 60 * 30   # 30 min — EOD data doesn't change intraday

_ranked_cache: list[dict[str, Any]] = []
_ranked_cache_ts: float = 0.0
_ranked_cache_lock = threading.Lock()
_ranked_refreshing = threading.Event()

# ─────────────────────────── snapshot persistence (for /movers) ─────────────
# Before each ranked cache refresh we snapshot the CURRENT probabilities to
# disk.  The next refresh computes deltas vs. this snapshot → "movers".
# Lives in api/.cache/ alongside the synthesis/news caches.
import json as _json

_SNAPSHOT_DIR  = Path(__file__).parent / ".cache"
_SNAPSHOT_PATH = _SNAPSHOT_DIR / "ranked_snapshot.json"

# Probability change threshold to qualify as a "mover" (5 pp by default).
_MOVERS_MIN_DELTA = 0.05


def _save_ranked_snapshot(data: list[dict[str, Any]]) -> None:
    """Persist a slim version of the current ranked data for movers diffing."""
    slim = [
        {
            "symbol":      s["symbol"],
            "name":        s["name"],
            "price":       s["price"],
            "probability": s["fusion"]["probability"],
            "verdict":     s["fusion"]["verdict"],
            "saved_at":    datetime.utcnow().isoformat() + "Z",
        }
        for s in data
    ]
    try:
        _SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
        _SNAPSHOT_PATH.write_text(_json.dumps(slim))
        log.debug("ranked snapshot saved (%d rows)", len(slim))
    except Exception as exc:
        log.warning("could not save ranked snapshot: %s", exc)


def _load_ranked_snapshot() -> list[dict[str, Any]]:
    """Load the previous ranked snapshot from disk.  Returns [] if absent."""
    try:
        if _SNAPSHOT_PATH.exists():
            return _json.loads(_SNAPSHOT_PATH.read_text())
    except Exception:
        pass
    return []


def _compute_ranked() -> list[dict[str, Any]]:
    """Run the full universe build — called both inline and in background."""
    from concurrent.futures import ThreadPoolExecutor, as_completed

    def _safe(sym: str):
        try:
            return build_snapshot(sym, skip_synthesis=True)
        except Exception:
            return None

    out: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=12) as pool:
        futures = {pool.submit(_safe, sym): sym for sym, _ in UNIVERSE}
        for fut in as_completed(futures):
            result = fut.result()
            if result is not None:
                out.append(result)

    out.sort(key=lambda s: s["fusion"]["probability"], reverse=True)
    return out


def _bg_refresh_ranked() -> None:
    """Background thread: recompute and swap in the new cache."""
    global _ranked_cache, _ranked_cache_ts
    try:
        fresh = _compute_ranked()
        with _ranked_cache_lock:
            # Snapshot the outgoing cache BEFORE overwriting — this becomes
            # "yesterday's data" for the /movers diff on the next call.
            if _ranked_cache:
                _save_ranked_snapshot(_ranked_cache)
            _ranked_cache = fresh
            _ranked_cache_ts = time.time()
        log.info("ranked cache refreshed (%d stocks)", len(fresh))
    except Exception as e:
        log.warning("ranked background refresh failed: %s", e)
    finally:
        _ranked_refreshing.clear()


def _get_ranked_data(limit: int = 500) -> list[dict[str, Any]]:
    """Internal helper — returns the ranked list, warming cache as needed.
    Separated from the HTTP endpoint so /screener can call it without needing
    a Response object."""
    global _ranked_cache, _ranked_cache_ts

    now = time.time()
    age = now - _ranked_cache_ts

    # ① Fresh cache — serve immediately.
    if _ranked_cache and age < _RANKED_TTL:
        return _ranked_cache[:limit]

    # ② Stale cache — return stale data instantly and kick off background refresh.
    if _ranked_cache:
        if not _ranked_refreshing.is_set():
            _ranked_refreshing.set()
            t = threading.Thread(target=_bg_refresh_ranked, daemon=True)
            t.start()
        return _ranked_cache[:limit]

    # ③ Cold start — compute inline (only happens once per process lifetime).
    log.info("ranked cold-start compute…")
    fresh = _compute_ranked()
    with _ranked_cache_lock:
        # Save cold-start result as the baseline snapshot so the first
        # background refresh (30 min later) can produce meaningful movers.
        _save_ranked_snapshot(fresh)
        _ranked_cache = fresh
        _ranked_cache_ts = time.time()
    return fresh[:limit]


@app.get("/ranked")
def ranked(response: Response, limit: int = 10) -> list[dict[str, Any]]:
    response.headers["Cache-Control"] = "public, max-age=900, stale-while-revalidate=1800"
    return _get_ranked_data(limit)


@app.get("/screener")
def screener(response: Response, verdict: str | None = None) -> list[dict[str, Any]]:
    """Lightweight screener — strips heavy series data for fast filter UI.

    Returns symbol, name, price, verdict, probability only.
    Optionally filter by ?verdict=BUY|HOLD|SELL.
    Reuses the /ranked cache so no extra computation.
    """
    response.headers["Cache-Control"] = "public, max-age=900, stale-while-revalidate=1800"
    full = _get_ranked_data(limit=500)
    slim = [
        {
            "symbol":      s["symbol"],
            "name":        s["name"],
            "price":       s["price"],
            "verdict":     s["fusion"]["verdict"],
            "probability": s["fusion"]["probability"],
        }
        for s in full
    ]
    if verdict and verdict.upper() in ("BUY", "HOLD", "SELL"):
        slim = [s for s in slim if s["verdict"] == verdict.upper()]
    return slim


@app.get("/movers")
def movers(
    response: Response,
    limit: int = 15,
    min_delta: float = _MOVERS_MIN_DELTA,
) -> list[dict[str, Any]]:
    """Stocks whose fusion probability changed significantly since the last
    ranked computation.  Returns an empty list when no previous snapshot
    exists (first run) or when nothing has moved beyond min_delta.

    Response shape per item:
      symbol, name, price, verdict, prev_verdict,
      probability, prev_probability, prob_delta (signed),
      prob_delta_pct (signed, in percentage points),
      direction ("up"|"down"), verdict_changed (bool)
    """
    response.headers["Cache-Control"] = "public, max-age=900, stale-while-revalidate=1800"

    current = _get_ranked_data(limit=500)
    prev    = _load_ranked_snapshot()

    if not prev:
        return []

    prev_map: dict[str, dict[str, Any]] = {s["symbol"]: s for s in prev}

    result: list[dict[str, Any]] = []
    for s in current:
        sym = s["symbol"]
        p   = prev_map.get(sym)
        if not p:
            continue

        curr_prob = float(s["fusion"]["probability"])
        prev_prob = float(p["probability"])
        delta     = curr_prob - prev_prob

        if abs(delta) < min_delta:
            continue

        curr_verdict = s["fusion"]["verdict"]
        prev_verdict = p["verdict"]

        result.append({
            "symbol":          sym,
            "name":            s["name"],
            "price":           s["price"],
            "verdict":         curr_verdict,
            "prev_verdict":    prev_verdict,
            "probability":     round(curr_prob, 3),
            "prev_probability": round(prev_prob, 3),
            "prob_delta":      round(delta, 3),
            "prob_delta_pct":  round(delta * 100, 1),   # e.g. +12.5
            "direction":       "up" if delta > 0 else "down",
            "verdict_changed": curr_verdict != prev_verdict,
        })

    # Sort: verdict changes first (most newsworthy), then by absolute delta.
    result.sort(
        key=lambda x: (not x["verdict_changed"], -abs(x["prob_delta"]))
    )
    return result[:limit]


# ─────────────────────────── verdict history ───────────────────────────────
@app.get("/history/{symbol}")
def history_for_symbol(
    symbol: str,
    response: Response,
    days: int = 90,
) -> dict[str, Any]:
    """Timestamped verdict track record for a single symbol.  Powers the
    public "what we called and what happened" chart."""
    response.headers["Cache-Control"] = "public, max-age=300"
    sym = symbol.upper()
    if sym not in UNIVERSE_NAMES:
        raise HTTPException(status_code=404, detail=f"Unknown symbol: {sym}")
    return {
        "symbol":  sym,
        "history": history.get_history(sym, days=days),
    }


@app.get("/history/changes")
def history_changes(response: Response, date: str) -> dict[str, Any]:
    """Symbols whose verdict differs between `date` and the previous day.
    Backs the Phase 2 daily digest.  `date` is YYYY-MM-DD (IST).  Returns
    an empty list when the previous day has no records."""
    response.headers["Cache-Control"] = "public, max-age=300"
    try:
        dt = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")
    prev_ymd = (dt - timedelta(days=1)).strftime("%Y-%m-%d")
    return {
        "date":    date,
        "changes": history.get_changes_on(date, prev_ymd),
    }


@app.get("/digest/preview")
def digest_preview(response: Response, date: str) -> dict[str, Any]:
    """Preview what a daily email digest would contain for `date` (YYYY-MM-DD).

    Loads verdict changes from history and groups them into buys / sells / holds.
    Returns empty lists (not 404) when no changes are found for the given date.
    """
    response.headers["Cache-Control"] = "public, max-age=300"
    try:
        dt = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")
    prev_ymd = (dt - timedelta(days=1)).strftime("%Y-%m-%d")
    changes = history.get_changes_on(date, prev_ymd)

    buys:  list[dict[str, Any]] = []
    sells: list[dict[str, Any]] = []
    holds: list[dict[str, Any]] = []

    for ch in changes:
        item = {
            "symbol":       ch["symbol"],
            "name":         UNIVERSE_NAMES.get(ch["symbol"], ch["symbol"].replace(".NS", "").replace(".BO", "")),
            "prob":         round(float(ch["prob_today"]), 4),
            "prev_verdict": ch["verdict_prev"],
        }
        verdict_today = ch["verdict_today"]
        if verdict_today == "BUY":
            buys.append(item)
        elif verdict_today == "SELL":
            sells.append(item)
        else:
            holds.append(item)

    return {
        "date":          date,
        "total_changes": len(changes),
        "buys":          buys,
        "sells":         sells,
        "holds":         holds,
    }


# ─────────────────────────── RRG (sector rotation) ──────────────────────────
# Relative Rotation Graph — Julius de Kempenaer style.  Each sector is plotted
# vs. Nifty 50 with a trail of weekly snapshots showing which way it's rotating.
# Result is expensive (49 ticker fetches + heavy pandas), so we cache with a
# stale-while-revalidate pattern identical to /ranked.
_RRG_TTL = 60 * 30   # 30 min — matches _RANKED_TTL; EOD data doesn't move intraday

_rrg_cache: dict[str, Any] = {}
_rrg_cache_ts: float = 0.0
_rrg_cache_lock = threading.Lock()
_rrg_refreshing = threading.Event()


def _compute_rrg_payload() -> dict[str, Any]:
    """Fetch histories for every sector constituent + benchmark, compute RRG."""
    closes: dict[str, pd.Series] = {}
    for sym in SECTOR_MAP.keys():
        try:
            df = fetch_history(sym)
            closes[sym] = df["Close"]
        except Exception as e:
            log.debug("rrg: skipping %s (%s)", sym, e)

    try:
        bench_df = fetch_history("^NSEI")
        bench_close = bench_df["Close"]
    except Exception as e:
        log.warning("rrg: benchmark fetch failed: %s", e)
        return {"asOf": datetime.utcnow().isoformat() + "Z", "sectors": []}

    sectors = compute_rrg(closes, bench_close)
    return {
        "asOf": datetime.utcnow().isoformat() + "Z",
        "benchmark": "Nifty 50",
        "sectors": sectors,
    }


def _bg_refresh_rrg() -> None:
    global _rrg_cache, _rrg_cache_ts
    try:
        fresh = _compute_rrg_payload()
        with _rrg_cache_lock:
            _rrg_cache = fresh
            _rrg_cache_ts = time.time()
        log.info("rrg cache refreshed (%d sectors)", len(fresh.get("sectors", [])))
    except Exception as e:
        log.warning("rrg background refresh failed: %s", e)
    finally:
        _rrg_refreshing.clear()


@app.get("/rrg")
def rrg(response: Response) -> dict[str, Any]:
    """Sector rotation graph.  Returns current RS-Ratio / RS-Momentum
    coordinates plus an 8-week trail for each Nifty sector."""
    response.headers["Cache-Control"] = "public, max-age=900, stale-while-revalidate=1800"

    global _rrg_cache, _rrg_cache_ts
    now = time.time()
    age = now - _rrg_cache_ts

    # ① Fresh cache — serve immediately.
    if _rrg_cache and age < _RRG_TTL:
        return _rrg_cache

    # ② Stale cache — return stale data instantly and kick off background refresh.
    if _rrg_cache:
        if not _rrg_refreshing.is_set():
            _rrg_refreshing.set()
            t = threading.Thread(target=_bg_refresh_rrg, daemon=True)
            t.start()
        return _rrg_cache

    # ③ Cold start — compute inline.
    log.info("rrg cold-start compute…")
    fresh = _compute_rrg_payload()
    with _rrg_cache_lock:
        _rrg_cache = fresh
        _rrg_cache_ts = time.time()
    return fresh


# ─────────────────────────── Panic-O-Meter ──────────────────────────────────
# Composite fear/greed score (0 = Extreme Greed, 100 = Extreme Panic).
# Four components: India VIX (0.35), market breadth (0.30),
# delivery strength (0.20), momentum breadth (0.15).
# Expensive to compute — cached in memory for 30 minutes.

_panic_cache: dict | None = None
_panic_cache_ts: float = 0.0


@app.get("/panic")
def get_panic(response: Response) -> dict[str, Any]:
    """Panic-O-Meter: composite Indian market fear/greed score (0–100).

    0 = Extreme Greed, 100 = Extreme Panic.
    Cached for 30 minutes; result includes 30-day history from SQLite.
    """
    global _panic_cache, _panic_cache_ts
    now = time.time()
    if _panic_cache is None or (now - _panic_cache_ts) > 1800:
        data = _panic_module.compute_panic()
        data["history"] = _panic_module.get_panic_history(30)
        _panic_module._save_today(data)
        _panic_cache = data
        _panic_cache_ts = now
    response.headers["Cache-Control"] = "public, max-age=1800"
    return _panic_cache


# ─────────────────────────── /dna endpoint ───────────────────────────────────

@app.get("/dna/{symbol}")
def get_dna(symbol: str, response: Response):
    symbol = symbol.upper()
    if not symbol.endswith((".NS", ".BO")):
        symbol = symbol + ".NS"
    # Look up name from UNIVERSE
    name = next(
        (n for s, n in UNIVERSE if s == symbol),
        symbol.replace(".NS", "").replace(".BO", ""),
    )
    result = _dna_module.get_stock_dna(symbol, name=name)
    if result is None:
        raise HTTPException(status_code=404, detail="DNA data unavailable for this symbol")
    result["name"] = name
    response.headers["Cache-Control"] = "public, max-age=86400"
    return result


# ─────────────────────────── /darvas endpoint ────────────────────────────────

@app.get("/darvas/{symbol}")
def darvas_analysis(symbol: str, response: Response) -> dict[str, Any]:
    """Darvas Box analysis — box top, floor, breakout status. Cached 24h."""
    response.headers["Cache-Control"] = "public, max-age=3600"
    sym = symbol.upper()
    if sym not in UNIVERSE_NAMES:
        raise HTTPException(status_code=404, detail=f"Unknown symbol: {sym}")
    name = UNIVERSE_NAMES.get(sym, sym.replace(".NS", "").replace(".BO", ""))
    result = _darvas_module.get_darvas(sym, name)
    if result is None:
        raise HTTPException(status_code=503, detail="Darvas data unavailable")
    return result


# ─────────────────────────── Mithra Agent ───────────────────────────────────


class AgentChatRequest(BaseModel):
    session_id: str = ""
    messages: list[dict]  # [{"role": "user"|"assistant", "content": str}]
    page_context: str = ""


@app.post("/agent/chat")
def agent_chat(req: AgentChatRequest, response: Response) -> dict[str, Any]:
    """Conversational assistant endpoint for the Mithra in-product chat widget.

    Accepts a full conversation history (user + assistant turns) and returns
    the next assistant reply.  Session ID is generated server-side if omitted.
    Conversations are logged to SQLite for knowledge-base iteration.
    """
    sid = req.session_id or str(uuid.uuid4())
    result = _mithra.chat(
        session_id=sid,
        messages=req.messages,
        page_context=req.page_context,
    )
    response.headers["Cache-Control"] = "no-store"
    return result


@app.get("/agent/logs")
def agent_logs(
    request: Request,
    response: Response,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """Admin endpoint — recent Mithra conversation logs for knowledge-base review.

    Protected by X-Admin-Key header (must match DIGEST_API_SECRET env var).
    Returns an empty list rather than 401 when the secret is unconfigured, so
    local dev without a secret still works (no key = no auth needed locally).
    """
    response.headers["Cache-Control"] = "no-store"
    secret = os.environ.get("DIGEST_API_SECRET", "")
    if secret:
        provided = request.headers.get("X-Admin-Key", "")
        if provided != secret:
            raise HTTPException(status_code=401, detail="Invalid admin key")
    return _mithra.get_recent_logs(limit=max(1, min(limit, 500)))


# ─────────────────────────── Admin: usage dashboard ─────────────────────────


@app.get("/admin/usage")
def admin_usage(request: Request) -> dict[str, Any]:
    """Aggregate Anthropic API spend for today (ai_news + ai_synthesis + mithra_agent
    all pipe into the same ledger).  Protected by X-Admin-Key if DIGEST_API_SECRET is set."""
    secret = os.environ.get("DIGEST_API_SECRET", "")
    if secret:
        provided = request.headers.get("X-Admin-Key", "")
        if provided != secret:
            raise HTTPException(status_code=401, detail="Invalid admin key")

    spend = get_spend_today()          # from ai_news (shared ledger)
    calls = int(spend.get("calls", 0))
    cap   = int(spend.get("daily_cap", 100))
    usd   = float(spend.get("usd", 0.0))

    return {
        **spend,
        "cap_pct":           round(calls / cap * 100, 1) if cap else 0.0,
        "cost_per_call_avg": round(usd / calls, 5) if calls else 0.0,
        "haiku_pricing": {
            "input_per_1k_tokens":  0.0008,
            "output_per_1k_tokens": 0.004,
        },
        "tip": "ai_synthesis<=300 tok | mithra<=512 tok | ai_news system prompt <300 tok",
    }
