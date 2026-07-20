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


def _compiled(*, allowed_tools, mcp_servers, agent_servers, tools=("Task",), disallowed_tools=()):
    agents = {key: SimpleNamespace(mcpServers=servers) for key, servers in agent_servers.items()}
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
    compiled = _compiled(
        allowed_tools=["Task"],
        mcp_servers={"architectos": {"tools": []}},
        agent_servers={"structured_data_agent": [{"vcso_workers": {"type": "http", "url": "http://x/?t=1"}}]},
    )
    manifest = build_model_driven_manifest(
        compiled, required_agents=("structured_data_agent",), worker_server_name="vcso_workers"
    )
    assert manifest["violations"] == []
    assert manifest["delegation_model"] == "model_driven"


def test_model_driven_manifest_flags_worker_tool_leaked_to_lead():
    compiled = _compiled(
        allowed_tools=["Task", "mcp__vcso_workers__run_structured_data_agent"],
        mcp_servers={},
        agent_servers={"structured_data_agent": [{"vcso_workers": {"type": "http", "url": "http://x/?t=1"}}]},
    )
    manifest = build_model_driven_manifest(
        compiled, required_agents=("structured_data_agent",), worker_server_name="vcso_workers"
    )
    assert any(v.startswith("model_driven_worker_tool_on_lead") for v in manifest["violations"])


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
