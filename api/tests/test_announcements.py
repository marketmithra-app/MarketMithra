"""Tests for BSE announcements module."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import patch
from services.data.announcements import get_announcements, KEEP_CATEGORIES
import services.data.announcements as _ann_mod


# ── Category filter tests (against the REAL KEEP_CATEGORIES constant) ───────

def test_keep_categories_has_results():
    assert "Results" in KEEP_CATEGORIES


def test_keep_categories_has_merger():
    assert "Merger/Amalgamation" in KEEP_CATEGORIES


def test_keep_categories_excludes_agm():
    assert "AGM" not in KEEP_CATEGORIES


def test_keep_categories_excludes_allotment():
    assert "Allotment" not in KEEP_CATEGORIES


# ── get_announcements integration tests (mocked network) ────────────────────

def test_unknown_symbol_returns_empty():
    """Symbol not in NSE_TO_BSE must return [] without any network call."""
    result = get_announcements("FAKE.NS")
    assert result == []


def test_bse_fetch_failure_returns_empty():
    """If BSE API is down, get_announcements must return [] gracefully."""
    _ann_mod._ANN_CACHE.clear()
    with patch("services.data.announcements._fetch_bse_raw", return_value=[]):
        result = get_announcements("TCS.NS")
    assert result == []


def test_filtered_rows_returned_with_haiku_fallback():
    """If BSE returns data but Haiku is unavailable, fall back to raw titles."""
    _ann_mod._ANN_CACHE.clear()
    fake_rows = [
        {
            "CATEGORYNAME": "Results",
            "NEWS_DT": "2026-04-29T10:00:00",
            "HEADLINE": "Q4 PAT beats estimates",
        },
        {
            "CATEGORYNAME": "AGM",  # should be filtered out
            "NEWS_DT": "2026-04-28T10:00:00",
            "HEADLINE": "Annual General Meeting notice",
        },
    ]
    with patch("services.data.announcements._fetch_bse_raw", return_value=fake_rows), \
         patch("services.data.announcements._summarise_with_haiku",
               side_effect=lambda sym, anns: [{**a, "plainEnglish": a["title"], "impact": "medium"} for a in anns]):
        result = get_announcements("TCS.NS")

    # Only "Results" row should survive the category filter
    assert len(result) == 1
    assert result[0]["category"] == "Results"
    assert result[0]["title"] == "Q4 PAT beats estimates"
    assert result[0]["date"] == "2026-04-29"  # sliced to 10 chars
    assert result[0]["plainEnglish"] == "Q4 PAT beats estimates"
    assert result[0]["impact"] == "medium"
