"""
Panic-O-Meter — composite fear/greed score for the Indian equity market.

Scale: 0 = Extreme Greed, 100 = Extreme Panic.

Four components:
  1. India VIX            (weight 0.35)
  2. Market breadth       (weight 0.30)  — % Nifty 50 above 200-day SMA
  3. Delivery strength    (weight 0.20)  — average NSE delivery % vs thresholds
  4. Momentum breadth     (weight 0.15)  — % Nifty 50 with positive 20-day momentum

Public API
----------
  compute_panic()          -> dict   (expensive; caller should cache)
  get_panic_history(days)  -> list[dict]
  _save_today(data)        -> None   (called by /panic endpoint after compute)
"""
from __future__ import annotations

import logging
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import yfinance as yf

from services.data import get_delivery_series

log = logging.getLogger(__name__)

# ─────────────────────────── Nifty 50 symbols ───────────────────────────────
# Copied from main.py UNIVERSE — only the equity constituents (no indices).
# Indices (^NSEI, ^BSESN) are excluded because they have no breadth/delivery data.
_NIFTY50_SYMBOLS: list[str] = [
    "RELIANCE.NS",
    "TCS.NS",
    "HDFCBANK.NS",
    "BHARTIARTL.NS",
    "ICICIBANK.NS",
    "INFY.NS",
    "SBIN.NS",
    "HINDUNILVR.NS",
    "ITC.NS",
    "LT.NS",
    "KOTAKBANK.NS",
    "BAJFINANCE.NS",
    "HCLTECH.NS",
    "AXISBANK.NS",
    "ASIANPAINT.NS",
    "MARUTI.NS",
    "SUNPHARMA.NS",
    "TITAN.NS",
    "WIPRO.NS",
    "ULTRACEMCO.NS",
    "NESTLEIND.NS",
    "POWERGRID.NS",
    "NTPC.NS",
    "ONGC.NS",
    "TMCV.NS",
    "TATASTEEL.NS",
    "JSWSTEEL.NS",
    "ADANIPORTS.NS",
    "BAJAJFINSV.NS",
    "HDFCLIFE.NS",
    "SBILIFE.NS",
    "DIVISLAB.NS",
    "DRREDDY.NS",
    "CIPLA.NS",
    "EICHERMOT.NS",
    "HEROMOTOCO.NS",
    "BAJAJ-AUTO.NS",
    "TECHM.NS",
    "GRASIM.NS",
    "BRITANNIA.NS",
    "COALINDIA.NS",
    "BPCL.NS",
    "M&M.NS",
    "TATACONSUM.NS",
    "APOLLOHOSP.NS",
    "INDUSINDBK.NS",
    "ADANIENT.NS",
    "SHRIRAMFIN.NS",
    "IDFCFIRSTB.NS",
]

# ─────────────────────────── SQLite persistence ──────────────────────────────
_DB_DIR  = Path(__file__).parent / "data"
_DB_PATH = _DB_DIR / "verdict_history.db"   # shared DB with history.py

_PANIC_SCHEMA = """
CREATE TABLE IF NOT EXISTS panic_scores (
    date_ymd        TEXT PRIMARY KEY,
    score           REAL NOT NULL,
    zone            TEXT NOT NULL,
    vix_value       REAL,
    vix_score       REAL,
    breadth_score   REAL,
    delivery_score  REAL,
    momentum_score  REAL,
    recorded_at_utc TEXT NOT NULL
);
"""

_IST = timezone(timedelta(hours=5, minutes=30))


def _ist_today_ymd() -> str:
    return datetime.now(_IST).strftime("%Y-%m-%d")


def _connect() -> sqlite3.Connection:
    _DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), timeout=5.0)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db() -> None:
    try:
        conn = _connect()
        try:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.executescript(_PANIC_SCHEMA)
            conn.commit()
        finally:
            conn.close()
    except Exception as exc:
        log.warning("panic: DB init failed: %s", exc)


_init_db()

# ─────────────────────────── zone helper ────────────────────────────────────

def score_to_zone(s: float) -> str:
    if s <= 20:
        return "Extreme Greed"
    if s <= 40:
        return "Greed"
    if s <= 60:
        return "Neutral"
    if s <= 80:
        return "Fear"
    return "Extreme Panic"


# ─────────────────────────── component 1: India VIX ─────────────────────────

def _compute_vix_component(session=None) -> tuple[float, float]:
    """Returns (vix_current, vix_score). Falls back to (None, 50.0) on error."""
    try:
        kwargs: dict = dict(period="35d", progress=False, auto_adjust=True)
        if session is not None:
            kwargs["session"] = session
        vix_hist = yf.download("^INDIAVIX", **kwargs)
        close_col = vix_hist["Close"] if "Close" in vix_hist.columns else vix_hist.iloc[:, 0]
        vix_current = float(close_col.dropna().iloc[-1])
        vix_score = max(0.0, min(100.0, (vix_current - 11.0) / (25.0 - 11.0) * 100.0))
        return vix_current, vix_score
    except Exception as exc:
        log.warning("panic: VIX fetch failed: %s", exc)
        return None, 50.0


# ─────────────────────────── component 2 & 4: multi-symbol price data ───────

def _fetch_multi_closes(session=None) -> "pd.DataFrame | None":
    """Single yfinance download for all Nifty 50 symbols over 210 days.

    Returns a DataFrame with symbols as columns and dates as index,
    or None on total failure.
    """
    try:
        kwargs: dict = dict(period="210d", progress=False, auto_adjust=True, group_by="ticker")
        if session is not None:
            kwargs["session"] = session
        raw = yf.download(_NIFTY50_SYMBOLS, **kwargs)
        # yfinance returns MultiIndex columns (ticker, OHLCV) for multi-symbol downloads.
        # Extract just Close prices — result columns = ticker symbols.
        if isinstance(raw.columns, pd.MultiIndex):
            closes = raw["Close"]
        else:
            # Single symbol fallback (shouldn't happen with a list, but be safe)
            closes = raw[["Close"]]
            closes.columns = _NIFTY50_SYMBOLS[:1]
        closes = closes.dropna(how="all")
        return closes
    except Exception as exc:
        log.warning("panic: multi-symbol download failed: %s", exc)
        return None


def _compute_breadth_component(closes: "pd.DataFrame | None") -> tuple[float, float]:
    """Returns (pct_above_200, breadth_score). Neutral (0.5, 50.0) on error."""
    if closes is None or closes.empty or len(closes) < 201:
        log.warning("panic: not enough rows for 200-SMA breadth (%s rows)",
                    0 if closes is None else len(closes))
        return 0.5, 50.0

    try:
        above = 0
        total = 0
        for col in closes.columns:
            series = closes[col].dropna()
            if len(series) < 201:
                continue
            current_price = float(series.iloc[-1])
            sma200 = float(series.iloc[-200:].mean())
            total += 1
            if current_price > sma200:
                above += 1

        if total == 0:
            return 0.5, 50.0

        pct_above = above / total
        breadth_score = max(0.0, min(100.0, (1.0 - pct_above) * 100.0))
        return pct_above, breadth_score
    except Exception as exc:
        log.warning("panic: breadth calc failed: %s", exc)
        return 0.5, 50.0


# ─────────────────────────── component 3: delivery strength ─────────────────

def _compute_delivery_component() -> tuple[float, float]:
    """Returns (avg_delivery_pct, delivery_score). Neutral (None, 50.0) on failure."""
    delivery_values: list[float] = []

    for sym in _NIFTY50_SYMBOLS:
        try:
            series = get_delivery_series(sym, n_trading_days=1)
            if series:
                latest = series[-1]
                pct = latest.get("deliveryPct")
                if pct is not None:
                    delivery_values.append(float(pct))
        except Exception as exc:
            log.debug("panic: delivery fetch skipped for %s: %s", sym, exc)

    if len(delivery_values) < 10:
        log.warning("panic: insufficient delivery data (%d symbols); using neutral",
                    len(delivery_values))
        return None, 50.0

    avg_del = float(np.mean(delivery_values))
    # delivery >= 55% → score 0 (greed / accumulation); delivery <= 25% → score 100 (panic)
    delivery_score = max(0.0, min(100.0, (55.0 - avg_del) / (55.0 - 25.0) * 100.0))
    return avg_del, delivery_score


# ─────────────────────────── component 4: momentum breadth ──────────────────

def _compute_momentum_component(closes: "pd.DataFrame | None") -> tuple[float, float]:
    """Returns (pct_positive_momentum, momentum_score). Neutral on error."""
    if closes is None or closes.empty or len(closes) < 22:
        return 0.5, 50.0

    try:
        positive = 0
        total = 0
        for col in closes.columns:
            series = closes[col].dropna()
            if len(series) < 22:
                continue
            momentum = float(series.iloc[-1]) / float(series.iloc[-21]) - 1.0
            total += 1
            if momentum > 0:
                positive += 1

        if total == 0:
            return 0.5, 50.0

        pct_positive = positive / total
        momentum_score = max(0.0, min(100.0, (1.0 - pct_positive) * 100.0))
        return pct_positive, momentum_score
    except Exception as exc:
        log.warning("panic: momentum calc failed: %s", exc)
        return 0.5, 50.0


# ─────────────────────────── public API ─────────────────────────────────────

def compute_panic(session=None) -> dict[str, Any]:
    """Compute the full Panic-O-Meter snapshot. Expensive — caller should cache.

    Returns a dict matching the StockSnapshot shape:
    {
        score, zone, components: {vix, breadth, delivery, momentum},
        history, as_of, computed_at_utc
    }
    Pass a curl_cffi `session` to use Chrome TLS fingerprinting in production.
    """
    computed_at_utc = datetime.now(timezone.utc).isoformat()
    as_of = _ist_today_ymd()

    # ── Component 1: VIX ────────────────────────────────────────────────────
    vix_value, vix_score = _compute_vix_component(session=session)

    # ── Components 2 & 4 share one multi-symbol download ────────────────────
    closes = _fetch_multi_closes(session=session)

    # ── Component 2: Market breadth ─────────────────────────────────────────
    pct_above_200, breadth_score = _compute_breadth_component(closes)

    # ── Component 3: Delivery strength ──────────────────────────────────────
    avg_delivery, delivery_score = _compute_delivery_component()

    # ── Component 4: Momentum breadth ───────────────────────────────────────
    pct_positive_momentum, momentum_score = _compute_momentum_component(closes)

    # ── Composite ───────────────────────────────────────────────────────────
    panic_score = round(
        0.35 * vix_score
        + 0.30 * breadth_score
        + 0.20 * delivery_score
        + 0.15 * momentum_score,
        1,
    )
    zone = score_to_zone(panic_score)

    return {
        "score": panic_score,
        "zone": zone,
        "components": {
            "vix": {
                "value": round(vix_value, 2) if vix_value is not None else None,
                "score": round(vix_score, 1),
                "weight": 0.35,
                "label": "India VIX",
            },
            "breadth": {
                "value": round(pct_above_200, 4),
                "score": round(breadth_score, 1),
                "weight": 0.30,
                "label": "Market breadth",
            },
            "delivery": {
                "value": round(avg_delivery, 2) if avg_delivery is not None else None,
                "score": round(delivery_score, 1),
                "weight": 0.20,
                "label": "Delivery strength",
            },
            "momentum": {
                "value": round(pct_positive_momentum, 4),
                "score": round(momentum_score, 1),
                "weight": 0.15,
                "label": "Momentum breadth",
            },
        },
        "history": [],          # filled by caller via get_panic_history()
        "as_of": as_of,
        "computed_at_utc": computed_at_utc,
    }


def _save_today(data: dict[str, Any]) -> None:
    """INSERT OR REPLACE today's panic score into the panic_scores table.

    Silent on any error — must never break the /panic endpoint.
    """
    try:
        components = data.get("components", {})
        vix_c = components.get("vix", {})
        breadth_c = components.get("breadth", {})
        delivery_c = components.get("delivery", {})
        momentum_c = components.get("momentum", {})

        conn = _connect()
        try:
            conn.execute(
                """
                INSERT OR REPLACE INTO panic_scores
                  (date_ymd, score, zone, vix_value, vix_score,
                   breadth_score, delivery_score, momentum_score, recorded_at_utc)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    data.get("as_of", _ist_today_ymd()),
                    float(data["score"]),
                    str(data["zone"]),
                    vix_c.get("value"),
                    vix_c.get("score"),
                    breadth_c.get("score"),
                    delivery_c.get("score"),
                    momentum_c.get("score"),
                    data.get("computed_at_utc", datetime.now(timezone.utc).isoformat()),
                ),
            )
            conn.commit()
        finally:
            conn.close()
    except Exception as exc:
        log.warning("panic: _save_today failed: %s", exc)


def get_panic_history(days: int = 30) -> list[dict[str, Any]]:
    """Return the last `days` rows from panic_scores, ascending by date."""
    try:
        cutoff = (datetime.now(_IST) - timedelta(days=max(1, int(days)))).strftime("%Y-%m-%d")
        conn = _connect()
        try:
            cur = conn.execute(
                """
                SELECT date_ymd, score, zone
                FROM panic_scores
                WHERE date_ymd >= ?
                ORDER BY date_ymd ASC
                """,
                (cutoff,),
            )
            return [
                {
                    "date":  r["date_ymd"],
                    "score": float(r["score"]),
                    "zone":  r["zone"],
                }
                for r in cur.fetchall()
            ]
        finally:
            conn.close()
    except Exception as exc:
        log.warning("panic: get_panic_history failed: %s", exc)
        return []
