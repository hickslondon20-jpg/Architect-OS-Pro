"""MCP client scaffold for registry-discovered connector tools.

Phase 5 ships the machinery with zero configured servers. The concrete SDK
adapter is intentionally lazy so local compile/test runs do not require live
MCP dependencies or connector configuration.
"""

from __future__ import annotations

import asyncio
import inspect
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Protocol


logger = logging.getLogger(__name__)


class MCPClientError(RuntimeError):
    pass


class MCPClientAdapter(Protocol):
    def list_tools(self, server: "MCPServerConfig") -> Any:
        ...

    def call_tool(self, server: "MCPServerConfig", tool_name: str, arguments: dict[str, Any]) -> Any:
        ...


@dataclass(frozen=True)
class MCPServerConfig:
    server_name: str
    transport: str
    config: dict[str, Any] = field(default_factory=dict)
    connection_id: str | None = None
    user_id: str | None = None
    auth_type: str | None = None
    vault_secret_id: str | None = None
    status: str = "connected"


@dataclass(frozen=True)
class DiscoveredMCPTool:
    registry_name: str
    server_name: str
    tool_name: str
    description: str
    input_schema: dict[str, Any]
    keywords: list[str] = field(default_factory=list)
    surface_tags: list[str] = field(default_factory=list)
    capability_hints: list[str] = field(default_factory=list)
    read_only: bool = True


class MCPClientManager:
    """Discovers and calls MCP tools for connected per-user server rows.

    In beta, production has no connected rows, so discovery returns an empty
    list. Tests inject a fake adapter to prove the discovery/call contract
    without shipping a live connector.
    """

    def __init__(
        self,
        *,
        supabase_client: Any | None = None,
        adapter: MCPClientAdapter | None = None,
        servers: list[MCPServerConfig] | None = None,
    ) -> None:
        self._supabase = supabase_client
        self._adapter = adapter or _LazySDKAdapter()
        self._configured_servers = servers
        self._unavailable: dict[str, str] = {}

    def configured_servers(self, *, user_id: str | None = None) -> list[MCPServerConfig]:
        if self._configured_servers is not None:
            servers = list(self._configured_servers)
            return [server for server in servers if user_id is None or server.user_id in (None, user_id)]
        if self._supabase is None:
            return []
        query = (
            self._supabase.table("mcp_connections")
            .select("id,user_id,server_name,transport,config,auth_type,vault_secret_id,status")
            .eq("status", "connected")
        )
        if user_id:
            query = query.eq("user_id", str(user_id))
        rows = query.execute().data or []
        return [_server_from_row(row) for row in rows]

    def discover_tools(self, *, user_id: str | None = None) -> list[DiscoveredMCPTool]:
        discovered: list[DiscoveredMCPTool] = []
        for server in self.configured_servers(user_id=user_id):
            try:
                tools_payload = _await_if_needed(self._adapter.list_tools(server))
            except Exception as exc:
                self._unavailable[server.server_name] = str(exc)
                logger.warning("MCP discovery failed for %s: %s", server.server_name, exc)
                continue
            for raw_tool in _coerce_tool_list(tools_payload):
                tool = _normalize_discovered_tool(server, raw_tool)
                if tool is not None:
                    discovered.append(tool)
        return discovered

    def call_tool(
        self,
        *,
        server_name: str,
        tool_name: str,
        arguments: dict[str, Any],
        user_id: str | None = None,
    ) -> dict[str, Any]:
        server = next(
            (item for item in self.configured_servers(user_id=user_id) if item.server_name == server_name),
            None,
        )
        if server is None:
            raise MCPClientError(f"MCP server is not configured or connected: {server_name}")
        try:
            raw_result = _await_if_needed(self._adapter.call_tool(server, tool_name, arguments))
        except Exception as exc:
            raise MCPClientError(f"MCP tool call failed for {server_name}/{tool_name}: {exc}") from exc
        return _normalize_tool_result(raw_result)

    def unavailable_servers(self) -> dict[str, str]:
        return dict(self._unavailable)


class _LazySDKAdapter:
    """Thin placeholder around the MCP SDK.

    The dependency is pinned for deployment, but the no-server beta path never
    imports it. A future live connector pass can fill in transport-specific
    session handling here without touching registry callers.
    """

    def list_tools(self, server: MCPServerConfig) -> Any:
        self._require_sdk()
        raise MCPClientError(
            f"MCP SDK transport handling for {server.transport!r} is scaffolded; live connectors are v2."
        )

    def call_tool(self, server: MCPServerConfig, tool_name: str, arguments: dict[str, Any]) -> Any:
        self._require_sdk()
        raise MCPClientError(
            f"MCP SDK tool calls for {server.transport!r} are scaffolded; live connectors are v2."
        )

    @staticmethod
    def _require_sdk() -> None:
        try:
            import mcp  # noqa: F401
        except ImportError as exc:
            raise MCPClientError("The mcp package is not installed in this environment.") from exc


def oauth_refresh_not_implemented() -> None:
    raise NotImplementedError("OAuth lifecycle is scaffolded; live connectors are v2.")


def _server_from_row(row: dict[str, Any]) -> MCPServerConfig:
    return MCPServerConfig(
        server_name=str(row.get("server_name") or "").strip(),
        transport=str(row.get("transport") or "").strip(),
        config=row.get("config") if isinstance(row.get("config"), dict) else {},
        connection_id=str(row.get("id")) if row.get("id") else None,
        user_id=str(row.get("user_id")) if row.get("user_id") else None,
        auth_type=str(row.get("auth_type")) if row.get("auth_type") else None,
        vault_secret_id=str(row.get("vault_secret_id")) if row.get("vault_secret_id") else None,
        status=str(row.get("status") or "connected"),
    )


def _normalize_discovered_tool(server: MCPServerConfig, raw_tool: Any) -> DiscoveredMCPTool | None:
    name = _get_attr(raw_tool, "name")
    if not name:
        return None
    description = _get_attr(raw_tool, "description") or f"{server.server_name} MCP tool {name}"
    input_schema = _get_attr(raw_tool, "inputSchema") or _get_attr(raw_tool, "input_schema") or {}
    if not isinstance(input_schema, dict) or not input_schema:
        input_schema = {"type": "object", "properties": {}, "required": []}
    annotations = _get_attr(raw_tool, "annotations") or {}
    read_only = True
    if isinstance(annotations, dict) and annotations.get("readOnlyHint") is False:
        read_only = False
    server_slug = _slug(server.server_name)
    tool_slug = _slug(str(name))
    return DiscoveredMCPTool(
        registry_name=f"mcp_{server_slug}_{tool_slug}",
        server_name=server.server_name,
        tool_name=str(name),
        description=str(description),
        input_schema=input_schema,
        keywords=[server.server_name, str(name), "mcp", "connector"],
        surface_tags=["virtual_cso", "domain_agent"],
        capability_hints=["mcp_connector"],
        read_only=read_only,
    )


def _coerce_tool_list(payload: Any) -> list[Any]:
    if isinstance(payload, dict):
        tools = payload.get("tools", [])
        return tools if isinstance(tools, list) else []
    tools = getattr(payload, "tools", None)
    if isinstance(tools, list):
        return tools
    return payload if isinstance(payload, list) else []


def _normalize_tool_result(raw_result: Any) -> dict[str, Any]:
    if isinstance(raw_result, dict):
        return raw_result
    content = getattr(raw_result, "content", None)
    if isinstance(content, list):
        return {
            "content": [_content_item_to_dict(item) for item in content],
            "is_error": bool(getattr(raw_result, "isError", False) or getattr(raw_result, "is_error", False)),
        }
    return {"content": raw_result}


def _content_item_to_dict(item: Any) -> dict[str, Any]:
    if isinstance(item, dict):
        return item
    data: dict[str, Any] = {}
    for key in ("type", "text", "data", "mimeType", "mime_type"):
        value = getattr(item, key, None)
        if value is not None:
            data[key] = value
    return data or {"value": str(item)}


def _get_attr(value: Any, key: str) -> Any:
    if isinstance(value, dict):
        return value.get(key)
    return getattr(value, key, None)


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9_]+", "_", value.strip().lower()).strip("_")
    return slug or "server"


def _await_if_needed(value: Any) -> Any:
    if not inspect.isawaitable(value):
        return value
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(value)
    if loop.is_running():
        raise MCPClientError("Async MCP SDK calls require a sync adapter in this context.")
    return loop.run_until_complete(value)
