from __future__ import annotations

from contextlib import contextmanager
from types import SimpleNamespace

import pytest

from services.agent_context import AgentContextBundle, AgentSourceRef
from services.sandbox_execution_service import (
    COULD_NOT_COMPUTE_SUMMARY,
    SANDBOX_WORKER_MAX_ROUNDS,
    SandboxExecutionService,
)
from services.sub_agent_orchestrator import SubAgentOrchestrator


@pytest.fixture(autouse=True)
def cleanup_test_user():
    """Override the acceptance harness's live autouse fixture for pure unit tests."""

    yield


class _Messages:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return self.responses.pop(0)


def _response(*, stop_reason: str, content: list[SimpleNamespace]):
    return SimpleNamespace(
        stop_reason=stop_reason,
        content=content,
        usage=SimpleNamespace(input_tokens=25, output_tokens=10),
    )


def _tool_use_response(tool_id: str):
    return _response(
        stop_reason="tool_use",
        content=[SimpleNamespace(type="tool_use", id=tool_id, name="execute_code", input={"code": "print(1)"})],
    )


def _service(responses):
    service = object.__new__(SandboxExecutionService)
    service._supabase = SimpleNamespace()
    service.model = "claude-haiku"
    service.provider = "anthropic"
    service.model_setting_key = "tier_worker"
    service.anthropic_client = SimpleNamespace(messages=_Messages(responses))
    service._resolve_model = lambda: None
    service._skill_file_context = lambda _ids: "No files."
    service._resolve_code_mode_tool_names = lambda _surface: []
    return service


def test_successful_compute_finishes_within_two_rounds_and_scopes_trace(monkeypatch):
    service = _service(
        [
            _tool_use_response("tool-1"),
            _response(
                stop_reason="end_turn",
                content=[SimpleNamespace(type="text", text="Concentration is 40%; margin is 18%. Derivation: 40/100 and 18/100.")],
            ),
        ]
    )
    service._dispatch_tool = lambda **_kwargs: (
        '{"stdout":"concentration=0.40 margin=0.18"}',
        [{"tool_name": "execute_code", "summary": "Computed concentration and margin.", "error": None, "sources": []}],
    )
    scopes = []

    @contextmanager
    def _scope(metadata):
        scopes.append(metadata)
        yield

    monkeypatch.setattr("services.sandbox_execution_service.trace_scope", _scope)
    monkeypatch.setattr("services.sandbox_execution_service.log_ai_usage_event", lambda *_args, **_kwargs: None)

    result = service.run_execution(
        user_id="founder-1",
        thread_id="thread-1",
        task_summary="Compute concentration and margin.",
        run_id="child-run-1",
        max_rounds=6,
    )

    assert result.status == "completed"
    assert result.rounds_used == SANDBOX_WORKER_MAX_ROUNDS
    assert result.truncated is False
    assert "40%" in result.summary
    assert len(service.anthropic_client.messages.calls) == SANDBOX_WORKER_MAX_ROUNDS
    assert scopes == [
        {
            "user_id": "founder-1",
            "thread_id": "thread-1",
            "run_id": "child-run-1",
            "capability_key": "tier_worker",
        },
        {
            "user_id": "founder-1",
            "thread_id": "thread-1",
            "run_id": "child-run-1",
            "capability_key": "tier_worker",
        },
    ]


def test_repeated_compute_errors_fail_fast_with_clean_finding(monkeypatch):
    service = _service([_tool_use_response("tool-1"), _tool_use_response("tool-2")])
    service._dispatch_tool = lambda **_kwargs: (
        '{"error":"forced compute error"}',
        [
            {
                "tool_name": "execute_code",
                "summary": "execute_code returned an error.",
                "error": "forced compute error",
                "sources": [],
            }
        ],
    )
    monkeypatch.setattr("services.sandbox_execution_service.log_ai_usage_event", lambda *_args, **_kwargs: None)

    result = service.run_execution(
        user_id="founder-1",
        thread_id="thread-1",
        task_summary="Force a compute error.",
        run_id="child-run-2",
        max_rounds=12,
    )

    assert result.status == "could_not_compute"
    assert result.summary == COULD_NOT_COMPUTE_SUMMARY
    assert result.rounds_used == SANDBOX_WORKER_MAX_ROUNDS
    assert result.truncated is True
    assert len(service.anthropic_client.messages.calls) == SANDBOX_WORKER_MAX_ROUNDS


class _RowsQuery:
    def select(self, *_args):
        return self

    def eq(self, *_args):
        return self

    def order(self, *_args):
        return self

    def limit(self, *_args):
        return self

    def execute(self):
        return SimpleNamespace(
            data=[
                {
                    "id": "row-1",
                    "dataset_id": "dataset-1",
                    "row_label": "June",
                    "period_start": "2026-06-01",
                    "period_end": "2026-06-30",
                    "values": {"net_revenue": 100, "net_income": 18},
                    "normalized_values": {"net_revenue": 100, "net_income": 18},
                }
            ]
        )


def test_structured_worker_carries_bounded_numeric_rows_into_compact_finding():
    orchestrator = object.__new__(SubAgentOrchestrator)
    orchestrator.store = SimpleNamespace(client=SimpleNamespace(table=lambda _name: _RowsQuery()))
    context = AgentContextBundle(
        user_id="founder-1",
        parent_surface="virtual_cso",
        task_summary="Gather numeric inputs.",
        context_scope={},
        datasets=[
            {
                "id": "dataset-1",
                "dataset_name": "P&L",
                "summary": "Monthly P&L.",
                "status": "ready",
            }
        ],
        sources=[AgentSourceRef(source_kind="founder_dataset", source_id="dataset-1")],
    )

    result = orchestrator._handle_structured_data(context)

    assert "1 bounded numeric row" in result["result_summary"]
    row_finding = next(item for item in result["structured_result"]["findings"] if item["type"] == "dataset_row")
    assert '"net_income": 18' in row_finding["summary"]
    assert row_finding["source_id"] == "dataset-1"
