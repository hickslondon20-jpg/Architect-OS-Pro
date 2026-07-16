"""Per-founder registry compiler for the feature-gated Virtual CSO SDK path."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from claude_agent_sdk import ClaudeAgentOptions
from claude_agent_sdk.types import AgentDefinition

from services.agent_capabilities import AgentCapability, AgentCapabilityRegistry
from services.mcp_connectors import sdk_connector_available
from services.tool_registry import ToolDefinition, ToolRegistry


SDK_INTERNAL_SERVER = "architectos"
SDK_INTERNAL_PREFIX = f"mcp__{SDK_INTERNAL_SERVER}__"
CLAUDE_PROVIDER = "anthropic"
DISALLOWED_SDK_BUILTINS = [
    "Bash",
    "Read",
    "Write",
    "Edit",
    "Glob",
    "Grep",
    "WebSearch",
    "WebFetch",
    "Task",
    "Agent",
]


@dataclass(frozen=True)
class CompiledFounderSdkOptions:
    options: ClaudeAgentOptions
    tool_names: list[str]
    agent_tool_grants: dict[str, list[str]] = field(default_factory=dict)
    agent_model_routes: dict[str, dict[str, str]] = field(default_factory=dict)
    connector_names: list[str] = field(default_factory=list)
    excluded_tool_names: list[str] = field(default_factory=list)


def compile_founder_sdk_options(
    *,
    store: Any | None,
    user_id: str,
    registry: ToolRegistry,
    requested_tool_names: list[str],
    internal_mcp_server: Any,
    system_prompt: str,
    main_model: str,
    api_key: str,
    hooks: dict[str, Any],
    max_turns: int,
    max_budget_usd: float,
) -> CompiledFounderSdkOptions:
    """Compile one founder's callable tools, bounded agents, models, and MCP servers.

    Tool existence comes from the in-process registry; the live catalog remains the enabled/drift
    overlay. Capabilities own their grants and routing tier. External MCP servers require all three
    authorities: pilot feature availability, a connected founder-owned row, and a registered tool.
    """

    client = getattr(store, "client", None)
    enabled_catalog = _enabled_catalog_names(client) if client is not None else None
    connected_servers, external_mcp_servers = (
        _connected_sdk_servers(client, user_id=user_id) if client is not None else ([], {})
    )
    selected, excluded = _select_definitions(
        registry,
        requested_tool_names,
        enabled_catalog=enabled_catalog,
        connected_servers=set(connected_servers),
    )

    capabilities = (
        [
            capability
            for capability in AgentCapabilityRegistry(store).list_active()
            if "virtual_cso" in capability.allowed_surfaces and not capability.can_spawn_agents
        ]
        if store is not None
        else []
    )
    agents: dict[str, AgentDefinition] = {}
    agent_tool_grants: dict[str, list[str]] = {}
    agent_model_routes: dict[str, dict[str, str]] = {}
    selectable_names = (
        _grantable_names(
            registry,
            enabled_catalog=enabled_catalog,
            connected_servers=set(connected_servers),
        )
        if capabilities
        else set()
    )
    for capability in capabilities:
        grant_names = [name for name in capability.allowed_tools if name in selectable_names]
        sdk_grants = [_internal_tool_name(name) for name in grant_names]
        route = resolve_capability_model(store, capability=capability, fallback_model=main_model)
        agents[capability.capability_key] = AgentDefinition(
            description=capability.description or capability.label,
            prompt=_capability_prompt(capability),
            tools=sdk_grants,
            disallowedTools=list(DISALLOWED_SDK_BUILTINS),
            model=route["model_name"],
            maxTurns=_capability_max_turns(capability),
            permissionMode="dontAsk",
        )
        agent_tool_grants[capability.capability_key] = grant_names
        agent_model_routes[capability.capability_key] = route

    mcp_servers = {SDK_INTERNAL_SERVER: internal_mcp_server, **external_mcp_servers}
    options = ClaudeAgentOptions(
        tools=[],
        allowed_tools=[_internal_tool_name(definition.name) for definition in selected],
        disallowed_tools=list(DISALLOWED_SDK_BUILTINS),
        agents=agents,
        mcp_servers=mcp_servers,
        strict_mcp_config=True,
        permission_mode="dontAsk",
        system_prompt=system_prompt,
        model=main_model,
        max_turns=max(2, max_turns),
        max_budget_usd=max_budget_usd,
        include_partial_messages=True,
        include_hook_events=False,
        hooks=hooks,
        setting_sources=[],
        env={"ANTHROPIC_API_KEY": api_key},
        thinking={"type": "disabled"},
    )
    return CompiledFounderSdkOptions(
        options=options,
        tool_names=[definition.name for definition in selected],
        agent_tool_grants=agent_tool_grants,
        agent_model_routes=agent_model_routes,
        connector_names=connected_servers,
        excluded_tool_names=excluded,
    )


def resolve_capability_model(
    store: Any,
    *,
    capability: AgentCapability,
    fallback_model: str,
) -> dict[str, str]:
    """Resolve the MA-06 tier row (or legacy capability key) with a Claude-only guard."""

    setting_key = capability.effective_model_setting_key or capability.capability_key
    resolved = store.resolve_platform_model(
        setting_key=setting_key,
        fallback_model_name=fallback_model,
        fallback_provider=CLAUDE_PROVIDER,
    )
    provider = str(resolved.get("provider") or CLAUDE_PROVIDER).lower()
    model_name = str(resolved.get("model_name") or fallback_model)
    if provider != CLAUDE_PROVIDER or not model_name.startswith("claude-"):
        provider = CLAUDE_PROVIDER
        model_name = fallback_model
    return {"setting_key": setting_key, "provider": provider, "model_name": model_name}


def _enabled_catalog_names(client: Any) -> set[str] | None:
    try:
        rows = (
            client.table("tool_registry")
            .select("slug,enabled,is_code_registered")
            .eq("enabled", True)
            .eq("is_code_registered", True)
            .execute()
            .data
            or []
        )
    except Exception:
        # Preserve the already-proven SDK tool set when the governance overlay is unavailable.
        # External MCP still fails closed because its founder connection check is independent.
        return None
    return {str(row.get("slug")) for row in rows if row.get("slug")}


def _select_definitions(
    registry: ToolRegistry,
    requested_tool_names: list[str],
    *,
    enabled_catalog: set[str] | None,
    connected_servers: set[str],
) -> tuple[list[ToolDefinition], list[str]]:
    selected: list[ToolDefinition] = []
    excluded: list[str] = []
    for name in requested_tool_names:
        try:
            definition = registry.get(name)
        except Exception:
            excluded.append(name)
            continue
        if enabled_catalog is not None and name not in enabled_catalog:
            excluded.append(name)
            continue
        if getattr(definition, "source", "native") == "mcp":
            server_name = str((definition.mcp_metadata or {}).get("server_name") or "").lower()
            if server_name not in connected_servers:
                excluded.append(name)
                continue
        selected.append(definition)
    return selected, excluded


def _grantable_names(
    registry: ToolRegistry,
    *,
    enabled_catalog: set[str] | None,
    connected_servers: set[str],
) -> set[str]:
    names: set[str] = set()
    definitions = registry.definitions() if hasattr(registry, "definitions") else []
    for definition in definitions:
        if enabled_catalog is not None and definition.name not in enabled_catalog:
            continue
        if definition.source == "mcp":
            server_name = str((definition.mcp_metadata or {}).get("server_name") or "").lower()
            if server_name not in connected_servers:
                continue
        names.add(definition.name)
    return names


def _connected_sdk_servers(client: Any, *, user_id: str) -> tuple[list[str], dict[str, Any]]:
    try:
        rows = (
            client.table("mcp_connections")
            .select("user_id,server_name,transport,config,status")
            .eq("user_id", str(user_id))
            .eq("status", "connected")
            .execute()
            .data
            or []
        )
    except Exception:
        return [], {}

    names: list[str] = []
    servers: dict[str, Any] = {}
    for row in rows:
        server_name = str(row.get("server_name") or "").strip().lower()
        if not server_name or not sdk_connector_available(client, user_id=user_id, server_name=server_name):
            continue
        config = row.get("config") if isinstance(row.get("config"), dict) else {}
        transport = str(row.get("transport") or "").lower()
        url = str(config.get("url") or "").strip()
        if transport != "http" or not url.startswith("https://"):
            continue
        sdk_name = _safe_server_name(server_name)
        servers[sdk_name] = {"type": "http", "url": url}
        names.append(server_name)
    return names, servers


def _capability_prompt(capability: AgentCapability) -> str:
    return (
        f"You are the bounded {capability.label} capability. {capability.description} "
        "Use only the granted founder-scoped tools, never delegate recursively, keep outputs compact, "
        "and cite every factual insight from returned source metadata."
    )


def _capability_max_turns(capability: AgentCapability) -> int:
    raw = (capability.default_config or {}).get("max_rounds", 1)
    try:
        return max(1, min(int(raw), 12))
    except (TypeError, ValueError):
        return 1


def _internal_tool_name(name: str) -> str:
    return f"{SDK_INTERNAL_PREFIX}{name}"


def _safe_server_name(name: str) -> str:
    return re.sub(r"[^a-z0-9_-]+", "-", name.lower()).strip("-") or "connector"
