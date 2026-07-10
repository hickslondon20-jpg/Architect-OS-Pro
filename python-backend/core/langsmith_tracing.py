"""Fail-open LangSmith client wrapping for backend provider SDKs."""

from __future__ import annotations

import logging
from typing import TypeVar, cast

T = TypeVar("T")

logger = logging.getLogger(__name__)


def trace_anthropic_client(client: T) -> T:
    """Return a LangSmith-wrapped Anthropic client, or the original client on failure."""
    try:
        from langsmith.wrappers import wrap_anthropic

        return cast(T, wrap_anthropic(client))
    except Exception as exc:  # noqa: BLE001 - tracing must never break provider calls
        logger.warning("LangSmith Anthropic tracing disabled; using unwrapped client: %s", exc)
        return client


def trace_openai_client(client: T) -> T:
    """Return a LangSmith-wrapped OpenAI client, or the original client on failure."""
    try:
        from langsmith.wrappers import wrap_openai

        return cast(T, wrap_openai(client))
    except Exception as exc:  # noqa: BLE001 - tracing must never break provider calls
        logger.warning("LangSmith OpenAI tracing disabled; using unwrapped client: %s", exc)
        return client
