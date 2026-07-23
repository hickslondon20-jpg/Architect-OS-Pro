"""Isolated integration coverage for the shared VCSO composer output-integrity seam."""

from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from claude_agent_sdk.types import ResultMessage

sys.path.insert(0, str(Path(__file__).parents[1]))

from services.agent_capabilities import AgentCapability
from services.tool_registry import ToolExecutionContext
from services.vcso_sdk_loop import (
    COMPUTE_INTEGRITY_REFUSAL,
    stream_vcso_sdk_turn,
)


A1_QUESTION = "If my top 2 clients churned this year, what would it do to my margin and runway?"
FABRICATED_A1 = (
    "If the top two clients churn, margin falls 20% and runway drops to "
    "8.7 months based on $45k monthly revenue."
)


class _Query:
    def __init__(self, rows=None):
        self.rows = rows or []

    def select(self, *_args):
        return self

    def eq(self, *_args):
        return self

    def limit(self, *_args):
        return self

    def execute(self):
        return SimpleNamespace(data=self.rows)


class _Client:
    def table(self, _name):
        return _Query([])


class _Store:
    client = _Client()

    def resolve_platform_model(self, *, setting_key, fallback_model_name, fallback_provider):
        if setting_key == "tier_worker":
            return {"provider": "anthropic", "model_name": "claude-haiku-test"}
        return {"provider": fallback_provider, "model_name": fallback_model_name}


class _Registry:
    def get(self, name):  # pragma: no cover - these integration turns expose no registry tools
        raise AssertionError(f"Unexpected registry tool lookup: {name}")


def _capability(key: str) -> AgentCapability:
    return AgentCapability(
        capability_key=key,
        label=key.replace("_", " ").title(),
        description=f"Bounded {key} worker.",
        status="experimental",
        allowed_surfaces=["virtual_cso"],
        allowed_tools=[],
        allowed_source_kinds=[],
        model_setting_key=key,
        routing_tier="worker",
        output_schema={"version": "agent_result_v1"},
        default_config={"max_rounds": 1},
        can_spawn_agents=False,
    )


def _consume(generator):
    events = []
    while True:
        try:
            events.append(next(generator))
        except StopIteration as stop:
            return events, stop.value


def _result_message(text: str, session_id: str = "integrity-session") -> ResultMessage:
    return ResultMessage(
        subtype="success",
        duration_ms=1,
        duration_api_ms=1,
        is_error=False,
        num_turns=1,
        session_id=session_id,
        total_cost_usd=0.01,
        usage={"input_tokens": 20, "output_tokens": 8},
        result=text,
    )


def _base_turn_kwargs(*, prompt: str, founder_question: str):
    return {
        "prompt": prompt,
        "founder_question": founder_question,
        "system_prompt": "Virtual CSO system prompt",
        "model": "claude-sonnet-test",
        "api_key": "test-key",
        "registry": _Registry(),
        "tool_names": [],
        "tool_context": ToolExecutionContext(
            user_id="founder-1",
            store=_Store(),
            thread_id="thread-1",
            metadata={"surface": "virtual_cso", "parent_run_id": "parent-run-1"},
        ),
        "trace_metadata": {"run_id": "parent-run-1"},
    }


@pytest.mark.parametrize("_run_index", range(5))
def test_model_driven_missing_compute_refuses_a1_substitute_arithmetic(monkeypatch, _run_index):
    """Five consecutive model-choice emissions prove the no-worker A1 shape fails closed."""

    monkeypatch.setattr(
        "services.vcso_sdk_config.AgentCapabilityRegistry.list_active",
        lambda _self: [_capability("sandbox_execution_agent")],
    )
    monkeypatch.setattr("services.vcso_sdk_loop._record_turn_trace", lambda **_kwargs: None)

    async def fake_query(**_kwargs):
        yield _result_message(FABRICATED_A1, f"model-choice-{_run_index}")

    events, result = _consume(
        stream_vcso_sdk_turn(
            **_base_turn_kwargs(prompt=A1_QUESTION, founder_question=A1_QUESTION),
            native_subagent_required_agents=("sandbox_execution_agent",),
            native_subagent_scopes={"sandbox_execution_agent": {}},
            native_model_driven=True,
            native_model_choice=True,
            query_impl=fake_query,
        )
    )

    assert result.answer_text == COMPUTE_INTEGRITY_REFUSAL
    assert [event["data"]["text"] for event in events if event["event"] == "token"] == [
        COMPUTE_INTEGRITY_REFUSAL
    ]
    assert "20%" not in str(events)
    assert "8.7" not in str(events)
    assert "$45k" not in str(events)


def test_successful_cited_compute_passes_the_shared_compose_seam(monkeypatch):
    monkeypatch.setattr(
        "services.vcso_sdk_config.AgentCapabilityRegistry.list_active",
        lambda _self: [_capability("sandbox_execution_agent")],
    )
    monkeypatch.setattr("services.vcso_sdk_loop._record_turn_trace", lambda **_kwargs: None)

    class _SuccessfulCompute:
        def __init__(self, _store):
            pass

        def start_run(self, _request):
            return SimpleNamespace(
                run_id="compute-run-1",
                status="completed",
                result_summary="Scenario computed from the cited client series.",
                structured_result={"status": "completed", "margin_change_pct": -12},
                citations=[{"source_id": "compute-run-1", "label": "Sandbox scenario"}],
                trace=[],
            )

    monkeypatch.setattr("services.vcso_sdk_loop.SubAgentOrchestrator", _SuccessfulCompute)

    async def fake_query(**_kwargs):
        yield _result_message("The computed scenario reduces margin by 12% [1].", "compute-pass")

    events, result = _consume(
        stream_vcso_sdk_turn(
            **_base_turn_kwargs(prompt=A1_QUESTION, founder_question=A1_QUESTION),
            native_subagent_required_agents=("sandbox_execution_agent",),
            native_subagent_scopes={"sandbox_execution_agent": {}},
            query_impl=fake_query,
        )
    )

    assert result.answer_text == "The computed scenario reduces margin by 12% [1]."
    assert [event["data"]["text"] for event in events if event["event"] == "token"] == [
        "The computed scenario reduces margin by 12% [1]."
    ]


def test_cited_retrieval_and_qualitative_answer_are_unregressed(monkeypatch):
    monkeypatch.setattr("services.vcso_sdk_loop._record_turn_trace", lambda **_kwargs: None)
    answer = "Stored revenue is $480k [economic_foundation]. Protect the renewal conversation first."

    async def fake_query(**_kwargs):
        yield _result_message(answer, "retrieval-pass")

    events, result = _consume(
        stream_vcso_sdk_turn(
            **_base_turn_kwargs(
                prompt="Selected founder context",
                founder_question="What revenue is on record, and what should I prioritize?",
            ),
            initial_sources=[
                {
                    "source_kind": "platform_record",
                    "source_id": "economic-foundation-1",
                    "label": "Economic foundation",
                }
            ],
            query_impl=fake_query,
        )
    )

    assert result.answer_text == answer
    assert [event["data"]["text"] for event in events if event["event"] == "token"] == [answer]


@pytest.mark.parametrize("_run_index", range(5))
def test_path_a_degraded_compute_fail_open_refuses_a1_substitute_arithmetic(monkeypatch, _run_index):
    """Five consecutive degraded Path-A runs cover the live fail-open at the shared seam."""

    monkeypatch.setattr(
        "services.vcso_sdk_config.AgentCapabilityRegistry.list_active",
        lambda _self: [_capability("sandbox_execution_agent")],
    )
    monkeypatch.setattr("services.vcso_sdk_loop._record_turn_trace", lambda **_kwargs: None)

    class _DegradedCompute:
        def __init__(self, _store):
            pass

        def start_run(self, _request):
            return SimpleNamespace(
                run_id=f"degraded-run-{_run_index}",
                status="completed",
                result_summary="No computed result is available.",
                structured_result={"status": "could_not_compute", "needs_review": True},
                citations=[],
                trace=[],
            )

    monkeypatch.setattr("services.vcso_sdk_loop.SubAgentOrchestrator", _DegradedCompute)

    async def fake_query(**_kwargs):
        yield _result_message(FABRICATED_A1, f"path-a-fail-open-{_run_index}")

    events, result = _consume(
        stream_vcso_sdk_turn(
            **_base_turn_kwargs(prompt=A1_QUESTION, founder_question=A1_QUESTION),
            native_subagent_required_agents=("sandbox_execution_agent",),
            native_subagent_scopes={"sandbox_execution_agent": {}},
            query_impl=fake_query,
        )
    )

    assert result.answer_text == COMPUTE_INTEGRITY_REFUSAL
    assert [event["data"]["text"] for event in events if event["event"] == "token"] == [
        COMPUTE_INTEGRITY_REFUSAL
    ]
    assert "20%" not in str(events)
    assert "8.7" not in str(events)
    assert "$45k" not in str(events)
