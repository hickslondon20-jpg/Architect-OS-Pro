"""Shared capability registry for bounded sub-agent delegation."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from services.vector_store import VectorStore


class AgentCapabilityError(RuntimeError):
    pass


ACTIVE_STATUSES = {"enabled", "experimental"}
ALLOWED_SURFACES = {"virtual_cso", "os_engine", "domain_agent", "sprint_planning", "system"}


@dataclass(frozen=True)
class AgentCapability:
    capability_key: str
    label: str
    description: str
    status: str
    allowed_surfaces: list[str] = field(default_factory=list)
    allowed_tools: list[str] = field(default_factory=list)
    allowed_source_kinds: list[str] = field(default_factory=list)
    model_setting_key: str | None = None
    output_schema: dict[str, Any] = field(default_factory=dict)
    default_config: dict[str, Any] = field(default_factory=dict)
    can_spawn_agents: bool = False
    id: str | None = None

    def public_dict(self) -> dict[str, Any]:
        return {
            "capability_key": self.capability_key,
            "label": self.label,
            "description": self.description,
            "status": self.status,
            "allowed_surfaces": self.allowed_surfaces,
            "allowed_tools": self.allowed_tools,
            "allowed_source_kinds": self.allowed_source_kinds,
            "output_schema": self.output_schema,
            "default_config": self.default_config,
            "can_spawn_agents": self.can_spawn_agents,
        }


class AgentCapabilityRegistry:
    def __init__(self, store: "VectorStore") -> None:
        self.store = store

    @classmethod
    def from_env(cls) -> "AgentCapabilityRegistry":
        from services.vector_store import VectorStore

        return cls(VectorStore.from_env())

    def list_active(self) -> list[AgentCapability]:
        try:
            response = (
                self.store.client.table("agent_capabilities")
                .select(
                    "id,capability_key,label,description,status,allowed_surfaces,"
                    "allowed_tools,allowed_source_kinds,model_setting_key,output_schema,"
                    "default_config,can_spawn_agents"
                )
                .in_("status", sorted(ACTIVE_STATUSES))
                .order("capability_key")
                .execute()
            )
        except Exception:
            return _fallback_capabilities()

        rows = response.data or []
        if not rows:
            return _fallback_capabilities()
        return [_capability_from_row(row) for row in rows]

    def get_for_surface(self, capability_key: str, parent_surface: str) -> AgentCapability:
        if parent_surface not in ALLOWED_SURFACES:
            raise AgentCapabilityError("Parent surface is not allowed for sub-agent delegation.")
        capability = next(
            (item for item in self.list_active() if item.capability_key == capability_key),
            None,
        )
        if not capability:
            raise AgentCapabilityError("Requested capability is not enabled.")
        if capability.can_spawn_agents:
            raise AgentCapabilityError("Recursive sub-agent spawning is not allowed.")
        if parent_surface not in capability.allowed_surfaces:
            raise AgentCapabilityError("Requested capability is not allowed for this surface.")
        return capability


def _capability_from_row(row: dict[str, Any]) -> AgentCapability:
    return AgentCapability(
        id=row.get("id"),
        capability_key=row["capability_key"],
        label=row["label"],
        description=row.get("description") or "",
        status=row.get("status") or "disabled",
        allowed_surfaces=list(row.get("allowed_surfaces") or []),
        allowed_tools=list(row.get("allowed_tools") or []),
        allowed_source_kinds=list(row.get("allowed_source_kinds") or []),
        model_setting_key=row.get("model_setting_key"),
        output_schema=row.get("output_schema") or {},
        default_config=row.get("default_config") or {},
        can_spawn_agents=bool(row.get("can_spawn_agents")),
    )


def _fallback_capabilities() -> list[AgentCapability]:
    return [
        AgentCapability(
            capability_key="document_analysis_agent",
            label="Document analysis",
            description="Reviews scoped founder documents and chunks, then returns compact findings with citations.",
            status="experimental",
            allowed_surfaces=["virtual_cso", "os_engine", "domain_agent"],
            allowed_tools=["retrieve_document_chunks", "read_raw_document_metadata"],
            allowed_source_kinds=["raw_document", "document_chunk"],
            model_setting_key="document_analysis_agent",
            output_schema={"version": "agent_result_v1"},
            default_config={"max_sources": 8, "max_rounds": 1, "timeout_seconds": 20},
        ),
        AgentCapability(
            capability_key="structured_data_agent",
            label="Dataset analysis",
            description="Reviews scoped founder datasets or approved structured query results.",
            status="experimental",
            allowed_surfaces=["virtual_cso", "os_engine", "domain_agent"],
            allowed_tools=["run_structured_dataset_query", "read_founder_dataset_summary"],
            allowed_source_kinds=["founder_dataset", "dataset_row"],
            model_setting_key="structured_data_agent",
            output_schema={"version": "agent_result_v1"},
            default_config={"max_sources": 8, "max_rounds": 1, "timeout_seconds": 20},
        ),
        AgentCapability(
            capability_key="kb_explorer_agent",
            label="Knowledge Base Explorer",
            description=(
                "Navigates and reads the founder's uploaded document library using "
                "ls, tree, grep, glob, and read tools. Returns synthesized findings "
                "grounded in document content."
            ),
            status="experimental",
            allowed_surfaces=["virtual_cso", "os_engine", "domain_agent"],
            allowed_tools=["kb_ls", "kb_tree", "kb_grep", "kb_glob", "kb_read"],
            allowed_source_kinds=[],
            model_setting_key="kb_explorer_agent",
            output_schema={"version": "agent_result_v1"},
            default_config={"max_rounds": 5, "timeout_seconds": 60},
            can_spawn_agents=False,
        ),
        AgentCapability(
            capability_key="sandbox_execution_agent",
            label="Sandbox code execution",
            description=(
                "Runs founder/platform-data code and document generation inside a bounded "
                "sandbox session, with access to attached skill files."
            ),
            status="experimental",
            allowed_surfaces=["virtual_cso"],
            allowed_tools=["execute_code", "read_skill_file"],
            allowed_source_kinds=[],
            model_setting_key="sandbox_execution_agent",
            output_schema={"version": "agent_result_v1"},
            default_config={"max_rounds": 6, "timeout_seconds": 90},
            can_spawn_agents=False,
        ),
        AgentCapability(
            capability_key="per_user_wiki",
            label="Per-user wiki",
            description="Reads the founder's compiled wiki pages, claims, evidence, and digest through the frozen wiki contract.",
            status="experimental",
            allowed_surfaces=["virtual_cso", "os_engine", "domain_agent", "sprint_planning"],
            allowed_tools=[
                "wiki_get_page",
                "wiki_get_claim",
                "wiki_search",
                "wiki_search_insight",
                "wiki_read_digest",
            ],
            allowed_source_kinds=["wiki_page", "wiki_claim", "wiki_evidence", "wiki_digest"],
            model_setting_key="per_user_wiki",
            output_schema={"version": "agent_result_v1"},
            default_config={"max_sources": 8, "max_rounds": 1, "timeout_seconds": 20},
            can_spawn_agents=False,
        ),
        AgentCapability(
            capability_key="per_user_document_wiki",
            label="Per-user document wiki",
            description=(
                "Layer 2 document wiki: emergent per-user pages synthesized from uploaded "
                "documents, CSO threads, sprint history, and domain-agent artifacts."
            ),
            status="experimental",
            allowed_surfaces=["virtual_cso", "os_engine", "domain_agent", "sprint_planning"],
            allowed_tools=["docwiki_get_page", "docwiki_search", "docwiki_list"],
            allowed_source_kinds=["wiki_page", "wiki_page_link"],
            model_setting_key="per_user_document_wiki",
            output_schema={"version": "agent_result_v1"},
            default_config={"max_sources": 8, "max_rounds": 1, "timeout_seconds": 20},
            can_spawn_agents=False,
        ),
        AgentCapability(
            capability_key="global_ip",
            label="ArchitectOS global IP",
            description="Reads ArchitectOS global IP pages and GM checkpoint context through service-role-only retrieval.",
            status="experimental",
            allowed_surfaces=["virtual_cso", "domain_agent", "system"],
            allowed_tools=["global_ip_get"],
            allowed_source_kinds=["global_ip_page", "global_checkpoint"],
            model_setting_key="global_ip",
            output_schema={"version": "agent_result_v1"},
            default_config={"max_sources": 8, "max_rounds": 1, "timeout_seconds": 20},
            can_spawn_agents=False,
        ),
    ]
