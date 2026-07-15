from __future__ import annotations

import sys
from pathlib import Path

from claude_agent_sdk.types import ResultMessage, StreamEvent

sys.path.insert(0, str(Path(__file__).parents[1]))

from services.tool_registry import ToolExecutionContext, ToolResultEnvelope, ToolSourceRef
from services.vcso_sdk_loop import read_sdk_loop_settings, stream_vcso_sdk_spike


class _Registry:
    class _Definition:
        description = "Search the founder wiki."
        json_schema = {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
        }

    def get(self, name: str):
        assert name == "wiki_search"
        return self._Definition()

    def execute(self, name: str, _context: ToolExecutionContext, args: dict):
        assert name == "wiki_search"
        assert args["query"] == "margin"
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


def test_sdk_flag_is_fail_closed_and_founder_scoped():
    client = _FlagClient(error=RuntimeError("unavailable"))
    assert read_sdk_loop_settings(client, "founder-1") == {"enabled": False, "settings": {}}

    settings = {"enabled_for_all": False, "test_user_ids": ["founder-1"]}
    client = _FlagClient(rows=[{"is_enabled": False, "settings": settings}])
    assert read_sdk_loop_settings(client, "founder-1")["enabled"] is False

    client = _FlagClient(rows=[{"is_enabled": True, "settings": settings}])
    assert read_sdk_loop_settings(client, "founder-1")["enabled"] is True
    assert read_sdk_loop_settings(client, "other-founder")["enabled"] is False


def test_sdk_stream_preserves_partial_text_deltas_and_curates_tool_events(monkeypatch):
    traced = []

    async def fake_query(*, prompt, options):
        assert prompt == "Founder prompt"
        assert options.include_partial_messages is True
        assert options.thinking == {"type": "disabled"}
        yield StreamEvent(
            uuid="1",
            session_id="session-1",
            event={
                "type": "content_block_start",
                "content_block": {"type": "tool_use", "id": "tool-1", "name": "mcp__architectos__wiki_search"},
            },
        )
        await options.hooks["PostToolUse"][0].hooks[0](
            {"tool_name": "mcp__architectos__wiki_search", "tool_input": {"query": "margin"}, "tool_response": {"private": "payload"}},
            "tool-1",
            None,
        )
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
            usage={"input_tokens": 20, "output_tokens": 4},
            result="Margin is stable.",
        )

    monkeypatch.setattr("services.vcso_sdk_loop._record_post_tool_trace", lambda **kwargs: traced.append(kwargs))
    generator = stream_vcso_sdk_spike(
        prompt="Founder prompt",
        model="claude-sonnet-test",
        api_key="test-key",
        registry=_Registry(),
        tool_context=ToolExecutionContext(user_id="user-1"),
        trace_metadata={"run_id": "run-1"},
        query_impl=fake_query,
    )
    events = []
    while True:
        try:
            events.append(next(generator))
        except StopIteration as stop:
            result = stop.value
            break

    assert [item["data"]["text"] for item in events if item["event"] == "token"] == [
        "Margin ",
        "is stable.",
    ]
    tool_call = next(item for item in events if item["event"] == "tool_call")
    assert tool_call["data"]["input"] == {}
    tool_result = next(item for item in events if item["event"] == "tool_result")
    assert tool_result["data"]["output"] == "{}"
    assert "partial_json" not in str(events)
    assert "private" not in str(events)
    assert traced == [
        {
            "metadata": {"run_id": "run-1"},
            "tool_name": "mcp__architectos__wiki_search",
            "tool_use_id": "tool-1",
        }
    ]
    assert result.answer_text == "Margin is stable."
    assert result.input_tokens == 20
    assert result.output_tokens == 4


def test_sdk_stream_uses_final_result_only_as_non_streaming_fallback(monkeypatch):
    async def fake_query(**_kwargs):
        yield ResultMessage(
            subtype="success",
            duration_ms=1,
            duration_api_ms=1,
            is_error=False,
            num_turns=1,
            session_id="session-2",
            result="Fallback chunk.",
        )

    monkeypatch.setattr("services.vcso_sdk_loop._record_post_tool_trace", lambda **_kwargs: None)
    events = list(
        stream_vcso_sdk_spike(
            prompt="Founder prompt",
            model="claude-sonnet-test",
            api_key="test-key",
            registry=_Registry(),
            tool_context=ToolExecutionContext(user_id="user-1"),
            trace_metadata={"run_id": "run-1"},
            query_impl=fake_query,
        )
    )
    assert events == [{"event": "token", "data": {"text": "Fallback chunk."}}]
