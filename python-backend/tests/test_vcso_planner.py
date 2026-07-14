from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from services.sub_agent_orchestrator import (
    SubAgentError,
    SubAgentOrchestrator,
    SubAgentRunRequest,
    SubAgentRunResult,
    _compact_worker_contract,
)
from services.vcso_chat_service import VcsoChatService
from services.vcso_planner import (
    PlannerBudget,
    PlannerBudgetLedger,
    VcsoPlanner,
    planner_entry_allowed,
)
from services.vcso_source_router import SourceRoutingDecision, SourceRoutingResult


@pytest.fixture(autouse=True)
def cleanup_test_user():
    """Override the acceptance harness's live autouse fixture for pure unit tests."""

    yield


def _intent(*, confidence=0.9, move_type="strategic_synthesis", depth="deep", status="classified"):
    return {
        "status": status,
        "move_type": move_type,
        "depth": depth,
        "confidence": confidence,
    }


def test_planner_entry_gate_is_conservative_and_strategic_only():
    assert planner_entry_allowed(_intent(), 0.8) is True
    assert planner_entry_allowed(None, 0.8) is False
    assert planner_entry_allowed(_intent(status="none"), 0.8) is False
    assert planner_entry_allowed(_intent(move_type="lookup"), 0.8) is False
    assert planner_entry_allowed(_intent(depth="shallow"), 0.8) is False
    assert planner_entry_allowed(_intent(confidence=0.79), 0.8) is False


def test_flag_off_does_not_invoke_planner(monkeypatch):
    service = object.__new__(VcsoChatService)
    service.store = SimpleNamespace()
    service.anthropic_client = SimpleNamespace()
    monkeypatch.setattr(
        "services.vcso_chat_service.VcsoPlanner.run",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("planner should stay dark")),
    )

    result = service._run_planner_or_none(
        planner_flag={"enabled": False, "settings": {}},
        turn_intent=_intent(),
        user_id="founder",
        thread_id="thread",
        user_message_id="message",
        parent_run_id="run",
        message="What should I do?",
        working_state={},
    )

    assert result is None


def test_forced_planner_error_fails_open_to_flat_path(monkeypatch):
    service = object.__new__(VcsoChatService)
    service.store = SimpleNamespace()
    service.anthropic_client = SimpleNamespace()
    monkeypatch.setattr(
        "services.vcso_chat_service.VcsoPlanner.run",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("forced planner failure")),
    )

    result = service._run_planner_or_none(
        planner_flag={"enabled": True, "settings": {"confidence_threshold": 0.8}},
        turn_intent=_intent(),
        user_id="founder",
        thread_id="thread",
        user_message_id="message",
        parent_run_id="run",
        message="What should I do?",
        working_state={},
    )

    assert result is None


def test_budget_ledger_hits_spend_cap_and_preserves_compose_reserve():
    budget = PlannerBudget(
        max_subquestions=4,
        max_rounds=2,
        max_depth=1,
        max_estimated_spend_usd=0.07,
        decompose_reserve_usd=0.02,
        compose_reserve_usd=0.04,
        worker_reserve_usd=0.01,
    )
    ledger = PlannerBudgetLedger(budget)
    ledger.reserve_parent_calls()

    assert ledger.allow_worker(pending_count=2) is True
    assert ledger.allow_worker(pending_count=1) is False
    assert ledger.cap_hits == ["max_estimated_spend_usd"]
    assert ledger.worker_calls == 1


def test_orchestrator_rejects_recursive_depth_before_dispatch():
    orchestrator = object.__new__(SubAgentOrchestrator)
    request = SubAgentRunRequest(
        user_id="founder",
        parent_surface="virtual_cso",
        capability_key="kb_explorer_agent",
        task_summary="Do more work",
        context_scope={},
        delegation_depth=2,
    )

    with pytest.raises(SubAgentError, match="depth exceeds"):
        orchestrator.start_run(request)


def test_orchestrator_rejects_worker_override_outside_planner_contract():
    orchestrator = object.__new__(SubAgentOrchestrator)
    request = SubAgentRunRequest(
        user_id="founder-1",
        parent_surface="virtual_cso",
        capability_key="structured_data_agent",
        task_summary="Gather data",
        context_scope={},
        routing_tier_override="worker",
        enforce_compact_contract=False,
    )

    with pytest.raises(SubAgentError, match="restricted to compact planner"):
        orchestrator.start_run(request)


def test_worker_contract_caps_oversized_raw_output_and_keeps_citations():
    result = {
        "result_summary": "A compact result",
        "structured_result": {
            "summary": "A compact result",
            "findings": [{"type": "analysis", "summary": "x" * 20000}],
            "raw_dump": "secret raw material" * 2000,
            "confidence": 0.82,
        },
        "citations": [
            {
                "source_kind": "founder_dataset",
                "source_id": "dataset-1",
                "source_label": "Client revenue",
                "citation_payload": {"locator": {"kind": "record_path", "record_path": "founder_datasets/dataset-1"}},
            }
        ],
    }

    compact = _compact_worker_contract(
        result,
        capability_key="structured_data_agent",
        run_id="run-1",
        max_chars=2200,
    )

    structured = compact["structured_result"]
    assert structured["schema_version"] == "worker_finding_v1"
    assert structured["reasoning_visibility"] == "summary_only"
    assert structured["provenance"]["worker_run_id"] == "run-1"
    assert structured["evidence"][0]["source_id"] == "dataset-1"
    assert "raw_dump" not in structured
    assert "secret raw material" not in json.dumps(structured)
    assert len(json.dumps(structured)) < 2200


class _Messages:
    def __init__(self):
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if len(self.calls) == 1:
            text = json.dumps(
                {
                    "subquestions": [
                        {
                            "question": "Calculate the client concentration trend.",
                            "purpose": "Quantify concentration",
                            "worker_hint": "sandbox_execution_agent",
                        },
                        {
                            "question": "What strategic constraint does the founder context identify?",
                            "purpose": "Read the strategic context",
                            "worker_hint": "per_user_wiki",
                        },
                    ]
                }
            )
        else:
            text = "Concentration is rising [1], so reduce dependency before adding fixed cost."
        return SimpleNamespace(
            content=[SimpleNamespace(type="text", text=text)],
            usage=SimpleNamespace(input_tokens=120, output_tokens=60),
        )


class _Store:
    def __init__(self):
        self.client = SimpleNamespace()

    def resolve_platform_model(self, **_kwargs):
        return {"provider": "anthropic", "model_name": "claude-sonnet-4-6"}


class _Router:
    def __init__(self, _store):
        pass

    def route(self, **_kwargs):
        ref = {
            "source_kind": "wiki_page",
            "source_id": "financial_context",
            "source_label": "Financial context",
            "source_metadata": {"page_key": "financial_context"},
            "citation_payload": {"locator": {"kind": "page_key", "page_key": "financial_context"}},
        }
        return SourceRoutingResult(
            decision=SourceRoutingDecision(
                schema_version="vcso_source_routing_v1",
                status="selected",
                start_tier=1,
                escalation_plan=[1, 2, 3],
                tiers_consulted=[1],
                stop_tier=1,
                reason_code="intent_strategic_synthesis",
                selected_sources=[{"tier": 1, "source_kind": "wiki_page", "source_id": "financial_context"}],
            ),
            components=[],
            source_refs=[ref],
        )


class _Orchestrator:
    calls = []

    def __init__(self, _store):
        pass

    def start_run(self, request):
        self.calls.append(request)
        run_id = f"child-{len(self.calls)}"
        return SubAgentRunResult(
            run_id=run_id,
            status="completed",
            result_summary="Client concentration rose to 42%.",
            structured_result={
                "schema_version": "worker_finding_v1",
                "summary": "Client concentration rose to 42%.",
                "claims": [{"text": "Client concentration rose to 42%."}],
                "evidence": [{"source_id": "financial_context"}],
                "provenance": {"worker_run_id": run_id},
                "confidence": 0.84,
                "computed_result": "42%",
                "derivation": ["largest client revenue divided by total revenue"],
                "reasoning_visibility": "summary_only",
            },
            trace=[],
            citations=[
                {
                    "source_kind": "wiki_page",
                    "source_id": "financial_context",
                    "source_label": "Financial context",
                    "source_metadata": {"page_key": "financial_context"},
                    "citation_payload": {"locator": {"kind": "page_key", "page_key": "financial_context"}},
                }
            ],
        )


def test_planner_delegates_one_level_and_composes_only_compact_findings(monkeypatch):
    messages = _Messages()
    anthropic = SimpleNamespace(messages=messages)
    _Orchestrator.calls = []
    monkeypatch.setattr("services.vcso_planner.log_ai_usage_event", lambda *_args, **_kwargs: None)
    planner = VcsoPlanner(
        store=_Store(),
        anthropic_client=anthropic,
        router_factory=_Router,
        orchestrator_factory=_Orchestrator,
    )

    result = planner.run(
        user_id="founder-1",
        thread_id="thread-1",
        user_message_id="message-1",
        parent_run_id="parent-1",
        message="Concentration is rising while margin compresses. What should I do?",
        working_state={"findings": [{"text": "Margin is compressing."}]},
        intent=_intent(),
        settings={"max_subquestions": 2, "max_depth": 1},
    )

    assert len(_Orchestrator.calls) == 2
    assert all(call.parent_run_id == "parent-1" for call in _Orchestrator.calls)
    assert all(call.context_scope["delegation_depth"] == 1 for call in _Orchestrator.calls)
    assert all(call.delegation_depth == 1 for call in _Orchestrator.calls)
    assert all(call.routing_tier_override == "worker" for call in _Orchestrator.calls)
    assert all(call.enforce_compact_contract is True for call in _Orchestrator.calls)
    assert _Orchestrator.calls[0].capability_key == "sandbox_execution_agent"
    assert result.answer_text.startswith("Concentration is rising")
    assert len(result.findings) == 2
    assert result.findings[0].computed_result == "42%"
    assert result.trace_steps[1]["subAgent"]["runId"] == "child-1"
    compose_call = messages.calls[-1]
    assert "raw_dump" not in json.dumps(compose_call)
    assert "WORKING STATE (UNTRUSTED" in compose_call["system"]


def test_spend_cap_still_composes_from_bounded_partial_findings(monkeypatch):
    messages = _Messages()
    _Orchestrator.calls = []
    monkeypatch.setattr("services.vcso_planner.log_ai_usage_event", lambda *_args, **_kwargs: None)
    planner = VcsoPlanner(
        store=_Store(),
        anthropic_client=SimpleNamespace(messages=messages),
        router_factory=_Router,
        orchestrator_factory=_Orchestrator,
    )

    result = planner.run(
        user_id="founder-1",
        thread_id="thread-1",
        user_message_id="message-1",
        parent_run_id="parent-1",
        message="Concentration is rising while margin compresses. What should I do?",
        working_state={},
        intent=_intent(),
        settings={
            "max_subquestions": 4,
            "max_estimated_spend_usd": 0.07,
            "decompose_reserve_usd": 0.02,
            "compose_reserve_usd": 0.04,
            "worker_reserve_usd": 0.01,
        },
    )

    assert len(_Orchestrator.calls) == 1
    assert result.budget["cap_hits"] == ["max_estimated_spend_usd"]
    assert len(result.findings) == 1
    assert result.answer_text
