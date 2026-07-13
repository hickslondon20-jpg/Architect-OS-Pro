"""Fail-open LangSmith client wrapping for backend provider SDKs."""

from __future__ import annotations

import logging
from contextlib import contextmanager
from collections.abc import Iterator
from typing import Any
from typing import TypeVar, cast

T = TypeVar("T")

logger = logging.getLogger(__name__)


@contextmanager
def trace_scope(metadata: dict[str, Any]) -> Iterator[None]:
    """Attach safe correlation metadata, while keeping tracing fail-open."""

    try:
        from langsmith.run_helpers import tracing_context
        scope = tracing_context(metadata=dict(metadata))
        scope.__enter__()
    except Exception as exc:  # noqa: BLE001 - tracing must never break provider calls
        logger.warning("LangSmith trace context disabled; continuing without metadata: %s", exc)
        yield
        return
    try:
        yield
    except BaseException as exc:
        suppress = scope.__exit__(type(exc), exc, exc.__traceback__)
        if not suppress:
            raise
    else:
        scope.__exit__(None, None, None)


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
