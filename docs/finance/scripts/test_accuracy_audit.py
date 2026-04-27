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
