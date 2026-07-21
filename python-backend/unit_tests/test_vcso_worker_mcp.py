"""Phase D2 (SDK-M2) — focused tests for the scoped worker executor core.

Covers the transport-agnostic heart of model-driven delegation (services/vcso_worker_mcp.py): the
per-turn scope registry and the founder-scoped worker executor that reuses SubAgentOrchestrator. The
FastMCP HTTP transport and the loop branch are validated live (see 04B-D2-M2-BUILD.md); this file locks
the parts that run without a CLI/network.
"""

from __future__ import annotations

import asyncio

import pytest

from services.sub_agent_orchestrator import SubAgentRunResult
import services.vcso_worker_mcp as core
from services.vcso_worker_mcp import (
    TurnRegistry,
    TurnScope,
    WorkerScopeError,
    WORKER_CAPABILITY_KEYS,
    run_worker_capability,
)


class _Orchestrator:
    """Fake SubAgentOrchestrator capturing the request the core builds."""

    calls: list = []

    def __init__(self, _store):
        pass

    def start_run(self, request):
        _Orchestrator.calls.append(request)
        return SubAgentRunResult(
            run_id="child-1",
            status="completed",
            result_summary="Concentration is 42%.",
            structured_result={"summary": "Concentration is 42%."},
            trace=[],
            citations=[{"source_kind": "wiki_page", "source_id": "financial_context"}],
        )


@pytest.fixture(autouse=True)
def _patch_orchestrator(monkeypatch):
    _Orchestrator.calls = []
    monkeypatch.setattr(core, "SubAgentOrchestrator", _Orchestrator)


def _scope(**over):
    base = dict(
        user_id="founder-1",
        parent_surface="virtual_cso",
        thread_id="thread-1",
        parent_run_id="parent-1",
        allowed_capabilities=frozenset({"structured_data_agent"}),
        store=object(),
    )
    base.update(over)
    return TurnScope(**base)


def _run(coro):
    return asyncio.run(coro)


def test_registry_mint_get_unregister():
    reg = TurnRegistry()
    token = reg.mint(_scope())
    assert reg.get(token) is not None
    assert reg.active_count() == 1
    reg.unregister(token)
    assert reg.get(token) is None
    assert reg.active_count() == 0


def test_registry_rejects_empty_and_unknown_tokens():
    reg = TurnRegistry()
    assert reg.get("") is None
    assert reg.get("not-a-real-token") is None


def test_registry_evicts_stale_scope(monkeypatch):
    reg = TurnRegistry()
    token = reg.mint(_scope())
    # Force the scope past the max age; get() must drop it rather than return a live founder scope.
    monkeypatch.setattr(core, "_MAX_SCOPE_AGE_SECONDS", -1.0)
    assert reg.get(token) is None


def test_unknown_token_is_refused():
    with pytest.raises(WorkerScopeError):
        _run(run_worker_capability("bad-token", "structured_data_agent", {"objective": "x"}, registry=TurnRegistry()))


def test_capability_not_permitted_is_refused():
    reg = TurnRegistry()
    token = reg.mint(_scope(allowed_capabilities=frozenset({"structured_data_agent"})))
    with pytest.raises(WorkerScopeError):
        _run(run_worker_capability(token, "sandbox_execution_agent", {"objective": "x"}, registry=reg))
    assert _Orchestrator.calls == []


def test_missing_objective_is_refused():
    reg = TurnRegistry()
    token = reg.mint(_scope())
    with pytest.raises(WorkerScopeError):
        _run(run_worker_capability(token, "structured_data_agent", {"objective": "  "}, registry=reg))


def test_app_owned_context_scope_overrides_model_authored_contract():
    """Which data a worker may read is a founder-isolation decision, so it comes from the app's
    native_subagent_scopes — never from the model-authored Task contract. Running on the contract alone
    left the worker reviewing 0 datasets (observed live, scripts/probe_worker_hop.py 2026-07-20)."""

    reg = TurnRegistry()
    token = reg.mint(
        _scope(context_scopes={"structured_data_agent": {"founder_dataset_ids": ["ds-real"]}})
    )
    _run(
        run_worker_capability(
            token,
            "structured_data_agent",
            {
                "objective": "bind the dataset",
                # The model tries to widen its own scope; the app's binding must win.
                "context_scope": {"founder_dataset_ids": ["ds-model-invented"], "note": "kept"},
            },
            registry=reg,
        )
    )
    sent = _Orchestrator.calls[0].context_scope
    assert sent["founder_dataset_ids"] == ["ds-real"]
    assert sent["note"] == "kept"  # non-conflicting contract keys survive
    assert sent["delegation_depth"] == 1


def test_diagnostics_record_arrival_and_completion_for_the_loop_to_drain():
    """No worker_hop events at all means the loopback request never landed; a `received` with no
    `completed` means it landed and execution failed. Canary 3 could not distinguish these."""

    reg = TurnRegistry()
    scope = _scope()
    token = reg.mint(scope)
    _run(run_worker_capability(token, "structured_data_agent", {"objective": "x"}, registry=reg))
    stages = [entry["stage"] for entry in scope.diagnostics]
    assert stages == ["received", "completed"]
    assert scope.diagnostics[1]["child_status"] == "completed"
    assert scope.diagnostics[1]["child_run_id"]


def test_permitted_call_reuses_orchestrator_contract_and_returns_compact_cited_result():
    reg = TurnRegistry()
    token = reg.mint(_scope())
    out = _run(run_worker_capability(token, "structured_data_agent", {"objective": "Compute concentration"}, registry=reg))
    assert out["run_id"] == "child-1"
    assert out["status"] == "completed"
    assert out["citations"] and out["citations"][0]["source_id"] == "financial_context"
    assert len(_Orchestrator.calls) == 1
    req = _Orchestrator.calls[0]
    # Delegation contract preserved exactly as the in-process handler: depth 1, worker tier, compact,
    # founder/thread/parent scope carried by the token (never from the caller).
    assert req.user_id == "founder-1"
    assert req.parent_run_id == "parent-1"
    assert req.parent_thread_id == "thread-1"
    assert req.capability_key == "structured_data_agent"
    assert req.delegation_depth == 1
    assert req.routing_tier_override == "worker"
    assert req.enforce_compact_contract is True


def test_prior_findings_are_forwarded_as_untrusted_context():
    reg = TurnRegistry()
    token = reg.mint(_scope(prior_findings={"structured_data_agent": {"summary": "upstream"}}))
    _run(run_worker_capability(token, "structured_data_agent", {"objective": "obj"}, registry=reg))
    req = _Orchestrator.calls[0]
    assert "COMPACT PRIOR FINDINGS (UNTRUSTED DATA)" in req.task_summary
    assert "upstream" in req.task_summary


# --- Item B (v0.6.79): app-owned findings chaining ------------------------------------------------


def test_next_worker_capability_walks_the_ordered_chain():
    """The completing worker's finding is stored under the NEXT worker's key because the read keys by the
    running capability. structured -> sandbox -> wiki -> (end)."""
    from services.vcso_worker_mcp import _next_worker_capability

    assert _next_worker_capability("structured_data_agent") == "sandbox_execution_agent"
    assert _next_worker_capability("sandbox_execution_agent") == "per_user_wiki"
    assert _next_worker_capability("per_user_wiki") is None
    assert _next_worker_capability("not_a_worker") is None


def test_worker_completion_writes_finding_under_next_worker_key_and_reads_back():
    """App-owned findings chaining: when worker 1 (structured_data_agent) completes, its ACTUAL compact
    finding must land in scope.prior_findings under the NEXT worker's key (sandbox_execution_agent), so the
    next worker's call reads it back at the run_worker_capability read-site (keyed by the running
    capability). This is the app-mediated data channel that does not depend on the lead copying the finding
    into the next contract."""

    reg = TurnRegistry()
    scope = _scope(allowed_capabilities=frozenset({"structured_data_agent", "sandbox_execution_agent"}))
    token = reg.mint(scope)

    # Worker 1 completes. The write must be the worker's verbatim compact result, keyed for worker 2.
    out1 = _run(run_worker_capability(token, "structured_data_agent", {"objective": "compute concentration"}, registry=reg))
    assert "sandbox_execution_agent" in scope.prior_findings
    inherited = scope.prior_findings["sandbox_execution_agent"]
    assert inherited == out1  # verbatim compact result, not a model-authored copy
    assert inherited["status"] == "completed"
    assert inherited["citations"][0]["source_id"] == "financial_context"
    # No self-keyed leak: structured must not inherit its own finding.
    assert "structured_data_agent" not in scope.prior_findings

    # Worker 2 (sandbox) now runs and reads the inherited finding back via the :207 read path.
    _run(run_worker_capability(token, "sandbox_execution_agent", {"objective": "compute trend"}, registry=reg))
    sandbox_req = _Orchestrator.calls[-1]
    assert "COMPACT PRIOR FINDINGS (UNTRUSTED DATA)" in sandbox_req.task_summary
    assert "Concentration is 42%." in sandbox_req.task_summary


def test_model_authored_prior_findings_in_contract_are_discarded_for_the_app_copy():
    """Reconciliation: a lead-authored prior_findings copied into the worker tool's context_scope must NOT
    reach the orchestrator context_scope — the app-mediated scope.prior_findings is the sole authoritative
    channel (dedupe/prefer the app copy). The app copy still reaches the worker via task_summary."""

    reg = TurnRegistry()
    token = reg.mint(_scope(prior_findings={"structured_data_agent": {"summary": "app-authoritative"}}))
    _run(
        run_worker_capability(
            token,
            "structured_data_agent",
            {
                "objective": "obj",
                "context_scope": {"prior_findings": {"summary": "lead-copy-STALE"}, "note": "kept"},
            },
            registry=reg,
        )
    )
    req = _Orchestrator.calls[0]
    # The lead's copy is stripped from the orchestrator context_scope...
    assert "prior_findings" not in req.context_scope
    assert req.context_scope["note"] == "kept"  # non-conflicting contract keys survive
    # ...and only the app-authoritative finding is injected into the worker prompt.
    assert "app-authoritative" in req.task_summary
    assert "lead-copy-STALE" not in req.task_summary


# --- Item 1 (v0.6.84): duplicate dispatch idempotency (defect #4) ---------------------------------


def test_resent_tools_call_does_not_start_a_second_run():
    """Canary 8's wart: the CLI re-sent the same `tools/call` and a SECOND `start_run` fired
    (`per_user_wiki` children 76e36f48… and db140287… both completed). A re-send must now replay the first
    run's compact result, so exactly one worker is ever started per (token, capability_key)."""

    reg = TurnRegistry()
    scope = _scope()
    token = reg.mint(scope)

    first = _run(run_worker_capability(token, "structured_data_agent", {"objective": "compute concentration"}, registry=reg))
    second = _run(run_worker_capability(token, "structured_data_agent", {"objective": "compute concentration"}, registry=reg))

    assert len(_Orchestrator.calls) == 1  # the whole point: one start_run, not two
    assert second == first
    assert second is not first  # a copy, so the lead cannot corrupt the cached finding
    stages = [entry["stage"] for entry in scope.diagnostics]
    assert stages == ["received", "completed", "received", "deduped"]
    assert scope.diagnostics[-1]["same_objective"] is True


def test_concurrent_duplicate_dispatch_is_coalesced_not_raced():
    """A duplicate that lands while the first dispatch is still in flight must WAIT on the dispatch lock and
    then read the cache — otherwise the cache-only check would miss it and both would run (which is exactly
    the timing a re-sent tools/call after a slow worker produces)."""

    async def _both():
        reg = TurnRegistry()
        token = reg.mint(_scope())
        return await asyncio.gather(
            run_worker_capability(token, "structured_data_agent", {"objective": "obj"}, registry=reg),
            run_worker_capability(token, "structured_data_agent", {"objective": "obj"}, registry=reg),
        )

    out_a, out_b = _run(_both())
    assert len(_Orchestrator.calls) == 1
    assert out_a == out_b


def test_dedupe_is_scoped_per_capability_and_per_token():
    """The dedupe key is (token, capability_key): a different capability under the same turn still runs, and
    a different turn's token runs its own worker. Coalescing must never suppress real work."""

    reg = TurnRegistry()
    token = reg.mint(_scope(allowed_capabilities=frozenset({"structured_data_agent", "per_user_wiki"})))
    _run(run_worker_capability(token, "structured_data_agent", {"objective": "a"}, registry=reg))
    _run(run_worker_capability(token, "per_user_wiki", {"objective": "b"}, registry=reg))
    assert len(_Orchestrator.calls) == 2

    other_token = reg.mint(_scope())
    _run(run_worker_capability(other_token, "structured_data_agent", {"objective": "a"}, registry=reg))
    assert len(_Orchestrator.calls) == 3


def test_failed_dispatch_is_not_cached_so_a_real_retry_still_runs(monkeypatch):
    """Only successful completions are cached. A worker that raised must be retryable — the dedupe exists to
    suppress waste, never to suppress recovery."""

    reg = TurnRegistry()
    scope = _scope()
    token = reg.mint(scope)

    class _Failing(_Orchestrator):
        def start_run(self, request):
            _Orchestrator.calls.append(request)
            raise RuntimeError("worker blew up")

    monkeypatch.setattr(core, "SubAgentOrchestrator", _Failing)
    with pytest.raises(RuntimeError):
        _run(run_worker_capability(token, "structured_data_agent", {"objective": "x"}, registry=reg))
    assert "structured_data_agent" not in scope.completed_results

    monkeypatch.setattr(core, "SubAgentOrchestrator", _Orchestrator)
    out = _run(run_worker_capability(token, "structured_data_agent", {"objective": "x"}, registry=reg))
    assert out["status"] == "completed"
    assert len(_Orchestrator.calls) == 2  # the failure attempt + the real retry


def test_dedupe_does_not_double_write_the_chained_finding():
    """Findings chaining is app-owned and written once on completion. A replay must not re-run the write
    path (and must not clobber a downstream worker's inherited finding with a stale copy)."""

    reg = TurnRegistry()
    scope = _scope(allowed_capabilities=frozenset({"structured_data_agent", "sandbox_execution_agent"}))
    token = reg.mint(scope)

    _run(run_worker_capability(token, "structured_data_agent", {"objective": "compute"}, registry=reg))
    inherited = scope.prior_findings["sandbox_execution_agent"]
    _run(run_worker_capability(token, "structured_data_agent", {"objective": "compute"}, registry=reg))
    assert scope.prior_findings["sandbox_execution_agent"] is inherited


def test_capability_keys_match_loop_required_agents():
    # No drift between the tools the external server exposes and the loop's P4 contract.
    from services.vcso_sdk_loop import P4_THIN_SLICE_REQUIRED_AGENTS

    assert set(WORKER_CAPABILITY_KEYS) == set(P4_THIN_SLICE_REQUIRED_AGENTS)


# --- Phase D2 loop helpers: inverted manifest + DB completion bridge -------------------------------

from types import SimpleNamespace

from services.vcso_sdk_loop import (  # noqa: E402
    build_model_driven_manifest,
    model_driven_completed_children,
)


def _compiled(*, allowed_tools, mcp_servers, agent_servers, tools=("Task",), disallowed_tools=(), agent_tools=None):
    agent_tools = agent_tools or {}
    agents = {
        key: SimpleNamespace(mcpServers=servers, tools=list(agent_tools.get(key, [])))
        for key, servers in agent_servers.items()
    }
    options = SimpleNamespace(
        tools=list(tools),
        allowed_tools=allowed_tools,
        disallowed_tools=list(disallowed_tools),
        mcp_servers=mcp_servers,
        agents=agents,
    )
    return SimpleNamespace(options=options)


def test_model_driven_manifest_flags_delegation_tool_disallowed_by_runtime_name():
    """The second canary's cause: v0.6.69 provisioned the delegation tool but exempted only the PROVISION
    name from DISALLOWED_SDK_BUILTINS, leaving the RUNTIME name ("Agent") blocked. The lead then held a
    delegation tool it was forbidden to call and stalled to max_turns, while the manifest — which never
    inspected disallowed_tools — reported the surface clean."""

    compiled = _compiled(
        tools=["Task"],
        allowed_tools=["Task"],
        disallowed_tools=["Bash", "Agent"],  # production's list with only "Task" exempted
        mcp_servers={"architectos": {"tools": []}},
        agent_servers={"structured_data_agent": [{"vcso_workers": {"type": "http", "url": "http://x/?t=1"}}]},
    )
    manifest = build_model_driven_manifest(
        compiled, required_agents=("structured_data_agent",), worker_server_name="vcso_workers"
    )
    assert "model_driven_delegation_tool_disallowed:Agent" in manifest["violations"]


def test_model_driven_manifest_flags_delegation_tool_not_provisioned():
    """The Stage H false-green: `tools=[]` disables every built-in, so the lead can be permitted to
    delegate while holding no delegation tool at all — it then narrates fake tool calls to max_turns.
    The old manifest only inspected allowed_tools and reported this surface clean."""

    compiled = _compiled(
        tools=[],  # production's pre-fix value
        allowed_tools=["Task"],
        mcp_servers={"architectos": {"tools": []}},
        agent_servers={"structured_data_agent": [{"vcso_workers": {"type": "http", "url": "http://x/?t=1"}}]},
    )
    manifest = build_model_driven_manifest(
        compiled, required_agents=("structured_data_agent",), worker_server_name="vcso_workers"
    )
    assert "model_driven_delegation_tool_not_provisioned" in manifest["violations"]


def test_model_driven_manifest_passes_clean_scoped_surface():
    # FIXED surface: worker handler pre-approved on the lead's allowed_tools, scoped to the per-agent
    # external server, and NOT present in the lead's `tools` availability list or top-level mcp_servers.
    compiled = _compiled(
        allowed_tools=["Task", "mcp__vcso_workers__run_structured_data_agent"],
        mcp_servers={"architectos": {"tools": []}},
        agent_servers={"structured_data_agent": [{"vcso_workers": {"type": "http", "url": "http://x/?t=1"}}]},
        agent_tools={"structured_data_agent": ["mcp__vcso_workers__run_structured_data_agent"]},
    )
    manifest = build_model_driven_manifest(
        compiled, required_agents=("structured_data_agent",), worker_server_name="vcso_workers"
    )
    assert manifest["violations"] == []
    assert manifest["delegation_model"] == "model_driven"


def test_model_driven_manifest_flags_worker_handler_not_preapproved():
    """The v0.6.74 production defect: the worker handler was scoped to the agent but ABSENT from the parent
    allowed_tools, so under permission_mode="dontAsk" the subagent's CallToolRequest was silently denied —
    ListTools returned 200 but zero calls reached the worker. The gate must catch this before a canary."""

    compiled = _compiled(
        allowed_tools=["Task"],  # handler NOT pre-approved on the lead
        mcp_servers={"architectos": {"tools": []}},
        agent_servers={"structured_data_agent": [{"vcso_workers": {"type": "http", "url": "http://x/?t=1"}}]},
        agent_tools={"structured_data_agent": ["mcp__vcso_workers__run_structured_data_agent"]},
    )
    manifest = build_model_driven_manifest(
        compiled, required_agents=("structured_data_agent",), worker_server_name="vcso_workers"
    )
    assert (
        "worker_handler_not_preapproved:mcp__vcso_workers__run_structured_data_agent"
        in manifest["violations"]
    )


def test_model_driven_manifest_flags_worker_handler_in_lead_availability():
    """Isolation lock, real surface: a worker handler in the lead's `tools` AVAILABILITY list would hand the
    LEAD the handler to call directly, collapsing delegation. Pre-approval in allowed_tools is required and
    correct; the availability list must carry only the delegation built-in."""

    compiled = _compiled(
        tools=["Task", "mcp__vcso_workers__run_structured_data_agent"],
        allowed_tools=["Task", "mcp__vcso_workers__run_structured_data_agent"],
        mcp_servers={"architectos": {"tools": []}},
        agent_servers={"structured_data_agent": [{"vcso_workers": {"type": "http", "url": "http://x/?t=1"}}]},
        agent_tools={"structured_data_agent": ["mcp__vcso_workers__run_structured_data_agent"]},
    )
    manifest = build_model_driven_manifest(
        compiled, required_agents=("structured_data_agent",), worker_server_name="vcso_workers"
    )
    assert (
        "model_driven_worker_tool_in_lead_availability:mcp__vcso_workers__run_structured_data_agent"
        in manifest["violations"]
    )


def test_model_driven_manifest_flags_worker_server_registered_top_level():
    compiled = _compiled(
        allowed_tools=["Task"],
        mcp_servers={"vcso_workers": {"tools": [{"name": "run_structured_data_agent"}]}},
        agent_servers={"structured_data_agent": [{"vcso_workers": {"type": "http", "url": "http://x/?t=1"}}]},
    )
    manifest = build_model_driven_manifest(
        compiled, required_agents=("structured_data_agent",), worker_server_name="vcso_workers"
    )
    assert any(v == "model_driven_worker_server_top_level" for v in manifest["violations"])
    assert any(v.startswith("model_driven_worker_tool_top_level") for v in manifest["violations"])


def test_model_driven_manifest_flags_unscoped_worker_agent():
    compiled = _compiled(
        allowed_tools=["Task"],
        mcp_servers={},
        agent_servers={"structured_data_agent": ["architectos"]},  # in-process ref, not external
    )
    manifest = build_model_driven_manifest(
        compiled, required_agents=("structured_data_agent",), worker_server_name="vcso_workers"
    )
    assert any(v == "model_driven_worker_server_not_scoped:structured_data_agent" for v in manifest["violations"])


class _CompletionClient:
    def __init__(self, rows):
        self._rows = rows
        self._filters = {}

    def table(self, _name):
        return self

    def select(self, _cols):
        return self

    def eq(self, key, value):
        self._filters[key] = value
        return self

    def execute(self):
        rows = [r for r in self._rows if r.get("status") == self._filters.get("status", r.get("status"))]
        return SimpleNamespace(data=rows)


def test_completion_bridge_counts_parent_linked_completed_children():
    client = _CompletionClient(
        [
            {"capability_key": "structured_data_agent", "status": "completed"},
            {"capability_key": "per_user_wiki", "status": "completed"},
            {"capability_key": "unrelated_agent", "status": "completed"},
        ]
    )
    done = model_driven_completed_children(
        client, parent_run_id="parent-1", required_agents=("structured_data_agent", "per_user_wiki")
    )
    assert done == {"structured_data_agent", "per_user_wiki"}


def test_completion_bridge_is_empty_without_parent_run_id():
    assert model_driven_completed_children(object(), parent_run_id=None, required_agents=("x",)) == set()
