"""
Verdict history recorder — persisted daily BUY/HOLD/SELL verdicts per symbol.

Backs the #1 conversion lever (timestamped public track record) and the
Phase 2 daily digest ("verdicts that changed today").

SQLite-backed (stdlib only), WAL mode, connection-per-call (cheap + thread-safe).
Silent on errors — must never break /snapshot if the DB hiccups.

Date keys (`date_ymd`) are in IST (Asia/Kolkata) to match the Indian market
calendar: one row per symbol per trading day, idempotent UPSERT.
"""
from __future__ import annotations

import logging
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

# ─────────────────────────── paths + schema ────────────────────────────────
_DB_DIR  = Path(__file__).parent / "data"
_DB_PATH = _DB_DIR / "verdict_history.db"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS verdict_history (
  symbol TEXT NOT NULL,
  date_ymd TEXT NOT NULL,
  verdict TEXT NOT NULL,
  probability REAL NOT NULL,
  price REAL NOT NULL,
  recorded_at_utc TEXT NOT NULL,
  PRIMARY KEY (symbol, date_ymd)
);
CREATE INDEX IF NOT EXISTS idx_hist_date ON verdict_history(date_ymd);
"""

# IST = UTC+5:30 (no DST). Avoid pulling in pytz/zoneinfo complications on
# hosts whose tzdata is missing (seen on some Alpine/Railway builds).
_IST = timezone(timedelta(hours=5, minutes=30))


def _ist_today_ymd() -> str:
    return datetime.now(_IST).strftime("%Y-%m-%d")


def _connect() -> sqlite3.Connection:
    """Open a short-lived connection. Caller is responsible for closing it."""
    _DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), timeout=5.0)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db() -> None:
    """Create the schema and set WAL mode once at module import."""
    try:
        conn = _connect()
        try:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.executescript(_SCHEMA)
            conn.commit()
        finally:
            conn.close()
    except Exception as exc:
        log.warning("history: DB init failed: %s", exc)


_init_db()


# ─────────────────────────── public API ────────────────────────────────────
def record_verdict(
    symbol: str,
    verdict: str,
    probability: float,
    price: float,
) -> None:
    """Idempotent UPSERT keyed by (symbol, date_ymd) — one row per IST trading
    day. Silent on any error: if the DB is locked or the disk is read-only we
    must not break /snapshot."""
    try:
        sym = symbol.upper()
        date_ymd = _ist_today_ymd()
        recorded_at_utc = datetime.now(timezone.utc).isoformat()

        conn = _connect()
        try:
            conn.execute(
                """
                INSERT INTO verdict_history
                  (symbol, date_ymd, verdict, probability, price, recorded_at_utc)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(symbol, date_ymd) DO UPDATE SET
                  verdict         = excluded.verdict,
                  probability     = excluded.probability,
                  price           = excluded.price,
                  recorded_at_utc = excluded.recorded_at_utc
                """,
                (sym, date_ymd, verdict, float(probability), float(price), recorded_at_utc),
            )
            conn.commit()
        finally:
            conn.close()
    except Exception as exc:
        log.warning("history.record_verdict failed for %s: %s", symbol, exc)


def get_history(symbol: str, days: int = 90) -> list[dict[str, Any]]:
    """Return the last `days` rows for `symbol`, ascending by date."""
    try:
        sym = symbol.upper()
        cutoff = (datetime.now(_IST) - timedelta(days=max(1, int(days)))).strftime("%Y-%m-%d")
        conn = _connect()
        try:
            cur = conn.execute(
                """
                SELECT date_ymd, verdict, probability, price
                FROM verdict_history
                WHERE symbol = ? AND date_ymd >= ?
                ORDER BY date_ymd ASC
                """,
                (sym, cutoff),
            )
            return [
                {
                    "date":        r["date_ymd"],
                    "verdict":     r["verdict"],
                    "probability": float(r["probability"]),
                    "price":       float(r["price"]),
                }
                for r in cur.fetchall()
            ]
        finally:
            conn.close()
    except Exception as exc:
        log.warning("history.get_history failed for %s: %s", symbol, exc)
        return []


def get_changes_on(date_ymd: str, prev_date_ymd: str) -> list[dict[str, Any]]:
    """Return symbols whose verdict differs between `prev_date_ymd` and
    `date_ymd`.  Used by the daily-digest feature.  Empty list when either
    date has no records."""
    try:
        conn = _connect()
        try:
            cur = conn.execute(
                """
                SELECT
                  t.symbol       AS symbol,
                  t.verdict      AS verdict_today,
                  y.verdict      AS verdict_prev,
                  t.probability  AS prob_today,
                  y.probability  AS prob_prev
                FROM verdict_history t
                INNER JOIN verdict_history y
                  ON y.symbol = t.symbol AND y.date_ymd = ?
                WHERE t.date_ymd = ?
                  AND t.verdict != y.verdict
                ORDER BY t.symbol ASC
                """,
                (prev_date_ymd, date_ymd),
            )
            return [
                {
                    "symbol":        r["symbol"],
                    "verdict_today": r["verdict_today"],
                    "verdict_prev":  r["verdict_prev"],
                    "prob_today":    float(r["prob_today"]),
                    "prob_prev":     float(r["prob_prev"]),
                }
                for r in cur.fetchall()
            ]
        finally:
            conn.close()
    except Exception as exc:
        log.warning("history.get_changes_on failed (%s vs %s): %s",
                    date_ymd, prev_date_ymd, exc)
        return []


def get_all_latest() -> dict[str, dict[str, Any]]:
    """Most recent record per symbol.  Keyed by symbol.  Useful for building
    the digest without scanning the full table twice."""
    try:
        conn = _connect()
        try:
            cur = conn.execute(
                """
                SELECT h.symbol, h.date_ymd, h.verdict, h.probability, h.price
                FROM verdict_history h
                INNER JOIN (
                  SELECT symbol, MAX(date_ymd) AS mx
                  FROM verdict_history
                  GROUP BY symbol
                ) m ON m.symbol = h.symbol AND m.mx = h.date_ymd
                """
            )
            return {
                r["symbol"]: {
                    "verdict":     r["verdict"],
                    "probability": float(r["probability"]),
                    "price":       float(r["price"]),
                    "date":        r["date_ymd"],
                }
                for r in cur.fetchall()
            }
        finally:
            conn.close()
    except Exception as exc:
        log.warning("history.get_all_latest failed: %s", exc)
        return {}
