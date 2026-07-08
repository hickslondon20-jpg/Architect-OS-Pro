from services.kb_explorer_service import KB_EXPLORER_TOOLS
from services.sandbox_execution_service import SANDBOX_EXECUTION_TOOLS
from services.tool_registry import (
    AgentCapabilityScopeSource,
    RegistryNativeScopeSource,
    ToolExecutionContext,
    ToolRegistry,
    to_anthropic,
    to_openai,
)


KB_TOOL_NAMES = [
    "kb_ls",
    "kb_tree",
    "kb_grep",
    "kb_glob",
    "kb_read",
    "wiki_search",
    "wiki_get_page",
    "wiki_list",
]


def test_anthropic_adapter_reproduces_existing_native_tool_shapes():
    registry = ToolRegistry(scope_source=RegistryNativeScopeSource())

    kb_defs = [registry.get(name) for name in KB_TOOL_NAMES]
    sandbox_defs = [registry.get("execute_code"), registry.get("read_skill_file")]

    assert to_anthropic(kb_defs) == KB_EXPLORER_TOOLS
    assert to_anthropic(sandbox_defs) == SANDBOX_EXECUTION_TOOLS

    openai_tool = to_openai([registry.get("kb_read")])[0]
    assert openai_tool["type"] == "function"
    assert openai_tool["function"]["parameters"] == registry.get("kb_read").json_schema


def test_get_tools_supports_agent_capabilities_and_registry_native_scope_sources():
    store = _FakeStore(
        capability_rows=[
            _capability_row(
                "kb_explorer_agent",
                ["virtual_cso"],
                ["kb_ls", "kb_read", "wiki_search"],
            )
        ]
    )
    agent_scoped = ToolRegistry(store=store, scope_source=AgentCapabilityScopeSource(store))
    native_scoped = ToolRegistry(scope_source=RegistryNativeScopeSource())

    assert [
        tool["name"]
        for tool in agent_scoped.get_tools(
            surface="virtual_cso",
            capability="kb_explorer_agent",
            format="anthropic",
        )
    ] == ["kb_ls", "kb_read", "wiki_search"]

    assert [
        tool.name
        for tool in native_scoped.get_tools(
            surface="virtual_cso",
            capability="kb_explorer_agent",
            names=["kb_ls", "kb_read", "wiki_search"],
        )
    ] == ["kb_ls", "kb_read", "wiki_search"]


def test_tool_search_is_pure_retrieval_over_scoped_catalog():
    registry = ToolRegistry(scope_source=RegistryNativeScopeSource())

    matches = registry.tool_search("search synthesized wiki knowledge", surface="virtual_cso", capability="kb_explorer_agent")

    assert matches
    assert matches[0].name == "wiki_search"
    assert all(match.name != "tool_search" for match in matches)


def test_skill_pack_adapter_registers_deferred_visible_skills_only():
    owner_id = "owner-user"
    registry = ToolRegistry(
        supabase_client=_FakeClient(
            skill_rows=[
                _skill_row("global-skill", "global", None),
                _skill_row("owner-skill", "private", owner_id),
                _skill_row("other-skill", "private", "someone-else"),
            ]
        ),
        scope_source=RegistryNativeScopeSource(),
    )

    registry.register_skill_pack_tools(owner_id)

    assert registry.get("global-skill").loading == "deferred"
    assert registry.get("owner-skill").source == "skill"
    assert "other-skill" not in registry.tool_names()

    envelope = registry.execute(
        "owner-skill",
        ToolExecutionContext(user_id=owner_id),
        {},
    )
    assert envelope.content["body"] == "Body for owner-skill"
    assert envelope.sources[0].source_kind == "skill_pack"


def test_execute_code_returns_citation_ready_computation_envelope():
    registry = ToolRegistry(scope_source=RegistryNativeScopeSource())
    envelope = registry.execute(
        "execute_code",
        ToolExecutionContext(
            user_id="user-1",
            thread_id="thread-1",
            sandbox_service=_FakeSandboxService(),
        ),
        {"code": "print('hello')", "description": "hello run"},
    )

    assert envelope.content["stdout"] == "hello\n"
    assert envelope.sources[0].source_kind == "computation"
    assert "print('hello')" in (envelope.sources[0].verbatim or "")


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


def _skill_row(slug, scope, user_id):
    return {
        "id": f"{slug}-id",
        "slug": slug,
        "name": slug.replace("-", " ").title(),
        "description": f"Description for {slug}",
        "skill_kind": "analysis",
        "domain": "strategy",
        "trigger_tags": ["margin", slug],
        "body": f"Body for {slug}",
        "status": "active",
        "version": 1,
        "required_platform_context": [],
        "output_contract": {},
        "writeback_rules": {},
        "user_id": user_id,
        "scope": scope,
        "requires_sandbox": False,
    }


class _FakeStore:
    def __init__(self, capability_rows=None, skill_rows=None):
        self.client = _FakeClient(capability_rows=capability_rows or [], skill_rows=skill_rows or [])


class _FakeClient:
    def __init__(self, capability_rows=None, skill_rows=None):
        self._tables = {
            "agent_capabilities": capability_rows or [],
            "skill_packs": skill_rows or [],
        }

    def table(self, name):
        return _FakeQuery(list(self._tables.get(name, [])))


class _FakeQuery:
    def __init__(self, rows):
        self._rows = rows
        self._filters = []
        self._in_filters = []

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, key, value):
        self._filters.append((key, value))
        return self

    def in_(self, key, values):
        self._in_filters.append((key, set(values)))
        return self

    def order(self, *_args, **_kwargs):
        return self

    def execute(self):
        rows = list(self._rows)
        for key, value in self._filters:
            rows = [row for row in rows if row.get(key) == value]
        for key, values in self._in_filters:
            rows = [row for row in rows if row.get(key) in values]
        return _FakeResponse(rows)


class _FakeResponse:
    def __init__(self, data):
        self.data = data


class _FakeSandboxResult:
    thread_id = "thread-1"
    pod_name = "pod-1"
    stdout = "hello\n"
    stderr = ""
    exit_code = 0
    status = "completed"


class _FakeSandboxService:
    def execute_code(self, **_kwargs):
        return _FakeSandboxResult()
