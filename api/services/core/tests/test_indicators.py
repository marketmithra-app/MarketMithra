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
