from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from types import SimpleNamespace

import pytest
from claude_agent_sdk.types import ResultMessage, StreamEvent

sys.path.insert(0, str(Path(__file__).parents[1]))

from services.agent_capabilities import AgentCapability
from services.tool_registry import ToolExecutionContext, ToolResultEnvelope, ToolSourceRef
from services.vcso_sdk_loop import (
    _native_synthesis_prompt,
    native_subagent_requirements,
    read_sdk_loop_settings,
    stream_vcso_sdk_turn,
)


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
        self._definitions = {name: self._Definition(name) for name in ("wiki_search", "wiki_get_page")}

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


def test_app_owned_synthesis_prompt_carries_compact_cited_findings():
    prompt = _native_synthesis_prompt(
        ("structured_data_agent",),
        [
            {
                "capability_key": "structured_data_agent",
                "run_id": "child-run-1",
                "structured_result": {"margin": "18%"},
                "citations": [{"source_id": "dataset-1", "label": "Latest P&L"}],
            }
        ],
    )

    assert "PHASE-D APP-OWNED SYNTHESIS" in prompt
    assert "child-run-1" in prompt
    assert '"margin": "18%"' in prompt
    assert "dataset-1" in prompt
    assert "ONLY authoritative evidence" in prompt
    assert "Do not call any tools" in prompt


def test_app_owned_synthesis_prompt_bounds_worker_payload_size():
    prompt = _native_synthesis_prompt(
        ("structured_data_agent",),
        [{"result_summary": "x" * 20000}],
    )

    payload = prompt.split("WORKER FINDINGS (JSON)\n", 1)[1].split(
        "\n\nCompose the founder's answer", 1
    )[0]
    assert len(payload) == 12000


class _NativeClient:
    def table(self, _name):
        return _FlagQuery(error=RuntimeError("not required by this unit test"))


class _NativeStore:
    client = _NativeClient()

    def resolve_platform_model(self, *, setting_key, fallback_model_name, fallback_provider):
        if setting_key == "tier_worker":
            return {"provider": "anthropic", "model_name": "claude-haiku-test"}
        return {"provider": fallback_provider, "model_name": fallback_model_name}


def _native_capability(key: str) -> AgentCapability:
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


def test_app_owned_workers_run_before_synthesis_with_no_lead_delegation_surface(monkeypatch):
    _capture_sdk_tools(monkeypatch)
    required = (
        "structured_data_agent",
        "sandbox_execution_agent",
        "per_user_wiki",
    )
    # Mandatory compute chain first (structured -> sandbox), best-effort strategic context last, so a wiki
    # failure can never pre-empt sandbox (vcso_sdk_loop.run_app_owned_workers, "Improvement #1", v0.6.57).
    execution_order = (
        "structured_data_agent",
        "sandbox_execution_agent",
        "per_user_wiki",
    )
    monkeypatch.setattr(
        "services.vcso_sdk_config.AgentCapabilityRegistry.list_active",
        lambda _self: [_native_capability(key) for key in required],
    )
    calls = []
    usages = []
    lifecycle_events = []

    class FakeOrchestrator:
        def __init__(self, _store):
            pass

        def start_run(self, request):
            calls.append(request)
            request.progress_callback(
                {
                    "stepIndex": 1,
                    "stepType": "context_build",
                    "title": "Context prepared",
                    "summary": "Prepared founder-scoped evidence.",
                    "status": "completed",
                    "sourceRefs": [],
                }
            )
            source = {
                "source_kind": "founder_dataset" if request.capability_key != "per_user_wiki" else "wiki_page",
                "source_id": f"source-{request.capability_key}",
                "label": f"Evidence for {request.capability_key}",
            }
            return SimpleNamespace(
                run_id=f"run-{request.capability_key}",
                status="completed",
                result_summary=f"Completed {request.capability_key}.",
                structured_result={"finding": request.capability_key},
                citations=[source],
                trace=[],
            )

    monkeypatch.setattr("services.vcso_sdk_loop.SubAgentOrchestrator", FakeOrchestrator)
    monkeypatch.setattr("services.vcso_sdk_loop._record_post_tool_trace", lambda **_kwargs: None)
    monkeypatch.setattr("services.vcso_sdk_loop._record_turn_trace", lambda **_kwargs: None)
    async def fake_query(*, options, **_kwargs):
        # App-owned workers must all finish before the paid synthesis query starts.
        assert [request.capability_key for request in calls] == list(execution_order)
        assert options.allowed_tools == []
        assert options.agents == {}
        assert all("Task" not in tool for tool in options.allowed_tools)
        assert all("run_" not in tool for tool in options.allowed_tools)
        assert all(
            "run_" not in tool
            for agent in options.agents.values()
            for tool in (agent.tools or [])
        )
        assert "delegate_to_sub_agent" not in options.system_prompt
        assert "PHASE-D APP-OWNED SYNTHESIS" in options.system_prompt
        assert "WORKER FINDINGS (JSON)" in options.system_prompt
        assert all(f"run-{key}" in options.system_prompt for key in required)
        assert all(key in options.system_prompt for key in required)
        assert "PreToolUse" not in options.hooks
        assert "SubagentStart" not in options.hooks

        stop = await options.hooks["Stop"][0].hooks[0]({}, None, None)
        assert stop == {}
        yield StreamEvent(
            uuid="answer",
            session_id="session-native",
            event={
                "type": "content_block_delta",
                "delta": {"type": "text_delta", "text": "Cited 90-day recommendation."},
            },
        )
        yield ResultMessage(
            subtype="success",
            duration_ms=25,
            duration_api_ms=20,
            is_error=False,
            num_turns=1,
            session_id="session-native",
            total_cost_usd=0.02,
            usage={"input_tokens": 100, "output_tokens": 10},
            result="Cited 90-day recommendation.",
        )

    events, result = _consume(
        stream_vcso_sdk_turn(
            prompt="P4 thin-slice prompt",
            system_prompt=(
                "System\n\nYou may call tools mid-turn. Use tool_search to discover relevant tools or skill packs before\n"
                "using specialized tools. Prefer direct registry tools for narrow reads/computations, and\n"
                "delegate_to_sub_agent for bounded research or sandbox work that should run in a compact\n"
                "sub-agent window.\n\nRules remain bounded."
            ),
            model="claude-sonnet-test",
            api_key="test-key",
            registry=_Registry(),
            tool_names=[],
            tool_context=ToolExecutionContext(
                user_id="founder-1",
                store=_NativeStore(),
                thread_id="thread-1",
                metadata={"surface": "virtual_cso", "parent_run_id": "lead-run"},
            ),
            trace_metadata={"run_id": "lead-run"},
            native_subagent_required_agents=required,
            native_subagent_scopes={
                "structured_data_agent": {"founder_dataset_ids": ["dataset-1"]},
                "sandbox_execution_agent": {"thread_id": "thread-1"},
                "per_user_wiki": {"query": "pricing constraint"},
            },
            usage_sink=usages.append,
            native_lifecycle_sink=lifecycle_events.append,
            query_impl=fake_query,
        )
    )

    assert [request.capability_key for request in calls] == list(execution_order)
    assert all(request.delegation_depth == 1 for request in calls)
    assert all(request.routing_tier_override == "worker" for request in calls)
    assert all(request.enforce_compact_contract is True for request in calls)
    assert all(request.parent_run_id == "lead-run" for request in calls)
    sandbox_call = calls[execution_order.index("sandbox_execution_agent")]
    assert "prior_findings" not in sandbox_call.context_scope
    assert "COMPACT PRIOR FINDINGS" in sandbox_call.task_summary
    assert len([item for item in events if item["event"] == "sub_agent_step"]) == 3
    assert len([item for item in events if item["event"] == "sources_updated"]) == 3
    assert result.answer_text == "Cited 90-day recommendation."
    assert [run["capability_key"] for run in result.worker_runs] == list(execution_order)
    assert [usage.role for usage in usages] == ["main"]
    manifest = next(event for event in lifecycle_events if event["event"] == "runtime_manifest")
    assert manifest["decision"] == "app_owned"
    assert not [event for event in lifecycle_events if event["event"] == "task_pre_tool_use"]
    assert not [event for event in lifecycle_events if event["event"] == "subagent_start"]
    entries = [event for event in lifecycle_events if event["event"] == "native_handler_entry"]
    assert len(entries) == 3
    assert all(event["delegated"] is True for event in entries)
    completions = [event for event in lifecycle_events if event["event"] == "native_handler_completion"]
    assert [event["child_run_id"] for event in completions] == [f"run-{key}" for key in execution_order]
    assert "objective" not in str(lifecycle_events)


def test_app_owned_worker_failure_fails_open_to_standard_flat_sdk_path(monkeypatch):
    required = ("structured_data_agent",)
    lifecycle_events = []
    query_called = False

    class FailingOrchestrator:
        def __init__(self, _store):
            pass

        def start_run(self, _request):
            raise RuntimeError("worker unavailable")

    async def fake_query(*, options, **_kwargs):
        nonlocal query_called
        query_called = True
        assert "Task" not in options.allowed_tools
        assert all("run_" not in tool for tool in options.allowed_tools)
        assert "PHASE-D APP-OWNED SYNTHESIS" not in options.system_prompt
        yield ResultMessage(
            subtype="success",
            duration_ms=1,
            duration_api_ms=1,
            is_error=False,
            num_turns=1,
            session_id="session-flat",
            result="Flat fallback answer.",
        )

    monkeypatch.setattr("services.vcso_sdk_loop.SubAgentOrchestrator", FailingOrchestrator)
    monkeypatch.setattr("services.vcso_sdk_loop._record_turn_trace", lambda **_kwargs: None)
    _events, result = _consume(
        stream_vcso_sdk_turn(
            prompt="P4 thin-slice prompt",
            system_prompt="System",
            model="claude-sonnet-test",
            api_key="test-key",
            registry=_Registry(),
            tool_names=[],
            tool_context=ToolExecutionContext(user_id="founder-1", store=_NativeStore()),
            trace_metadata={"run_id": "lead-run"},
            native_subagent_required_agents=required,
            native_lifecycle_sink=lifecycle_events.append,
            query_impl=fake_query,
        )
    )
    assert query_called is True
    failures = [event for event in lifecycle_events if event["event"] == "native_handler_failure"]
    assert len(failures) == 1
    assert failures[0]["capability_key"] == "structured_data_agent"
    assert failures[0]["delegated"] is True
    assert result.answer_text == "Flat fallback answer."


class _ModelDrivenClient:
    """Stands in for the Supabase client behind the model-driven DB completion bridge: the worker runs
    out of process, so `agent_delegation_runs` is the only in-turn evidence that the child completed."""

    def table(self, name: str):
        if name == "agent_delegation_runs":
            return _FlagQuery(rows=[{"capability_key": "structured_data_agent", "status": "completed"}])
        return _FlagQuery(error=RuntimeError("not required by this unit test"))


class _ModelDrivenStore(_NativeStore):
    client = _ModelDrivenClient()


def test_model_driven_lead_delegates_via_task_with_workers_hidden(monkeypatch):
    """Phase D2 / SDK-M2: with `native_model_driven=True` the lead must reason the decomposition and
    delegate via Task, while every `run_<agent>` worker tool stays invisible to it (external per-agent
    MCP server). Path A's app-owned worker run must not fire at all."""

    _capture_sdk_tools(monkeypatch)
    required = ("structured_data_agent",)
    monkeypatch.setattr(
        "services.vcso_sdk_config.AgentCapabilityRegistry.list_active",
        lambda _self: [_native_capability(key) for key in required],
    )
    orchestrator_calls = []
    lifecycle_events = []

    class UnusedOrchestrator:
        def __init__(self, _store):
            pass

        def start_run(self, request):  # pragma: no cover - must never run in model-driven mode
            orchestrator_calls.append(request)
            raise AssertionError("Model-driven delegation must not run app-owned workers in process.")

    monkeypatch.setattr("services.vcso_sdk_loop.SubAgentOrchestrator", UnusedOrchestrator)
    monkeypatch.setattr("services.vcso_sdk_loop._record_post_tool_trace", lambda **_kwargs: None)
    monkeypatch.setattr("services.vcso_sdk_loop._record_turn_trace", lambda **_kwargs: None)

    contract = json.dumps(
        {
            "objective": "Bind the founder's latest ready financial dataset and return compact cited figures.",
            "output_format": "compact_json",
            "tools_sources": ["founder_dataset"],
            "boundaries": ["founder isolation", "citations required", "compact output"],
            "context_scope": {"founder_dataset_ids": ["dataset-1"]},
        }
    )
    worker_tool = "mcp__vcso_workers__run_structured_data_agent"

    async def fake_query(*, options, **_kwargs):
        # 1. The lead's surface: the delegation tool only, no worker handler anywhere it can see.
        #    `tools` must PROVISION it — being in allowed_tools alone means the tool does not exist
        #    (Stage H: the lead then narrates fake delegations until max_turns).
        assert options.tools == ["Task"]
        assert options.allowed_tools == ["Task"]
        # BOTH delegation names must be exempted from disallowed_tools. Blocking the runtime name hands
        # the lead a tool it may never call, which stalls the turn to max_turns.
        assert "Agent" not in (options.disallowed_tools or [])
        assert "Task" not in (options.disallowed_tools or [])
        assert all("__run_" not in tool for tool in options.allowed_tools)
        assert "vcso_workers" not in dict(options.mcp_servers or {})
        agent = options.agents["structured_data_agent"]
        assert agent.tools == [worker_tool]
        inline = agent.mcpServers
        assert inline == [{"vcso_workers": {"type": "http", "url": inline[0]["vcso_workers"]["url"]}}]
        assert "?t=" in inline[0]["vcso_workers"]["url"]
        json.dumps(inline)  # the inline config must survive CLI serialization
        assert "PreToolUse" in options.hooks

        # 2. The lead reasons a decomposition and delegates. The model emits the RUNTIME tool name
        #    ("Agent"), not the provision name ("Task") — matchers keyed to "Task" never fire, which is
        #    why Stage H recorded no task_pre_tool_use and stop_hook blocked to max_turns.
        assert options.hooks["PreToolUse"][0].matcher == "Agent"
        assert options.hooks["PostToolUse"][0].matcher == r"^(Agent|mcp__.*)$"
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

        # 3. The worker tool fires from INSIDE the Task-spawned subagent (agent_id present) — the §4 probe.
        probe = options.hooks["PreToolUse"][1].hooks[0]
        assert await probe({"tool_name": worker_tool, "agent_id": "sub-1"}, "call-1", None) == {}

        # 4. Task returns; the DB completion bridge must clear the worker out of process.
        post = options.hooks["PostToolUse"][0].hooks[0]
        await post({"tool_name": "Agent"}, "task-1", None)

        # 5. Stop must not block — the required worker is accounted for.
        assert await options.hooks["Stop"][0].hooks[0]({}, None, None) == {}

        yield StreamEvent(
            uuid="answer",
            session_id="session-model-driven",
            event={
                "type": "content_block_delta",
                "delta": {"type": "text_delta", "text": "Cited 90-day recommendation."},
            },
        )
        yield ResultMessage(
            subtype="success",
            duration_ms=25,
            duration_api_ms=20,
            is_error=False,
            num_turns=1,
            session_id="session-model-driven",
            total_cost_usd=0.02,
            usage={"input_tokens": 100, "output_tokens": 10},
            result="Cited 90-day recommendation.",
        )

    _events, result = _consume(
        stream_vcso_sdk_turn(
            prompt="P4 thin-slice prompt",
            system_prompt="System\n\nRules remain bounded.",
            model="claude-sonnet-test",
            api_key="test-key",
            registry=_Registry(),
            tool_names=[],
            tool_context=ToolExecutionContext(
                user_id="founder-1",
                store=_ModelDrivenStore(),
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

    assert orchestrator_calls == []
    assert result.answer_text == "Cited 90-day recommendation."
    manifest = next(event for event in lifecycle_events if event["event"] == "runtime_manifest")
    assert manifest["decision"] == "model_driven"
    assert manifest["reason_code"] == "none"
    task_events = [event for event in lifecycle_events if event["event"] == "task_pre_tool_use"]
    assert len(task_events) == 1
    assert task_events[0]["decision"] == "allow"
    assert task_events[0]["capability_key"] == "structured_data_agent"
    probes = [event for event in lifecycle_events if event["event"] == "pre_tool_probe"]
    assert len(probes) == 1
    assert probes[0]["agent_id_present"] is True
    assert "objective" not in str(lifecycle_events)
