#!/usr/bin/env python3
# -*- coding: utf-8 -*-
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
import io
import sqlite3
import sys
from datetime import datetime, timedelta, timezone

# Force UTF-8 output on Windows so arrow/tick characters don't crash
if hasattr(sys.stdout, "buffer") and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
from pathlib import Path
from typing import Optional

# ── Path setup ──────────────────────────────────────────────────────────────
_SCRIPTS_DIR = Path(__file__).parent
_FINANCE_DIR = _SCRIPTS_DIR.parent
_REPO_ROOT   = _FINANCE_DIR.parent.parent
_API_DIR     = _REPO_ROOT / "api"
_DB_PATH     = _API_DIR / "data" / "verdict_history.db"
_LOG_PATH    = _FINANCE_DIR / "accuracy-log.md"

# Add api/ so we can use services.data for fetching exit prices
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
    """Fetch the most recent close price for a symbol via NSE data service."""
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
            results.append({**row, "entry_price": entry_price, "exit_price": None, "pct_change": None, "correct": None})
            continue

        exit_price = _fetch_latest_close(symbol)
        if exit_price is None:
            results.append({**row, "entry_price": entry_price, "exit_price": None, "pct_change": None, "correct": None})
            continue

        pct_change = (exit_price - entry_price) / entry_price * 100
        correct    = _is_correct(verdict, entry_price, exit_price)

        if verdict == "BUY":
            buy_total   += 1
            buy_correct += int(correct)
        elif verdict == "SELL":
            sell_total   += 1
            sell_correct += int(correct)

        results.append({**row, "entry_price": entry_price, "exit_price": exit_price, "pct_change": pct_change, "correct": correct})
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
