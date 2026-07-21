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
    # APP-OWNED data scope per capability (Path A's `native_subagent_scopes`). The model authors the Task
    # contract, so its `context_scope` carries intent but NOT the founder's dataset/thread bindings — a
    # model-driven worker running on the contract alone reviews 0 datasets and returns "no sources"
    # (observed 2026-07-20 in scripts/probe_worker_hop.py). Which data a worker may read is a founder-
    # isolation decision and must come from the app, never from model-authored text.
    context_scopes: dict[str, dict[str, Any]] = field(default_factory=dict)
    # DARK, FOUNDER-ONLY fault injection (Tier 3, v0.6.85). Capabilities named here are forced to fail
    # instead of running, so the v0.6.81 graceful-compose safety net can be exercised on a live canary
    # without breaking anything real. Populated only from the `vcso_sdk_loop` diagnostic sub-flag under the
    # existing founder allowlist; empty on every other path, so this is inert by construction.
    fault_injection_capabilities: frozenset[str] = field(default_factory=frozenset)
    # Same-process diagnostics drained by the loop after the query. The endpoint runs in a separate
    # request context and cannot reach `record_lifecycle`, so without this a worker call that never
    # arrives is indistinguishable from one that arrived and failed — which is precisely what canary 3
    # could not tell us.
    diagnostics: list[dict[str, Any]] = field(default_factory=list)
    # Optional bridge back into the live turn for the C2 nested-UI + citations surface. Signature mirrors
    # the in-process emit_worker_progress. None during the bare visibility probe (surface hold is M4).
    progress_bridge: Callable[[str, dict[str, Any]], None] | None = None
    # --- Dispatch idempotency (defect #4, v0.6.84) -------------------------------------------------
    # The compact result of each capability that has already COMPLETED under this token. A re-sent
    # `tools/call` for the same (token, capability_key) replays this instead of starting a second
    # `start_run`. Only successful completions are cached: a failed attempt leaves no entry, so a genuine
    # retry after a failure still runs.
    completed_results: dict[str, dict[str, Any]] = field(default_factory=dict)
    # The objective the FIRST accepted dispatch of each capability ran with, kept only so a replay whose
    # objective differs is visible in the logs rather than silently swallowed.
    dispatched_objectives: dict[str, str] = field(default_factory=dict)
    # One asyncio.Lock per capability. A duplicate that arrives while the first dispatch is still in
    # flight waits here and then reads the cache, so the coalesce holds for the concurrent case too — not
    # just the after-the-fact case. Lazily built (see `dispatch_lock_for`); py>=3.10 Locks bind no loop at
    # construction, and the loopback endpoint and the turn share this process's single event loop.
    dispatch_locks: dict[str, asyncio.Lock] = field(default_factory=dict)
    created_at: float = field(default_factory=time.monotonic)

    def dispatch_lock_for(self, capability_key: str) -> asyncio.Lock:
        lock = self.dispatch_locks.get(capability_key)
        if lock is None:
            lock = asyncio.Lock()
            self.dispatch_locks[capability_key] = lock
        return lock


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


class WorkerFaultInjected(RuntimeError):
    """Raised INSTEAD of running a worker when that capability is named in the dark fault-injection
    sub-flag. A RuntimeError (not a WorkerScopeError) on purpose: the failure we need to rehearse is a
    worker blowing up mid-run, not a scope refusal, and the transport maps both to the same `is_error`
    the lead would see from a genuinely broken worker."""


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


def _next_worker_capability(capability_key: str) -> str | None:
    """The capability that FOLLOWS `capability_key` in the ordered thin-slice chain (WORKER_CAPABILITY_KEYS
    is kept in P4_THIN_SLICE_REQUIRED_AGENTS order), or None if this is the last worker. A completing
    worker's compact finding is stored under this NEXT key because the next worker reads its inherited
    finding via ``scope.prior_findings.get(<its own capability_key>)`` — see the read in
    run_worker_capability. This is the app-owned data channel that makes findings chain deterministically,
    independent of whether the lead copied the finding into the next Task contract."""

    try:
        idx = WORKER_CAPABILITY_KEYS.index(capability_key)
    except ValueError:
        return None
    return WORKER_CAPABILITY_KEYS[idx + 1] if idx + 1 < len(WORKER_CAPABILITY_KEYS) else None


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
    # From here the scope is known, so every outcome is recorded for the loop to drain. The mere presence
    # of a "received" entry proves the loopback request reached this endpoint at all.
    scope.diagnostics.append({"stage": "received", "capability_key": capability_key})
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

    # Dispatch idempotency (defect #4). Canary 8 dispatched `per_user_wiki` twice: the CLI re-sent the
    # same `tools/call`, and because every call ran unconditionally that started a SECOND `start_run`.
    # Both children completed and the answer was unaffected, but the founder paid for a duplicate worker.
    # Coalescing on (token, capability_key) makes the dispatch idempotent for the whole life of the turn
    # scope: the lock serialises a duplicate that lands mid-flight, and the completed-result cache answers
    # both it and any later re-send with the FIRST run's compact result. See `completed_results`.
    async with scope.dispatch_lock_for(capability_key):
        cached = scope.completed_results.get(capability_key)
        if cached is not None:
            first_objective = scope.dispatched_objectives.get(capability_key, "")
            logger.info(
                "vcso worker dispatch deduped capability=%s run_id=%s (objective %s)",
                capability_key,
                cached.get("run_id"),
                "identical" if objective == first_objective else "DIFFERS from the first dispatch",
            )
            scope.diagnostics.append(
                {
                    "stage": "deduped",
                    "capability_key": capability_key,
                    "child_run_id": cached.get("run_id"),
                    "same_objective": objective == first_objective,
                }
            )
            # A copy, so the lead mutating its tool result cannot corrupt the cached finding.
            return dict(cached)
        scope.dispatched_objectives[capability_key] = objective
        return await _dispatch_worker_capability(scope, capability_key, objective, args)


async def _dispatch_worker_capability(
    scope: TurnScope, capability_key: str, objective: str, args: dict[str, Any]
) -> dict[str, Any]:
    """Run one worker for real. Called only by `run_worker_capability`, and only once per
    (token, capability_key) that reaches completion — it holds that capability's dispatch lock."""

    if capability_key in scope.fault_injection_capabilities:
        # Fail BEFORE start_run: no child row is written, so the DB completion bridge genuinely reports
        # this worker missing and the stop_hook / terminal check face a real absence, not a simulated one.
        logger.warning("vcso worker FAULT-INJECTED (dark diagnostic) capability=%s", capability_key)
        scope.diagnostics.append({"stage": "fault_injected", "capability_key": capability_key})
        raise WorkerFaultInjected(
            f"Fault injection: {capability_key} was forced to fail for this diagnostic turn."
        )

    # App-owned bindings win over anything the model wrote into the contract: the contract may express
    # intent, but the founder's dataset/thread scope is not the model's to choose.
    requested_scope = args.get("context_scope") if isinstance(args.get("context_scope"), dict) else {}
    app_scope = scope.context_scopes.get(capability_key) or {}
    context_scope: dict[str, Any] = {**requested_scope, **app_scope, "delegation_depth": 1}
    # Findings chaining is app-owned. The authoritative prior finding is the app-mediated
    # scope.prior_findings entry read just below (written verbatim from the upstream worker's own compact
    # result on completion). Discard any prior_findings the model copied into the contract's context_scope
    # so a lead-authored copy cannot double-flow alongside — or silently override — the app copy. This is
    # the same reconciliation Path A's in-process handler performs (vcso_sdk_loop pops "prior_findings"
    # from context_scope). The lead still authors the next worker's OBJECTIVE; the app owns the DATA.
    context_scope.pop("prior_findings", None)
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
    try:
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
    except Exception as exc:  # noqa: BLE001 - record then re-raise; the transport maps this to is_error
        scope.diagnostics.append(
            {"stage": "error", "capability_key": capability_key, "error": f"{type(exc).__name__}: {exc}"[:300]}
        )
        raise
    logger.info(
        "vcso worker (scoped) completed capability=%s run_id=%s status=%s",
        capability_key,
        getattr(result, "run_id", None),
        getattr(result, "status", None),
    )
    scope.diagnostics.append(
        {
            "stage": "completed",
            "capability_key": capability_key,
            "child_run_id": getattr(result, "run_id", None),
            "child_status": getattr(result, "status", None),
        }
    )
    compact = _compact_result(result)
    # Findings chaining (app-owned): write this worker's compact finding where the NEXT worker in the
    # ordered chain reads it (scope.prior_findings keyed by the running capability, read above). This runs
    # in the same process and on the SAME scope instance the next worker's loopback call recovers from the
    # registry, and stores the worker's ACTUAL _compact_result verbatim — never a model-authored copy — so
    # the finding DATA is guaranteed present for the next worker regardless of what the lead wrote into its
    # contract. Founder-scoped already (the founder's own worker under this turn token); no scope widening.
    next_key = _next_worker_capability(capability_key)
    if next_key is not None:
        scope.prior_findings[next_key] = compact
    # Cache LAST, and only on success: a raised dispatch leaves no entry, so a genuine retry after a
    # failure still runs a real worker (the dedupe suppresses waste, never recovery).
    scope.completed_results[capability_key] = compact
    return compact
