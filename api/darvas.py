"""
darvas.py — Darvas Box analysis for Nifty 50 symbols.

A Darvas Box is a price consolidation pattern where:
  - A ceiling (box top) is confirmed when a bar's high is the highest in the
    last 10 bars AND the next 3 consecutive bars do not exceed it.
  - A floor (box bottom) = lowest low from 25 bars before the ceiling to
    the ceiling bar.
  - Box is valid if width is 3%–25% and duration >= 5 trading days.
  - Breakout: close > top AND volume > 1.5× 20-day average volume.
  - Breakdown: close < bottom.

Results are cached in the shared verdict_history.db SQLite database.
TTL: 24 h keyed by IST date.
"""
from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timezone, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf

log = logging.getLogger(__name__)

# ─────────────────────────── constants ──────────────────────────────────────

STATUS_LABELS: dict[str, str] = {
    "in_box":     "In Box",
    "approaching": "Near Breakout",
    "breakout":   "Breakout ↑",
    "below_box":  "Broke Down",
    "no_box":     "No Active Box",
}

# ─────────────────────────── SQLite cache ───────────────────────────────────

_DB_PATH = Path(__file__).parent / "data" / "verdict_history.db"

_IST = timezone(timedelta(hours=5, minutes=30))


def _today_ist() -> str:
    return datetime.now(_IST).strftime("%Y-%m-%d")


def _db_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(_DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS darvas_cache (
            symbol        TEXT PRIMARY KEY,
            date_ymd      TEXT NOT NULL,
            payload       TEXT NOT NULL,
            recorded_at_utc TEXT NOT NULL
        )
        """
    )
    conn.commit()
    return conn


def _get_cached(symbol: str) -> dict | None:
    try:
        conn = _db_conn()
        today = _today_ist()
        row = conn.execute(
            "SELECT payload FROM darvas_cache WHERE symbol = ? AND date_ymd = ?",
            (symbol, today),
        ).fetchone()
        conn.close()
        if row:
            return json.loads(row[0])
    except Exception as exc:
        log.warning("darvas cache read failed for %s: %s", symbol, exc)
    return None


def _set_cached(symbol: str, data: dict) -> None:
    try:
        conn = _db_conn()
        conn.execute(
            """
            INSERT OR REPLACE INTO darvas_cache
                (symbol, date_ymd, payload, recorded_at_utc)
            VALUES (?, ?, ?, ?)
            """,
            (
                symbol,
                _today_ist(),
                json.dumps(data),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        conn.commit()
        conn.close()
    except Exception as exc:
        log.warning("darvas cache write failed for %s: %s", symbol, exc)


# ─────────────────────────── data fetching ──────────────────────────────────

def _fetch_data(symbol: str, session=None) -> pd.DataFrame | None:
    """
    Download 1 year of daily OHLCV for symbol.
    Returns DataFrame with Open, High, Low, Close, Volume columns (no NaN rows),
    or None on failure.

    Pass a curl_cffi session to bypass Yahoo Finance bot detection in production.
    """
    try:
        ticker = yf.Ticker(symbol, session=session) if session is not None else yf.Ticker(symbol)
        df = ticker.history(period="1y", auto_adjust=True)
        if df.empty:
            log.warning("darvas: empty data for %s", symbol)
            return None
        df = df[["Open", "High", "Low", "Close", "Volume"]].dropna()
        if len(df) < 60:
            log.warning("darvas: insufficient rows (%d) for %s", len(df), symbol)
            return None
        return df
    except Exception as exc:
        log.warning("darvas fetch failed for %s: %s", symbol, exc)
        return None


# ─────────────────────────── Darvas box algorithm ───────────────────────────

def _find_boxes(df: pd.DataFrame) -> list[dict]:
    """
    Find Darvas boxes in daily OHLCV data.

    A box ceiling is confirmed when a bar's high is:
    - The highest high in the last 10 bars (local peak)
    - NOT exceeded by the next 3 consecutive bars

    Box floor = lowest low from (ceiling_bar - 25) to ceiling_bar.
    Box valid if: width_pct between 3% and 25%, duration >= 5 days.

    Breakout = close > box_top AND volume > 1.5x 20-day avg volume.
    Breakdown = close < box_bottom.

    Returns list of box dicts (newest first), max 5.
    """
    highs = df["High"].values
    lows = df["Low"].values
    closes = df["Close"].values
    volumes = df["Volume"].values
    dates = df.index

    n = len(df)
    boxes: list[dict] = []

    # Precompute 20-day average volume for each bar
    vol_20d_avg = np.full(n, np.nan)
    for i in range(19, n):
        vol_20d_avg[i] = np.mean(volumes[max(0, i - 19):i + 1])

    # We need at least 10 bars look-back + 3 bars look-ahead to confirm a ceiling
    # Scan from bar 9 up to bar n-4 (to allow 3 look-ahead bars)
    for i in range(9, n - 3):
        # Condition 1: bar i is the highest high in the last 10 bars
        window_high = np.max(highs[i - 9:i + 1])
        if highs[i] < window_high:
            continue

        # Condition 2: next 3 consecutive bars do NOT exceed this high
        if np.any(highs[i + 1:i + 4] > highs[i]):
            continue

        # Ceiling confirmed at bar i
        ceiling_price = float(highs[i])
        ceiling_date = dates[i]

        # Box floor = lowest low from (i-25) to i
        floor_start = max(0, i - 25)
        floor_price = float(np.min(lows[floor_start:i + 1]))

        # Validate box geometry
        if floor_price <= 0:
            continue
        width_pct = round((ceiling_price - floor_price) / floor_price * 100, 1)
        if not (3.0 <= width_pct <= 25.0):
            continue

        # Box starts at floor_start, confirmed at i+3 (after 3 look-ahead bars)
        box_start_idx = floor_start
        box_confirm_idx = i + 3  # box is "active" from this bar onward

        # Duration: from box start to end of dataset (or until breakout/breakdown)
        # We search from confirm_idx forward for breakout/breakdown
        breakout_date: str | None = None
        breakout_confirmed = False
        breakdown = False
        box_end_idx: int | None = None

        for j in range(box_confirm_idx, n):
            vol_avg = vol_20d_avg[j] if not np.isnan(vol_20d_avg[j]) else volumes[j]
            if closes[j] > ceiling_price:
                breakout_date = dates[j].strftime("%Y-%m-%d")
                price_triggered = True
                volume_ok = volumes[j] > 1.5 * vol_avg if vol_avg > 0 else False
                breakout_confirmed = price_triggered and volume_ok
                box_end_idx = j
                break
            if closes[j] < floor_price:
                breakdown = True
                box_end_idx = j
                break

        # Duration in trading days from box_start to box_end (or last bar)
        end_idx = box_end_idx if box_end_idx is not None else n - 1
        days_active = end_idx - box_start_idx + 1

        if days_active < 5:
            continue

        started_str = dates[box_start_idx].strftime("%Y-%m-%d")
        ended_str = dates[box_end_idx].strftime("%Y-%m-%d") if box_end_idx is not None else None

        boxes.append({
            "top": round(ceiling_price, 2),
            "bottom": round(floor_price, 2),
            "width_pct": width_pct,
            "started": started_str,
            "ended": ended_str,
            "days": days_active,
            "breakout_date": breakout_date,
            "breakout_confirmed": bool(breakout_confirmed),
            "breakdown": bool(breakdown),
        })

    # Deduplicate boxes with the same top price (keep longest/latest)
    # Sort newest first (by started date descending), then cap at 5
    boxes.sort(key=lambda b: b["started"], reverse=True)

    # Deduplicate: skip boxes whose top is very close (<0.5%) to an already-included box
    deduped: list[dict] = []
    for box in boxes:
        is_dup = any(
            abs(box["top"] - kept["top"]) / kept["top"] < 0.005
            for kept in deduped
        )
        if not is_dup:
            deduped.append(box)
        if len(deduped) >= 5:
            break

    return deduped


# ─────────────────────────── public API ──────────────────────────────────────

def get_darvas(symbol: str, name: str | None = None, session=None) -> dict | None:
    """
    Main entry point. Returns Darvas Box analysis for the symbol.
    Cached 24 h keyed by IST date. Returns None if data fetch fails.

    Pass a curl_cffi `session` to use Chrome TLS fingerprinting (required in
    production where Yahoo Finance blocks plain requests).
    """
    cached = _get_cached(symbol)
    if cached:
        return cached

    display_name = name or symbol.replace(".NS", "").replace(".BO", "")

    try:
        df = _fetch_data(symbol, session=session)
        if df is None:
            return None

        boxes = _find_boxes(df)

        # Current price and volume stats
        price_now = float(df["Close"].iloc[-1])
        last_vol = float(df["Volume"].iloc[-1])
        vol_20d_avg = float(df["Volume"].tail(20).mean()) if len(df) >= 20 else last_vol

        # ── determine status ─────────────────────────────────────────────────
        if not boxes:
            status = "no_box"
            current_box_info = None
            breakout_info = {
                "confirmed": False,
                "price_triggered": False,
                "volume_confirmed": False,
                "date": None,
            }
            stop_loss = None
        else:
            latest = boxes[0]
            box_top = latest["top"]
            box_bottom = latest["bottom"]

            # Only consider the latest box "active" if it hasn't ended (ended is None)
            # or if the last bar is within the box or post-breakout
            price_triggered = price_now > box_top
            volume_confirmed = price_triggered and (last_vol > 1.5 * vol_20d_avg if vol_20d_avg > 0 else False)
            broke_down = price_now < box_bottom

            if price_triggered:
                status = "breakout"
            elif broke_down:
                status = "below_box"
            elif (box_top - price_now) / box_top <= 0.02:
                status = "approaching"
            else:
                status = "in_box"

            # proximity_pct: % below ceiling (negative means above ceiling = breakout)
            proximity_pct = round((box_top - price_now) / box_top * 100, 2)
            volume_ratio = round(last_vol / vol_20d_avg, 2) if vol_20d_avg > 0 else 1.0

            # Find box start index
            box_started = latest["started"]

            current_box_info = {
                "top": box_top,
                "bottom": box_bottom,
                "width_pct": latest["width_pct"],
                "days_active": latest["days"],
                "started": box_started,
                "price_now": round(price_now, 2),
                "proximity_pct": proximity_pct,
                "volume_ratio": volume_ratio,
            }

            breakout_info = {
                "confirmed": bool(latest["breakout_confirmed"] or (price_triggered and volume_confirmed)),
                "price_triggered": bool(price_triggered),
                "volume_confirmed": bool(volume_confirmed),
                "date": latest["breakout_date"],
            }
            stop_loss = round(box_bottom, 2) if not broke_down else None

        result: dict = {
            "symbol": symbol,
            "name": display_name,
            "status": status,
            "status_label": STATUS_LABELS[status],
            "current_box": current_box_info,
            "breakout": breakout_info,
            "stop_loss": stop_loss,
            "boxes": boxes,
            "as_of": _today_ist(),
        }

        _set_cached(symbol, result)
        return result

    except Exception as exc:
        log.warning("darvas: computation failed for %s: %s", symbol, exc)
        return None
