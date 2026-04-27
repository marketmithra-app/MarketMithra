"""Verify the data service public interface is importable and callable."""
import pytest


def test_data_package_exports_get_nse_ohlcv():
    from services.data import get_nse_ohlcv
    assert callable(get_nse_ohlcv)


def test_data_package_exports_get_delivery_series():
    from services.data import get_delivery_series
    assert callable(get_delivery_series)


def test_data_package_exports_delivery_trend():
    from services.data import delivery_trend
    assert callable(delivery_trend)
