"""
Core indicator math — EMA, VWAP, RS, momentum, delivery.

Pure computation: no FastAPI, no network calls, no side effects.
All functions take pandas Series/DataFrames and return plain dicts.

FinanceAgent owns the calibration of these signals.
TechAgent owns the implementation.
"""
from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from fastapi import HTTPException

TAIL_SPARK_LEN = 90            # bars to ship to frontend


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


def delivery_real(symbol: str, close_yf: pd.Series, get_delivery_series_fn, delivery_trend_fn) -> dict[str, Any]:
    """Compute real delivery-regime signal from NSE bhavcopy history.
    Falls back to neutral (score=0) for indices or on failure, so the API
    stays robust even when NSE archives are misbehaving.

    get_delivery_series_fn and delivery_trend_fn are injected to keep
    services/core/ free of any services/data/ imports.
    """
    rows = get_delivery_series_fn(symbol, n_trading_days=30)
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

    # Blend 5-day delivery-trend slope (OLS) into the raw regime score.
    _trend_result = None
    try:
        _trend_result = delivery_trend_fn(symbol)
    except Exception:
        pass
    if _trend_result is not None:
        score = round(0.65 * score + 0.35 * _trend_result["score"], 2)
        score = clamp(score)

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
        "delivery_trend": _trend_result,
    }


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
