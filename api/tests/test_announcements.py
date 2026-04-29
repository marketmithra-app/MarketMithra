"""Tests for BSE announcements module helpers."""

KEEP_CATEGORIES = {
    "Results", "Dividend", "Board Meeting", "Buyback",
    "Rights Issue", "Bonus Issue", "QIP",
    "Merger/Amalgamation", "Scheme of Arrangement",
}


def _filter_announcements(raw: list[dict]) -> list[dict]:
    return [a for a in raw if a.get("CATEGORYNAME", "") in KEEP_CATEGORIES]


def test_filter_keeps_results():
    raw = [{"CATEGORYNAME": "Results", "HEADLINE": "Q4 results"}]
    assert len(_filter_announcements(raw)) == 1


def test_filter_drops_agm():
    raw = [{"CATEGORYNAME": "AGM", "HEADLINE": "Annual General Meeting"}]
    assert len(_filter_announcements(raw)) == 0


def test_filter_drops_allotment():
    raw = [{"CATEGORYNAME": "Allotment", "HEADLINE": "Allotment notice"}]
    assert len(_filter_announcements(raw)) == 0


def test_filter_keeps_merger():
    raw = [{"CATEGORYNAME": "Merger/Amalgamation", "HEADLINE": "Merger plan"}]
    assert len(_filter_announcements(raw)) == 1


def test_filter_mixed():
    raw = [
        {"CATEGORYNAME": "Dividend", "HEADLINE": "Interim dividend"},
        {"CATEGORYNAME": "AGM", "HEADLINE": "AGM notice"},
        {"CATEGORYNAME": "Results", "HEADLINE": "Q1 results"},
    ]
    result = _filter_announcements(raw)
    assert len(result) == 2
    assert all(r["CATEGORYNAME"] in KEEP_CATEGORIES for r in result)


def test_unknown_symbol_returns_empty():
    NSE_TO_BSE: dict[str, str] = {"TCS.NS": "532540"}
    assert NSE_TO_BSE.get("UNKNOWN.NS") is None
