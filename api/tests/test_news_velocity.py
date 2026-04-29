"""Tests for AI news velocity (trend) computation."""
import sys
import os
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.ai.news import _compute_trend


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
