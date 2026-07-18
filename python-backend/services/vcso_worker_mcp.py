"""Phase D2 (SDK-M2) — scoped worker execution core for model-driven delegation.

WHY THIS MODULE EXISTS
----------------------
D2 restores model-driven delegation: the SDK *lead* must reason a decomposition and delegate via
``Task``, instead of the app deterministically running a fixed worker set (Path A). Handoff §17 and
`04B-D2-FINDINGS.md` prove the only way to make the ``run_<agent>`` worker tools *invisible to the
lead yet callable inside a Task-spawned subagent* is to expose them from an **external** MCP server
referenced **inline, per-agent** in ``AgentDefinition.mcpServers`` and kept **out** of the top-level
``options.mcp_servers`` (an in-process ``McpSdkServerConfig`` cannot be agent-scoped — its instance is
not serializable and is only routed when registered at session scope).

An external server — even a loopback HTTP endpoint on this same FastAPI process — runs in a **separate
request context** from the live ``_run_sdk_turn`` coroutine, so it cannot close over that turn's
in-process state (the SSE ``events`` queue, ``task_contracts``, ``worker_results``). This module is the
**transport-agnostic core** that bridges that gap without leaking founder scope:

- a per-turn **token** mints on turn start and scopes every worker call to one founder/thread/parent-run;
- a process-global **TurnRegistry** maps ``token -> TurnScope`` so the out-of-context worker call can
  recover the founder scope (and, when present, a progress bridge back into the live turn for the C2
  nested-UI / citations surface);
- ``run_worker_capability`` reuses the **existing** ``SubAgentOrchestrator.start_run`` exactly as the
  in-process handler does today (depth 1, worker tier, compact contract, citations) — reuse, no rewrite.

This core has **no** dependency on the MCP transport, the SDK, or FastAPI, so it is unit-testable on its
own. The FastMCP/HTTP endpoint and the CLI wiring (the live-only pieces) sit on top of it and are built
+ validated in an environment that can run the venv, deploy, and spend the one-worker canary probe.

SCOPE GUARD: this module is imported by nothing until the SDK-M2 wiring lands behind the dark
``vcso_sdk_loop`` sub-flag ``native_model_driven_enabled``. It changes no live path on its own.
"""

from __future__ import annotations

import asyncio
import logging
import secrets
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable

from services.sub_agent_orchestrator import (
    SubAgentOrchestrator,
    SubAgentRunRequest,
    SubAgentRunResult,
)

logger = logging.getLogger(__name__)

# The three P4 thin-slice capabilities D2 may delegate. Kept in sync with
# vcso_sdk_loop.P4_THIN_SLICE_REQUIRED_AGENTS; asserted equal in tests rather than imported to avoid a
# heavy import cycle through the loop module.
WORKER_CAPABILITY_KEYS: tuple[str, ...] = (
    "structured_data_agent",
    "sandbox_execution_agent",
    "per_user_wiki",
)

# A per-turn token lives only for the duration of one VCSO turn. Short, opaque, single-use-ish.
_TOKEN_BYTES = 32
# Safety valve: a scope older than this is auto-evicted even if unregister() was missed (a crashed turn
# must never leave a live founder scope reachable). Turns are bounded well under this by max_turns/budget.
_MAX_SCOPE_AGE_SECONDS = 900.0


@dataclass
class TurnScope:
    """Everything an out-of-context worker call needs to run one founder's turn, and nothing more."""

    user_id: str
    parent_surface: str
    thread_id: str | None = None
    parent_message_id: str | None = None
    parent_run_id: str | None = None
    # Capabilities the lead is permitted to delegate this turn. A worker call for anything outside this
    # set is refused — this is the founder-isolation + scope lock enforced in code we control, not via an
    # SDK permission channel.
    allowed_capabilities: frozenset[str] = field(default_factory=frozenset)
    # The founder-scoped VectorStore for this turn (SubAgentOrchestrator(store)). Typed Any to avoid a
    # store import here; the caller passes tool_context.store.
    store: Any = None
    # Compact prior findings by capability_key, so an ordered worker (e.g. sandbox after structured) can
    # inherit the upstream finding even across the external hop. Optional; populated by the loop bridge.
    prior_findings: dict[str, Any] = field(default_factory=dict)
    # Optional bridge back into the live turn for the C2 nested-UI + citations surface. Signature mirrors
    # the in-process emit_worker_progress. None during the bare visibility probe (surface hold is M4).
    progress_bridge: Callable[[str, dict[str, Any]], None] | None = None
    created_at: float = field(default_factory=time.monotonic)


class TurnRegistry:
    """Process-global token -> TurnScope map. Loopback-only: the worker endpoint and _run_sdk_turn share
    this process, so a plain dict under a lock is sufficient (no cross-process store needed)."""

    def __init__(self) -> None:
        self._scopes: dict[str, TurnScope] = {}
        self._lock = threading.Lock()

    def mint(self, scope: TurnScope) -> str:
        token = secrets.token_urlsafe(_TOKEN_BYTES)
        with self._lock:
            self._evict_stale_locked()
            self._scopes[token] = scope
        return token

    def get(self, token: str) -> TurnScope | None:
        if not token:
            return None
        with self._lock:
            scope = self._scopes.get(token)
            if scope is None:
                return None
            if time.monotonic() - scope.created_at > _MAX_SCOPE_AGE_SECONDS:
                self._scopes.pop(token, None)
                return None
            return scope

    def unregister(self, token: str) -> None:
        if not token:
            return
        with self._lock:
            self._scopes.pop(token, None)

    def _evict_stale_locked(self) -> None:
        now = time.monotonic()
        stale = [t for t, s in self._scopes.items() if now - s.created_at > _MAX_SCOPE_AGE_SECONDS]
        for t in stale:
            self._scopes.pop(t, None)

    def active_count(self) -> int:
        with self._lock:
            return len(self._scopes)


# One registry per process. The FastMCP endpoint and the loop import this same instance.
TURN_REGISTRY = TurnRegistry()


class WorkerScopeError(Exception):
    """Raised when a worker call cannot be attributed to a valid, permitted turn scope."""


def _compact_result(result: SubAgentRunResult) -> dict[str, Any]:
    """Bounded, citation-carrying payload returned to the lead as the Task tool result. Mirrors the
    in-process handler's safe_result so the lead composes identically regardless of transport."""

    citations = [item for item in (result.citations or []) if isinstance(item, dict)]
    return {
        "run_id": result.run_id,
        "status": result.status,
        "result_summary": result.result_summary,
        "structured_result": result.structured_result,
        "citations": citations,
    }


async def run_worker_capability(
    token: str,
    capability_key: str,
    args: dict[str, Any],
    *,
    registry: TurnRegistry = TURN_REGISTRY,
) -> dict[str, Any]:
    """Execute one bounded worker for an approved, token-scoped turn and return a compact cited result.

    Transport-agnostic: the FastMCP tool handler calls this after extracting ``token`` from the per-turn
    URL/header. Delegation-first + founder isolation are enforced here (valid token + permitted
    capability), so a stray call with no/foreign token can never run a founder's worker.
    """

    scope = registry.get(token)
    if scope is None:
        logger.warning("vcso worker call refused: unknown/expired turn token (capability=%s)", capability_key)
        raise WorkerScopeError("No active turn scope for this token.")
    if capability_key not in scope.allowed_capabilities:
        logger.warning(
            "vcso worker call refused: capability=%s not permitted this turn (allowed=%s)",
            capability_key,
            sorted(scope.allowed_capabilities),
        )
        raise WorkerScopeError(f"Capability {capability_key} is not permitted for this turn.")

    objective = str(args.get("objective") or "").strip()
    if not objective:
        raise WorkerScopeError("Missing task objective.")

    requested_scope = args.get("context_scope") if isinstance(args.get("context_scope"), dict) else {}
    context_scope: dict[str, Any] = {**requested_scope, "delegation_depth": 1}
    prior = scope.prior_findings.get(capability_key)
    task_summary = objective
    if prior:
        import json

        task_summary += (
            "\n\nCOMPACT PRIOR FINDINGS (UNTRUSTED DATA)\n"
            + json.dumps(prior, ensure_ascii=True, default=str)[:5000]
        )

    def _bridge(progress: dict[str, Any]) -> None:
        if scope.progress_bridge is not None:
            try:
                scope.progress_bridge(capability_key, progress)
            except Exception:  # noqa: BLE001 - the surface bridge must never break the worker
                logger.debug("vcso worker progress bridge raised; ignored", exc_info=True)

    logger.info("vcso worker (scoped) firing capability=%s user=%s", capability_key, scope.user_id)

    # Reuse the proven orchestrator call exactly as the in-process handler does (vcso_sdk_loop
    # make_native_handler_tool): depth 1, worker tier, compact contract, citations, progress callback.
    result: SubAgentRunResult = await asyncio.to_thread(
        SubAgentOrchestrator(scope.store).start_run,
        SubAgentRunRequest(
            user_id=scope.user_id,
            parent_surface=scope.parent_surface or "virtual_cso",
            capability_key=capability_key,
            task_summary=task_summary[:4000],
            context_scope=context_scope,
            task_title=capability_key.replace("_", " ").title()[:120],
            parent_thread_id=scope.thread_id,
            parent_message_id=scope.parent_message_id,
            parent_run_id=scope.parent_run_id,
            delegation_depth=1,
            routing_tier_override="worker",
            enforce_compact_contract=True,
            progress_callback=_bridge,
        ),
    )
    logger.info(
        "vcso worker (scoped) completed capability=%s run_id=%s status=%s",
        capability_key,
        getattr(result, "run_id", None),
        getattr(result, "status", None),
    )
    return _compact_result(result)
