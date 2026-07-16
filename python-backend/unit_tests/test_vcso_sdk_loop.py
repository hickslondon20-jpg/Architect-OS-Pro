from __future__ import annotations

import sys
import time
from pathlib import Path

from claude_agent_sdk.types import ResultMessage, StreamEvent

sys.path.insert(0, str(Path(__file__).parents[1]))

from services.tool_registry import ToolExecutionContext, ToolResultEnvelope, ToolSourceRef
from services.vcso_sdk_loop import read_sdk_loop_settings, stream_vcso_sdk_turn


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
