"""Feature-gated Claude Agent SDK loop for standard Virtual CSO turns."""

from __future__ import annotations

import asyncio
import json
import logging
import queue
import re
import threading
from collections import defaultdict, deque
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, AsyncIterator, Callable, Iterator

from claude_agent_sdk import (
    AssistantMessage,
    HookMatcher,
    ResultMessage,
    ToolAnnotations,
    query,
    tool,
)
from claude_agent_sdk.types import StreamEvent

from services.tool_registry import ToolDefinition, ToolExecutionContext, ToolRegistry
from services.vcso_sdk_config import compile_founder_sdk_options
from services.sub_agent_orchestrator import SubAgentOrchestrator, SubAgentRunRequest


logger = logging.getLogger(__name__)

VCSO_SDK_LOOP_FLAG = "vcso_sdk_loop"
VCSO_SDK_CAPABILITY_KEY = "vcso_sdk_loop"
SDK_STANDARD_SCHEMA_VERSION = "vcso_sdk_standard_v1"
SDK_NATIVE_SUBAGENT_SCHEMA_VERSION = "vcso_sdk_native_subagents_v1"
SDK_TOOL_SERVER_NAME = "architectos"
SDK_TOOL_PREFIX = f"mcp__{SDK_TOOL_SERVER_NAME}__"
NARRATION_OPEN = "<narration>"
NARRATION_CLOSE = "</narration>"
P4_NATIVE_SUBAGENT_KEYS = (
    "document_analysis_agent",
    "structured_data_agent",
    "kb_explorer_agent",
    "sandbox_execution_agent",
    "per_user_wiki",
    "per_user_document_wiki",
    "global_ip",
)
P4_THIN_SLICE_REQUIRED_AGENTS = (
    "structured_data_agent",
    "sandbox_execution_agent",
    "per_user_wiki",
)
P4_THIN_SLICE_SIGNALS = re.compile(
    r"(?=.*\b(?:financial|p&l|margin|revenue)\b)(?=.*\bconcentration\b)(?=.*\b90\s+days?\b)",
    re.IGNORECASE | re.DOTALL,
)
NATIVE_LEGACY_TOOL_PARAGRAPH = re.compile(
    r"\n*You may call tools mid-turn\. Use tool_search to discover relevant tools or skill packs before\s+"
    r"using specialized tools\. Prefer direct registry tools for narrow reads/computations, and\s+"
    r"delegate_to_sub_agent for bounded research or sandbox work that should run in a compact\s+"
    r"sub-agent window\.\n*",
    re.DOTALL,
)


@dataclass(frozen=True)
class VcsoSdkUsage:
    input_tokens: int | None
    output_tokens: int | None
    total_cost_usd: Decimal | None
    session_id: str | None
    model: str | None = None
    role: str = "main"
    capability_key: str | None = None
    run_id: str | None = None


@dataclass(frozen=True)
class VcsoSdkTurnResult:
    answer_text: str
    input_tokens: int | None
    output_tokens: int | None
    total_cost_usd: Decimal | None
    session_id: str | None
    sources: list[dict[str, Any]] = field(default_factory=list)
    tool_steps: list[dict[str, Any]] = field(default_factory=list)
    narration_segments: list[dict[str, Any]] = field(default_factory=list)
    worker_runs: list[dict[str, Any]] = field(default_factory=list)
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


@dataclass
class _NarrationStreamNormalizer:
    """Strip explicit progress markers while preserving real text deltas."""

    buffer: str = ""
    in_narration: bool = False
    narration_segment: int = 0

    def feed(self, chunk: str) -> list[tuple[str, str, int | None]]:
        self.buffer += chunk
        pieces: list[tuple[str, str, int | None]] = []
        while self.buffer:
            marker = NARRATION_CLOSE if self.in_narration else NARRATION_OPEN
            marker_index = self.buffer.find(marker)
            if marker_index >= 0:
                self._append_piece(pieces, self.buffer[:marker_index])
                self.buffer = self.buffer[marker_index + len(marker) :]
                if self.in_narration:
                    self.in_narration = False
                else:
                    self.in_narration = True
                    self.narration_segment += 1
                continue

            retained = _marker_prefix_suffix_length(self.buffer, marker)
            safe_length = len(self.buffer) - retained
            if safe_length <= 0:
                break
            self._append_piece(pieces, self.buffer[:safe_length])
            self.buffer = self.buffer[safe_length:]
        return pieces

    def finish(self) -> list[tuple[str, str, int | None]]:
        pieces: list[tuple[str, str, int | None]] = []
        marker = NARRATION_CLOSE if self.in_narration else NARRATION_OPEN
        marker_prefixes = {marker[:length] for length in range(1, len(marker) + 1)}
        if self.buffer and self.buffer not in marker_prefixes:
            self._append_piece(pieces, self.buffer)
        self.buffer = ""
        return pieces

    def _append_piece(self, pieces: list[tuple[str, str, int | None]], text: str) -> None:
        if not text:
            return
        channel = "narration" if self.in_narration else "answer"
        segment = self.narration_segment if self.in_narration else None
        pieces.append((channel, text, segment))


_WORKER_DONE = object()
QueryImpl = Callable[..., AsyncIterator[Any]]
UsageSink = Callable[[VcsoSdkUsage], None]
LifecycleSink = Callable[[dict[str, Any]], None]


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


def native_subagent_requirements(
    *,
    message: str,
    intent: dict[str, Any] | None,
    settings: dict[str, Any] | None = None,
    user_id: str | None = None,
) -> tuple[str, ...]:
    """Return the single Phase-D delegation contract; do not generalize before London."""

    intent = intent or {}
    if str(intent.get("move_type") or intent.get("intent") or "") != "strategic_synthesis":
        return ()
    if str(intent.get("depth") or "") != "deep":
        return ()
    if not P4_THIN_SLICE_SIGNALS.search(message):
        return ()
    settings = settings or {}
    diagnostic_user_ids = {str(value) for value in settings.get("diagnostic_user_ids") or []}
    diagnostic_worker = str(settings.get("diagnostic_single_worker") or "").strip()
    if (
        bool(settings.get("diagnostic_single_worker_enabled"))
        and bool(user_id)
        and str(user_id) in diagnostic_user_ids
        and diagnostic_worker in P4_THIN_SLICE_REQUIRED_AGENTS
    ):
        return (diagnostic_worker,)
    return P4_THIN_SLICE_REQUIRED_AGENTS


def build_native_runtime_manifest(compiled: Any, *, required_agents: tuple[str, ...]) -> dict[str, Any]:
    """Describe the native SDK surface without exposing prompts, credentials, or tool payloads."""

    options = compiled.options
    selected_registry_tools = list(compiled.tool_names)
    allowed_tools = list(options.allowed_tools or [])
    worker_tools = {
        key: list(getattr(agent, "tools", None) or [])
        for key, agent in (options.agents or {}).items()
        if key in required_agents
    }
    worker_mcp_servers = {
        key: list(getattr(agent, "mcpServers", None) or [])
        for key, agent in (options.agents or {}).items()
        if key in required_agents
    }
    registered_handler_tools = {
        key: f"mcp__{SDK_TOOL_SERVER_NAME}__{handler}"
        for key, handler in compiled.agent_handler_tools.items()
        if key in required_agents
    }
    handler_tools = {
        key: f"{SDK_TOOL_PREFIX}run_{key}"
        for key in required_agents
    }
    system_prompt = str(options.system_prompt or "")
    violations: list[str] = []
    if selected_registry_tools:
        violations.append("native_lead_registry_tools_registered")
    if "delegate_to_sub_agent" in system_prompt:
        violations.append("native_prompt_contains_legacy_delegation_instruction")
    if "PHASE-D NATIVE SUBAGENT CONTRACT" not in system_prompt:
        violations.append("native_prompt_missing_phase_d_contract")
    if "Task" not in allowed_tools:
        violations.append("native_lead_task_not_preapproved")
    for key, handler_tool in handler_tools.items():
        if key not in (options.agents or {}):
            violations.append(f"required_worker_agent_missing:{key}")
        if registered_handler_tools.get(key) != handler_tool:
            violations.append(f"worker_handler_not_registered:{key}")
        if handler_tool not in worker_tools.get(key, []):
            violations.append(f"worker_handler_surface_mismatch:{key}")
        if handler_tool not in allowed_tools:
            violations.append(f"worker_handler_not_preapproved:{key}")
        if SDK_TOOL_SERVER_NAME not in worker_mcp_servers.get(key, []):
            violations.append(f"worker_handler_server_not_scoped:{key}")
    return {
        "required_agents": list(required_agents),
        "lead_selected_registry_tools": selected_registry_tools,
        "lead_allowed_tools": allowed_tools,
        "lead_disallowed_tools": list(options.disallowed_tools or []),
        "registered_worker_handlers": registered_handler_tools,
        "worker_tools": worker_tools,
        "worker_mcp_servers": worker_mcp_servers,
        "prompt_contract_order": {
            "legacy_delegate_instruction_present": "delegate_to_sub_agent" in system_prompt,
            "native_contract_present": "PHASE-D NATIVE SUBAGENT CONTRACT" in system_prompt,
            "native_contract_after_legacy": (
                system_prompt.find("PHASE-D NATIVE SUBAGENT CONTRACT")
                > system_prompt.find("delegate_to_sub_agent")
                >= 0
            ),
        },
        "violations": violations,
    }


def _native_base_system_prompt(system_prompt: str) -> str:
    """Remove flat-loop tool advice so the native lead receives one unambiguous Task contract."""

    cleaned = NATIVE_LEGACY_TOOL_PARAGRAPH.sub("\n\n", system_prompt).strip()
    if "delegate_to_sub_agent" in cleaned:
        raise RuntimeError("Native SDK prompt still contains legacy delegation instructions.")
    return cleaned


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
    native_subagent_required_agents: tuple[str, ...] = (),
    native_subagent_scopes: dict[str, dict[str, Any]] | None = None,
    native_lifecycle_sink: LifecycleSink | None = None,
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
                        native_subagent_required_agents=native_subagent_required_agents,
                        native_subagent_scopes=native_subagent_scopes or {},
                        native_lifecycle_sink=native_lifecycle_sink,
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
    native_subagent_required_agents: tuple[str, ...],
    native_subagent_scopes: dict[str, dict[str, Any]],
    native_lifecycle_sink: LifecycleSink | None,
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
    native_mode = bool(native_subagent_required_agents)
    required_agents = tuple(
        key for key in native_subagent_required_agents if key in P4_NATIVE_SUBAGENT_KEYS
    )
    task_capabilities: dict[str, str] = {}
    task_contracts: dict[str, dict[str, Any]] = {}
    task_sources: dict[str, list[dict[str, Any]]] = defaultdict(list)
    worker_results: dict[str, Any] = {}
    child_usage_records: list[dict[str, Any]] = []
    completed_agents: set[str] = set()
    delegation_count = 0
    max_delegations = len(required_agents)
    plan_statuses = {key: "pending" for key in required_agents}
    lifecycle_sequence = 0

    def record_lifecycle(event: str, **details: Any) -> None:
        """Persist bounded lifecycle facts without prompts, tool inputs, or model output."""

        nonlocal lifecycle_sequence
        if not native_mode or native_lifecycle_sink is None:
            return
        lifecycle_sequence += 1
        safe: dict[str, Any] = {
            "sequence": lifecycle_sequence,
            "event": str(event)[:80],
        }
        for key in (
            "tool_name",
            "tool_use_id",
            "capability_key",
            "agent_type",
            "decision",
            "reason_code",
            "child_run_id",
            "child_status",
        ):
            value = details.get(key)
            if value not in (None, ""):
                safe[key] = str(value)[:200]
        if "agent_id_present" in details:
            safe["agent_id_present"] = bool(details["agent_id_present"])
        if "delegated" in details:
            safe["delegated"] = bool(details["delegated"])
        try:
            native_lifecycle_sink(safe)
        except Exception as exc:  # noqa: BLE001 - diagnostics must never affect the turn
            logger.warning("SDK lifecycle persistence failed open: %s", exc)

    def emit_plan_update() -> None:
        if not native_mode:
            return
        labels = {
            "structured_data_agent": "Bind the latest founder financial dataset",
            "sandbox_execution_agent": "Compute concentration and margin trend",
            "per_user_wiki": "Review strategic pricing and constraint context",
        }
        todos = [
            {
                "id": key,
                "content": labels.get(key, key.replace("_", " ").title()),
                "status": plan_statuses[key],
                "position": index,
            }
            for index, key in enumerate(required_agents)
        ]
        todos.append(
            {
                "id": "compose",
                "content": "Compose the cited 90-day recommendation",
                "status": "in_progress" if completed_agents.issuperset(required_agents) else "pending",
                "position": len(todos),
            }
        )
        events.put({"event": "todos_updated", "data": {"todos": todos, "sdkMode": True}})

    emit_plan_update()

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

    def emit_subagent_start(capability_key: str, tool_use_id: str) -> None:
        step_index = allocate_step(tool_use_id, "Task")
        title = _subagent_title(capability_key)
        events.put(
            {
                "event": "step",
                "data": {
                    "stepIndex": step_index,
                    "stepType": "sub_agent",
                    "title": title,
                    "summary": f"{title} is gathering a compact cited finding.",
                    "status": "running",
                    "sourceRefs": [],
                    "capabilityKey": capability_key,
                    "parentToolUseId": tool_use_id,
                },
            }
        )
        events.put(
            {
                "event": "tool_call",
                "data": {
                    "stepIndex": step_index,
                    "stepType": "sub_agent",
                    "title": title,
                    "tool": "Task",
                    "input": {},
                    "summary": f"Delegated to {title.lower()} with a bounded task contract.",
                    "status": "running",
                    "sourceRefs": [],
                    "capabilityKey": capability_key,
                    "parentToolUseId": tool_use_id,
                },
            }
        )

    async def pre_task_use(
        input_data: dict[str, Any],
        tool_use_id: str | None,
        _context: Any,
    ) -> dict[str, Any]:
        nonlocal delegation_count
        tool_input = input_data.get("tool_input") if isinstance(input_data.get("tool_input"), dict) else {}
        capability_key = str(tool_input.get("subagent_type") or "").strip()
        task_id = str(tool_use_id or "")
        try:
            contract = _parse_task_contract(tool_input.get("prompt"))
            if capability_key not in required_agents:
                raise ValueError("This Phase-D canary may delegate only the approved thin-slice workers.")
            if capability_key in task_capabilities.values():
                raise ValueError("Each approved thin-slice worker may run only once per turn.")
            if delegation_count >= max_delegations:
                raise ValueError("The Phase-D per-turn delegation cap has been reached.")
            if capability_key == "sandbox_execution_agent":
                if "structured_data_agent" not in completed_agents:
                    raise ValueError("Run structured_data_agent to completion before sandbox_execution_agent.")
                prior = (contract.get("context_scope") or {}).get("prior_findings")
                if not prior:
                    raise ValueError("The sandbox contract must inherit the compact structured-data finding.")
        except (TypeError, ValueError, json.JSONDecodeError) as exc:
            record_lifecycle(
                "task_pre_tool_use",
                tool_name="Task",
                tool_use_id=task_id,
                capability_key=capability_key,
                agent_id_present=bool(input_data.get("agent_id")),
                decision="deny",
                reason_code=str(exc),
            )
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": str(exc),
                }
            }
        delegation_count += 1
        task_capabilities[task_id] = capability_key
        task_contracts[capability_key] = contract
        plan_statuses[capability_key] = "in_progress"
        emit_subagent_start(capability_key, task_id)
        emit_plan_update()
        record_lifecycle(
            "task_pre_tool_use",
            tool_name="Task",
            tool_use_id=task_id,
            capability_key=capability_key,
            agent_id_present=bool(input_data.get("agent_id")),
            decision="allow",
            reason_code="approved_bounded_contract",
        )
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "allow",
                "permissionDecisionReason": "Approved bounded Phase-D delegation contract.",
            }
        }

    async def pre_worker_handler_gate(
        input_data: dict[str, Any],
        tool_use_id: str | None,
        _context: Any,
    ) -> dict[str, Any]:
        tool_name = str(input_data.get("tool_name") or "")
        handler_prefix = f"{SDK_TOOL_PREFIX}run_"
        capability_key = tool_name[len(handler_prefix):] if tool_name.startswith(handler_prefix) else ""
        agent_id_present = bool(input_data.get("agent_id"))
        agent_type = str(input_data.get("agent_type") or "")
        delegated = (
            agent_id_present
            and agent_type == capability_key
            and capability_key in task_contracts
        )
        try:
            logger.info(
                "vcso_sdk worker pretooluse gate tool=%s agent_id_present=%s agent_type=%s delegated=%s tool_use_id=%s",
                tool_name,
                agent_id_present,
                agent_type,
                delegated,
                tool_use_id,
            )
            record_lifecycle(
                "worker_pre_tool_use_gate",
                tool_name=tool_name,
                tool_use_id=tool_use_id,
                capability_key=capability_key,
                agent_id_present=agent_id_present,
                agent_type=agent_type,
                decision="allow" if delegated else "deny",
                reason_code="approved_task_subagent" if delegated else "lead_or_mismatched_subagent",
            )
        except Exception:  # noqa: BLE001 - logging/persistence must not weaken the gate
            pass
        if not delegated:
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": (
                        "Worker handlers are available only to their matching approved Task subagent."
                    ),
                }
            }
        # The global allowed_tools entry remains the SDK 0.2.118 permission grant. Returning no
        # decision here avoids replacing that grant after the lead/subagent boundary is verified.
        return {}

    async def subagent_start_hook(
        input_data: dict[str, Any], tool_use_id: str | None, _context: Any
    ) -> dict[str, Any]:
        record_lifecycle(
            "subagent_start",
            tool_use_id=tool_use_id,
            agent_type=input_data.get("agent_type"),
            agent_id_present=bool(input_data.get("agent_id")),
        )
        return {}

    async def subagent_stop_hook(
        input_data: dict[str, Any], tool_use_id: str | None, _context: Any
    ) -> dict[str, Any]:
        record_lifecycle(
            "subagent_stop",
            tool_use_id=tool_use_id,
            agent_type=input_data.get("agent_type"),
            agent_id_present=bool(input_data.get("agent_id")),
        )
        return {}

    async def post_tool_failure(
        input_data: dict[str, Any], tool_use_id: str | None, _context: Any
    ) -> dict[str, Any]:
        error = input_data.get("error")
        record_lifecycle(
            "post_tool_use_failure",
            tool_name=input_data.get("tool_name"),
            tool_use_id=tool_use_id,
            agent_id_present=bool(input_data.get("agent_id")),
            reason_code=type(error).__name__ if isinstance(error, BaseException) else "sdk_tool_failure",
        )
        return {}

    async def post_tool_use(input_data: dict[str, Any], tool_use_id: str | None, _context: Any) -> dict[str, Any]:
        sdk_tool_name = str(input_data.get("tool_name") or "tool")
        if sdk_tool_name.startswith(f"mcp__{SDK_TOOL_SERVER_NAME}__run_"):
            _record_post_tool_trace(metadata=trace_metadata, tool_name=sdk_tool_name, tool_use_id=tool_use_id)
            return {}
        if sdk_tool_name == "Task":
            task_id = str(tool_use_id or "")
            capability_key = task_capabilities.get(task_id, "bounded_worker")
            step_index = allocate_step(task_id, sdk_tool_name)
            result = worker_results.get(capability_key)
            status = "completed" if result is not None and result.status == "completed" else "failed"
            sources = task_sources.get(task_id, [])
            title = _subagent_title(capability_key)
            summary = (
                str(result.result_summary or f"{title} returned a compact finding.")[:500]
                if result is not None
                else f"{title} could not complete; the turn stayed bounded."
            )
            safe_output = {
                "run_id": getattr(result, "run_id", None),
                "capability_key": capability_key,
                "status": status,
                "result_summary": summary,
            }
            step = {
                "stepIndex": step_index,
                "stepType": "sub_agent",
                "title": title,
                "tool": "Task",
                "input": {},
                "output": json.dumps(safe_output),
                "summary": summary,
                "status": status,
                "sourceRefs": sources,
                "parentToolUseId": task_id,
                "capabilityKey": capability_key,
            }
            trace_steps.append(step)
            _record_post_tool_trace(metadata=trace_metadata, tool_name=sdk_tool_name, tool_use_id=tool_use_id)
            events.put({"event": "tool_result", "data": step})
            if status == "completed":
                completed_agents.add(capability_key)
                plan_statuses[capability_key] = "completed"
            else:
                plan_statuses[capability_key] = "pending"
            emit_plan_update()
            return {}
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
        missing = [key for key in required_agents if key not in completed_agents]
        if missing:
            return {
                "decision": "block",
                "reason": (
                    "The bounded Phase-D plan is incomplete. Delegate the missing required worker(s): "
                    + ", ".join(missing)
                ),
            }
        _record_turn_trace(metadata=trace_metadata, status="completed")
        turn_trace_emitted = True
        if native_mode:
            todos = [
                {
                    "id": key,
                    "content": _subagent_plan_label(key),
                    "status": "completed",
                    "position": index,
                }
                for index, key in enumerate(required_agents)
            ]
            todos.append(
                {
                    "id": "compose",
                    "content": "Compose the cited 90-day recommendation",
                    "status": "completed",
                    "position": len(todos),
                }
            )
            events.put({"event": "todos_updated", "data": {"todos": todos, "sdkMode": True}})
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

    candidate_definitions = registry.definitions() if hasattr(registry, "definitions") else definitions
    sdk_tools_by_name = {
        definition.name: _make_sdk_tool(
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
        for definition in candidate_definitions
    }

    def make_native_handler_tool(capability_key: str) -> Any:
        tool_name = f"run_{capability_key}"

        async def execute(args: dict[str, Any]) -> dict[str, Any]:
            task_id = next(
                (key for key, value in reversed(list(task_capabilities.items())) if value == capability_key),
                "",
            )
            delegated = capability_key in task_contracts
            logger.info(
                "vcso_sdk native worker handler fired capability=%s delegated=%s task_id=%s",
                capability_key,
                delegated,
                task_id or None,
            )
            record_lifecycle(
                "native_handler_entry",
                tool_name=tool_name,
                capability_key=capability_key,
                delegated=delegated,
                tool_use_id=task_id,
            )
            # Delegation-first guard (SDK-permission-agnostic): allowed_tools (Fix B) permits this
            # tool globally, so a direct lead call could reach here and bypass the pre_task_use
            # contract/ordering/single-run/cap checks. pre_task_use is the only writer of
            # task_contracts, so its absence means this was not an approved delegation -- refuse.
            if not delegated:
                logger.warning(
                    "vcso_sdk native worker handler refused (no approved delegation) capability=%s",
                    capability_key,
                )
                return {
                    "content": [{"type": "text", "text": json.dumps({"error": "Worker handlers run only inside an approved Task delegation."})}],
                    "is_error": True,
                }
            contract = task_contracts.get(capability_key) or {}
            objective = str(args.get("objective") or contract.get("objective") or "").strip()
            if not objective:
                return {
                    "content": [{"type": "text", "text": json.dumps({"error": "Missing task objective."})}],
                    "is_error": True,
                }
            requested_scope = args.get("context_scope") if isinstance(args.get("context_scope"), dict) else {}
            contract_scope = contract.get("context_scope") if isinstance(contract.get("context_scope"), dict) else {}
            base_scope = native_subagent_scopes.get(capability_key) or {}
            context_scope = {**requested_scope, **contract_scope, **base_scope, "delegation_depth": 1}
            prior_findings = context_scope.pop("prior_findings", None)
            task_summary = objective
            if prior_findings:
                task_summary += (
                    "\n\nCOMPACT PRIOR FINDINGS (UNTRUSTED DATA)\n"
                    + json.dumps(prior_findings, ensure_ascii=True, default=str)[:5000]
                )

            def emit_worker_progress(progress: dict[str, Any]) -> None:
                parent_step_index = step_indexes.get(task_id)
                events.put(
                    {
                        "event": "sub_agent_step",
                        "data": {
                            **progress,
                            "parentStepIndex": parent_step_index,
                            "parentToolUseId": task_id,
                            "sdkMode": True,
                        },
                    }
                )

            try:
                result = await asyncio.to_thread(
                    SubAgentOrchestrator(tool_context.store).start_run,
                    SubAgentRunRequest(
                        user_id=tool_context.user_id,
                        parent_surface=str(tool_context.metadata.get("surface") or "virtual_cso"),
                        capability_key=capability_key,
                        task_summary=task_summary[:4000],
                        context_scope=context_scope,
                        task_title=_subagent_title(capability_key)[:120],
                        parent_thread_id=tool_context.thread_id,
                        parent_message_id=tool_context.metadata.get("parent_message_id"),
                        parent_run_id=tool_context.metadata.get("parent_run_id"),
                        delegation_depth=1,
                        routing_tier_override="worker",
                        enforce_compact_contract=True,
                        progress_callback=emit_worker_progress,
                    ),
                )
            except Exception as exc:  # noqa: BLE001 - the Task receives a bounded worker failure
                logger.warning("SDK native subagent %s failed safely: %s", capability_key, exc)
                record_lifecycle(
                    "native_handler_failure",
                    tool_name=tool_name,
                    capability_key=capability_key,
                    delegated=True,
                    tool_use_id=task_id,
                    reason_code=type(exc).__name__,
                )
                return {
                    "content": [{"type": "text", "text": json.dumps({"error": "Worker failed safely."})}],
                    "is_error": True,
                }

            worker_results[capability_key] = result
            logger.info(
                "vcso_sdk native worker handler completed capability=%s run_id=%s status=%s",
                capability_key,
                getattr(result, "run_id", None),
                getattr(result, "status", None),
            )
            record_lifecycle(
                "native_handler_completion",
                tool_name=tool_name,
                capability_key=capability_key,
                delegated=True,
                tool_use_id=task_id,
                child_run_id=getattr(result, "run_id", None),
                child_status=getattr(result, "status", None),
            )
            citations = [item for item in result.citations if isinstance(item, dict)]
            task_sources[task_id].extend(citations)
            source_refs.extend(citations)
            curated_sources = _curated_worker_sources(citations)
            if curated_sources:
                events.put(
                    {
                        "event": "sources_updated",
                        "data": {"sources": curated_sources, "sdkMode": True},
                    }
                )
            safe_result = {
                "run_id": result.run_id,
                "status": result.status,
                "result_summary": result.result_summary,
                "structured_result": result.structured_result,
                "citations": citations,
            }
            return {"content": [{"type": "text", "text": json.dumps(safe_result, default=str)[:12000]}]}

        return tool(
            tool_name,
            f"Run the founder-scoped bounded {capability_key} implementation for an approved Task contract.",
            {
                "type": "object",
                "properties": {
                    "objective": {"type": "string"},
                    "output_format": {"type": ["string", "object", "array"]},
                    "tools_sources": {"type": "array", "items": {"type": "string"}},
                    "boundaries": {"type": "array", "items": {"type": "string"}},
                    "context_scope": {"type": "object", "additionalProperties": True},
                },
                "required": ["objective", "output_format", "tools_sources", "boundaries", "context_scope"],
            },
            annotations=ToolAnnotations(
                title=_subagent_title(capability_key),
                readOnlyHint=True,
                destructiveHint=False,
                idempotentHint=False,
                openWorldHint=False,
            ),
        )(execute)

    async def run_app_owned_workers() -> list[dict[str, Any]]:
        # Path A: the application -- not the model -- runs the required workers via the proven
        # SubAgentOrchestrator, in dependency order, then hands their compact findings to the SDK lead
        # for synthesis only. No worker MCP tools and no Task are registered, so the lead cannot see or
        # select a handler (the visibility trap that failed the native attempts). This guarantees the
        # mandatory children deterministically; depth/isolation/tier/caps/citations are enforced inside
        # the orchestrator.
        ordered = [k for k in ("structured_data_agent", "per_user_wiki", "sandbox_execution_agent") if k in required_agents]
        ordered += [k for k in required_agents if k not in ordered]
        objectives = {
            "structured_data_agent": (
                "Bind the founder's latest ready financial dataset and return the compact, cited "
                "figures needed to assess client concentration and margin."
            ),
            "sandbox_execution_agent": (
                "Compute the client-concentration and margin trend from the provided structured "
                "finding; return the result, derivation, inherited citations, and confidence."
            ),
            "per_user_wiki": (
                "Gather the founder's relevant pricing, positioning, and constraint context for a "
                "90-day plan on rising client concentration and compressing margin."
            ),
        }
        collected: list[dict[str, Any]] = []
        structured_finding: dict[str, Any] | None = None
        for capability_key in ordered:
            task_id = f"app_{capability_key}"
            task_capabilities[task_id] = capability_key
            plan_statuses[capability_key] = "in_progress"
            emit_subagent_start(capability_key, task_id)
            emit_plan_update()
            context_scope = {**(native_subagent_scopes.get(capability_key) or {}), "delegation_depth": 1}
            objective = objectives.get(capability_key, f"Run the bounded {capability_key} capability.")
            task_summary = objective + "\n\nFOUNDER QUESTION (CONTEXT)\n" + str(prompt)[:2000]
            if capability_key == "sandbox_execution_agent" and structured_finding is not None:
                task_summary += (
                    "\n\nCOMPACT PRIOR FINDINGS (UNTRUSTED DATA)\n"
                    + json.dumps(structured_finding, ensure_ascii=True, default=str)[:5000]
                )

            def emit_worker_progress(progress: dict[str, Any], _task_id: str = task_id) -> None:
                events.put(
                    {
                        "event": "sub_agent_step",
                        "data": {
                            **progress,
                            "parentStepIndex": step_indexes.get(_task_id),
                            "parentToolUseId": _task_id,
                            "sdkMode": True,
                        },
                    }
                )

            record_lifecycle(
                "native_handler_entry",
                capability_key=capability_key,
                delegated=True,
                app_owned=True,
                tool_use_id=task_id,
            )
            try:
                result = await asyncio.to_thread(
                    SubAgentOrchestrator(tool_context.store).start_run,
                    SubAgentRunRequest(
                        user_id=tool_context.user_id,
                        parent_surface=str(tool_context.metadata.get("surface") or "virtual_cso"),
                        capability_key=capability_key,
                        task_summary=task_summary[:4000],
                        context_scope=context_scope,
                        task_title=_subagent_title(capability_key)[:120],
                        parent_thread_id=tool_context.thread_id,
                        parent_message_id=tool_context.metadata.get("parent_message_id"),
                        parent_run_id=tool_context.metadata.get("parent_run_id"),
                        delegation_depth=1,
                        routing_tier_override="worker",
                        enforce_compact_contract=True,
                        progress_callback=emit_worker_progress,
                    ),
                )
            except Exception as exc:  # noqa: BLE001 - a worker failure fails the native turn open to flat
                logger.warning("app-owned worker %s failed: %s", capability_key, exc)
                record_lifecycle(
                    "native_handler_failure",
                    capability_key=capability_key,
                    delegated=True,
                    app_owned=True,
                    tool_use_id=task_id,
                    reason_code=type(exc).__name__,
                )
                raise RuntimeError(f"App-owned worker {capability_key} failed: {exc}") from exc
            worker_results[capability_key] = result
            completed_agents.add(capability_key)
            plan_statuses[capability_key] = "completed"
            citations = [item for item in result.citations if isinstance(item, dict)]
            task_sources[task_id].extend(citations)
            source_refs.extend(citations)
            curated_sources = _curated_worker_sources(citations)
            if curated_sources:
                events.put({"event": "sources_updated", "data": {"sources": curated_sources, "sdkMode": True}})
            compact = {
                "capability_key": capability_key,
                "run_id": getattr(result, "run_id", None),
                "status": getattr(result, "status", None),
                "result_summary": getattr(result, "result_summary", None),
                "structured_result": getattr(result, "structured_result", None),
                "citations": citations,
            }
            collected.append(compact)
            if capability_key == "structured_data_agent":
                structured_finding = compact
            logger.info(
                "vcso_sdk app-owned worker completed capability=%s run_id=%s status=%s",
                capability_key, compact["run_id"], compact["status"],
            )
            record_lifecycle(
                "native_handler_completion",
                capability_key=capability_key,
                delegated=True,
                app_owned=True,
                tool_use_id=task_id,
                child_run_id=compact["run_id"],
                child_status=compact["status"],
            )
            emit_plan_update()
        return collected

    native_findings: list[dict[str, Any]] = []
    if native_mode:
        try:
            native_findings = await run_app_owned_workers()
        except RuntimeError as exc:
            # Preserve the existing fail-open contract: if deterministic pre-compose delegation
            # cannot complete, continue through the standard SDK/flat tool loop instead of
            # terminalizing the founder's turn. The worker failure has already been logged and
            # lifecycle-recorded without exposing its payload.
            logger.warning("App-owned delegation failed open to the standard SDK path: %s", exc)
            native_mode = False
            required_agents = ()
            native_findings = []
    # Path A: no worker MCP tools and no Task are registered; the lead composes from injected findings.
    native_subagent_tools: dict[str, Any] = {}
    hooks: dict[str, Any] = {
        "PostToolUse": [HookMatcher(matcher=r"^mcp__.*$", hooks=[post_tool_use])],
        "PostToolUseFailure": [HookMatcher(matcher=r"^(Task|mcp__.*)$", hooks=[post_tool_failure])],
        "Stop": [HookMatcher(hooks=[stop_hook])],
        "PreCompact": [HookMatcher(hooks=[pre_compact_hook])],
    }
    native_prompt = _native_synthesis_prompt(required_agents, native_findings) if native_mode else ""
    compiled_base_prompt = _native_base_system_prompt(system_prompt) if native_mode else system_prompt
    compiled = compile_founder_sdk_options(
        store=tool_context.store,
        user_id=tool_context.user_id,
        registry=registry,
        requested_tool_names=[definition.name for definition in definitions],
        sdk_tools_by_name=sdk_tools_by_name,
        system_prompt=(
            compiled_base_prompt
            + "\n\nThe standard Virtual CSO loop is running through the Claude Agent SDK. Use only the "
            "scoped ArchitectOS tools when additional evidence is needed. The selected founder context "
            "in the prompt is authoritative pre-assembly. Keep tool results compact, cite factual founder "
            "claims using source markers supplied in context or tool results, and never reveal raw tool "
            "payloads, hidden reasoning, or chain-of-thought. Before or between tool calls, you may give "
            "the founder one brief action-oriented progress line wrapped exactly in <narration> and "
            "</narration>. Narration says what you are doing next, never why you reasoned privately, and "
            "never contains tool inputs or results. Do not wrap the final answer in narration markers."
            + native_prompt
        ),
        main_model=model,
        api_key=api_key,
        hooks=hooks,
        max_turns=max_turns,
        max_budget_usd=max_budget_usd,
        enable_native_subagents=False,
        native_subagent_tools=native_subagent_tools,
    )
    options = compiled.options
    if native_mode:
        # Path A: the lead composes only from the app-run worker findings injected into the system
        # prompt. Remove the agent definitions as well as the grants so the SDK cannot synthesize a
        # Task surface from them; the turn is compose-only under dontAsk (no worker tools, no Task,
        # no registry re-crawl).
        options.agents = {}
        options.allowed_tools = []
    runtime_manifest = {
        "delegation_model": "app_owned",
        "required_agents": list(required_agents),
        "violations": [],
    }
    if native_mode:
        record_lifecycle("runtime_manifest", decision="app_owned", reason_code="none")
    trace_metadata.update(
        {
            "sdk_compiled_tool_count": len(compiled.tool_names),
            "sdk_compiled_agent_count": len(compiled.agent_tool_grants),
            "sdk_compiled_connector_count": len(compiled.connector_names),
            "sdk_native_subagent_mode": native_mode,
            "sdk_required_subagents": list(required_agents),
            "sdk_agent_model_routes": compiled.agent_model_routes if native_mode else {},
            "sdk_runtime_manifest": runtime_manifest if native_mode else {},
        }
    )

    answer_parts: list[str] = []
    narration_by_segment: dict[int, str] = {}
    text_normalizer = _NarrationStreamNormalizer()
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_cost_usd: Decimal | None = None
    session_id: str | None = None
    final_result_text: str | None = None

    async for message in query_impl(prompt=prompt, options=options):
        if isinstance(message, StreamEvent):
            if message.parent_tool_use_id:
                # Child text/tool payloads stay inside the native subagent context. Curated handler
                # progress is emitted separately through sub_agent_step events.
                continue
            event = message.event
            if event.get("type") == "content_block_start":
                block = event.get("content_block") or {}
                if block.get("type") == "tool_use":
                    if native_mode and str(block.get("name") or "") == "Task":
                        continue
                    emit_tool_start(
                        str(block.get("name") or "tool"),
                        str(block.get("id") or block.get("name") or "tool"),
                    )
            elif event.get("type") == "content_block_delta":
                delta = event.get("delta") or {}
                if delta.get("type") == "text_delta":
                    text = str(delta.get("text") or "")
                    if text:
                        for channel, visible_text, segment_id in text_normalizer.feed(text):
                            if channel == "answer":
                                answer_parts.append(visible_text)
                            elif segment_id is not None:
                                narration_by_segment[segment_id] = (
                                    narration_by_segment.get(segment_id, "") + visible_text
                                )
                            token_data: dict[str, Any] = {
                                "text": visible_text,
                                "channel": channel,
                                "sdkMode": True,
                            }
                            if segment_id is not None:
                                token_data["segmentId"] = segment_id
                            events.put({"event": "token", "data": token_data})
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
        elif isinstance(message, AssistantMessage) and native_mode and message.parent_tool_use_id:
            usage = message.usage or {}
            child_usage_records.append(
                {
                    "task_id": str(message.parent_tool_use_id),
                    "model": str(message.model or ""),
                    "input_tokens": _usage_input_total(usage),
                    "output_tokens": _usage_int(usage, "output_tokens", "outputTokens"),
                }
            )

    for channel, visible_text, segment_id in text_normalizer.finish():
        if channel == "answer":
            answer_parts.append(visible_text)
        elif segment_id is not None:
            narration_by_segment[segment_id] = narration_by_segment.get(segment_id, "") + visible_text
        token_data = {"text": visible_text, "channel": channel, "sdkMode": True}
        if segment_id is not None:
            token_data["segmentId"] = segment_id
        events.put({"event": "token", "data": token_data})

    missing_after_query = [key for key in required_agents if key not in completed_agents]
    if missing_after_query:
        _record_turn_trace(metadata=trace_metadata, status="failed")
        raise RuntimeError(
            "Claude Agent SDK native-subagent turn ended before required workers completed: "
            + ", ".join(missing_after_query)
        )
    for child_usage in child_usage_records:
        capability_key = task_capabilities.get(child_usage["task_id"])
        result = worker_results.get(capability_key or "")
        if not capability_key or result is None:
            continue
        child_run_id = str(result.run_id)
        if usage_sink is not None:
            try:
                usage_sink(
                    VcsoSdkUsage(
                        input_tokens=child_usage["input_tokens"],
                        output_tokens=child_usage["output_tokens"],
                        total_cost_usd=None,
                        session_id=session_id,
                        model=child_usage["model"],
                        role="sub_agent",
                        capability_key=capability_key,
                        run_id=child_run_id,
                    )
                )
                usage_recorded = True
            except Exception as exc:  # noqa: BLE001 - child attribution must remain fail-open
                logger.warning("SDK child usage sink failed open: %s", exc)
        _record_native_child_trace(
            metadata=trace_metadata,
            capability_key=capability_key,
            run_id=child_run_id,
            model=child_usage["model"],
            input_tokens=child_usage["input_tokens"],
            output_tokens=child_usage["output_tokens"],
        )
    if not turn_trace_emitted:
        _record_turn_trace(metadata=trace_metadata, status="completed")
        turn_trace_emitted = True
    answer_text = "".join(answer_parts).strip()
    if not answer_text and final_result_text:
        fallback_normalizer = _NarrationStreamNormalizer()
        fallback_pieces = [*fallback_normalizer.feed(final_result_text), *fallback_normalizer.finish()]
        answer_text = "".join(
            text for channel, text, _segment in fallback_pieces if channel == "answer"
        ).strip()
        if answer_text:
            events.put(
                {
                    "event": "token",
                    "data": {"text": answer_text, "channel": "answer", "sdkMode": True},
                }
            )
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
        narration_segments=[
            {"segmentId": segment_id, "text": text.strip()}
            for segment_id, text in sorted(narration_by_segment.items())
            if text.strip()
        ],
        worker_runs=[
            {
                "run_id": result.run_id,
                "capability_key": capability_key,
                "status": result.status,
                "result_summary": result.result_summary,
            }
            for capability_key, result in worker_results.items()
        ],
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
    sdk_name = _sdk_tool_name(definition)

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

    read_only_hint = getattr(definition, "persistence_semantics", "read_only") == "read_only"
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


def _marker_prefix_suffix_length(value: str, marker: str) -> int:
    for length in range(min(len(value), len(marker) - 1), 0, -1):
        if value.endswith(marker[:length]):
            return length
    return 0


def _selected_definitions(registry: ToolRegistry, tool_names: list[str]) -> list[ToolDefinition]:
    selected: list[ToolDefinition] = []
    seen: set[str] = set()
    for name in tool_names:
        if name in seen:
            continue
        selected.append(registry.get(name))
        seen.add(name)
    return selected


def _sdk_tool_name(definition: ToolDefinition) -> str:
    if getattr(definition, "source", "native") == "mcp":
        raw_server = str((getattr(definition, "mcp_metadata", {}) or {}).get("server_name") or "connector")
        server_name = re.sub(r"[^a-z0-9_-]+", "-", raw_server.lower()).strip("-") or "connector"
        return f"mcp__{server_name}__{definition.name}"
    return f"{SDK_TOOL_PREFIX}{definition.name}"


def _registry_name(sdk_tool_name: str) -> str:
    if sdk_tool_name.startswith("mcp__"):
        parts = sdk_tool_name.split("__", 2)
        if len(parts) == 3:
            return parts[2]
    return sdk_tool_name


def _humanize_tool_name(name: str) -> str:
    return name.replace("_", " ").replace("-", " ").strip().title() or "ArchitectOS tool"


def _subagent_title(capability_key: str) -> str:
    labels = {
        "structured_data_agent": "Structured data worker",
        "sandbox_execution_agent": "Sandbox compute worker",
        "per_user_wiki": "Strategic context worker",
        "document_analysis_agent": "Document analysis worker",
        "kb_explorer_agent": "Knowledge base worker",
        "per_user_document_wiki": "Document wiki worker",
        "global_ip": "ArchitectOS IP worker",
    }
    return labels.get(capability_key, _humanize_tool_name(capability_key))


def _subagent_plan_label(capability_key: str) -> str:
    labels = {
        "structured_data_agent": "Bind the latest founder financial dataset",
        "sandbox_execution_agent": "Compute concentration and margin trend",
        "per_user_wiki": "Review strategic pricing and constraint context",
    }
    return labels.get(capability_key, _subagent_title(capability_key))


def _parse_task_contract(value: Any) -> dict[str, Any]:
    if not isinstance(value, str) or not value.strip():
        raise ValueError("Task prompt must be one JSON object containing the delegation contract.")
    contract = json.loads(value)
    if not isinstance(contract, dict):
        raise ValueError("Task prompt must decode to a JSON object.")
    required = ("objective", "output_format", "tools_sources", "boundaries", "context_scope")
    missing = [key for key in required if key not in contract]
    if missing:
        raise ValueError("Task contract is missing: " + ", ".join(missing))
    if not isinstance(contract.get("objective"), str) or not contract["objective"].strip():
        raise ValueError("Task contract objective must be a non-empty string.")
    if not isinstance(contract.get("tools_sources"), list) or not contract["tools_sources"]:
        raise ValueError("Task contract tools_sources must be a non-empty list.")
    if not isinstance(contract.get("boundaries"), list) or not contract["boundaries"]:
        raise ValueError("Task contract boundaries must be a non-empty list.")
    if not isinstance(contract.get("context_scope"), dict):
        raise ValueError("Task contract context_scope must be an object.")
    return contract


def _native_synthesis_prompt(required_agents: tuple[str, ...], findings: list[dict[str, Any]]) -> str:
    """Path A: instruct the lead to compose ONLY from the app-run workers' compact findings."""
    payload = json.dumps(findings, ensure_ascii=True, default=str)[:12000]
    return (
        "\n\nPHASE-D APP-OWNED SYNTHESIS. The required specialist workers ("
        + ", ".join(required_agents)
        + ") have already been run by the platform. Their compact, cited findings are the ONLY "
        "authoritative evidence for this turn:\n\nWORKER FINDINGS (JSON)\n"
        + payload
        + "\n\nCompose the founder's answer -- a cited 90-day recommendation on the rising "
        "client-concentration and compressing-margin risk -- using ONLY these findings and the "
        "founder context already in the prompt. Do not call any tools, do not re-derive the numbers, "
        "and cite factual claims using the source markers in the findings. Preserve the Virtual CSO voice."
    )


def _native_lead_prompt(required_agents: tuple[str, ...]) -> str:
    required = ", ".join(required_agents)
    return (
        "\n\nPHASE-D NATIVE SUBAGENT CONTRACT. This exact canary is a genuine multi-part synthesis; "
        f"you must delegate exactly once to each approved worker: {required}. "
        "Use only the SDK Task tool; do not call evidence, wiki, registry, or MCP tools directly. "
        "Delegate before drafting any answer. Run structured_data_agent first. Its compact Task result must then be "
        "included under context_scope.prior_findings in the sandbox_execution_agent Task contract; "
        "never send a raw dataset to the sandbox. The strategic-context worker may run before or after "
        "structured data, but sandbox must wait for structured data to finish. Every Task prompt must be "
        "exactly one JSON object with keys objective, output_format, tools_sources, boundaries, and "
        "context_scope. Boundaries must require founder isolation, citations, compact output, no raw "
        "payloads, no wiki writes, no recursion, and no external writes. Compose only from the compact Task "
        "findings after every required Task completes; do not re-crawl sources. For all non-canary/simple turns, "
        "answer directly and do not use Task."
    )


def _curated_worker_sources(sources: list[dict[str, Any]]) -> list[dict[str, str]]:
    curated: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for source in sources:
        source_kind = str(source.get("source_kind") or source.get("kind") or "context")
        label = str(
            source.get("source_label")
            or source.get("label")
            or source.get("title")
            or source.get("source_title")
            or "Worker evidence"
        )[:160]
        kind = (
            "wiki"
            if "wiki" in source_kind
            else "ip"
            if "ip" in source_kind
            else "platform"
            if source_kind in {"founder_dataset", "dataset_row", "sub_agent_run"}
            else "context"
        )
        key = (kind, label)
        if key in seen:
            continue
        seen.add(key)
        curated.append({"kind": kind, "label": label})
    return curated[:16]


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
            metadata={**metadata, "hook": "Stop", "sdk_phase": metadata.get("sdk_phase", "04B-C")},
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
            metadata={
                **metadata,
                "tool_use_id": tool_use_id,
                "hook": "PostToolUse",
                "sdk_phase": metadata.get("sdk_phase", "04B-C"),
            },
            tags=[VCSO_SDK_CAPABILITY_KEY],
        ) as run:
            run.end(outputs={"status": "completed"})
    except Exception as exc:  # noqa: BLE001 - observability must remain fail-open
        logger.warning("SDK PostToolUse trace failed open: %s", exc)


def _record_native_child_trace(
    *,
    metadata: dict[str, Any],
    capability_key: str,
    run_id: str,
    model: str,
    input_tokens: int | None,
    output_tokens: int | None,
) -> None:
    """Pair one sanitized SDK child-message usage record with a scoped LangSmith run."""

    try:
        from langsmith.run_helpers import trace

        with trace(
            "vcso_sdk_native_subagent_message",
            run_type="llm",
            inputs={"surface": "virtual_cso", "capability_key": capability_key},
            metadata={
                **metadata,
                "run_id": run_id,
                "capability_key": capability_key,
                "model": model,
                "sdk_phase": "04B-D",
            },
            tags=[capability_key],
        ) as run:
            run.set(
                usage_metadata={
                    "input_tokens": input_tokens or 0,
                    "output_tokens": output_tokens or 0,
                }
            )
            run.end(outputs={"status": "completed"})
    except Exception as exc:  # noqa: BLE001 - observability must remain fail-open
        logger.warning("SDK native child trace failed open: %s", exc)


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
