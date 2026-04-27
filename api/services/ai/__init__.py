"""
AI service public interface.

Only import from this file in main.py — never import directly from
services/ai/news.py or services/ai/synthesis.py.
"""
from services.ai.news import get_ai_news, get_spend_today
from services.ai.synthesis import get_ai_synthesis

__all__ = ["get_ai_news", "get_ai_synthesis", "get_spend_today"]
