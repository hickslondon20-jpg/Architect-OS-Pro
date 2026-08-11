"""Feature-gated Claude Agent SDK loop for standard Virtual CSO turns."""

from __future__ import annotations

import asyncio
import importlib.metadata
import json
import logging
from pathlib import Path
import platform
import queue
import re
import subprocess
import threading
import time
from types import SimpleNamespace
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from functools import lru_cache
from typing import Any, AsyncIterator, Callable, Iterator
from uuid import UUID

import claude_agent_sdk
from claude_agent_sdk import (
    AssistantMessage,
    HookMatcher,
    ResultMessage,
    ToolAnnotations,
    query,
    tool,
)
from claude_agent_sdk.types import StreamEvent, ToolResultBlock, ToolUseBlock, UserMessage

from services.agent_capabilities import AgentCapabilityRegistry
from services.tool_registry import (
    ToolDefinition,
    ToolExecutionContext,
    ToolRegistry,
    ToolRegistryError,
)
from services.vcso_sdk_config import (
    DELEGATION_TOOL_NAMES,
    DELEGATION_TOOL_PROVISION_NAME,
    DELEGATION_TOOL_RUNTIME_NAME,
    MODE_B_LEAD_TOOL_NAMES,
    NATIVE_GRANULAR_AGENT_TOOL_GRANTS,
    compile_founder_sdk_options,
)


logger = logging.getLogger(__name__)

# Hook matchers key off the RUNTIME tool name the model emits, never the provision name.
_DELEGATION_OR_MCP_MATCHER = rf"^({re.escape(DELEGATION_TOOL_RUNTIME_NAME)}|mcp__.*)$"
_SDK_ERROR_TYPE_RE = re.compile(r'"error_type"\s*:\s*"([^"]+)"')
_SDK_ERROR_MESSAGE_RE = re.compile(r'"error_message"\s*:\s*"([^"]*)"')

VCSO_SDK_LOOP_FLAG = "vcso_sdk_loop"
VCSO_SDK_CAPABILITY_KEY = "vcso_sdk_loop"
SDK_STANDARD_SCHEMA_VERSION = "vcso_sdk_standard_v1"
SDK_NATIVE_SUBAGENT_SCHEMA_VERSION = "vcso_sdk_native_subagents_v1"
EXPECTED_CLAUDE_CODE_CLI_VERSION = "2.1.209 (Claude Code)"
SDK_TOOL_SERVER_NAME = "architectos"
SDK_TOOL_PREFIX = f"mcp__{SDK_TOOL_SERVER_NAME}__"
SDK_STREAM_DIAGNOSTIC_EVENT_LIMIT = 320
SDK_STREAM_DIAGNOSTIC_NONCRITICAL_LIMIT = 240
SDK_STREAM_DIAGNOSTIC_TEXT_LIMIT = 200
SDK_STREAM_DIAGNOSTIC_EVENT_TYPES = frozenset(
    {
        "message_start",
        "message_stop",
        "message_delta",
        "content_block_start",
    }
)
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
NATIVE_SURFACE_REQUIRED_AGENTS = (
    "structured_data_agent",
    "per_user_wiki",
)
G_GATE_MODEL_CHOICE_SCOPE = "g_gate_model_choice"
G_GATE_CANDIDATE_AGENTS = P4_THIN_SLICE_REQUIRED_AGENTS
P4_THIN_SLICE_SIGNALS = re.compile(
    r"(?=.*\b(?:financial|p&l|margin|revenue)\b)(?=.*\bconcentration\b)(?=.*\b90\s+days?\b)",
    re.IGNORECASE | re.DOTALL,
)
COMPUTE_INTEGRITY_REFUSAL = (
    "I cannot compute from current data because the required source series is missing or the "
    "calculation could not be completed with cited evidence. I can still identify the data needed "
    "for a sound calculation."
)
NATIVE_PARTIAL_RESULT_MARKER = "PARTIAL_RESULT: true"
COMPUTE_REQUEST_SIGNALS = re.compile(
    r"\b(?:calculate|compute|derive|forecast|model|project|scenario|simulate)\b"
    r"|\bhow\s+much\s+(?:would|will|does|do)\b"
    r"|\b(?:what|how)\s+(?:would|will|does)\b.{0,160}"
    r"\b(?:margin|runway|revenue|profit|cash|cost|ratio|rate|percentage|months?)\b"
    r"|\bif\b.{0,160}\b(?:churn|leave|lost|lose|increase|decrease|cut|drop|rise|fall)\b"
    r".{0,160}\b(?:margin|runway|revenue|profit|cash|cost|ratio|rate|percentage|months?)\b",
    re.IGNORECASE | re.DOTALL,
)
ANSWER_CITATION_MARKER = re.compile(r"\[(?:\d+|[A-Za-z][A-Za-z0-9_.:-]*)\]")
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
G_GATE_WORKER_DELEGATION_CONTRACTS: dict[str, dict[str, str]] = {
    "structured_data_agent": {
        "objective": (
            "retrieve and quantify the founder's relevant structured business records for the question"
        ),
        "output_format": "compact cited findings; figures with the period and scope they cover",
        "tools_sources": "the founder's structured datasets only",
        "boundaries": (
            "founder isolation, cite every claim, compact output, no raw payloads, no wiki writes, "
            "no recursion, no external writes"
        ),
    },
    "sandbox_execution_agent": {
        "objective": (
            "perform the specific derivation or scenario computation required by the question from a "
            "compact structured-data finding"
        ),
        "output_format": "compact cited findings; show the computed figures and derivation, not code",
        "tools_sources": (
            "only the compact structured-data finding passed in context_scope.prior_findings; never a "
            "raw dataset"
        ),
        "boundaries": (
            "founder isolation, cite every claim, compact output, no raw payloads, no wiki writes, "
            "no recursion, no external writes, no network access"
        ),
    },
    "per_user_wiki": {
        "objective": (
            "retrieve the founder's compiled strategic, diagnostic, decision, or constraint context "
            "relevant to the question"
        ),
        "output_format": "compact cited findings; preserve the founder's own framing where it exists",
        "tools_sources": "the founder's per-user compiled wiki only",
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
    deferred_tool_use_id: str | None = None
    deferred_question: str | None = None
    deferred_classification: dict[str, Any] = field(default_factory=dict)

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
    output_summary: dict[str, Any] = field(default_factory=dict)
    content_text: str = ""


@dataclass(frozen=True)
class _RetrievalBinding:
    tool_use_id: str
    tool_name: str
    source_tokens: set[str]
    numeric_tokens: set[str]


def semantic_worker_status(
    transport_status: Any,
    structured_result: dict[str, Any] | None,
) -> str:
    """Resolve a worker's founder-visible outcome without conflating transport and semantic success."""

    outer_status = str(transport_status or "").strip().lower()
    if outer_status != "completed":
        return outer_status or "failed"

    structured = structured_result if isinstance(structured_result, dict) else {}
    semantic_status = str(structured.get("status") or "").strip().lower()
    if structured.get("needs_review") is True:
        return semantic_status if semantic_status and semantic_status != "completed" else "needs_review"
    if semantic_status and semantic_status not in {"completed", "success", "succeeded", "ok"}:
        return semantic_status
    return "completed"


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
    """Return the founder-scoped native worker surface.

    The original P4 path remains pinned to its exact app gate. The Step 1.5 native surface is admitted
    only by its dark sub-flag plus founder allowlist, without keyword or intent eligibility. The Phase-G
    generalization surface is separately dark-gated and returns only the bounded candidate pool; the
    loop decides whether those candidates are mandatory or model-selected from the explicit selection
    mode passed by the caller.
    """

    intent = intent or {}
    settings = settings or {}
    diagnostic_user_ids = {str(value) for value in settings.get("diagnostic_user_ids") or []}
    if str(settings.get("native_subagent_scope") or "") == G_GATE_MODEL_CHOICE_SCOPE:
        if (
            bool(settings.get("native_model_driven_enabled"))
            and bool(user_id)
            and str(user_id) in diagnostic_user_ids
        ):
            return G_GATE_CANDIDATE_AGENTS
        return ()
    if (
        bool(settings.get("native_model_driven_enabled"))
        and bool(user_id)
        and str(user_id) in diagnostic_user_ids
    ):
        return NATIVE_SURFACE_REQUIRED_AGENTS
    if str(intent.get("move_type") or intent.get("intent") or "") != "strategic_synthesis":
        return ()
    if str(intent.get("depth") or "") != "deep":
        return ()
    if not P4_THIN_SLICE_SIGNALS.search(message):
        return ()
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


def stream_disconnect_injection_after(
    settings: dict[str, Any] | None, user_id: str | None
) -> int | None:
    """How many SSE events to DELIVER before this turn's stream goes dark (Gate 2 rehearsal, dark only).

    Gate 2 is open because run 4's stream died mid-turn and the founder saw an error for a turn that had
    actually succeeded. Chasing that intermittent disconnect is open-ended and burns canaries; *injecting*
    it is deterministic and cheap — the same trade the fault-injection modes already make for the
    graceful-compose path. The route stops writing to the client at this event index but keeps draining
    the turn, so the backend still finishes and still persists. That is precisely run 4's shape, on demand.

    Gated exactly like `native_fault_injection_capabilities`: an explicit enable bool AND the founder
    `diagnostic_user_ids` allowlist. Either missing ⇒ None ⇒ the mechanism does not exist for that turn.

    **Never returns 0.** The client needs the `ready` event to learn the thread id and the user message,
    and the Defect-8 recovery needs both to find this turn's persisted answer without risking an older
    one. Cutting before `ready` would test nothing except that recovery is impossible without inputs."""

    settings = settings or {}
    if not bool(settings.get("diagnostic_stream_disconnect_enabled")):
        return None
    diagnostic_user_ids = {str(value) for value in settings.get("diagnostic_user_ids") or []}
    if not user_id or str(user_id) not in diagnostic_user_ids:
        return None
    try:
        after = int(settings.get("diagnostic_stream_disconnect_after_events") or 0)
    except (TypeError, ValueError):
        return None
    return after if after >= 1 else None


def stream_drop_done_injection(settings: dict[str, Any] | None, user_id: str | None) -> bool:
    """Whether to DROP the final `done`/`token` events while keeping the connection alive (dark only).

    Carry #1 of the Gate-2 close: the Defect-8 **in-flight recovery has never been watched firing** — the
    first injection canary's founder recovered by a manual page reload, which is ordinary thread loading and
    bypasses the recovery code entirely. This mode reproduces Defect 8's *exact* condition deterministically
    and lets the recovery run in-flight: the route delivers every event EXCEPT the answer `token`s and the
    terminal `done` (and keeps the `heartbeat` keepalives flowing so the connection is **not** killed). The
    client therefore reaches a clean end-of-stream with the answer already persisted server-side but with no
    `done` — so the recovery block fetches the record and delivers the cited answer **without a reload**.
    Contrast with `stream_disconnect_injection_after`, which cuts EARLY (before persistence) and exercises
    the reopen path; this one cuts at the END (after persistence) and exercises the in-flight path.

    Gated identically: an explicit enable bool AND the founder `diagnostic_user_ids` allowlist."""

    settings = settings or {}
    if not bool(settings.get("diagnostic_stream_drop_done_enabled")):
        return False
    diagnostic_user_ids = {str(value) for value in settings.get("diagnostic_user_ids") or []}
    return bool(user_id) and str(user_id) in diagnostic_user_ids


# Events the drop-done rehearsal withholds. `token` so the answer visibly arrives via the record-backed
# recovery rather than the live stream; `done` because withholding the terminal event IS Defect 8's
# condition. Everything else (steps, sub_agent_step, heartbeat) still flows, so the connection stays alive.
STREAM_DROP_DONE_EVENTS: frozenset[str] = frozenset({"token", "done"})



def granular_cross_worker_probe_enabled(settings: dict[str, Any] | None, user_id: str | None) -> bool:
    """Whether to fire the granular-surface cross-worker isolation probe.

    This is the hook-based replacement evidence for the retired token probe. It is gated by a distinct
    explicit flag plus the existing founder diagnostic allowlist, and defaults inert.
    """

    settings = settings or {}
    if not bool(settings.get("diagnostic_granular_cross_worker_probe_enabled")):
        return False
    diagnostic_user_ids = {str(value) for value in settings.get("diagnostic_user_ids") or []}
    return bool(user_id) and str(user_id) in diagnostic_user_ids


def founder_isolation_probe_dataset_id(
    settings: dict[str, Any] | None, user_id: str | None
) -> str | None:
    """Return the configured foreign dataset id for the founder-isolation probe, or None when dark."""

    settings = settings or {}
    if not bool(settings.get("diagnostic_founder_isolation_probe_enabled")):
        return None
    diagnostic_user_ids = {str(value) for value in settings.get("diagnostic_user_ids") or []}
    if not user_id or str(user_id) not in diagnostic_user_ids:
        return None
    dataset_id = str(settings.get("diagnostic_founder_isolation_dataset_id") or "").strip()
    return dataset_id or None


def founder_isolation_probe_dataset_ids(
    settings: dict[str, Any] | None, user_id: str | None
) -> dict[str, str]:
    """Return labeled dataset ids for the founder-isolation probe controls."""

    foreign_id = founder_isolation_probe_dataset_id(settings, user_id)
    if not foreign_id:
        return {}
    settings = settings or {}
    dataset_ids = {"foreign": foreign_id}
    owned_id = str(settings.get("diagnostic_founder_isolation_owned_dataset_id") or "").strip()
    random_id = str(settings.get("diagnostic_founder_isolation_random_dataset_id") or "").strip()
    if owned_id:
        dataset_ids["owned_positive_control"] = owned_id
    if random_id:
        dataset_ids["random_negative_control"] = random_id
    return dataset_ids


def sdk_stream_capture_enabled(settings: dict[str, Any] | None, user_id: str | None) -> bool:
    """Whether bounded raw SDK stream diagnostics may exist for this founder.

    This is deliberately a second, dark diagnostic gate rather than a consequence of enabling the
    native path. Both the explicit switch and the existing diagnostic founder allowlist must match.
    Missing settings, an empty allowlist, or a different founder all fail closed.
    """

    settings = settings or {}
    if not bool(settings.get("diagnostic_sdk_stream_capture_enabled")):
        return False
    diagnostic_user_ids = {str(value) for value in settings.get("diagnostic_user_ids") or []}
    return bool(user_id) and str(user_id) in diagnostic_user_ids


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
    for key in required_agents:
        if key not in (options.agents or {}):
            violations.append(f"required_worker_agent_missing:{key}")
        if worker_mcp_servers.get(key) != [SDK_TOOL_SERVER_NAME]:
            violations.append(f"worker_internal_server_not_scoped:{key}")
        for tool_name in worker_tools.get(key, []):
            if tool_name not in allowed_tools:
                violations.append(f"worker_tool_not_preapproved:{tool_name}")
        if SDK_TOOL_SERVER_NAME not in worker_mcp_servers.get(key, []):
            violations.append(f"worker_internal_server_missing:{key}")
    return {
        "required_agents": list(required_agents),
        "lead_selected_registry_tools": selected_registry_tools,
        "lead_allowed_tools": allowed_tools,
        "lead_disallowed_tools": list(options.disallowed_tools or []),
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


def native_tool_access_decision(
    *,
    tool_name: str,
    agent_id_present: bool,
    agent_type: str,
    lead_tool_names: set[str],
    agent_tool_grants: dict[str, set[str]],
) -> tuple[bool, str]:
    """Authorize founder-data tools by caller identity, not by SDK pre-approval."""

    # Keep this as the single authorization decision for both the live PreToolUse hook and the deterministic
    # granular isolation probe. Future callers must reuse this function, not reimplement its grant logic.
    registry_name = _registry_name(tool_name)
    owners = sorted(
        capability
        for capability, grants in agent_tool_grants.items()
        if registry_name in grants
    )
    if agent_id_present:
        granted = registry_name in agent_tool_grants.get(agent_type, set())
        if granted:
            return True, f"{registry_name} is within the compiled {agent_type} delegation grant."
        owner_text = ", ".join(owners) if owners else "no approved native worker"
        return (
            False,
            f"{registry_name} is not granted to {agent_type or 'this worker'}; it belongs to "
            f"{owner_text}. This worker may use only its compiled delegation tools; return control "
            f"to the lead so it can delegate with Task to {owner_text}.",
        )
    if registry_name in lead_tool_names:
        return True, f"{registry_name} is on the lead's Mode B surface."
    owner_text = ", ".join(owners) if owners else "an approved bounded worker"
    return (
        False,
        f"{registry_name} performs founder-data work inside an approved {owner_text} delegation. "
        f"Delegate with Task to {owner_text}; the lead may not call this tool directly.",
    )


def granular_cross_worker_probe_decision(
    *,
    agent_type: str,
    sibling_tool_name: str,
    lead_tool_names: set[str],
    agent_tool_grants: dict[str, set[str]],
) -> tuple[str, str]:
    """Exercise the granular native access hook boundary without asking the model to misbehave."""

    allowed, reason = native_tool_access_decision(
        tool_name=sibling_tool_name,
        agent_id_present=True,
        agent_type=agent_type,
        lead_tool_names=lead_tool_names,
        agent_tool_grants=agent_tool_grants,
    )
    return ("allowed" if allowed else "refused", reason)


def founder_isolation_probe_decision(
    *,
    registry: ToolRegistry,
    tool_context: ToolExecutionContext,
    dataset_id: str,
    probe_label: str = "foreign",
) -> tuple[str, str]:
    """Exercise the founder-bound structured-data tool path against a configured dataset id."""

    try:
        registry.execute(
            "get_dataset_periods",
            tool_context,
            {"dataset_id": dataset_id, "limit": 1},
        )
    except ToolRegistryError as exc:
        return ("refused", str(exc))
    except Exception as exc:  # noqa: BLE001 - surface the exact bounded failure mode in lifecycle evidence
        return (f"error:{type(exc).__name__}", str(exc))
    if probe_label == "owned_positive_control":
        return (
            "owned_positive_control_returned_rows",
            "get_dataset_periods returned rows for a dataset owned by this founder context.",
        )
    return ("LEAKED", "get_dataset_periods returned rows for a non-owned probe dataset under this founder context.")


def compute_gate_decision(
    *,
    tool_name: str,
    tool_input: Any | None = None,
    successful_retrievals: dict[str, _RetrievalBinding] | None = None,
) -> tuple[bool, str]:
    if _registry_name(tool_name) != "execute_code":
        return True, "Compute gate does not apply to this tool."
    retrievals = successful_retrievals or {}
    if not retrievals:
        return (
            False,
            "execute_code requires data with provenance. Complete a successful cited read-only retrieval "
            "tool call in this turn, then compute from that retrieved evidence.",
        )
    input_text = _compute_binding_text(tool_input)
    input_tokens = _binding_text_tokens(input_text)
    source_tokens = set().union(*(binding.source_tokens for binding in retrievals.values()))
    if source_tokens and not (input_tokens & source_tokens):
        retrieval_ids = ", ".join(sorted(retrievals))
        return (
            False,
            "execute_code must compute from the cited retrieval output, not from typed context. Include "
            f"the retrieved rows or their source identifiers from {retrieval_ids} in the code input.",
        )
    retrieved_numbers = set().union(*(binding.numeric_tokens for binding in retrievals.values()))
    asserted_numbers = sorted(_material_numeric_tokens(input_text) - retrieved_numbers)
    if asserted_numbers:
        sample = ", ".join(asserted_numbers[:5])
        return (
            False,
            "execute_code includes material numeric constants not present in this turn's cited retrieval "
            f"output ({sample}). Re-read or paste the cited retrieved values, then compute only from them.",
        )
    retrieval_ids = ", ".join(sorted(retrievals))
    return True, f"execute_code input is bound to cited retrieval output from this turn: {retrieval_ids}."


def _compute_binding_text(value: Any) -> str:
    try:
        return json.dumps(value, sort_keys=True, default=str)
    except TypeError:
        return str(value or "")


def _binding_text_tokens(text: str) -> set[str]:
    return {
        token.lower()
        for token in re.findall(r"[A-Za-z0-9][A-Za-z0-9_.:-]{5,}", text or "")
    }


def _material_numeric_tokens(text: str) -> set[str]:
    tokens: set[str] = set()
    for match in re.finditer(r"(?<![A-Za-z0-9])\$?-?\d[\d,_]*(?:\.\d+)?%?", text or ""):
        raw = match.group(0).strip("$%").replace(",", "").replace("_", "")
        try:
            value = abs(float(raw))
        except ValueError:
            continue
        if value >= 1000:
            tokens.add(raw.rstrip("0").rstrip(".") if "." in raw else raw)
    return tokens


def _retrieval_binding(
    *,
    tool_use_id: str,
    tool_name: str,
    sources: list[dict[str, Any]],
    content_text: str,
) -> _RetrievalBinding:
    source_text = json.dumps(sources, sort_keys=True, default=str)
    combined = f"{source_text}\n{content_text}"
    return _RetrievalBinding(
        tool_use_id=tool_use_id,
        tool_name=tool_name,
        source_tokens=_binding_text_tokens(source_text),
        numeric_tokens=_material_numeric_tokens(combined),
    )


def foreground_delegation_input(tool_input: dict[str, Any]) -> tuple[dict[str, Any], str]:
    """Force the runtime Agent call to return its result in-band.

    Claude Code 2.1.209 treats an omitted ``run_in_background`` field as an
    asynchronous launch. The app owns this execution invariant; prompt wording
    and AgentDefinition defaults are not authorization or lifecycle controls.
    """

    if "run_in_background" not in tool_input:
        input_state = "absent"
    elif tool_input.get("run_in_background") is True:
        input_state = "true"
    else:
        input_state = "present"
    updated_input = dict(tool_input)
    updated_input["run_in_background"] = False
    return updated_input, input_state


def _sanitized_sdk_error(error: Any) -> dict[str, str]:
    """Return bounded exception identity without credentials or bearer material."""

    if isinstance(error, BaseException):
        error_type = type(error).__name__
        message = str(error) or error_type
    else:
        raw = str(error or "SDK tool failure")
        type_match = _SDK_ERROR_TYPE_RE.search(raw)
        message_match = _SDK_ERROR_MESSAGE_RE.search(raw)
        error_type = type_match.group(1) if type_match else "SdkToolFailure"
        message = message_match.group(1) if message_match else raw
    safe_type = re.sub(r"[^A-Za-z0-9_.-]", "", str(error_type))[:120] or "SdkToolFailure"
    safe_message = re.sub(
        r"(?i)bearer\s+[a-z0-9._~+/-]+=*",
        "Bearer [redacted]",
        str(message),
    )
    safe_message = re.sub(r"\bsk-[A-Za-z0-9_-]{12,}\b", "[redacted]", safe_message)
    safe_message = re.sub(
        r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b",
        "[redacted]",
        safe_message,
    )
    return {
        "error_type": safe_type,
        "error_message": safe_message[:500],
    }


@lru_cache(maxsize=1)
def sdk_runtime_versions() -> dict[str, Any]:
    """Read the SDK package and the exact bundled CLI that the SDK will launch."""

    try:
        sdk_version = importlib.metadata.version("claude-agent-sdk")
    except importlib.metadata.PackageNotFoundError:
        sdk_version = str(getattr(claude_agent_sdk, "__version__", "unavailable"))
    cli_name = "claude.exe" if platform.system() == "Windows" else "claude"
    bundled_cli = Path(claude_agent_sdk.__file__).resolve().parent / "_bundled" / cli_name
    cli_version = "unavailable"
    cli_source = "bundled" if bundled_cli.is_file() else "system"
    cli_error_type = ""
    cli_error_message = ""
    executable = str(bundled_cli) if bundled_cli.is_file() else "claude"
    try:
        completed = subprocess.run(
            [executable, "--version"],
            capture_output=True,
            text=True,
            timeout=8,
            check=True,
        )
        raw_version = (completed.stdout or completed.stderr or "").strip()
        cli_version = raw_version[:120] or "unavailable"
    except (OSError, subprocess.SubprocessError) as exc:
        details = _sanitized_sdk_error(exc)
        cli_error_type = details["error_type"]
        cli_error_message = details["error_message"]
    return {
        "claude_agent_sdk_version": sdk_version[:80],
        "claude_code_cli_version": cli_version,
        "claude_code_cli_source": cli_source,
        "claude_code_cli_error_type": cli_error_type,
        "claude_code_cli_error_message": cli_error_message,
    }


def sdk_runtime_pin_status() -> dict[str, Any]:
    """Fail-closed native activation guard for the SDK CLI runtime."""

    versions = sdk_runtime_versions()
    observed = str(versions.get("claude_code_cli_version") or "")
    source = str(versions.get("claude_code_cli_source") or "")
    ok = observed == EXPECTED_CLAUDE_CODE_CLI_VERSION and source == "bundled"
    reason = "matched" if ok else "claude_code_cli_pin_mismatch"
    return {
        **versions,
        "expected_claude_code_cli_version": EXPECTED_CLAUDE_CODE_CLI_VERSION,
        "ok": ok,
        "reason": reason,
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
    native_stream_diagnostic_sink: LifecycleSink | None = None,
    native_model_driven: bool = False,
    native_model_choice: bool = False,
    native_fault_injection: tuple[str, ...] = (),
    native_fault_injection_mode_key: str = "before_start",
    native_granular_cross_worker_probe: bool = False,
    native_founder_isolation_probe_dataset_id: str | None = None,
    native_founder_isolation_probe_dataset_ids: dict[str, str] | None = None,
    founder_question: str | None = None,
    session_store: Any | None = None,
    resume_session_id: str | None = None,
    fork_session: bool = False,
    pending_ask_user_tool_use_id: str | None = None,
    pending_ask_user_answer: str | None = None,
    enable_ask_user_pause: bool = False,
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
                        native_stream_diagnostic_sink=native_stream_diagnostic_sink,
                        native_model_driven=native_model_driven,
                        native_model_choice=native_model_choice,
                        native_fault_injection=native_fault_injection,
                        native_fault_injection_mode_key=native_fault_injection_mode_key,
                        native_granular_cross_worker_probe=native_granular_cross_worker_probe,
                        native_founder_isolation_probe_dataset_id=(
                            native_founder_isolation_probe_dataset_id
                        ),
                        native_founder_isolation_probe_dataset_ids=(
                            native_founder_isolation_probe_dataset_ids
                        ),
                        founder_question=founder_question,
                        session_store=session_store,
                        resume_session_id=resume_session_id,
                        fork_session=fork_session,
                        pending_ask_user_tool_use_id=pending_ask_user_tool_use_id,
                        pending_ask_user_answer=pending_ask_user_answer,
                        enable_ask_user_pause=enable_ask_user_pause,
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
    # OBSERVABILITY (Gate 2). The keepalive was shipped "code-verified, not observed": SSE frames are not
    # visible from the database, so the only proof it ever fired lived in Railway request logs. Counting it
    # here and reporting through the SAME lifecycle sink the delegation events use puts the evidence in
    # `agent_delegation_runs.metadata->sdk_native_lifecycle`, where every other M3 claim is already checked
    # from. Two entries only — the first firing (proves it happens, and when) and a total (proves how much)
    # — so this stays cheap and does not drown the 14 delegation entries it sits beside.
    keepalive_count = 0

    def _report_keepalive(stage: str, **details: Any) -> None:
        if native_lifecycle_sink is None:
            return
        try:
            native_lifecycle_sink({"event": "stream_keepalive", "stage": stage, **details})
        except Exception:  # noqa: BLE001 - observability must never break the stream it observes
            logger.debug("stream keepalive lifecycle report failed; ignored", exc_info=True)

    while True:
        try:
            item = events.get(timeout=keepalive_seconds)
        except queue.Empty:
            idle_seconds += keepalive_seconds
            keepalive_count += 1
            if keepalive_count == 1:
                _report_keepalive("first", idle_seconds=round(idle_seconds, 2))
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
            # Report before propagating: a turn that dies mid-stream is exactly when knowing whether the
            # keepalive was holding the connection open matters most.
            _report_keepalive("total", count=keepalive_count)
            raise item.error
        yield item
    _report_keepalive("total", count=keepalive_count)
    worker.join(timeout=1)
    if not result_box:
        raise RuntimeError("Claude Agent SDK turn ended without a result.")
    return result_box[0]


def _requires_compute_integrity_gate(question: str | None) -> bool:
    """Whether the founder explicitly asked for a new derivation or scenario calculation.

    This is an output-integrity classification only. It does not select a capability, require a worker,
    or alter the native-reasoning-first delegation surface.
    """

    return bool(COMPUTE_REQUEST_SIGNALS.search(str(question or "")))


def _successful_cited_compute_result(
    *,
    worker_results: dict[str, Any],
) -> bool:
    """Reuse semantic_worker_status and require citations before compute can authorize derived figures."""

    candidates: list[Any] = []
    direct = worker_results.get("sandbox_execution_agent")
    if direct is not None:
        candidates.append(direct)

    for candidate in candidates:
        if isinstance(candidate, dict):
            transport_status = candidate.get("status")
            structured_result = candidate.get("structured_result")
            citations = candidate.get("citations") or []
        else:
            transport_status = getattr(candidate, "status", None)
            structured_result = getattr(candidate, "structured_result", None)
            citations = getattr(candidate, "citations", None) or []
        if (
            semantic_worker_status(transport_status, structured_result) == "completed"
            and any(isinstance(item, dict) for item in citations)
        ):
            return True
    return False


def _native_granular_worker_outcome(
    *,
    tool_failed: bool,
    findings: list[dict[str, Any]],
    citations: list[dict[str, Any]],
) -> tuple[str, str, bool]:
    """Separate SDK transport completion from an honest partial semantic result."""

    usable_cited_finding = bool(citations) and any(
        finding.get("status") == "completed"
        and int(finding.get("source_count") or 0) > 0
        for finding in findings
        if isinstance(finding, dict)
    )
    if tool_failed and usable_cited_finding:
        return "completed", "partial", True
    if tool_failed:
        return "failed", "failed", False
    return "completed", "completed", False


def _native_partial_failure_context(*, has_usable_citations: bool) -> dict[str, Any]:
    if not has_usable_citations:
        return {}
    return {
        "hookSpecificOutput": {
            "hookEventName": "PostToolUseFailure",
            "additionalContext": (
                "The refusal was safely enforced and earlier cited findings remain usable. "
                "Correct the request and continue if possible. If no correction succeeds, return "
                "the existing cited findings, name the failed tool and error type, and include the "
                f"exact marker `{NATIVE_PARTIAL_RESULT_MARKER}`. A partial result must not claim "
                "that a requested computation completed."
            ),
        }
    }


def _enforce_composer_integrity(
    answer_text: str,
    *,
    founder_question: str | None,
    successful_cited_compute: bool,
) -> tuple[str, str]:
    """Return the founder-safe answer and a compact decision code for lifecycle evidence."""

    if not _requires_compute_integrity_gate(founder_question):
        return answer_text, "not_required"
    if not successful_cited_compute:
        return COMPUTE_INTEGRITY_REFUSAL, "refused_missing_compute"
    if not ANSWER_CITATION_MARKER.search(answer_text):
        return COMPUTE_INTEGRITY_REFUSAL, "refused_uncited_compute"
    return answer_text, "passed_cited_compute"


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


def _assistant_worker_capability(
    message: Any,
    *,
    task_capabilities: dict[str, str],
    allowed_capabilities: tuple[str, ...],
) -> str | None:
    """Resolve an SDK child message through the approved Task parent map."""

    allowed = set(allowed_capabilities)
    fallback = task_capabilities.get(str(getattr(message, "parent_tool_use_id", "") or ""))
    return fallback if fallback in allowed else None


def _child_run_id_for_capability(
    capability_key: str,
    *,
    worker_results: dict[str, Any],
) -> str | None:
    """Return the authoritative parent-linked child id for one worker."""

    result = worker_results.get(capability_key)
    run_id = getattr(result, "run_id", None)
    return str(run_id) if run_id else None



def build_native_model_driven_manifest(
    compiled: Any,
    *,
    required_agents: tuple[str, ...],
    lead_tool_names: tuple[str, ...],
    agent_tool_grants: dict[str, tuple[str, ...]],
) -> dict[str, Any]:
    """Fail closed when the in-process native surface differs from the approved grant matrix."""

    options = compiled.options
    allowed_tools = set(map(str, options.allowed_tools or []))
    provisioned_tools = list(options.tools or []) if isinstance(options.tools, list) else []
    disallowed_tools = set(map(str, options.disallowed_tools or []))
    agents = options.agents or {}
    violations: list[str] = []

    if DELEGATION_TOOL_PROVISION_NAME not in provisioned_tools:
        violations.append("native_delegation_tool_not_provisioned")
    for blocked in sorted(DELEGATION_TOOL_NAMES & disallowed_tools):
        violations.append(f"native_delegation_tool_disallowed:{blocked}")

    actual_lead = tuple(compiled.lead_tool_names)
    if actual_lead != lead_tool_names:
        violations.append(
            "native_lead_surface_mismatch:"
            + "|".join(actual_lead)
        )

    expected_agents = set(required_agents)
    for unexpected in sorted(set(agents) - expected_agents):
        violations.append(f"native_unexpected_agent:{unexpected}")
    for capability_key in required_agents:
        agent = agents.get(capability_key)
        if agent is None:
            violations.append(f"native_required_agent_missing:{capability_key}")
            continue
        expected_sdk_tools = {
            f"{SDK_TOOL_PREFIX}{name}"
            for name in agent_tool_grants.get(capability_key, ())
        }
        actual_sdk_tools = set(map(str, getattr(agent, "tools", ()) or ()))
        if actual_sdk_tools != expected_sdk_tools:
            violations.append(f"native_worker_grant_mismatch:{capability_key}")
        if list(getattr(agent, "mcpServers", None) or []) != [SDK_TOOL_SERVER_NAME]:
            violations.append(f"native_worker_server_mismatch:{capability_key}")
        for sdk_tool_name in sorted(actual_sdk_tools):
            if sdk_tool_name not in allowed_tools:
                violations.append(f"native_worker_tool_not_preapproved:{sdk_tool_name}")

    if SDK_TOOL_SERVER_NAME not in dict(options.mcp_servers or {}):
        violations.append("native_in_process_server_missing")
    return {
        "delegation_model": "native_granular",
        "required_agents": list(required_agents),
        "lead_tools": list(actual_lead),
        "agent_tool_grants": {
            key: list(compiled.agent_tool_grants.get(key, ()))
            for key in required_agents
        },
        "lead_allowed_tools": sorted(allowed_tools),
        "top_level_servers": sorted(dict(options.mcp_servers or {}).keys()),
        "violations": violations,
    }


def _native_lifecycle_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _native_source_uuid(value: Any) -> str | None:
    try:
        return str(UUID(str(value)))
    except (TypeError, ValueError, AttributeError):
        return None


def _native_tool_output_summary(content: dict[str, Any]) -> dict[str, Any]:
    """Keep evidence-shape facts while excluding raw rows, markdown, SQL, and code."""

    result = content.get("structured_result") if isinstance(content, dict) else None
    candidate = result if isinstance(result, dict) else content
    summary: dict[str, Any] = {}
    for key in (
        "status",
        "result_summary",
        "summary",
        "needs_review",
        "confidence",
        "truncated",
        "row_count",
        "returned_count",
        "total_count",
    ):
        value = candidate.get(key) if isinstance(candidate, dict) else None
        if isinstance(value, (str, int, float, bool)) or value is None:
            if value is not None:
                summary[key] = str(value)[:500] if isinstance(value, str) else value
    findings = candidate.get("findings") if isinstance(candidate, dict) else None
    if isinstance(findings, list):
        summary["finding_count"] = len(findings)
        summary["finding_types"] = [
            str(item.get("finding_type") or item.get("type") or "finding")[:80]
            for item in findings[:25]
            if isinstance(item, dict)
        ]
    return summary


def create_native_child_run(
    client: Any,
    *,
    user_id: str,
    capability: Any,
    parent_surface: str,
    parent_thread_id: str | None,
    parent_message_id: str | None,
    parent_run_id: str | None,
    task_id: str,
    task_contract: dict[str, Any],
    allowed_tools: list[str],
    sdk_agent_id: str,
) -> str:
    """Create the narrow parent-linked child row required by the native evidence surface."""

    objective = str(task_contract.get("objective") or f"Run {capability.capability_key}")[:1000]
    now = _native_lifecycle_now()
    row = {
        "user_id": user_id,
        "capability_id": capability.id,
        "capability_key": capability.capability_key,
        "parent_surface": parent_surface,
        "parent_thread_id": parent_thread_id,
        "parent_message_id": parent_message_id,
        "parent_run_id": parent_run_id,
        "status": "running",
        "task_title": str(getattr(capability, "label", None) or capability.capability_key)[:200],
        "task_summary": objective,
        "context_scope": dict(task_contract.get("context_scope") or {}),
        "allowed_tools_snapshot": list(allowed_tools),
        "structured_result": {},
        "citations": [],
        "metadata": {
            "output_schema_version": "agent_result_v1",
            "can_spawn_agents": False,
            "routing_tier": getattr(capability, "routing_tier", None) or "worker",
            "delegation_depth": 1,
            "reasoning_visibility": "summary_only",
            "sdk_agent_id": sdk_agent_id,
            "parent_tool_use_id": task_id,
            "evidence_schema": "native_granular_v1",
        },
        "started_at": now,
        "updated_at": now,
    }
    response = client.table("agent_delegation_runs").insert(row).execute()
    data = response.data[0] if isinstance(response.data, list) and response.data else response.data
    if not isinstance(data, dict) or not data.get("id"):
        raise RuntimeError("Native SubagentStart could not create the child evidence row.")
    return str(data["id"])


def persist_native_child_step(
    client: Any,
    *,
    user_id: str,
    run_id: str,
    step_index: int,
    tool_name: str,
    tool_use_id: str,
    status: str,
    summary: str,
    output_summary: dict[str, Any],
    source_refs: list[dict[str, Any]],
    error_message: str | None = None,
) -> None:
    """Persist one curated worker tool step and its source-reference rows."""

    client.table("agent_delegation_steps").insert(
        {
            "user_id": user_id,
            "run_id": run_id,
            "step_index": step_index,
            "step_type": "tool_call",
            "status": status,
            "tool_name": tool_name,
            "title": _curated_tool_copy(tool_name, running=False, failed=status == "failed")[1],
            "summary": summary[:1000],
            "input_summary": {"tool_use_id": tool_use_id},
            "output_summary": dict(output_summary),
            "source_refs": list(source_refs),
            "error_message": str(error_message or "")[:2000] or None,
        }
    ).execute()
    for source in source_refs:
        source_id = _native_source_uuid(source.get("source_id"))
        source_metadata = dict(source.get("metadata") or {})
        if source.get("source_id") and source_id is None:
            source_metadata["canonical_source_id"] = str(source["source_id"])[:500]
        client.table("agent_context_sources").insert(
            {
                "user_id": user_id,
                "run_id": run_id,
                "source_kind": str(source.get("source_kind") or "unknown")[:80],
                "source_id": source_id,
                "source_label": str(source.get("label") or "")[:500] or None,
                "source_metadata": source_metadata,
                "citation_payload": dict(source),
            }
        ).execute()


def complete_native_child_run(
    client: Any,
    *,
    user_id: str,
    run_id: str,
    status: str,
    result_summary: str,
    citations: list[dict[str, Any]],
    finding_summaries: list[dict[str, Any]],
    semantic_status: str | None = None,
    degraded: bool = False,
    failure_summaries: list[dict[str, Any]] | None = None,
) -> None:
    """Complete the child row from in-band SDK lifecycle facts."""

    now = _native_lifecycle_now()
    confidence_values = [
        float(finding["confidence"])
        for finding in finding_summaries
        if isinstance(finding.get("confidence"), (int, float))
    ]
    resolved_semantic_status = str(semantic_status or status)
    partial = resolved_semantic_status == "partial"
    needs_review = resolved_semantic_status != "completed" or any(
        finding.get("needs_review") is True for finding in finding_summaries
    )
    structured_result = {
        "schema_version": "agent_result_v1",
        "status": resolved_semantic_status,
        "partial": partial,
        "degraded": bool(degraded),
        "result_summary": result_summary[:1000],
        "findings": list(finding_summaries),
        "citations": list(citations),
        "confidence": min(confidence_values) if confidence_values else 0.7,
        "needs_review": needs_review,
        "reasoning_visibility": "summary_only",
    }
    if failure_summaries:
        structured_result["degradation"] = {
            "marker": NATIVE_PARTIAL_RESULT_MARKER if partial else None,
            "failed_tool_calls": list(failure_summaries),
        }
    (
        client.table("agent_delegation_runs")
        .update(
            {
                "status": status,
                "result_summary": result_summary[:1000],
                "structured_result": structured_result,
                "citations": list(citations),
                "error_message": None if status == "completed" else result_summary[:2000],
                "completed_at": now,
                "updated_at": now,
            }
        )
        .eq("id", run_id)
        .eq("user_id", user_id)
        .execute()
    )


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
    native_stream_diagnostic_sink: LifecycleSink | None,
    native_model_driven: bool = False,
    native_model_choice: bool = False,
    native_fault_injection: tuple[str, ...] = (),
    native_fault_injection_mode_key: str = "before_start",
    native_granular_cross_worker_probe: bool = False,
    native_founder_isolation_probe_dataset_id: str | None = None,
    native_founder_isolation_probe_dataset_ids: dict[str, str] | None = None,
    founder_question: str | None = None,
    session_store: Any | None = None,
    resume_session_id: str | None = None,
    fork_session: bool = False,
    pending_ask_user_tool_use_id: str | None = None,
    pending_ask_user_answer: str | None = None,
    enable_ask_user_pause: bool = False,
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
    # Native granular mode: the lead reasons and delegates via Task; workers call in-process registry tools
    # through the shared architectos MCP server, with execution authorization enforced by PreToolUse hooks.
    # Gated: model_driven is only ever True behind the dark `native_model_driven_enabled` sub-flag.
    model_driven = bool(native_model_driven) and native_mode
    provisioned_agents = tuple(
        key for key in native_subagent_required_agents if key in P4_NATIVE_SUBAGENT_KEYS
    )
    model_choice = bool(native_model_choice) and model_driven
    integrity_question = founder_question if founder_question is not None else prompt
    compute_integrity_required = _requires_compute_integrity_gate(integrity_question)
    required_agents = () if model_choice else provisioned_agents
    task_capabilities: dict[str, str] = {}
    task_contracts: dict[str, dict[str, Any]] = {}
    task_sources: dict[str, list[dict[str, Any]]] = defaultdict(list)
    worker_results: dict[str, Any] = {}
    child_usage_records: list[dict[str, Any]] = []
    completed_agents: set[str] = set()
    successful_retrievals: dict[str, _RetrievalBinding] = {}
    successful_compute_sources: list[dict[str, Any]] = []
    compiled_lead_tool_names: set[str] = set()
    compiled_agent_tool_grants: dict[str, set[str]] = {}
    native_capabilities = (
        {
            capability.capability_key: capability
            for capability in AgentCapabilityRegistry(tool_context.store).list_active()
        }
        if model_driven and tool_context.store is not None
        else {}
    )
    native_child_run_ids: dict[str, str] = {}
    native_child_capabilities: dict[str, str] = {}
    native_child_task_ids: dict[str, str] = {}
    native_child_step_indexes: dict[str, int] = defaultdict(int)
    native_child_sources: dict[str, list[dict[str, Any]]] = defaultdict(list)
    native_child_findings: dict[str, list[dict[str, Any]]] = defaultdict(list)
    native_child_failures: dict[str, list[dict[str, Any]]] = defaultdict(list)
    native_child_failed_tools: dict[str, set[str]] = defaultdict(set)
    native_child_failed: set[str] = set()
    delegation_count = 0
    max_delegations = len(provisioned_agents)
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
    deferred_ask_user: dict[str, Any] | None = None
    resumed_ask_user_consumed = False
    stream_diagnostic_started_at = time.monotonic()
    stream_diagnostic_sequence = 0
    stream_diagnostic_noncritical_emitted = 0
    stream_diagnostic_critical_emitted = 0
    stream_diagnostic_dropped = 0
    stream_diagnostic_lock = threading.Lock()
    agent_tool_use_ids: set[str] = set()

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
            "input_state",
            "error_type",
            "error_message",
            "probe_label",
            "dataset_id",
            # `stage` carries the meaning of legacy worker lifecycle entries. Bounded enum-ish string;
            # no prompt, tool input, or model output passes through here.
            "stage",
        ):
            value = details.get(key)
            if value not in (None, ""):
                safe[key] = str(value)[:200]
        for key in (
            "agent_id_present",
            "delegated",
            "model_claimed_retrieval_attempted",
            "preference_retrieval_attempted",
            "retrieval_attempted",
            "same_objective",
            "single_question",
        ):
            if key in details:
                safe[key] = bool(details[key])
        for key in (
            "observed_retrieval_count",
            "preference_retrieval_count",
            "question_count",
        ):
            if key in details:
                try:
                    safe[key] = max(0, min(int(details[key]), 100))
                except (TypeError, ValueError):
                    safe[key] = 0
        for key in ("observed_retrievals", "preference_retrievals"):
            value = details.get(key)
            if isinstance(value, list):
                safe[key] = [
                    {
                        "tool_name": str(item.get("tool_name") or "")[:120],
                        "tool_use_id": str(item.get("tool_use_id") or "")[:120],
                    }
                    for item in value[:20]
                    if isinstance(item, dict)
                    and (item.get("tool_name") or item.get("tool_use_id"))
                ]
        try:
            native_lifecycle_sink(safe)
        except Exception as exc:  # noqa: BLE001 - diagnostics must never affect the turn
            logger.warning("SDK lifecycle persistence failed open: %s", exc)

    def _bounded_size(value: Any) -> int:
        """Measure a value without retaining it in the diagnostic record."""

        try:
            return len(json.dumps(value, ensure_ascii=True, default=str))
        except Exception:
            return len(str(value))

    def record_stream_diagnostic(event: str, *, critical: bool = False, **details: Any) -> None:
        """Emit one ordered, sanitized SDK diagnostic fact.

        The sink receives no prompts, message text, tool inputs, tool outputs, or reasoning. A hard event
        ceiling bounds the run metadata. Terminal and hook-failure facts are allowed through the ceiling
        so truncation can never hide how iteration ended.
        """

        nonlocal stream_diagnostic_sequence
        nonlocal stream_diagnostic_noncritical_emitted, stream_diagnostic_critical_emitted
        nonlocal stream_diagnostic_dropped
        if not model_driven or native_stream_diagnostic_sink is None:
            return
        with stream_diagnostic_lock:
            stream_diagnostic_sequence += 1
            sequence = stream_diagnostic_sequence
            terminal_fact = event in {
                "sdk_iteration_terminated",
                "sdk_stream_capture_truncated",
            }
            critical_limit = (
                SDK_STREAM_DIAGNOSTIC_EVENT_LIMIT
                - SDK_STREAM_DIAGNOSTIC_NONCRITICAL_LIMIT
                - 2
            )
            if (
                not critical
                and stream_diagnostic_noncritical_emitted
                >= SDK_STREAM_DIAGNOSTIC_NONCRITICAL_LIMIT
            ):
                stream_diagnostic_dropped += 1
                return
            if critical and not terminal_fact and stream_diagnostic_critical_emitted >= critical_limit:
                stream_diagnostic_dropped += 1
                return
            if critical:
                stream_diagnostic_critical_emitted += 1
            else:
                stream_diagnostic_noncritical_emitted += 1
            safe: dict[str, Any] = {
                "sequence": sequence,
                "event": str(event)[:80],
                "elapsed_ms": round((time.monotonic() - stream_diagnostic_started_at) * 1000, 1),
            }
            for key in (
                "object_type",
                "message_id",
                "parent_tool_use_id",
                "hook_event",
                "hook_name",
                "phase",
                "tool_name",
                "tool_use_id",
                "status",
                "termination",
                "error_type",
            ):
                value = details.get(key)
                if value not in (None, ""):
                    safe[key] = str(value)[:SDK_STREAM_DIAGNOSTIC_TEXT_LIMIT]
            for key in (
                "arrival_index",
                "size_chars",
                "text_chars",
                "tool_call_count",
                "tool_result_count",
                "dropped_count",
            ):
                value = details.get(key)
                if value is not None:
                    try:
                        safe[key] = int(value)
                    except (TypeError, ValueError):
                        continue
            for key in (
                "has_text",
                "tool_calls_only",
                "is_agent_result",
                "is_error",
                "agent_id_present",
            ):
                if key in details:
                    safe[key] = bool(details[key])
            for key in ("content_block_types", "tool_call_names", "agent_result_statuses"):
                values = details.get(key)
                if isinstance(values, (list, tuple)):
                    safe[key] = [str(value)[:80] for value in values[:12]]
        try:
            native_stream_diagnostic_sink(safe)
        except Exception as exc:  # noqa: BLE001 - diagnostics must never affect the turn
            logger.warning("SDK stream diagnostic persistence failed open: %s", exc)

    def instrument_hook(hook_event: str, hook: Callable[..., Any]) -> Callable[..., Any]:
        """Wrap an SDK hook with content-free arrival, return, and failure markers."""

        if not model_driven or native_stream_diagnostic_sink is None:
            return hook
        hook_name = getattr(hook, "__name__", type(hook).__name__)

        async def observed_hook(
            input_data: dict[str, Any],
            tool_use_id: str | None,
            context: Any,
        ) -> dict[str, Any]:
            tool_name = str(input_data.get("tool_name") or "")
            agent_id_present = bool(input_data.get("agent_id"))
            if tool_name == DELEGATION_TOOL_RUNTIME_NAME and tool_use_id:
                agent_tool_use_ids.add(str(tool_use_id))
            record_stream_diagnostic(
                "hook_invocation",
                critical=True,
                hook_event=hook_event,
                hook_name=hook_name,
                phase="start",
                tool_name=tool_name,
                tool_use_id=tool_use_id,
                agent_id_present=agent_id_present,
            )
            try:
                result = await hook(input_data, tool_use_id, context)
            except BaseException as exc:  # noqa: BLE001 - record and preserve the real hook failure
                record_stream_diagnostic(
                    "hook_invocation",
                    critical=True,
                    hook_event=hook_event,
                    hook_name=hook_name,
                    phase="exception",
                    tool_name=tool_name,
                    tool_use_id=tool_use_id,
                    error_type=type(exc).__name__,
                    size_chars=min(len(str(exc)), SDK_STREAM_DIAGNOSTIC_TEXT_LIMIT),
                    agent_id_present=agent_id_present,
                )
                raise
            hook_output = result.get("hookSpecificOutput") if isinstance(result, dict) else None
            status = ""
            if isinstance(hook_output, dict):
                status = str(hook_output.get("permissionDecision") or "")
            if not status and isinstance(result, dict):
                status = str(result.get("decision") or "returned")
            record_stream_diagnostic(
                "hook_invocation",
                critical=True,
                hook_event=hook_event,
                hook_name=hook_name,
                phase="return",
                tool_name=tool_name,
                tool_use_id=tool_use_id,
                status=status or "returned",
                size_chars=_bounded_size(result),
                agent_id_present=agent_id_present,
            )
            if tool_name == DELEGATION_TOOL_RUNTIME_NAME and hook_event in {
                "PostToolUse",
                "PostToolUseFailure",
            }:
                tool_response = input_data.get("tool_response")
                failure = input_data.get("error")
                record_stream_diagnostic(
                    "agent_tool_hook_result",
                    critical=hook_event == "PostToolUseFailure",
                    hook_event=hook_event,
                    tool_name=tool_name,
                    tool_use_id=tool_use_id,
                    status="failed" if hook_event == "PostToolUseFailure" else "completed",
                    size_chars=_bounded_size(failure if failure is not None else tool_response),
                    is_error=hook_event == "PostToolUseFailure",
                    is_agent_result=True,
                )
            return result

        return observed_hook

    def emit_plan_update() -> None:
        if not native_mode:
            return
        selected_agents = tuple(dict.fromkeys(task_capabilities.values()))
        plan_agents = selected_agents if model_choice else required_agents
        if model_choice and not plan_agents:
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
            for index, key in enumerate(plan_agents)
        ]
        todos.append(
            {
                "id": "compose",
                "content": (
                    "Compose the cited answer"
                    if model_choice
                    else "Compose the cited 90-day recommendation"
                ),
                "status": "in_progress" if completed_agents.issuperset(plan_agents) else "pending",
                "position": len(todos),
            }
        )
        events.put({"event": "todos_updated", "data": {"todos": todos, "sdkMode": True}})

    emit_plan_update()

    definitions = _selected_definitions(registry, tool_names)
    tool_context.metadata["enforce_persistence_guardrail"] = True
    if pending_ask_user_tool_use_id and pending_ask_user_answer:
        tool_context.metadata["pending_ask_user_tool_use_id"] = str(pending_ask_user_tool_use_id)
        tool_context.metadata["pending_ask_user_answer"] = str(pending_ask_user_answer)
    if model_driven:
        # execute_code is an approved part of this dark native surface. Its authorization is the
        # structural compute gate below, not a founder-facing confirmation prompt.
        confirmed = set(tool_context.metadata.get("confirmed_tool_names") or ())
        confirmed.add("execute_code")
        tool_context.metadata["confirmed_tool_names"] = sorted(confirmed)

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
        raw_tool_input = (
            input_data.get("tool_input") if isinstance(input_data.get("tool_input"), dict) else {}
        )
        tool_input, input_state = foreground_delegation_input(raw_tool_input)
        capability_key = str(tool_input.get("subagent_type") or "").strip()
        task_id = str(tool_use_id or "")
        record_lifecycle(
            "delegation_input_rewrite",
            tool_name=DELEGATION_TOOL_RUNTIME_NAME,
            tool_use_id=task_id,
            capability_key=capability_key,
            input_state=input_state,
            decision="force_foreground",
        )
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
            if capability_key not in provisioned_agents:
                raise ValueError("This canary may delegate only to the approved bounded worker pool.")
            if capability_key in task_capabilities.values():
                raise ValueError("Each approved worker may run only once per turn.")
            if delegation_count >= max_delegations:
                raise ValueError("The bounded per-turn delegation cap has been reached.")
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
                "updatedInput": tool_input,
            }
        }

    async def pre_native_access_gate(
        input_data: dict[str, Any],
        tool_use_id: str | None,
        _context: Any,
    ) -> dict[str, Any]:
        tool_name = str(input_data.get("tool_name") or "")
        agent_id_present = bool(input_data.get("agent_id"))
        agent_type = str(input_data.get("agent_type") or "")
        allowed, reason = native_tool_access_decision(
            tool_name=tool_name,
            agent_id_present=agent_id_present,
            agent_type=agent_type,
            lead_tool_names=compiled_lead_tool_names,
            agent_tool_grants=compiled_agent_tool_grants,
        )
        try:
            logger.info(
                "vcso_sdk native access gate tool=%s agent_id_present=%s agent_type=%s allowed=%s tool_use_id=%s",
                tool_name,
                agent_id_present,
                agent_type,
                allowed,
                tool_use_id,
            )
            record_lifecycle(
                "native_access_gate",
                tool_name=tool_name,
                tool_use_id=tool_use_id,
                capability_key=agent_type,
                agent_id_present=agent_id_present,
                agent_type=agent_type,
                decision="allow" if allowed else "deny",
                reason_code=reason,
            )
        except Exception:  # noqa: BLE001 - logging/persistence must not weaken the gate
            pass
        if not allowed:
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": reason,
                }
            }
        return {}

    async def pre_compute_gate(
        input_data: dict[str, Any],
        tool_use_id: str | None,
        _context: Any,
    ) -> dict[str, Any]:
        tool_name = str(input_data.get("tool_name") or "")
        allowed, reason = compute_gate_decision(
            tool_name=tool_name,
            tool_input=input_data.get("tool_input"),
            successful_retrievals=successful_retrievals,
        )
        record_lifecycle(
            "compute_gate",
            tool_name=tool_name,
            tool_use_id=tool_use_id,
            decision="allow" if allowed else "deny",
            reason_code=reason,
        )
        if allowed:
            return {}
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": reason,
            }
        }

    async def subagent_start_hook(
        input_data: dict[str, Any], tool_use_id: str | None, _context: Any
    ) -> dict[str, Any]:
        agent_id = str(input_data.get("agent_id") or "")
        capability_key = str(input_data.get("agent_type") or "")
        if model_driven:
            if not agent_id or capability_key not in provisioned_agents:
                raise RuntimeError(
                    "Native SubagentStart lacked an approved SDK agent identity; refusing an evidence gap."
                )
            if agent_id not in native_child_run_ids:
                task_id = next(
                    (
                        candidate_task_id
                        for candidate_task_id, candidate_capability in task_capabilities.items()
                        if candidate_capability == capability_key
                    ),
                    "",
                )
                capability = native_capabilities.get(capability_key)
                if not task_id or capability is None:
                    raise RuntimeError(
                        f"Native SubagentStart could not bind {capability_key} to its approved Task."
                    )
                client = getattr(tool_context.store, "client", None)
                if client is None:
                    raise RuntimeError("Native lifecycle persistence requires the founder-scoped store.")
                child_run_id = create_native_child_run(
                    client,
                    user_id=tool_context.user_id,
                    capability=capability,
                    parent_surface=str(tool_context.metadata.get("surface") or "virtual_cso"),
                    parent_thread_id=tool_context.thread_id,
                    parent_message_id=tool_context.metadata.get("parent_message_id"),
                    parent_run_id=tool_context.metadata.get("parent_run_id"),
                    task_id=task_id,
                    task_contract=task_contracts.get(capability_key) or {},
                    allowed_tools=list(compiled.agent_tool_grants.get(capability_key) or ()),
                    sdk_agent_id=agent_id,
                )
                native_child_run_ids[agent_id] = child_run_id
                native_child_capabilities[agent_id] = capability_key
                native_child_task_ids[agent_id] = task_id
        record_lifecycle(
            "subagent_start",
            tool_use_id=tool_use_id,
            capability_key=capability_key,
            agent_type=capability_key,
            agent_id_present=bool(agent_id),
            child_run_id=native_child_run_ids.get(agent_id),
        )
        return {}

    async def subagent_stop_hook(
        input_data: dict[str, Any], tool_use_id: str | None, _context: Any
    ) -> dict[str, Any]:
        agent_id = str(input_data.get("agent_id") or "")
        capability_key = native_child_capabilities.get(agent_id) or str(
            input_data.get("agent_type") or ""
        )
        if model_driven:
            run_id = native_child_run_ids.get(agent_id)
            if not agent_id or not run_id or capability_key not in provisioned_agents:
                raise RuntimeError(
                    "Native SubagentStop lacked its parent-linked child run; refusing an evidence gap."
                )
            citations = list(native_child_sources.get(agent_id) or ())
            step_count = native_child_step_indexes.get(agent_id, 0)
            findings = list(native_child_findings.get(agent_id) or ())
            unresolved_tools = native_child_failed_tools.get(agent_id) or set()
            failures = [
                failure
                for failure in native_child_failures.get(agent_id, ())
                if failure.get("tool_name") in unresolved_tools
            ]
            status, semantic_status, degraded = _native_granular_worker_outcome(
                tool_failed=agent_id in native_child_failed,
                findings=findings,
                citations=citations,
            )
            result_summary = (
                f"{_subagent_title(capability_key)} completed {step_count} granular tool "
                f"call(s) with {len(citations)} cited source reference(s)."
                if semantic_status == "completed"
                else (
                    f"{_subagent_title(capability_key)} completed partially with {len(citations)} cited "
                    f"source reference(s); one or more optional tool calls failed safely. "
                    f"{NATIVE_PARTIAL_RESULT_MARKER}"
                    if semantic_status == "partial"
                    else f"{_subagent_title(capability_key)} stopped after a failed granular tool call."
                )
            )
            complete_native_child_run(
                tool_context.store.client,
                user_id=tool_context.user_id,
                run_id=run_id,
                status=status,
                result_summary=result_summary,
                citations=citations,
                finding_summaries=findings,
                semantic_status=semantic_status,
                degraded=degraded,
                failure_summaries=failures,
            )
            worker_results[capability_key] = SimpleNamespace(
                run_id=run_id,
                status=status,
                result_summary=result_summary,
                structured_result={
                    "schema_version": "agent_result_v1",
                    "status": semantic_status,
                    "partial": semantic_status == "partial",
                    "degraded": degraded,
                    "degradation": {
                        "marker": (
                            NATIVE_PARTIAL_RESULT_MARKER
                            if semantic_status == "partial"
                            else None
                        ),
                        "failed_tool_calls": failures,
                    },
                    "findings": findings,
                    "citations": citations,
                    "confidence": min(
                        [
                            float(finding["confidence"])
                            for finding in findings
                            if isinstance(finding.get("confidence"), (int, float))
                        ]
                        or [0.7]
                    ),
                    "needs_review": semantic_status != "completed"
                    or any(
                        finding.get("needs_review") is True
                        for finding in findings
                    ),
                    "reasoning_visibility": "summary_only",
                },
                citations=citations,
            )
            task_id = native_child_task_ids.get(agent_id, "")
            if task_id:
                task_sources[task_id].extend(citations)
        record_lifecycle(
            "subagent_stop",
            tool_use_id=tool_use_id,
            capability_key=capability_key,
            agent_type=capability_key,
            agent_id_present=bool(agent_id),
            child_run_id=native_child_run_ids.get(agent_id),
        )
        return {}

    async def post_tool_failure(
        input_data: dict[str, Any], tool_use_id: str | None, _context: Any
    ) -> dict[str, Any]:
        error = input_data.get("error")
        sdk_tool_name = str(input_data.get("tool_name") or "tool")
        queued_outcome = (
            tool_outcomes[sdk_tool_name].popleft()
            if tool_outcomes[sdk_tool_name] and tool_outcomes[sdk_tool_name][0].status == "failed"
            else None
        )
        error_details = (
            dict(queued_outcome.output_summary)
            if queued_outcome is not None and queued_outcome.output_summary
            else _sanitized_sdk_error(error)
        )
        agent_id = str(input_data.get("agent_id") or "")
        if model_driven and agent_id:
            run_id = native_child_run_ids.get(agent_id)
            if not run_id:
                raise RuntimeError(
                    "Native worker tool failure arrived before its child evidence row."
                )
            native_child_step_indexes[agent_id] += 1
            native_child_failed.add(agent_id)
            failed_registry_name = _registry_name(sdk_tool_name)
            native_child_failed_tools[agent_id].add(failed_registry_name)
            native_child_failures[agent_id].append(
                {
                    "tool_name": failed_registry_name,
                    "error_type": error_details["error_type"],
                    "error_message": error_details["error_message"],
                }
            )
            persist_native_child_step(
                tool_context.store.client,
                user_id=tool_context.user_id,
                run_id=run_id,
                step_index=native_child_step_indexes[agent_id],
                tool_name=_registry_name(str(input_data.get("tool_name") or "tool")),
                tool_use_id=str(tool_use_id or ""),
                status="failed",
                summary="The granular worker tool call failed safely.",
                output_summary={"status": "failed", **error_details},
                source_refs=[],
                error_message=error_details["error_message"],
            )
        record_lifecycle(
            "post_tool_use_failure",
            tool_name=sdk_tool_name,
            tool_use_id=tool_use_id,
            agent_id_present=bool(input_data.get("agent_id")),
            reason_code=error_details["error_type"],
            error_type=error_details["error_type"],
            error_message=error_details["error_message"],
        )
        return _native_partial_failure_context(
            has_usable_citations=bool(
                model_driven and agent_id and native_child_sources.get(agent_id)
            )
        )

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
            status = "completed" if result is not None and result.status == "completed" else "failed"
            structured_result = (
                result.structured_result
                if result is not None and isinstance(getattr(result, "structured_result", None), dict)
                else {}
            )
            semantic_status = (
                semantic_worker_status(status, structured_result)
                if result is not None
                else "failed"
            )
            partial = semantic_status == "partial"
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
                "semantic_status": semantic_status,
                "partial": partial,
                "degraded": bool(structured_result.get("degraded")),
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
        try:
            definition = registry.get(registry_name)
        except Exception:
            definition = None
        if (
            outcome.status == "completed"
            and definition is not None
            and getattr(definition, "persistence_semantics", "read_only") == "read_only"
            and bool(getattr(definition, "citation", None))
        ):
            retrieval_id = str(tool_use_id or sdk_tool_name)
            successful_retrievals[retrieval_id] = _retrieval_binding(
                tool_use_id=retrieval_id,
                tool_name=registry_name,
                sources=outcome.sources,
                content_text=outcome.content_text,
            )
        if (
            outcome.status == "completed"
            and registry_name == "execute_code"
            and any(source.get("source_kind") == "computation" for source in outcome.sources)
        ):
            successful_compute_sources.extend(outcome.sources)
        agent_id = str(input_data.get("agent_id") or "")
        if model_driven and agent_id:
            run_id = native_child_run_ids.get(agent_id)
            if not run_id:
                raise RuntimeError(
                    "Native worker tool result arrived before its child evidence row."
                )
            native_child_step_indexes[agent_id] += 1
            _lifecycle_step_type, _lifecycle_title, lifecycle_summary = _curated_tool_copy(
                registry_name,
                running=False,
                failed=outcome.status == "failed",
            )
            persist_native_child_step(
                tool_context.store.client,
                user_id=tool_context.user_id,
                run_id=run_id,
                step_index=native_child_step_indexes[agent_id],
                tool_name=registry_name,
                tool_use_id=str(tool_use_id or ""),
                status=outcome.status,
                summary=lifecycle_summary,
                output_summary={
                    **outcome.output_summary,
                    "status": outcome.status,
                    "source_count": len(outcome.sources),
                },
                source_refs=outcome.sources,
            )
            native_child_sources[agent_id].extend(outcome.sources)
            native_child_findings[agent_id].append(
                {
                    "finding_type": "granular_tool_result",
                    "tool_name": registry_name,
                    "status": outcome.status,
                    "source_count": len(outcome.sources),
                    **outcome.output_summary,
                }
            )
            if outcome.status == "completed":
                native_child_failed_tools[agent_id].discard(registry_name)
                if not native_child_failed_tools[agent_id]:
                    native_child_failed.discard(agent_id)
            elif outcome.status == "failed":
                native_child_failed.add(agent_id)
                native_child_failed_tools[agent_id].add(registry_name)
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
        selected_agents = tuple(dict.fromkeys(task_capabilities.values()))
        enforced_agents = selected_agents if model_choice else required_agents
        missing = [key for key in enforced_agents if key not in completed_agents]
        compute_missing = compute_integrity_required and not successful_compute_sources
        if missing or compute_missing:
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
                            f"delegations={delegation_count},missing={'|'.join(missing)},"
                            f"compute_missing={compute_missing}"
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
                    "The bounded native plan is incomplete. "
                    + (
                        "Delegate the missing required worker(s): " + ", ".join(missing) + ". "
                        if missing
                        else ""
                    )
                    + (
                        "Run execute_code from successfully retrieved cited evidence before composing."
                        if compute_missing
                        else ""
                    )
                ),
            }
        _record_turn_trace(metadata=trace_metadata, status="completed")
        turn_trace_emitted = True
        if native_mode:
            plan_agents = selected_agents if model_choice else required_agents
            todos = [
                {
                    "id": key,
                    "content": _subagent_plan_label(key),
                    "status": "completed",
                    "position": index,
                }
                for index, key in enumerate(plan_agents)
            ]
            if plan_agents:
                todos.append(
                    {
                        "id": "compose",
                        "content": "Compose the cited recommendation",
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


    if native_mode and not model_driven:
        record_lifecycle(
            "native_path_retired",
            decision="standard_sdk",
            reason_code="native_model_driven_disabled",
        )
        native_mode = False
        required_agents = ()
        provisioned_agents = ()
        model_choice = False
        plan_statuses = {}
    hooks: dict[str, Any] = {
        "PostToolUse": [
            HookMatcher(
                matcher=r"^mcp__.*$",
                hooks=[instrument_hook("PostToolUse", post_tool_use)],
            )
        ],
        "PostToolUseFailure": [
            HookMatcher(
                matcher=_DELEGATION_OR_MCP_MATCHER,
                hooks=[instrument_hook("PostToolUseFailure", post_tool_failure)],
            )
        ],
        "Stop": [HookMatcher(hooks=[instrument_hook("Stop", stop_hook)])],
        "PreCompact": [HookMatcher(hooks=[instrument_hook("PreCompact", pre_compact_hook)])],
    }
    if model_driven:
        hooks["PostToolUse"] = [
            HookMatcher(
                matcher=_DELEGATION_OR_MCP_MATCHER,
                hooks=[instrument_hook("PostToolUse", post_tool_use)],
            )
        ]
        hooks["PreToolUse"] = [
            HookMatcher(
                matcher=DELEGATION_TOOL_RUNTIME_NAME,
                hooks=[instrument_hook("PreToolUse", pre_task_use)],
            ),
            HookMatcher(
                matcher=r"^mcp__.*$",
                hooks=[
                    instrument_hook("PreToolUse", pre_native_access_gate),
                    instrument_hook("PreToolUse", pre_compute_gate),
                ],
            ),
        ]
        hooks["SubagentStart"] = [
            HookMatcher(hooks=[instrument_hook("SubagentStart", subagent_start_hook)])
        ]
        hooks["SubagentStop"] = [
            HookMatcher(hooks=[instrument_hook("SubagentStop", subagent_stop_hook)])
        ]
    if enable_ask_user_pause:
        async def pause_or_resume_ask_user(
            input_data: dict[str, Any],
            tool_use_id: str | None,
            _context: Any,
        ) -> dict[str, Any]:
            nonlocal deferred_ask_user, resumed_ask_user_consumed
            current_id = str(tool_use_id or "")
            if (
                pending_ask_user_tool_use_id
                and current_id == pending_ask_user_tool_use_id
                and not resumed_ask_user_consumed
            ):
                resumed_ask_user_consumed = True
                return {
                    "hookSpecificOutput": {
                        "hookEventName": "PreToolUse",
                        "permissionDecision": "allow",
                        "permissionDecisionReason": "Resume the persisted founder question exactly once.",
                    }
                }
            question = str(input_data.get("tool_input", {}).get("question") or "").strip()
            tool_input = dict(input_data.get("tool_input") or {})
            supplied_reason = _ask_user_reason_code(tool_input.get("reason_code"))
            observed_retrievals = _ask_user_observed_retrievals(successful_retrievals)
            preference_retrievals = _ask_user_preference_retrievals(successful_retrievals)
            retrieval_attempted = bool(preference_retrievals)
            question_count = _ask_user_question_count(question)
            classification = {
                "classification": "pause",
                "reason_code": supplied_reason,
                "retrieval_attempted": retrieval_attempted,
                "preference_retrieval_attempted": retrieval_attempted,
                "model_claimed_retrieval_attempted": bool(tool_input.get("retrieval_attempted")),
                "observed_retrievals": observed_retrievals,
                "preference_retrievals": preference_retrievals,
                "single_question": question_count <= 1,
                "question_count": question_count,
                "missing_reason_code": supplied_reason == "unspecified",
                "retrieved_context_summary_present": bool(
                    str(tool_input.get("retrieved_context_summary") or "").strip()
                ),
            }
            if not retrieval_attempted:
                classification["observation"] = "retrieval_not_attempted_before_pause"
            elif question_count > 1:
                classification["observation"] = "multiple_questions_in_pause"
            record_lifecycle(
                "ask_user_classification",
                decision="pause",
                reason_code=supplied_reason,
                retrieval_attempted=retrieval_attempted,
                preference_retrieval_attempted=retrieval_attempted,
                preference_retrieval_count=len(preference_retrievals),
                observed_retrieval_count=len(observed_retrievals),
                model_claimed_retrieval_attempted=bool(tool_input.get("retrieval_attempted")),
                observed_retrievals=observed_retrievals,
                preference_retrievals=preference_retrievals,
                single_question=question_count <= 1,
                question_count=question_count,
            )
            deferred_ask_user = {
                "id": current_id,
                "question": question,
                "classification": classification,
            }
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "defer",
                    "permissionDecisionReason": "Wait for the founder response before continuing.",
                }
            }

        hooks["PreToolUse"] = [
            HookMatcher(
                matcher=f"{SDK_TOOL_PREFIX}ask_user",
                hooks=[instrument_hook("PreToolUse", pause_or_resume_ask_user)],
            ),
            *(hooks.get("PreToolUse") or []),
        ]
    if model_driven:
        runtime_pin = sdk_runtime_pin_status()
        if not runtime_pin["ok"]:
            record_lifecycle(
                "sdk_runtime_pin",
                decision="fail_closed",
                reason_code=runtime_pin["reason"],
            )
            raise RuntimeError(
                "Native SDK runtime pin mismatch: expected Claude Code CLI "
                f"{EXPECTED_CLAUDE_CODE_CLI_VERSION}, observed "
                f"{runtime_pin.get('claude_code_cli_version') or 'unavailable'} "
                f"from {runtime_pin.get('claude_code_cli_source') or 'unknown'}."
            )

    native_prompt = (
        (
            _native_generalization_prompt(provisioned_agents)
            if model_choice
            else _native_lead_prompt(required_agents)
        )
        if model_driven
        else ""
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
        native_agent_tool_grants=(
            NATIVE_GRANULAR_AGENT_TOOL_GRANTS if model_driven else None
        ),
        session_store=session_store,
        resume_session_id=resume_session_id,
        fork_session=fork_session,
        enable_ask_user_pause=enable_ask_user_pause,
    )
    options = compiled.options
    compiled_lead_tool_names.update(compiled.lead_tool_names)
    compiled_agent_tool_grants.update(
        {
            capability_key: {
                _registry_name(tool_name)
                for tool_name in getattr(agent, "tools", ())
            }
            for capability_key, agent in (options.agents or {}).items()
        }
    )
    if model_driven:
        # Inverted safety manifest: abort before spending a canary if any run_<agent> tool leaked into the
        # lead's schema or the external worker server was registered top-level (04B-D2-FINDINGS §8).
        runtime_manifest = build_native_model_driven_manifest(
            compiled,
            required_agents=provisioned_agents,
            lead_tool_names=MODE_B_LEAD_TOOL_NAMES,
            agent_tool_grants=NATIVE_GRANULAR_AGENT_TOOL_GRANTS,
        )
        if runtime_manifest["violations"]:
            record_lifecycle("runtime_manifest", decision="model_driven", reason_code="invalid_surface")
            raise RuntimeError(
                "Native model-driven surface invalid; refusing to spend a turn: "
                + ", ".join(runtime_manifest["violations"])
            )
        record_lifecycle("runtime_manifest", decision="native_granular", reason_code="none")
        if native_granular_cross_worker_probe:
            probe_agent = "structured_data_agent"
            probe_tool = f"{SDK_TOOL_PREFIX}wiki_search"
            decision, reason = granular_cross_worker_probe_decision(
                agent_type=probe_agent,
                sibling_tool_name=probe_tool,
                lead_tool_names=compiled_lead_tool_names,
                agent_tool_grants=compiled_agent_tool_grants,
            )
            lifecycle_decision = "LEAKED" if decision == "allowed" else decision
            record_lifecycle(
                "granular_cross_worker_probe",
                tool_name=probe_tool,
                capability_key=probe_agent,
                agent_id_present=True,
                agent_type=probe_agent,
                decision=lifecycle_decision,
                reason_code=reason,
            )
            if lifecycle_decision == "LEAKED":
                logger.error(
                    "vcso_sdk granular cross-worker probe leaked: %s was allowed to call %s",
                    probe_agent,
                    probe_tool,
                )
        founder_probe_dataset_ids = dict(native_founder_isolation_probe_dataset_ids or {})
        if native_founder_isolation_probe_dataset_id:
            founder_probe_dataset_ids.setdefault("foreign", native_founder_isolation_probe_dataset_id)
        for probe_label, probe_dataset_id in founder_probe_dataset_ids.items():
            decision, reason = founder_isolation_probe_decision(
                registry=registry,
                tool_context=tool_context,
                dataset_id=probe_dataset_id,
                probe_label=probe_label,
            )
            record_lifecycle(
                "founder_isolation_probe",
                tool_name=f"{SDK_TOOL_PREFIX}get_dataset_periods",
                capability_key="structured_data_agent",
                decision=decision,
                probe_label=probe_label,
                dataset_id=probe_dataset_id,
                reason_code=f"{probe_label}:{reason}"[:200],
            )
            if decision == "LEAKED":
                logger.error(
                    "vcso_sdk founder-isolation probe leaked for label=%s dataset_id=%s",
                    probe_label,
                    probe_dataset_id,
                )
    else:
        runtime_manifest = {
            "delegation_model": "standard_sdk",
            "required_agents": list(required_agents),
            "violations": [],
        }
        if native_mode:
            record_lifecycle("runtime_manifest", decision="standard_sdk", reason_code="none")
    trace_metadata.update(
        {
            "sdk_compiled_tool_count": len(compiled.tool_names),
            "sdk_compiled_agent_count": len(compiled.agent_tool_grants),
            "sdk_compiled_connector_count": len(compiled.connector_names),
            "sdk_native_subagent_mode": native_mode,
            "sdk_required_subagents": list(required_agents),
            "sdk_available_subagents": list(provisioned_agents),
            "sdk_delegation_selection": "model_choice" if model_choice else "fixed_required",
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
    result_deferred_tool_use: Any | None = None
    diagnostics_drained = False
    sdk_message_arrival_index = 0
    sdk_result_message_seen = False


    def _record_sdk_message(message: Any) -> None:
        """Record one SDK-yielded object without retaining any of its content."""

        nonlocal sdk_message_arrival_index, sdk_result_message_seen
        if isinstance(message, StreamEvent):
            event_type = str((message.event or {}).get("type") or "")
            if event_type not in SDK_STREAM_DIAGNOSTIC_EVENT_TYPES:
                return
        sdk_message_arrival_index += 1
        object_type = type(message).__name__
        parent_tool_use_id = str(getattr(message, "parent_tool_use_id", "") or "")
        details: dict[str, Any] = {
            "arrival_index": sdk_message_arrival_index,
            "object_type": object_type,
            "parent_tool_use_id": parent_tool_use_id,
        }
        if isinstance(message, AssistantMessage):
            blocks = list(message.content or [])
            block_types = [type(block).__name__ for block in blocks]
            text_chars = sum(
                len(str(getattr(block, "text", "") or ""))
                for block in blocks
                if type(block).__name__ == "TextBlock"
            )
            tool_calls = [block for block in blocks if isinstance(block, ToolUseBlock)]
            tool_results = [block for block in blocks if isinstance(block, ToolResultBlock)]
            for block in tool_calls:
                if str(block.name or "") == DELEGATION_TOOL_RUNTIME_NAME:
                    agent_tool_use_ids.add(str(block.id))
            for block in tool_results:
                tool_use_id = str(block.tool_use_id or "")
                if tool_use_id in agent_tool_use_ids:
                    record_stream_diagnostic(
                        "agent_tool_result",
                        critical=True,
                        object_type=object_type,
                        parent_tool_use_id=parent_tool_use_id,
                        tool_use_id=tool_use_id,
                        status="failed" if block.is_error else "completed",
                        size_chars=_bounded_size(block.content),
                        is_agent_result=True,
                        is_error=bool(block.is_error),
                    )
            details.update(
                {
                    "message_id": str(message.message_id or ""),
                    "has_text": text_chars > 0,
                    "text_chars": text_chars,
                    "tool_calls_only": bool(tool_calls) and text_chars == 0,
                    "tool_call_count": len(tool_calls),
                    "tool_result_count": len(tool_results),
                    "tool_call_names": [str(block.name or "") for block in tool_calls],
                    "content_block_types": block_types,
                }
            )
        elif isinstance(message, UserMessage):
            blocks = list(message.content) if isinstance(message.content, list) else []
            tool_results = [block for block in blocks if isinstance(block, ToolResultBlock)]
            details.update(
                {
                    "tool_result_count": len(tool_results),
                    "content_block_types": [type(block).__name__ for block in blocks],
                }
            )
            for block in tool_results:
                tool_use_id = str(block.tool_use_id or "")
                if tool_use_id not in agent_tool_use_ids:
                    continue
                tool_use_result = (
                    message.tool_use_result if isinstance(message.tool_use_result, dict) else {}
                )
                status = str(tool_use_result.get("status") or "")
                if not status:
                    status = "failed" if block.is_error else "completed"
                record_stream_diagnostic(
                    "agent_tool_result",
                    critical=True,
                    object_type=object_type,
                    parent_tool_use_id=parent_tool_use_id,
                    tool_use_id=tool_use_id,
                    status=status,
                    size_chars=_bounded_size(block.content) + _bounded_size(tool_use_result),
                    is_agent_result=True,
                    is_error=bool(block.is_error),
                )
        elif isinstance(message, ResultMessage):
            sdk_result_message_seen = True
            details.update(
                {
                    "message_id": str(getattr(message, "uuid", "") or ""),
                    "status": str(message.subtype or ""),
                    "is_error": bool(message.is_error),
                    "size_chars": len(str(message.result or "")),
                }
            )
        elif isinstance(message, StreamEvent):
            event = message.event or {}
            details["status"] = str(event.get("type") or "")
            if event.get("type") == "content_block_start":
                block = event.get("content_block") or {}
                if str(block.get("name") or "") == DELEGATION_TOOL_RUNTIME_NAME:
                    agent_tool_use_ids.add(str(block.get("id") or ""))
        record_stream_diagnostic("sdk_stream_message", **details)

    try:
        try:
            async for message in query_impl(prompt=prompt, options=options):
                _record_sdk_message(message)
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
                                    # A compute-sensitive answer is buffered until the deterministic final
                                    # seam can verify a successful, cited compute result. Narration and every
                                    # non-compute turn keep their existing real-time stream.
                                    if not (
                                        (compute_integrity_required or enable_ask_user_pause)
                                        and channel == "answer"
                                    ):
                                        events.put({"event": "token", "data": token_data})
                elif isinstance(message, ResultMessage):
                    session_id = message.session_id
                    final_result_text = message.result
                    result_deferred_tool_use = message.deferred_tool_use
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
                            "capability_key": _assistant_worker_capability(
                            message,
                            task_capabilities=task_capabilities,
                            allowed_capabilities=provisioned_agents,
                            ),
                            "model": str(message.model or ""),
                            "input_tokens": _usage_input_total(usage),
                            "output_tokens": _usage_int(usage, "output_tokens", "outputTokens"),
                        }
                    )
        except BaseException as exc:  # noqa: BLE001 - preserve the SDK iterator's real failure
            record_stream_diagnostic(
                "sdk_iteration_terminated",
                critical=True,
                termination="exception",
                error_type=type(exc).__name__,
                size_chars=min(len(str(exc)), SDK_STREAM_DIAGNOSTIC_TEXT_LIMIT),
            )
            raise
        else:
            record_stream_diagnostic(
                "sdk_iteration_terminated",
                critical=True,
                termination="result_message" if sdk_result_message_seen else "exhaustion",
            )

        for channel, visible_text, segment_id in text_normalizer.finish():
            if channel == "answer":
                answer_parts.append(visible_text)
            elif segment_id is not None:
                narration_by_segment[segment_id] = narration_by_segment.get(segment_id, "") + visible_text
            token_data = {"text": visible_text, "channel": channel, "sdkMode": True}
            if segment_id is not None:
                token_data["segmentId"] = segment_id
            if not (
                (compute_integrity_required or enable_ask_user_pause)
                and channel == "answer"
            ):
                events.put({"event": "token", "data": token_data})
    finally:
        if stream_diagnostic_dropped:
            record_stream_diagnostic(
                "sdk_stream_capture_truncated",
                critical=True,
                dropped_count=stream_diagnostic_dropped,
            )
    # Backfill the in-process child run ids into curated Task steps before persistence so a reopened
    # founder thread retains the same parent/child grouping as the live C2 stream.
    resolved_child_run_ids: dict[str, str] = {}
    for capability_key in (delegated_agents if model_choice else required_agents):
        child_run_id = _child_run_id_for_capability(
            capability_key,
            worker_results=worker_results,
        )
        if not child_run_id:
            continue
        resolved_child_run_ids[capability_key] = child_run_id
        result = worker_results.get(capability_key)
        if result is not None and not getattr(result, "run_id", None):
            result.run_id = child_run_id
        for step in trace_steps:
            if step.get("capabilityKey") != capability_key:
                continue
            try:
                safe_output = json.loads(str(step.get("output") or "{}"))
            except (TypeError, json.JSONDecodeError):
                safe_output = {}
            safe_output.update(
                {
                    "run_id": child_run_id,
                    "capability_key": capability_key,
                    "parent_tool_use_id": step.get("parentToolUseId"),
                }
            )
            step["output"] = json.dumps(safe_output)
            task_id = str(step.get("parentToolUseId") or "")
            if task_id and task_sources.get(task_id):
                step["sourceRefs"] = list(task_sources[task_id])
    for child_usage in child_usage_records:
        capability_key = child_usage.get("capability_key") or task_capabilities.get(child_usage["task_id"])
        if not capability_key:
            continue
        child_run_id = resolved_child_run_ids.get(capability_key)
        if not child_run_id:
            logger.warning(
                "SDK child usage could not resolve a parent-linked run id; skipped capability=%s",
                capability_key,
            )
            continue
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
    if result_deferred_tool_use is not None:
        deferred_id = str(getattr(result_deferred_tool_use, "id", "") or "")
        deferred_input = getattr(result_deferred_tool_use, "input", {}) or {}
        deferred_question = str(deferred_input.get("question") or "").strip()
        if deferred_ask_user:
            deferred_id = deferred_id or deferred_ask_user["id"]
            deferred_question = deferred_question or deferred_ask_user["question"]
            deferred_classification = dict(deferred_ask_user.get("classification") or {})
        else:
            deferred_classification = {}
        if not session_id or not deferred_id or not deferred_question:
            raise RuntimeError("SDK ask_user pause ended without a durable session, tool id, or question.")
        return VcsoSdkTurnResult(
            answer_text="",
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
            worker_runs=[],
            compaction_count=compaction_count,
            turn_trace_emitted=turn_trace_emitted,
            usage_recorded=usage_recorded,
            deferred_tool_use_id=deferred_id,
            deferred_question=deferred_question,
            deferred_classification=deferred_classification,
        )
    answer_text = "".join(answer_parts).strip()
    if not answer_text and final_result_text:
        fallback_normalizer = _NarrationStreamNormalizer()
        fallback_pieces = [*fallback_normalizer.feed(final_result_text), *fallback_normalizer.finish()]
        answer_text = "".join(
            text for channel, text, _segment in fallback_pieces if channel == "answer"
        ).strip()
        if answer_text and not compute_integrity_required:
            events.put(
                {
                    "event": "token",
                    "data": {"text": answer_text, "channel": "answer", "sdkMode": True},
                }
            )
    if not answer_text:
        raise RuntimeError("Claude Agent SDK returned no assistant text.")
    successful_cited_compute = (
        (
            bool(successful_compute_sources)
            if model_driven
            else _successful_cited_compute_result(
                worker_results=worker_results,
            )
        )
        if compute_integrity_required
        else False
    )
    answer_text, integrity_decision = _enforce_composer_integrity(
        answer_text,
        founder_question=integrity_question,
        successful_cited_compute=successful_cited_compute,
    )
    record_lifecycle(
        "composer_integrity_gate",
        decision=integrity_decision,
        compute_required=compute_integrity_required,
        successful_cited_compute=successful_cited_compute,
    )
    if compute_integrity_required or enable_ask_user_pause:
        # No answer token from a compute-sensitive turn is founder-visible before this point.
        events.put(
            {
                "event": "token",
                "data": {"text": answer_text, "channel": "answer", "sdkMode": True},
            }
        )
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
                "semantic_status": semantic_worker_status(
                    result.status,
                    getattr(result, "structured_result", None),
                ),
                "partial": bool(
                    getattr(result, "structured_result", {}).get("partial")
                    if isinstance(getattr(result, "structured_result", None), dict)
                    else False
                ),
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
            safe_content = json.dumps(envelope.to_dict(), default=str)
            tool_outcomes[sdk_name].append(
                _ToolOutcome(
                    "completed",
                    sources,
                    _native_tool_output_summary(envelope.content),
                    safe_content[:12000],
                )
            )
            return {"content": [{"type": "text", "text": safe_content[:12000]}]}
        except Exception as exc:  # noqa: BLE001 - return a bounded tool error to the SDK loop
            error_details = _sanitized_sdk_error(exc)
            logger.warning(
                "SDK registry tool %s failed (%s): %s",
                definition.name,
                error_details["error_type"],
                error_details["error_message"],
            )
            tool_outcomes[sdk_name].append(
                _ToolOutcome(
                    "failed",
                    [],
                    {"status": "failed", **error_details},
                )
            )
            return {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(
                            {
                                "error": "Tool failed safely.",
                                **error_details,
                            }
                        ),
                    }
                ],
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


def _ask_user_reason_code(value: Any) -> str:
    allowed = {
        "founder_preference",
        "founder_priority",
        "founder_definition",
        "founder_constraint",
        "other_founder_judgment",
    }
    normalized = str(value or "").strip().lower()
    return normalized if normalized in allowed else "unspecified"


def _ask_user_question_count(question: str) -> int:
    text = str(question or "").strip()
    if not text:
        return 0
    question_marks = text.count("?")
    if question_marks:
        return question_marks
    lines = [line for line in text.splitlines() if line.strip()]
    return max(1, len(lines))


def _ask_user_observed_retrievals(
    retrievals: dict[str, _RetrievalBinding],
) -> list[dict[str, str]]:
    return [
        {"tool_use_id": binding.tool_use_id, "tool_name": binding.tool_name}
        for binding in retrievals.values()
    ]


def _ask_user_preference_retrievals(
    retrievals: dict[str, _RetrievalBinding],
) -> list[dict[str, str]]:
    preference_tools = {
        "wiki_search",
        "wiki_get_page",
        "wiki_list",
        "kb_grep",
        "kb_read",
        "kb_tree",
        "kb_ls",
        "read_file",
    }
    return [
        {"tool_use_id": binding.tool_use_id, "tool_name": binding.tool_name}
        for binding in retrievals.values()
        if binding.tool_name in preference_tools
    ]


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


def _per_worker_contract_brief(
    required_agents: tuple[str, ...],
    *,
    contracts: dict[str, dict[str, Any]] = WORKER_DELEGATION_CONTRACTS,
) -> str:
    """Render one explicit delegation contract brief per worker."""

    specs = [contracts[key] for key in required_agents if key in contracts]
    if not specs:
        return ""
    blocks = []
    for key, spec in zip(
        [key for key in required_agents if key in contracts], specs, strict=False
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
        "\n\nNATIVE GRANULAR-WORKER CONTRACT. This exact probe is a genuine multi-part synthesis; "
        f"you must delegate exactly once to each approved worker: {required}. "
        "Use the SDK Task tool for founder-data work owned by those workers. The lead has a deliberately "
        "small Mode B read surface for bounded context and execute_code for derivation; seeing a worker "
        "tool does not authorize the lead to execute it, and the access hook will refuse a direct call. "
        "Delegate before drafting any answer. The structured-data worker must retrieve and return the "
        "cited series needed for the calculation. The wiki worker must retrieve the cited strategic "
        "context. After a successful cited read-only retrieval, use execute_code on the lead to derive "
        "the requested number. Never compute from an uncited or silently truncated series. Every Task prompt must be "
        "exactly one JSON object with keys objective, output_format, tools_sources, boundaries, and "
        "context_scope. Boundaries must require founder isolation, citations, compact output, no raw "
        "payloads, no wiki writes, no recursion, and no external writes. Compose only after both worker "
        "findings and a cited computation complete. If a worker returns `PARTIAL_RESULT: true`, disclose "
        "that degradation, use only its cited findings, and never treat it as satisfying cited compute."
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
        "source evidence and its strategic meaning, and composing from context you were handed instead of from worker "
        "findings is the failure mode this contract exists to prevent."
        + _per_worker_contract_brief(required_agents)
        + "\n\nTASK CONTRACT SCHEMA. Each Task prompt must be EXACTLY one JSON object -- no prose, no markdown "
        "fence, no text before or after the braces. Required keys: objective (non-empty string), "
        "output_format (present), tools_sources (NON-EMPTY list), boundaries (NON-EMPTY list), context_scope "
        "(object). Each approved worker may run only once per turn. Worked example "
        "(structured-data delegation): "
        '{"objective":"Quantify client-concentration and margin trend from the founder dataset",'
        '"output_format":"compact cited findings","tools_sources":["founder_dataset"],'
        '"boundaries":["founder isolation","cite every claim","compact output","no raw payloads",'
        '"no wiki writes","no recursion","no external writes"],"context_scope":{"quarter":"current"}}'
    )


def _native_generalization_prompt(provisioned_agents: tuple[str, ...]) -> str:
    """Phase-G dark-canary contract: the model chooses the smallest appropriate worker set."""

    available = ", ".join(provisioned_agents)
    return (
        "\n\nPHASE-G GENERALIZATION CANARY. You have a bounded candidate worker pool: "
        f"{available}. Decide whether the founder's actual question needs none, one, or more of these "
        "workers. Use the smallest sufficient set. This is a judgment test: do not delegate merely because "
        "a worker is available, and do not skip a worker when grounded retrieval or computation is necessary. "
        "Answer definitions, acknowledgements, and questions already answerable without founder evidence "
        "directly with zero Tasks. When the strategic ask is genuinely ambiguous, clarify the founder's goal "
        "or scope before doing expensive work; a light, clearly scoped evidence pull is acceptable only when "
        "it materially improves the steer. Use structured_data_agent for the founder's structured business "
        "records, per_user_wiki for compiled strategic or diagnostic context, and sandbox_execution_agent "
        "only for a real derivation or scenario computation from a compact structured-data finding. "
        "Sandbox may run only after structured_data_agent completes, and its Task contract must carry that "
        "compact finding in context_scope.prior_findings. Never send a raw dataset to the sandbox. Each "
        "worker may run at most once; never recurse or write externally. Compose factual founder claims only "
        "from cited worker findings, and state missing evidence honestly instead of inventing it."
        + _per_worker_contract_brief(
            provisioned_agents,
            contracts=G_GATE_WORKER_DELEGATION_CONTRACTS,
        )
        + "\n\nTASK CONTRACT SCHEMA. Every Task prompt must be exactly one JSON object with no prose or "
        "markdown around it. Required keys: objective (non-empty string), output_format (present), "
        "tools_sources (non-empty list), boundaries (non-empty list), and context_scope (object). "
        "Boundaries must include founder isolation, citations, compact output, no raw payloads, no wiki "
        "writes, no recursion, and no external writes. Write a distinct objective for the specific worker "
        "and this founder question. Do not expose raw tool payloads or hidden chain-of-thought."
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
