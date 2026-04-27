"""Verify the AI service public interface is importable and callable."""


def test_ai_package_exports_get_ai_news():
    from services.ai import get_ai_news
    assert callable(get_ai_news)


def test_ai_package_exports_get_ai_synthesis():
    from services.ai import get_ai_synthesis
    assert callable(get_ai_synthesis)


def test_ai_package_exports_get_spend_today():
    from services.ai import get_spend_today
    assert callable(get_spend_today)
