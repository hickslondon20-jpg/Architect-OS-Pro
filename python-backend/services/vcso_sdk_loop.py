"""Dark Phase-A Claude Agent SDK streaming proof for the Virtual CSO."""

from __future__ import annotations

import asyncio
import json
import logging
import queue
import threading
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, AsyncIterator, Callable, Iterator

from claude_agent_sdk import (
    ClaudeAgentOptions,
    HookMatcher,
    ResultMessage,
    ToolAnnotations,
    create_sdk_mcp_server,
    query,
    tool,
)
from claude_agent_sdk.types import StreamEvent

from services.tool_registry import ToolExecutionContext, ToolRegistry


logger = logging.getLogger(__name__)

VCSO_SDK_LOOP_FLAG = "vcso_sdk_loop"
VCSO_SDK_CAPABILITY_KEY = "vcso_sdk_loop"
SDK_SPIKE_SCHEMA_VERSION = "vcso_sdk_spike_v1"
SDK_TOOL_SERVER_NAME = "architectos"
SDK_WIKI_TOOL_NAME = f"mcp__{SDK_TOOL_SERVER_NAME}__wiki_search"


@dataclass(frozen=True)
class VcsoSdkSpikeResult:
    answer_text: str
    input_tokens: int | None
    output_tokens: int | None
    total_cost_usd: Decimal | None
    session_id: str | None
    sources: list[dict[str, Any]] = field(default_factory=list)
    tool_step_count: int = 0


@dataclass(frozen=True)
class _WorkerFailure:
    error: BaseException


_WORKER_DONE = object()
QueryImpl = Callable[..., AsyncIterator[Any]]


def read_sdk_loop_settings(supabase: Any, user_id: str | None = None) -> dict[str, Any]:
    """Read the 04B flag fail-closed and preserve founder-only rollout semantics."""

    try:
        rows = (
            supabase.table("platform_ai_settings")
            .select("is_enabled,settings")
            .eq("setting_key", VCSO_SDK_LOOP_FLAG)
            .limit(1)
            .execute()
            .data
            or []
        )
    except Exception as exc:
        logger.warning("SDK loop flag read failed; retaining the hand-rolled VCSO path: %s", exc)
        return {"enabled": False, "settings": {}}
    if not rows:
        return {"enabled": False, "settings": {}}
    settings = rows[0].get("settings") or {}
    test_user_ids = {str(value) for value in settings.get("test_user_ids") or []}
    enabled = bool(rows[0].get("is_enabled")) and (
        bool(settings.get("enabled_for_all")) or (bool(user_id) and str(user_id) in test_user_ids)
    )
    return {"enabled": enabled, "settings": settings}


def stream_vcso_sdk_spike(
    *,
    prompt: str,
    model: str,
    api_key: str,
    registry: ToolRegistry,
    tool_context: ToolExecutionContext,
    trace_metadata: dict[str, Any],
    query_impl: QueryImpl = query,
) -> Iterator[dict[str, Any]]:
    """Bridge the SDK async message stream into the synchronous VCSO SSE producer."""

    events: queue.Queue[dict[str, Any] | _WorkerFailure | object] = queue.Queue()
    result_box: list[VcsoSdkSpikeResult] = []

    def run() -> None:
        try:
            result_box.append(
                asyncio.run(
                    _run_sdk_spike(
                        prompt=prompt,
                        model=model,
                        api_key=api_key,
                        registry=registry,
                        tool_context=tool_context,
                        trace_metadata=trace_metadata,
                        events=events,
                        query_impl=query_impl,
                    )
                )
            )
        except BaseException as exc:  # noqa: BLE001 - forward worker failures to request thread
            events.put(_WorkerFailure(exc))
        finally:
            events.put(_WORKER_DONE)

    worker = threading.Thread(target=run, name="vcso-sdk-spike", daemon=True)
    worker.start()
    while True:
        item = events.get()
        if item is _WORKER_DONE:
            break
        if isinstance(item, _WorkerFailure):
            raise item.error
        yield item
    worker.join(timeout=1)
    if not result_box:
        raise RuntimeError("Claude Agent SDK spike ended without a result.")
    return result_box[0]


async def _run_sdk_spike(
    *,
    prompt: str,
    model: str,
    api_key: str,
    registry: ToolRegistry,
    tool_context: ToolExecutionContext,
    trace_metadata: dict[str, Any],
    events: queue.Queue[dict[str, Any] | _WorkerFailure | object],
    query_impl: QueryImpl,
) -> VcsoSdkSpikeResult:
    source_refs: list[dict[str, Any]] = []
    step_indexes: dict[str, int] = {}
    tool_step_count = 0

    definition = registry.get("wiki_search")

    @tool(
        "wiki_search",
        definition.description,
        definition.json_schema,
        annotations=ToolAnnotations(
            title="Search founder wiki",
            readOnlyHint=True,
            destructiveHint=False,
            idempotentHint=True,
            openWorldHint=False,
        ),
    )
    async def sdk_wiki_search(args: dict[str, Any]) -> dict[str, Any]:
        envelope = await asyncio.to_thread(registry.execute, "wiki_search", tool_context, args)
        source_refs.extend(source.to_dict() for source in envelope.sources)
        safe_content = json.dumps(envelope.to_dict(), default=str)
        return {"content": [{"type": "text", "text": safe_content[:12000]}]}

    async def post_tool_use(input_data: dict[str, Any], tool_use_id: str | None, _context: Any) -> dict[str, Any]:
        nonlocal tool_step_count
        tool_name = str(input_data.get("tool_name") or "tool")
        key = str(tool_use_id or tool_name)
        step_index = step_indexes.get(key)
        if step_index is None:
            tool_step_count += 1
            step_index = tool_step_count
            step_indexes[key] = step_index
        _record_post_tool_trace(
            metadata=trace_metadata,
            tool_name=tool_name,
            tool_use_id=tool_use_id,
        )
        events.put(
            {
                "event": "tool_result",
                "data": {
                    "stepIndex": step_index,
                    "stepType": "source_review",
                    "title": "Founder wiki reviewed",
                    "tool": "wiki_search",
                    "output": "{}",
                    "summary": "Reviewed matching founder-wiki context.",
                    "status": "completed",
                    "sourceRefs": list(source_refs),
                },
            }
        )
        return {}

    server = create_sdk_mcp_server(
        name=SDK_TOOL_SERVER_NAME,
        version="1.0.0",
        tools=[sdk_wiki_search],
    )
    options = ClaudeAgentOptions(
        tools=[],
        allowed_tools=[SDK_WIKI_TOOL_NAME],
        disallowed_tools=["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch", "Task"],
        mcp_servers={SDK_TOOL_SERVER_NAME: server},
        strict_mcp_config=True,
        permission_mode="dontAsk",
        system_prompt=(
            "You are the Virtual CSO Phase-A SDK streaming proof. Before answering, call wiki_search "
            "exactly once with a short query derived from the founder's message. Then answer in two or "
            "three concise sentences. Cite any factual founder-context claim using the source markers "
            "returned by the tool. Do not reveal tool payloads, hidden reasoning, or chain-of-thought."
        ),
        model=model,
        max_turns=3,
        max_budget_usd=0.05,
        include_partial_messages=True,
        include_hook_events=False,
        hooks={"PostToolUse": [HookMatcher(matcher=SDK_WIKI_TOOL_NAME, hooks=[post_tool_use])]},
        setting_sources=[],
        env={"ANTHROPIC_API_KEY": api_key},
        thinking={"type": "disabled"},
    )

    answer_parts: list[str] = []
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_cost_usd: Decimal | None = None
    session_id: str | None = None
    final_result_text: str | None = None

    async for message in query_impl(prompt=prompt, options=options):
        if isinstance(message, StreamEvent):
            event = message.event
            event_type = event.get("type")
            if event_type == "content_block_start":
                block = event.get("content_block") or {}
                if block.get("type") == "tool_use":
                    tool_name = str(block.get("name") or "tool")
                    tool_use_id = str(block.get("id") or tool_name)
                    if tool_use_id not in step_indexes:
                        tool_step_count += 1
                        step_indexes[tool_use_id] = tool_step_count
                    step_index = step_indexes[tool_use_id]
                    events.put(
                        {
                            "event": "step",
                            "data": {
                                "stepIndex": step_index,
                                "stepType": "source_review",
                                "title": "Reviewing founder wiki",
                                "summary": "Searching synthesized founder context.",
                                "status": "running",
                                "sourceRefs": [],
                            },
                        }
                    )
                    events.put(
                        {
                            "event": "tool_call",
                            "data": {
                                "stepIndex": step_index,
                                "stepType": "source_review",
                                "title": "Reviewing founder wiki",
                                "tool": "wiki_search",
                                "input": {},
                                "summary": "Searching synthesized founder context.",
                                "status": "running",
                                "sourceRefs": [],
                            },
                        }
                    )
            elif event_type == "content_block_delta":
                delta = event.get("delta") or {}
                if delta.get("type") == "text_delta":
                    text = str(delta.get("text") or "")
                    if text:
                        answer_parts.append(text)
                        events.put({"event": "token", "data": {"text": text}})
        elif isinstance(message, ResultMessage):
            session_id = message.session_id
            final_result_text = message.result
            usage = message.usage or {}
            input_tokens = _usage_int(usage, "input_tokens", "inputTokens")
            output_tokens = _usage_int(usage, "output_tokens", "outputTokens")
            if message.total_cost_usd is not None:
                total_cost_usd = Decimal(str(message.total_cost_usd))

    answer_text = "".join(answer_parts).strip()
    if not answer_text and final_result_text:
        answer_text = final_result_text.strip()
        if answer_text:
            events.put({"event": "token", "data": {"text": answer_text}})
    if not answer_text:
        raise RuntimeError("Claude Agent SDK returned no assistant text.")
    return VcsoSdkSpikeResult(
        answer_text=answer_text,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_cost_usd=total_cost_usd,
        session_id=session_id,
        sources=source_refs,
        tool_step_count=tool_step_count,
    )


def _record_post_tool_trace(*, metadata: dict[str, Any], tool_name: str, tool_use_id: str | None) -> None:
    """Emit a sanitized, fail-open LangSmith tool run from the SDK hook."""

    try:
        from langsmith.run_helpers import trace

        with trace(
            "vcso_sdk_post_tool_use",
            run_type="tool",
            inputs={"tool": tool_name},
            metadata={**metadata, "tool_use_id": tool_use_id, "hook": "PostToolUse"},
            tags=[VCSO_SDK_CAPABILITY_KEY],
        ) as run:
            run.end(outputs={"status": "completed"})
    except Exception as exc:  # noqa: BLE001 - observability must remain fail-open
        logger.warning("SDK PostToolUse trace failed open: %s", exc)


def _usage_int(usage: dict[str, Any], *keys: str) -> int | None:
    for key in keys:
        try:
            value = usage.get(key)
            if value is not None:
                return int(value)
        except (TypeError, ValueError):
            continue
    return None
