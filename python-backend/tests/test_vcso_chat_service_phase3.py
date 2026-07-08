from __future__ import annotations

from types import SimpleNamespace

from services.tool_registry import RegistryNativeScopeSource, ToolRegistry
from services.vcso_chat_service import VcsoChatPayload, VcsoChatService


class _FakeMessages:
    def __init__(self) -> None:
        self.create_calls = 0

    def create(self, **_kwargs):
        self.create_calls += 1
        if self.create_calls == 1:
            return SimpleNamespace(
                stop_reason="tool_use",
                usage=SimpleNamespace(input_tokens=12, output_tokens=4),
                content=[
                    SimpleNamespace(
                        type="tool_use",
                        id="toolu_1",
                        name="tool_search",
                        input={"query": "knowledge base", "limit": 3},
                    )
                ],
            )
        return SimpleNamespace(
            stop_reason="end_turn",
            usage=SimpleNamespace(input_tokens=18, output_tokens=3),
            content=[SimpleNamespace(type="text", text="Ready.")],
        )

    def stream(self, **_kwargs):
        return _FakeStream()


class _FakeStream:
    text_stream = ["Final ", "answer."]

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def get_final_message(self):
        return SimpleNamespace(usage=SimpleNamespace(input_tokens=20, output_tokens=6))


class _FakeAnthropic:
    def __init__(self) -> None:
        self.messages = _FakeMessages()


class _FakeSupabase:
    def table(self, _name: str):
        raise RuntimeError("usage logging is best effort in this unit test")


def test_vcso_chat_stream_runs_tool_loop_and_streams_tokens(monkeypatch):
    service = VcsoChatService.__new__(VcsoChatService)
    service.supabase = _FakeSupabase()
    service.store = SimpleNamespace()
    service.settings = SimpleNamespace(claude_synthesis_model="claude-sonnet-4-6")
    service.anthropic_client = _FakeAnthropic()
    service.provider = "anthropic"
    service.model = "claude-sonnet-4-6"

    monkeypatch.setattr(service, "_resolve_model", lambda: None)
    monkeypatch.setattr(
        service,
        "_load_or_create_thread",
        lambda _user_id, _payload: {"id": "thread-1", "message_count": 0, "project_id": None, "title": "Thread"},
    )
    monkeypatch.setattr(
        service,
        "_insert_message",
        lambda thread_id, _user_id, role, content, token_count=None, **_kwargs: {
            "id": f"{role}-1",
            "thread_id": thread_id,
            "role": role,
            "content": content,
            "created_at": "2026-07-03T00:00:00Z",
            "token_count": token_count,
            **({"citations": _kwargs["citations"]} if "citations" in _kwargs else {}),
        },
    )
    monkeypatch.setattr(service, "_update_thread_count", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(service, "_create_main_run", lambda **_kwargs: "run-1")
    created_steps = []
    monkeypatch.setattr(
        service,
        "_create_step",
        lambda *args, **kwargs: created_steps.append({"args": args, "kwargs": kwargs}),
    )
    monkeypatch.setattr(service, "_complete_main_run", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(
        service,
        "_get_thread",
        lambda _thread_id, _user_id: {
            "id": "thread-1",
            "title": "Thread",
            "project_id": None,
            "pinned": False,
            "last_message_at": "2026-07-03T00:00:00Z",
        },
    )

    registry = ToolRegistry(scope_source=RegistryNativeScopeSource())
    monkeypatch.setattr(
        service,
        "_build_context",
        lambda *_args, **_kwargs: {
            "registry": registry,
            "tools": registry.get_tools(surface="virtual_cso", format="anthropic"),
            "tool_names": registry.tool_names(),
            "prompt": "Founder asks a question.",
            "skill_index": [],
            "route": {"selected": [], "primary": None, "required": [], "confidence": 0, "reason": "test"},
            "invoked_ip_pages": [],
            "founder_index": [],
            "founder_pages": [],
            "allow_draft_ip": True,
        },
    )

    events = list(
        service.stream_chat(
            user_id="user-1",
            payload=VcsoChatPayload(thread_id=None, text="What should I read?"),
            max_rounds=3,
        )
    )

    names = [event["event"] for event in events]
    assert names[0] == "ready"
    assert "tool_call" in names
    assert "tool_result" in names
    assert names.count("token") == 2
    assert names[-1] == "done"
    assert events[-1]["data"]["assistantMessage"]["content"] == "Final answer."
    tool_call = next(event["data"] for event in events if event["event"] == "tool_call")
    assert tool_call["stepType"] == "tool_call"
    assert tool_call["title"] == "tool_search"
    assert tool_call["sourceRefs"] == []
    tool_result = next(event["data"] for event in events if event["event"] == "tool_result")
    assert tool_result["stepType"] == "tool_call"
    assert tool_result["sourceRefs"][0]["source_kind"] == "derived"
    assert tool_result["sourceRefs"][0]["source_metadata"]["raw_source_kind"] == "tool_registry"
    persisted_tool_steps = [
        step for step in created_steps if step["kwargs"].get("tool_name") == "tool_search"
    ]
    assert persisted_tool_steps
    assert persisted_tool_steps[0]["kwargs"]["source_refs"][0]["source_kind"] == "derived"
    done_steps = events[-1]["data"]["assistantMessage"]["agentSteps"]
    assert done_steps[0]["stepType"] == "tool_call"
    assert done_steps[0]["sourceRefs"][0]["source_kind"] == "derived"
    assert events[-1]["data"]["assistantMessage"]["citations"][0]["ordinal"] == 1
    assert events[-1]["data"]["sources"][0]["source_kind"] == "derived"
