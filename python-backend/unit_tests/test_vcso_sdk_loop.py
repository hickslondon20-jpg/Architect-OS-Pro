from __future__ import annotations

import asyncio
from collections import defaultdict, deque
import json
import queue
import sys
import time
from pathlib import Path
from types import SimpleNamespace

import pytest
from claude_agent_sdk.types import (
    AssistantMessage,
    DeferredToolUse,
    ResultMessage,
    StreamEvent,
    ToolResultBlock,
    ToolUseBlock,
    UserMessage,
)

sys.path.insert(0, str(Path(__file__).parents[1]))

from services.agent_capabilities import AgentCapability
from services.tool_registry import ToolExecutionContext, ToolRegistry, ToolResultEnvelope, ToolSourceRef
from services.vcso_sdk_loop import (
    COMPUTE_INTEGRITY_REFUSAL,
    EXPECTED_CLAUDE_CODE_CLI_VERSION,
    G_GATE_CANDIDATE_AGENTS,
    G_GATE_MODEL_CHOICE_SCOPE,
    NATIVE_SURFACE_REQUIRED_AGENTS,
    NATIVE_PARTIAL_RESULT_MARKER,
    _assistant_worker_capability,
    _child_run_id_for_capability,
    _enforce_composer_integrity,
    _make_worker_progress_bridge,
    _make_sdk_tool,
    _native_generalization_prompt,
    _native_granular_worker_outcome,
    _native_partial_failure_context,
    _RetrievalBinding,
    _ask_user_observed_retrievals,
    _ask_user_preference_retrievals,
    _sanitized_sdk_error,
    _native_tool_output_summary,
    _successful_cited_compute_result,
    complete_native_child_run,
    compute_gate_decision,
    create_native_child_run,
    native_tool_access_decision,
    native_subagent_requirements,
    persist_native_child_step,
    read_sdk_loop_settings,
    sdk_stream_capture_enabled,
    foreground_delegation_input,
    sdk_runtime_versions,
    sdk_runtime_pin_status,
    stream_vcso_sdk_turn,
)


def test_native_lifecycle_summary_carries_agent_result_evidence_semantics():
    summary = _native_tool_output_summary(
        {
            "result_summary": "Reviewed bounded periods.",
            "structured_result": {
                "schema_version": "agent_result_v1",
                "summary": "Reviewed bounded periods.",
                "findings": [{"type": "dataset_row"}, {"type": "dataset_row_error"}],
                "confidence": 0.7,
                "needs_review": True,
                "truncated": True,
                "returned_count": 20,
            },
        }
    )

    assert summary == {
        "summary": "Reviewed bounded periods.",
        "needs_review": True,
        "confidence": 0.7,
        "truncated": True,
        "returned_count": 20,
        "finding_count": 2,
        "finding_types": ["dataset_row", "dataset_row_error"],
    }


@pytest.mark.parametrize(
    ("tool_input", "input_state"),
    [
        ({"prompt": "x"}, "absent"),
        ({"prompt": "x", "run_in_background": False}, "present"),
        ({"prompt": "x", "run_in_background": True}, "true"),
    ],
)
def test_delegation_input_rewrite_always_forces_foreground(tool_input, input_state):
    updated, observed = foreground_delegation_input(tool_input)

    assert observed == input_state
    assert updated["run_in_background"] is False
    assert tool_input != updated or tool_input.get("run_in_background") is False


def test_sdk_stream_capture_requires_explicit_switch_and_allowlisted_founder():
    armed = {
        "diagnostic_sdk_stream_capture_enabled": True,
        "diagnostic_user_ids": ["founder-1"],
    }

    assert sdk_stream_capture_enabled(armed, "founder-1") is True
    assert sdk_stream_capture_enabled(armed, "founder-2") is False
    assert sdk_stream_capture_enabled(
        {**armed, "diagnostic_sdk_stream_capture_enabled": False},
        "founder-1",
    ) is False
    assert sdk_stream_capture_enabled({}, "founder-1") is False


def test_sdk_error_sanitizer_preserves_type_and_redacts_credentials():
    details = _sanitized_sdk_error(
        RuntimeError("Bearer secret-token sk-abcdefghijklmnop eyJabc.def.ghi")
    )

    assert details["error_type"] == "RuntimeError"
    assert "secret-token" not in details["error_message"]
    assert "sk-abcdefghijklmnop" not in details["error_message"]
    assert "eyJabc.def.ghi" not in details["error_message"]


def test_sdk_runtime_versions_report_the_actual_package_and_cli_source():
    versions = sdk_runtime_versions()

    assert versions["claude_agent_sdk_version"]
    assert versions["claude_code_cli_version"]
    assert versions["claude_code_cli_source"] in {"bundled", "system"}


def test_sdk_runtime_pin_matches_the_bundled_cli():
    status = sdk_runtime_pin_status()

    assert status["expected_claude_code_cli_version"] == EXPECTED_CLAUDE_CODE_CLI_VERSION
    assert status["claude_code_cli_source"] == "bundled"
    assert status["claude_code_cli_version"] == EXPECTED_CLAUDE_CODE_CLI_VERSION
    assert status["ok"] is True


def test_sdk_tool_executor_returns_bounded_real_exception_identity():
    registry = ToolRegistry()
    definition = registry.get("execute_code")
    outcomes = defaultdict(deque)
    sdk_tool = _make_sdk_tool(
        definition=definition,
        registry=registry,
        tool_context=ToolExecutionContext(user_id="founder-1", thread_id="thread-1"),
        events=queue.Queue(),
        running_steps=defaultdict(deque),
        tool_outcomes=outcomes,
        source_refs=[],
        timeout_seconds=1,
        heartbeat_seconds=0.01,
    )

    result = asyncio.run(sdk_tool.handler({"code": "print(2 + 2)"}))
    payload = json.loads(result["content"][0]["text"])

    assert result["is_error"] is True
    assert payload["error_type"] == "ToolRegistryError"
    assert payload["error_message"] == "Sandbox service and thread_id are required for execute_code."
    outcome = outcomes["mcp__architectos__execute_code"][0]
    assert outcome.output_summary == {
        "status": "failed",
        "error_type": "ToolRegistryError",
        "error_message": "Sandbox service and thread_id are required for execute_code.",
    }


class _LifecycleWriteQuery:
    def __init__(self, client, table_name):
        self.client = client
        self.table_name = table_name
        self.operation = ""
        self.payload = None

    def insert(self, payload):
        self.operation = "insert"
        self.payload = payload
        return self

    def update(self, payload):
        self.operation = "update"
        self.payload = payload
        return self

    def eq(self, _column, _value):
        return self

    def execute(self):
        self.client.writes.append((self.table_name, self.operation, self.payload))
        data = dict(self.payload or {})
        if self.table_name == "agent_delegation_runs" and self.operation == "insert":
            data["id"] = "child-run-1"
        return SimpleNamespace(data=[data])


class _LifecycleWriteClient:
    def __init__(self):
        self.writes = []

    def table(self, name):
        return _LifecycleWriteQuery(self, name)


class _NativeStore:
    def __init__(self):
        self.client = _LifecycleWriteClient()

    def resolve_platform_model(self, *, setting_key, fallback_model_name, fallback_provider):
        return {"setting_key": setting_key, "provider": fallback_provider, "model_name": fallback_model_name}


class _NoChildrenStore(_NativeStore):
    pass


def _native_capability(key: str) -> AgentCapability:
    return AgentCapability(
        capability_key=key,
        label=key.replace("_", " ").title(),
        description=f"Bounded {key}.",
        status="experimental",
        allowed_surfaces=["virtual_cso"],
        allowed_tools=[],
        allowed_source_kinds=[],
        routing_tier="worker",
        id=f"{key}-id",
    )


def test_native_lifecycle_writers_create_steps_sources_and_complete_child():
    client = _LifecycleWriteClient()
    capability = AgentCapability(
        capability_key="structured_data_agent",
        label="Structured Data Analyst",
        description="Bounded structured data worker.",
        status="experimental",
        allowed_surfaces=["virtual_cso"],
        allowed_tools=[],
        allowed_source_kinds=["founder_dataset"],
        routing_tier="worker",
        id="11111111-1111-1111-1111-111111111111",
    )

    run_id = create_native_child_run(
        client,
        user_id="founder-1",
        capability=capability,
        parent_surface="virtual_cso",
        parent_thread_id="thread-1",
        parent_message_id="message-1",
        parent_run_id="parent-run-1",
        task_id="task-1",
        task_contract={"objective": "Read the cited periods.", "context_scope": {"dataset": "pnl"}},
        allowed_tools=["get_dataset_periods"],
        sdk_agent_id="sdk-child-1",
    )
    sources = [
        {
            "source_kind": "founder_dataset",
            "source_id": "22222222-2222-2222-2222-222222222222",
            "label": "Monthly P&L",
            "metadata": {"period": "2026-06"},
        }
    ]
    persist_native_child_step(
        client,
        user_id="founder-1",
        run_id=run_id,
        step_index=1,
        tool_name="get_dataset_periods",
        tool_use_id="tool-1",
        status="completed",
        summary="Retrieved the requested dataset periods.",
        output_summary={"status": "completed", "truncated": False},
        source_refs=sources,
    )
    complete_native_child_run(
        client,
        user_id="founder-1",
        run_id=run_id,
        status="completed",
        result_summary="Structured Data Analyst completed 1 granular tool call.",
        citations=sources,
        finding_summaries=[
            {
                "finding_type": "granular_tool_result",
                "truncated": False,
                "confidence": 0.7,
                "needs_review": True,
            }
        ],
    )

    assert run_id == "child-run-1"
    run_insert = client.writes[0][2]
    assert run_insert["status"] == "running"
    assert run_insert["parent_run_id"] == "parent-run-1"
    assert run_insert["metadata"]["routing_tier"] == "worker"
    step_insert = next(payload for table, operation, payload in client.writes if table == "agent_delegation_steps")
    assert step_insert["source_refs"] == sources
    source_insert = next(payload for table, operation, payload in client.writes if table == "agent_context_sources")
    assert source_insert["source_id"] == sources[0]["source_id"]
    run_update = next(
        payload
        for table, operation, payload in client.writes
        if table == "agent_delegation_runs" and operation == "update"
    )
    assert run_update["status"] == "completed"
    assert run_update["structured_result"]["schema_version"] == "agent_result_v1"
    assert run_update["structured_result"]["confidence"] == 0.7
    assert run_update["structured_result"]["needs_review"] is True
    assert run_update["citations"] == sources


def test_native_worker_with_cited_findings_and_failed_tool_completes_as_partial():
    citations = [
        {
            "source_kind": "founder_dataset",
            "source_id": "22222222-2222-2222-2222-222222222222",
            "label": "Monthly P&L",
        }
    ]
    findings = [
        {
            "finding_type": "granular_tool_result",
            "tool_name": "get_dataset_periods",
            "status": "completed",
            "source_count": 1,
        }
    ]

    assert _native_granular_worker_outcome(
        tool_failed=True,
        findings=findings,
        citations=citations,
    ) == ("completed", "partial", True)

    client = _LifecycleWriteClient()
    complete_native_child_run(
        client,
        user_id="founder-1",
        run_id="child-run-1",
        status="completed",
        semantic_status="partial",
        degraded=True,
        result_summary=f"Structured worker completed partially. {NATIVE_PARTIAL_RESULT_MARKER}",
        citations=citations,
        finding_summaries=findings,
        failure_summaries=[
            {
                "tool_name": "run_structured_query",
                "error_type": "StructuredQueryError",
                "error_message": "Approved surfaces: founder_dataset_rows.",
            }
        ],
    )

    update = client.writes[-1][2]
    structured = update["structured_result"]
    assert update["status"] == "completed"
    assert structured["status"] == "partial"
    assert structured["partial"] is True
    assert structured["degraded"] is True
    assert structured["needs_review"] is True
    assert structured["degradation"]["marker"] == NATIVE_PARTIAL_RESULT_MARKER
    assert structured["degradation"]["failed_tool_calls"][0]["tool_name"] == "run_structured_query"


def test_native_worker_with_failed_tool_and_no_cited_findings_still_fails():
    assert _native_granular_worker_outcome(
        tool_failed=True,
        findings=[],
        citations=[],
    ) == ("failed", "failed", False)


def test_partial_failure_context_teaches_worker_to_return_marker_to_lead():
    context = _native_partial_failure_context(has_usable_citations=True)

    assert context["hookSpecificOutput"]["hookEventName"] == "PostToolUseFailure"
    assert NATIVE_PARTIAL_RESULT_MARKER in context["hookSpecificOutput"]["additionalContext"]
    assert _native_partial_failure_context(has_usable_citations=False) == {}


def test_native_access_gate_allows_only_the_compiled_owner_grant():
    grants = {
        "structured_data_agent": {"list_founder_datasets", "get_dataset_periods"},
        "per_user_wiki": {"wiki_search", "wiki_get_page"},
    }

    allowed, reason = native_tool_access_decision(
        tool_name="mcp__architectos__get_dataset_periods",
        agent_id_present=True,
        agent_type="structured_data_agent",
        lead_tool_names={"wiki_list", "get_dataset_periods", "execute_code"},
        agent_tool_grants=grants,
    )

    assert allowed is True
    assert "structured_data_agent" in reason


def test_native_access_gate_refuses_a_sibling_tool_with_actionable_wording():
    allowed, reason = native_tool_access_decision(
        tool_name="mcp__architectos__wiki_search",
        agent_id_present=True,
        agent_type="structured_data_agent",
        lead_tool_names={"wiki_list", "get_dataset_periods", "execute_code"},
        agent_tool_grants={
            "structured_data_agent": {"get_dataset_periods"},
            "per_user_wiki": {"wiki_search"},
        },
    )

    assert allowed is False
    assert "per_user_wiki" in reason
    assert "Task" in reason


def test_native_access_gate_refuses_lead_worker_work_and_allows_mode_b():
    grants = {"structured_data_agent": {"run_structured_query"}}
    denied, refusal = native_tool_access_decision(
        tool_name="mcp__architectos__run_structured_query",
        agent_id_present=False,
        agent_type="",
        lead_tool_names={"wiki_list", "get_dataset_periods", "execute_code"},
        agent_tool_grants=grants,
    )
    allowed, _reason = native_tool_access_decision(
        tool_name="mcp__architectos__get_dataset_periods",
        agent_id_present=False,
        agent_type="",
        lead_tool_names={"wiki_list", "get_dataset_periods", "execute_code"},
        agent_tool_grants=grants,
    )

    assert denied is False
    assert "structured_data_agent" in refusal
    assert "Task" in refusal
    assert allowed is True


def test_compute_gate_requires_a_prior_successful_cited_retrieval():
    denied, refusal = compute_gate_decision(
        tool_name="mcp__architectos__execute_code",
        successful_retrievals={},
    )
    unbound, unbound_reason = compute_gate_decision(
        tool_name="mcp__architectos__execute_code",
        tool_input={"code": "rows_source = 'dataset-alpha'\ntotal_q2 = 117_000\nprint(total_q2)"},
        successful_retrievals={
            "read-tool-use-1": _RetrievalBinding(
                tool_use_id="read-tool-use-1",
                tool_name="get_dataset_periods",
                source_tokens={"dataset-alpha"},
                numeric_tokens={"130000"},
            )
        },
    )
    allowed, reason = compute_gate_decision(
        tool_name="mcp__architectos__execute_code",
        tool_input={
            "code": "rows_source = 'dataset-alpha'\nvalues = [130_000]\nprint(sum(values))"
        },
        successful_retrievals={
            "read-tool-use-1": _RetrievalBinding(
                tool_use_id="read-tool-use-1",
                tool_name="get_dataset_periods",
                source_tokens={"dataset-alpha"},
                numeric_tokens={"130000"},
            )
        },
    )

    assert denied is False
    assert "successful cited read-only retrieval" in refusal
    assert unbound is False
    assert "117000" in unbound_reason
    assert allowed is True
    assert "read-tool-use-1" in reason


def test_child_usage_uses_the_approved_task_parent_map():
    """The SDK's parent_tool_use_id is the worker key after the Task prompt passes the access hook."""

    message = AssistantMessage(
        content=[
            ToolUseBlock(
                id="worker-tool-1",
                name="mcp__architectos__get_dataset_periods",
                input={},
            )
        ],
        model="claude-haiku-test",
        parent_tool_use_id="task-sandbox",
    )

    assert _assistant_worker_capability(
        message,
        task_capabilities={
            "task-sandbox": "sandbox_execution_agent",
            "task-structured": "structured_data_agent",
        },
        allowed_capabilities=(
            "structured_data_agent",
            "sandbox_execution_agent",
            "per_user_wiki",
        ),
    ) == "sandbox_execution_agent"


def test_child_usage_falls_back_to_task_id_for_the_workers_final_message():
    message = AssistantMessage(
        content=[],
        model="claude-haiku-test",
        parent_tool_use_id="task-wiki",
    )

    assert _assistant_worker_capability(
        message,
        task_capabilities={"task-wiki": "per_user_wiki"},
        allowed_capabilities=("per_user_wiki",),
    ) == "per_user_wiki"


def test_child_usage_run_id_comes_from_the_authoritative_worker_result_map():
    assert _child_run_id_for_capability(
        "structured_data_agent",
        worker_results={
            "structured_data_agent": SimpleNamespace(run_id="child-structured"),
            "sandbox_execution_agent": SimpleNamespace(run_id="child-sandbox"),
        },
    ) == "child-structured"


class _Registry:
    class _Definition:
        def __init__(self, name: str):
            self.name = name
            self.description = f"Use {name}."
            self.json_schema = {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            }

    def __init__(self, *, delay: float = 0.0):
        self.delay = delay
        self.calls = []
        self._definitions = {
            name: self._Definition(name)
            for name in (
                "ask_user",
                "execute_code",
                "get_dataset_periods",
                "list_founder_datasets",
                "run_structured_query",
                "wiki_get_page",
                "wiki_list",
                "wiki_search",
            )
        }

    def get(self, name: str):
        return self._definitions[name]

    def execute(self, name: str, _context: ToolExecutionContext, args: dict):
        self.calls.append((name, args))
        if self.delay:
            time.sleep(self.delay)
        return ToolResultEnvelope(
            content={"result_count": 1},
            sources=[ToolSourceRef(source_kind="wiki_page", source_id="page-1", label="Margin")],
        )


class _FlagQuery:
    def __init__(self, rows=None, error: Exception | None = None):
        self._rows = rows or []
        self._error = error

    def select(self, *_args):
        return self

    def eq(self, *_args):
        return self

    def limit(self, *_args):
        return self

    def execute(self):
        if self._error:
            raise self._error
        return type("Response", (), {"data": self._rows})()


class _FlagClient:
    def __init__(self, rows=None, error: Exception | None = None):
        self.query = _FlagQuery(rows, error)

    def table(self, name: str):
        assert name == "platform_ai_settings"
        return self.query


def _capture_sdk_tools(monkeypatch):
    captured = {}

    def fake_server(*, name, version, tools):
        captured.update({"name": name, "version": version, "tools": tools})
        return {"type": "sdk", "name": name, "tools": tools}

    monkeypatch.setattr("services.vcso_sdk_config.create_sdk_mcp_server", fake_server)
    return captured


def _consume(generator):
    events = []
    while True:
        try:
            events.append(next(generator))
        except StopIteration as stop:
            return events, stop.value


def test_sdk_flag_is_fail_closed_and_founder_scoped():
    client = _FlagClient(error=RuntimeError("unavailable"))
    assert read_sdk_loop_settings(client, "founder-1") == {"enabled": False, "settings": {}}

    settings = {"enabled_for_all": False, "test_user_ids": ["founder-1"]}
    client = _FlagClient(rows=[{"is_enabled": False, "settings": settings}])
    assert read_sdk_loop_settings(client, "founder-1")["enabled"] is False

    client = _FlagClient(rows=[{"is_enabled": True, "settings": settings}])
    assert read_sdk_loop_settings(client, "founder-1")["enabled"] is True
    assert read_sdk_loop_settings(client, "other-founder")["enabled"] is False


def test_composer_integrity_refuses_missing_compute_without_substitute_arithmetic():
    answer, decision = _enforce_composer_integrity(
        "Margin falls 20% and runway is 8.7 months based on $45k monthly revenue.",
        founder_question="If my top two clients churn, what would it do to margin and runway?",
        successful_cited_compute=False,
    )

    assert answer == COMPUTE_INTEGRITY_REFUSAL
    assert decision == "refused_missing_compute"
    assert "20%" not in answer
    assert "8.7" not in answer
    assert "$45k" not in answer


def test_composer_integrity_passes_successful_cited_compute():
    result = SimpleNamespace(
        status="completed",
        structured_result={"status": "completed", "margin_change_pct": -12},
        citations=[{"source_id": "compute-run-1", "label": "Sandbox computation"}],
    )
    assert _successful_cited_compute_result(
        worker_results={"sandbox_execution_agent": result}
    ) is True

    answer, decision = _enforce_composer_integrity(
        "The cited scenario reduces margin by 12% [1].",
        founder_question="Calculate the margin impact if the top two clients churn.",
        successful_cited_compute=True,
    )
    assert answer == "The cited scenario reduces margin by 12% [1]."
    assert decision == "passed_cited_compute"


def test_composer_integrity_refuses_successful_but_uncited_compute():
    answer, decision = _enforce_composer_integrity(
        "The scenario reduces margin by 12%.",
        founder_question="Calculate the margin impact if the top two clients churn.",
        successful_cited_compute=True,
    )

    assert answer == COMPUTE_INTEGRITY_REFUSAL
    assert decision == "refused_uncited_compute"


def test_composer_integrity_does_not_misclassify_qualitative_what_would_you_do():
    answer = "I would protect the renewal conversation before changing the offer."
    guarded, decision = _enforce_composer_integrity(
        answer,
        founder_question="What would you do about this client relationship?",
        successful_cited_compute=False,
    )

    assert guarded == answer
    assert decision == "not_required"


def test_composer_integrity_passes_cited_retrieval_and_qualitative_answer():
    answer = "Stored revenue is $480k [economic_foundation]. Protect the renewal conversation first."

    guarded, decision = _enforce_composer_integrity(
        answer,
        founder_question="What revenue is currently on record, and what should I prioritize?",
        successful_cited_compute=False,
    )

    assert guarded == answer
    assert decision == "not_required"


def test_composer_integrity_refuses_degraded_compute():
    result = SimpleNamespace(
        status="completed",
        structured_result={"status": "could_not_compute", "needs_review": True},
        citations=[{"source_id": "stale-input", "label": "Incomplete input"}],
    )
    assert _successful_cited_compute_result(
        worker_results={"sandbox_execution_agent": result}
    ) is False

    answer, decision = _enforce_composer_integrity(
        "Using assumptions, runway is 2.5 months.",
        founder_question="Project runway if my two largest clients churn.",
        successful_cited_compute=False,
    )
    assert answer == COMPUTE_INTEGRITY_REFUSAL
    assert decision == "refused_missing_compute"


def test_partial_result_does_not_satisfy_compute_integrity_gate():
    result = SimpleNamespace(
        status="completed",
        structured_result={
            "status": "partial",
            "partial": True,
            "degraded": True,
            "needs_review": True,
        },
        citations=[{"source_kind": "computation", "source_id": "partial-compute"}],
    )

    assert _successful_cited_compute_result(
        worker_results={"sandbox_execution_agent": result}
    ) is False


def test_standard_sdk_turn_compiles_registry_tools_and_normalizes_lifecycle(monkeypatch):
    captured = _capture_sdk_tools(monkeypatch)
    traces = []
    usages = []
    registry = _Registry()

    async def fake_query(*, prompt, options):
        assert prompt == "Selected founder context"
        assert "standard Virtual CSO loop" in options.system_prompt
        assert options.allowed_tools == [
            "mcp__architectos__wiki_search",
            "mcp__architectos__wiki_get_page",
        ]
        assert options.include_partial_messages is True
        assert options.thinking == {"type": "disabled"}
        sdk_tool = captured["tools"][0]
        post_hook = options.hooks["PostToolUse"][0].hooks[0]
        stop_hook = options.hooks["Stop"][0].hooks[0]
        hook_input = {
            "tool_name": "mcp__architectos__wiki_search",
            "tool_input": {"query": "margin"},
            "tool_response": {"private": "payload"},
        }
        yield StreamEvent(
            uuid="1",
            session_id="session-1",
            event={
                "type": "content_block_start",
                "content_block": {
                    "type": "tool_use",
                    "id": "tool-1",
                    "name": "mcp__architectos__wiki_search",
                },
            },
        )
        await sdk_tool.handler({"query": "margin"})
        await post_hook(hook_input, "tool-1", None)
        await stop_hook({"hook_event_name": "Stop"}, None, None)
        yield StreamEvent(
            uuid="2",
            session_id="session-1",
            event={"type": "content_block_delta", "delta": {"type": "text_delta", "text": "Margin "}},
        )
        yield StreamEvent(
            uuid="3",
            session_id="session-1",
            event={"type": "content_block_delta", "delta": {"type": "text_delta", "text": "is stable."}},
        )
        yield ResultMessage(
            subtype="success",
            duration_ms=12,
            duration_api_ms=10,
            is_error=False,
            num_turns=2,
            session_id="session-1",
            total_cost_usd=0.001,
            usage={
                "input_tokens": 20,
                "cache_read_input_tokens": 30,
                "cache_creation_input_tokens": 40,
                "output_tokens": 4,
            },
            result="Margin is stable.",
        )

    monkeypatch.setattr("services.vcso_sdk_loop._record_post_tool_trace", lambda **kwargs: traces.append(("tool", kwargs)))
    monkeypatch.setattr("services.vcso_sdk_loop._record_turn_trace", lambda **kwargs: traces.append(("turn", kwargs)))
    events, result = _consume(
        stream_vcso_sdk_turn(
            prompt="Selected founder context",
            system_prompt="Virtual CSO system prompt",
            model="claude-sonnet-test",
            api_key="test-key",
            registry=registry,
            tool_names=["wiki_search", "wiki_get_page"],
            tool_context=ToolExecutionContext(user_id="user-1"),
            trace_metadata={"run_id": "run-1"},
            initial_sources=[{"source_kind": "wiki_claim", "source_id": "claim-1", "label": "Claim"}],
            step_index_offset=3,
            usage_sink=usages.append,
            query_impl=fake_query,
        )
    )

    assert registry.calls == [("wiki_search", {"query": "margin"})]
    assert [item["data"]["text"] for item in events if item["event"] == "token"] == ["Margin ", "is stable."]
    assert {item["data"]["channel"] for item in events if item["event"] == "token"} == {"answer"}
    assert next(item for item in events if item["event"] == "tool_call")["data"]["stepIndex"] == 4
    assert next(item for item in events if item["event"] == "tool_call")["data"]["input"] == {}
    assert next(item for item in events if item["event"] == "tool_result")["data"]["output"] == "{}"
    assert "private" not in str(events)
    assert "partial_json" not in str(events)
    assert result.answer_text == "Margin is stable."
    assert result.input_tokens == 90
    assert result.output_tokens == 4
    assert result.tool_step_count == 1
    assert len(result.sources) == 2
    assert result.turn_trace_emitted is True
    assert result.usage_recorded is True
    assert usages[0].input_tokens == 90
    assert [kind for kind, _payload in traces] == ["tool", "turn"]


def test_standard_sdk_turn_emits_heartbeat_while_registry_tool_runs(monkeypatch):
    captured = _capture_sdk_tools(monkeypatch)
    registry = _Registry(delay=0.03)

    async def fake_query(*, options, **_kwargs):
        hook_input = {"tool_name": "mcp__architectos__wiki_search", "tool_input": {"query": "margin"}}
        yield StreamEvent(
            uuid="1",
            session_id="session-2",
            event={
                "type": "content_block_start",
                "content_block": {
                    "type": "tool_use",
                    "id": "tool-1",
                    "name": "mcp__architectos__wiki_search",
                },
            },
        )
        await captured["tools"][0].handler({"query": "margin"})
        await options.hooks["PostToolUse"][0].hooks[0](hook_input, "tool-1", None)
        await options.hooks["Stop"][0].hooks[0]({}, None, None)
        yield ResultMessage(
            subtype="success",
            duration_ms=40,
            duration_api_ms=20,
            is_error=False,
            num_turns=2,
            session_id="session-2",
            result="Done.",
        )

    monkeypatch.setattr("services.vcso_sdk_loop._record_post_tool_trace", lambda **_kwargs: None)
    monkeypatch.setattr("services.vcso_sdk_loop._record_turn_trace", lambda **_kwargs: None)
    events, _result = _consume(
        stream_vcso_sdk_turn(
            prompt="Founder prompt",
            system_prompt="System",
            model="claude-sonnet-test",
            api_key="test-key",
            registry=registry,
            tool_names=["wiki_search"],
            tool_context=ToolExecutionContext(user_id="user-1"),
            trace_metadata={"run_id": "run-1"},
            heartbeat_seconds=0.01,
            tool_timeout_seconds=0.2,
            query_impl=fake_query,
        )
    )
    assert any(item["event"] == "heartbeat" for item in events)


def test_sdk_stream_uses_final_result_only_as_non_streaming_fallback(monkeypatch):
    _capture_sdk_tools(monkeypatch)

    async def fake_query(*, options, **_kwargs):
        await options.hooks["Stop"][0].hooks[0]({}, None, None)
        yield ResultMessage(
            subtype="success",
            duration_ms=1,
            duration_api_ms=1,
            is_error=False,
            num_turns=1,
            session_id="session-3",
            result="Fallback chunk.",
        )

    monkeypatch.setattr("services.vcso_sdk_loop._record_turn_trace", lambda **_kwargs: None)
    events, result = _consume(
        stream_vcso_sdk_turn(
            prompt="Founder prompt",
            system_prompt="System",
            model="claude-sonnet-test",
            api_key="test-key",
            registry=_Registry(),
            tool_names=[],
            tool_context=ToolExecutionContext(user_id="user-1"),
            trace_metadata={"run_id": "run-1"},
            query_impl=fake_query,
        )
    )
    assert events == [
        {
            "event": "token",
            "data": {"text": "Fallback chunk.", "channel": "answer", "sdkMode": True},
        }
    ]
    assert result.tool_step_count == 0


def test_sdk_stream_separates_curated_narration_from_persisted_answer(monkeypatch):
    _capture_sdk_tools(monkeypatch)

    async def fake_query(*, options, **_kwargs):
        for index, text in enumerate(
            ("<nar", "ration>Now I'll review the margin record.</nar", "ration>", "Margin is stable.")
        ):
            yield StreamEvent(
                uuid=str(index),
                session_id="session-4",
                event={"type": "content_block_delta", "delta": {"type": "text_delta", "text": text}},
            )
        await options.hooks["Stop"][0].hooks[0]({}, None, None)
        yield ResultMessage(
            subtype="success",
            duration_ms=4,
            duration_api_ms=3,
            is_error=False,
            num_turns=2,
            session_id="session-4",
            result="Margin is stable.",
        )

    monkeypatch.setattr("services.vcso_sdk_loop._record_turn_trace", lambda **_kwargs: None)
    events, result = _consume(
        stream_vcso_sdk_turn(
            prompt="Founder prompt",
            system_prompt="System",
            model="claude-sonnet-test",
            api_key="test-key",
            registry=_Registry(),
            tool_names=[],
            tool_context=ToolExecutionContext(user_id="user-1"),
            trace_metadata={"run_id": "run-1"},
            query_impl=fake_query,
        )
    )

    narration = "".join(
        item["data"]["text"]
        for item in events
        if item["event"] == "token" and item["data"]["channel"] == "narration"
    )
    answer = "".join(
        item["data"]["text"]
        for item in events
        if item["event"] == "token" and item["data"]["channel"] == "answer"
    )
    assert narration == "Now I'll review the margin record."
    assert answer == "Margin is stable."
    assert result.answer_text == "Margin is stable."
    assert result.narration_segments == [
        {"segmentId": 1, "text": "Now I'll review the margin record."}
    ]
    assert "<narration>" not in str(events)


def test_native_subagent_effort_scaling_is_limited_to_the_p4_thin_slice():
    required = native_subagent_requirements(
        message=(
            "Use our P&L and revenue data to identify client concentration and margin risk, "
            "then recommend the next 90 days."
        ),
        intent={"move_type": "strategic_synthesis", "depth": "deep"},
    )
    assert required == (
        "structured_data_agent",
        "sandbox_execution_agent",
        "per_user_wiki",
    )
    assert native_subagent_requirements(
        message="What was last month's revenue?",
        intent={"move_type": "strategic_synthesis", "depth": "standard"},
    ) == ()
    assert native_subagent_requirements(
        message="Summarize the latest plan.",
        intent={"move_type": "lookup", "depth": "deep"},
    ) == ()
    assert native_subagent_requirements(
        message=(
            "Use our P&L and revenue data to identify client concentration and margin risk, "
            "then recommend the next 90 days."
        ),
        intent={"move_type": "strategic_synthesis", "depth": "deep"},
        user_id="founder-1",
        settings={
            "diagnostic_single_worker_enabled": True,
            "diagnostic_single_worker": "structured_data_agent",
            "diagnostic_user_ids": ["founder-1"],
        },
    ) == ("structured_data_agent",)
    assert native_subagent_requirements(
        message=(
            "Use our P&L and revenue data to identify client concentration and margin risk, "
            "then recommend the next 90 days."
        ),
        intent={"move_type": "strategic_synthesis", "depth": "deep"},
        user_id="founder-other",
        settings={
            "diagnostic_single_worker_enabled": True,
            "diagnostic_single_worker": "structured_data_agent",
            "diagnostic_user_ids": ["founder-1"],
        },
    ) == required


def test_native_surface_eligibility_is_flag_plus_founder_allowlist_only():
    armed = {
        "native_model_driven_enabled": True,
        "diagnostic_user_ids": ["founder-1"],
        "native_subagent_scope": "p4_thin_slice_only",
    }

    assert native_subagent_requirements(
        message="Give me a concise hello.",
        intent={"move_type": "lookup", "depth": "shallow"},
        user_id="founder-1",
        settings=armed,
    ) == NATIVE_SURFACE_REQUIRED_AGENTS
    assert native_subagent_requirements(
        message="Give me a concise hello.",
        intent={"move_type": "lookup", "depth": "shallow"},
        user_id="founder-other",
        settings=armed,
    ) == ()
    assert native_subagent_requirements(
        message="Give me a concise hello.",
        intent={"move_type": "lookup", "depth": "shallow"},
        user_id="founder-1",
        settings={**armed, "native_model_driven_enabled": False},
    ) == ()


def test_g_gate_model_choice_scope_is_exact_and_founder_scoped():
    armed = {
        "native_subagent_scope": G_GATE_MODEL_CHOICE_SCOPE,
        "native_model_driven_enabled": True,
        "diagnostic_user_ids": ["founder-1"],
    }

    assert native_subagent_requirements(
        message="What's the difference between AGI and gross revenue?",
        intent={"move_type": "lookup", "depth": "shallow"},
        user_id="founder-1",
        settings=armed,
    ) == G_GATE_CANDIDATE_AGENTS
    assert native_subagent_requirements(
        message="Should I raise my prices?",
        intent={"move_type": "reflect_and_steer", "depth": "standard"},
        user_id="founder-other",
        settings=armed,
    ) == ()
    assert native_subagent_requirements(
        message="Should I raise my prices?",
        intent={"move_type": "reflect_and_steer", "depth": "standard"},
        user_id="founder-1",
        settings={**armed, "native_model_driven_enabled": False},
    ) == ()
    assert native_subagent_requirements(
        message="Should I raise my prices?",
        intent={"move_type": "reflect_and_steer", "depth": "standard"},
        user_id="founder-1",
        settings={**armed, "native_subagent_scope": "p4_thin_slice_only"},
    ) == NATIVE_SURFACE_REQUIRED_AGENTS


def test_g_gate_prompt_requires_smallest_sufficient_worker_set():
    prompt = _native_generalization_prompt(G_GATE_CANDIDATE_AGENTS)

    assert "smallest sufficient set" in prompt
    assert "none, one, or more" in prompt
    assert "clarify the founder's goal" in prompt
    assert "Sandbox may run only after structured_data_agent completes" in prompt
    assert "must delegate exactly once to each approved worker" not in prompt


def test_native_model_driven_worker_uses_in_process_grants_and_lifecycle_hooks(monkeypatch):
    _capture_sdk_tools(monkeypatch)
    required = ("structured_data_agent",)
    monkeypatch.setattr(
        "services.vcso_sdk_config.AgentCapabilityRegistry.list_active",
        lambda _self: [_native_capability(key) for key in required],
    )
    monkeypatch.setattr("services.vcso_sdk_loop._record_post_tool_trace", lambda **_kwargs: None)
    monkeypatch.setattr("services.vcso_sdk_loop._record_turn_trace", lambda **_kwargs: None)
    lifecycle_events = []
    client = _LifecycleWriteClient()

    class NativeStore(_NativeStore):
        def __init__(self):
            self.client = client

    contract = json.dumps(
        {
            "objective": "Read the founder's cited structured dataset.",
            "output_format": "compact cited finding",
            "tools_sources": ["founder_dataset"],
            "boundaries": ["founder isolation", "citations required", "compact output"],
            "context_scope": {"founder_dataset_ids": ["dataset-1"]},
        }
    )

    async def fake_query(*, options, **_kwargs):
        assert options.tools == ["Task"]
        assert "vcso_workers" not in dict(options.mcp_servers or {})
        assert "architectos" in dict(options.mcp_servers or {})
        agent = options.agents["structured_data_agent"]
        assert agent.tools == [
            "mcp__architectos__list_founder_datasets",
            "mcp__architectos__get_dataset_periods",
            "mcp__architectos__run_structured_query",
        ]
        assert agent.mcpServers == ["architectos"]
        assert set(options.allowed_tools).issuperset(set(agent.tools) | {"Task"})

        pre_task = options.hooks["PreToolUse"][0].hooks[0]
        decision = await pre_task(
            {
                "tool_name": "Agent",
                "tool_input": {"subagent_type": "structured_data_agent", "prompt": contract},
                "agent_id": None,
            },
            "task-1",
            None,
        )
        assert decision["hookSpecificOutput"]["permissionDecision"] == "allow"
        await options.hooks["SubagentStart"][0].hooks[0](
            {"agent_id": "sub-1", "agent_type": "structured_data_agent"},
            None,
            None,
        )
        access_gate = options.hooks["PreToolUse"][1].hooks[0]
        assert await access_gate(
            {
                "tool_name": "mcp__architectos__get_dataset_periods",
                "agent_id": "sub-1",
                "agent_type": "structured_data_agent",
            },
            "worker-call-1",
            None,
        ) == {}
        post = options.hooks["PostToolUse"][0].hooks[0]
        await post(
            {
                "tool_name": "mcp__architectos__get_dataset_periods",
                "agent_id": "sub-1",
                "agent_type": "structured_data_agent",
            },
            "worker-call-1",
            None,
        )
        await options.hooks["SubagentStop"][0].hooks[0](
            {"agent_id": "sub-1", "agent_type": "structured_data_agent"},
            None,
            None,
        )
        failure = options.hooks["PostToolUseFailure"][0].hooks[0]
        await failure(
            {
                "tool_name": "mcp__architectos__execute_code",
                "error": (
                    'MCP error: {"error_type":"SandboxServiceError",'
                    '"error_message":"No active sandbox service."}'
                ),
            },
            "lead-compute-failure",
            None,
        )
        await post({"tool_name": "Agent"}, "task-1", None)
        assert await options.hooks["Stop"][0].hooks[0]({}, None, None) == {}

        yield ResultMessage(
            subtype="success",
            duration_ms=25,
            duration_api_ms=20,
            is_error=False,
            num_turns=1,
            session_id="session-model-driven",
            total_cost_usd=0.02,
            usage={"input_tokens": 100, "output_tokens": 10},
            result="Cited recommendation.",
        )

    _events, result = _consume(
        stream_vcso_sdk_turn(
            prompt="Summarize the cited dataset.",
            system_prompt="System\n\nRules remain bounded.",
            model="claude-sonnet-test",
            api_key="test-key",
            registry=ToolRegistry(),
            tool_names=[],
            tool_context=ToolExecutionContext(
                user_id="founder-1",
                store=NativeStore(),
                thread_id="thread-1",
                metadata={"surface": "virtual_cso", "parent_run_id": "lead-run"},
            ),
            trace_metadata={"run_id": "lead-run"},
            native_subagent_required_agents=required,
            native_subagent_scopes={"structured_data_agent": {"founder_dataset_ids": ["dataset-1"]}},
            native_lifecycle_sink=lifecycle_events.append,
            native_model_driven=True,
            query_impl=fake_query,
        )
    )

    assert result.answer_text == "Cited recommendation."
    manifest = next(event for event in lifecycle_events if event["event"] == "runtime_manifest")
    assert manifest["decision"] == "native_granular"
    rewrite = next(
        event for event in lifecycle_events if event["event"] == "delegation_input_rewrite"
    )
    assert rewrite["input_state"] == "absent"
    assert rewrite["tool_use_id"] == "task-1"
    failure = next(
        event for event in lifecycle_events if event["event"] == "post_tool_use_failure"
    )
    assert failure["error_type"] == "SandboxServiceError"
    assert failure["error_message"] == "No active sandbox service."
    assert any(table == "agent_delegation_steps" for table, _operation, _payload in client.writes)


def test_native_worker_with_cited_read_then_failed_tool_returns_partial_in_band(monkeypatch):
    captured = _capture_sdk_tools(monkeypatch)
    monkeypatch.setattr(
        "services.vcso_sdk_config.AgentCapabilityRegistry.list_active",
        lambda _self: [_native_capability("structured_data_agent")],
    )
    monkeypatch.setattr("services.vcso_sdk_loop._record_post_tool_trace", lambda **_kwargs: None)
    monkeypatch.setattr("services.vcso_sdk_loop._record_turn_trace", lambda **_kwargs: None)
    client = _LifecycleWriteClient()

    class NativeStore(_NativeStore):
        def __init__(self):
            self.client = client

    registry = ToolRegistry()

    def execute_tool(name, _context, _args):
        if name == "get_dataset_periods":
            return ToolResultEnvelope(
                content={
                    "structured_result": {
                        "status": "completed",
                        "row_count": 1,
                        "truncated": False,
                    }
                },
                sources=[
                    ToolSourceRef(
                        source_kind="founder_dataset",
                        source_id="22222222-2222-2222-2222-222222222222",
                        label="Monthly P&L",
                    )
                ],
            )
        if name == "run_structured_query":
            raise RuntimeError("Query references an unapproved dataset surface.")
        raise AssertionError(f"unexpected tool: {name}")

    monkeypatch.setattr(registry, "execute", execute_tool)

    async def fake_query(*, options, **_kwargs):
        pre_task = options.hooks["PreToolUse"][0].hooks[0]
        await pre_task(
            {
                "tool_name": "Agent",
                "tool_input": {
                    "subagent_type": "structured_data_agent",
                    "prompt": _delegation_contract("Read the founder's cited structured dataset."),
                },
            },
            "task-1",
            None,
        )
        await options.hooks["SubagentStart"][0].hooks[0](
            {"agent_id": "sub-1", "agent_type": "structured_data_agent"},
            None,
            None,
        )
        tools = {item.name: item for item in captured["tools"]}
        read_result = await tools["get_dataset_periods"].handler({"dataset_id": "dataset-1"})
        assert read_result.get("is_error") is not True
        post = options.hooks["PostToolUse"][0].hooks[0]
        await post(
            {
                "tool_name": "mcp__architectos__get_dataset_periods",
                "agent_id": "sub-1",
                "agent_type": "structured_data_agent",
            },
            "worker-read-1",
            None,
        )
        failed_result = await tools["run_structured_query"].handler(
            {"question": "Aggregate", "generated_sql": "select * from invented"}
        )
        assert failed_result["is_error"] is True
        failure_context = await options.hooks["PostToolUseFailure"][0].hooks[0](
            {
                "tool_name": "mcp__architectos__run_structured_query",
                "agent_id": "sub-1",
                "agent_type": "structured_data_agent",
                "error": RuntimeError(failed_result["content"][0]["text"]),
            },
            "worker-query-2",
            None,
        )
        assert NATIVE_PARTIAL_RESULT_MARKER in str(failure_context)
        await options.hooks["SubagentStop"][0].hooks[0](
            {"agent_id": "sub-1", "agent_type": "structured_data_agent"},
            None,
            None,
        )
        await post({"tool_name": "Agent"}, "task-1", None)
        assert await options.hooks["Stop"][0].hooks[0]({}, None, None) == {}
        yield ResultMessage(
            subtype="success",
            duration_ms=1,
            duration_api_ms=1,
            is_error=False,
            num_turns=1,
            session_id="session-partial",
            result="The structured worker returned partial cited findings.",
        )

    _events, result = _consume(
        stream_vcso_sdk_turn(
            prompt="Summarize the available structured data.",
            system_prompt="System\n\nRules remain bounded.",
            model="claude-sonnet-test",
            api_key="test-key",
            registry=registry,
            tool_names=[],
            tool_context=ToolExecutionContext(
                user_id="founder-1",
                store=NativeStore(),
                thread_id="thread-1",
                metadata={"surface": "virtual_cso", "parent_run_id": "lead-run"},
            ),
            trace_metadata={"run_id": "lead-run"},
            native_subagent_required_agents=("structured_data_agent",),
            native_subagent_scopes={
                "structured_data_agent": {"founder_dataset_ids": ["dataset-1"]}
            },
            native_model_driven=True,
            query_impl=fake_query,
        )
    )

    assert result.worker_runs[0]["status"] == "completed"
    assert result.worker_runs[0]["semantic_status"] == "partial"
    assert result.worker_runs[0]["partial"] is True
    child_update = next(
        payload
        for table, operation, payload in client.writes
        if table == "agent_delegation_runs"
        and operation == "update"
        and payload.get("structured_result", {}).get("status") == "partial"
    )
    assert child_update["status"] == "completed"
    assert NATIVE_PARTIAL_RESULT_MARKER in child_update["result_summary"]


@pytest.mark.skip(reason="Phase G runtime-shape migration is deferred; eligibility logic remains unchanged.")
def test_g_gate_model_choice_allows_a_direct_answer_with_zero_children(monkeypatch):
    _capture_sdk_tools(monkeypatch)
    monkeypatch.setattr(
        "services.vcso_sdk_config.AgentCapabilityRegistry.list_active",
        lambda _self: [_native_capability(key) for key in G_GATE_CANDIDATE_AGENTS],
    )
    monkeypatch.setattr("services.vcso_sdk_loop._record_post_tool_trace", lambda **_kwargs: None)
    monkeypatch.setattr("services.vcso_sdk_loop._record_turn_trace", lambda **_kwargs: None)

    async def fake_query(*, options, **_kwargs):
        assert set(options.agents) == set(G_GATE_CANDIDATE_AGENTS)
        assert "smallest sufficient set" in options.system_prompt
        assert await options.hooks["Stop"][0].hooks[0]({}, None, None) == {}
        yield ResultMessage(
            subtype="success",
            duration_ms=1,
            duration_api_ms=1,
            is_error=False,
            num_turns=1,
            session_id="session-direct",
            total_cost_usd=0.01,
            usage={"input_tokens": 20, "output_tokens": 8},
            result="AGI is adjusted gross income; gross revenue is top-line receipts.",
        )

    events, result = _consume(
        stream_vcso_sdk_turn(
            prompt="What's the difference between AGI and gross revenue?",
            system_prompt="System\n\nRules remain bounded.",
            model="claude-sonnet-test",
            api_key="test-key",
            registry=_Registry(),
            tool_names=[],
            tool_context=ToolExecutionContext(
                user_id="founder-1",
                store=_NoChildrenStore(),
                thread_id="thread-1",
                metadata={"surface": "virtual_cso", "parent_run_id": "lead-run"},
            ),
            trace_metadata={"run_id": "lead-run"},
            native_subagent_required_agents=G_GATE_CANDIDATE_AGENTS,
            native_subagent_scopes={},
            native_model_driven=True,
            native_model_choice=True,
            query_impl=fake_query,
        )
    )

    assert result.answer_text.startswith("AGI is adjusted gross income")
    assert not [event for event in events if event["event"] == "todos_updated"]
    assert not result.worker_runs


@pytest.mark.skip(reason="Phase G runtime-shape migration is deferred; eligibility logic remains unchanged.")
def test_g_gate_model_choice_enforces_only_the_workers_the_lead_selected(monkeypatch):
    _capture_sdk_tools(monkeypatch)
    monkeypatch.setattr(
        "services.vcso_sdk_config.AgentCapabilityRegistry.list_active",
        lambda _self: [_native_capability(key) for key in G_GATE_CANDIDATE_AGENTS],
    )
    monkeypatch.setattr("services.vcso_sdk_loop._record_post_tool_trace", lambda **_kwargs: None)
    monkeypatch.setattr("services.vcso_sdk_loop._record_turn_trace", lambda **_kwargs: None)
    contract = json.dumps(
        {
            "objective": "Retrieve the founder's compiled growth constraint and explain its evidence.",
            "output_format": "compact cited findings",
            "tools_sources": ["founder_wiki"],
            "boundaries": ["founder isolation", "citations required", "compact output"],
            "context_scope": {"wiki_page": "growth_constraints"},
        }
    )

    async def fake_query(*, options, **_kwargs):
        pre = options.hooks["PreToolUse"][0].hooks[0]
        decision = await pre(
            {
                "tool_name": "Agent",
                "tool_input": {"subagent_type": "per_user_wiki", "prompt": contract},
                "agent_id": None,
            },
            "task-wiki",
            None,
        )
        assert decision["hookSpecificOutput"]["permissionDecision"] == "allow"
        post = options.hooks["PostToolUse"][0].hooks[0]
        await post({"tool_name": "Agent"}, "task-wiki", None)
        assert await options.hooks["Stop"][0].hooks[0]({}, None, None) == {}
        yield ResultMessage(
            subtype="success",
            duration_ms=1,
            duration_api_ms=1,
            is_error=False,
            num_turns=1,
            session_id="session-wiki",
            total_cost_usd=0.02,
            usage={"input_tokens": 30, "output_tokens": 10},
            result="The compiled diagnostic identifies one binding growth constraint.",
        )

    events, result = _consume(
        stream_vcso_sdk_turn(
            prompt="What did my diagnostics flag as the biggest growth constraint?",
            system_prompt="System\n\nRules remain bounded.",
            model="claude-sonnet-test",
            api_key="test-key",
            registry=_Registry(),
            tool_names=[],
            tool_context=ToolExecutionContext(
                user_id="founder-1",
                store=_AllCompletedStore(),
                thread_id="thread-1",
                metadata={"surface": "virtual_cso", "parent_run_id": "lead-run"},
            ),
            trace_metadata={"run_id": "lead-run"},
            native_subagent_required_agents=G_GATE_CANDIDATE_AGENTS,
            native_subagent_scopes={"per_user_wiki": {"wiki_page": "growth_constraints"}},
            native_model_driven=True,
            native_model_choice=True,
            query_impl=fake_query,
        )
    )

    assert result.answer_text.startswith("The compiled diagnostic")
    task_steps = [
        event["data"]
        for event in events
        if event["event"] == "tool_result" and event["data"].get("tool") == "Task"
    ]
    assert [step["capabilityKey"] for step in task_steps] == ["per_user_wiki"]
    final_todos = [event["data"]["todos"] for event in events if event["event"] == "todos_updated"][-1]
    assert [todo["id"] for todo in final_todos] == ["per_user_wiki", "compose"]


def test_sdk_stream_capture_drops_token_deltas_but_keeps_agent_tool_start(monkeypatch):
    diagnostics = []

    async def fake_query(**_kwargs):
        yield StreamEvent(
            uuid="delta-1",
            session_id="session-filter",
            event={
                "type": "content_block_delta",
                "delta": {"type": "text_delta", "text": "private token"},
            },
        )
        yield StreamEvent(
            uuid="agent-start",
            session_id="session-filter",
            event={
                "type": "content_block_start",
                "content_block": {
                    "type": "tool_use",
                    "name": "Agent",
                    "id": "agent-task-from-stream",
                },
            },
        )
        yield UserMessage(
            content=[
                ToolResultBlock(
                    tool_use_id="agent-task-from-stream",
                    content="private agent result",
                    is_error=False,
                )
            ],
            tool_use_result={"status": "completed"},
        )
        yield ResultMessage(
            subtype="success",
            duration_ms=1,
            duration_api_ms=1,
            is_error=False,
            num_turns=1,
            session_id="session-filter",
            result="private result",
        )

    generator, _lifecycle = _model_driven_turn(
        monkeypatch,
        fake_query=fake_query,
        stream_diagnostic_events=diagnostics,
    )
    with pytest.raises(RuntimeError, match="before required workers completed"):
        _consume(generator)

    stream_events = [
        event
        for event in diagnostics
        if event["event"] == "sdk_stream_message"
        and event["object_type"] == "StreamEvent"
    ]
    assert [event["status"] for event in stream_events] == ["content_block_start"]
    assert any(
        event["event"] == "agent_tool_result"
        and event["tool_use_id"] == "agent-task-from-stream"
        for event in diagnostics
    )
    assert "private token" not in json.dumps(diagnostics)
    assert "private agent result" not in json.dumps(diagnostics)


def test_sdk_stream_capture_distinguishes_failed_subagent_stop_from_missing_hook(monkeypatch):
    diagnostics = []

    async def fake_query(*, options, **_kwargs):
        for index in range(250):
            yield StreamEvent(
                uuid=f"message-delta-{index}",
                session_id="session-hook-budget",
                event={"type": "message_delta", "delta": {"stop_reason": None}},
            )
        subagent_stop = options.hooks["SubagentStop"][0].hooks[0]
        await subagent_stop(
            {
                "agent_id": "agent-without-child-row",
                "agent_type": "structured_data_agent",
            },
            "agent-task-1",
            None,
        )
        if False:
            yield None

    generator, _lifecycle = _model_driven_turn(
        monkeypatch,
        fake_query=fake_query,
        stream_diagnostic_events=diagnostics,
    )
    with pytest.raises(RuntimeError, match="evidence gap"):
        _consume(generator)

    stop_events = [
        event
        for event in diagnostics
        if event.get("hook_event") == "SubagentStop"
    ]
    assert [event["phase"] for event in stop_events] == ["start", "exception"]
    assert stop_events[-1]["error_type"] == "RuntimeError"
    truncation = next(
        event for event in diagnostics if event["event"] == "sdk_stream_capture_truncated"
    )
    assert truncation["dropped_count"] == 10
    terminal = next(
        event for event in diagnostics if event["event"] == "sdk_iteration_terminated"
    )
    assert terminal["termination"] == "exception"
    assert terminal["error_type"] == "RuntimeError"


def test_sdk_stream_capture_records_agent_post_tool_use_failure(monkeypatch):
    diagnostics = []

    async def fake_query(*, options, **_kwargs):
        post_failure = options.hooks["PostToolUseFailure"][0].hooks[0]
        await post_failure(
            {
                "tool_name": "Agent",
                "error": RuntimeError("private exception detail"),
            },
            "agent-task-failed",
            None,
        )
        if False:
            yield None

    generator, _lifecycle = _model_driven_turn(
        monkeypatch,
        fake_query=fake_query,
        stream_diagnostic_events=diagnostics,
    )
    with pytest.raises(RuntimeError, match="before required workers completed"):
        _consume(generator)

    failure = next(
        event for event in diagnostics if event["event"] == "agent_tool_hook_result"
    )
    assert failure["hook_event"] == "PostToolUseFailure"
    assert failure["status"] == "failed"
    assert failure["is_error"] is True
    terminal = next(
        event for event in diagnostics if event["event"] == "sdk_iteration_terminated"
    )
    assert terminal["termination"] == "exhaustion"
    assert "private exception detail" not in json.dumps(diagnostics)


def test_cheap_give_up_stops_blocking_a_lead_that_will_not_delegate(monkeypatch):
    """SDK-M3 step A3. Canary 9: the lead never delegated, the stop_hook blocked over and over, and the
    turn ground to max_turns for ~$0.107 with no answer. Past the cap the hook stops blocking so the turn
    terminates at once. It still FAILS -- the founder reaches the partial-answer surface -- just far
    sooner and far cheaper. Nothing is fail-opened."""

    stop_results = []

    async def fake_query(*, options, **_kwargs):
        stop = options.hooks["Stop"][0].hooks[0]
        for _ in range(4):
            stop_results.append(await stop({}, None, None))
        yield ResultMessage(
            subtype="success",
            duration_ms=1,
            duration_api_ms=1,
            is_error=False,
            num_turns=1,
            session_id="session-giveup",
            result="",
        )

    generator, lifecycle_events = _model_driven_turn(monkeypatch, fake_query=fake_query)
    with pytest.raises(RuntimeError, match="before required workers completed"):
        _consume(generator)

    assert [result.get("decision") for result in stop_results] == ["block", "block", None, None]
    give_ups = [event for event in lifecycle_events if event["event"] == "delegation_give_up"]
    assert len(give_ups) == 1
    assert give_ups[0]["decision"] == "stop"
    assert "delegations=0" in give_ups[0]["reason_code"]


@pytest.mark.skip(reason="External DB completion bridge is unused; native SubagentStop supplies in-band completion.")
def test_give_up_budget_resets_when_a_worker_actually_completes(monkeypatch):
    """The nudge must keep working. A block that LANDS (a worker completes after it) resets the budget, so
    a compliant-but-forgetful lead is never cut off mid-progress."""

    stop_results = []

    async def fake_query(*, options, **_kwargs):
        stop = options.hooks["Stop"][0].hooks[0]
        post = options.hooks["PostToolUse"][0].hooks[0]
        pre_task = options.hooks["PreToolUse"][0].hooks[0]
        stop_results.append(await stop({}, None, None))  # block 1
        stop_results.append(await stop({}, None, None))  # block 2, still nothing delegated
        await pre_task(
            {
                "tool_name": "Agent",
                "tool_input": {
                    "subagent_type": "structured_data_agent",
                    "prompt": _delegation_contract(
                        "Quantify client concentration from the founder dataset"
                    ),
                },
                "agent_id": None,
            },
            "task-1",
            None,
        )
        # The DB completion bridge is what marks a model-driven worker done: the child row lands now.
        _LateCompletionClient.completed = True
        await post({"tool_name": "Agent"}, "task-1", None)
        stop_results.append(await stop({}, None, None))  # required worker present -> clean stop
        yield StreamEvent(
            uuid="answer",
            session_id="session-reset",
            event={
                "type": "content_block_delta",
                "delta": {"type": "text_delta", "text": "Cited 90-day recommendation."},
            },
        )
        yield ResultMessage(
            subtype="success",
            duration_ms=1,
            duration_api_ms=1,
            is_error=False,
            num_turns=1,
            session_id="session-reset",
            total_cost_usd=0.02,
            usage={"input_tokens": 10, "output_tokens": 5},
            result="Cited 90-day recommendation.",
        )

    _LateCompletionClient.completed = False
    generator, lifecycle_events = _model_driven_turn(
        monkeypatch, fake_query=fake_query, store=_LateCompletionStore()
    )
    _events, result = _consume(generator)

    assert result.answer_text == "Cited 90-day recommendation."
    assert [item.get("decision") for item in stop_results] == ["block", "block", None]
    assert not [event for event in lifecycle_events if event["event"] == "delegation_give_up"]


def test_deep_ask_user_defers_after_buffering_answer_and_wires_session_store(monkeypatch):
    captured: dict[str, object] = {}
    lifecycle_events: list[dict[str, object]] = []
    session_store = object()

    async def fake_query(*, options, **_kwargs):
        captured["options"] = options
        pause_hook = options.hooks["PreToolUse"][0].hooks[0]
        decision = await pause_hook(
            {
                "tool_name": "mcp__architectos__ask_user",
                "tool_input": {
                    "question": "Which market should I prioritize?",
                    "reason_code": "founder_priority",
                    "retrieval_attempted": True,
                },
            },
            "tool-question-1",
            None,
        )
        assert decision["hookSpecificOutput"]["permissionDecision"] == "defer"
        yield StreamEvent(
            uuid="answer-before-defer",
            session_id="11111111-1111-1111-1111-111111111111",
            event={
                "type": "content_block_delta",
                "delta": {"type": "text_delta", "text": "This must not reach the founder."},
            },
        )
        yield ResultMessage(
            subtype="success",
            duration_ms=1,
            duration_api_ms=1,
            is_error=False,
            num_turns=1,
            session_id="11111111-1111-1111-1111-111111111111",
            result="This must not reach the founder.",
            deferred_tool_use=DeferredToolUse(
                id="tool-question-1",
                name="mcp__architectos__ask_user",
                input={"question": "Which market should I prioritize?"},
            ),
        )

    monkeypatch.setattr("services.vcso_sdk_loop._record_turn_trace", lambda **_kwargs: None)
    monkeypatch.setattr(
        "services.vcso_sdk_loop.sdk_runtime_pin_status",
        lambda: {"ok": True},
    )
    monkeypatch.setattr(
        "services.vcso_sdk_loop.build_native_model_driven_manifest",
        lambda _compiled, **_kwargs: {"violations": []},
    )
    native_capabilities = [
        AgentCapability(
            capability_key="structured_data_agent",
            label="Structured Data Agent",
            description="Read bounded structured founder data.",
            status="experimental",
            allowed_surfaces=["virtual_cso"],
            allowed_tools=[
                "list_founder_datasets",
                "get_dataset_periods",
                "run_structured_query",
            ],
            default_config={"max_rounds": 2},
        ),
        AgentCapability(
            capability_key="per_user_wiki",
            label="Per User Wiki",
            description="Read founder wiki context.",
            status="experimental",
            allowed_surfaces=["virtual_cso"],
            allowed_tools=["wiki_search", "wiki_get_page", "wiki_list"],
            default_config={"max_rounds": 2},
        ),
    ]
    monkeypatch.setattr(
        "services.agent_capabilities.AgentCapabilityRegistry.list_active",
        lambda _self: native_capabilities,
    )
    monkeypatch.setattr(
        "services.vcso_sdk_config.AgentCapabilityRegistry.list_active",
        lambda _self: native_capabilities,
    )
    events, result = _consume(
        stream_vcso_sdk_turn(
            prompt="Start the deep task.",
            system_prompt="System",
            model="claude-sonnet-test",
            api_key="test-key",
            registry=_Registry(),
            tool_names=[],
            tool_context=ToolExecutionContext(
                user_id="founder-1",
                store=SimpleNamespace(
                    resolve_platform_model=lambda **kwargs: {
                        "provider": kwargs["fallback_provider"],
                        "model_name": kwargs["fallback_model_name"],
                    }
                ),
            ),
            trace_metadata={"run_id": "run-pause"},
            query_impl=fake_query,
            native_subagent_required_agents=NATIVE_SURFACE_REQUIRED_AGENTS,
            native_lifecycle_sink=lifecycle_events.append,
            native_model_driven=True,
            session_store=session_store,
            enable_ask_user_pause=True,
        )
    )

    options = captured["options"]
    assert options.session_store is session_store
    assert options.session_store_flush == "batched"
    assert not [event for event in events if event["event"] == "token"]
    assert result.answer_text == ""
    assert result.deferred_tool_use_id == "tool-question-1"
    assert result.deferred_question == "Which market should I prioritize?"
    assert result.deferred_classification == {
        "classification": "pause",
        "reason_code": "founder_priority",
        "retrieval_attempted": False,
        "preference_retrieval_attempted": False,
        "model_claimed_retrieval_attempted": True,
        "observed_retrievals": [],
        "preference_retrievals": [],
        "single_question": True,
        "question_count": 1,
        "missing_reason_code": False,
        "retrieved_context_summary_present": False,
        "observation": "retrieval_not_attempted_before_pause",
    }
    classification_events = [
        event
        for event in lifecycle_events
        if event.get("event") == "ask_user_classification"
    ]
    assert len(classification_events) == 1
    assert classification_events[0] | {"sequence": 0} == {
        "sequence": 0,
        "event": "ask_user_classification",
        "decision": "pause",
        "reason_code": "founder_priority",
        "retrieval_attempted": False,
        "preference_retrieval_attempted": False,
        "model_claimed_retrieval_attempted": True,
        "single_question": True,
        "observed_retrieval_count": 0,
        "preference_retrieval_count": 0,
        "question_count": 1,
        "observed_retrievals": [],
        "preference_retrievals": [],
    }


def test_ask_user_preference_retrieval_signal_ignores_structured_data_reads():
    retrievals = {
        "structured-read": _RetrievalBinding(
            tool_use_id="structured-read",
            tool_name="get_dataset_periods",
            source_tokens=set(),
            numeric_tokens=set(),
        ),
        "wiki-read": _RetrievalBinding(
            tool_use_id="wiki-read",
            tool_name="wiki_get_page",
            source_tokens=set(),
            numeric_tokens=set(),
        ),
    }

    assert _ask_user_observed_retrievals(retrievals) == [
        {"tool_use_id": "structured-read", "tool_name": "get_dataset_periods"},
        {"tool_use_id": "wiki-read", "tool_name": "wiki_get_page"},
    ]
    assert _ask_user_preference_retrievals(retrievals) == [
        {"tool_use_id": "wiki-read", "tool_name": "wiki_get_page"},
    ]


def test_deep_resume_allows_only_persisted_question_replay_and_emits_final_answer(monkeypatch):
    captured: dict[str, object] = {}
    session_store = object()

    async def fake_query(*, prompt, options):
        captured["options"] = options
        assert prompt == "Prioritize healthcare."
        pause_hook = options.hooks["PreToolUse"][0].hooks[0]
        replay = await pause_hook(
            {
                "tool_name": "mcp__architectos__ask_user",
                "tool_input": {"question": "Which market should I prioritize?"},
            },
            "tool-question-1",
            None,
        )
        assert replay["hookSpecificOutput"]["permissionDecision"] == "allow"
        yield StreamEvent(
            uuid="final-answer",
            session_id="11111111-1111-1111-1111-111111111111",
            event={
                "type": "content_block_delta",
                "delta": {"type": "text_delta", "text": "Healthcare is now the priority."},
            },
        )
        yield ResultMessage(
            subtype="success",
            duration_ms=1,
            duration_api_ms=1,
            is_error=False,
            num_turns=1,
            session_id="11111111-1111-1111-1111-111111111111",
            result="Healthcare is now the priority.",
        )

    monkeypatch.setattr("services.vcso_sdk_loop._record_turn_trace", lambda **_kwargs: None)
    events, result = _consume(
        stream_vcso_sdk_turn(
            prompt="Prioritize healthcare.",
            system_prompt="System",
            model="claude-sonnet-test",
            api_key="test-key",
            registry=_Registry(),
            tool_names=[],
            tool_context=ToolExecutionContext(user_id="founder-1"),
            trace_metadata={"run_id": "run-resume"},
            query_impl=fake_query,
            session_store=session_store,
            resume_session_id="11111111-1111-1111-1111-111111111111",
            pending_ask_user_tool_use_id="tool-question-1",
            enable_ask_user_pause=True,
        )
    )

    options = captured["options"]
    assert options.resume == "11111111-1111-1111-1111-111111111111"
    assert options.fork_session is False
    assert [event["data"]["text"] for event in events if event["event"] == "token"] == [
        "Healthcare is now the priority."
    ]
    assert result.answer_text == "Healthcare is now the priority."



