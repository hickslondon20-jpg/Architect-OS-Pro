"""Phase D2 (Tier 3) — focused tests for the graceful-failure path.

Two halves, both from `04B-D2-TIER2-CLOSE-HANDOFF.md` §4 item 2:

1. **Fault injection** (`native_fault_injection_capabilities` + `TurnScope.fault_injection_capabilities`) —
   the mechanism that lets a live canary force a required worker to fail, so the v0.6.81 DB-completion
   safety net is exercised instead of shipped untested. Gating is the point of most of these tests: it must
   be impossible to arm on anything but an allowlisted founder's model-driven turn.
2. **Partial-answer surface** (`_failed_turn_message` + `_completed_child_findings`) — a degraded turn now
   shows the founder what DID complete instead of a blanket "I couldn't complete that response".

The live fault-injection canary itself is recorded separately; this file locks the parts that run without
a CLI, a network, or a deploy.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

import services.vcso_worker_mcp as core
from services.sub_agent_orchestrator import SubAgentRunResult
from services.vcso_chat_service import (
    VcsoChatService,
    _failed_turn_message,
    _failure_trace_step,
    _strip_citation_markers,
)
from services.vcso_sdk_loop import native_fault_injection_capabilities
from services.vcso_worker_mcp import (
    TurnRegistry,
    TurnScope,
    WorkerFaultInjected,
    run_worker_capability,
)

REQUIRED = ("structured_data_agent", "sandbox_execution_agent", "per_user_wiki")
FOUNDER = "cd490873-99aa-4533-9240-f0aa04deb54f"


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Fault-injection gating
# ═══════════════════════════════════════════════════════════════════════════════


def _settings(**over):
    base = {
        "diagnostic_fault_injection_enabled": True,
        "diagnostic_user_ids": [FOUNDER],
        "diagnostic_fault_injection_workers": ["sandbox_execution_agent"],
    }
    base.update(over)
    return base


def test_fault_injection_arms_for_an_allowlisted_founder():
    assert native_fault_injection_capabilities(
        settings=_settings(), user_id=FOUNDER, required_agents=REQUIRED
    ) == ("sandbox_execution_agent",)


@pytest.mark.parametrize(
    "override",
    [
        {"diagnostic_fault_injection_enabled": False},  # not explicitly enabled
        {"diagnostic_user_ids": []},  # nobody allowlisted
        {"diagnostic_user_ids": ["4ef8ffff-0000-0000-0000-000000000000"]},  # a DIFFERENT founder
        {"diagnostic_fault_injection_workers": []},  # enabled but nothing named
        {"diagnostic_fault_injection_workers": ["not_a_required_worker"]},  # not in this turn's set
    ],
)
def test_fault_injection_stays_disarmed_unless_every_gate_is_met(override):
    assert (
        native_fault_injection_capabilities(
            settings=_settings(**override), user_id=FOUNDER, required_agents=REQUIRED
        )
        == ()
    )


def test_fault_injection_refuses_to_fail_every_required_worker():
    """A turn with nothing left to compose from is a total failure, not the graceful-degradation case we
    are rehearsing — the safety net would have no completed children to compose from."""

    assert (
        native_fault_injection_capabilities(
            settings=_settings(diagnostic_fault_injection_workers=list(REQUIRED)),
            user_id=FOUNDER,
            required_agents=REQUIRED,
        )
        == ()
    )


def test_fault_injection_is_disarmed_for_an_anonymous_turn():
    assert native_fault_injection_capabilities(settings=_settings(), user_id=None, required_agents=REQUIRED) == ()
    assert native_fault_injection_capabilities(settings=None, user_id=FOUNDER, required_agents=REQUIRED) == ()


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Fault injection at the worker hop
# ═══════════════════════════════════════════════════════════════════════════════


class _Orchestrator:
    calls: list = []

    def __init__(self, _store):
        pass

    def start_run(self, request):
        _Orchestrator.calls.append(request)
        return SubAgentRunResult(
            run_id="child-1",
            status="completed",
            result_summary="Concentration is 42%.",
            structured_result={},
            trace=[],
            citations=[],
        )


@pytest.fixture(autouse=True)
def _patch_orchestrator(monkeypatch):
    _Orchestrator.calls = []
    monkeypatch.setattr(core, "SubAgentOrchestrator", _Orchestrator)


def _scope(**over):
    base = dict(
        user_id=FOUNDER,
        parent_surface="virtual_cso",
        allowed_capabilities=frozenset(REQUIRED),
        store=object(),
    )
    base.update(over)
    return TurnScope(**base)


def test_injected_capability_fails_without_ever_starting_a_run():
    """The failure must land BEFORE start_run so no child row is written — otherwise the DB completion
    bridge would report the worker completed and the canary would rehearse nothing."""

    reg = TurnRegistry()
    scope = _scope(fault_injection_capabilities=frozenset({"sandbox_execution_agent"}))
    token = reg.mint(scope)

    with pytest.raises(WorkerFaultInjected):
        asyncio.run(run_worker_capability(token, "sandbox_execution_agent", {"objective": "x"}, registry=reg))

    assert _Orchestrator.calls == []
    assert [entry["stage"] for entry in scope.diagnostics] == ["received", "fault_injected"]
    assert "sandbox_execution_agent" not in scope.completed_results


def test_uninjected_capabilities_on_the_same_turn_still_run():
    """Only the named worker fails. The others must complete normally — those completed children are
    exactly what the graceful compose is supposed to fall back on."""

    reg = TurnRegistry()
    scope = _scope(fault_injection_capabilities=frozenset({"sandbox_execution_agent"}))
    token = reg.mint(scope)

    out = asyncio.run(run_worker_capability(token, "structured_data_agent", {"objective": "x"}, registry=reg))
    assert out["status"] == "completed"
    assert len(_Orchestrator.calls) == 1


def test_default_scope_injects_nothing():
    """Inert by construction: the field is empty on every path that does not explicitly arm it."""

    assert TurnScope(user_id="u", parent_surface="virtual_cso").fault_injection_capabilities == frozenset()


# ═══════════════════════════════════════════════════════════════════════════════
# 3. Partial-answer surface
# ═══════════════════════════════════════════════════════════════════════════════


def test_failed_turn_message_without_partials_is_unchanged():
    """Regression guard: with nothing completed the founder sees exactly the previous copy."""

    assert _failed_turn_message("failed") == (
        "I couldn't complete that response. Your request was saved; please try again."
    )
    assert _failed_turn_message("cancelled") == (
        "This response was interrupted before it could finish. Please try again."
    )


def test_failed_turn_message_with_partials_shows_what_completed():
    partials = [
        {"capability_key": "structured_data_agent", "title": "Structured Data Agent", "summary": "Top two clients are 41% of the book."},
        {"capability_key": "per_user_wiki", "title": "Per User Wiki", "summary": "Net margin is 18.5%."},
    ]
    message = _failed_turn_message("failed", partials=partials)
    assert "Structured Data Agent" in message
    assert "41% of the book" in message
    assert "Net margin is 18.5%." in message
    assert "treat this as partial" in message
    # The binary apology must NOT be what the founder reads when real work survived.
    assert "I couldn't complete that response." not in message


def test_cancelled_turn_with_partials_keeps_the_interrupted_framing():
    message = _failed_turn_message(
        "cancelled",
        partials=[{"capability_key": "per_user_wiki", "title": "Per User Wiki", "summary": "Churn is 2.5%."}],
    )
    assert "interrupted" in message
    assert "Churn is 2.5%." in message


def test_citation_markers_are_stripped_from_partials():
    """A degraded turn is written with citations=[], so a surviving `[3]` would render a reference the
    founder cannot open."""

    assert _strip_citation_markers("Revenue is $45K [3] per month.") == "Revenue is $45K per month."
    assert (
        _strip_citation_markers("Margin held [[Source: raw_document:abc#chunk:1|Q3 P&L]] at 71%.")
        == "Margin held at 71%."
    )


def test_failure_trace_step_reports_the_completed_workers():
    step = _failure_trace_step(
        step_index=7,
        terminal_status="failed",
        partials=[{"capability_key": "per_user_wiki", "title": "Per User Wiki", "summary": "Churn is 2.5%."}],
    )
    assert step["title"] == "Partial answer"
    assert '"completed_workers": ["per_user_wiki"]' in step["output"]
    assert _failure_trace_step(step_index=7, terminal_status="failed")["title"] == "Response interrupted"


# --- _completed_child_findings ---------------------------------------------------------------------


class _ChildRunsClient:
    """Minimal supabase double for the parent-linked completed-children read."""

    def __init__(self, rows, *, raises=False):
        self._rows = rows
        self._raises = raises
        self.filters: dict[str, str] = {}

    def table(self, _name):
        return self

    def select(self, _cols):
        return self

    def eq(self, key, value):
        self.filters[key] = value
        return self

    def execute(self):
        if self._raises:
            raise RuntimeError("supabase down")
        rows = [
            row
            for row in self._rows
            if all(str(row.get(key, self.filters[key])) == str(self.filters[key]) for key in self.filters)
        ]
        return SimpleNamespace(data=rows)


def _findings(rows, *, run_id="parent-1", raises=False):
    client = _ChildRunsClient(rows, raises=raises)
    service = SimpleNamespace(supabase=client)
    return VcsoChatService._completed_child_findings(service, run_id, FOUNDER)


def test_completed_child_findings_returns_completion_ordered_titled_summaries():
    out = _findings(
        [
            {"capability_key": "per_user_wiki", "status": "completed", "user_id": FOUNDER, "parent_run_id": "parent-1", "result_summary": "Net margin 18.5%. [2]", "completed_at": "2026-07-21T10:00:02Z"},
            {"capability_key": "structured_data_agent", "status": "completed", "user_id": FOUNDER, "parent_run_id": "parent-1", "result_summary": "Top two clients 41%.", "completed_at": "2026-07-21T10:00:01Z"},
        ]
    )
    assert [item["capability_key"] for item in out] == ["structured_data_agent", "per_user_wiki"]
    assert out[0]["title"] == "Structured Data Agent"
    assert out[1]["summary"] == "Net margin 18.5%."  # marker stripped


def test_completed_child_findings_dedupes_a_duplicate_dispatch():
    """Defect #4 produced two completed `per_user_wiki` children on one turn. The founder must not read the
    same finding twice, even on a build that predates the dispatch dedupe."""

    rows = [
        {"capability_key": "per_user_wiki", "status": "completed", "user_id": FOUNDER, "parent_run_id": "parent-1", "result_summary": "Net margin 18.5%.", "completed_at": "2026-07-21T10:00:01Z"},
        {"capability_key": "per_user_wiki", "status": "completed", "user_id": FOUNDER, "parent_run_id": "parent-1", "result_summary": "Net margin 18.5%.", "completed_at": "2026-07-21T10:00:03Z"},
    ]
    assert len(_findings(rows)) == 1


def test_completed_child_findings_is_founder_scoped_and_parent_scoped():
    client = _ChildRunsClient([])
    VcsoChatService._completed_child_findings(SimpleNamespace(supabase=client), "parent-1", FOUNDER)
    assert client.filters == {"parent_run_id": "parent-1", "user_id": FOUNDER, "status": "completed"}


def test_completed_child_findings_fails_open():
    """This runs on the recovery path: a lookup error must never be the reason the founder loses the turn
    entirely — it degrades to the plain apology."""

    assert _findings([], raises=True) == []
    assert _findings([{"capability_key": "x", "status": "completed"}], run_id=None) == []


def test_completed_child_findings_skips_empty_summaries():
    assert _findings(
        [{"capability_key": "per_user_wiki", "status": "completed", "user_id": FOUNDER, "parent_run_id": "parent-1", "result_summary": "", "completed_at": "z"}]
    ) == []
