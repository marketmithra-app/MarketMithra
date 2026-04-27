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
