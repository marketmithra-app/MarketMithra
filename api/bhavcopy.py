"""
NSE daily bhavcopy fetcher with on-disk cache.

Source: https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_DDMMYYYY.csv

Columns: SYMBOL, SERIES, DATE1, PREV_CLOSE, OPEN_PRICE, HIGH_PRICE, LOW_PRICE,
         LAST_PRICE, CLOSE_PRICE, AVG_PRICE, TTL_TRD_QNTY, TURNOVER_LACS,
         NO_OF_TRADES, DELIV_QTY, DELIV_PER

The `DELIV_PER` column is the delivery percentage — shares that actually
changed hands, as a % of total traded. This is the Indian-market-unique
signal we want for accumulation/distribution reads.

Public API:
    - fetch_bhavcopy(d)         : raw DataFrame for a single trading day
    - get_delivery_series(sym)  : per-day delivery% history (oldest-first)
    - delivery_trend(sym, n)    : aggregated trend stats + fusion score over
                                  the last `n` trading days (rising/flat/
                                  falling with accumulation vs distribution
                                  scoring). Detects institutional flow shifts
                                  that a single-day delivery% reading misses.
"""
from __future__ import annotations

import io
import logging
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from curl_cffi import requests as curl_requests

log = logging.getLogger(__name__)

_CACHE_DIR = Path(__file__).parent / "cache" / "bhavcopy"
_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# In-memory DataFrame cache — keyed by date ISO string.
# Each trading day's bhavcopy CSV is ~300 KB and parses in ~80 ms.
# With 49 stocks × up to 60 calendar days per /ranked call, caching in RAM
# cuts ~2,900 disk reads + CSV parses down to at most ~30 (one per unique date).
_df_cache: dict[str, "pd.DataFrame | None"] = {}

_BHAVCOPY_URL = (
    "https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_{ddmmyyyy}.csv"
)

# Single long-lived session; NSE requires a cookie set from nseindia.com before
# archives will respond reliably.
_session: curl_requests.Session | None = None


def _get_session() -> curl_requests.Session:
    global _session
    if _session is None:
        s = curl_requests.Session(impersonate="chrome")
        try:
            s.get("https://www.nseindia.com", timeout=10)
        except Exception as e:
            log.warning(f"NSE cookie bootstrap failed: {e}")
        _session = s
    return _session


def _cache_path(d: date) -> Path:
    return _CACHE_DIR / f"{d.isoformat()}.csv"


def fetch_bhavcopy(d: date) -> "pd.DataFrame | None":
    """Return the bhavcopy DataFrame for date `d`, or None if unavailable
    (weekend, holiday, NSE outage). Uses in-memory cache backed by on-disk
    cache. NEVER raises on miss."""
    key = d.isoformat()

    # Fast path: already parsed this session.
    if key in _df_cache:
        return _df_cache[key]

    result = _fetch_bhavcopy_uncached(d)
    _df_cache[key] = result
    return result


def _fetch_bhavcopy_uncached(d: date) -> "pd.DataFrame | None":
    """Internal: fetch from disk or network, with no memory-cache layer."""
    cache = _cache_path(d)
    if cache.exists():
        if cache.stat().st_size == 0:
            # Negative cache — we've learned this date has no data.
            return None
        try:
            return _read_csv(cache.read_bytes())
        except Exception as e:
            log.warning(f"corrupt cache for {d}: {e} — refetching")
            cache.unlink(missing_ok=True)

    # Weekends: don't even try.
    if d.weekday() >= 5:
        cache.write_bytes(b"")
        return None

    url = _BHAVCOPY_URL.format(ddmmyyyy=d.strftime("%d%m%Y"))
    try:
        r = _get_session().get(url, timeout=20)
    except Exception as e:
        log.warning(f"bhavcopy fetch error {d}: {e}")
        return None

    if r.status_code != 200 or len(r.content) < 2000:
        # holiday / not-yet-published → negative-cache
        cache.write_bytes(b"")
        return None

    cache.write_bytes(r.content)
    try:
        return _read_csv(r.content)
    except Exception as e:
        log.warning(f"parse error {d}: {e}")
        cache.unlink(missing_ok=True)
        return None


def _read_csv(raw: bytes) -> pd.DataFrame:
    df = pd.read_csv(io.BytesIO(raw))
    # NSE ships leading spaces in column names.
    df.columns = [c.strip() for c in df.columns]
    # String cols too.
    for col in ("SYMBOL", "SERIES"):
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip()
    # Delivery cols are sometimes strings with '-' for debt / gsec.
    for col in ("DELIV_QTY", "DELIV_PER"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def get_delivery_series(symbol: str, n_trading_days: int = 30) -> list[dict]:
    """Return up to `n_trading_days` of recent delivery data for `symbol`,
    oldest first. Stops after walking back 60 calendar days regardless."""
    sym = symbol.upper().replace(".NS", "").replace(".BO", "")
    series = "EQ"
    if sym.startswith("^"):
        # Index — no delivery data.
        return []

    out: list[dict] = []
    d = date.today()
    walked = 0
    while len(out) < n_trading_days and walked < 60:
        df = fetch_bhavcopy(d)
        if df is not None and "SYMBOL" in df.columns:
            row = df[(df["SYMBOL"] == sym) & (df["SERIES"] == series)]
            if not row.empty:
                r = row.iloc[0]
                out.append(
                    {
                        "date": d.isoformat(),
                        "deliveryPct": float(r["DELIV_PER"])
                        if pd.notna(r["DELIV_PER"])
                        else None,
                        "close": float(r["CLOSE_PRICE"]) if pd.notna(r["CLOSE_PRICE"]) else None,
                    }
                )
        d -= timedelta(days=1)
        walked += 1

    out.reverse()  # oldest first
    return out


def delivery_trend(symbol: str, window: int = 5) -> dict | None:
    """Aggregate the last `window` trading days of delivery% into a trend.

    Reuses `get_delivery_series` (which itself reuses `fetch_bhavcopy`'s
    in-RAM + on-disk cache) so no second cache layer is introduced. Days
    where NSE was closed or where `DELIV_PER` is missing are skipped.

    Returns None when fewer than 3 valid days of delivery% data are
    available inside the window — fail closed rather than infer a trend
    from a single point.

    Output schema:
        {
            "window_days":        int,    # valid days used (<= window)
            "latest_pct":         float,  # most recent delivery %
            "mean_pct":           float,  # mean over window
            "slope_pct_per_day":  float,  # OLS slope of delivery% vs day idx
            "direction":          "rising" | "falling" | "flat",
            "score":              float,  # [-1, +1] fusion-ready score
        }
    """
    if window < 3:
        # With <3 days there's no meaningful slope — fail closed.
        return None

    # Pull a touch more than `window` in case some days are missing
    # delivery data even though the bhavcopy exists.
    series = get_delivery_series(symbol, n_trading_days=window)
    if not series:
        return None

    # Keep only points that actually carry a delivery% number, then take
    # the most-recent `window` of those. `get_delivery_series` returns
    # oldest-first, so slicing from the tail gives us the latest window.
    valid = [p for p in series if p.get("deliveryPct") is not None]
    if len(valid) < 3:
        return None
    valid = valid[-window:]

    pcts = [float(p["deliveryPct"]) for p in valid]
    n = len(pcts)

    xs = np.arange(n, dtype=float)
    ys = np.asarray(pcts, dtype=float)
    # polyfit(deg=1) returns [slope, intercept].
    slope, _intercept = np.polyfit(xs, ys, 1)
    slope = float(slope)

    # Bucket slope using a ±0.5 pct-points/day deadband: random day-to-day
    # jitter on a Nifty 50 stock easily spans a few pct points, so anything
    # inside ±0.5/day is noise, not trend.
    if slope > 0.5:
        direction = "rising"
    elif slope < -0.5:
        direction = "falling"
    else:
        direction = "flat"

    latest_pct = float(pcts[-1])
    mean_pct = float(sum(pcts) / n)

    # Fusion score — checked in strength order so the stronger bucket wins.
    if direction == "rising" and latest_pct >= 45:
        score = 1.0
    elif direction == "rising" and latest_pct >= 30:
        score = 0.5
    elif direction == "falling" and latest_pct <= 25:
        score = -1.0
    elif direction == "falling" and latest_pct <= 40:
        score = -0.5
    else:
        score = 0.0

    return {
        "window_days": n,
        "latest_pct": latest_pct,
        "mean_pct": mean_pct,
        "slope_pct_per_day": slope,
        "direction": direction,
        "score": score,
    }
