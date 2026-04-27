# Sprint 1 — Agent Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganise `api/` into clean service packages, write agent CLAUDE.md files, and add a FinanceAgent accuracy audit script — all without breaking the live Railway deployment.

**Architecture:** Module-first strangler fig. Move files to `api/services/data/`, `api/services/ai/`, `api/services/core/` as Python packages with typed `__init__.py` interfaces. `main.py` imports only from those `__init__.py` files. No HTTP between services yet — same process, same Railway deploy, zero performance change.

**Tech Stack:** Python 3.11, FastAPI, SQLite (existing `history.py`), pytest, NSE bhavcopy data via `get_nse_ohlcv()`

**Objective:** MarketMithra must stand out as the most trusted, domain-correct Indian market signal platform. Every task here serves that goal — clean agent ownership means faster, higher-quality feature iteration.

---

## Pre-flight checks

- [ ] Confirm Railway deploy is live: `curl https://marketmithra-production.up.railway.app/health` → `{"status":"ok",...}`
- [ ] Confirm Vercel frontend loads canvas data (CORS was fixed in obs 79 — verify it's working)
- [ ] Confirm local tests pass: `cd api && python -m pytest` (or note if no tests exist yet)

---

## Task 1: Create service package scaffold

**Files:**
- Create: `api/services/__init__.py`
- Create: `api/services/data/__init__.py`
- Create: `api/services/data/CLAUDE.md`
- Create: `api/services/data/tests/__init__.py`
- Create: `api/services/ai/__init__.py`
- Create: `api/services/ai/CLAUDE.md`
- Create: `api/services/ai/tests/__init__.py`
- Create: `api/services/core/__init__.py`
- Create: `api/services/core/CLAUDE.md`
- Create: `api/services/core/tests/__init__.py`
- Create: `docs/finance/CLAUDE.md`
- Create: `docs/finance/accuracy-log.md`
- Create: `docs/finance/weight-history.md`
- Create: `docs/finance/scripts/.gitkeep`

- [ ] **Step 1: Create all directories**

```bash
cd api
mkdir -p services/data/tests
mkdir -p services/ai/tests
mkdir -p services/core/tests
cd ..
mkdir -p docs/finance/scripts
```

- [ ] **Step 2: Create empty `__init__.py` files**

```bash
touch api/services/__init__.py
touch api/services/data/__init__.py
touch api/services/data/tests/__init__.py
touch api/services/ai/__init__.py
touch api/services/ai/tests/__init__.py
touch api/services/core/__init__.py
touch api/services/core/tests/__init__.py
```

- [ ] **Step 3: Create `docs/finance/accuracy-log.md`**

```markdown
# FinanceAgent Accuracy Log

Weekly signal accuracy audit — MarketMithra BUY/SELL verdicts vs actual NSE price movement.

**Target:** >65% accuracy (15pp above ~50% random baseline)
**Alert threshold:** <55% triggers fusion weight review

---
```

- [ ] **Step 4: Create `docs/finance/weight-history.md`**

```markdown
# Fusion Weight History

Records all changes to `FUSION_WEIGHTS` in `services/core/fusion.py`.

| Date | rs | delivery | ema | momentum | volume | aiNews | Reason |
|---|---|---|---|---|---|---|---|
| 2026-04-27 | 0.20 | 0.20 | 0.18 | 0.17 | 0.15 | 0.10 | Initial baseline |
```

- [ ] **Step 5: Commit scaffold**

```bash
git add api/services/ docs/finance/
git commit -m "chore: create service package scaffold + FinanceAgent docs structure"
```

---

## Task 2: Move `bhavcopy.py` → `services/data/`

**Files:**
- Create: `api/services/data/bhavcopy.py` (moved from `api/bhavcopy.py`)
- Modify: `api/services/data/__init__.py` (add public interface)
- Modify: `api/main.py` (update import)
- Create: `api/services/data/tests/test_data_interface.py`

- [ ] **Step 1: Write the failing test**

Create `api/services/data/tests/test_data_interface.py`:

```python
"""Verify the data service public interface is importable and callable."""
import pytest


def test_data_package_exports_get_nse_ohlcv():
    from services.data import get_nse_ohlcv
    assert callable(get_nse_ohlcv)


def test_data_package_exports_get_delivery_series():
    from services.data import get_delivery_series
    assert callable(get_delivery_series)


def test_data_package_exports_delivery_trend():
    from services.data import delivery_trend
    assert callable(delivery_trend)
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd api && python -m pytest services/data/tests/test_data_interface.py -v
```

Expected: `ImportError: cannot import name 'get_nse_ohlcv' from 'services.data'`

- [ ] **Step 3: Copy `bhavcopy.py` to its new location**

```bash
cp api/bhavcopy.py api/services/data/bhavcopy.py
```

- [ ] **Step 4: Check for path references in the moved file**

Open `api/services/data/bhavcopy.py` and find any `Path(__file__).parent` cache references.
If the file uses `Path(__file__).parent / "cache"` or similar, update it to use an explicit api-relative path:

```python
# Find this pattern:
_CACHE_DIR = Path(__file__).parent / "cache"

# Replace with (two levels up from services/data/ to reach api/):
_CACHE_DIR = Path(__file__).parent.parent.parent / "cache"
```

Run this grep to find all Path references in the moved file:
```bash
grep -n "Path(__file__)" api/services/data/bhavcopy.py
```

Update any paths that point to the wrong location after the move.

- [ ] **Step 5: Write `services/data/__init__.py` public interface**

```python
"""
Data service public interface.

Only import from this file in main.py — never import directly from
services/data/bhavcopy.py or any other submodule.
"""
from services.data.bhavcopy import get_delivery_series, delivery_trend, get_nse_ohlcv

__all__ = ["get_delivery_series", "delivery_trend", "get_nse_ohlcv"]
```

- [ ] **Step 6: Run test — should pass now**

```bash
cd api && python -m pytest services/data/tests/test_data_interface.py -v
```

Expected: `3 passed`

- [ ] **Step 7: Update `main.py` import**

Find line ~47 in `api/main.py`:
```python
from bhavcopy import get_delivery_series, delivery_trend, get_nse_ohlcv
```

Replace with:
```python
from services.data import get_delivery_series, delivery_trend, get_nse_ohlcv
```

- [ ] **Step 8: Verify API still starts**

```bash
cd api && uvicorn main:app --port 8001 &
sleep 3 && curl http://localhost:8001/health
kill %1
```

Expected: `{"status":"ok",...}`

- [ ] **Step 9: Update `panic.py` — it also imports from bhavcopy**

`api/panic.py` line 30 has `from bhavcopy import get_delivery_series`.
Change it to:

```python
from services.data import get_delivery_series
```

- [ ] **Step 10: Remove the old file**

```bash
rm api/bhavcopy.py
```

- [ ] **Step 11: Re-verify API starts without the old file**

```bash
cd api && uvicorn main:app --port 8001 &
sleep 3 && curl http://localhost:8001/health
kill %1
```

Expected: `{"status":"ok",...}`

- [ ] **Step 12: Commit**

```bash
git add api/services/data/ api/main.py api/panic.py
git rm api/bhavcopy.py
git commit -m "refactor: move bhavcopy → services/data/ with clean __init__ interface"
```

---

## Task 3: Move `ai_news.py` + `ai_synthesis.py` → `services/ai/`

**Files:**
- Create: `api/services/ai/news.py` (moved from `api/ai_news.py`)
- Create: `api/services/ai/synthesis.py` (moved from `api/ai_synthesis.py`)
- Modify: `api/services/ai/__init__.py`
- Modify: `api/main.py`
- Create: `api/services/ai/tests/test_ai_interface.py`

- [ ] **Step 1: Write the failing test**

Create `api/services/ai/tests/test_ai_interface.py`:

```python
"""Verify the AI service public interface is importable and callable."""


def test_ai_package_exports_get_ai_news():
    from services.ai import get_ai_news
    assert callable(get_ai_news)


def test_ai_package_exports_get_ai_synthesis():
    from services.ai import get_ai_synthesis
    assert callable(get_ai_synthesis)


def test_ai_package_exports_get_spend_today():
    from services.ai import get_spend_today
    assert callable(get_spend_today)
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd api && python -m pytest services/ai/tests/test_ai_interface.py -v
```

Expected: `ImportError: cannot import name 'get_ai_news' from 'services.ai'`

- [ ] **Step 3: Copy files to new locations**

```bash
cp api/ai_news.py api/services/ai/news.py
cp api/ai_synthesis.py api/services/ai/synthesis.py
```

- [ ] **Step 4: Fix internal cross-imports inside the moved files**

`services/ai/synthesis.py` (moved from `ai_synthesis.py`) has two lazy imports that reference `ai_news` by its old flat name. Update them to use the package path.

Find line ~46 in `api/services/ai/synthesis.py`:
```python
def _get_spend_module():
    import ai_news  # lazy import — avoids circular at module level
    return ai_news
```
Replace with:
```python
def _get_spend_module():
    import services.ai.news as ai_news  # moved to services/ai/news.py
    return ai_news
```

Find line ~101 in `api/services/ai/synthesis.py`:
```python
from ai_news import _DAILY_CAP, _SPEND, _today
```
Replace with:
```python
from services.ai.news import _DAILY_CAP, _SPEND, _today
```

Also update `api/mithra_agent.py` line ~233 which lazily imports `ai_news`:
```python
import ai_news as _ai_news
```
Replace with:
```python
import services.ai.news as _ai_news
```

- [ ] **Step 6: Write `services/ai/__init__.py`**

```python
"""
AI service public interface.

Only import from this file in main.py — never import directly from
services/ai/news.py or services/ai/synthesis.py.
"""
from services.ai.news import get_ai_news, get_spend_today
from services.ai.synthesis import get_ai_synthesis

__all__ = ["get_ai_news", "get_ai_synthesis", "get_spend_today"]
```

- [ ] **Step 7: Run test — should pass**

```bash
cd api && python -m pytest services/ai/tests/test_ai_interface.py -v
```

Expected: `3 passed`

- [ ] **Step 8: Update `main.py` imports**

Find lines ~48-49 in `api/main.py`:
```python
from ai_news import get_ai_news, get_spend_today
from ai_synthesis import get_ai_synthesis
```

Replace with:
```python
from services.ai import get_ai_news, get_spend_today, get_ai_synthesis
```

- [ ] **Step 9: Verify API starts**

```bash
cd api && uvicorn main:app --port 8001 &
sleep 3 && curl http://localhost:8001/health
kill %1
```

Expected: `{"status":"ok",...}`

- [ ] **Step 10: Remove old files**

```bash
rm api/ai_news.py api/ai_synthesis.py
```

- [ ] **Step 11: Re-verify API starts**

```bash
cd api && uvicorn main:app --port 8001 &
sleep 3 && curl http://localhost:8001/health
kill %1
```

Expected: `{"status":"ok",...}`

- [ ] **Step 12: Commit**

```bash
git add api/services/ai/ api/main.py api/mithra_agent.py
git rm api/ai_news.py api/ai_synthesis.py
git commit -m "refactor: move ai_news + ai_synthesis → services/ai/ with clean interface"
```

---

## Task 4: Extract indicator functions → `services/core/indicators.py`

**Files:**
- Create: `api/services/core/indicators.py`
- Modify: `api/main.py` (remove extracted functions, add import)
- Create: `api/services/core/tests/test_indicators.py`

- [ ] **Step 1: Write the failing test**

Create `api/services/core/tests/test_indicators.py`:

```python
"""Unit tests for indicator math — no network calls."""
import numpy as np
import pandas as pd
import pytest


def _make_close(values: list[float]) -> pd.Series:
    return pd.Series(values, dtype=float)


def test_ema_last_value():
    from services.core.indicators import ema
    close = _make_close([100.0] * 30)
    result = ema(close, span=20)
    assert abs(float(result.iloc[-1]) - 100.0) < 0.01


def test_clamp_within_bounds():
    from services.core.indicators import clamp
    assert clamp(2.0) == 1.0
    assert clamp(-2.0) == -1.0
    assert clamp(0.5) == 0.5


def test_ema_stack_bullish():
    from services.core.indicators import ema_stack
    # 200 rising values → 20 EMA > 50 EMA > 200 EMA
    close = _make_close([float(i) for i in range(1, 250)])
    result = ema_stack(close)
    assert result["status"] == "bullish"
    assert result["score"] == 1.0


def test_ema_stack_bearish():
    from services.core.indicators import ema_stack
    # 200 falling values → bearish
    close = _make_close([float(i) for i in range(250, 0, -1)])
    result = ema_stack(close)
    assert result["status"] == "bearish"
    assert result["score"] == -1.0


def test_momentum_20d_positive():
    from services.core.indicators import momentum_20d
    # Price rose from 100 to 110 over 21 days
    close = _make_close([100.0] * 20 + [110.0])
    result = momentum_20d(close)
    assert result["value"] == pytest.approx(10.0, abs=0.1)
    assert result["score"] > 0


def test_volume_vwap_returns_required_keys():
    from services.core.indicators import volume_vwap
    close = _make_close([100.0 + i * 0.1 for i in range(30)])
    volume = pd.Series([1_000_000.0] * 30)
    result = volume_vwap(close, volume)
    for key in ["vwap20", "score", "aboveVwap", "volumeTrend"]:
        assert key in result
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd api && python -m pytest services/core/tests/test_indicators.py -v
```

Expected: `ImportError: cannot import name 'ema' from 'services.core.indicators'`

- [ ] **Step 3: Create `api/services/core/indicators.py`**

This file contains all indicator functions cut from `main.py`. Copy them exactly:

```python
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

TAIL_SPARK_LEN = 90  # bars to ship to frontend


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
    """Fallback when NSE bhavcopy is unavailable."""
    return {
        "deliveryPct": 0.0, "deliveryPct5d": 0.0, "deliveryPct20d": 0.0,
        "regime": 1.0, "priceDelta5v20": 0.0, "status": "noise",
        "score": 0.0, "series": [], "label": "n/a · no delivery data",
        "source": "fallback",
    }


def delivery_real(symbol: str, close_yf: pd.Series, get_delivery_series_fn, delivery_trend_fn) -> dict[str, Any]:
    """Compute real delivery-regime signal from NSE bhavcopy history.

    Takes get_delivery_series and delivery_trend as injected callables so this
    module has no direct dependency on services/data/.
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
    status = "accumulating" if score > 0.25 else "distributing" if score < -0.25 else "noise"

    _trend_result = None
    try:
        _trend_result = delivery_trend_fn(symbol)
    except Exception:
        pass
    if _trend_result is not None:
        score = round(0.65 * score + 0.35 * _trend_result["score"], 2)
        score = clamp(score)
        status = "accumulating" if score > 0.25 else "distributing" if score < -0.25 else "noise"

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
    """Derive nearest support & resistance from EMA-stack and VWAP levels."""
    candidates: list[tuple[float, str]] = [
        (ema_data.get("ema20",  price), "EMA20"),
        (ema_data.get("ema50",  price), "EMA50"),
        (ema_data.get("ema200", price), "EMA200"),
        (vv_data.get("vwap20",  price), "VWAP"),
    ]
    above = sorted([(v, l) for v, l in candidates if v > price * 1.002], key=lambda x: x[0])
    below = sorted([(v, l) for v, l in candidates if v < price * 0.998], key=lambda x: x[0], reverse=True)

    if verdict == "BUY":
        t_val, t_lbl = above[0] if above else (round(price * 1.05, 2), "est")
        s_val, s_lbl = below[0] if below else (round(price * 0.95, 2), "est")
    elif verdict == "SELL":
        t_val, t_lbl = below[0] if below else (round(price * 0.95, 2), "est")
        s_val, s_lbl = above[0] if above else (round(price * 1.05, 2), "est")
    else:
        t_val, t_lbl = above[0] if above else (round(price * 1.03, 2), "est")
        s_val, s_lbl = below[0] if below else (round(price * 0.97, 2), "est")

    return {
        "target": round(float(t_val), 2),
        "stop":   round(float(s_val), 2),
        "targetLabel": t_lbl,
        "stopLabel":   s_lbl,
    }
```

**Important:** Note that `delivery_real()` above takes `get_delivery_series_fn` and `delivery_trend_fn` as arguments instead of importing from bhavcopy directly. This enforces the "no cross-service imports" rule. In the next step you will update `main.py` to pass these functions when calling `delivery_real()`.

- [ ] **Step 4: Run tests — should pass now**

```bash
cd api && python -m pytest services/core/tests/test_indicators.py -v
```

Expected: `6 passed`

- [ ] **Step 5: Update `services/core/__init__.py`**

```python
"""
Core service public interface — indicator math and fusion.

Only import from this file in main.py.
"""
from services.core.indicators import (
    ema,
    clamp,
    relative_strength,
    ema_stack,
    momentum_20d,
    volume_vwap,
    delivery_real,
    calc_price_levels,
    TAIL_SPARK_LEN,
)

__all__ = [
    "ema", "clamp", "relative_strength", "ema_stack",
    "momentum_20d", "volume_vwap", "delivery_real", "calc_price_levels",
    "TAIL_SPARK_LEN",
]
```

- [ ] **Step 6: Update `main.py` to remove duplicated functions and import from services.core**

In `main.py`, find and **delete** the following function definitions (they now live in `services/core/indicators.py`):
- `def ema(...)` 
- `def clamp(...)`
- `def relative_strength(...)`
- `def ema_stack(...)`
- `def momentum_20d(...)`
- `def volume_vwap(...)`
- `def _delivery_neutral(...)`
- `def delivery_real(...)`
- `def calc_price_levels(...)`
- The constant `TAIL_SPARK_LEN = 90`

Add this import near the top of `main.py` (after the existing imports block):

```python
from services.core import (
    ema, clamp, relative_strength, ema_stack,
    momentum_20d, volume_vwap, delivery_real, calc_price_levels,
    TAIL_SPARK_LEN,
)
```

Also update the call to `delivery_real()` in `build_snapshot()`. Find:
```python
delivery = delivery_real(symbol, close)
```
Replace with:
```python
delivery = delivery_real(symbol, close, get_delivery_series, delivery_trend)
```

And remove the old trend blending block that follows it (lines ~398-407) — it is now handled inside `delivery_real()` in indicators.py.

- [ ] **Step 7: Verify API starts and returns a valid response**

```bash
cd api && uvicorn main:app --port 8001 &
sleep 4 && curl -s http://localhost:8001/health
kill %1
```

Expected: `{"status":"ok",...}`

- [ ] **Step 8: Run all tests**

```bash
cd api && python -m pytest services/ -v
```

Expected: all pass

- [ ] **Step 9: Commit**

```bash
git add api/services/core/ api/main.py
git commit -m "refactor: extract indicator math → services/core/indicators.py"
```

---

## Task 5: Extract fusion → `services/core/fusion.py`

**Files:**
- Create: `api/services/core/fusion.py`
- Modify: `api/services/core/__init__.py`
- Modify: `api/main.py`
- Modify: `api/services/core/tests/test_indicators.py` (add fusion tests)

- [ ] **Step 1: Write the failing test**

Append to `api/services/core/tests/test_indicators.py`:

```python
def test_fuse_scores_buy_verdict():
    from services.core.fusion import fuse_scores
    # All strong positive scores → BUY
    scores = {"rs": 1.0, "delivery": 1.0, "ema": 1.0, "momentum": 1.0, "volume": 1.0, "aiNews": 1.0}
    result = fuse_scores(scores)
    assert result["verdict"] == "BUY"
    assert result["probability"] >= 0.60


def test_fuse_scores_sell_verdict():
    from services.core.fusion import fuse_scores
    # All strong negative scores → SELL
    scores = {"rs": -1.0, "delivery": -1.0, "ema": -1.0, "momentum": -1.0, "volume": -1.0, "aiNews": -1.0}
    result = fuse_scores(scores)
    assert result["verdict"] == "SELL"
    assert result["probability"] <= 0.40


def test_fuse_scores_hold_verdict():
    from services.core.fusion import fuse_scores
    # All neutral → HOLD
    scores = {"rs": 0.0, "delivery": 0.0, "ema": 0.0, "momentum": 0.0, "volume": 0.0, "aiNews": 0.0}
    result = fuse_scores(scores)
    assert result["verdict"] == "HOLD"
    assert result["probability"] == 0.50


def test_fuse_scores_weights_sum_to_one():
    from services.core.fusion import FUSION_WEIGHTS
    total = sum(FUSION_WEIGHTS.values())
    assert abs(total - 1.0) < 0.001
```

- [ ] **Step 2: Run tests to confirm fusion tests fail**

```bash
cd api && python -m pytest services/core/tests/test_indicators.py::test_fuse_scores_buy_verdict -v
```

Expected: `ImportError: cannot import name 'fuse_scores' from 'services.core.fusion'`

- [ ] **Step 3: Create `api/services/core/fusion.py`**

```python
"""
Fusion engine — weighted sigmoid combining 6 indicator scores into a verdict.

FUSION_WEIGHTS is owned by FinanceAgent. Change values only after an accuracy
audit confirms the new weights improve signal quality. Record changes in
docs/finance/weight-history.md.
"""
from __future__ import annotations

# ── Fusion weights (FinanceAgent territory) ────────────────────────────────
# Must sum to 1.0. Adjust via FinanceAgent accuracy audit process only.
FUSION_WEIGHTS: dict[str, float] = {
    "rs":       0.20,
    "delivery": 0.20,
    "ema":      0.18,
    "momentum": 0.17,
    "volume":   0.15,
    "aiNews":   0.10,
}

# Verdict thresholds — FinanceAgent owns these too.
_BUY_THRESHOLD  = 0.60
_SELL_THRESHOLD = 0.40


def fuse_scores(scores: dict[str, float]) -> dict:
    """Weighted sigmoid → probability → verdict.

    Args:
        scores: dict with keys rs, delivery, ema, momentum, volume, aiNews.
                Each value is a float in [-1.0, 1.0].

    Returns:
        dict with probability (float 0-1), verdict (BUY/HOLD/SELL),
        and weights (the FUSION_WEIGHTS used).
    """
    weighted = sum(scores[k] * FUSION_WEIGHTS[k] for k in FUSION_WEIGHTS)
    probability = round(0.5 + weighted / 2, 2)
    verdict = (
        "BUY" if probability >= _BUY_THRESHOLD
        else "SELL" if probability <= _SELL_THRESHOLD
        else "HOLD"
    )
    return {
        "probability": probability,
        "verdict": verdict,
        "weights": FUSION_WEIGHTS,
    }
```

- [ ] **Step 4: Run tests — all should pass**

```bash
cd api && python -m pytest services/core/tests/test_indicators.py -v
```

Expected: all `10 passed`

- [ ] **Step 5: Update `services/core/__init__.py` to export fusion**

```python
"""
Core service public interface — indicator math and fusion.

Only import from this file in main.py.
"""
from services.core.indicators import (
    ema, clamp, relative_strength, ema_stack,
    momentum_20d, volume_vwap, delivery_real, calc_price_levels,
    TAIL_SPARK_LEN,
)
from services.core.fusion import FUSION_WEIGHTS, fuse_scores

__all__ = [
    "ema", "clamp", "relative_strength", "ema_stack",
    "momentum_20d", "volume_vwap", "delivery_real", "calc_price_levels",
    "TAIL_SPARK_LEN", "FUSION_WEIGHTS", "fuse_scores",
]
```

- [ ] **Step 6: Update `main.py` to use `fuse_scores()`**

Add `fuse_scores` to the existing import from `services.core`:
```python
from services.core import (
    ema, clamp, relative_strength, ema_stack,
    momentum_20d, volume_vwap, delivery_real, calc_price_levels,
    TAIL_SPARK_LEN, fuse_scores,
)
```

In `build_snapshot()`, find the fusion block (~lines 410-420):
```python
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
```

Replace with:
```python
fusion_result = fuse_scores({
    "rs":       rs["score"],
    "delivery": delivery["score"],
    "ema":      ema["score"],
    "momentum": mom["score"],
    "volume":   vv["score"],
    "aiNews":   ai_news["score"],
})
probability = fusion_result["probability"]
verdict     = fusion_result["verdict"]
```

Also update the `fusion_data` line below it:
```python
# old:
fusion_data = {"probability": probability, "verdict": verdict, "weights": FUSION_WEIGHTS}
# new:
fusion_data = fusion_result
```

Remove the standalone `FUSION_WEIGHTS` dict from `main.py` (it now lives in `services/core/fusion.py`).

- [ ] **Step 7: Verify API starts and snapshot works**

```bash
cd api && uvicorn main:app --port 8001 &
sleep 4 && curl -s "http://localhost:8001/snapshot/TCS.NS" | python -c "import sys,json; d=json.load(sys.stdin); print(d['fusion']['verdict'], d['fusion']['probability'])"
kill %1
```

Expected: prints something like `BUY 0.67` or `HOLD 0.52` (any valid verdict + probability 0-1)

- [ ] **Step 8: Run all tests**

```bash
cd api && python -m pytest services/ -v
```

Expected: all pass

- [ ] **Step 9: Commit**

```bash
git add api/services/core/ api/main.py
git commit -m "refactor: extract FUSION_WEIGHTS + fuse_scores() → services/core/fusion.py"
```

---

## Task 6: Write agent CLAUDE.md files

**Files:**
- Create: `docs/finance/CLAUDE.md`
- Create: `api/CLAUDE.md`
- Modify: `web/CLAUDE.md`
- Modify: `CLAUDE.md` (root)
- Modify: `api/services/data/CLAUDE.md`
- Modify: `api/services/ai/CLAUDE.md`
- Modify: `api/services/core/CLAUDE.md`

- [ ] **Step 1: Write `docs/finance/CLAUDE.md` (FinanceAgent)**

```markdown
# FinanceAgent — Domain Overseer

You are FinanceAgent for MarketMithra. Your role is financial correctness and signal quality — not code implementation.

## Your home
`docs/finance/` — logs, analysis, scripts.

## What you own (write access)
- `services/core/fusion.py` — FUSION_WEIGHTS and verdict thresholds only
- `docs/finance/` — accuracy logs, weight history, market notes

## What you never touch
- NSE data fetching code (TechAgent owns that)
- Frontend code (FrontendAgent owns that)
- Indicator math implementation (TechAgent owns that — you review, not rewrite)
- Prompt wording in services/ai/ (TechAgent owns that)

## Your KPI
Signal accuracy: % of BUY verdicts where price was higher 5 trading days later.
- Random baseline: ~50%
- Target: >65%
- Alert: <55% → trigger weight calibration review

## Responsibilities
1. Review indicator math for financial correctness (EMA, VWAP, RS, delivery %)
2. Recalibrate FUSION_WEIGHTS when accuracy drops below threshold
3. Audit AI synthesis text for claims inconsistent with actual scores
4. Run weekly accuracy audit: `python docs/finance/scripts/accuracy_audit.py`
5. Review any new indicator or AI feature before it ships

## Indian market context (always apply)
- NSE trading hours: 9:15 AM – 3:30 PM IST, Mon–Fri (excluding NSE holidays)
- T+1 settlement since Jan 2023
- Delivery % >60% in cash segment = institutional accumulation signal
- Delivery % <30% = speculative/day-trading dominance
- F&O stocks (all Nifty 50) — delivery signals are weaker for heavily traded F&O names
- EMA 20>50>200 stack = Stage 2 uptrend (Weinstein method)
- VWAP: above 20d VWAP = buying pressure; below = distribution
- RS rating 70+ vs Nifty 500 = outperforming broad market
- Circuit breakers (5/10/20% lower) flip context entirely — SELL signal invalid during halt

## Weight calibration process
1. Run accuracy audit for last 30 days: `python docs/finance/scripts/accuracy_audit.py --days-ago 30`
2. Identify symbols where verdict was wrong
3. Check which indicator was most misaligned on those dates
4. Adjust FUSION_WEIGHTS in `services/core/fusion.py` (values MUST sum to 1.0)
5. Record change in `docs/finance/weight-history.md` with date + rationale

## Session end
Save key observations to claude-mem under project "MaddyFlow" before closing.
```

- [ ] **Step 2: Write `api/CLAUDE.md` (TechAgent)**

```markdown
# TechAgent — All Backend

You are TechAgent for MarketMithra. You own everything in `api/`.

## Your home
`api/` — all Python backend code.

## Module ownership (enforce these boundaries)
- `services/data/` — NSE data, bhavcopy, OHLCV cache
- `services/ai/` — Claude Haiku news + synthesis, cost tracking
- `services/core/` — indicator math, fusion engine (NOT fusion weights)
- No cross-service imports: services/data/ must not import from services/ai/ or services/core/

## What you never touch
- `web/` (FrontendAgent owns that)
- FUSION_WEIGHTS values in `services/core/fusion.py` (FinanceAgent's call)
- Verdict thresholds in `services/core/fusion.py` (FinanceAgent's call)

## Your KPI
- /health returns 200 at all times
- P95 response time: <5s cached, <35s cold
- Zero unhandled exceptions in Railway logs

## Rules
- Changing a function signature in any __init__.py requires updating all callers in the same PR
- Always run `cd api && python -m pytest services/` before committing a service change
- Never remove or bypass AI_NEWS_DAILY_CAP or synthesis caching
- `main.py` imports ONLY from services/data/__init__.py, services/ai/__init__.py, services/core/__init__.py

## Before any Next.js work
You don't do frontend. Redirect to FrontendAgent (open web/ session).

## Session end
Save key observations to claude-mem under project "MaddyFlow" before closing.
```

- [ ] **Step 3: Update `web/CLAUDE.md` (FrontendAgent)**

Current content is `@AGENTS.md`. Replace with:

```markdown
@AGENTS.md

# FrontendAgent — Web Only

You are FrontendAgent for MarketMithra. You own everything in `web/`.

## Your home
`web/` — all Next.js frontend code.

## What you never touch
- `api/` (TechAgent owns that)
- `docs/finance/` (FinanceAgent owns that)
- Backend data processing logic (never add calculations or business logic to frontend)

## Your KPI
- Users understand the verdict and indicators within 5 seconds of page load
- LCP < 2.5s, CLS < 0.1
- Zero TypeScript errors, zero new ESLint warnings

## API contract rules
- Read types ONLY from `web/src/lib/types.ts` — never assume response shape
- Call API ONLY via `web/src/lib/api.ts` — never hardcode endpoints in components
- Never use a raw URL — always build from `process.env.NEXT_PUBLIC_API_BASE`

## Before writing any code
Read the relevant Next.js 16 docs in `node_modules/next/dist/docs/`.
This version has breaking changes from Next.js 13/14/15.

## Session end
Save key observations to claude-mem under project "MaddyFlow" before closing.
```

- [ ] **Step 4: Add agent roster to root `CLAUDE.md`**

Open `CLAUDE.md` and append the following section before the last line:

```markdown
## Agent Roles

Three Claude Code session roles. Each has its own CLAUDE.md with detailed rules.

| Agent | Home | KPI | CLAUDE.md |
|---|---|---|---|
| 📊 FinanceAgent | `docs/finance/` | Signal accuracy >65% | `docs/finance/CLAUDE.md` |
| ⚙️ TechAgent | `api/` | API reliability + P95 latency | `api/CLAUDE.md` |
| 🌐 FrontendAgent | `web/` | UX clarity + Core Web Vitals | `web/CLAUDE.md` |

**Session end rule (all agents):** Save key decisions and discoveries to claude-mem under project "MaddyFlow" before closing the session.

**Graduation path:** When a second developer joins, TechAgent splits into DataAgent (`api/services/data/`), AIAgent (`api/services/ai/`), and ComputeAgent (`api/services/core/`). Folder structure already supports this.
```

- [ ] **Step 5: Write stub CLAUDE.md files for service subdirectories**

`api/services/data/CLAUDE.md`:
```markdown
# DataAgent territory

This folder is owned by DataAgent (currently operated by TechAgent).
Concern: NSE data reliability. Do not add indicator math here.
See `api/CLAUDE.md` for full TechAgent rules.
```

`api/services/ai/CLAUDE.md`:
```markdown
# AIAgent territory

This folder is owned by AIAgent (currently operated by TechAgent).
Concern: AI cost and quality. Do not add indicator math here.
See `api/CLAUDE.md` for full TechAgent rules.
```

`api/services/core/CLAUDE.md`:
```markdown
# ComputeAgent territory

This folder is owned by ComputeAgent (currently operated by TechAgent).
Concern: Indicator math and fusion. FUSION_WEIGHTS in fusion.py are FinanceAgent's call.
See `api/CLAUDE.md` for full TechAgent rules.
```

- [ ] **Step 6: Commit all CLAUDE.md files**

```bash
git add docs/finance/CLAUDE.md api/CLAUDE.md web/CLAUDE.md CLAUDE.md
git add api/services/data/CLAUDE.md api/services/ai/CLAUDE.md api/services/core/CLAUDE.md
git commit -m "docs: add agent CLAUDE.md files for FinanceAgent, TechAgent, FrontendAgent"
```

---

## Task 7: Write FinanceAgent accuracy audit script

**Files:**
- Create: `docs/finance/scripts/accuracy_audit.py`
- Create: `docs/finance/scripts/test_accuracy_audit.py`

The accuracy audit reads from the existing SQLite `verdict_history` DB at `api/data/verdict_history.db` (written by `api/history.py`). No Supabase needed — the store already exists.

- [ ] **Step 1: Write the failing test**

Create `docs/finance/scripts/test_accuracy_audit.py`:

```python
"""Tests for the accuracy audit logic (no DB or network required)."""
import pytest


def test_direction_correct_buy_up():
    from accuracy_audit import _is_correct
    assert _is_correct("BUY", entry_price=100.0, exit_price=105.0) is True


def test_direction_correct_buy_down():
    from accuracy_audit import _is_correct
    assert _is_correct("BUY", entry_price=100.0, exit_price=95.0) is False


def test_direction_correct_sell_down():
    from accuracy_audit import _is_correct
    assert _is_correct("SELL", entry_price=100.0, exit_price=95.0) is True


def test_direction_correct_sell_up():
    from accuracy_audit import _is_correct
    assert _is_correct("SELL", entry_price=100.0, exit_price=105.0) is False


def test_direction_hold_ignored():
    from accuracy_audit import _is_correct
    assert _is_correct("HOLD", entry_price=100.0, exit_price=105.0) is None


def test_accuracy_pct_calculation():
    from accuracy_audit import _accuracy_pct
    assert _accuracy_pct(correct=7, total=10) == pytest.approx(70.0)
    assert _accuracy_pct(correct=0, total=0) == 0.0
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd docs/finance/scripts && python -m pytest test_accuracy_audit.py -v
```

Expected: `ModuleNotFoundError: No module named 'accuracy_audit'`

- [ ] **Step 3: Create `docs/finance/scripts/accuracy_audit.py`**

```python
#!/usr/bin/env python3
"""
FinanceAgent accuracy audit script.

Compares MarketMithra verdicts from N calendar days ago against actual NSE
price movement (close at verdict date vs close today).

Usage:
    python accuracy_audit.py              # uses verdicts from 7 days ago
    python accuracy_audit.py --days-ago 14

Reads: api/data/verdict_history.db (written by api/history.py)
Writes: docs/finance/accuracy-log.md (appends one section per run)
"""
from __future__ import annotations

import argparse
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

# ── Path setup ──────────────────────────────────────────────────────────────
_SCRIPTS_DIR = Path(__file__).parent
_FINANCE_DIR = _SCRIPTS_DIR.parent
_REPO_ROOT   = _FINANCE_DIR.parent.parent
_API_DIR     = _REPO_ROOT / "api"
_DB_PATH     = _API_DIR / "data" / "verdict_history.db"
_LOG_PATH    = _FINANCE_DIR / "accuracy-log.md"

# Add api/ so we can use get_nse_ohlcv for fetching exit prices
sys.path.insert(0, str(_API_DIR))

_IST = timezone(timedelta(hours=5, minutes=30))


# ── Pure helper functions (testable without DB or network) ──────────────────

def _is_correct(verdict: str, entry_price: float, exit_price: float) -> Optional[bool]:
    """Return True if verdict was directionally correct, False if wrong, None for HOLD."""
    if verdict == "HOLD":
        return None
    if verdict == "BUY":
        return exit_price > entry_price
    if verdict == "SELL":
        return exit_price < entry_price
    return None


def _accuracy_pct(correct: int, total: int) -> float:
    """Return accuracy as a percentage. Returns 0.0 if total is 0."""
    if total == 0:
        return 0.0
    return round(correct / total * 100, 1)


# ── Database access ─────────────────────────────────────────────────────────

def _fetch_verdicts_for_date(date_ymd: str) -> list[dict]:
    """Pull all symbol verdicts recorded on the given IST date."""
    if not _DB_PATH.exists():
        print(f"Warning: verdict DB not found at {_DB_PATH}. No data to audit.")
        return []

    conn = sqlite3.connect(str(_DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            "SELECT symbol, verdict, probability, price FROM verdict_history WHERE date_ymd = ?",
            (date_ymd,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# ── Exit price fetching ─────────────────────────────────────────────────────

def _fetch_latest_close(symbol: str) -> Optional[float]:
    """Fetch the most recent close price for a symbol via NSE bhavcopy."""
    try:
        from services.data import get_nse_ohlcv
        df = get_nse_ohlcv(symbol, n_days=10)
        if df is None or df.empty:
            return None
        return float(df["Close"].iloc[-1])
    except Exception as exc:
        print(f"  Warning: could not fetch price for {symbol}: {exc}")
        return None


# ── Report generation ───────────────────────────────────────────────────────

def _build_report(
    audit_date: str,
    run_date: str,
    results: list[dict],
    buy_correct: int,
    buy_total: int,
    sell_correct: int,
    sell_total: int,
) -> str:
    overall_correct = buy_correct + sell_correct
    overall_total   = buy_total + sell_total
    buy_acc     = _accuracy_pct(buy_correct, buy_total)
    sell_acc    = _accuracy_pct(sell_correct, sell_total)
    overall_acc = _accuracy_pct(overall_correct, overall_total)
    on_target   = overall_acc >= 65.0

    lines = [
        f"\n## Audit: {run_date} (verdicts from {audit_date})\n",
        "| Metric | Value |",
        "|---|---|",
        f"| BUY accuracy | {buy_acc}% ({buy_correct}/{buy_total}) |",
        f"| SELL accuracy | {sell_acc}% ({sell_correct}/{sell_total}) |",
        f"| Overall accuracy | {overall_acc}% ({overall_correct}/{overall_total}) |",
        "| Target | >65% |",
        f"| Status | {'✅ ON TARGET' if on_target else '⚠️ BELOW TARGET'} |",
        "",
        "<details>",
        "<summary>Symbol breakdown</summary>",
        "",
        "| Symbol | Verdict | Entry ₹ | Exit ₹ | Change | Correct |",
        "|---|---|---|---|---|---|",
    ]

    for r in sorted(results, key=lambda x: x["symbol"]):
        change_str = f"{r['pct_change']:+.1f}%" if r["pct_change"] is not None else "n/a"
        correct_str = "✅" if r["correct"] else ("❌" if r["correct"] is False else "—")
        exit_str = f"{r['exit_price']:.2f}" if r["exit_price"] is not None else "n/a"
        lines.append(
            f"| {r['symbol']} | {r['verdict']} | "
            f"{r['entry_price']:.2f} | {exit_str} | {change_str} | {correct_str} |"
        )

    lines += ["", "</details>", ""]
    return "\n".join(lines)


# ── Main audit runner ───────────────────────────────────────────────────────

def run_audit(days_ago: int = 7) -> None:
    audit_date = (datetime.now(_IST) - timedelta(days=days_ago)).strftime("%Y-%m-%d")
    run_date   = datetime.now(_IST).strftime("%Y-%m-%d %H:%M IST")

    print(f"Auditing verdicts from {audit_date} (run: {run_date})")

    verdicts = _fetch_verdicts_for_date(audit_date)
    if not verdicts:
        print(f"No verdicts found for {audit_date}. Run the API for a few days first.")
        return

    print(f"Found {len(verdicts)} verdicts. Fetching exit prices...")

    results = []
    buy_correct = buy_total = sell_correct = sell_total = 0

    for row in verdicts:
        symbol       = row["symbol"]
        verdict      = row["verdict"]
        entry_price  = row["price"]

        if verdict == "HOLD":
            results.append({**row, "exit_price": None, "pct_change": None, "correct": None})
            continue

        exit_price = _fetch_latest_close(symbol)
        if exit_price is None:
            results.append({**row, "exit_price": None, "pct_change": None, "correct": None})
            continue

        pct_change = (exit_price - entry_price) / entry_price * 100
        correct    = _is_correct(verdict, entry_price, exit_price)

        if verdict == "BUY":
            buy_total   += 1
            buy_correct += int(correct)
        elif verdict == "SELL":
            sell_total   += 1
            sell_correct += int(correct)

        results.append({**row, "exit_price": exit_price, "pct_change": pct_change, "correct": correct})
        print(f"  {symbol}: {verdict} @ {entry_price:.2f} → {exit_price:.2f} ({pct_change:+.1f}%) {'✅' if correct else '❌'}")

    # Build and append report
    report = _build_report(
        audit_date, run_date, results,
        buy_correct, buy_total, sell_correct, sell_total,
    )

    _LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(_LOG_PATH, "a", encoding="utf-8") as f:
        f.write(report)

    overall_acc = _accuracy_pct(buy_correct + sell_correct, buy_total + sell_total)
    print(f"\nResult: {overall_acc}% overall ({buy_correct + sell_correct}/{buy_total + sell_total})")
    print(f"Report appended to {_LOG_PATH}")

    if overall_acc < 55.0 and (buy_total + sell_total) >= 5:
        print("⚠️  WARNING: Accuracy <55% — below alert threshold.")
        print("   FinanceAgent review required: check docs/finance/weight-history.md")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MarketMithra signal accuracy audit")
    parser.add_argument("--days-ago", type=int, default=7, help="How many days back to audit")
    args = parser.parse_args()
    run_audit(args.days_ago)
```

- [ ] **Step 4: Run tests — should pass**

```bash
cd docs/finance/scripts && python -m pytest test_accuracy_audit.py -v
```

Expected: `6 passed`

- [ ] **Step 5: Run a smoke audit to confirm the script executes**

```bash
cd docs/finance/scripts && python accuracy_audit.py --days-ago 1
```

Expected: Either "No verdicts found for [date]. Run the API for a few days first." (if DB is empty) or a list of symbol results. Either is valid — the script should not crash.

- [ ] **Step 6: Commit**

```bash
git add docs/finance/scripts/accuracy_audit.py docs/finance/scripts/test_accuracy_audit.py
git add docs/finance/accuracy-log.md docs/finance/weight-history.md
git commit -m "feat: add FinanceAgent accuracy audit script (reads verdict_history SQLite)"
```

---

## Task 8: Final integration test + cleanup

- [ ] **Step 1: Run all service tests**

```bash
cd api && python -m pytest services/ -v
```

Expected: all pass

- [ ] **Step 2: Run accuracy audit tests**

```bash
cd docs/finance/scripts && python -m pytest test_accuracy_audit.py -v
```

Expected: all pass

- [ ] **Step 3: Start the full API and hit each endpoint**

```bash
cd api && uvicorn main:app --port 8001 &
sleep 5

# Health check
curl -s http://localhost:8001/health | python -c "import sys,json; d=json.load(sys.stdin); print('health:', d['status'])"

# Snapshot (tests data + AI + core services together)
curl -s "http://localhost:8001/snapshot/TCS.NS" | python -c "
import sys, json
d = json.load(sys.stdin)
print('verdict:', d['fusion']['verdict'])
print('probability:', d['fusion']['probability'])
print('indicators:', list(d['indicators'].keys()))
"

# Screener (tests ranked list)
curl -s "http://localhost:8001/screener" | python -c "
import sys, json
d = json.load(sys.stdin)
print('screener items:', len(d))
"

kill %1
```

Expected output (example):
```
health: ok
verdict: BUY
probability: 0.63
indicators: ['rs', 'delivery', 'ema', 'momentum', 'volume', 'aiNews']
screener items: 49
```

- [ ] **Step 4: Verify git log is clean**

```bash
git log --oneline -8
```

Expected: 8 clean commits showing the refactor progression

- [ ] **Step 5: Push to trigger Railway redeploy**

```bash
git push origin master
```

- [ ] **Step 6: Verify Railway deploy succeeds**

Wait ~3 minutes, then:
```bash
curl -s https://marketmithra-production.up.railway.app/health
```

Expected: `{"status":"ok",...}`

- [ ] **Step 7: Verify Vercel frontend still loads canvas data**

Open `https://web-lemon-six-11.vercel.app/canvas` in a browser.
Expected: Canvas loads, stocks render with verdict badges.

---

## What Sprint 1 does NOT do (by design)

- Does **not** extract `history.py`, `panic.py`, `rrg.py`, `stock_dna.py`, `darvas.py`, `mithra_agent.py` — these stay in `api/` unchanged
- Does **not** split `bhavcopy.py` into `nse_client.py` + `ohlcv.py` — that happens in Sprint 2 during HTTP extraction
- Does **not** create HTTP services — still one Railway deploy
- Does **not** create a `clients/` directory — that is Sprint 2
- Does **not** replace the background refresh daemon thread — that is Sprint 3

## Sprint 2 prerequisites (do these before starting Sprint 2)

1. Sprint 1 passes all tests and is deployed on Railway
2. Run `python accuracy_audit.py` daily for at least 5 trading days to establish a baseline
3. Confirm `api/data/verdict_history.db` is accumulating rows (check via `sqlite3 api/data/verdict_history.db "SELECT COUNT(*) FROM verdict_history"`)
4. Identify the bhavcopy cold-start latency — run `time curl http://localhost:8001/snapshot/RELIANCE.NS` with an empty cache to measure P95 cold time. Sprint 2 requires solving this before HTTP extraction.
