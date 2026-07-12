"""Unified in-process tool registry for ArchitectOS intelligence surfaces.

This module is the D1-neutral seam between the Ep1/M8 capability registry and
the Ep5 callable-tool registry. Tool definitions live here; authorization can
come from agent_capabilities (today's conservative default) or registry-native
tags by swapping the scope source passed to ToolRegistry.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Callable, Literal, Protocol

from services.agent_capabilities import AgentCapabilityRegistry
from services.mcp_client import DiscoveredMCPTool, MCPClientManager

ToolSource = Literal["native", "skill", "mcp"]
ToolLoading = Literal["always", "deferred"]
ExecutorKind = Literal["native", "skill", "mcp"]


@dataclass(frozen=True)
class ToolSourceRef:
    source_kind: str
    source_id: str | None
    verbatim: str | None = None
    label: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "source_kind": self.source_kind,
            "source_id": self.source_id,
        }
        if self.verbatim is not None:
            data["verbatim"] = self.verbatim
        if self.label is not None:
            data["label"] = self.label
        if self.metadata:
            data["metadata"] = self.metadata
        return data


@dataclass(frozen=True)
class ToolResultEnvelope:
    content: dict[str, Any]
    sources: list[ToolSourceRef] = field(default_factory=list)
    provenance: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "content": self.content,
            "sources": [source.to_dict() for source in self.sources],
        }
        if self.provenance:
            data["provenance"] = self.provenance
        return data


@dataclass
class ToolExecutionContext:
    user_id: str
    store: Any | None = None
    supabase_client: Any | None = None
    sandbox_service: Any | None = None
    thread_id: str | None = None
    timeout_seconds: float | None = None
    allowed_skill_file_ids: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def client(self) -> Any:
        if self.supabase_client is not None:
            return self.supabase_client
        if self.store is not None:
            return self.store.client
        raise ToolRegistryError("A Supabase client or VectorStore is required for this tool.")


ToolExecutor = Callable[[ToolExecutionContext, dict[str, Any]], ToolResultEnvelope]


@dataclass(frozen=True)
class ToolDefinition:
    name: str
    description: str
    json_schema: dict[str, Any]
    source: ToolSource
    executor_kind: ExecutorKind
    executor: ToolExecutor | None = None
    loading: ToolLoading = "always"
    citation: dict[str, Any] = field(default_factory=dict)
    capability_hints: list[str] = field(default_factory=list)
    surface_tags: list[str] = field(default_factory=list)
    keywords: list[str] = field(default_factory=list)
    skill_metadata: dict[str, Any] = field(default_factory=dict)
    mcp_metadata: dict[str, Any] = field(default_factory=dict)

    def compact_dict(self) -> dict[str, str]:
        return {"name": self.name, "description": self.description}


class ToolRegistryError(RuntimeError):
    pass


class ToolScopeSource(Protocol):
    def names_for_scope(
        self,
        registry: "ToolRegistry",
        *,
        surface: str,
        capability: str | None = None,
        names: list[str] | None = None,
    ) -> list[str]:
        ...


class AgentCapabilityScopeSource:
    """Scope source backed by agent_capabilities.allowed_tools.

    This is the default for Phase 2 so authorization remains in the existing
    capability layer. Swapping to RegistryNativeScopeSource is intentionally a
    one-line constructor change; that is the D1-neutral fork.
    """

    def __init__(self, store: Any) -> None:
        self._capabilities = AgentCapabilityRegistry(store)

    def names_for_scope(
        self,
        registry: "ToolRegistry",
        *,
        surface: str,
        capability: str | None = None,
        names: list[str] | None = None,
    ) -> list[str]:
        if not capability:
            raise ToolRegistryError("Capability is required when using agent_capabilities-backed scoping.")
        allowed = self._capabilities.get_for_surface(capability, surface).allowed_tools
        selected = _ordered_intersection(registry.tool_names(), allowed)
        if names is not None:
            selected = _ordered_intersection(selected, names)
        return selected


class RegistryNativeScopeSource:
    """Scope source backed by registry-native surface/capability tags."""

    def names_for_scope(
        self,
        registry: "ToolRegistry",
        *,
        surface: str,
        capability: str | None = None,
        names: list[str] | None = None,
    ) -> list[str]:
        selected: list[str] = []
        for definition in registry.definitions():
            surface_tags = definition.surface_tags
            surface_ok = not surface_tags or surface in surface_tags
            if surface == "virtual_cso_deep" and "virtual_cso" in surface_tags:
                surface_ok = True
            capability_ok = capability is None or not definition.capability_hints or capability in definition.capability_hints
            if surface_ok and capability_ok:
                selected.append(definition.name)
        if names is not None:
            selected = _ordered_intersection(selected, names)
        return selected


class ToolRegistry:
    def __init__(
        self,
        *,
        store: Any | None = None,
        supabase_client: Any | None = None,
        scope_source: ToolScopeSource | None = None,
        include_skills_for_user_id: str | None = None,
    ) -> None:
        self.store = store
        self.supabase_client = supabase_client or (store.client if store is not None else None)
        self.scope_source = scope_source or (
            AgentCapabilityScopeSource(store) if store is not None else RegistryNativeScopeSource()
        )
        self._tools: dict[str, ToolDefinition] = {}
        self._register_native_tools()
        if include_skills_for_user_id:
            self.register_skill_pack_tools(include_skills_for_user_id)

    def register(self, definition: ToolDefinition) -> None:
        if definition.name in self._tools:
            raise ToolRegistryError(f"Duplicate tool definition: {definition.name}")
        self._tools[definition.name] = definition

    def definitions(self) -> list[ToolDefinition]:
        return list(self._tools.values())

    def tool_names(self) -> list[str]:
        return list(self._tools.keys())

    def get(self, name: str) -> ToolDefinition:
        try:
            return self._tools[name]
        except KeyError as exc:
            raise ToolRegistryError(f"Unknown tool: {name!r}") from exc

    def get_tools(
        self,
        *,
        surface: str,
        capability: str | None = None,
        names: list[str] | None = None,
        format: Literal["definition", "anthropic", "openai"] = "definition",
    ) -> list[Any]:
        scoped_names = self.scope_source.names_for_scope(
            self,
            surface=surface,
            capability=capability,
            names=names,
        )
        definitions = [self.get(name) for name in scoped_names]
        if format == "anthropic":
            return to_anthropic(definitions)
        if format == "openai":
            return to_openai(definitions)
        return definitions

    def execute(
        self,
        name: str,
        context: ToolExecutionContext,
        tool_input: dict[str, Any],
    ) -> ToolResultEnvelope:
        definition = self.get(name)
        if definition.executor_kind == "skill":
            return _load_skill_body(definition)
        if definition.executor_kind == "mcp":
            if definition.executor is None:
                raise ToolRegistryError(f"MCP tool {name!r} has no executor.")
            return definition.executor(context, tool_input)
        if definition.executor is None:
            raise ToolRegistryError(f"Tool {name!r} has no executor.")
        return definition.executor(context, tool_input)

    def compact_catalog(
        self,
        *,
        surface: str,
        capability: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, str]]:
        defs = self.get_tools(surface=surface, capability=capability, format="definition")
        return [definition.compact_dict() for definition in defs[: max(1, min(limit, 100))]]

    def tool_search(
        self,
        query: str,
        *,
        surface: str,
        capability: str | None = None,
        limit: int = 8,
    ) -> list[ToolDefinition]:
        defs = self.get_tools(surface=surface, capability=capability, format="definition")
        scored = [
            (definition, _score_definition(query, definition))
            for definition in defs
            if definition.name != "tool_search"
        ]
        matches = [item for item in scored if item[1] > 0]
        matches.sort(key=lambda item: (-item[1], item[0].name))
        return [definition for definition, _score in matches[: max(1, min(limit, 20))]]

    def register_skill_pack_tools(self, user_id: str) -> None:
        if self.supabase_client is None:
            raise ToolRegistryError("A Supabase client is required to register skill packs.")
        rows = (
            self.supabase_client.table("skill_packs")
            .select(
                "id,slug,name,description,skill_kind,domain,trigger_tags,body,status,"
                "version,required_platform_context,output_contract,writeback_rules,user_id,scope,requires_sandbox"
            )
            .eq("status", "active")
            .execute()
            .data
            or []
        )
        for row in rows:
            if row.get("scope") != "global" and str(row.get("user_id")) != str(user_id):
                continue
            slug = str(row.get("slug") or "").strip()
            if not slug or slug in self._tools:
                continue
            self.register(
                ToolDefinition(
                    name=slug,
                    description=str(row.get("description") or row.get("name") or slug),
                    json_schema={"type": "object", "properties": {}, "required": []},
                    source="skill",
                    executor_kind="skill",
                    loading="deferred",
                    citation={"kind": "skill_body", "source_kind": "skill_pack"},
                    capability_hints=["skill_pack"],
                    surface_tags=["virtual_cso", "domain_agent"],
                    keywords=list(row.get("trigger_tags") or []),
                    skill_metadata={
                        "id": row.get("id"),
                        "slug": slug,
                        "name": row.get("name"),
                        "body": row.get("body") or "",
                        "output_contract": row.get("output_contract") or {},
                        "writeback_rules": row.get("writeback_rules") or {},
                        "required_platform_context": row.get("required_platform_context") or [],
                        "requires_sandbox": bool(row.get("requires_sandbox")),
                        "scope": row.get("scope"),
                        "user_id": row.get("user_id"),
                        "version": row.get("version"),
                    },
                )
            )

    def register_mcp_tools(self, manager: MCPClientManager, *, user_id: str | None = None) -> int:
        registered = 0
        for discovered in manager.discover_tools(user_id=user_id):
            if discovered.registry_name in self._tools:
                continue
            self.register(_tool_definition_from_mcp(manager, discovered))
            registered += 1
        return registered

    def _register_native_tools(self) -> None:
        for definition in _native_tool_definitions():
            self.register(definition)


def to_anthropic(definitions: list[ToolDefinition]) -> list[dict[str, Any]]:
    return [
        {
            "name": definition.name,
            "description": definition.description,
            "input_schema": definition.json_schema,
        }
        for definition in definitions
    ]


def to_openai(definitions: list[ToolDefinition]) -> list[dict[str, Any]]:
    return [
        {
            "type": "function",
            "function": {
                "name": definition.name,
                "description": definition.description,
                "parameters": definition.json_schema,
            },
        }
        for definition in definitions
    ]


def _tool_definition_from_mcp(manager: MCPClientManager, discovered: DiscoveredMCPTool) -> ToolDefinition:
    def _execute_mcp(context: ToolExecutionContext, tool_input: dict[str, Any]) -> ToolResultEnvelope:
        result = manager.call_tool(
            server_name=discovered.server_name,
            tool_name=discovered.tool_name,
            arguments=tool_input,
            user_id=context.user_id,
        )
        return _mcp_result_envelope(discovered, result)

    return ToolDefinition(
        name=discovered.registry_name,
        description=discovered.description,
        json_schema=discovered.input_schema,
        source="mcp",
        executor_kind="mcp",
        executor=_execute_mcp,
        loading="deferred",
        citation={"source_kind": "mcp", "mode": "tool_result"},
        capability_hints=discovered.capability_hints,
        surface_tags=discovered.surface_tags,
        keywords=discovered.keywords,
        mcp_metadata={
            "server_name": discovered.server_name,
            "tool_name": discovered.tool_name,
            "read_only": discovered.read_only,
        },
    )


def _mcp_result_envelope(discovered: DiscoveredMCPTool, result: dict[str, Any]) -> ToolResultEnvelope:
    verbatim = _mcp_verbatim(result)
    return ToolResultEnvelope(
        content=result,
        sources=[
            ToolSourceRef(
                source_kind="mcp",
                source_id=f"{discovered.server_name}:{discovered.tool_name}",
                verbatim=verbatim,
                label=f"{discovered.server_name} / {discovered.tool_name}",
                metadata={
                    "server_name": discovered.server_name,
                    "tool_name": discovered.tool_name,
                    "registry_name": discovered.registry_name,
                },
            )
        ],
        provenance={"source": "mcp", "read_only": discovered.read_only},
    )


def _mcp_verbatim(result: dict[str, Any]) -> str | None:
    content = result.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text_items = [
            str(item.get("text"))
            for item in content
            if isinstance(item, dict) and item.get("type") == "text" and item.get("text") is not None
        ]
        return "\n".join(text_items) or None
    if isinstance(content, dict):
        text = content.get("text")
        return str(text) if text is not None else None
    return None


def build_registry(
    *,
    store: Any | None = None,
    supabase_client: Any | None = None,
    scope_source: ToolScopeSource | None = None,
    include_skills_for_user_id: str | None = None,
    mcp_client_manager: MCPClientManager | None = None,
    include_mcp_for_user_id: str | None = None,
) -> ToolRegistry:
    registry = ToolRegistry(
        store=store,
        supabase_client=supabase_client,
        scope_source=scope_source,
        include_skills_for_user_id=include_skills_for_user_id,
    )
    if mcp_client_manager is not None:
        registry.register_mcp_tools(mcp_client_manager, user_id=include_mcp_for_user_id)
    return registry


def _native_tool_definitions() -> list[ToolDefinition]:
    return [
        ToolDefinition(
            name="kb_ls",
            description=(
                "List the immediate contents of a Knowledge Base folder. "
                "Returns folders first (alphabetical), then files (alphabetical). "
                "Use this to explore one level at a time."
            ),
            json_schema={
                "type": "object",
                "properties": {
                    "folder_id": {
                        "type": ["string", "null"],
                        "description": "UUID of the folder to list. null = Knowledge Base root.",
                    }
                },
                "required": [],
            },
            source="native",
            executor_kind="native",
            executor=_execute_kb_ls,
            citation={"source_kind": "raw_document", "mode": "metadata"},
            capability_hints=["kb_explorer_agent"],
            surface_tags=["virtual_cso", "os_engine", "domain_agent"],
            keywords=["knowledge base", "folder", "list", "documents"],
        ),
        ToolDefinition(
            name="kb_tree",
            description=(
                "Get a nested tree view of the Knowledge Base from a starting folder. "
                "Use depth=2 for an overview, depth=3 or more for detailed exploration."
            ),
            json_schema={
                "type": "object",
                "properties": {
                    "folder_id": {
                        "type": ["string", "null"],
                        "description": "Root folder UUID. null = Knowledge Base root.",
                    },
                    "depth": {
                        "type": "integer",
                        "description": "Levels to traverse (1-10). Default: 3.",
                        "default": 3,
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max items to return (1-500). Default: 200.",
                        "default": 200,
                    },
                },
                "required": [],
            },
            source="native",
            executor_kind="native",
            executor=_execute_kb_tree,
            citation={"source_kind": "raw_document", "mode": "metadata"},
            capability_hints=["kb_explorer_agent"],
            surface_tags=["virtual_cso", "os_engine", "domain_agent"],
            keywords=["knowledge base", "tree", "folder", "documents"],
        ),
        ToolDefinition(
            name="kb_grep",
            description=(
                "Search the extracted text of all documents for a regex pattern. "
                "Returns matching document names and IDs - not content excerpts. "
                "Use kb_read to inspect matching documents."
            ),
            json_schema={
                "type": "object",
                "properties": {
                    "pattern": {
                        "type": "string",
                        "description": "Case-insensitive regex to search for (e.g. 'revenue', 'Q[34]\\s+\\d{4}').",
                    },
                    "folder_id": {
                        "type": ["string", "null"],
                        "description": "Scope search to a folder subtree. null = all documents.",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max results (1-100). Default: 50.",
                        "default": 50,
                    },
                },
                "required": ["pattern"],
            },
            source="native",
            executor_kind="native",
            executor=_execute_kb_grep,
            citation={"source_kind": "raw_document", "mode": "metadata"},
            capability_hints=["kb_explorer_agent"],
            surface_tags=["virtual_cso", "os_engine", "domain_agent"],
            keywords=["search", "regex", "document", "content"],
        ),
        ToolDefinition(
            name="kb_glob",
            description=(
                "Find documents whose filenames match a glob pattern. "
                "Supports *, ?, [seq] wildcards. Case-insensitive. Filename only - no folder path."
            ),
            json_schema={
                "type": "object",
                "properties": {
                    "pattern": {
                        "type": "string",
                        "description": "Glob pattern (e.g. '*.pdf', 'report*', '*Q3*').",
                    },
                    "folder_id": {
                        "type": ["string", "null"],
                        "description": "Scope to a folder subtree. null = all documents.",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max results (1-200). Default: 200.",
                        "default": 200,
                    },
                },
                "required": ["pattern"],
            },
            source="native",
            executor_kind="native",
            executor=_execute_kb_glob,
            citation={"source_kind": "raw_document", "mode": "metadata"},
            capability_hints=["kb_explorer_agent"],
            surface_tags=["virtual_cso", "os_engine", "domain_agent"],
            keywords=["filename", "glob", "document", "file"],
        ),
        ToolDefinition(
            name="kb_read",
            description=(
                "Read the extracted text content of a document. "
                "Omit start_line and end_line for the full document (max 2000 lines). "
                "Provide both start_line and end_line for a specific range (max 500 lines, 1-indexed inclusive). "
                "Use the document_id from kb_grep, kb_glob, kb_ls, or kb_tree results."
            ),
            json_schema={
                "type": "object",
                "properties": {
                    "document_id": {
                        "type": "string",
                        "description": "UUID of the document to read.",
                    },
                    "start_line": {
                        "type": "integer",
                        "description": "Start line (1-indexed, inclusive). Omit for full read.",
                    },
                    "end_line": {
                        "type": "integer",
                        "description": "End line (1-indexed, inclusive). Must be provided with start_line.",
                    },
                },
                "required": ["document_id"],
            },
            source="native",
            executor_kind="native",
            executor=_execute_kb_read,
            citation={"source_kind": "raw_document", "mode": "verbatim"},
            capability_hints=["kb_explorer_agent"],
            surface_tags=["virtual_cso", "os_engine", "domain_agent"],
            keywords=["read", "document", "content", "source"],
        ),
        ToolDefinition(
            name="wiki_search",
            description=(
                "Search the founder's compiled wiki by keyword query. "
                "Returns matching wiki pages with titles and summaries. "
                "Use this to find synthesized knowledge about business context, diagnostics, "
                "sprint history, clients, offers, and conversation threads. "
                "Prefer wiki_search over kb_grep when looking for synthesized intelligence "
                "rather than raw document content."
            ),
            json_schema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Keyword or phrase to search for (e.g. 'revenue', 'client retention', 'sprint goals').",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max results to return (1-20). Default: 5.",
                        "default": 5,
                    },
                },
                "required": ["query"],
            },
            source="native",
            executor_kind="native",
            executor=_execute_wiki_search,
            citation={"source_kind": "wiki_page", "mode": "metadata"},
            capability_hints=["kb_explorer_agent"],
            surface_tags=["virtual_cso", "os_engine", "domain_agent"],
            keywords=["wiki", "search", "synthesized", "knowledge"],
        ),
        ToolDefinition(
            name="wiki_get_page",
            description=(
                "Retrieve a specific wiki page by its canonical key. "
                "Use this when you know the exact page key from a wiki_search or wiki_list result. "
                "Returns the full page content."
            ),
            json_schema={
                "type": "object",
                "properties": {
                    "canonical_key": {
                        "type": "string",
                        "description": (
                            "The canonical key of the wiki page "
                            "(e.g. 'business_context', 'diagnostic_synthesis', or a Layer 2 page key)."
                        ),
                    },
                },
                "required": ["canonical_key"],
            },
            source="native",
            executor_kind="native",
            executor=_execute_wiki_get_page,
            citation={"source_kind": "wiki_page", "mode": "verbatim"},
            capability_hints=["kb_explorer_agent"],
            surface_tags=["virtual_cso", "os_engine", "domain_agent"],
            keywords=["wiki", "page", "canonical", "read"],
        ),
        ToolDefinition(
            name="wiki_list",
            description=(
                "List wiki pages available for this founder, optionally filtered by page kind. "
                "Use this to discover what synthesized knowledge exists before searching. "
                "Returns page titles, kinds, and canonical keys."
            ),
            json_schema={
                "type": "object",
                "properties": {
                    "kind": {
                        "type": ["string", "null"],
                        "description": (
                            "Filter by page kind. Examples: 'wiki_layer1' (compiled platform knowledge), "
                            "'sprint_history', 'thread_synthesis', 'client', 'offer'. "
                            "null = return all kinds."
                        ),
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max pages to return (1-50). Default: 20.",
                        "default": 20,
                    },
                },
                "required": [],
            },
            source="native",
            executor_kind="native",
            executor=_execute_wiki_list,
            citation={"source_kind": "wiki_page", "mode": "metadata"},
            capability_hints=["kb_explorer_agent"],
            surface_tags=["virtual_cso", "os_engine", "domain_agent"],
            keywords=["wiki", "list", "pages", "knowledge"],
        ),
        ToolDefinition(
            name="execute_code",
            description=(
                "Run Python code in the persistent sandbox session for this task. Variables and "
                "imports persist across calls. Returns stdout, stderr, and exit code. If your code "
                "writes an output file, report it in the final summary using the PRODUCED_FILE line."
            ),
            json_schema={
                "type": "object",
                "properties": {
                    "code": {"type": "string", "description": "Python code to execute."},
                    "description": {"type": "string", "description": "Brief purpose of this code run."},
                },
                "required": ["code"],
            },
            source="native",
            executor_kind="native",
            executor=_execute_code,
            citation={"source_kind": "computation", "mode": "provenance"},
            capability_hints=["sandbox_execution_agent"],
            # Intentionally NOT tagged "virtual_cso": this tool must only be reachable inside the
            # bounded sandbox_execution_agent sub-agent loop (SANDBOX_EXECUTION_TOOLS in
            # sandbox_execution_service.py, which fetches it by exact name via registry.get() and
            # bypasses surface scoping entirely). RegistryNativeScopeSource.names_for_scope() treats
            # capability=None (as passed by the main VCSO tool loop's own surface-based tool catalog
            # build) as "no capability restriction", so a surface_tags=["virtual_cso"] entry here would
            # leak execute_code into the top-level VCSO loop's own tool list, letting the model call it
            # directly outside the sub-agent and hit a bare KeyError('code') when it omits the code
            # argument (observed live 2026-07-11, run e3208ba2, steps 5-6). Use a marker tag no real
            # surface ever requests so this only stays reachable via direct-by-name registry lookup.
            surface_tags=["sandbox_execution_internal"],
            keywords=["python", "code", "sandbox", "compute", "execute"],
        ),
        ToolDefinition(
            name="read_skill_file",
            description=(
                "Read the full text content of a file attached to the selected skill. Use a "
                "skill_file_id from the task context."
            ),
            json_schema={
                "type": "object",
                "properties": {
                    "skill_file_id": {"type": "string", "description": "UUID of the skill file to read."},
                },
                "required": ["skill_file_id"],
            },
            source="native",
            executor_kind="native",
            executor=_execute_read_skill_file,
            citation={"source_kind": "skill_file", "mode": "verbatim"},
            capability_hints=["sandbox_execution_agent"],
            # See execute_code above: sandbox-sub-agent-only tool, deliberately not surfaced to the
            # main VCSO tool loop's own catalog.
            surface_tags=["sandbox_execution_internal"],
            keywords=["skill", "file", "template", "read"],
        ),
        ToolDefinition(
            name="tool_search",
            description="Search the scoped tool catalog and return matching tool definitions. Pure retrieval; no model call.",
            json_schema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query for tools or skills."},
                    "limit": {"type": "integer", "description": "Maximum matching tools to return.", "default": 8},
                },
                "required": ["query"],
            },
            source="native",
            executor_kind="native",
            executor=_execute_tool_search,
            citation={"source_kind": "tool_registry", "mode": "metadata"},
            capability_hints=["kb_explorer_agent", "sandbox_execution_agent"],
            surface_tags=["virtual_cso", "os_engine", "domain_agent"],
            keywords=["tool", "search", "catalog", "discover"],
        ),
        ToolDefinition(
            name="delegate_to_sub_agent",
            description=(
                "Delegate a bounded research or computation task to an authorized ArchitectOS sub-agent, "
                "then return a compact result summary and curated trace. Use this when a task is better "
                "handled by a capability agent than by direct tool calls."
            ),
            json_schema={
                "type": "object",
                "properties": {
                    "capability_key": {
                        "type": "string",
                        "description": "Capability key to delegate to, as authorized by agent_capabilities.",
                    },
                    "task_summary": {
                        "type": "string",
                        "description": "Compact task brief for the sub-agent.",
                    },
                    "task_title": {
                        "type": ["string", "null"],
                        "description": "Optional short title for the delegated run.",
                    },
                    "context_scope": {
                        "type": "object",
                        "description": "Optional scoped context for the sub-agent.",
                        "additionalProperties": True,
                        "default": {},
                    },
                },
                "required": ["capability_key", "task_summary"],
            },
            source="native",
            executor_kind="native",
            executor=_execute_delegate_to_sub_agent,
            citation={"source_kind": "sub_agent_run", "mode": "summary"},
            surface_tags=["virtual_cso", "domain_agent"],
            keywords=["delegate", "sub-agent", "agent", "capability", "research", "analysis"],
        ),
        ToolDefinition(
            name="read_todos",
            description="Read the editable Deep Mode plan for this Virtual CSO thread.",
            json_schema={"type": "object", "properties": {}, "required": []},
            source="native",
            executor_kind="native",
            executor=_execute_read_todos,
            citation={"source_kind": "agent_todos", "mode": "metadata"},
            surface_tags=["virtual_cso_deep"],
            keywords=["plan", "todo", "todos", "deep mode"],
        ),
        ToolDefinition(
            name="write_todos",
            description="Replace the editable Deep Mode plan for this Virtual CSO thread.",
            json_schema={
                "type": "object",
                "properties": {
                    "todos": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "content": {"type": "string"},
                                "status": {"type": "string", "enum": ["pending", "in_progress", "completed"]},
                            },
                            "required": ["content"],
                        },
                    }
                },
                "required": ["todos"],
            },
            source="native",
            executor_kind="native",
            executor=_execute_write_todos,
            citation={"source_kind": "agent_todos", "mode": "metadata"},
            surface_tags=["virtual_cso_deep"],
            keywords=["plan", "todo", "todos", "deep mode"],
        ),
        ToolDefinition(
            name="list_files",
            description="List thread workspace files available to this Deep Mode session.",
            json_schema={"type": "object", "properties": {}, "required": []},
            source="native",
            executor_kind="native",
            executor=_execute_list_files,
            citation={"source_kind": "workspace_file", "mode": "metadata"},
            surface_tags=["virtual_cso_deep"],
            keywords=["workspace", "file", "files", "list"],
        ),
        ToolDefinition(
            name="read_file",
            description="Read a text file from the thread workspace.",
            json_schema={
                "type": "object",
                "properties": {"file_path": {"type": "string", "description": "Workspace file path."}},
                "required": ["file_path"],
            },
            source="native",
            executor_kind="native",
            executor=_execute_read_file,
            citation={"source_kind": "workspace_file", "mode": "verbatim"},
            surface_tags=["virtual_cso_deep"],
            keywords=["workspace", "file", "read"],
        ),
        ToolDefinition(
            name="write_file",
            description="Write or replace a text file in the thread workspace.",
            json_schema={
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Workspace file path."},
                    "content": {"type": "string", "description": "Text content to write."},
                },
                "required": ["file_path", "content"],
            },
            source="native",
            executor_kind="native",
            executor=_execute_write_file,
            citation={"source_kind": "workspace_file", "mode": "verbatim"},
            surface_tags=["virtual_cso_deep"],
            keywords=["workspace", "file", "write"],
        ),
        ToolDefinition(
            name="edit_file",
            description="Replace text inside an existing thread workspace file.",
            json_schema={
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Workspace file path."},
                    "old_text": {"type": "string", "description": "Exact text to replace."},
                    "new_text": {"type": "string", "description": "Replacement text."},
                },
                "required": ["file_path", "old_text", "new_text"],
            },
            source="native",
            executor_kind="native",
            executor=_execute_edit_file,
            citation={"source_kind": "workspace_file", "mode": "verbatim"},
            surface_tags=["virtual_cso_deep"],
            keywords=["workspace", "file", "edit"],
        ),
        ToolDefinition(
            name="task",
            description="Delegate a bounded Deep Mode subtask to an existing ArchitectOS sub-agent.",
            json_schema={
                "type": "object",
                "properties": {
                    "description": {"type": "string", "description": "Subtask brief."},
                    "capability_key": {
                        "type": "string",
                        "description": "Optional capability key. Defaults to kb_explorer_agent.",
                        "default": "kb_explorer_agent",
                    },
                    "context_files": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional thread workspace paths to include by reference.",
                        "default": [],
                    },
                },
                "required": ["description"],
            },
            source="native",
            executor_kind="native",
            executor=_execute_deep_task,
            citation={"source_kind": "sub_agent_run", "mode": "summary"},
            surface_tags=["virtual_cso_deep"],
            keywords=["task", "sub-agent", "delegate", "deep mode"],
        ),
        ToolDefinition(
            name="ask_user",
            description="Pause Deep Mode and ask the founder one concise clarifying question.",
            json_schema={
                "type": "object",
                "properties": {"question": {"type": "string", "description": "Question for the founder."}},
                "required": ["question"],
            },
            source="native",
            executor_kind="native",
            executor=_execute_ask_user_marker,
            citation={"source_kind": "human_input", "mode": "summary"},
            surface_tags=["virtual_cso_deep"],
            keywords=["ask", "question", "clarify", "pause"],
        ),
    ]


def _int_or(value: Any, default: int) -> int:
    """int(...) that tolerates an explicitly-passed null/None the same as omitted.

    tool_input.get("limit", default) only falls back to default when the key is
    absent; a caller that passes {"limit": null} (observed live from the sandbox
    Code Mode bridge stub calling kb_glob) gets None back from .get(), and
    int(None) raises TypeError: int() argument must be a string, a bytes-like
    object or a real number, not 'NoneType' - surfaced live 2026-07-12 as two
    failed kb_glob Code Mode calls during the Ep4 Obj-2 sandbox capstone run.
    """
    if value is None:
        return default
    return int(value)


def _execute_kb_ls(context: ToolExecutionContext, tool_input: dict[str, Any]) -> ToolResultEnvelope:
    from services.folder_navigation import KbNavigationService, ls_result_to_dict

    result = KbNavigationService(context.store).execute_ls(
        user_id=context.user_id,
        folder_id=tool_input.get("folder_id"),
    )
    content = ls_result_to_dict(result)
    return ToolResultEnvelope(content=content, sources=_sources_from_items(content.get("items", [])))


def _execute_kb_tree(context: ToolExecutionContext, tool_input: dict[str, Any]) -> ToolResultEnvelope:
    from services.folder_navigation import KbNavigationService, tree_result_to_dict

    result = KbNavigationService(context.store).execute_tree(
        user_id=context.user_id,
        folder_id=tool_input.get("folder_id"),
        depth=_int_or(tool_input.get("depth"), 3),
        limit=_int_or(tool_input.get("limit"), 200),
    )
    content = tree_result_to_dict(result)
    return ToolResultEnvelope(content=content, sources=_sources_from_tree(content.get("tree", [])))


def _execute_kb_grep(context: ToolExecutionContext, tool_input: dict[str, Any]) -> ToolResultEnvelope:
    from services.folder_navigation import KbNavigationService, grep_result_to_dict

    result = KbNavigationService(context.store).execute_grep(
        user_id=context.user_id,
        pattern=str(tool_input["pattern"]),
        folder_id=tool_input.get("folder_id"),
        limit=_int_or(tool_input.get("limit"), 50),
    )
    content = grep_result_to_dict(result)
    return ToolResultEnvelope(content=content, sources=_sources_from_matches(content.get("matches", [])))


def _execute_kb_glob(context: ToolExecutionContext, tool_input: dict[str, Any]) -> ToolResultEnvelope:
    from services.folder_navigation import KbNavigationService, glob_result_to_dict

    result = KbNavigationService(context.store).execute_glob(
        user_id=context.user_id,
        pattern=str(tool_input["pattern"]),
        folder_id=tool_input.get("folder_id"),
        limit=_int_or(tool_input.get("limit"), 200),
    )
    content = glob_result_to_dict(result)
    return ToolResultEnvelope(content=content, sources=_sources_from_matches(content.get("matches", [])))


def _execute_kb_read(context: ToolExecutionContext, tool_input: dict[str, Any]) -> ToolResultEnvelope:
    from services.folder_navigation import KbNavigationService, read_result_to_dict

    start_line = tool_input.get("start_line")
    end_line = tool_input.get("end_line")
    result = KbNavigationService(context.store).execute_read(
        user_id=context.user_id,
        document_id=str(tool_input["document_id"]),
        start_line=int(start_line) if start_line is not None else None,
        end_line=int(end_line) if end_line is not None else None,
    )
    content = read_result_to_dict(result)
    return ToolResultEnvelope(
        content=content,
        sources=[
            ToolSourceRef(
                source_kind="raw_document",
                source_id=content.get("document_id"),
                verbatim=content.get("content"),
                label=content.get("name"),
                metadata={"start_line": content.get("start_line"), "end_line": content.get("end_line")},
            )
        ],
    )


def _execute_wiki_search(context: ToolExecutionContext, tool_input: dict[str, Any]) -> ToolResultEnvelope:
    from services.doc_wiki_read_service import DocWikiReadError, DocWikiReadService

    reader = DocWikiReadService(context.store)
    try:
        result = reader.search(user_id=context.user_id, query=str(tool_input.get("query", "")), limit=_int_or(tool_input.get("limit"), 5))
    except DocWikiReadError as exc:
        return ToolResultEnvelope(content={"error": str(exc)}, sources=[])
    pages = result.get("findings", [])
    content = {
        **result,
        "pages": pages if isinstance(pages, list) else [],
        "result_count": len(pages) if isinstance(pages, list) else 0,
    }
    return ToolResultEnvelope(content=content, sources=_sources_from_wiki_findings(pages))


def _execute_wiki_get_page(context: ToolExecutionContext, tool_input: dict[str, Any]) -> ToolResultEnvelope:
    from services.doc_wiki_read_service import DocWikiReadError, DocWikiReadService

    reader = DocWikiReadService(context.store)
    try:
        result = reader.get_page(user_id=context.user_id, canonical_key=str(tool_input.get("canonical_key", "")))
    except DocWikiReadError as exc:
        return ToolResultEnvelope(content={"error": str(exc)}, sources=[])
    pages = result.get("findings", [])
    content = {
        **result,
        "page": pages[0] if isinstance(pages, list) and pages else None,
        "result_count": len(pages) if isinstance(pages, list) else 0,
    }
    return ToolResultEnvelope(content=content, sources=_sources_from_wiki_findings(pages, verbatim=True))


def _execute_wiki_list(context: ToolExecutionContext, tool_input: dict[str, Any]) -> ToolResultEnvelope:
    from services.doc_wiki_read_service import DocWikiReadError, DocWikiReadService

    reader = DocWikiReadService(context.store)
    kind = tool_input.get("kind") or None
    try:
        result = reader.list_pages(
            user_id=context.user_id,
            page_kinds=[str(kind)] if kind else None,
            limit=_int_or(tool_input.get("limit"), 20),
        )
    except DocWikiReadError as exc:
        return ToolResultEnvelope(content={"error": str(exc)}, sources=[])
    pages = result.get("findings", [])
    content = {
        **result,
        "pages": pages if isinstance(pages, list) else [],
        "result_count": len(pages) if isinstance(pages, list) else 0,
    }
    return ToolResultEnvelope(content=content, sources=_sources_from_wiki_findings(pages))


def _execute_code(context: ToolExecutionContext, tool_input: dict[str, Any]) -> ToolResultEnvelope:
    if context.sandbox_service is None or not context.thread_id:
        raise ToolRegistryError("Sandbox service and thread_id are required for execute_code.")
    if not tool_input.get("code"):
        raise ToolRegistryError("execute_code requires a non-empty 'code' argument.")
    code = str(tool_input["code"])
    fulfiller = context.metadata.get("bridge_fulfiller")
    if fulfiller is not None:
        result = context.sandbox_service.execute_code_with_bridge(
            thread_id=context.thread_id,
            code=code,
            fulfiller=fulfiller,
            timeout_seconds=float(context.timeout_seconds or 90),
        )
    else:
        result = context.sandbox_service.execute_code(
            thread_id=context.thread_id,
            code=code,
            timeout_seconds=float(context.timeout_seconds or 90),
        )
    content = {
        "thread_id": result.thread_id,
        "pod_name": result.pod_name,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "exit_code": result.exit_code,
        "status": result.status,
    }
    provenance: dict[str, Any] = {}
    bridge_calls = getattr(result, "tool_calls", None)
    if bridge_calls:
        provenance["bridge_tool_calls"] = [
            {"tool_name": call.tool_name, "ok": call.ok, "error": call.error} for call in bridge_calls
        ]
    return ToolResultEnvelope(
        content=content,
        sources=[
            ToolSourceRef(
                source_kind="computation",
                source_id=context.thread_id,
                verbatim=f"code:\n{code}\n\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}",
                label=str(tool_input.get("description") or "Sandbox code execution"),
                metadata={"exit_code": result.exit_code, "status": result.status, "pod_name": result.pod_name},
            )
        ],
        provenance=provenance,
    )


def _execute_read_skill_file(context: ToolExecutionContext, tool_input: dict[str, Any]) -> ToolResultEnvelope:
    from services.sandbox_execution_service import SandboxExecutionService

    service = context.metadata.get("sandbox_execution_service")
    if not isinstance(service, SandboxExecutionService):
        raise ToolRegistryError("SandboxExecutionService instance is required for read_skill_file.")
    skill_file_id = str(tool_input.get("skill_file_id") or "").strip()
    if skill_file_id not in set(context.allowed_skill_file_ids):
        raise ToolRegistryError("Skill file is not in scope for this run.")
    content = service._read_skill_file(user_id=context.user_id, skill_file_id=skill_file_id)
    return ToolResultEnvelope(
        content=content,
        sources=[
            ToolSourceRef(
                source_kind="skill_file",
                source_id=content.get("skill_file_id"),
                verbatim=content.get("content"),
                label=content.get("filename"),
                metadata={"category": content.get("category"), "mime_type": content.get("mime_type")},
            )
        ],
    )


def _execute_tool_search(context: ToolExecutionContext, tool_input: dict[str, Any]) -> ToolResultEnvelope:
    registry = context.metadata.get("tool_registry")
    if not isinstance(registry, ToolRegistry):
        registry = ToolRegistry(store=context.store, supabase_client=context.supabase_client)
    matches = registry.tool_search(
        str(tool_input.get("query") or ""),
        surface=str(context.metadata.get("tool_scope_surface") or context.metadata.get("surface") or "virtual_cso"),
        capability=context.metadata.get("capability"),
        limit=_int_or(tool_input.get("limit"), 8),
    )
    content = {
        "matches": to_anthropic(matches),
        "match_count": len(matches),
    }
    return ToolResultEnvelope(content=content, sources=[ToolSourceRef(source_kind="tool_registry", source_id="in_process")])


def _execute_delegate_to_sub_agent(context: ToolExecutionContext, tool_input: dict[str, Any]) -> ToolResultEnvelope:
    from services.sub_agent_orchestrator import SubAgentOrchestrator, SubAgentRunRequest

    if context.store is None:
        raise ToolRegistryError("A VectorStore is required for sub-agent delegation.")
    capability_key = str(tool_input.get("capability_key") or "").strip()
    task_summary = str(tool_input.get("task_summary") or "").strip()
    if not capability_key or not task_summary:
        raise ToolRegistryError("capability_key and task_summary are required for delegation.")
    context_scope = tool_input.get("context_scope") if isinstance(tool_input.get("context_scope"), dict) else {}
    if capability_key == "sandbox_execution_agent" and context.thread_id and not context_scope.get("thread_id"):
        context_scope = {**context_scope, "thread_id": context.thread_id}
    result = SubAgentOrchestrator(context.store).start_run(
        SubAgentRunRequest(
            user_id=context.user_id,
            parent_surface=str(context.metadata.get("surface") or "virtual_cso"),
            capability_key=capability_key,
            task_summary=task_summary[:4000],
            context_scope=context_scope,
            task_title=str(tool_input.get("task_title") or "")[:120] or None,
            parent_thread_id=context.thread_id,
            parent_message_id=context.metadata.get("parent_message_id"),
        )
    )
    content = {
        "run_id": result.run_id,
        "status": result.status,
        "result_summary": result.result_summary,
        "structured_result": result.structured_result,
        "trace": result.trace,
        "citations": result.citations,
        "error_message": result.error_message,
    }
    return ToolResultEnvelope(
        content=content,
        sources=[
            ToolSourceRef(
                source_kind="sub_agent_run",
                source_id=result.run_id,
                verbatim=result.result_summary,
                label=capability_key,
                metadata={"status": result.status, "capability_key": capability_key},
            )
        ],
    )


def _require_thread_id(context: ToolExecutionContext) -> str:
    if not context.thread_id:
        raise ToolRegistryError("thread_id is required for Deep Mode tools.")
    return context.thread_id


def _safe_workspace_path(value: Any) -> str:
    path = str(value or "").strip().replace("\\", "/")
    if not path or path.startswith("/") or ".." in path.split("/"):
        raise ToolRegistryError("Invalid workspace file path.")
    return path[:240]


def _workspace_file_sources(rows: list[dict[str, Any]]) -> list[ToolSourceRef]:
    return [
        ToolSourceRef(
            source_kind="workspace_file",
            source_id=row.get("id"),
            verbatim=row.get("content"),
            label=row.get("file_path"),
            metadata={"owner_type": row.get("owner_type"), "source": row.get("source")},
        )
        for row in rows
    ]


def _read_todos(context: ToolExecutionContext) -> list[dict[str, Any]]:
    thread_id = _require_thread_id(context)
    return (
        context.client.table("agent_todos")
        .select("id,thread_id,user_id,content,status,position,created_at,updated_at")
        .eq("thread_id", thread_id)
        .eq("user_id", context.user_id)
        .order("position")
        .execute()
        .data
        or []
    )


def _execute_read_todos(context: ToolExecutionContext, _tool_input: dict[str, Any]) -> ToolResultEnvelope:
    rows = _read_todos(context)
    return ToolResultEnvelope(
        content={"todos": rows, "count": len(rows)},
        sources=[
            ToolSourceRef(
                source_kind="agent_todos",
                source_id=row.get("id"),
                label=row.get("content"),
                metadata={"status": row.get("status"), "position": row.get("position")},
            )
            for row in rows
        ],
    )


def _execute_write_todos(context: ToolExecutionContext, tool_input: dict[str, Any]) -> ToolResultEnvelope:
    thread_id = _require_thread_id(context)
    raw_todos = tool_input.get("todos") if isinstance(tool_input.get("todos"), list) else []
    rows: list[dict[str, Any]] = []
    for index, item in enumerate(raw_todos):
        if not isinstance(item, dict):
            continue
        content = str(item.get("content") or "").strip()
        if not content:
            continue
        status = str(item.get("status") or "pending")
        if status not in {"pending", "in_progress", "completed"}:
            status = "pending"
        rows.append(
            {
                "thread_id": thread_id,
                "user_id": context.user_id,
                "content": content[:1000],
                "status": status,
                "position": index,
            }
        )
    context.client.table("agent_todos").delete().eq("thread_id", thread_id).eq("user_id", context.user_id).execute()
    if rows:
        context.client.table("agent_todos").insert(rows).execute()
    saved = _read_todos(context)
    return ToolResultEnvelope(content={"todos": saved, "count": len(saved), "status": "updated"})


def _execute_list_files(context: ToolExecutionContext, _tool_input: dict[str, Any]) -> ToolResultEnvelope:
    thread_id = _require_thread_id(context)
    rows = (
        context.client.table("workspace_files")
        .select("id,owner_type,owner_id,user_id,file_path,source,size,storage_path,created_at,updated_at")
        .eq("owner_type", "thread")
        .eq("owner_id", thread_id)
        .eq("user_id", context.user_id)
        .order("file_path")
        .execute()
        .data
        or []
    )
    return ToolResultEnvelope(content={"files": rows, "count": len(rows)}, sources=_workspace_file_sources(rows))


def _load_thread_workspace_file(context: ToolExecutionContext, file_path: str) -> dict[str, Any]:
    thread_id = _require_thread_id(context)
    rows = (
        context.client.table("workspace_files")
        .select("*")
        .eq("owner_type", "thread")
        .eq("owner_id", thread_id)
        .eq("user_id", context.user_id)
        .eq("file_path", file_path)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise ToolRegistryError("Workspace file was not found.")
    return rows[0]


def _execute_read_file(context: ToolExecutionContext, tool_input: dict[str, Any]) -> ToolResultEnvelope:
    file_path = _safe_workspace_path(tool_input.get("file_path"))
    row = _load_thread_workspace_file(context, file_path)
    return ToolResultEnvelope(
        content={
            "id": row.get("id"),
            "file_path": row.get("file_path"),
            "content": row.get("content") or "",
            "source": row.get("source"),
            "size": row.get("size"),
        },
        sources=_workspace_file_sources([row]),
    )


def _execute_write_file(context: ToolExecutionContext, tool_input: dict[str, Any]) -> ToolResultEnvelope:
    thread_id = _require_thread_id(context)
    file_path = _safe_workspace_path(tool_input.get("file_path"))
    content = str(tool_input.get("content") or "")
    row = {
        "owner_type": "thread",
        "owner_id": thread_id,
        "user_id": context.user_id,
        "file_path": file_path,
        "content": content,
        "source": "agent",
        "size": len(content.encode("utf-8")),
    }
    response = context.client.table("workspace_files").upsert(row, on_conflict="owner_type,owner_id,file_path").execute()
    saved = response.data[0] if getattr(response, "data", None) else {**row, "id": None}
    return ToolResultEnvelope(content={"file": saved, "status": "written"}, sources=_workspace_file_sources([saved]))


def _execute_edit_file(context: ToolExecutionContext, tool_input: dict[str, Any]) -> ToolResultEnvelope:
    file_path = _safe_workspace_path(tool_input.get("file_path"))
    old_text = str(tool_input.get("old_text") or "")
    new_text = str(tool_input.get("new_text") or "")
    row = _load_thread_workspace_file(context, file_path)
    content = str(row.get("content") or "")
    if old_text not in content:
        raise ToolRegistryError("old_text was not found in the workspace file.")
    updated = content.replace(old_text, new_text, 1)
    return _execute_write_file(context, {"file_path": file_path, "content": updated})


def _execute_deep_task(context: ToolExecutionContext, tool_input: dict[str, Any]) -> ToolResultEnvelope:
    delegated = {
        "capability_key": str(tool_input.get("capability_key") or "kb_explorer_agent"),
        "task_summary": str(tool_input.get("description") or "")[:4000],
        "task_title": "Deep Mode subtask",
        "context_scope": {
            "surface": "virtual_cso",
            "deep_mode": True,
            "context_files": tool_input.get("context_files") if isinstance(tool_input.get("context_files"), list) else [],
            "can_spawn_agents": False,
            "todos_available": False,
        },
    }
    return _execute_delegate_to_sub_agent(context, delegated)


def _execute_ask_user_marker(_context: ToolExecutionContext, tool_input: dict[str, Any]) -> ToolResultEnvelope:
    question = str(tool_input.get("question") or "").strip()
    if not question:
        raise ToolRegistryError("question is required.")
    return ToolResultEnvelope(
        content={"status": "waiting_for_user", "question": question[:1000]},
        sources=[ToolSourceRef(source_kind="human_input", source_id=None, label="Founder clarification needed")],
    )


def _load_skill_body(definition: ToolDefinition) -> ToolResultEnvelope:
    metadata = definition.skill_metadata
    content = {
        "skill_id": metadata.get("id"),
        "slug": metadata.get("slug") or definition.name,
        "name": metadata.get("name") or definition.name,
        "body": metadata.get("body") or "",
        "output_contract": metadata.get("output_contract") or {},
        "writeback_rules": metadata.get("writeback_rules") or {},
        "required_platform_context": metadata.get("required_platform_context") or [],
        "requires_sandbox": bool(metadata.get("requires_sandbox")),
    }
    return ToolResultEnvelope(
        content=content,
        sources=[
            ToolSourceRef(
                source_kind="skill_pack",
                source_id=metadata.get("id"),
                verbatim=metadata.get("body") or "",
                label=metadata.get("name") or definition.name,
                metadata={"slug": definition.name, "scope": metadata.get("scope"), "version": metadata.get("version")},
            )
        ],
    )


def _score_definition(query: str, definition: ToolDefinition) -> int:
    lower = query.lower()
    words = _tokenize(query)
    score = 0
    if definition.name.lower() in lower:
        score += 8
    for keyword in definition.keywords:
        needle = str(keyword).lower()
        if needle and (" " in needle and needle in lower):
            score += 4
        elif needle and needle in words:
            score += 3
    for word in _tokenize(f"{definition.name} {definition.description} {' '.join(definition.capability_hints)}"):
        if word in words:
            score += 1
    return score


def _tokenize(text: str) -> set[str]:
    matches = re.findall(r"[a-z0-9:$]+", text.lower())
    return {word for word in matches if len(word) > 2}


def _ordered_intersection(left: list[str], right: list[str]) -> list[str]:
    right_set = set(right)
    return [item for item in left if item in right_set]


def _sources_from_items(items: list[dict[str, Any]]) -> list[ToolSourceRef]:
    return [
        ToolSourceRef(source_kind="raw_document", source_id=item.get("id"), label=item.get("name"))
        for item in items
        if item.get("type") == "file"
    ]


def _sources_from_matches(matches: list[dict[str, Any]]) -> list[ToolSourceRef]:
    return [
        ToolSourceRef(source_kind="raw_document", source_id=item.get("id"), label=item.get("name"))
        for item in matches
    ]


def _sources_from_tree(nodes: list[dict[str, Any]]) -> list[ToolSourceRef]:
    sources: list[ToolSourceRef] = []
    for node in nodes:
        if node.get("type") == "file":
            sources.append(ToolSourceRef(source_kind="raw_document", source_id=node.get("id"), label=node.get("name")))
        children = node.get("children")
        if isinstance(children, list):
            sources.extend(_sources_from_tree(children))
    return sources


def _sources_from_wiki_findings(findings: Any, *, verbatim: bool = False) -> list[ToolSourceRef]:
    if not isinstance(findings, list):
        return []
    sources: list[ToolSourceRef] = []
    for finding in findings:
        if not isinstance(finding, dict):
            continue
        sources.append(
            ToolSourceRef(
                source_kind="wiki_page",
                source_id=finding.get("page_id") or finding.get("canonical_key"),
                verbatim=finding.get("content") if verbatim else finding.get("excerpt"),
                label=finding.get("title"),
                metadata={
                    "canonical_key": finding.get("canonical_key"),
                    "page_kind": finding.get("page_kind"),
                    "source_type": finding.get("source_type"),
                },
            )
        )
    return sources
