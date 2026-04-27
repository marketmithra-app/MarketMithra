"""Tests for services/data/bhavcopy.py — hermetic, no network, no real cache reads.

Only exercises functions currently defined in bhavcopy.py:
    - fetch_bhavcopy       (mocked; weekend short-circuit is pure)
    - _cache_path          (pure)
    - _read_csv            (pure, bytes in → DataFrame out)
    - get_delivery_series  (index short-circuit is pure)
"""
from __future__ import annotations

import io
from datetime import date
from pathlib import Path
from unittest.mock import patch

import pandas as pd
import pytest

import services.data.bhavcopy as bhavcopy


@pytest.fixture(autouse=True)
def _clear_memory_cache():
    """Ensure every test starts with an empty in-memory DataFrame cache."""
    bhavcopy._df_cache.clear()
    yield
    bhavcopy._df_cache.clear()


def test_module_imports_cleanly():
    """Smoke: module-level initialisation must not blow up."""
    assert hasattr(bhavcopy, "fetch_bhavcopy")
    assert hasattr(bhavcopy, "get_delivery_series")
    assert callable(bhavcopy.fetch_bhavcopy)


def test_cache_path_is_deterministic():
    d = date(2024, 3, 15)
    p = bhavcopy._cache_path(d)
    assert isinstance(p, Path)
    assert p.name == "2024-03-15.csv"
    # Two calls produce identical paths.
    assert bhavcopy._cache_path(d) == p


def test_read_csv_strips_column_whitespace_and_coerces_delivery():
    # NSE ships leading spaces in column headers. Verify _read_csv cleans them
    # and coerces DELIV_PER string values (including '-') to numeric.
    raw = (
        b"SYMBOL, SERIES, CLOSE_PRICE, DELIV_QTY, DELIV_PER\n"
        b"RELIANCE,EQ,2900.5,100000,42.5\n"
        b"SOMEBOND,N1,100.0,-,-\n"
    )
    df = bhavcopy._read_csv(raw)
    assert "SERIES" in df.columns  # whitespace-stripped
    assert "DELIV_PER" in df.columns
    # String-series coercion leaves plain values untouched.
    assert df.loc[0, "SYMBOL"] == "RELIANCE"
    # Numeric coercion: valid float parsed, '-' becomes NaN.
    assert df.loc[0, "DELIV_PER"] == 42.5
    assert pd.isna(df.loc[1, "DELIV_PER"])


def test_fetch_bhavcopy_weekend_short_circuits_without_network(tmp_path, monkeypatch):
    """Saturday + empty cache should negative-cache and return None without
    hitting the network."""
    monkeypatch.setattr(bhavcopy, "_CACHE_DIR", tmp_path)
    saturday = date(2024, 3, 16)  # known Saturday

    with patch.object(bhavcopy, "_get_session") as mock_session:
        result = bhavcopy.fetch_bhavcopy(saturday)

    assert result is None
    mock_session.assert_not_called()
    # Negative-cache sentinel (empty file) should have been written.
    assert (tmp_path / f"{saturday.isoformat()}.csv").exists()


def test_fetch_bhavcopy_uses_in_memory_cache(tmp_path, monkeypatch):
    monkeypatch.setattr(bhavcopy, "_CACHE_DIR", tmp_path)
    d = date(2024, 3, 18)
    sentinel_df = pd.DataFrame({"SYMBOL": ["X"], "DELIV_PER": [1.0]})
    bhavcopy._df_cache[d.isoformat()] = sentinel_df

    with patch.object(bhavcopy, "_get_session") as mock_session:
        result = bhavcopy.fetch_bhavcopy(d)

    assert result is sentinel_df
    mock_session.assert_not_called()


def test_fetch_bhavcopy_honours_negative_disk_cache(tmp_path, monkeypatch):
    """An existing zero-byte cache file means 'we know this date has no data'."""
    monkeypatch.setattr(bhavcopy, "_CACHE_DIR", tmp_path)
    d = date(2024, 3, 25)  # weekday (Monday) so weekday() != weekend path
    (tmp_path / f"{d.isoformat()}.csv").write_bytes(b"")

    with patch.object(bhavcopy, "_get_session") as mock_session:
        result = bhavcopy.fetch_bhavcopy(d)

    assert result is None
    mock_session.assert_not_called()


def test_get_delivery_series_returns_empty_for_index_symbol():
    # Pure branch: symbol starting with '^' bails out before any fetch.
    with patch.object(bhavcopy, "fetch_bhavcopy") as mock_fetch:
        out = bhavcopy.get_delivery_series("^NSEI")
    assert out == []
    mock_fetch.assert_not_called()


def test_get_delivery_series_when_all_days_miss(monkeypatch, tmp_path):
    # Force fetch_bhavcopy to always return None; function should return [].
    monkeypatch.setattr(bhavcopy, "_CACHE_DIR", tmp_path)
    with patch.object(bhavcopy, "fetch_bhavcopy", return_value=None):
        out = bhavcopy.get_delivery_series("RELIANCE.NS", n_trading_days=5)
    assert out == []


def test_get_delivery_series_parses_hit_row(monkeypatch, tmp_path):
    """When a bhavcopy day contains our symbol, we get a dict with delivery%."""
    monkeypatch.setattr(bhavcopy, "_CACHE_DIR", tmp_path)
    df = pd.DataFrame(
        {
            "SYMBOL": ["RELIANCE", "OTHER"],
            "SERIES": ["EQ", "EQ"],
            "CLOSE_PRICE": [2900.0, 100.0],
            "DELIV_PER": [55.5, 10.0],
        }
    )
    # Return our df on the very first date fetched, None for every subsequent day.
    call_count = {"n": 0}

    def fake_fetch(_d):
        call_count["n"] += 1
        return df if call_count["n"] == 1 else None

    with patch.object(bhavcopy, "fetch_bhavcopy", side_effect=fake_fetch):
        out = bhavcopy.get_delivery_series("RELIANCE.NS", n_trading_days=1)

    assert len(out) == 1
    assert out[0]["deliveryPct"] == 55.5
    assert out[0]["close"] == 2900.0
    assert "date" in out[0]
