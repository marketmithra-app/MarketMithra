"""
Relative Rotation Graph (RRG) — sector rotation analytics.

Inspired by Julius de Kempenaer's RRG methodology: plot each sector's
relative strength vs a benchmark (Nifty 50) on the X-axis, and the rate
of change of that relative strength on the Y-axis. Both are normalized
cross-sectionally so the chart centres on (100, 100) and sectors are
comparable to each other.

Quadrants (clockwise):
    Leading    (top-right)    — high RS, rising momentum
    Weakening  (bottom-right) — high RS, falling momentum
    Lagging    (bottom-left)  — low RS, falling momentum
    Improving  (top-left)     — low RS, rising momentum

A "tail" of the last N weekly snapshots lets the user see which way a
sector is rotating (counter-clockwise is unusual and often signals a
head-fake move).
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd

log = logging.getLogger("marketmithra.rrg")

# ─── Nifty 50 sector mapping ────────────────────────────────────────────────
# Kept in sync with web/src/lib/tickers.ts (human-edited, not auto-generated
# because the frontend list includes non-Nifty-50 stocks we don't load here).
SECTOR_MAP: dict[str, str] = {
    # Banks
    "HDFCBANK.NS":   "Bank",
    "ICICIBANK.NS":  "Bank",
    "SBIN.NS":       "Bank",
    "KOTAKBANK.NS":  "Bank",
    "AXISBANK.NS":   "Bank",
    "INDUSINDBK.NS": "Bank",
    "IDFCFIRSTB.NS": "Bank",
    # IT
    "TCS.NS":        "IT",
    "INFY.NS":       "IT",
    "HCLTECH.NS":    "IT",
    "WIPRO.NS":      "IT",
    "TECHM.NS":      "IT",
    # Auto
    "MARUTI.NS":     "Auto",
    "TMCV.NS":       "Auto",
    "M&M.NS":        "Auto",
    "EICHERMOT.NS":  "Auto",
    "HEROMOTOCO.NS": "Auto",
    "BAJAJ-AUTO.NS": "Auto",
    # FMCG
    "HINDUNILVR.NS": "FMCG",
    "ITC.NS":        "FMCG",
    "NESTLEIND.NS":  "FMCG",
    "BRITANNIA.NS":  "FMCG",
    "TATACONSUM.NS": "FMCG",
    # Pharma / Healthcare
    "SUNPHARMA.NS":  "Pharma",
    "DRREDDY.NS":    "Pharma",
    "CIPLA.NS":      "Pharma",
    "DIVISLAB.NS":   "Pharma",
    "APOLLOHOSP.NS": "Healthcare",
    # Energy / Oil & Gas
    "RELIANCE.NS":   "Energy",
    "ONGC.NS":       "Energy",
    "COALINDIA.NS":  "Energy",
    "BPCL.NS":       "Energy",
    # Power
    "NTPC.NS":       "Power",
    "POWERGRID.NS":  "Power",
    # Metals
    "TATASTEEL.NS":  "Metals",
    "JSWSTEEL.NS":   "Metals",
    # NBFC / Insurance / Finance
    "BAJFINANCE.NS": "NBFC",
    "BAJAJFINSV.NS": "NBFC",
    "SHRIRAMFIN.NS": "NBFC",
    "HDFCLIFE.NS":   "Insurance",
    "SBILIFE.NS":    "Insurance",
    # Cement / Materials
    "ULTRACEMCO.NS": "Cement",
    "GRASIM.NS":     "Cement",
    "ASIANPAINT.NS": "Materials",
    # Consumer / Retail
    "TITAN.NS":      "Consumer",
    # Telecom
    "BHARTIARTL.NS": "Telecom",
    # Infra / Construction / Ports
    "LT.NS":         "Construction",
    "ADANIPORTS.NS": "Infra",
    "ADANIENT.NS":   "Conglomerate",
}

# ─── Tuning knobs ───────────────────────────────────────────────────────────
MIN_STOCKS_PER_SECTOR = 2     # singletons are too noisy to plot
RS_SMOOTH_WINDOW = 10         # short SMA on raw RS
MOMENTUM_LOOKBACK = 20        # bars for rate-of-change of RS
TRAIL_WEEKS = 8               # how many past snapshots in the tail
TRAIL_STRIDE_DAYS = 5         # 1 trading week


def _sector_series(sector_stocks: dict[str, pd.Series]) -> pd.Series:
    """Equal-weight synthetic sector price: geometric mean of each stock's
    close normalized to 1.0 at its first bar. This weighs each constituent
    equally regardless of price level, which is what RRG wants for breadth.
    """
    normed = []
    for close in sector_stocks.values():
        c = close.dropna()
        if c.empty or c.iloc[0] <= 0:
            continue
        normed.append(c / c.iloc[0])
    if not normed:
        return pd.Series(dtype=float)
    # Align on common index, geometric mean
    df = pd.concat(normed, axis=1, join="inner")
    # geo mean = exp(mean(log))
    gm = np.exp(np.log(df).mean(axis=1))
    return gm


def _zscore_rescale(
    series_by_label: dict[str, pd.Series],
    date_index: pd.Index,
) -> dict[str, pd.Series]:
    """At each date, compute cross-sectional z-score across labels, then
    rescale to mean=100, std=5 so the chart lives near (100, 100) with
    readable spread.

    A sector whose value is missing at date t just gets NaN for that t.
    """
    # Build a DataFrame: index = dates, columns = labels
    aligned = {k: s.reindex(date_index) for k, s in series_by_label.items()}
    df = pd.DataFrame(aligned)
    # Cross-sectional mean and std per row (axis=1), ignoring NaN
    row_mean = df.mean(axis=1, skipna=True)
    row_std = df.std(axis=1, skipna=True).replace(0, np.nan)
    z = df.sub(row_mean, axis=0).div(row_std, axis=0)
    rescaled = z * 5 + 100  # mean 100, std 5
    return {col: rescaled[col].dropna() for col in rescaled.columns}


def compute_rrg(
    closes_by_symbol: dict[str, pd.Series],
    benchmark_close: pd.Series,
) -> list[dict[str, Any]]:
    """Compute RRG positions (current + trail) for every sector that has
    at least `MIN_STOCKS_PER_SECTOR` constituents in the universe.

    Parameters
    ----------
    closes_by_symbol : dict[str, pd.Series]
        Map of stock symbol → daily close series (already cached upstream).
    benchmark_close : pd.Series
        Daily close of the benchmark index (Nifty 50).

    Returns
    -------
    List of sector rows, each:
        {
            sector: str,
            stockCount: int,
            rsRatio: float,         # current
            rsMomentum: float,      # current
            quadrant: "leading"|"weakening"|"lagging"|"improving",
            trail: [{rsRatio, rsMomentum}, ...]  # oldest first
        }
    """
    # 1. Group symbols by sector and build synthetic sector price series
    by_sector: dict[str, dict[str, pd.Series]] = {}
    for sym, close in closes_by_symbol.items():
        sector = SECTOR_MAP.get(sym)
        if not sector:
            continue
        by_sector.setdefault(sector, {})[sym] = close

    sector_prices: dict[str, pd.Series] = {}
    sector_counts: dict[str, int] = {}
    for sector, stocks in by_sector.items():
        if len(stocks) < MIN_STOCKS_PER_SECTOR:
            continue
        series = _sector_series(stocks)
        if series.empty:
            continue
        sector_prices[sector] = series
        sector_counts[sector] = len(stocks)

    if not sector_prices:
        return []

    # 2. Compute raw RS = sector / benchmark, aligned
    bench = benchmark_close.dropna()
    bench_norm = bench / bench.iloc[0]
    rs_by_sector: dict[str, pd.Series] = {}
    for sector, price in sector_prices.items():
        aligned = pd.concat([price, bench_norm], axis=1, join="inner").dropna()
        aligned.columns = ["s", "b"]
        rs = aligned["s"] / aligned["b"]
        rs_sm = rs.rolling(RS_SMOOTH_WINDOW, min_periods=RS_SMOOTH_WINDOW).mean()
        rs_by_sector[sector] = rs_sm.dropna()

    if not rs_by_sector:
        return []

    # 3. Compute raw momentum = rate of change of smoothed RS
    mom_by_sector: dict[str, pd.Series] = {}
    for sector, rs in rs_by_sector.items():
        past = rs.shift(MOMENTUM_LOOKBACK)
        rate = (rs - past) / past
        mom_by_sector[sector] = rate.dropna()

    # 4. Build a common date index (intersection of all sectors' momentum)
    common_dates = None
    for s in mom_by_sector.values():
        idx = s.index
        common_dates = idx if common_dates is None else common_dates.intersection(idx)
    if common_dates is None or len(common_dates) == 0:
        return []
    common_dates = common_dates.sort_values()

    # 5. Cross-sectionally normalize RS-Ratio and RS-Momentum to (100, 5)
    ratio_rescaled = _zscore_rescale(rs_by_sector, common_dates)
    mom_rescaled = _zscore_rescale(mom_by_sector, common_dates)

    # 6. Pick trail timestamps: last TRAIL_WEEKS weekly bars ending on latest
    trail_idx = []
    last = common_dates[-1]
    # Walk backwards TRAIL_STRIDE_DAYS at a time
    for k in range(TRAIL_WEEKS):
        target_pos = len(common_dates) - 1 - k * TRAIL_STRIDE_DAYS
        if target_pos < 0:
            break
        trail_idx.append(common_dates[target_pos])
    trail_idx.reverse()  # oldest first

    # 7. Assemble per-sector rows
    rows: list[dict[str, Any]] = []
    for sector in sorted(sector_prices.keys()):
        r_series = ratio_rescaled.get(sector)
        m_series = mom_rescaled.get(sector)
        if r_series is None or m_series is None:
            continue

        trail = []
        for ts in trail_idx:
            r = r_series.get(ts)
            m = m_series.get(ts)
            if r is None or m is None or pd.isna(r) or pd.isna(m):
                continue
            trail.append({"rsRatio": round(float(r), 2), "rsMomentum": round(float(m), 2)})
        if len(trail) < 2:
            continue

        cur = trail[-1]
        q = _quadrant(cur["rsRatio"], cur["rsMomentum"])
        rows.append({
            "sector": sector,
            "stockCount": sector_counts[sector],
            "rsRatio": cur["rsRatio"],
            "rsMomentum": cur["rsMomentum"],
            "quadrant": q,
            "trail": trail,
        })
    return rows


def _quadrant(ratio: float, momentum: float) -> str:
    if ratio >= 100 and momentum >= 100:
        return "leading"
    if ratio >= 100 and momentum < 100:
        return "weakening"
    if ratio < 100 and momentum < 100:
        return "lagging"
    return "improving"
