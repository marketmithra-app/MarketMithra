"""
stock_dna.py — Stock personality fingerprint for Nifty 50 symbols.

Computes a "DNA" profile from 3 years of daily OHLCV data:
  - Beta vs Nifty (1-year)
  - Correlation with Nifty (1-year)
  - Volatility rank via ATR%
  - Gap frequency
  - Monthly seasonality
  - Momentum autocorrelation (trend persistence)
  - Max drawdown + recovery days

Results are classified into one of six personality types and cached in
SQLite for 24 hours (keyed by IST date).
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

# ─────────────────────────── SQLite cache ───────────────────────────────────

_DB_PATH = Path(__file__).parent / "data" / "verdict_history.db"

_IST = timezone(timedelta(hours=5, minutes=30))


def _today_ist() -> str:
    return datetime.now(_IST).strftime("%Y-%m-%d")


def _db_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(_DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS stock_dna_cache (
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
            "SELECT payload FROM stock_dna_cache WHERE symbol = ? AND date_ymd = ?",
            (symbol, today),
        ).fetchone()
        conn.close()
        if row:
            return json.loads(row[0])
    except Exception as exc:
        log.warning("stock_dna cache read failed for %s: %s", symbol, exc)
    return None


def _set_cached(symbol: str, data: dict) -> None:
    try:
        conn = _db_conn()
        conn.execute(
            """
            INSERT OR REPLACE INTO stock_dna_cache
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
        log.warning("stock_dna cache write failed for %s: %s", symbol, exc)


# ─────────────────────────── data fetching ──────────────────────────────────

def _fetch_data(symbol: str, session=None) -> tuple[pd.DataFrame, pd.DataFrame] | tuple[None, None]:
    """
    Download 3 years of daily OHLCV for symbol + ^NSEI benchmark.
    Returns (stock_df, nifty_df) or (None, None) on failure.
    Both DataFrames have a DatetimeIndex and at minimum a 'Close' column.

    Pass a curl_cffi session to bypass Yahoo Finance bot detection in production.
    """
    try:
        kwargs: dict = dict(
            period="3y",
            auto_adjust=True,
            progress=False,
            group_by="ticker",
        )
        if session is not None:
            kwargs["session"] = session
        tickers = yf.download([symbol, "^NSEI"], **kwargs)
        # yfinance column layout can vary; guard against missing ticker key
        if symbol not in tickers.columns.get_level_values(0):
            return None, None
        stock = tickers[symbol][["Open", "High", "Low", "Close", "Volume"]].dropna()
        nifty = tickers["^NSEI"][["Close"]].dropna()
        if len(stock) < 100:
            return None, None
        return stock, nifty
    except Exception as exc:
        log.warning("stock_dna fetch failed for %s: %s", symbol, exc)
        return None, None


# ─────────────────────────── metric helpers ──────────────────────────────────

def _beta(stock_close: pd.Series, nifty_close: pd.Series) -> float:
    aligned = pd.concat([stock_close, nifty_close], axis=1).dropna()
    aligned.columns = ["s", "n"]
    rets = aligned.pct_change().dropna().tail(252)
    if len(rets) < 60:
        return 1.0
    cov = np.cov(rets["s"], rets["n"])
    # guard against zero variance in index (shouldn't happen, but be safe)
    var_n = cov[1, 1]
    if var_n == 0:
        return 1.0
    return round(float(cov[0, 1] / var_n), 2)


def _correlation(stock_close: pd.Series, nifty_close: pd.Series) -> float:
    aligned = pd.concat([stock_close, nifty_close], axis=1).dropna()
    rets = aligned.pct_change().dropna().tail(252)
    if len(rets) < 60:
        return 0.5
    return round(float(rets.iloc[:, 0].corr(rets.iloc[:, 1])), 2)


def _volatility(stock_df: pd.DataFrame) -> tuple[float, str]:
    df = stock_df.tail(252).copy()
    tr = pd.concat(
        [
            df["High"] - df["Low"],
            (df["High"] - df["Close"].shift()).abs(),
            (df["Low"] - df["Close"].shift()).abs(),
        ],
        axis=1,
    ).max(axis=1)
    avg_atr_pct = round(float((tr / df["Close"]).mean() * 100), 2)
    if avg_atr_pct < 1.5:
        rank = "Low"
    elif avg_atr_pct < 2.5:
        rank = "Medium"
    else:
        rank = "High"
    return avg_atr_pct, rank


def _gap_frequency(stock_df: pd.DataFrame) -> float:
    df = stock_df.tail(252).copy()
    prev_close = df["Close"].shift(1)
    gap_pct = ((df["Open"] - prev_close) / prev_close).abs().dropna()
    return round(float((gap_pct > 0.01).mean()), 3)


def _seasonality(stock_close: pd.Series) -> dict[str, float]:
    # Resample to month-end prices then compute monthly % returns.
    # Gives "what % does this stock typically move in January" — not a daily avg.
    monthly_close = stock_close.resample("ME").last().dropna()
    monthly_rets = monthly_close.pct_change().dropna() * 100
    monthly_rets.index = pd.to_datetime(monthly_rets.index)
    by_month = monthly_rets.groupby(monthly_rets.index.month).mean().round(2)
    month_names = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ]
    return {month_names[m - 1]: float(by_month.get(m, 0.0)) for m in range(1, 13)}


def _momentum_persistence(stock_close: pd.Series) -> float:
    rets = stock_close.pct_change().dropna().tail(252)
    if len(rets) < 60:
        return 0.0
    ac = float(rets.autocorr(lag=1))
    # autocorr can return NaN on degenerate series
    return round(ac if not pd.isna(ac) else 0.0, 3)


def _drawdown_profile(stock_close: pd.Series) -> tuple[float, int]:
    roll_max = stock_close.cummax()
    dd = (stock_close - roll_max) / roll_max
    max_dd = round(float(dd.min() * 100), 1)  # negative number

    trough_idx = dd.idxmin()
    after_trough = stock_close.loc[trough_idx:]
    peak_val = float(roll_max.loc[trough_idx])
    recovery_mask = after_trough >= peak_val
    if recovery_mask.any():
        recovery_ts = recovery_mask.idxmax()
        try:
            recovery_days = int((recovery_ts - trough_idx).days)
        except Exception:
            recovery_days = -1
    else:
        recovery_days = -1  # still in drawdown or no new high in window

    return max_dd, recovery_days


# ─────────────────────────── personality classifier ──────────────────────────

PERSONALITY_TYPES: dict[str, dict[str, str]] = {
    "Defensive Compounder": {
        "icon": "🛡",
        "color": "emerald",
        "tagline": "Steady returns in all seasons",
    },
    "Momentum Rocket": {
        "icon": "🚀",
        "color": "amber",
        "tagline": "Fast-moving, FII-driven, high conviction",
    },
    "Steady Grinder": {
        "icon": "⚙️",
        "color": "sky",
        "tagline": "Reliable, Nifty-correlated, low surprises",
    },
    "Volatile Wild Card": {
        "icon": "⚡",
        "color": "rose",
        "tagline": "High energy, unpredictable, trader's stock",
    },
    "Macro Bet": {
        "icon": "🌍",
        "color": "violet",
        "tagline": "Budget and rate cycle sensitive",
    },
    "Balanced Player": {
        "icon": "⚖️",
        "color": "slate",
        "tagline": "No dominant trait — adapts to conditions",
    },
}


def _classify(
    beta: float,
    volatility_rank: str,
    gap_freq: float,
    correlation: float,
) -> str:
    if beta < 0.80 and volatility_rank == "Low":
        return "Defensive Compounder"
    if beta > 1.25 and gap_freq > 0.12:
        return "Momentum Rocket"
    if volatility_rank == "High" and gap_freq > 0.15:
        return "Volatile Wild Card"
    if correlation > 0.82 and volatility_rank in ("Low", "Medium"):
        return "Steady Grinder"
    if beta > 1.10 and correlation < 0.72:
        return "Macro Bet"
    return "Balanced Player"


# ─────────────────────────── narrative builder ───────────────────────────────

def _narrative(
    symbol: str,
    name: str,
    ptype: str,
    beta: float,
    best_months: list[str],
    worst_months: list[str],
    volatility_rank: str,
    max_dd: float,
) -> str:
    beta_desc = (
        "lower than Nifty" if beta < 0.9
        else ("higher than Nifty" if beta > 1.1 else "in line with Nifty")
    )
    month_str = " and ".join(best_months[:2]) if best_months else "mixed months"
    worst_str = " and ".join(worst_months[:1]) if worst_months else "no clear weak period"
    vol_desc = {
        "Low": "low volatility",
        "Medium": "moderate volatility",
        "High": "high volatility",
    }.get(volatility_rank, "moderate volatility")
    return (
        f"{name} trades as a {ptype.lower()} — its beta of {beta} is {beta_desc}. "
        f"Historically, {month_str} tend to be the strongest months, while {worst_str} sees more pressure. "
        f"It exhibits {vol_desc} with a max 3-year drawdown of {abs(max_dd):.1f}%. "
        f"Use this profile to anticipate how {name} typically behaves across different market phases."
    )


# ─────────────────────────── public API ──────────────────────────────────────

def get_stock_dna(symbol: str, name: str | None = None, session=None) -> dict | None:
    """
    Main entry point. Returns cached result if available (24 h TTL, keyed by
    IST date). Returns None if data fetch fails entirely.

    `name` is optional display name; falls back to symbol stem if omitted.
    Pass a curl_cffi `session` to use Chrome TLS fingerprinting (required in
    production where Yahoo Finance blocks plain requests).
    """
    cached = _get_cached(symbol)
    if cached:
        return cached

    display_name = name or symbol.replace(".NS", "").replace(".BO", "")

    stock_df, nifty_df = _fetch_data(symbol, session=session)
    if stock_df is None or nifty_df is None:
        log.warning("stock_dna: no usable data for %s", symbol)
        return None

    stock_close = stock_df["Close"]
    nifty_close = nifty_df["Close"]

    # ── compute metrics ──────────────────────────────────────────────────────
    beta = _beta(stock_close, nifty_close)
    correlation = _correlation(stock_close, nifty_close)
    avg_atr_pct, volatility_rank = _volatility(stock_df)
    gap_freq = _gap_frequency(stock_df)
    seasonality = _seasonality(stock_close)
    momentum_ac = _momentum_persistence(stock_close)
    max_dd, recovery_days = _drawdown_profile(stock_close)

    # ── best/worst months ────────────────────────────────────────────────────
    sorted_months = sorted(seasonality.items(), key=lambda x: x[1], reverse=True)
    best_months = [m for m, _ in sorted_months[:3]]
    worst_months = [m for m, _ in sorted_months[-3:]][::-1]  # worst first

    # ── personality ──────────────────────────────────────────────────────────
    ptype = _classify(beta, volatility_rank, gap_freq, correlation)
    pinfo = PERSONALITY_TYPES[ptype]

    # ── narrative ────────────────────────────────────────────────────────────
    narrative = _narrative(
        symbol=symbol,
        name=display_name,
        ptype=ptype,
        beta=beta,
        best_months=best_months,
        worst_months=worst_months,
        volatility_rank=volatility_rank,
        max_dd=max_dd,
    )

    # ── approximate data years from row count ────────────────────────────────
    data_years = round(len(stock_df) / 252, 1)

    result: dict = {
        "symbol": symbol,
        "name": display_name,
        "personality_type": ptype,
        "personality_icon": pinfo["icon"],
        "personality_color": pinfo["color"],
        "tagline": pinfo["tagline"],
        "narrative": narrative,
        "stats": {
            "beta": beta,
            "correlation_nifty": correlation,
            "avg_atr_pct": avg_atr_pct,
            "volatility_rank": volatility_rank,
            "gap_frequency": gap_freq,
            "momentum_persistence": momentum_ac,
            "max_drawdown_pct": max_dd,
            "recovery_days": recovery_days,
            "data_years": data_years,
        },
        "seasonality": seasonality,
        "best_months": best_months,
        "worst_months": worst_months,
        "as_of": _today_ist(),
    }

    _set_cached(symbol, result)
    return result
