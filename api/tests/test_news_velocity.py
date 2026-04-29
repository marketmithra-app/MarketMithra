"""Tests for AI news velocity (trend) computation."""
import pytest


def _compute_trend(score_history: list) -> str:
    """Extracted from news.py for testing. history = [(date, score), ...]"""
    if len(score_history) < 3:
        return "stable"
    last3 = [s for _, s in score_history[-3:]]
    if last3[0] < last3[1] < last3[2]:
        return "improving"
    if last3[0] > last3[1] > last3[2]:
        return "deteriorating"
    return "stable"


def test_trend_improving():
    history = [("2026-04-27", 0.1), ("2026-04-28", 0.3), ("2026-04-29", 0.5)]
    assert _compute_trend(history) == "improving"


def test_trend_deteriorating():
    history = [("2026-04-27", 0.5), ("2026-04-28", 0.3), ("2026-04-29", 0.1)]
    assert _compute_trend(history) == "deteriorating"


def test_trend_stable_mixed():
    history = [("2026-04-27", 0.5), ("2026-04-28", 0.1), ("2026-04-29", 0.4)]
    assert _compute_trend(history) == "stable"


def test_trend_stable_insufficient_history():
    history = [("2026-04-27", 0.5), ("2026-04-28", 0.3)]
    assert _compute_trend(history) == "stable"


def test_trend_uses_last_3_only():
    # 4 entries; first is ignored; last 3 are increasing
    history = [
        ("2026-04-26", 0.8),
        ("2026-04-27", 0.1),
        ("2026-04-28", 0.3),
        ("2026-04-29", 0.5),
    ]
    assert _compute_trend(history) == "improving"
