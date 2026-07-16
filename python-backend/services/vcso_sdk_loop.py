"""Feature-gated Claude Agent SDK loop for standard Virtual CSO turns."""

from __future__ import annotations

import asyncio
import json
import logging
import queue
import threading
from collections import defaultdict, deque
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, AsyncIterator, Callable, Iterator

from claude_agent_sdk import (
    HookMatcher,
    ResultMessage,
    ToolAnnotations,
    create_sdk_mcp_server,
    query,
    tool,
)
from claude_agent_sdk.types import StreamEvent

from services.tool_registry import ToolDefinition, ToolExecutionContext, ToolRegistry
from services.vcso_sdk_config import compile_founder_sdk_options


logger = logging.getLogger(__name__)

VCSO_SDK_LOOP_FLAG = "vcso_sdk_loop"
VCSO_SDK_CAPABILITY_KEY = "vcso_sdk_loop"
SDK_STANDARD_SCHEMA_VERSION = "vcso_sdk_standard_v1"
SDK_TOOL_SERVER_NAME = "architectos"
SDK_TOOL_PREFIX = f"mcp__{SDK_TOOL_SERVER_NAME}__"


@dataclass(frozen=True)
class VcsoSdkUsage:
    input_tokens: int | None
    output_tokens: int | None
    total_cost_usd: Decimal | None
    session_id: str | None


@dataclass(frozen=True)
class VcsoSdkTurnResult:
    answer_text: str
    input_tokens: int | None
    output_tokens: int | None
    total_cost_usd: Decimal | None
    session_id: str | None
    sources: list[dict[str, Any]] = field(default_factory=list)
    tool_steps: list[dict[str, Any]] = field(default_factory=list)
    compaction_count: int = 0
    turn_trace_emitted: bool = False
    usage_recorded: bool = False

    @property
    def tool_step_count(self) -> int:
        return len([step for step in self.tool_steps if step.get("tool")])


@dataclass(frozen=True)
class _WorkerFailure:
    error: BaseException


@dataclass(frozen=True)
class _ToolOutcome:
    status: str
    sources: list[dict[str, Any]]


_WORKER_DONE = object()
QueryImpl = Callable[..., AsyncIterator[Any]]
UsageSink = Callable[[VcsoSdkUsage], None]


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


def stream_vcso_sdk_turn(
    *,
    prompt: str,
    system_prompt: str,
    model: str,
    api_key: str,
    registry: ToolRegistry,
    tool_names: list[str],
    tool_context: ToolExecutionContext,
    trace_metadata: dict[str, Any],
    initial_sources: list[dict[str, Any]] | None = None,
    step_index_offset: int = 0,
    max_turns: int = 6,
    max_budget_usd: float = 0.25,
    tool_timeout_seconds: float = 600.0,
    heartbeat_seconds: float = 10.0,
    usage_sink: UsageSink | None = None,
    query_impl: QueryImpl = query,
) -> Iterator[dict[str, Any]]:
    """Bridge the SDK async lifecycle into the synchronous, existing VCSO SSE contract."""

    events: queue.Queue[dict[str, Any] | _WorkerFailure | object] = queue.Queue()
    result_box: list[VcsoSdkTurnResult] = []

    def run() -> None:
        try:
            result_box.append(
                asyncio.run(
                    _run_sdk_turn(
                        prompt=prompt,
                        system_prompt=system_prompt,
                        model=model,
                        api_key=api_key,
                        registry=registry,
                        tool_names=tool_names,
                        tool_context=tool_context,
                        trace_metadata=trace_metadata,
                        initial_sources=initial_sources or [],
                        step_index_offset=step_index_offset,
                        max_turns=max_turns,
                        max_budget_usd=max_budget_usd,
                        tool_timeout_seconds=tool_timeout_seconds,
                        heartbeat_seconds=heartbeat_seconds,
                        usage_sink=usage_sink,
                        events=events,
                        query_impl=query_impl,
                    )
                )
            )
        except BaseException as exc:  # noqa: BLE001 - forward worker failures to request thread
            events.put(_WorkerFailure(exc))
        finally:
            events.put(_WORKER_DONE)

    worker = threading.Thread(target=run, name="vcso-sdk-standard", daemon=True)
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
        raise RuntimeError("Claude Agent SDK turn ended without a result.")
    return result_box[0]


async def _run_sdk_turn(
    *,
    prompt: str,
    system_prompt: str,
    model: str,
    api_key: str,
    registry: ToolRegistry,
    tool_names: list[str],
    tool_context: ToolExecutionContext,
    trace_metadata: dict[str, Any],
    initial_sources: list[dict[str, Any]],
    step_index_offset: int,
    max_turns: int,
    max_budget_usd: float,
    tool_timeout_seconds: float,
    heartbeat_seconds: float,
    usage_sink: UsageSink | None,
    events: queue.Queue[dict[str, Any] | _WorkerFailure | object],
    query_impl: QueryImpl,
) -> VcsoSdkTurnResult:
    source_refs: list[dict[str, Any]] = list(initial_sources)
    trace_steps: list[dict[str, Any]] = []
    step_indexes: dict[str, int] = {}
    running_steps: dict[str, deque[int]] = defaultdict(deque)
    tool_outcomes: dict[str, deque[_ToolOutcome]] = defaultdict(deque)
    compaction_count = 0
    turn_trace_emitted = False
    usage_recorded = False
    next_step_index = step_index_offset + 1

    definitions = _selected_definitions(registry, tool_names)
    tool_context.metadata["enforce_persistence_guardrail"] = True

    def allocate_step(tool_use_id: str | None, sdk_tool_name: str) -> int:
        nonlocal next_step_index
        key = str(tool_use_id or sdk_tool_name)
        if key not in step_indexes:
            step_indexes[key] = next_step_index
            next_step_index += 1
        return step_indexes[key]

    def emit_tool_start(sdk_tool_name: str, tool_use_id: str | None) -> None:
        registry_name = _registry_name(sdk_tool_name)
        step_index = allocate_step(tool_use_id, sdk_tool_name)
        running_steps[sdk_tool_name].append(step_index)
        step_type, title, summary = _curated_tool_copy(registry_name, running=True)
        events.put(
            {
                "event": "step",
                "data": {
                    "stepIndex": step_index,
                    "stepType": step_type,
                    "title": title,
                    "summary": summary,
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
                    "stepType": step_type,
                    "title": title,
                    "tool": registry_name,
                    "input": {},
                    "summary": summary,
                    "status": "running",
                    "sourceRefs": [],
                },
            }
        )

    async def post_tool_use(input_data: dict[str, Any], tool_use_id: str | None, _context: Any) -> dict[str, Any]:
        sdk_tool_name = str(input_data.get("tool_name") or "tool")
        registry_name = _registry_name(sdk_tool_name)
        step_index = step_indexes.get(str(tool_use_id or sdk_tool_name)) or allocate_step(tool_use_id, sdk_tool_name)
        outcome = tool_outcomes[sdk_tool_name].popleft() if tool_outcomes[sdk_tool_name] else _ToolOutcome("completed", [])
        if running_steps[sdk_tool_name]:
            running_steps[sdk_tool_name].popleft()
        step_type, title, summary = _curated_tool_copy(registry_name, running=False, failed=outcome.status == "failed")
        step = {
            "stepIndex": step_index,
            "stepType": step_type,
            "title": title,
            "tool": registry_name,
            "input": {},
            "output": "{}",
            "summary": summary,
            "status": outcome.status,
            "sourceRefs": outcome.sources,
        }
        trace_steps.append(step)
        _record_post_tool_trace(metadata=trace_metadata, tool_name=sdk_tool_name, tool_use_id=tool_use_id)
        events.put({"event": "tool_result", "data": step})
        return {}

    async def stop_hook(_input_data: dict[str, Any], _tool_use_id: str | None, _context: Any) -> dict[str, Any]:
        nonlocal turn_trace_emitted
        _record_turn_trace(metadata=trace_metadata, status="completed")
        turn_trace_emitted = True
        return {}

    async def pre_compact_hook(_input_data: dict[str, Any], _tool_use_id: str | None, _context: Any) -> dict[str, Any]:
        nonlocal compaction_count, next_step_index
        compaction_count += 1
        step = {
            "stepIndex": next_step_index,
            "stepType": "context_build",
            "title": "Context optimized",
            "tool": None,
            "input": {},
            "output": "{}",
            "summary": "The SDK compacted the active turn context within its bounded lifecycle.",
            "status": "completed",
            "sourceRefs": [],
        }
        next_step_index += 1
        trace_steps.append(step)
        events.put({"event": "step", "data": {key: value for key, value in step.items() if key not in {"tool", "input", "output"}}})
        return {}

    sdk_tools = [
        _make_sdk_tool(
            definition=definition,
            registry=registry,
            tool_context=tool_context,
            events=events,
            running_steps=running_steps,
            tool_outcomes=tool_outcomes,
            source_refs=source_refs,
            timeout_seconds=tool_timeout_seconds,
            heartbeat_seconds=heartbeat_seconds,
        )
        for definition in definitions
    ]
    server = create_sdk_mcp_server(name=SDK_TOOL_SERVER_NAME, version="1.0.0", tools=sdk_tools)
    post_hooks = [HookMatcher(matcher=f"^{SDK_TOOL_PREFIX}.*$", hooks=[post_tool_use])]
    compiled = compile_founder_sdk_options(
        store=tool_context.store,
        user_id=tool_context.user_id,
        registry=registry,
        requested_tool_names=[definition.name for definition in definitions],
        internal_mcp_server=server,
        system_prompt=(
            system_prompt
            + "\n\nThe standard Virtual CSO loop is running through the Claude Agent SDK. Use only the "
            "scoped ArchitectOS tools when additional evidence is needed. The selected founder context "
            "in the prompt is authoritative pre-assembly. Keep tool results compact, cite factual founder "
            "claims using source markers supplied in context or tool results, and never reveal raw tool "
            "payloads, hidden reasoning, or chain-of-thought."
        ),
        main_model=model,
        api_key=api_key,
        hooks={
            "PostToolUse": post_hooks,
            "Stop": [HookMatcher(hooks=[stop_hook])],
            "PreCompact": [HookMatcher(hooks=[pre_compact_hook])],
        },
        max_turns=max_turns,
        max_budget_usd=max_budget_usd,
    )
    options = compiled.options
    trace_metadata.update(
        {
            "sdk_compiled_tool_count": len(compiled.tool_names),
            "sdk_compiled_agent_count": len(compiled.agent_tool_grants),
            "sdk_compiled_connector_count": len(compiled.connector_names),
        }
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
            if event.get("type") == "content_block_start":
                block = event.get("content_block") or {}
                if block.get("type") == "tool_use":
                    emit_tool_start(
                        str(block.get("name") or "tool"),
                        str(block.get("id") or block.get("name") or "tool"),
                    )
            elif event.get("type") == "content_block_delta":
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
            input_tokens = _usage_input_total(usage)
            output_tokens = _usage_int(usage, "output_tokens", "outputTokens")
            if message.total_cost_usd is not None:
                total_cost_usd = Decimal(str(message.total_cost_usd))
            if usage_sink is not None:
                try:
                    usage_sink(
                        VcsoSdkUsage(
                            input_tokens=input_tokens,
                            output_tokens=output_tokens,
                            total_cost_usd=total_cost_usd,
                            session_id=session_id,
                        )
                    )
                    usage_recorded = True
                except Exception as exc:  # noqa: BLE001 - metering failure must not erase the founder answer
                    logger.warning("SDK ResultMessage usage sink failed open: %s", exc)

    if not turn_trace_emitted:
        _record_turn_trace(metadata=trace_metadata, status="completed")
        turn_trace_emitted = True
    answer_text = "".join(answer_parts).strip()
    if not answer_text and final_result_text:
        answer_text = final_result_text.strip()
        if answer_text:
            events.put({"event": "token", "data": {"text": answer_text}})
    if not answer_text:
        raise RuntimeError("Claude Agent SDK returned no assistant text.")
    return VcsoSdkTurnResult(
        answer_text=answer_text,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_cost_usd=total_cost_usd,
        session_id=session_id,
        sources=source_refs,
        tool_steps=sorted(trace_steps, key=lambda step: int(step.get("stepIndex") or 0)),
        compaction_count=compaction_count,
        turn_trace_emitted=turn_trace_emitted,
        usage_recorded=usage_recorded,
    )


def _make_sdk_tool(
    *,
    definition: ToolDefinition,
    registry: ToolRegistry,
    tool_context: ToolExecutionContext,
    events: queue.Queue[dict[str, Any] | _WorkerFailure | object],
    running_steps: dict[str, deque[int]],
    tool_outcomes: dict[str, deque[_ToolOutcome]],
    source_refs: list[dict[str, Any]],
    timeout_seconds: float,
    heartbeat_seconds: float,
) -> Any:
    sdk_name = _sdk_tool_name(definition.name)

    async def execute(args: dict[str, Any]) -> dict[str, Any]:
        task = asyncio.create_task(asyncio.to_thread(registry.execute, definition.name, tool_context, args))
        elapsed = 0.0
        try:
            while True:
                try:
                    envelope = await asyncio.wait_for(asyncio.shield(task), timeout=max(0.01, heartbeat_seconds))
                    break
                except asyncio.TimeoutError:
                    elapsed += max(0.01, heartbeat_seconds)
                    step_index = running_steps[sdk_name][0] if running_steps[sdk_name] else 0
                    events.put(
                        {
                            "event": "heartbeat",
                            "data": {
                                "stepIndex": step_index,
                                "tool": definition.name,
                                "elapsedSeconds": elapsed,
                            },
                        }
                    )
                    if elapsed >= max(timeout_seconds, heartbeat_seconds):
                        task.cancel()
                        raise TimeoutError(f"{definition.name} exceeded the configured VCSO tool deadline.")
            sources = [source.to_dict() for source in envelope.sources]
            source_refs.extend(sources)
            tool_outcomes[sdk_name].append(_ToolOutcome("completed", sources))
            safe_content = json.dumps(envelope.to_dict(), default=str)
            return {"content": [{"type": "text", "text": safe_content[:12000]}]}
        except Exception as exc:  # noqa: BLE001 - return a bounded tool error to the SDK loop
            logger.warning("SDK registry tool %s failed: %s", definition.name, exc)
            tool_outcomes[sdk_name].append(_ToolOutcome("failed", []))
            return {
                "content": [{"type": "text", "text": json.dumps({"error": "Tool failed safely."})}],
                "is_error": True,
            }

    read_only_hint = _read_only_hint(definition.name)
    decorated = tool(
        definition.name,
        definition.description,
        definition.json_schema,
        annotations=ToolAnnotations(
            title=_humanize_tool_name(definition.name),
            readOnlyHint=read_only_hint,
            destructiveHint=False,
            idempotentHint=True if read_only_hint else False,
            openWorldHint=False,
        ),
    )(execute)
    return decorated


def _selected_definitions(registry: ToolRegistry, tool_names: list[str]) -> list[ToolDefinition]:
    selected: list[ToolDefinition] = []
    seen: set[str] = set()
    for name in tool_names:
        if name in seen:
            continue
        selected.append(registry.get(name))
        seen.add(name)
    return selected


def _sdk_tool_name(registry_name: str) -> str:
    return f"{SDK_TOOL_PREFIX}{registry_name}"


def _registry_name(sdk_tool_name: str) -> str:
    return sdk_tool_name[len(SDK_TOOL_PREFIX) :] if sdk_tool_name.startswith(SDK_TOOL_PREFIX) else sdk_tool_name


def _humanize_tool_name(name: str) -> str:
    return name.replace("_", " ").replace("-", " ").strip().title() or "ArchitectOS tool"


def _read_only_hint(name: str) -> bool:
    """Conservative Phase-B hint only; Phase C adds registry-enforced persistence semantics."""

    lower = name.lower()
    write_tokens = ("annotate", "write", "edit", "create", "update", "delete", "register", "persist")
    return not any(token in lower for token in write_tokens)


def _curated_tool_copy(name: str, *, running: bool, failed: bool = False) -> tuple[str, str, str]:
    lower = name.lower()
    step_type = "source_review" if any(token in lower for token in ("wiki", "kb_", "search", "read", "list")) else "tool_call"
    title = _humanize_tool_name(name)
    if failed:
        return step_type, title, f"{title} could not complete; the turn continued safely."
    if running:
        return step_type, title, f"Using {title.lower()} for this answer."
    return step_type, title, f"{title} completed."


def _record_turn_trace(*, metadata: dict[str, Any], status: str) -> None:
    """Emit one sanitized lifecycle trace per SDK standard turn."""

    try:
        from langsmith.run_helpers import trace

        with trace(
            "vcso_sdk_turn",
            run_type="chain",
            inputs={"surface": "virtual_cso"},
            metadata={**metadata, "hook": "Stop", "sdk_phase": "04B-B"},
            tags=[VCSO_SDK_CAPABILITY_KEY],
        ) as run:
            run.end(outputs={"status": status})
    except Exception as exc:  # noqa: BLE001 - observability must remain fail-open
        logger.warning("SDK lifecycle trace failed open: %s", exc)


def _record_post_tool_trace(*, metadata: dict[str, Any], tool_name: str, tool_use_id: str | None) -> None:
    """Emit a sanitized, fail-open child trace from the SDK PostToolUse hook."""

    try:
        from langsmith.run_helpers import trace

        with trace(
            "vcso_sdk_post_tool_use",
            run_type="tool",
            inputs={"tool": _registry_name(tool_name)},
            metadata={**metadata, "tool_use_id": tool_use_id, "hook": "PostToolUse", "sdk_phase": "04B-B"},
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


def _usage_input_total(usage: dict[str, Any]) -> int | None:
    """Record the SDK's full input footprint, including prompt-cache reads/writes."""

    values = [
        _usage_int(usage, "input_tokens", "inputTokens"),
        _usage_int(usage, "cache_read_input_tokens", "cacheReadInputTokens"),
        _usage_int(usage, "cache_creation_input_tokens", "cacheCreationInputTokens"),
    ]
    present = [value for value in values if value is not None]
    return sum(present) if present else None
