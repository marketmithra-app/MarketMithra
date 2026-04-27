"""
Data service public interface.

Only import from this file in main.py — never import directly from
services/data/bhavcopy.py or any other submodule.
"""
from services.data.bhavcopy import get_delivery_series, delivery_trend, get_nse_ohlcv

__all__ = ["get_delivery_series", "delivery_trend", "get_nse_ohlcv"]
