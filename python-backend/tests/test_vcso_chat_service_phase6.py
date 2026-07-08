from __future__ import annotations

from types import SimpleNamespace

from services.vcso_chat_service import (
    MAX_DEEP_ROUNDS,
    VcsoChatPayload,
    VcsoChatService,
    _context_signal,
    _detect_agent_invocation,
    _messages_after_compaction,
)
from services.tool_registry import RegistryNativeScopeSource, ToolRegistry


def test_context_signal_returns_percentage_and_band_only():
    signal = _context_signal(peak_input_tokens=160000, context_window=200000)

    assert signal == {"remainingPercent": 20, "band": "amber"}
    assert "inputTokens" not in signal
    assert "cost" not in signal


def test_compacted_messages_are_removed_from_fresh_context_window():
    messages = [
        {"id": "m1", "created_at": "2026-07-03T10:00:00Z"},
        {"id": "m2", "created_at": "2026-07-03T10:05:00Z"},
        {"id": "m3", "created_at": "2026-07-03T10:10:00Z"},
    ]
    summary = {"compacted_through_created_at": "2026-07-03T10:05:00Z", "summary": "Earlier decisions."}

    assert _messages_after_compaction(messages, summary) == [messages[-1]]


def test_deep_mode_tool_scope_is_visibility_only():
    registry = ToolRegistry(scope_source=RegistryNativeScopeSource())

    normal_tools = {tool["name"] for tool in registry.get_tools(surface="virtual_cso", format="anthropic")}
    deep_tools = {tool["name"] for tool in registry.get_tools(surface="virtual_cso_deep", format="anthropic")}

    assert MAX_DEEP_ROUNDS == 50
    assert "write_todos" not in normal_tools
    assert "ask_user" not in normal_tools
    assert {"tool_search", "delegate_to_sub_agent", "write_todos", "read_todos", "write_file", "ask_user"} <= deep_tools


def test_agent_invocation_resolves_case_insensitive_agent_alias():
    agents = [{"id": "agent-1", "key": "financial", "name": "Financial"}]

    invocation = _detect_agent_invocation("@FinancialAgent run a monthly P&L assessment", agents)

    assert invocation is not None
    assert invocation["agent"]["id"] == "agent-1"
    assert invocation["request"] == "run a monthly P&L assessment"


class _AgentTaskTable:
    def __init__(self, supabase, name: str) -> None:
        self.supabase = supabase
        self.name = name
        self.payload = None
        self.mode = "select"
        self.filters = []
        self.order_key = None
        self.limit_count = None

    def select(self, *_args, **_kwargs):
        return self

    def insert(self, payload):
        self.mode = "insert"
        self.payload = payload
        return self

    def update(self, payload):
        self.mode = "update"
        self.payload = payload
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def order(self, key, **_kwargs):
        self.order_key = key
        return self

    def limit(self, count):
        self.limit_count = count
        return self

    def execute(self):
        if self.mode == "insert":
            row = dict(self.payload)
            row.setdefault("id", f"{self.name}-{len(self.supabase.tables[self.name]) + 1}")
            row.setdefault("created_at", "2026-07-06T10:00:00Z")
            row.setdefault("updated_at", "2026-07-06T10:00:00Z")
            self.supabase.tables[self.name].append(row)
            return SimpleNamespace(data=[row])
        if self.mode == "update":
            rows = self._rows()
            for row in rows:
                row.update(self.payload)
            return SimpleNamespace(data=rows)
        rows = self._rows()
        if self.limit_count is not None:
            rows = rows[: self.limit_count]
        return SimpleNamespace(data=rows)

    def _rows(self):
        rows = list(self.supabase.tables.get(self.name, []))
        for key, value in self.filters:
            rows = [row for row in rows if str(row.get(key)) == str(value)]
        return rows


class _AgentTaskSupabase:
    def __init__(self) -> None:
        self.tables = {
            "domain_agents": [
                {
                    "id": "agent-finance",
                    "key": "financial",
                    "name": "Financial",
                    "is_active": True,
                    "color": "var(--aos-brass)",
                    "thought_starters": [],
                }
            ],
            "workflows": [
                {
                    "id": "workflow-pnl",
                    "agent_id": "agent-finance",
                    "name": "Monthly P&L Assessment",
                    "description": "Assess monthly profitability and margin patterns.",
                    "is_active": True,
                }
            ],
            "tasks": [],
            "freeform_requests": [],
            "agent_delegation_runs": [],
        }

    def table(self, name: str):
        return _AgentTaskTable(self, name)


class _ExplodingMessages:
    def create(self, **_kwargs):
        raise AssertionError("Agent invocation must not enter the VCSO Claude loop.")

    def stream(self, **_kwargs):
        raise AssertionError("Agent invocation must not stream a VCSO answer.")


class _ExplodingAnthropic:
    def __init__(self) -> None:
        self.messages = _ExplodingMessages()


def test_agent_invocation_stream_creates_vcso_task_handle_without_inline_run(monkeypatch):
    service = VcsoChatService.__new__(VcsoChatService)
    service.supabase = _AgentTaskSupabase()
    service.store = SimpleNamespace()
    service.anthropic_client = _ExplodingAnthropic()
    service.settings = SimpleNamespace()

    monkeypatch.setattr(service, "_resolve_model", lambda: None)
    monkeypatch.setattr(
        service,
        "_load_or_create_thread",
        lambda *_args, **_kwargs: {"id": "thread-1", "message_count": 0, "title": "Thread"},
    )
    messages = []

    def insert_message(thread_id, user_id, role, content, **_kwargs):
        row = {"id": f"message-{len(messages) + 1}", "thread_id": thread_id, "user_id": user_id, "role": role, "content": content, "created_at": "now"}
        messages.append(row)
        return row

    monkeypatch.setattr(service, "_insert_message", insert_message)
    monkeypatch.setattr(service, "_update_thread_count", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(service, "_get_thread", lambda *_args, **_kwargs: {"id": "thread-1", "title": "Thread", "last_message_at": "now"})

    events = list(
        service.stream_chat(
            user_id="user-1",
            payload=VcsoChatPayload(thread_id="thread-1", text="@FinancialAgent run a monthly P&L assessment"),
        )
    )

    assert [event["event"] for event in events] == ["ready", "agent_task", "done"]
    task = service.supabase.tables["tasks"][0]
    assert task["origin"] == "vcso"
    assert task["origin_thread_id"] == "thread-1"
    assert task["workflow_id"] == "workflow-pnl"
    assert events[1]["data"]["task"]["id"] == task["id"]
    assert events[1]["data"]["task"]["status"] == "ready"
    assert service.supabase.tables["freeform_requests"][0]["resulting_task_id"] == task["id"]
    assert service.supabase.tables["agent_delegation_runs"][0]["structured_result"]["agent_task"]["task"]["id"] == task["id"]


class _FakeMessages:
    def create(self, **_kwargs):
        return SimpleNamespace(
            usage=SimpleNamespace(input_tokens=42, output_tokens=8),
            content=[SimpleNamespace(type="text", text="- Preserved decision: keep margin reset separate.")],
        )


class _FakeAnthropic:
    def __init__(self) -> None:
        self.messages = _FakeMessages()


class _FakeStore:
    def resolve_platform_setting(self, **_kwargs):
        return {"provider": "anthropic", "model_name": "claude-sonnet-4-6", "is_enabled": True, "settings": {}}


class _Table:
    def __init__(self, supabase, name: str) -> None:
        self.supabase = supabase
        self.name = name
        self.payload = None

    def insert(self, payload):
        self.payload = payload
        return self

    def update(self, payload):
        self.payload = payload
        return self

    def eq(self, *_args):
        return self

    def execute(self):
        if self.name == "ai_usage_log":
            self.supabase.usage_rows.append(self.payload)
        if self.name == "vcso_chat_threads":
            self.supabase.thread_updates.append(self.payload)
        return SimpleNamespace(data=[self.payload] if self.payload else [])


class _FakeSupabase:
    def __init__(self) -> None:
        self.usage_rows = []
        self.thread_updates = []

    def table(self, name: str):
        return _Table(self, name)


def test_compaction_stores_thread_summary_and_logs_utility_usage(monkeypatch):
    service = VcsoChatService.__new__(VcsoChatService)
    service.supabase = _FakeSupabase()
    service.store = _FakeStore()
    service.settings = SimpleNamespace(claude_synthesis_model="claude-sonnet-4-6", llm_context_window=200000)
    service.anthropic_client = _FakeAnthropic()

    monkeypatch.setattr(service, "_assert_thread_owner", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(
        service,
        "_load_thread_messages",
        lambda *_args, **_kwargs: [
            {"id": "m1", "role": "user", "content": "We chose the margin reset.", "created_at": "2026-07-03T10:00:00Z"},
            {"id": "m2", "role": "assistant", "content": "Keep it separate from pricing.", "created_at": "2026-07-03T10:01:00Z"},
            {"id": "m3", "role": "user", "content": "What next?", "created_at": "2026-07-03T10:02:00Z"},
            {"id": "m4", "role": "assistant", "content": "Next answer.", "created_at": "2026-07-03T10:03:00Z"},
            {"id": "m5", "role": "user", "content": "More?", "created_at": "2026-07-03T10:04:00Z"},
        ],
    )
    monkeypatch.setattr(service, "_load_prior_tool_results", lambda *_args, **_kwargs: [])

    result = service.compact_thread(user_id="user-1", thread_id="thread-1")

    assert result["compacted"] is True
    assert service.supabase.usage_rows[0]["role"] == "utility"
    assert service.supabase.usage_rows[0]["capability_key"] == "vcso_context_compaction"
    update = service.supabase.thread_updates[0]
    assert update["compacted_summary"]["schema_version"] == "vcso_context_compaction_v1"
    assert "margin reset" in update["compacted_summary"]["summary"]
