"""Server-side context scoping for sub-agent runs."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from services.agent_capabilities import AgentCapability

if TYPE_CHECKING:
    from services.vector_store import VectorStore


class AgentContextError(RuntimeError):
    pass


@dataclass(frozen=True)
class AgentSourceRef:
    source_kind: str
    source_id: str | None
    source_label: str | None = None
    source_metadata: dict[str, Any] = field(default_factory=dict)
    citation_payload: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class AgentContextBundle:
    user_id: str
    parent_surface: str
    task_summary: str
    context_scope: dict[str, Any]
    documents: list[dict[str, Any]] = field(default_factory=list)
    chunks: list[dict[str, Any]] = field(default_factory=list)
    datasets: list[dict[str, Any]] = field(default_factory=list)
    wiki_pages: list[dict[str, Any]] = field(default_factory=list)
    wiki_claims: list[dict[str, Any]] = field(default_factory=list)
    global_ip_pages: list[dict[str, Any]] = field(default_factory=list)
    global_checkpoints: list[dict[str, Any]] = field(default_factory=list)
    sources: list[AgentSourceRef] = field(default_factory=list)


class AgentContextBuilder:
    def __init__(self, store: "VectorStore") -> None:
        self.store = store

    def build(
        self,
        *,
        user_id: str,
        parent_surface: str,
        task_summary: str,
        context_scope: dict[str, Any],
        capability: AgentCapability,
    ) -> AgentContextBundle:
        if not isinstance(context_scope, dict):
            raise AgentContextError("Context scope must be an object.")

        allowed_source_kinds = set(capability.allowed_source_kinds)
        max_sources = _max_sources(capability)
        documents = self._load_documents(user_id, _id_list(context_scope.get("document_ids")), allowed_source_kinds)
        chunks = self._load_chunks(user_id, _id_list(context_scope.get("chunk_ids")), allowed_source_kinds)
        datasets = self._load_datasets(user_id, _id_list(context_scope.get("dataset_ids")), allowed_source_kinds)
        wiki_pages = self._load_wiki_pages(user_id, _id_list(context_scope.get("page_keys")), allowed_source_kinds)
        wiki_claims = self._load_wiki_claims(user_id, _id_list(context_scope.get("claim_ids")), allowed_source_kinds)
        global_ip_pages = self._load_global_ip(context_scope.get("global_ip_selector") or {}, allowed_source_kinds)
        global_checkpoints = self._load_global_checkpoints(context_scope.get("checkpoint_selector") or {}, allowed_source_kinds)

        sources: list[AgentSourceRef] = []
        for document in documents:
            sources.append(
                AgentSourceRef(
                    source_kind="raw_document",
                    source_id=document.get("id"),
                    source_label=document.get("file_name"),
                    source_metadata={
                        "status": document.get("status"),
                        "parser_status": document.get("parser_status"),
                        "metadata_document_type": document.get("metadata_document_type"),
                        "metadata_business_domain": document.get("metadata_business_domain"),
                    },
                    citation_payload={"document_id": document.get("id"), "label": document.get("file_name")},
                )
            )
        for chunk in chunks:
            sources.append(
                AgentSourceRef(
                    source_kind="document_chunk",
                    source_id=chunk.get("id"),
                    source_label=chunk.get("metadata", {}).get("document_title") or f"Chunk {chunk.get('chunk_index')}",
                    source_metadata={
                        "document_id": chunk.get("document_id"),
                        "chunk_index": chunk.get("chunk_index"),
                        "metadata": chunk.get("metadata") or {},
                    },
                    citation_payload={"chunk_id": chunk.get("id"), "document_id": chunk.get("document_id")},
                )
            )
        for dataset in datasets:
            sources.append(
                AgentSourceRef(
                    source_kind="founder_dataset",
                    source_id=dataset.get("id"),
                    source_label=dataset.get("dataset_name"),
                    source_metadata={
                        "dataset_type": dataset.get("dataset_type"),
                        "status": dataset.get("status"),
                        "source_document_id": dataset.get("source_document_id"),
                    },
                    citation_payload={"dataset_id": dataset.get("id"), "label": dataset.get("dataset_name")},
                )
            )
        for page in wiki_pages:
            sources.append(
                AgentSourceRef(
                    source_kind="wiki_page",
                    source_id=page.get("id"),
                    source_label=page.get("title"),
                    source_metadata={"page_key": page.get("page_key"), "stale": page.get("stale")},
                    citation_payload={"page_key": page.get("page_key"), "one_line": page.get("one_line")},
                )
            )
        for claim in wiki_claims:
            sources.append(
                AgentSourceRef(
                    source_kind="wiki_claim",
                    source_id=claim.get("id"),
                    source_label=claim.get("text"),
                    source_metadata={"page_key": claim.get("page_key"), "class": claim.get("class"), "trust": claim.get("status")},
                    citation_payload={"claim_id": claim.get("id"), "text": claim.get("text")},
                )
            )
        for page in global_ip_pages:
            sources.append(
                AgentSourceRef(
                    source_kind="global_ip_page",
                    source_id=page.get("id"),
                    source_label=page.get("title"),
                    source_metadata={"slug": page.get("slug"), "domain": page.get("domain")},
                    citation_payload={"slug": page.get("slug"), "title": page.get("title")},
                )
            )
        for checkpoint in global_checkpoints:
            sources.append(
                AgentSourceRef(
                    source_kind="global_checkpoint",
                    source_id=checkpoint.get("source_id"),
                    source_label=checkpoint.get("checkpoint_title_display"),
                    source_metadata={"gm_checkpoint_id": checkpoint.get("gm_checkpoint_id"), "stage_name": checkpoint.get("stage_name")},
                    citation_payload=checkpoint,
                )
            )

        if len(sources) > max_sources:
            sources = sources[:max_sources]
            allowed_ids = {source.source_id for source in sources}
            documents = [item for item in documents if item.get("id") in allowed_ids]
            chunks = [item for item in chunks if item.get("id") in allowed_ids]
            datasets = [item for item in datasets if item.get("id") in allowed_ids]
            wiki_pages = [item for item in wiki_pages if item.get("id") in allowed_ids]
            wiki_claims = [item for item in wiki_claims if item.get("id") in allowed_ids]
            global_ip_pages = [item for item in global_ip_pages if item.get("id") in allowed_ids]
            global_checkpoints = [item for item in global_checkpoints if item.get("source_id") in allowed_ids]

        return AgentContextBundle(
            user_id=user_id,
            parent_surface=parent_surface,
            task_summary=task_summary,
            context_scope=_safe_scope_snapshot(context_scope),
            documents=documents,
            chunks=chunks,
            datasets=datasets,
            wiki_pages=wiki_pages,
            wiki_claims=wiki_claims,
            global_ip_pages=global_ip_pages,
            global_checkpoints=global_checkpoints,
            sources=sources,
        )

    def _load_documents(self, user_id: str, document_ids: list[str], allowed_source_kinds: set[str]) -> list[dict[str, Any]]:
        if not document_ids:
            return []
        if "raw_document" not in allowed_source_kinds:
            raise AgentContextError("Raw documents are not allowed for this capability.")
        response = (
            self.store.client.table("ose_raw_document_registry")
            .select(
                "id,user_id,file_name,file_type,status,parser_status,metadata_document_type,"
                "metadata_business_domain,metadata_time_period,extracted_metadata,chunk_count"
            )
            .eq("user_id", user_id)
            .in_("id", document_ids)
            .execute()
        )
        rows = response.data or []
        _require_all_found("document", document_ids, rows)
        return rows

    def _load_chunks(self, user_id: str, chunk_ids: list[str], allowed_source_kinds: set[str]) -> list[dict[str, Any]]:
        if not chunk_ids:
            return []
        if "document_chunk" not in allowed_source_kinds:
            raise AgentContextError("Document chunks are not allowed for this capability.")
        response = (
            self.store.client.table("document_chunks")
            .select("id,user_id,document_id,chunk_index,content,metadata")
            .eq("user_id", user_id)
            .in_("id", chunk_ids)
            .execute()
        )
        rows = response.data or []
        _require_all_found("document chunk", chunk_ids, rows)
        return rows

    def _load_datasets(self, user_id: str, dataset_ids: list[str], allowed_source_kinds: set[str]) -> list[dict[str, Any]]:
        if not dataset_ids:
            return []
        if "founder_dataset" not in allowed_source_kinds:
            raise AgentContextError("Founder datasets are not allowed for this capability.")
        response = (
            self.store.client.table("founder_datasets")
            .select("id,user_id,source_document_id,dataset_name,dataset_type,status,summary,confidence,metadata")
            .eq("user_id", user_id)
            .in_("id", dataset_ids)
            .execute()
        )
        rows = response.data or []
        _require_all_found("founder dataset", dataset_ids, rows)
        return rows

    def _load_wiki_pages(self, user_id: str, page_keys: list[str], allowed_source_kinds: set[str]) -> list[dict[str, Any]]:
        if not page_keys:
            return []
        if "wiki_page" not in allowed_source_kinds:
            raise AgentContextError("Wiki pages are not allowed for this capability.")
        response = (
            self.store.client.table("wiki_pages")
            .select("id,user_id,page_key,title,one_line,page_kind,wiki_version,last_compiled_at,stale")
            .eq("user_id", user_id)
            .in_("page_key", page_keys)
            .execute()
        )
        rows = response.data or []
        found = {str(row.get("page_key")) for row in rows}
        missing = [page_key for page_key in page_keys if page_key not in found]
        if missing:
            raise AgentContextError(f"Unauthorized or missing wiki page key: {missing[0]}")
        return rows

    def _load_wiki_claims(self, user_id: str, claim_ids: list[str], allowed_source_kinds: set[str]) -> list[dict[str, Any]]:
        if not claim_ids:
            return []
        if "wiki_claim" not in allowed_source_kinds:
            raise AgentContextError("Wiki claims are not allowed for this capability.")
        response = (
            self.store.client.table("wiki_claims")
            .select("id,user_id,page_key,text,class,status,confidence,recall_score,updated_at")
            .eq("user_id", user_id)
            .in_("id", claim_ids)
            .execute()
        )
        rows = response.data or []
        _require_all_found("wiki claim", claim_ids, rows)
        return rows

    def _load_global_ip(self, selector: dict[str, Any], allowed_source_kinds: set[str]) -> list[dict[str, Any]]:
        if not selector:
            return []
        if "global_ip_page" not in allowed_source_kinds:
            raise AgentContextError("Global IP pages are not allowed for this capability.")
        from services.global_ip_read import GlobalIpReadError, GlobalIpReadService

        try:
            result = GlobalIpReadService(self.store).get(selector)
        except GlobalIpReadError:
            return []
        return [finding for finding in result.get("findings", []) if finding.get("type") == "global_ip_page"]

    def _load_global_checkpoints(self, selector: dict[str, Any], allowed_source_kinds: set[str]) -> list[dict[str, Any]]:
        if not selector:
            return []
        if "global_checkpoint" not in allowed_source_kinds:
            raise AgentContextError("Global checkpoints are not allowed for this capability.")
        from services.global_ip_read import GlobalIpReadService

        result = GlobalIpReadService(self.store).get_checkpoints(selector, allow_empty=True)
        return result.get("findings", [])


def _id_list(value: Any) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise AgentContextError("Context source ids must be provided as lists.")
    return [str(item) for item in value if str(item).strip()]


def _require_all_found(label: str, requested_ids: list[str], rows: list[dict[str, Any]]) -> None:
    found = {str(row.get("id")) for row in rows}
    missing = [source_id for source_id in requested_ids if source_id not in found]
    if missing:
        raise AgentContextError(f"Unauthorized or missing {label} id: {missing[0]}")


def _max_sources(capability: AgentCapability) -> int:
    value = capability.default_config.get("max_sources", 8)
    try:
        return max(1, min(int(value), 20))
    except (TypeError, ValueError):
        return 8


def _safe_scope_snapshot(context_scope: dict[str, Any]) -> dict[str, Any]:
    allowed_keys = {
        "document_ids",
        "chunk_ids",
        "dataset_ids",
        "metadata_filter",
        "structured_query",
        "source_limit",
        "page_keys",
        "claim_ids",
        "global_ip_selector",
        "checkpoint_selector",
        "wiki_tool",
        "wiki_query",
        "page_key",
        "claim_id",
    }
    return {key: value for key, value in context_scope.items() if key in allowed_keys}
