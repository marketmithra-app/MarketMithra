"""
Core service public interface — indicator math and fusion.

Only import from this file in main.py.
"""
from services.core.indicators import (
    ema,
    clamp,
    relative_strength,
    ema_stack,
    momentum_20d,
    volume_vwap,
    delivery_real,
    calc_price_levels,
    TAIL_SPARK_LEN,
)

__all__ = [
    "ema", "clamp", "relative_strength", "ema_stack",
    "momentum_20d", "volume_vwap", "delivery_real", "calc_price_levels",
    "TAIL_SPARK_LEN",
]
