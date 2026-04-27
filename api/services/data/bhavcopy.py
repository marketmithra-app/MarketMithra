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
from curl_cffi import requests as curl_requests  # browser TLS fingerprint needed for NSE

log = logging.getLogger(__name__)

_CACHE_DIR = Path(__file__).parent.parent.parent / "cache" / "bhavcopy"
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


# ─────────────────────────── NSE OHLCV history ──────────────────────────────
# Replaces yfinance for price history on Railway / cloud deployments where
# Yahoo Finance is blocked by Cloudflare.
#
# Strategy:
#   • Equity symbols  → assembled from daily bhavcopy CSV files (already
#     fetched + cached by the delivery% feature; zero extra HTTP surface).
#   • Index symbols   → NSE index-close archive CSV, one file per trading day:
#     https://nsearchives.nseindia.com/content/indices/ind_close_all_DDMMYYYY.csv
#     (same CDN domain as bhavcopy; proven to work from Railway).
#
# Public API:
#   get_nse_ohlcv(symbol, n_days)  → DataFrame[Open/High/Low/Close/Volume]
#                                    DatetimeIndex(Asia/Kolkata), oldest first
#                                    Returns None on unrecoverable error.

# Title-case names as they appear in ind_close_all_*.csv "Index Name" column.
_NSE_INDEX_MAP: dict[str, str] = {
    "^CRSLDX":   "Nifty 500",
    "^NSEI":     "Nifty 50",
    "^CNXNIFTY": "Nifty 50",
    "^NSEBANK":  "Nifty Bank",
    # BSE Sensex is not published by NSE; Nifty 50 is the nearest proxy.
    "^BSESN":    "Nifty 50",
}

# In-memory cache for index close CSVs — keyed by date ISO string.
_idx_cache: dict[str, "pd.DataFrame | None"] = {}

_INDEX_CSV_URL = (
    "https://nsearchives.nseindia.com/content/indices/"
    "ind_close_all_{ddmmyyyy}.csv"
)


def get_nse_ohlcv(symbol: str, n_days: int = 390) -> "pd.DataFrame | None":
    """Return daily OHLCV history assembled from NSE data sources.

    For equity symbols (RELIANCE.NS / RELIANCE): reads from bhavcopy CSVs,
    which are already downloaded and disk-cached by the delivery% pipeline.

    For index symbols (^NSEI / ^CRSLDX): reads from the NSE index-close
    archive CSV — one file per trading day, same CDN as bhavcopy.

    Args:
        symbol: 'RELIANCE.NS', 'RELIANCE', '^NSEI', '^CRSLDX', etc.
        n_days: calendar days of history to cover (default 390 ≈ 13 months).

    Returns:
        DataFrame with DatetimeIndex(tz=Asia/Kolkata) and columns
        Open / High / Low / Close / Volume — same shape as yfinance.history().
        Returns None when fewer than 5 valid rows are found.
    """
    sym = symbol.upper().replace(".NS", "").replace(".BO", "")

    if sym in _NSE_INDEX_MAP or sym.startswith("^"):
        return _get_index_ohlcv(sym, n_days)

    # ── equity: walk back over bhavcopy CSVs ────────────────────────────────
    target = min(int(n_days * 5 / 7) + 20, 320)   # ~260 trading days per year
    out: list[dict] = []
    d = date.today()
    walked = 0

    while len(out) < target and walked < n_days + 120:
        df = fetch_bhavcopy(d)
        if df is not None and "SYMBOL" in df.columns:
            row = df[(df["SYMBOL"] == sym) & (df["SERIES"] == "EQ")]
            if not row.empty:
                r = row.iloc[0]
                try:
                    out.append({
                        "Date":   pd.Timestamp(d).tz_localize("Asia/Kolkata"),
                        "Open":   float(r["OPEN_PRICE"]),
                        "High":   float(r["HIGH_PRICE"]),
                        "Low":    float(r["LOW_PRICE"]),
                        "Close":  float(r["CLOSE_PRICE"]),
                        "Volume": float(r.get("TTL_TRD_QNTY", 0) or 0),
                    })
                except (KeyError, ValueError, TypeError):
                    pass
        d -= timedelta(days=1)
        walked += 1

    if len(out) < 5:
        log.warning(f"get_nse_ohlcv: insufficient bhavcopy data for {sym} ({len(out)} rows)")
        return None

    out.reverse()  # walk was newest→oldest; flip to oldest→newest
    return pd.DataFrame(out).set_index("Date")


def _get_index_ohlcv(symbol: str, n_days: int) -> "pd.DataFrame | None":
    """Build index OHLCV from NSE ind_close_all_DDMMYYYY.csv archive files."""
    index_name = _NSE_INDEX_MAP.get(symbol, "Nifty 50")
    target = min(int(n_days * 5 / 7) + 20, 320)
    out: list[dict] = []
    d = date.today()
    walked = 0

    while len(out) < target and walked < n_days + 120:
        if d.weekday() < 5:  # skip weekends — no trading, no file
            csv_df = _fetch_index_csv(d)
            if csv_df is not None:
                row = csv_df[csv_df["Index Name"] == index_name]
                if not row.empty:
                    r = row.iloc[0]
                    try:
                        out.append({
                            "Date":   pd.Timestamp(d).tz_localize("Asia/Kolkata"),
                            "Open":   float(r.get("Open Index Value")  or r["Closing Index Value"]),
                            "High":   float(r.get("High Index Value")  or r["Closing Index Value"]),
                            "Low":    float(r.get("Low Index Value")   or r["Closing Index Value"]),
                            "Close":  float(r["Closing Index Value"]),
                            "Volume": float(r.get("Volume") or 0),
                        })
                    except (KeyError, ValueError, TypeError):
                        pass
        d -= timedelta(days=1)
        walked += 1

    if len(out) < 5:
        log.warning(f"get_nse_ohlcv: insufficient index data for {symbol} ({index_name}, {len(out)} rows)")
        return None

    out.reverse()
    return pd.DataFrame(out).set_index("Date")


def _fetch_index_csv(d: date) -> "pd.DataFrame | None":
    """Return the index-close CSV for date *d*, using in-memory + disk cache.

    Same cache discipline as fetch_bhavcopy: empty file = negative cache.
    """
    key = d.isoformat()
    if key in _idx_cache:
        return _idx_cache[key]

    result = _fetch_index_csv_uncached(d)
    _idx_cache[key] = result
    return result


def _fetch_index_csv_uncached(d: date) -> "pd.DataFrame | None":
    cache_dir = Path(__file__).parent.parent.parent / "cache" / "indices"
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / f"{d.isoformat()}.csv"

    if cache_file.exists():
        if cache_file.stat().st_size == 0:
            return None
        try:
            return pd.read_csv(cache_file)
        except Exception:
            cache_file.unlink(missing_ok=True)

    url = _INDEX_CSV_URL.format(ddmmyyyy=d.strftime("%d%m%Y"))
    try:
        r = _get_session().get(url, timeout=15)
    except Exception as exc:
        log.warning(f"index CSV fetch error {d}: {exc}")
        return None

    if r.status_code != 200 or len(r.content) < 500:
        cache_file.write_bytes(b"")   # negative cache
        return None

    cache_file.write_bytes(r.content)
    try:
        return pd.read_csv(io.BytesIO(r.content))
    except Exception as exc:
        log.warning(f"index CSV parse error {d}: {exc}")
        cache_file.unlink(missing_ok=True)
        return None
