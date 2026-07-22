"""Feature-gated Claude Agent SDK loop for standard Virtual CSO turns."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import queue
import re
import threading
from types import SimpleNamespace
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
from services.vcso_sdk_config import (
    DELEGATION_TOOL_NAMES,
    DELEGATION_TOOL_PROVISION_NAME,
    DELEGATION_TOOL_RUNTIME_NAME,
    MODEL_DRIVEN_WORKER_SERVER,
    compile_founder_sdk_options,
)
from services.vcso_worker_mcp import TURN_REGISTRY, TurnScope
from services.vcso_worker_mcp_server import worker_server_url
from services.sub_agent_orchestrator import SubAgentOrchestrator, SubAgentRunRequest


logger = logging.getLogger(__name__)

# Hook matchers key off the RUNTIME tool name the model emits, never the provision name.
_DELEGATION_OR_MCP_MATCHER = rf"^({re.escape(DELEGATION_TOOL_RUNTIME_NAME)}|mcp__.*)$"

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
# SDK-M3 step C2 — the explicit per-worker delegation contract each Task must carry. Data, not prose, so
# the lead prompt, the contract validator and the docs cannot drift apart. `objective` here is a
# DESCRIPTION of the worker's job that the lead rewrites for the founder's actual question; the other three
# fields are the floor the validator enforces.
WORKER_DELEGATION_CONTRACTS: dict[str, dict[str, str]] = {
    "structured_data_agent": {
        "objective": (
            "quantify the founder's client concentration and margin trend from their own dataset "
            "(top-client revenue share, trend direction, magnitude)"
        ),
        "output_format": "compact cited findings; figures with the period they cover",
        "tools_sources": "the founder's structured dataset only",
        "boundaries": (
            "founder isolation, cite every claim, compact output, no raw payloads, no wiki writes, "
            "no recursion, no external writes"
        ),
    },
    "sandbox_execution_agent": {
        "objective": (
            "compute the forward exposure implied by the structured finding (concentration under "
            "plausible client-loss scenarios over the next 90 days)"
        ),
        "output_format": "compact cited findings; show the computed figures, not the code",
        "tools_sources": (
            "ONLY the compact structured-data finding passed in context_scope.prior_findings -- never a "
            "raw dataset"
        ),
        "boundaries": (
            "founder isolation, cite every claim, compact output, no raw payloads, no wiki writes, "
            "no recursion, no external writes, no network access"
        ),
    },
    "per_user_wiki": {
        "objective": (
            "retrieve this founder's own strategic context bearing on concentration and margin risk "
            "(positioning, client mix history, prior decisions and constraints)"
        ),
        "output_format": "compact cited findings; quote the founder's own framing where it exists",
        "tools_sources": "the founder's per-user wiki only",
        "boundaries": (
            "founder isolation, cite every claim, compact output, no raw payloads, no wiki writes, "
            "no recursion, no external writes"
        ),
    },
}

# SDK-M3 step A3 — cheap give-up thresholds for a lead that will not delegate.
# MAX_STOP_BLOCKS: how many times the stop_hook may block WITHOUT a new worker completing in between.
#   Two is deliberate: one block is a legitimate nudge (the lead forgot and then complies — the shape that
#   makes the safety net worth having); a second block with nothing having moved is a stuck lead.
# MAX_TASK_DENIALS: repeated denied Task attempts are the other stuck shape (Canary 10a denied three times
#   in a row against the once-per-turn guard, then ground out at max_turns).
MODEL_DRIVEN_MAX_STOP_BLOCKS = 2
MODEL_DRIVEN_MAX_TASK_DENIALS = 3
# Shortest string that can plausibly be a per-worker objective rather than a placeholder.
MIN_TASK_OBJECTIVE_CHARS = 24
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


def native_fault_injection_capabilities(
    *,
    settings: dict[str, Any] | None,
    user_id: str | None,
    required_agents: tuple[str, ...],
) -> tuple[str, ...]:
    """Which required workers this turn must FORCE to fail (Tier 3 graceful-failure rehearsal, v0.6.85).

    The v0.6.81 DB-completion safety net — stop_hook + terminal check composing from completed children
    instead of thrashing on a missing one — has never been exercised live, because nothing has failed since
    it was built. Untested recovery code is not recovery code. This gives us a way to make a required worker
    fail on demand on a real turn.

    Gated exactly like the existing `diagnostic_single_worker` probe: an explicit enable bool, the founder
    `diagnostic_user_ids` allowlist, and a named worker that must already be in this turn's required set.
    Any of those missing ⇒ empty ⇒ the mechanism does not exist for that turn. Never returns EVERY required
    worker: a turn with nothing left to compose from is not the failure mode being rehearsed."""

    settings = settings or {}
    if not bool(settings.get("diagnostic_fault_injection_enabled")):
        return ()
    diagnostic_user_ids = {str(value) for value in settings.get("diagnostic_user_ids") or []}
    if not user_id or str(user_id) not in diagnostic_user_ids:
        return ()
    requested = [
        str(value)
        for value in (settings.get("diagnostic_fault_injection_workers") or [])
        if str(value) in required_agents
    ]
    if not requested or len(set(requested)) >= len(set(required_agents)):
        return ()
    return tuple(dict.fromkeys(requested))


FAULT_INJECTION_MODES: tuple[str, ...] = ("before_start", "after_completion")


def native_fault_injection_mode(settings: dict[str, Any] | None) -> str:
    """Which failure shape the fault-injection canary rehearses. Defaults to the conservative
    ``before_start``; an unrecognised value falls back to it rather than failing a turn on a typo.

    ``after_completion`` is the one that exercises the v0.6.81 rescue: the worker completes and writes its
    child row, but its return to the lead is dropped — the canary-6/7 slow-worker shape. ``before_start``
    leaves the worker missing everywhere, which is a genuine block, and drives the v0.6.85 partial answer."""

    mode = str((settings or {}).get("diagnostic_fault_injection_mode") or "").strip()
    return mode if mode in FAULT_INJECTION_MODES else "before_start"


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
    native_model_driven: bool = False,
    native_fault_injection: tuple[str, ...] = (),
    native_fault_injection_mode_key: str = "before_start",
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
                        native_model_driven=native_model_driven,
                        native_fault_injection=native_fault_injection,
                        native_fault_injection_mode_key=native_fault_injection_mode_key,
                    )
                )
            )
        except BaseException as exc:  # noqa: BLE001 - forward worker failures to request thread
            events.put(_WorkerFailure(exc))
        finally:
            events.put(_WORKER_DONE)

    worker = threading.Thread(target=run, name="vcso-sdk-standard", daemon=True)
    worker.start()
    # STREAM KEEPALIVE (SDK-M3 step A2). The per-tool heartbeat in `_make_sdk_tool` only covers IN-PROCESS
    # registry tools. Model-driven workers run OUT of process (the loopback MCP endpoint), so nothing put
    # anything on this queue while the ~113s sandbox worker ran and the SSE stream went silent. Railway's
    # edge treats a silent gap of roughly two minutes as a dead connection — that disconnect is what killed
    # Canary 9, and Canary 8 *passed* with a 3m34s stream, i.e. the successful shape was already inside the
    # danger zone. Draining with a timeout and emitting a keepalive on idle keeps bytes flowing without
    # touching the turn: `heartbeat` is already part of the SSE contract the frontend tolerates.
    # Same floor convention as the per-tool heartbeat in `_make_sdk_tool`; the real cadence is the
    # caller's `heartbeat_seconds` (TOOL_HEARTBEAT_SECONDS = 10s in production).
    keepalive_seconds = max(0.01, heartbeat_seconds)
    idle_seconds = 0.0
    while True:
        try:
            item = events.get(timeout=keepalive_seconds)
        except queue.Empty:
            idle_seconds += keepalive_seconds
            yield {
                "event": "heartbeat",
                "data": {
                    "sdkMode": True,
                    "reason": "stream_keepalive",
                    "idleSeconds": round(idle_seconds, 2),
                },
            }
            continue
        idle_seconds = 0.0
        if item is _WORKER_DONE:
            break
        if isinstance(item, _WorkerFailure):
            raise item.error
        yield item
    worker.join(timeout=1)
    if not result_box:
        raise RuntimeError("Claude Agent SDK turn ended without a result.")
    return result_box[0]


def model_driven_completed_children(
    client: Any, *, parent_run_id: str | None, required_agents: tuple[str, ...]
) -> set[str]:
    """Phase D2 completion bridge (SDK-M2): with model-driven delegation the workers run OUT of process
    (in the external worker MCP endpoint), so the turn coroutine never populates `worker_results` /
    `completed_agents` in memory the way Path A's `run_app_owned_workers` does. The DB is the transport-
    independent source of truth: the orchestrator writes a parent-linked `agent_delegation_runs` row per
    child. This returns the set of required capabilities that have a completed child for this parent run,
    so `post_tool_use`/`stop_hook` can confirm delegation without depending on the in-process handler.

    Read-only, best-effort: any error returns an empty set (the safety-net stop-hook then keeps blocking,
    never fail-opening)."""

    if not parent_run_id or client is None or not required_agents:
        return set()
    try:
        rows = (
            client.table("agent_delegation_runs")
            .select("capability_key,status")
            .eq("parent_run_id", str(parent_run_id))
            .eq("status", "completed")
            .execute()
            .data
            or []
        )
    except Exception as exc:  # noqa: BLE001 - diagnostics/bridge must never break the turn
        logger.warning("model-driven completion lookup failed open (no children counted): %s", exc)
        return set()
    wanted = set(required_agents)
    return {str(row.get("capability_key")) for row in rows if str(row.get("capability_key")) in wanted}


def _make_worker_progress_bridge(
    events: queue.Queue[dict[str, Any] | _WorkerFailure | object],
    task_capabilities: dict[str, str],
    step_indexes: dict[str, int],
) -> Callable[[str, dict[str, Any]], None]:
    """C2 progress bridge (SDK-M2): turn a model-driven worker's internal progress into user-visible
    `sub_agent_step` SSE events, instead of a bare delegation spinner.

    The model-driven worker runs OUT of process (external endpoint), so its `progress_callback` fires from
    the worker request context — a different asyncio task/thread than this turn's SDK thread. `events` is a
    ``queue.Queue`` (thread-safe across threads), so a direct ``put`` is the CORRECT enqueue mechanism from
    any thread; ``loop.call_soon_threadsafe`` is NOT needed (that is only for ``asyncio.Queue``). The
    emitted shape mirrors the model-driven/Path-A ``emit_worker_progress`` verbatim (same event type,
    ``sdkMode`` marker, and parent linkage), so the existing SSE relay and the frontend need no change.
    ``parentToolUseId`` is the delegation ``task_id`` for the completing capability, resolved from the live
    ``task_capabilities`` map (captured by reference, so task_ids added later in the turn are visible)."""

    def bridge_worker_progress(capability_key: str, progress: dict[str, Any]) -> None:
        # Defensive: a progress hiccup must never fail the worker turn (mirrors worker_mcp._bridge).
        try:
            task_id = next(
                (tid for tid, cap in reversed(list(task_capabilities.items())) if cap == capability_key),
                "",
            )
            events.put(
                {
                    "event": "sub_agent_step",
                    "data": {
                        **progress,
                        "parentStepIndex": step_indexes.get(task_id),
                        "parentToolUseId": task_id,
                        "sdkMode": True,
                    },
                }
            )
        except Exception:  # noqa: BLE001 - the surface bridge must never break the worker turn
            logger.debug("model-driven worker progress bridge enqueue failed; ignored", exc_info=True)

    return bridge_worker_progress


def build_model_driven_manifest(
    compiled: Any, *, required_agents: tuple[str, ...], worker_server_name: str
) -> dict[str, Any]:
    """Phase D2 runtime manifest (SDK-M2). Under permission_mode="dontAsk" a subagent's MCP tool is
    silently denied unless it is pre-approved on the PARENT `allowed_tools` (subagents have no allowedTools
    field in claude-agent-sdk 0.2.118). So the lead MUST pre-approve every provisioned worker handler tool;
    the isolation lock lives on the EXPOSURE surface instead — the worker server must NOT be attached
    top-level and no worker handler may appear in the lead's `tools` availability list — with each worker
    agent scoping that external server inline. The prior invariant guarded pre-approval (the wrong surface)
    and was inverted in v0.6.75 (04B-D2-FINDINGS §Defect 6). Any violation must abort before the SDK query
    so a statically-invalid surface never spends a canary."""

    options = compiled.options
    allowed_tools = list(options.allowed_tools or [])
    raw_provisioned = getattr(options, "tools", None)
    provisioned_tools = list(raw_provisioned) if isinstance(raw_provisioned, list) else []
    top_level_servers = dict(options.mcp_servers or {}) if isinstance(options.mcp_servers, dict) else {}
    violations: list[str] = []

    # 0. The delegation built-in must actually EXIST, not merely be permitted. `tools=[]` disables every
    #    built-in, so a lead can be perfectly "allowed" to delegate while having no delegation tool at
    #    all — it then narrates fake tool calls until max_turns. Stage H spent a canary on exactly that
    #    while this manifest reported green, because it only ever checked `allowed_tools`.
    if DELEGATION_TOOL_PROVISION_NAME not in provisioned_tools:
        violations.append("model_driven_delegation_tool_not_provisioned")

    # 0b. …and must not be forbidden by name. DISALLOWED_SDK_BUILTINS blocks BOTH delegation names (right
    #     for Path A and the flat loop); model-driven must exempt both. Exempting only the provision name
    #     leaves the RUNTIME name blocked, so the lead holds a tool it may never call and stalls to
    #     max_turns — the second false-green this manifest missed, and the cause of the second canary.
    raw_disallowed = getattr(options, "disallowed_tools", None)
    disallowed_tools = list(raw_disallowed) if isinstance(raw_disallowed, list) else []
    for blocked in sorted(DELEGATION_TOOL_NAMES & set(map(str, disallowed_tools))):
        violations.append(f"model_driven_delegation_tool_disallowed:{blocked}")

    # 1. Lead pre-approves Task AND every provisioned worker handler tool. Under permission_mode="dontAsk"
    #    a subagent MCP tool absent from the PARENT allowed_tools is silently denied — ListTools returns 200
    #    but zero CallToolRequest ever reaches the worker server. That was the v0.6.74 production defect: the
    #    old invariant here inverted the lock, flagging worker handlers that appeared in allowed_tools and so
    #    forbidding the very pre-approval the SDK requires. Isolation is enforced on the exposure surface
    #    (checks 1b and 2), not on pre-approval (04B-D2-FINDINGS §Defect 6).
    agents = options.agents or {}
    if DELEGATION_TOOL_PROVISION_NAME not in allowed_tools:
        violations.append("model_driven_lead_task_not_preapproved")
    for key in required_agents:
        agent = agents.get(key)
        if agent is None:
            continue  # missing-agent is reported by the scoping check (3) below
        for tool in list(getattr(agent, "tools", None) or []):
            handler = str(tool)
            if handler.startswith(f"mcp__{worker_server_name}__") and handler not in allowed_tools:
                violations.append(f"worker_handler_not_preapproved:{handler}")

    # 1b. Isolation lock, real surface #1: no worker handler may appear in the lead's `tools` AVAILABILITY
    #     list. Pre-approval (above) merely permits the subagent's call; availability would hand the LEAD the
    #     handler to call directly, collapsing the delegation boundary. The lead's availability list carries
    #     only the delegation built-in.
    for name in provisioned_tools:
        if str(name).startswith(f"mcp__{worker_server_name}__"):
            violations.append(f"model_driven_worker_tool_in_lead_availability:{name}")

    # 2. Isolation lock, real surface #2: the external worker server is NOT registered top-level, and no
    #    top-level server exposes run_<agent>. Attaching it top-level would expose every worker handler to
    #    the lead directly.
    if worker_server_name in top_level_servers:
        violations.append("model_driven_worker_server_top_level")
    for server_name, server in top_level_servers.items():
        tools = server.get("tools", []) if isinstance(server, dict) else []
        for tool in tools:
            tool_name = tool.get("name", "") if isinstance(tool, dict) else ""
            if str(tool_name).startswith("run_"):
                violations.append(f"model_driven_worker_tool_top_level:{server_name}.{tool_name}")

    # 3. Each required worker agent scopes ONLY the external server inline (never the in-process server name).
    for key in required_agents:
        agent = agents.get(key)
        servers = list(getattr(agent, "mcpServers", None) or []) if agent is not None else []
        scoped_external = any(
            isinstance(entry, dict) and worker_server_name in entry for entry in servers
        )
        if agent is None:
            violations.append(f"model_driven_required_agent_missing:{key}")
        elif not scoped_external:
            violations.append(f"model_driven_worker_server_not_scoped:{key}")

    # 4. ISOLATION LOCK, real surface #3 — Defect 7. Each worker's inline server URL must carry its OWN
    #    per-capability token. When two workers share a URL they share a token, that token's scope permits
    #    every capability of the turn, and any worker subagent can call a sibling's tool and be authorised
    #    (04B-D2-FINDINGS §11). The URLs are opaque here on purpose: distinctness is the whole invariant, so
    #    checking it needs no token parsing and no secret ever lands in the manifest.
    worker_urls: dict[str, str] = {}
    for key in required_agents:
        agent = agents.get(key)
        for entry in list(getattr(agent, "mcpServers", None) or []) if agent is not None else []:
            config = entry.get(worker_server_name) if isinstance(entry, dict) else None
            url = str(config.get("url") or "") if isinstance(config, dict) else ""
            if url:
                worker_urls[key] = url
    for key, url in worker_urls.items():
        shared_with = sorted(other for other, value in worker_urls.items() if value == url and other != key)
        if shared_with:
            violations.append(f"model_driven_worker_token_shared:{key}+{'+'.join(shared_with)}")

    return {
        "delegation_model": "model_driven",
        "required_agents": list(required_agents),
        "lead_allowed_tools": allowed_tools,
        "lead_provisioned_tools": provisioned_tools,
        "lead_disallowed_tools": disallowed_tools,
        "top_level_servers": sorted(top_level_servers.keys()),
        "violations": violations,
    }


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
    native_model_driven: bool = False,
    native_fault_injection: tuple[str, ...] = (),
    native_fault_injection_mode_key: str = "before_start",
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
    # Phase D2 (SDK-M2): model-driven delegation restores reasoning-driven worker selection — the lead
    # reasons + delegates via Task with workers scoped to an external per-agent MCP server (invisible to
    # the lead). Gated: model_driven is only ever True behind the dark `native_model_driven_enabled`
    # sub-flag. When False, every branch below is byte-identical to Path A.
    model_driven = bool(native_model_driven) and native_mode
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
    # CHEAP GIVE-UP (SDK-M3 step A3). When the lead will not delegate, the stop_hook blocks, the lead tries
    # again, the block repeats — and the turn grinds to `max_turns` costing ~$0.10–0.22 with NO answer for
    # the founder (Canary 9: five minutes of thrash; Canary 10a: three straight denials then max_turns).
    # Blocking is right for a lead that is making progress and wrong for one that is stuck, and the two are
    # distinguishable: count how many times we have blocked without a single NEW worker completing since the
    # last block. Past the cap we stop blocking and let the turn terminate, which hands it to the v0.6.85
    # partial-answer surface instead of burning the cap. This only ever *shortens* a turn that was already
    # failing — it can never suppress a delegation that was going to happen.
    stop_block_count = 0
    stop_block_completed_watermark = 0
    task_denial_count = 0
    gave_up_early = False

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
            # `stage` carries the whole meaning of a worker_hop entry (received / completed / deduped /
            # fault_injected). Omitting it made canary 9-retry's dedupe readable only as an ABSENCE — a
            # worker_hop with a child_run_id and no child_status — and would have made canary 10's
            # fault_injected marker indistinguishable from a normal arrival. Bounded enum-ish string;
            # no prompt, tool input, or model output passes through here.
            "stage",
        ):
            value = details.get(key)
            if value not in (None, ""):
                safe[key] = str(value)[:200]
        if "agent_id_present" in details:
            safe["agent_id_present"] = bool(details["agent_id_present"])
        if "same_objective" in details:
            safe["same_objective"] = bool(details["same_objective"])
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
        nonlocal delegation_count, task_denial_count
        tool_input = input_data.get("tool_input") if isinstance(input_data.get("tool_input"), dict) else {}
        capability_key = str(tool_input.get("subagent_type") or "").strip()
        task_id = str(tool_use_id or "")
        try:
            contract = _parse_task_contract(
                tool_input.get("prompt"),
                # Per-worker contracts (step C2): the objectives already approved this turn, so a reused
                # objective is refused rather than dispatched as a second, indistinguishable job.
                prior_objectives={
                    key: str(existing.get("objective") or "")
                    for key, existing in task_contracts.items()
                },
            )
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
            # Counted for the cheap give-up (step A3): a lead whose every Task is refused never completes a
            # worker, so the stop_hook would otherwise block it all the way to max_turns.
            task_denial_count += 1
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
        if sdk_tool_name == DELEGATION_TOOL_RUNTIME_NAME:
            task_id = str(tool_use_id or "")
            capability_key = task_capabilities.get(task_id, "bounded_worker")
            step_index = allocate_step(task_id, sdk_tool_name)
            result = worker_results.get(capability_key)
            if result is None and model_driven and capability_key in required_agents:
                # Completion bridge: the model-driven worker ran OUT of process (external endpoint), so the
                # in-process worker_results is empty. The orchestrator has already written a parent-linked
                # completed child row (ordering: worker completes before the Task result returns), so confirm
                # delegation from the DB and synthesize the minimal completed marker post_tool_use expects.
                done = model_driven_completed_children(
                    getattr(tool_context.store, "client", None),
                    parent_run_id=tool_context.metadata.get("parent_run_id"),
                    required_agents=required_agents,
                )
                if capability_key in done:
                    result = SimpleNamespace(
                        run_id=None,
                        status="completed",
                        result_summary=f"{_subagent_title(capability_key)} returned a compact finding.",
                        citations=[],
                    )
                    worker_results[capability_key] = result
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
        nonlocal turn_trace_emitted, stop_block_count, stop_block_completed_watermark, gave_up_early
        missing = [key for key in required_agents if key not in completed_agents]
        if missing and model_driven:
            # Model-driven workers run OUT of process, so a worker whose Task tool-call was abandoned early
            # (e.g. a slow worker timing out in-band) is absent from the in-memory `completed_agents` even
            # though it wrote a completed child row. Consult the authoritative DB completion bridge so
            # genuinely-finished work is never discarded and no completed worker is named for re-delegation.
            # A worker missing from BOTH memory AND the DB stays missing — a real block, preserved.
            db_completed = model_driven_completed_children(
                getattr(tool_context.store, "client", None),
                parent_run_id=tool_context.metadata.get("parent_run_id"),
                required_agents=required_agents,
            )
            missing = [key for key in missing if key not in db_completed]
            # TODO (M4, optional): for a DB-completed worker whose finding never reached the lead in-band
            # (the timed-out case), inject its compact child finding into the compose so the answer isn't
            # missing that worker's content. Deferred: it needs mid-stream injection into the SDK lead —
            # significant machinery. For now the turn composes from what the lead already holds.
        if missing:
            # Cheap give-up (SDK-M3 step A3). "Progress" means at least one required worker completed since
            # the previous block; a lead that is complying just needs the nudge, and each nudge that lands
            # resets the budget. A lead that has been told twice and moved nothing is not going to move, and
            # every further block is pure spend. Stop blocking, record WHY, and let the turn terminate into
            # the partial-answer surface. `task_denial_count` catches the other stuck shape: the lead does
            # keep calling Task, but every call is refused, so no worker ever completes.
            progressed = len(completed_agents) > stop_block_completed_watermark
            if progressed:
                stop_block_count = 0
            stop_block_completed_watermark = len(completed_agents)
            stop_block_count += 1
            if (
                stop_block_count > MODEL_DRIVEN_MAX_STOP_BLOCKS
                or task_denial_count >= MODEL_DRIVEN_MAX_TASK_DENIALS
            ):
                if not gave_up_early:
                    # Record once. The SDK may call Stop again on the way out; a second identical row would
                    # read as two separate give-ups in the lifecycle.
                    record_lifecycle(
                        "delegation_give_up",
                        decision="stop",
                        reason_code=(
                            f"blocks={stop_block_count},denials={task_denial_count},"
                            f"delegations={delegation_count},missing={'|'.join(missing)}"
                        )[:120],
                    )
                gave_up_early = True
                logger.warning(
                    "vcso_sdk model-driven give-up: lead did not delegate (blocks=%s denials=%s missing=%s)",
                    stop_block_count,
                    task_denial_count,
                    missing,
                )
                # Return {} (allow the stop). The turn still ends as a FAILURE — `missing_after_query`
                # raises just as it would have at max_turns — so nothing is fail-opened; it simply fails
                # sooner and cheaper, and the founder reaches the partial-answer surface faster.
                return {}
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
        nonlocal required_agents
        # Improvement #1 (ordering): run the mandatory compute chain first (structured -> sandbox),
        # then the best-effort strategic-context worker, so a wiki failure cannot pre-empt sandbox.
        ordered = [k for k in ("structured_data_agent", "sandbox_execution_agent", "per_user_wiki") if k in required_agents]
        ordered += [k for k in required_agents if k not in ordered]
        # Improvement #2 (failure granularity): the two compute workers are mandatory; per_user_wiki is
        # best-effort. A mandatory failure fails the turn open to flat; a best-effort failure is logged
        # and the turn continues to synthesis with the completed mandatory findings.
        mandatory_workers = {"structured_data_agent", "sandbox_execution_agent"}
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
            except Exception as exc:  # noqa: BLE001 - mandatory fails open; best-effort continues
                logger.warning("app-owned worker %s failed: %s", capability_key, exc)
                is_mandatory = capability_key in mandatory_workers
                record_lifecycle(
                    "native_handler_failure",
                    capability_key=capability_key,
                    delegated=True,
                    app_owned=True,
                    tool_use_id=task_id,
                    reason_code=type(exc).__name__,
                    mandatory=is_mandatory,
                )
                if is_mandatory:
                    # A missing compute worker leaves nothing to compose from -> fail open to flat.
                    raise RuntimeError(f"App-owned worker {capability_key} failed: {exc}") from exc
                # Best-effort worker (per_user_wiki): drop it from the required set so the downstream
                # invariant passes and the turn composes from the completed mandatory findings, then
                # continue to the next worker instead of terminalizing the turn.
                logger.warning("app-owned best-effort worker %s unavailable; continuing", capability_key)
                required_agents = tuple(k for k in required_agents if k != capability_key)
                plan_statuses.pop(capability_key, None)
                events.put(
                    {
                        "event": "sub_agent_step",
                        "data": {
                            "parentToolUseId": task_id,
                            "capabilityKey": capability_key,
                            "status": "failed",
                            "title": _subagent_title(capability_key),
                            "summary": f"{_subagent_title(capability_key)} was unavailable; continued without it.",
                            "sdkMode": True,
                        },
                    }
                )
                emit_plan_update()
                continue
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
    # DEFECT 7 (SDK-M3 step B). One token per (turn, CAPABILITY), not one per turn. Previously every
    # worker's inline MCP server pointed at the SAME `?t=<turn-token>` URL and that one scope permitted all
    # three capabilities, so `run_worker_capability`'s scope check was answering "is this capability allowed
    # THIS TURN?" when the question it had to answer was "is it allowed for THE SUBAGENT MAKING THE CALL?".
    # Any worker subagent could invoke a sibling's tool and be authorised (it broke Canary 10a and silently
    # distorted Canary 9-retry — `04B-D2-FINDINGS.md` §11). Handing each worker a token scoped to its own
    # capability makes the EXISTING refusal reject the cross-worker call: no new authorization logic, no new
    # surface, nothing for a future change to forget to call.
    model_driven_tokens: dict[str, str] = {}
    model_driven_scope: TurnScope | None = None
    model_driven_worker_urls: dict[str, str] = {}
    if native_mode and not model_driven:
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
    # Path A registers no worker MCP tools and no Task (compose-only). Model-driven registers Task on the
    # lead + exposes each worker via an EXTERNAL per-agent MCP server (invisible to the lead), so the lead
    # must reason the decomposition and delegate via Task.
    native_subagent_tools: dict[str, Any] = (
        {key: {"name": f"run_{key}"} for key in required_agents} if model_driven else {}
    )
    hooks: dict[str, Any] = {
        "PostToolUse": [HookMatcher(matcher=r"^mcp__.*$", hooks=[post_tool_use])],
        "PostToolUseFailure": [
            HookMatcher(matcher=_DELEGATION_OR_MCP_MATCHER, hooks=[post_tool_failure])
        ],
        "Stop": [HookMatcher(hooks=[stop_hook])],
        "PreCompact": [HookMatcher(hooks=[pre_compact_hook])],
    }
    if model_driven:
        # The completion bridge + subagent-step trace live in post_tool_use's delegation branch, so the
        # PostToolUse matcher must also match the delegation tool (the `^mcp__.*$` default never would).
        hooks["PostToolUse"] = [
            HookMatcher(matcher=_DELEGATION_OR_MCP_MATCHER, hooks=[post_tool_use])
        ]

        async def pre_tool_probe(input_data: dict[str, Any], tool_use_id: str | None, _context: Any) -> dict[str, Any]:
            # Observe-only: records whether a worker tool call fired from inside a Task-spawned subagent
            # (agent_id present) vs a lead direct-call. Returns {} so permission stays with the surface.
            record_lifecycle(
                "pre_tool_probe",
                tool_name=input_data.get("tool_name"),
                tool_use_id=tool_use_id,
                agent_id_present=bool(input_data.get("agent_id")),
            )
            return {}

        base_url = os.environ.get("VCSO_WORKER_MCP_BASE_URL") or f"http://127.0.0.1:{os.environ.get('PORT', '8000')}"
        model_driven_scope = (
            TurnScope(
                user_id=tool_context.user_id,
                parent_surface=str(tool_context.metadata.get("surface") or "virtual_cso"),
                thread_id=tool_context.thread_id,
                parent_message_id=tool_context.metadata.get("parent_message_id"),
                parent_run_id=tool_context.metadata.get("parent_run_id"),
                allowed_capabilities=frozenset(required_agents),
                store=tool_context.store,
                # App-owned findings channel: start empty; run_worker_capability writes each completing
                # worker's compact finding under the NEXT worker's key during the turn, and the next
                # worker's loopback call reads it back off THIS same scope instance (recovered from
                # TURN_REGISTRY). Explicit here so the intent — the loop bridge populates it — is visible.
                prior_findings={},
                context_scopes={
                    key: dict(native_subagent_scopes.get(key) or {}) for key in required_agents
                },
                progress_bridge=_make_worker_progress_bridge(events, task_capabilities, step_indexes),
                # Dark, founder-only, and empty on every normal turn (see
                # native_fault_injection_capabilities). Present so the graceful-failure path can be
                # rehearsed on a real canary instead of shipping untested recovery code.
                fault_injection_capabilities=frozenset(native_fault_injection),
                fault_injection_mode=native_fault_injection_mode_key,
            )
        )
        if native_fault_injection:
            record_lifecycle(
                "fault_injection_armed",
                reason_code=f"{native_fault_injection_mode_key}:{','.join(native_fault_injection)}"[:120],
            )
        # One token per capability. The derived scopes SHARE this scope's mutable state by reference
        # (prior_findings, completed_results, dispatch_locks, diagnostics), so app-owned findings chaining
        # across the worker hop, the v0.6.84 dispatch dedupe, and the single diagnostics drain all keep
        # working exactly as they did on one token — only `allowed_capabilities` narrows.
        for key in required_agents:
            token = TURN_REGISTRY.mint_capability_scoped(model_driven_scope, key)
            model_driven_tokens[key] = token
            model_driven_worker_urls[key] = worker_server_url(base_url, token)
        record_lifecycle(
            "worker_token_scoping",
            decision="per_capability",
            reason_code=f"tokens={len(model_driven_tokens)}",
        )
        hooks["PreToolUse"] = [
            HookMatcher(matcher=DELEGATION_TOOL_RUNTIME_NAME, hooks=[pre_task_use]),
            HookMatcher(matcher=r"^mcp__.*$", hooks=[pre_tool_probe]),
        ]
    native_prompt = (
        _native_lead_prompt(required_agents)
        if model_driven
        else (_native_synthesis_prompt(required_agents, native_findings) if native_mode else "")
    )
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
        enable_native_subagents=model_driven,
        native_subagent_tools=native_subagent_tools,
        model_driven_worker_server_urls=model_driven_worker_urls,
    )
    options = compiled.options
    if native_mode and not model_driven:
        # Path A: the lead composes only from the app-run worker findings injected into the system
        # prompt. Remove the agent definitions as well as the grants so the SDK cannot synthesize a
        # Task surface from them; the turn is compose-only under dontAsk (no worker tools, no Task,
        # no registry re-crawl). Model-driven KEEPS the agents (external workers) and Task.
        options.agents = {}
        options.allowed_tools = []
    if model_driven:
        # Inverted safety manifest: abort before spending a canary if any run_<agent> tool leaked into the
        # lead's schema or the external worker server was registered top-level (04B-D2-FINDINGS §8).
        runtime_manifest = build_model_driven_manifest(
            compiled, required_agents=required_agents, worker_server_name=MODEL_DRIVEN_WORKER_SERVER
        )
        if runtime_manifest["violations"]:
            for token in model_driven_tokens.values():
                TURN_REGISTRY.unregister(token)
            model_driven_tokens.clear()
            record_lifecycle("runtime_manifest", decision="model_driven", reason_code="invalid_surface")
            raise RuntimeError(
                "Model-driven lead surface invalid; refusing to spend a turn: "
                + ", ".join(runtime_manifest["violations"])
            )
        record_lifecycle("runtime_manifest", decision="model_driven", reason_code="none")
    else:
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
    diagnostics_drained = False

    def _drain_model_driven_diagnostics() -> None:
        """Record the out-of-process worker endpoint's diagnostics, then release every per-turn token.

        Idempotent (the `finally` below is the only caller today, but a second call must not double-record)
        and defensive: this runs on the failure path, so it must never raise over the top of the real error
        that got us here. The derived per-capability scopes all share ONE `diagnostics` list by reference,
        so reading the base scope drains every worker's entries."""

        nonlocal diagnostics_drained
        if diagnostics_drained:
            return
        diagnostics_drained = True
        try:
            for entry in list(getattr(model_driven_scope, "diagnostics", []) or []):
                record_lifecycle("worker_hop", **entry)
        except Exception:  # noqa: BLE001 - diagnostics must never mask the turn's real outcome
            logger.debug("model-driven worker_hop drain failed; ignored", exc_info=True)
        for token in model_driven_tokens.values():
            TURN_REGISTRY.unregister(token)
        model_driven_tokens.clear()

    try:
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
                        if native_mode and str(block.get("name") or "") == DELEGATION_TOOL_RUNTIME_NAME:
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
    finally:
        # DIAGNOSTICS SURVIVE FAILURE (SDK-M3 step A4). The worker_hop drain used to run only after a
        # clean query; a turn that raised — max_turns, a required-worker block, a client disconnect —
        # skipped it and lost the worker-level evidence on precisely the turns that most needed
        # explaining (Canary 10a carries zero worker_hop entries for exactly this reason). In `finally`
        # it runs on every path. Draining BEFORE unregistering keeps the distinction the drain exists
        # for: no worker_hop entries at all ⇒ the loopback request never landed; a `received` with no
        # `completed` ⇒ it landed and execution failed.
        _drain_model_driven_diagnostics()

    missing_after_query = [key for key in required_agents if key not in completed_agents]
    if missing_after_query and model_driven:
        # Same DB completion bridge the stop_hook and post_tool_use use: a model-driven worker that
        # completed server-side but never returned its Task result in-band is DB-completed and must not
        # fail the turn. A worker missing from BOTH memory AND the DB still raises (real failure preserved).
        db_completed = model_driven_completed_children(
            getattr(tool_context.store, "client", None),
            parent_run_id=tool_context.metadata.get("parent_run_id"),
            required_agents=required_agents,
        )
        missing_after_query = [key for key in missing_after_query if key not in db_completed]
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


def _normalized_objective(objective: str) -> str:
    return " ".join(str(objective).lower().split())


def _parse_task_contract(value: Any, *, prior_objectives: dict[str, str] | None = None) -> dict[str, Any]:
    """Validate one delegation contract. `prior_objectives` is capability_key -> objective for the Tasks
    already approved this turn, so a lead that sends the SAME objective to two workers is caught.

    SDK-M3 step C2 keeps this deliberately light. Every rejection here now feeds the cheap give-up
    (step A3), so an over-strict validator would turn a recoverable turn into an early failure. It checks
    only the two things that mean the contract was not actually authored PER WORKER: an objective too short
    to be one, and an objective reused from a sibling."""

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
    objective = _normalized_objective(contract["objective"])
    if len(objective) < MIN_TASK_OBJECTIVE_CHARS:
        raise ValueError(
            "Task contract objective must state this worker's specific job "
            f"(at least {MIN_TASK_OBJECTIVE_CHARS} characters)."
        )
    for other_key, other_objective in (prior_objectives or {}).items():
        if _normalized_objective(other_objective) == objective:
            raise ValueError(
                f"Task contract objective duplicates the one already sent to {other_key}; "
                "each worker needs its own objective."
            )
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


def _per_worker_contract_brief(required_agents: tuple[str, ...]) -> str:
    """SDK-M3 step C2 — render ONE explicit delegation contract per worker.

    Until M3 the lead got a single generic schema and had to invent each worker's job from the schema plus
    the worker's name. That is the reasoning discipline the dropped-child failure lacked: a lead that is
    vague about what a worker is FOR is a lead that can talk itself out of spawning it. Naming each
    worker's objective, output format, sources and boundaries up front converts "decide what to delegate"
    into "fill in four fields you have already been handed" — a much smaller ask on a 99k-token context.

    Kept as data, not prose, so the three contracts cannot drift apart in the prompt string."""

    specs = [WORKER_DELEGATION_CONTRACTS[key] for key in required_agents if key in WORKER_DELEGATION_CONTRACTS]
    if not specs:
        return ""
    blocks = []
    for key, spec in zip(
        [key for key in required_agents if key in WORKER_DELEGATION_CONTRACTS], specs, strict=False
    ):
        blocks.append(
            f"\n\n  {key}\n"
            f"    objective     -- {spec['objective']}\n"
            f"    output_format -- {spec['output_format']}\n"
            f"    tools_sources -- {spec['tools_sources']}\n"
            f"    boundaries    -- {spec['boundaries']}"
        )
    return (
        "\n\nPER-WORKER DELEGATION CONTRACTS. Each Task you send carries its OWN contract. Write the "
        "objective in your own words for THIS founder's question -- do not paste these lines verbatim and "
        "do not reuse one worker's objective for another; each worker's objective must describe that "
        "worker's distinct job. The output_format, tools_sources and boundaries below are the floor:"
        + "".join(blocks)
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
        "findings after every required Task completes; do not re-crawl sources."
        # EFFORT-SCALING, BOTH DIRECTIONS (SDK-M3 step C1). Scaling up is the failure everyone watches for;
        # scaling DOWN is the one that quietly makes the system expensive and slow. Both are stated as one
        # rule so neither reads as an afterthought, and the "already know the answer" clause is explicit
        # because that is the exact rationalisation behind the Canary 9 non-delegation: a lead sitting on
        # 99k tokens of assembled context can always persuade itself it has enough.
        "\n\nEFFORT-SCALING. Match effort to the question, in BOTH directions. This turn is a genuine "
        "multi-part strategic synthesis and must be decomposed. A simple lookup, a factual recall, a "
        "clarification, or an acknowledgement must be answered DIRECTLY in one pass -- no Task, no worker, "
        "no plan. Never over-decompose a simple turn. On this turn, do not skip a required worker because "
        "the assembled context appears to already contain the answer: the workers exist to derive the "
        "numbers and their evidence, and composing from context you were handed instead of from worker "
        "findings is the failure mode this contract exists to prevent."
        + _per_worker_contract_brief(required_agents)
        + "\n\nTASK CONTRACT SCHEMA. Each Task prompt must be EXACTLY one JSON object -- no prose, no markdown "
        "fence, no text before or after the braces. Required keys: objective (non-empty string), "
        "output_format (present), tools_sources (NON-EMPTY list), boundaries (NON-EMPTY list), context_scope "
        "(object). For sandbox_execution_agent, context_scope.prior_findings must be non-empty (the compact "
        "structured-data finding). Each approved worker may run only once per turn. Worked example "
        "(structured-data delegation): "
        '{"objective":"Quantify client-concentration and margin trend from the founder dataset",'
        '"output_format":"compact cited findings","tools_sources":["founder_dataset"],'
        '"boundaries":["founder isolation","cite every claim","compact output","no raw payloads",'
        '"no wiki writes","no recursion","no external writes"],"context_scope":{"quarter":"current"}}'
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
