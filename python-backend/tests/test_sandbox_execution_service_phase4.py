"""Phase 4 (Sandbox Bridge / Code Mode) integration test for the sandbox
execution sub-agent loop: proves execute_code is routed through the bridge
when a Code Mode catalog is available, that the top-level Claude tool list
stays exactly execute_code/read_skill_file regardless of the widened
agent_capabilities row, and that bridge tool calls surface as extra curated
trace steps.
"""

from __future__ import annotations

from types import SimpleNamespace

from services.sandbox_bridge import BridgeToolCall
from services.sandbox_execution_service import SANDBOX_EXECUTION_TOOLS, SandboxExecutionService
from services.tool_registry import AgentCapabilityScopeSource, ToolRegistry


CODE_MODE_ALLOWED_TOOLS = [
    "execute_code",
    "read_skill_file",
    "kb_ls",
    "kb_tree",
    "kb_grep",
    "kb_glob",
    "kb_read",
    "wiki_search",
    "wiki_get_page",
    "wiki_list",
]


class _FakeQuery:
    def __init__(self, rows):
        self._rows = rows
        self._filters = []

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, key, value):
        self._filters.append((key, value))
        return self

    def in_(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def execute(self):
        rows = list(self._rows)
        for key, value in self._filters:
            rows = [row for row in rows if row.get(key) == value]
        return SimpleNamespace(data=rows)


class _FakeSupabase:
    def __init__(self, capability_rows):
        self._capability_rows = capability_rows

    def table(self, name):
        if name == "agent_capabilities":
            return _FakeQuery(self._capability_rows)
        return _FakeQuery([])


class _FakeMessages:
    def __init__(self):
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if len(self.calls) == 1:
            return SimpleNamespace(
                stop_reason="tool_use",
                usage=SimpleNamespace(input_tokens=10, output_tokens=5),
                content=[
                    SimpleNamespace(
                        type="tool_use",
                        id="toolu_1",
                        name="execute_code",
                        input={"code": "print(kb_grep(pattern='revenue'))", "description": "look something up"},
                    )
                ],
            )
        return SimpleNamespace(
            stop_reason="end_turn",
            usage=SimpleNamespace(input_tokens=8, output_tokens=4),
            content=[SimpleNamespace(type="text", text="Done.")],
        )


class _FakeAnthropic:
    def __init__(self):
        self.messages = _FakeMessages()


class _FakeBridgeResult:
    thread_id = "thread-1"
    pod_name = "pod-1"
    stdout = "{'content': {'matches': []}}\n"
    stderr = ""
    exit_code = 0
    status = "active"
    tool_calls = [BridgeToolCall(tool_name="kb_grep", ok=True, arguments={"pattern": "revenue"})]


class _FakePlainResult:
    thread_id = "thread-1"
    pod_name = "pod-1"
    stdout = "hello\n"
    stderr = ""
    exit_code = 0
    status = "active"


class _FakeSandboxService:
    def __init__(self):
        self.bridge_calls = []
        self.plain_calls = []

    def execute_code_with_bridge(self, *, thread_id, code, fulfiller, timeout_seconds):
        self.bridge_calls.append({"thread_id": thread_id, "code": code, "fulfiller": fulfiller})
        return _FakeBridgeResult()

    def execute_code(self, *, thread_id, code, timeout_seconds):
        self.plain_calls.append({"thread_id": thread_id, "code": code})
        return _FakePlainResult()


def _capability_row(capability_key, surfaces, tools):
    return {
        "id": f"{capability_key}-id",
        "capability_key": capability_key,
        "label": capability_key,
        "description": "",
        "status": "experimental",
        "allowed_surfaces": surfaces,
        "allowed_tools": tools,
        "allowed_source_kinds": [],
        "model_setting_key": capability_key,
        "output_schema": {"version": "agent_result_v1"},
        "default_config": {},
        "can_spawn_agents": False,
    }


def _build_service(capability_rows):
    supabase = _FakeSupabase(capability_rows)
    store = SimpleNamespace(client=supabase)
    service = SandboxExecutionService.__new__(SandboxExecutionService)
    service._sandbox_service = _FakeSandboxService()
    service._supabase = supabase
    service._settings = SimpleNamespace()
    service.anthropic_client = _FakeAnthropic()
    service.model_setting_key = "sandbox_execution_agent"
    service.model = "claude-sonnet-4-6"
    service.provider = "anthropic"
    service.tool_registry = ToolRegistry(store=store, scope_source=AgentCapabilityScopeSource(store))
    service._resolve_model = lambda: None
    return service


def test_execute_code_routes_through_bridge_when_code_mode_catalog_available():
    service = _build_service([_capability_row("sandbox_execution_agent", ["virtual_cso"], CODE_MODE_ALLOWED_TOOLS)])

    result = service.run_execution(
        user_id="user-1",
        thread_id="thread-1",
        task_summary="Look up revenue mentions.",
        skill_file_ids=[],
        max_rounds=3,
    )

    assert service._sandbox_service.bridge_calls, "execute_code should have routed through the bridge"
    assert not service._sandbox_service.plain_calls
    fulfiller = service._sandbox_service.bridge_calls[0]["fulfiller"]
    assert set(fulfiller.allowed_tool_names) == {
        "kb_ls",
        "kb_tree",
        "kb_grep",
        "kb_glob",
        "kb_read",
        "wiki_search",
        "wiki_get_page",
        "wiki_list",
    }
    # The top-level Claude tool list must stay exactly execute_code/read_skill_file,
    # unaffected by the widened agent_capabilities row used for Code Mode.
    first_call_kwargs = service.anthropic_client.messages.calls[0]
    assert first_call_kwargs["tools"] == SANDBOX_EXECUTION_TOOLS
    assert [tool["name"] for tool in first_call_kwargs["tools"]] == ["execute_code", "read_skill_file"]

    # A bridge tool call inside execute_code surfaces as its own curated step.
    bridge_steps = [step for step in result.tool_steps if step["tool_name"] == "kb_grep"]
    assert bridge_steps
    assert bridge_steps[0]["summary"] == "Code Mode called kb_grep."


def test_execute_code_falls_back_to_plain_path_when_capability_not_authorized_for_surface():
    # sandbox_execution_agent is only authorized for virtual_cso; a different
    # surface should degrade to no Code Mode tools rather than raising.
    service = _build_service([_capability_row("sandbox_execution_agent", ["virtual_cso"], CODE_MODE_ALLOWED_TOOLS)])

    result = service.run_execution(
        user_id="user-1",
        thread_id="thread-1",
        task_summary="Run a calculation.",
        skill_file_ids=[],
        max_rounds=3,
        surface="domain_agent",
    )

    assert service._sandbox_service.plain_calls, "execute_code should use the plain path with no Code Mode catalog"
    assert not service._sandbox_service.bridge_calls
    assert result.summary == "Done."
