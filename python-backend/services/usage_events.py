"""Best-effort AI usage event logging."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Literal

from supabase import Client


UsageRole = Literal["main", "sub_agent", "utility"]


@dataclass(frozen=True)
class TokenUsage:
    input_tokens: int | None = None
    output_tokens: int | None = None


def log_ai_usage_event(
    client: Client,
    *,
    user_id: str,
    surface: str,
    model: str,
    role: UsageRole,
    provider: str | None = None,
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    thread_id: str | None = None,
    skill_id: str | None = None,
    capability_key: str | None = None,
    run_id: str | None = None,
    task_id: str | None = None,
    cost_usd: Decimal | float | str | None = None,
) -> None:
    """Insert one usage event without ever breaking the underlying model call."""
    row: dict[str, Any] = {
        "user_id": user_id,
        "surface": surface,
        "model": model,
        "role": role,
        "provider": provider,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "thread_id": thread_id,
        "skill_id": skill_id,
        "capability_key": capability_key,
        "run_id": run_id,
        "task_id": task_id,
        "cost_usd": str(cost_usd) if cost_usd is not None else None,
    }
    try:
        client.table("ai_usage_log").insert(row).execute()
    except Exception:
        return


def anthropic_usage(response: Any) -> TokenUsage:
    usage = getattr(response, "usage", None)
    return TokenUsage(
        input_tokens=_int_or_none(getattr(usage, "input_tokens", None)),
        output_tokens=_int_or_none(getattr(usage, "output_tokens", None)),
    )


def openai_chat_usage(response: Any) -> TokenUsage:
    usage = getattr(response, "usage", None)
    return TokenUsage(
        input_tokens=_int_or_none(getattr(usage, "prompt_tokens", None)),
        output_tokens=_int_or_none(getattr(usage, "completion_tokens", None)),
    )


def openai_embedding_usage(response: Any) -> TokenUsage:
    usage = getattr(response, "usage", None)
    return TokenUsage(
        input_tokens=_int_or_none(getattr(usage, "prompt_tokens", None) or getattr(usage, "total_tokens", None)),
        output_tokens=0 if usage is not None else None,
    )


def _int_or_none(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
