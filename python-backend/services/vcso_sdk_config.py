"""Per-founder registry compiler for the feature-gated Virtual CSO SDK path."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from claude_agent_sdk import ClaudeAgentOptions, create_sdk_mcp_server
from claude_agent_sdk.types import AgentDefinition

from services.agent_capabilities import AgentCapability, AgentCapabilityRegistry
from services.mcp_connectors import sdk_connector_available
from services.tool_registry import ToolDefinition, ToolRegistry


SDK_INTERNAL_SERVER = "architectos"
# Phase D2 (SDK-M2): the external (loopback HTTP) worker MCP server name. Must match the FastMCP `name`
# in services/vcso_worker_mcp_server.py. In model-driven mode the worker handlers are exposed from this
# EXTERNAL server, referenced inline per-agent and kept OUT of top-level mcp_servers, so the lead cannot
# see or call run_<agent> — it must delegate via Task (04B-D2-FINDINGS.md §2-§3).
MODEL_DRIVEN_WORKER_SERVER = "vcso_workers"
# The SDK's delegation built-in has TWO names, and conflating them cost the first canary (Stage H):
#   * PROVISION name ("Task") — what `ClaudeAgentOptions.tools` / `allowed_tools` must contain.
#     `tools` decides which built-ins EXIST (`tools=[]` disables all of them); `allowed_tools` only
#     decides which are permitted without prompting. Granting permission alone provisions nothing.
#   * RUNTIME name ("Agent") — what the model actually emits, so every hook matcher and every
#     `tool_name ==` comparison must key off this one.
# Confirmed empirically against claude-agent-sdk 0.2.118 on 2026-07-19; see the post-canary CLI
# experiment in 04B-D2-M2-FINISH-LOG.md. Re-verify both if the SDK is upgraded.
DELEGATION_TOOL_PROVISION_NAME = "Task"
DELEGATION_TOOL_RUNTIME_NAME = "Agent"
# BOTH names must be exempted from `disallowed_tools` in model-driven mode. DISALLOWED_SDK_BUILTINS below
# blocks both (correctly, for Path A and the flat loop, which must never spawn agents). Exempting only the
# provision name leaves the RUNTIME name blocked, so the lead is handed a delegation tool it is forbidden
# to call and stalls to max_turns — reproduced locally as probe variant E, fixed as variant F.
DELEGATION_TOOL_NAMES = frozenset({DELEGATION_TOOL_PROVISION_NAME, DELEGATION_TOOL_RUNTIME_NAME})
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
    agent_handler_tools: dict[str, str] = field(default_factory=dict)
    connector_names: list[str] = field(default_factory=list)
    excluded_tool_names: list[str] = field(default_factory=list)


def compile_founder_sdk_options(
    *,
    store: Any | None,
    user_id: str,
    registry: ToolRegistry,
    requested_tool_names: list[str],
    sdk_tools_by_name: dict[str, Any],
    system_prompt: str,
    main_model: str,
    api_key: str,
    hooks: dict[str, Any],
    max_turns: int,
    max_budget_usd: float,
    enable_native_subagents: bool = False,
    native_subagent_tools: dict[str, Any] | None = None,
    model_driven_worker_server_url: str | None = None,
) -> CompiledFounderSdkOptions:
    """Compile one founder's callable tools, bounded agents, models, and MCP servers.

    Tool existence comes from the in-process registry; the live catalog remains the enabled/drift
    overlay. Capabilities own their grants and routing tier. External MCP servers require all three
    authorities: pilot feature availability, a connected founder-owned row, and a registered tool.
    """

    client = getattr(store, "client", None)
    native_subagent_tools = native_subagent_tools or {}
    # Model-driven delegation (D2): when a worker-server URL is supplied, expose each worker handler from
    # the EXTERNAL per-agent server instead of the in-process session server. Path-A/Fix-C behavior is
    # byte-identical when this is None.
    model_driven = bool(model_driven_worker_server_url)
    enabled_catalog = _enabled_catalog_names(client) if client is not None else None
    connected_servers = _connected_sdk_servers(client, user_id=user_id) if client is not None else []
    selected, excluded = _select_definitions(
        registry,
        requested_tool_names,
        enabled_catalog=enabled_catalog,
        connected_servers=set(connected_servers),
    )
    if enable_native_subagents:
        # Native leads coordinate through Task only. Do not register selected registry tools on
        # their session MCP surface; handler-backed workers execute through their single handler.
        selected = []

    capabilities = (
        [
            capability
            for capability in AgentCapabilityRegistry(store).list_active()
            if "virtual_cso" in capability.allowed_surfaces and not capability.can_spawn_agents
        ]
        if store is not None
        else []
    )
    if enable_native_subagents:
        # Native mode exposes only the explicitly required Task agents. Registering every active
        # capability here widens the lead's Task choices and pulls unrelated registry tools into
        # the session even though handler-backed workers never call those tools directly.
        capabilities = [
            capability
            for capability in capabilities
            if capability.capability_key in native_subagent_tools
        ]
    agents: dict[str, AgentDefinition] = {}
    agent_tool_grants: dict[str, list[str]] = {}
    agent_model_routes: dict[str, dict[str, str]] = {}
    agent_handler_tools: dict[str, str] = {}
    # Model-driven only: the exact per-agent worker handler tool names (mcp__vcso_workers__run_<agent>).
    # These MUST be pre-approved on the lead's `allowed_tools` — under permission_mode="dontAsk" a subagent
    # MCP tool absent from the PARENT allowed_tools is silently denied (ListTools 200 but zero CallToolRequest
    # ever reaches the worker server), which was the v0.6.74 production defect. This list is the single source
    # for both the per-agent AgentDefinition.tools and the lead pre-approval below, so the two cannot drift.
    model_driven_worker_tools: list[str] = []
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
        sdk_grants = [_sdk_tool_name(registry.get(name)) for name in grant_names]
        route = resolve_capability_model(store, capability=capability, fallback_model=main_model)
        handler_tool = native_subagent_tools.get(capability.capability_key)
        handler_name = _native_handler_name(capability.capability_key) if handler_tool is not None else None
        if handler_name and model_driven:
            # External per-agent worker server: the worker handler is scoped to this agent (not the lead's
            # availability list), but the handler tool name is still pre-approved on the lead so the SDK does
            # not silently deny the subagent's call under dontAsk.
            agent_tools = [f"mcp__{MODEL_DRIVEN_WORKER_SERVER}__{handler_name}"]
            model_driven_worker_tools.extend(agent_tools)
            # The worker tool-call timeout is delivered via the `MCP_TOOL_TIMEOUT` env var (Railway),
            # NOT a per-server config key: the deployed CLI rejects an unknown `timeout` key on the http
            # server config, which stranded the lead with no valid delegation target (see 04B-D2 findings).
            agent_mcp_servers: list[Any] | None = [
                {MODEL_DRIVEN_WORKER_SERVER: {"type": "http", "url": model_driven_worker_server_url}}
            ]
        elif handler_name:
            agent_tools = [f"mcp__{SDK_INTERNAL_SERVER}__{handler_name}"]
            agent_mcp_servers = [SDK_INTERNAL_SERVER]
        else:
            agent_tools = sdk_grants
            agent_mcp_servers = None
        agents[capability.capability_key] = AgentDefinition(
            description=capability.description or capability.label,
            prompt=_capability_prompt(capability, handler_name=handler_name),
            tools=agent_tools,
            disallowedTools=list(DISALLOWED_SDK_BUILTINS),
            model=route["model_name"],
            # A handler-backed SDK subagent needs one turn to call its implementation
            # tool and one turn to receive the result and return the compact finding.
            maxTurns=max(2, _capability_max_turns(capability)) if handler_name else _capability_max_turns(capability),
            permissionMode="dontAsk",
            # The in-process server is registered once at session level for SDK transport, while
            # the agent definition explicitly declares the only MCP server its worker may use. In
            # model-driven mode this is an EXTERNAL per-agent server (kept out of top-level mcp_servers).
            mcpServers=agent_mcp_servers,
        )
        agent_tool_grants[capability.capability_key] = grant_names
        agent_model_routes[capability.capability_key] = route
        if handler_name:
            agent_handler_tools[capability.capability_key] = handler_name

    definition_by_name = {definition.name: definition for definition in selected}
    for definition in registry.definitions() if hasattr(registry, "definitions") else []:
        definition_by_name.setdefault(definition.name, definition)
    used_names: list[str] = [definition.name for definition in selected]
    for capability_key, grant_names in agent_tool_grants.items():
        # A native handler is the worker's complete implementation surface. Its underlying
        # registry grants remain audit metadata but must not be registered as session MCP tools.
        if capability_key in agent_handler_tools:
            continue
        used_names.extend(name for name in grant_names if name not in used_names)
    grouped_tools: dict[str, list[Any]] = {SDK_INTERNAL_SERVER: []}
    connected_set = set(connected_servers)
    for name in used_names:
        definition = definition_by_name.get(name)
        sdk_tool = sdk_tools_by_name.get(name)
        if definition is None or sdk_tool is None:
            continue
        server_name = _definition_server_name(definition)
        if server_name != SDK_INTERNAL_SERVER and server_name not in connected_set:
            continue
        grouped_tools.setdefault(server_name, []).append(sdk_tool)
    if not model_driven:
        # In-process worker tools attach to the session server only for the Path-A/Fix-C surface. Model-
        # driven scoping exposes workers via the external per-agent server instead (D2), so they are never
        # added to any top-level server — keeping run_<agent> out of the lead's tool schema.
        grouped_tools[SDK_INTERNAL_SERVER].extend(native_subagent_tools.values())
    mcp_servers = {
        server_name: create_sdk_mcp_server(name=server_name, version="1.0.0", tools=server_tools)
        for server_name, server_tools in grouped_tools.items()
    }
    compiled_connectors = sorted(name for name in grouped_tools if name != SDK_INTERNAL_SERVER)
    main_disallowed_tools = [
        name
        for name in DISALLOWED_SDK_BUILTINS
        if not (enable_native_subagents and name in DELEGATION_TOOL_NAMES)
    ]
    main_allowed_tools = [_sdk_tool_name(definition) for definition in selected]
    if enable_native_subagents:
        main_allowed_tools.append(DELEGATION_TOOL_PROVISION_NAME)
    if model_driven:
        # Pre-approve each provisioned worker handler so the subagent's MCP call is permitted (not silently
        # denied) under dontAsk. Isolation is preserved on the exposure surface: the worker server stays out
        # of top-level mcp_servers and the handler names stay out of the lead's `tools` availability list.
        main_allowed_tools.extend(model_driven_worker_tools)
    options = ClaudeAgentOptions(
        # `tools` PROVISIONS built-in tools. Path A stays `[]` (compose-only: it deliberately wants no
        # tools at all). Model-driven MUST provision the delegation built-in here — putting it only in
        # `allowed_tools` permits a tool that does not exist, which is what left the Stage H lead with an
        # empty tool schema, hallucinating delegations in prose until it hit max_turns.
        tools=[DELEGATION_TOOL_PROVISION_NAME] if enable_native_subagents else [],
        allowed_tools=main_allowed_tools,
        disallowed_tools=main_disallowed_tools,
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
        agent_handler_tools=agent_handler_tools,
        connector_names=compiled_connectors,
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


def _connected_sdk_servers(client: Any, *, user_id: str) -> list[str]:
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
        return []

    names: list[str] = []
    for row in rows:
        server_name = str(row.get("server_name") or "").strip().lower()
        if not server_name or not sdk_connector_available(client, user_id=user_id, server_name=server_name):
            continue
        names.append(_safe_server_name(server_name))
    return names


def _capability_prompt(capability: AgentCapability, *, handler_name: str | None = None) -> str:
    prompt = (
        f"You are the bounded {capability.label} capability. {capability.description} "
        "Use only the granted founder-scoped tools, never delegate recursively, keep outputs compact, "
        "and cite every factual insight from returned source metadata."
    )
    if handler_name:
        prompt += (
            f" Your one implementation tool is {handler_name}. Read the lead's JSON task contract, "
            "call that tool exactly once with its objective, output_format, tools_sources, boundaries, "
            "and context_scope, then return only the compact cited handler result. Never expose the raw "
            "task contract or tool payload."
        )
    return prompt


def _native_handler_name(capability_key: str) -> str:
    return f"run_{_safe_server_name(capability_key)}"


def _capability_max_turns(capability: AgentCapability) -> int:
    raw = (capability.default_config or {}).get("max_rounds", 1)
    try:
        return max(1, min(int(raw), 12))
    except (TypeError, ValueError):
        return 1


def _sdk_tool_name(definition: ToolDefinition) -> str:
    return f"mcp__{_definition_server_name(definition)}__{definition.name}"


def _definition_server_name(definition: ToolDefinition) -> str:
    if getattr(definition, "source", "native") != "mcp":
        return SDK_INTERNAL_SERVER
    server_name = str((getattr(definition, "mcp_metadata", {}) or {}).get("server_name") or "")
    return _safe_server_name(server_name)


def _safe_server_name(name: str) -> str:
    return re.sub(r"[^a-z0-9_-]+", "-", name.lower()).strip("-") or "connector"
