from __future__ import annotations

from types import SimpleNamespace

import pytest

from services.vcso_chat_service import (
    VcsoChatService,
    _routing_trace_step,
    _working_state_system_prefix,
)
from services.vcso_source_router import (
    SOURCE_ROUTING_SCHEMA_VERSION,
    SourceRouter,
    _select_modular_pages,
    plan_source_route,
)


@pytest.fixture(autouse=True)
def cleanup_test_user():
    """Override the acceptance harness's live autouse fixture for pure unit tests."""

    yield


def _reader(name: str, calls: list[int], tier: int, *, available: bool):
    def read(_user_id: str, _message: str):
        calls.append(tier)
        if not available:
            return [], []
        return (
            [{"resource_ref": name, "title": name, "content": "bounded"}],
            [
                {
                    "source_kind": "wiki_page",
                    "source_id": name,
                    "source_label": name,
                    "source_metadata": {"page_key": name},
                    "citation_payload": {},
                }
            ],
        )

    return read


def test_record_question_starts_and_stops_at_tier_zero():
    calls: list[int] = []
    router = SourceRouter(
        SimpleNamespace(client=None),
        tier_readers={
            0: _reader("sprint-record", calls, 0, available=True),
            1: _reader("wiki", calls, 1, available=True),
            2: _reader("semantic", calls, 2, available=True),
            3: _reader("raw", calls, 3, available=True),
        },
    )

    result = router.route(
        user_id="founder",
        message="What sprint initiative is currently in flight?",
        intent={"status": "classified", "move_type": "lookup", "depth": "shallow"},
    )

    assert calls == [0]
    assert result.decision.start_tier == 0
    assert result.decision.stop_tier == 0
    assert result.decision.tiers_consulted == [0]
    assert result.decision.schema_version == SOURCE_ROUTING_SCHEMA_VERSION


def test_strategic_question_starts_and_stops_at_tier_one_components():
    calls: list[int] = []
    router = SourceRouter(
        SimpleNamespace(client=None),
        tier_readers={
            0: _reader("record", calls, 0, available=False),
            1: _reader("financial_context", calls, 1, available=True),
            2: _reader("semantic", calls, 2, available=True),
            3: _reader("raw", calls, 3, available=True),
        },
    )

    result = router.route(
        user_id="founder",
        message="Margin is compressing while concentration rises. What should I do?",
        intent={"status": "classified", "move_type": "strategic_synthesis", "depth": "deep"},
    )

    assert calls == [1]
    assert result.decision.start_tier == 1
    assert result.decision.stop_tier == 1


def test_missing_component_escalates_by_availability_not_quality_score():
    calls: list[int] = []
    router = SourceRouter(
        SimpleNamespace(client=None),
        tier_readers={
            0: _reader("record", calls, 0, available=False),
            1: _reader("wiki", calls, 1, available=False),
            2: _reader("semantic", calls, 2, available=True),
            3: _reader("raw", calls, 3, available=True),
        },
    )

    result = router.route(user_id="founder", message="How do we position the new offer?", intent=None)

    assert calls == [1, 2]
    assert result.decision.reason_code == "intent_unavailable_conservative"
    assert result.decision.stop_tier == 2


def test_named_document_question_goes_directly_to_tier_three():
    plan = plan_source_route('What does document "April P&L.pdf" say?', None)

    assert plan.start_tier == 3
    assert plan.escalation_plan == (3,)
    assert plan.reason_code == "raw_evidence_requested"


def test_absent_founder_operating_page_degrades_to_other_available_components():
    rows = [
        {
            "id": "business-page",
            "page_title": "Business Context",
            "canonical_key": "business-context",
            "page_kind": "business_context",
            "page_type": "business",
            "domain": "strategy",
            "category": "context",
        }
    ]

    selected = _select_modular_pages("Use my communication style and business context", rows)

    assert selected == {"business-page"}


def test_routing_step_is_sanitized_and_summary_only():
    step = _routing_trace_step(
        {
            "status": "selected",
            "start_tier": 1,
            "tiers_consulted": [1],
            "stop_tier": 1,
            "reason_code": "intent_strategic_synthesis",
            "selected_sources": [
                {"tier": 1, "source_kind": "wiki_page", "source_id": "financial_context"}
            ],
            "live_tier_hook": "phase_5_noop",
        },
        step_index=2,
    )

    assert step is not None
    assert step["stepType"] == "source_review"
    assert step["input"] == {}
    assert "reasoning" not in step["summary"].casefold()
    assert "chain" not in step["summary"].casefold()


def test_router_flag_off_preserves_phase_one_component_read(monkeypatch):
    service = object.__new__(VcsoChatService)
    expected = [{"resource_ref": "phase-one-component"}]
    monkeypatch.setattr(service, "_source_router_settings", lambda _user_id: {"enabled": False})
    monkeypatch.setattr(service, "_load_two_source_wiki_components", lambda _user_id, _message: expected)

    components, source_refs, decision = service._load_turn_source_components(
        user_id="founder",
        thread_id="thread",
        message_id="message",
        message="What should I do?",
        turn_intent=None,
    )

    assert components is expected
    assert source_refs == []
    assert decision is None


def test_forced_router_error_propagates_to_outer_fail_open_seam(monkeypatch):
    service = object.__new__(VcsoChatService)
    service.store = SimpleNamespace(client=None)
    monkeypatch.setattr(service, "_source_router_settings", lambda _user_id: {"enabled": True})

    def fail_route(*_args, **_kwargs):
        raise RuntimeError("forced router failure")

    monkeypatch.setattr("services.vcso_chat_service.SourceRouter.route", fail_route)

    with pytest.raises(RuntimeError, match="forced router failure"):
        service._load_turn_source_components(
            user_id="founder",
            thread_id="thread",
            message_id="message",
            message="What should I do?",
            turn_intent=None,
        )


def test_selected_route_tells_model_to_use_prefetch_before_tools():
    prefix = _working_state_system_prefix(
        system_prompt="Answer safely.",
        rules=[],
        selected_packs=[],
        tool_catalog=[{"name": "wiki_list", "description": "List wiki pages"}],
        route={"primary": None, "required": []},
        source_routing_decision={
            "status": "selected",
            "start_tier": 0,
            "stop_tier": 0,
            "reason_code": "structured_record_signal",
            "selected_sources": [{"source_kind": "tier0_record"}],
        },
    )

    assert "already selected and injected" in prefix
    assert "Do not call list, search, read, or navigation tools merely to rediscover" in prefix
    assert '"stop_tier":0' in prefix


def test_dark_router_leaves_working_state_prefix_unchanged():
    kwargs = {
        "system_prompt": "Answer safely.",
        "rules": [],
        "selected_packs": [],
        "tool_catalog": [{"name": "wiki_list", "description": "List wiki pages"}],
        "route": {"primary": None, "required": []},
    }

    assert _working_state_system_prefix(**kwargs) == _working_state_system_prefix(
        **kwargs,
        source_routing_decision=None,
    )
