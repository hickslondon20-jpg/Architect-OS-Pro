from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[1]))

from services.mcp_client import MCPClientManager, MCPServerConfig
from services.tool_registry import (
    MoneyMovementBlocked,
    ToolConfirmationRequired,
    ToolDefinition,
    ToolExecutionContext,
    ToolQuarantined,
    ToolRegistry,
    ToolResultEnvelope,
)
from services.vcso_sdk_config import compile_founder_sdk_options


class _Query:
    def __init__(self, rows):
        self.rows = list(rows)

    def select(self, *_args):
        return self

    def eq(self, key, value):
        self.rows = [row for row in self.rows if row.get(key) == value]
        return self

    def in_(self, key, values):
        self.rows = [row for row in self.rows if row.get(key) in values]
        return self

    def order(self, key):
        self.rows.sort(key=lambda row: str(row.get(key) or ""))
        return self

    def limit(self, value):
        self.rows = self.rows[:value]
        return self

    def execute(self):
        return type("Response", (), {"data": self.rows})()


class _Client:
    def __init__(self, tables):
        self.tables = tables

    def table(self, name):
        return _Query(self.tables.get(name, []))


class _Store:
    def __init__(self, client):
        self.client = client

    def resolve_platform_model(self, *, setting_key, fallback_model_name, fallback_provider):
        models = {
            "tier_worker": {"provider": "anthropic", "model_name": "claude-haiku-test"},
            "wiki_agent": {"provider": "anthropic", "model_name": "claude-sonnet-test"},
        }
        return models.get(
            setting_key,
            {"provider": fallback_provider, "model_name": fallback_model_name},
        )


def _capability(key, tools, *, routing_tier=None):
    return {
        "id": key,
        "capability_key": key,
        "label": key.replace("_", " ").title(),
        "description": f"Bounded {key}.",
        "status": "experimental",
        "allowed_surfaces": ["virtual_cso"],
        "allowed_tools": tools,
        "allowed_source_kinds": [],
        "model_setting_key": key,
        "routing_tier": routing_tier,
        "output_schema": {"version": "agent_result_v1"},
        "default_config": {"max_rounds": 2},
        "can_spawn_agents": False,
    }


def _compile_for(user_id, *, connection_user_id=None, native_subagents=False):
    tables = {
        "tool_registry": [
            {"slug": "wiki_search", "enabled": True, "is_code_registered": True},
            {"slug": "execute_code", "enabled": True, "is_code_registered": True},
            {"slug": "mcp_quickbooks_read_report", "enabled": True, "is_code_registered": True},
        ],
        "agent_capabilities": [
            _capability("wiki_agent", ["wiki_search", "mcp_quickbooks_read_report"]),
            _capability("sandbox_agent", ["execute_code"], routing_tier="worker"),
        ],
        "feature_registry": [
            {"key": "connector_quickbooks", "beta_unlock_week": 12, "is_active": True},
        ],
        "beta_user_access": [
            {"user_id": "founder-12", "beta_cohort_week": 12, "is_beta": True, "status": "active"},
            {"user_id": "founder-other", "beta_cohort_week": 12, "is_beta": True, "status": "active"},
            {"user_id": "founder-1", "beta_cohort_week": 1, "is_beta": True, "status": "active"},
        ],
        "mcp_connections": [
            {
                "user_id": connection_user_id or user_id,
                "server_name": "quickbooks",
                "transport": "http",
                "config": {"url": "https://mcp.example.test/quickbooks"},
                "status": "connected",
            }
        ],
    }
    client = _Client(tables)
    store = _Store(client)
    registry = ToolRegistry(store=store)
    registry.register(
        ToolDefinition(
            name="mcp_quickbooks_read_report",
            description="Read founder-scoped QuickBooks report data.",
            json_schema={"type": "object", "properties": {}},
            source="mcp",
            executor_kind="mcp",
            persistence_semantics="read_only",
            executor=lambda _context, _args: ToolResultEnvelope(content={"ok": True}),
            mcp_metadata={"server_name": "quickbooks", "tool_name": "read_report"},
        )
    )
    return compile_founder_sdk_options(
        store=store,
        user_id=user_id,
        registry=registry,
        requested_tool_names=["wiki_search", "mcp_quickbooks_read_report"],
        sdk_tools_by_name={
            name: {"name": name}
            for name in ("wiki_search", "execute_code", "mcp_quickbooks_read_report")
        },
        system_prompt="VCSO",
        main_model="claude-sonnet-test",
        api_key="test-key",
        hooks={},
        max_turns=6,
        max_budget_usd=0.25,
        enable_native_subagents=native_subagents,
        native_subagent_tools=(
            {
                "wiki_agent": {"name": "run_wiki_agent"},
                "sandbox_agent": {"name": "run_sandbox_agent"},
            }
            if native_subagents
            else None
        ),
    )


def test_compiler_scopes_connectors_grants_and_tier_models_per_founder(monkeypatch):
    monkeypatch.setattr(
        "services.vcso_sdk_config.create_sdk_mcp_server",
        lambda *, name, version, tools: {"type": "sdk", "name": name, "version": version, "tools": tools},
    )
    unlocked = _compile_for("founder-12")
    locked = _compile_for("founder-1")
    other_founder = _compile_for("founder-other", connection_user_id="founder-12")

    assert unlocked.tool_names == ["wiki_search", "mcp_quickbooks_read_report"]
    assert unlocked.options.allowed_tools == [
        "mcp__architectos__wiki_search",
        "mcp__quickbooks__mcp_quickbooks_read_report",
    ]
    assert unlocked.connector_names == ["quickbooks"]
    assert set(unlocked.options.mcp_servers) == {"architectos", "quickbooks"}
    assert unlocked.agent_tool_grants["wiki_agent"] == ["wiki_search", "mcp_quickbooks_read_report"]
    assert unlocked.agent_tool_grants["sandbox_agent"] == ["execute_code"]
    assert unlocked.agent_model_routes["sandbox_agent"] == {
        "setting_key": "tier_worker",
        "provider": "anthropic",
        "model_name": "claude-haiku-test",
    }
    assert unlocked.agent_model_routes["wiki_agent"]["setting_key"] == "wiki_agent"

    assert locked.tool_names == ["wiki_search"]
    assert locked.options.allowed_tools == ["mcp__architectos__wiki_search"]
    assert locked.connector_names == []
    assert set(locked.options.mcp_servers) == {"architectos"}
    assert locked.agent_tool_grants["wiki_agent"] == ["wiki_search"]
    assert other_founder.connector_names == []
    assert other_founder.options.allowed_tools == ["mcp__architectos__wiki_search"]


def test_compiler_enables_task_only_for_lead_and_keeps_worker_recursion_blocked(monkeypatch):
    monkeypatch.setattr(
        "services.vcso_sdk_config.create_sdk_mcp_server",
        lambda *, name, version, tools: {"type": "sdk", "name": name, "version": version, "tools": tools},
    )
    compiled = _compile_for("founder-12", native_subagents=True)

    assert "Task" in compiled.options.allowed_tools
    assert "Task" not in compiled.options.disallowed_tools
    assert compiled.agent_handler_tools == {
        "sandbox_agent": "run_sandbox_agent",
        "wiki_agent": "run_wiki_agent",
    }
    assert compiled.options.agents["sandbox_agent"].tools == [
        "mcp__architectos__run_sandbox_agent"
    ]
    assert "Task" in compiled.options.agents["sandbox_agent"].disallowedTools
    assert "Agent" in compiled.options.agents["sandbox_agent"].disallowedTools
    assert compiled.options.agents["sandbox_agent"].model == "claude-haiku-test"


def test_persistence_guardrail_forced_write_quarantine_and_money_block():
    calls = []
    registry = ToolRegistry()
    registry.register(
        ToolDefinition(
            name="test_external_read",
            description="Read external data.",
            json_schema={"type": "object", "properties": {}},
            source="mcp",
            executor_kind="mcp",
            executor=lambda _context, _args: ToolResultEnvelope(content={"value": 1}),
            mcp_metadata={"server_name": "quickbooks"},
        )
    )
    registry.register(
        ToolDefinition(
            name="test_external_write",
            description="Write external data.",
            json_schema={"type": "object", "properties": {}},
            source="mcp",
            executor_kind="mcp",
            persistence_semantics="write_external",
            executor=lambda _context, _args: (calls.append("write") or ToolResultEnvelope(content={"ok": True})),
            mcp_metadata={"server_name": "quickbooks"},
        )
    )
    registry.register(
        ToolDefinition(
            name="test_payment",
            description="Move money.",
            json_schema={"type": "object", "properties": {}},
            source="mcp",
            executor_kind="mcp",
            persistence_semantics="privileged",
            executor=lambda _context, _args: ToolResultEnvelope(content={"ok": True}),
            mcp_metadata={"server_name": "quickbooks", "moves_money": True},
        )
    )

    legacy = ToolExecutionContext(user_id="founder")
    registry.execute("test_external_write", legacy, {})
    assert calls == ["write"]

    guarded = ToolExecutionContext(user_id="founder", metadata={"enforce_persistence_guardrail": True})
    with pytest.raises(ToolConfirmationRequired):
        registry.execute("test_external_write", guarded, {})
    registry.execute("test_external_read", guarded, {})
    guarded.metadata["confirmed_tool_names"] = ["test_external_write", "test_payment"]
    with pytest.raises(ToolQuarantined):
        registry.execute("test_external_write", guarded, {})
    guarded.metadata["quarantine_released_tool_names"] = ["test_external_write", "test_payment"]
    registry.execute("test_external_write", guarded, {})
    with pytest.raises(MoneyMovementBlocked):
        registry.execute("test_payment", guarded, {})
    assert calls == ["write", "write"]


class _Adapter:
    def list_tools(self, _server):
        return [
            {
                "name": "create_payment",
                "description": "VENDOR RAW INSTRUCTIONS MUST NOT SURVIVE",
                "inputSchema": {"type": "object", "properties": {}},
                "annotations": {"readOnlyHint": False},
            }
        ]

    def call_tool(self, *_args, **_kwargs):
        return {"content": []}


def test_mcp_descriptions_are_aci_curated_and_money_tools_are_blocked():
    manager = MCPClientManager(
        adapter=_Adapter(),
        servers=[MCPServerConfig(server_name="quickbooks", transport="http")],
    )
    discovered = manager.discover_tools()[0]
    assert "VENDOR RAW" not in discovered.description
    assert "founder confirmation" in discovered.description
    assert discovered.persistence_semantics == "privileged"
    assert discovered.moves_money is True
