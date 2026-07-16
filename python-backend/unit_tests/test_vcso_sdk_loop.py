from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from types import SimpleNamespace

import pytest
from claude_agent_sdk.types import AssistantMessage, ResultMessage, StreamEvent

sys.path.insert(0, str(Path(__file__).parents[1]))

from services.agent_capabilities import AgentCapability
from services.tool_registry import ToolExecutionContext, ToolResultEnvelope, ToolSourceRef
from services.vcso_sdk_loop import (
    build_native_runtime_manifest,
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


def test_native_runtime_manifest_exposes_lead_surface_and_prompt_conflict():
    handler = "mcp__architectos__run_structured_data_agent"
    compiled = SimpleNamespace(
        options=SimpleNamespace(
            allowed_tools=["Task", handler],
            disallowed_tools=["Bash", "Agent"],
            agents={
                "structured_data_agent": SimpleNamespace(
                    tools=[handler],
                    mcpServers=["architectos"],
                )
            },
            system_prompt=(
                "Use delegate_to_sub_agent for bounded research. "
                "PHASE-D NATIVE SUBAGENT CONTRACT. Use only Task."
            ),
        ),
        tool_names=["delegate_to_sub_agent", "wiki_search"],
        agent_handler_tools={"structured_data_agent": "run_structured_data_agent"},
    )

    manifest = build_native_runtime_manifest(
        compiled,
        required_agents=("structured_data_agent",),
    )

    assert manifest["lead_selected_registry_tools"] == ["delegate_to_sub_agent", "wiki_search"]
    assert manifest["prompt_contract_order"] == {
        "legacy_delegate_instruction_present": True,
        "native_contract_present": True,
        "native_contract_after_legacy": True,
    }
    assert manifest["violations"] == [
        "native_lead_registry_tools_registered",
        "native_prompt_contains_legacy_delegation_instruction",
    ]


def test_native_runtime_manifest_violations_fail_before_sdk_query(monkeypatch):
    handler = "mcp__architectos__run_structured_data_agent"
    compiled = SimpleNamespace(
        options=SimpleNamespace(
            allowed_tools=["Task", handler],
            disallowed_tools=[],
            agents={
                "structured_data_agent": SimpleNamespace(
                    tools=[handler],
                    mcpServers=["architectos"],
                )
            },
            system_prompt="PHASE-D NATIVE SUBAGENT CONTRACT. Use only Task.",
        ),
        tool_names=["wiki_search"],
        agent_handler_tools={"structured_data_agent": "run_structured_data_agent"},
    )
    monkeypatch.setattr("services.vcso_sdk_loop.compile_founder_sdk_options", lambda **_kwargs: compiled)
    query_called = False

    async def fake_query(**_kwargs):
        nonlocal query_called
        query_called = True
        if False:
            yield None

    with pytest.raises(RuntimeError, match="isolation invariant failed before query"):
        _consume(
            stream_vcso_sdk_turn(
                prompt="P4 thin-slice prompt",
                system_prompt="System",
                model="claude-sonnet-test",
                api_key="test-key",
                registry=_Registry(),
                tool_names=["wiki_search"],
                tool_context=ToolExecutionContext(user_id="founder-1", store=_NativeStore()),
                trace_metadata={"run_id": "lead-run"},
                native_subagent_required_agents=("structured_data_agent",),
                query_impl=fake_query,
            )
        )
    assert query_called is False


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


def test_native_subagents_enforce_all_children_order_depth_tiers_and_curated_events(monkeypatch):
    captured = _capture_sdk_tools(monkeypatch)
    required = (
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
    child_traces = []
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
    monkeypatch.setattr(
        "services.vcso_sdk_loop._record_native_child_trace",
        lambda **kwargs: child_traces.append(kwargs),
    )

    def contract(capability_key: str, *, prior_findings=None):
        scope = {"dataset_ids": ["dataset-1"]}
        if prior_findings is not None:
            scope["prior_findings"] = prior_findings
        return {
            "objective": f"Return the bounded {capability_key} finding.",
            "output_format": "Compact cited finding",
            "tools_sources": ["founder-scoped sources"],
            "boundaries": ["Read only", "No recursive delegation"],
            "context_scope": scope,
        }

    async def fake_query(*, options, **_kwargs):
        assert options.allowed_tools == [
            "Task",
            "mcp__architectos__run_structured_data_agent",
            "mcp__architectos__run_sandbox_execution_agent",
            "mcp__architectos__run_per_user_wiki",
        ]
        assert "Task" not in options.disallowed_tools
        assert "delegate_to_sub_agent" not in options.system_prompt
        assert set(options.agents) == set(required)
        assert {agent.model for agent in options.agents.values()} == {"claude-haiku-test"}
        assert {agent.maxTurns for agent in options.agents.values()} == {2}
        assert all("Task" in agent.disallowedTools for agent in options.agents.values())
        assert all("Agent" in agent.disallowedTools for agent in options.agents.values())
        assert all(agent.mcpServers == ["architectos"] for agent in options.agents.values())
        tools = {item.name: item for item in captured["tools"]}
        assert set(tools) == {f"run_{capability_key}" for capability_key in required}
        pre_hook = options.hooks["PreToolUse"][0].hooks[0]
        worker_gate = options.hooks["PreToolUse"][1].hooks[0]
        post_hook = options.hooks["PostToolUse"][-1].hooks[0]
        subagent_start = options.hooks["SubagentStart"][0].hooks[0]
        subagent_stop = options.hooks["SubagentStop"][0].hooks[0]

        direct_decision = await worker_gate(
            {
                "tool_name": "mcp__architectos__run_structured_data_agent",
                "tool_input": {},
            },
            "lead-handler",
            None,
        )
        assert direct_decision["hookSpecificOutput"]["permissionDecision"] == "deny"

        for index, capability_key in enumerate(required, start=1):
            task_id = f"task-{index}"
            await subagent_start(
                {"agent_id": f"agent-{index}", "agent_type": capability_key},
                task_id,
                None,
            )
            task_contract = contract(
                capability_key,
                prior_findings=(
                    {"structured_data_agent": "Bound founder dataset dataset-1."}
                    if capability_key == "sandbox_execution_agent"
                    else None
                ),
            )
            decision = await pre_hook(
                {
                    "tool_name": "Task",
                    "tool_input": {
                        "subagent_type": capability_key,
                        "prompt": json.dumps(task_contract),
                    },
                },
                task_id,
                None,
            )
            assert decision["hookSpecificOutput"]["permissionDecision"] == "allow"
            handler_name = f"run_{capability_key}"
            gate_decision = await worker_gate(
                {
                    "tool_name": f"mcp__architectos__{handler_name}",
                    "agent_id": f"agent-{index}",
                    "agent_type": capability_key,
                    "tool_input": task_contract,
                },
                f"handler-{index}",
                None,
            )
            assert gate_decision == {}
            await tools[handler_name].handler(task_contract)
            await post_hook({"tool_name": "Task", "tool_input": {}}, task_id, None)
            await subagent_stop(
                {"agent_id": f"agent-{index}", "agent_type": capability_key},
                task_id,
                None,
            )

            # Raw child model text is deliberately ignored by the UI stream.
            yield StreamEvent(
                uuid=f"child-{index}",
                session_id="session-native",
                parent_tool_use_id=task_id,
                event={
                    "type": "content_block_delta",
                    "delta": {"type": "text_delta", "text": "PRIVATE CHILD TEXT"},
                },
            )
            yield AssistantMessage(
                content=[],
                model="claude-haiku-test",
                parent_tool_use_id=task_id,
                usage={"input_tokens": 10 * index, "output_tokens": index},
                session_id="session-native",
            )

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
            num_turns=4,
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

    assert [request.capability_key for request in calls] == list(required)
    assert all(request.delegation_depth == 1 for request in calls)
    assert all(request.routing_tier_override == "worker" for request in calls)
    assert all(request.enforce_compact_contract is True for request in calls)
    sandbox_call = calls[1]
    assert "prior_findings" not in sandbox_call.context_scope
    assert "COMPACT PRIOR FINDINGS" in sandbox_call.task_summary
    assert len([item for item in events if item["event"] == "tool_result"]) == 3
    assert len([item for item in events if item["event"] == "sub_agent_step"]) == 3
    assert len([item for item in events if item["event"] == "sources_updated"]) == 3
    assert "PRIVATE CHILD TEXT" not in str(events)
    assert result.answer_text == "Cited 90-day recommendation."
    assert [run["capability_key"] for run in result.worker_runs] == list(required)
    child_usages = [usage for usage in usages if usage.role == "sub_agent"]
    assert [usage.capability_key for usage in child_usages] == list(required)
    assert [usage.run_id for usage in child_usages] == [f"run-{key}" for key in required]
    assert [usage.model for usage in child_usages] == ["claude-haiku-test"] * 3
    assert [(usage.input_tokens, usage.output_tokens) for usage in child_usages] == [
        (10, 1),
        (20, 2),
        (30, 3),
    ]
    assert [trace["run_id"] for trace in child_traces] == [f"run-{key}" for key in required]
    assert lifecycle_events[0]["event"] == "runtime_manifest"
    assert lifecycle_events[0]["decision"] == "clean"
    assert len([event for event in lifecycle_events if event["event"] == "subagent_start"]) == 3
    gates = [event for event in lifecycle_events if event["event"] == "worker_pre_tool_use_gate"]
    assert len(gates) == 4
    assert gates[0]["decision"] == "deny"
    assert gates[0]["agent_id_present"] is False
    assert all(event["decision"] == "allow" for event in gates[1:])
    assert all(event["agent_id_present"] is True for event in gates[1:])
    completions = [event for event in lifecycle_events if event["event"] == "native_handler_completion"]
    assert [event["child_run_id"] for event in completions] == [f"run-{key}" for key in required]
    assert "objective" not in str(lifecycle_events)


def test_native_subagent_guard_blocks_sandbox_before_structured_data(monkeypatch):
    captured = _capture_sdk_tools(monkeypatch)
    required = ("structured_data_agent", "sandbox_execution_agent")
    lifecycle_events = []
    monkeypatch.setattr(
        "services.vcso_sdk_config.AgentCapabilityRegistry.list_active",
        lambda _self: [_native_capability(key) for key in required],
    )

    async def fake_query(*, options, **_kwargs):
        pre_hook = options.hooks["PreToolUse"][0].hooks[0]
        decision = await pre_hook(
            {
                "tool_name": "Task",
                "tool_input": {
                    "subagent_type": "sandbox_execution_agent",
                    "prompt": json.dumps(
                        {
                            "objective": "Compute concentration.",
                            "output_format": "Compact finding",
                            "tools_sources": ["structured data"],
                            "boundaries": ["Read only"],
                            "context_scope": {"prior_findings": {"value": "present"}},
                        }
                    ),
                },
            },
            "task-sandbox",
            None,
        )
        assert decision["hookSpecificOutput"]["permissionDecision"] == "deny"
        assert "structured_data_agent" in decision["hookSpecificOutput"]["permissionDecisionReason"]
        stop = await options.hooks["Stop"][0].hooks[0]({}, None, None)
        assert stop["decision"] == "block"
        assert "sandbox_execution_agent" in stop["reason"]
        yield ResultMessage(
            subtype="success",
            duration_ms=1,
            duration_api_ms=1,
            is_error=False,
            num_turns=1,
            session_id="session-blocked",
            result="Blocked safely.",
        )

    monkeypatch.setattr("services.vcso_sdk_loop._record_turn_trace", lambda **_kwargs: None)
    with pytest.raises(RuntimeError, match="required workers completed"):
        _consume(
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
    denials = [event for event in lifecycle_events if event["event"] == "task_pre_tool_use"]
    assert len(denials) == 1
    assert denials[0]["decision"] == "deny"
    assert denials[0]["capability_key"] == "sandbox_execution_agent"
    assert "tool_input" not in str(lifecycle_events)
