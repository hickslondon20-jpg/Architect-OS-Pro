from __future__ import annotations

from contextlib import contextmanager
from types import SimpleNamespace

import pytest

from services.agent_context import AgentContextBundle, AgentSourceRef
from services.sandbox_execution_service import (
    COULD_NOT_COMPUTE_SUMMARY,
    SANDBOX_WORKER_MAX_ROUNDS,
    SandboxExecutionResult,
    SandboxExecutionService,
)
from services.sandbox_service import KubernetesInteractiveSandboxSession
from services.sub_agent_orchestrator import SubAgentOrchestrator, SubAgentRunRequest
from services.vcso_planner import PlannerWorkerFinding, _inherit_sandbox_provenance


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


def test_interactive_sandbox_waits_for_exec_channel_before_bootstrap(monkeypatch):
    session = object.__new__(KubernetesInteractiveSandboxSession)
    session._EXEC_READY_TIMEOUT_SECONDS = 5.0
    session._EXEC_READY_POLL_SECONDS = 0.0
    attempts = iter(
        [
            RuntimeError("GKE exec proxy is still starting"),
            SimpleNamespace(exit_code=1, stderr="not ready", stdout=""),
            SimpleNamespace(exit_code=0, stderr="", stdout=""),
        ]
    )

    def execute_probe(_command):
        outcome = next(attempts)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    session.execute_command = execute_probe
    monkeypatch.setattr("services.sandbox_service.time.sleep", lambda _seconds: None)

    session._wait_for_exec_channel()


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


def test_compact_planner_sandbox_result_keeps_computation_and_derivation(monkeypatch):
    orchestrator = object.__new__(SubAgentOrchestrator)
    execution = SandboxExecutionResult(
        summary="Concentration is 40%; current margin is 18%; change is -6 pp.",
        tool_steps=[
            {
                "tool_name": "execute_code",
                "summary": "Computed concentration and margin from bounded numeric inputs.",
                "error": None,
                "sources": [],
            }
        ],
        produced_file_path=None,
        rounds_used=2,
        truncated=False,
        status="completed",
    )
    fake_service = SimpleNamespace(run_execution=lambda **_kwargs: execution)
    monkeypatch.setattr(
        "services.sub_agent_orchestrator.SandboxExecutionService.from_env",
        lambda **_kwargs: fake_service,
    )
    context = AgentContextBundle(
        user_id="founder-1",
        parent_surface="virtual_cso",
        task_summary="Compute the bounded quantities.",
        context_scope={"thread_id": "thread-1"},
    )
    request = SubAgentRunRequest(
        user_id="founder-1",
        parent_surface="virtual_cso",
        capability_key="sandbox_execution_agent",
        task_summary=context.task_summary,
        context_scope=context.context_scope,
        enforce_compact_contract=True,
    )
    capability = SimpleNamespace(
        default_config={"max_rounds": 6, "timeout_seconds": 90},
        effective_model_setting_key="tier_worker",
    )

    result = orchestrator._handle_sandbox_execution(context, capability, "child-run-1", request)

    structured = result["structured_result"]
    assert structured["status"] == "completed"
    assert structured["rounds_used"] == 2
    assert structured["computed_result"].startswith("Concentration is 40%")
    assert structured["derivation"] == ["Computed concentration and margin from bounded numeric inputs."]


def test_planner_inherits_prior_citations_into_sandbox_finding():
    citation = {
        "source_kind": "founder_dataset",
        "source_id": "dataset-1",
        "citation_payload": {"locator": {"kind": "record_path", "record_path": "founder_datasets/dataset-1"}},
    }
    prior = PlannerWorkerFinding(
        subquestion_id="sq-data",
        capability_key="structured_data_agent",
        run_id="data-run",
        summary="Bounded numeric inputs gathered.",
        claims=[{"text": "Bounded numeric inputs gathered.", "source_id": "dataset-1"}],
        evidence=[{"source_id": "dataset-1"}],
        provenance={"worker_run_id": "data-run"},
        confidence=0.9,
        citations=[citation],
    )
    sandbox = PlannerWorkerFinding(
        subquestion_id="sq-compute",
        capability_key="sandbox_execution_agent",
        run_id="sandbox-run",
        summary="Concentration is 40%.",
        claims=[{"text": "Concentration is 40%."}],
        evidence=[],
        provenance={"worker_run_id": "sandbox-run"},
        confidence=0.9,
        citations=[],
        computed_result="40%",
        derivation=["40000 / 100000"],
    )

    inherited = _inherit_sandbox_provenance(sandbox, [prior])

    assert inherited.citations == [citation]
    assert inherited.evidence == [{"source_id": "dataset-1"}]
    assert inherited.computed_result == "40%"
