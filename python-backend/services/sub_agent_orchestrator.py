"""Bounded sub-agent orchestration scaffold for ArchitectOS."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from services.agent_capabilities import AgentCapability, AgentCapabilityError, AgentCapabilityRegistry
from services.agent_context import AgentContextBuilder, AgentContextBundle, AgentContextError, AgentSourceRef
from services.doc_wiki_read_service import DocWikiReadError, DocWikiReadService
from services.global_ip_read import GlobalIpReadError, GlobalIpReadService
from services.kb_explorer_service import KbExplorerService
from services.artifact_service import ArtifactService, ArtifactServiceError
from services.sandbox_execution_service import SandboxExecutionService
from services.structured_query import StructuredQueryRequest, StructuredQueryService
from services.vector_store import VectorStore, VectorStoreError
from services.wiki_read import WikiReadError, WikiReadService


class SubAgentError(RuntimeError):
    pass


@dataclass(frozen=True)
class SubAgentRunRequest:
    user_id: str
    parent_surface: str
    capability_key: str
    task_summary: str
    context_scope: dict[str, Any]
    task_title: str | None = None
    parent_thread_id: str | None = None
    parent_message_id: str | None = None


@dataclass(frozen=True)
class SubAgentRunResult:
    run_id: str
    status: str
    result_summary: str | None
    structured_result: dict[str, Any]
    trace: list[dict[str, Any]]
    citations: list[dict[str, Any]]
    error_message: str | None = None


class SubAgentOrchestrator:
    def __init__(self, store: VectorStore) -> None:
        self.store = store
        self.registry = AgentCapabilityRegistry(store)
        self.context_builder = AgentContextBuilder(store)

    @classmethod
    def from_env(cls) -> "SubAgentOrchestrator":
        return cls(VectorStore.from_env())

    def list_capabilities(self) -> list[dict[str, Any]]:
        return [capability.public_dict() for capability in self.registry.list_active()]

    def start_run(self, request: SubAgentRunRequest) -> SubAgentRunResult:
        try:
            capability = self.registry.get_for_surface(request.capability_key, request.parent_surface)
            context = self.context_builder.build(
                user_id=request.user_id,
                parent_surface=request.parent_surface,
                task_summary=request.task_summary,
                context_scope=request.context_scope,
                capability=capability,
            )
            run_id = self._create_run(request, capability, context)
            self._update_run(run_id, request.user_id, status="running", started_at=_now())
            self._create_step(
                run_id,
                request.user_id,
                1,
                step_type="context_build",
                title="Context prepared",
                summary=f"Prepared {len(context.sources)} scoped source reference(s).",
                input_summary={"requested_scope": context.context_scope},
                output_summary={"source_count": len(context.sources)},
                source_refs=[_source_public_dict(source) for source in context.sources],
            )
            for source in context.sources:
                self._create_source(run_id, request.user_id, source)

            if capability.capability_key == "document_analysis_agent":
                result = self._handle_document_analysis(context)
            elif capability.capability_key == "structured_data_agent":
                result = self._handle_structured_data(context)
            elif capability.capability_key == "kb_explorer_agent":
                result = self._handle_kb_explorer(context, capability, run_id, request.parent_thread_id)
            elif capability.capability_key == "sandbox_execution_agent":
                result = self._handle_sandbox_execution(context, capability, run_id)
            elif capability.capability_key == "per_user_wiki":
                result = self._handle_per_user_wiki(context)
            elif capability.capability_key == "per_user_document_wiki":
                result = self._handle_per_user_document_wiki(context)
            elif capability.capability_key == "global_ip":
                result = self._handle_global_ip(context)
            else:
                raise SubAgentError("Capability handler is not available yet.")

            self._create_step(
                run_id,
                request.user_id,
                2,
                step_type="result",
                title="Result prepared",
                summary=result["result_summary"],
                output_summary=result["structured_result"],
                source_refs=result["citations"],
            )
            self._update_run(
                run_id,
                request.user_id,
                status="completed",
                result_summary=result["result_summary"],
                structured_result=result["structured_result"],
                citations=result["citations"],
                confidence=result["structured_result"].get("confidence"),
                completed_at=_now(),
            )
            return self.get_run(run_id, request.user_id)
        except (AgentCapabilityError, AgentContextError, VectorStoreError, SubAgentError) as exc:
            raise SubAgentError(str(exc)) from exc

    def get_run(self, run_id: str, user_id: str) -> SubAgentRunResult:
        response = (
            self.store.client.table("agent_delegation_runs")
            .select("*")
            .eq("id", run_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        run = response.data
        if not run:
            raise SubAgentError("Sub-agent run was not found for this user.")
        steps_response = (
            self.store.client.table("agent_delegation_steps")
            .select("*")
            .eq("run_id", run_id)
            .eq("user_id", user_id)
            .order("step_index")
            .execute()
        )
        trace = [
            {
                "step_index": step.get("step_index"),
                "step_type": step.get("step_type"),
                "status": step.get("status"),
                "tool_name": step.get("tool_name"),
                "title": step.get("title"),
                "summary": step.get("summary"),
                "input_summary": step.get("input_summary") or {},
                "output_summary": step.get("output_summary") or {},
                "source_refs": step.get("source_refs") or [],
                "error_message": step.get("error_message"),
            }
            for step in steps_response.data or []
        ]
        return SubAgentRunResult(
            run_id=run["id"],
            status=run["status"],
            result_summary=run.get("result_summary"),
            structured_result=run.get("structured_result") or {},
            trace=trace,
            citations=run.get("citations") or [],
            error_message=run.get("error_message"),
        )

    def _create_run(
        self,
        request: SubAgentRunRequest,
        capability: AgentCapability,
        context: AgentContextBundle,
    ) -> str:
        row = {
            "user_id": request.user_id,
            "capability_id": capability.id,
            "capability_key": capability.capability_key,
            "parent_surface": request.parent_surface,
            "parent_thread_id": request.parent_thread_id,
            "parent_message_id": request.parent_message_id,
            "status": "queued",
            "task_title": request.task_title,
            "task_summary": request.task_summary,
            "context_scope": context.context_scope,
            "allowed_tools_snapshot": capability.allowed_tools,
            "metadata": {
                "output_schema_version": capability.output_schema.get("version", "agent_result_v1"),
                "can_spawn_agents": False,
            },
        }
        response = self.store.client.table("agent_delegation_runs").insert(row).execute()
        data = response.data[0] if isinstance(response.data, list) and response.data else response.data
        if not data:
            raise SubAgentError("Could not create sub-agent run.")
        return data["id"]

    def _update_run(self, run_id: str, user_id: str, **values: Any) -> None:
        values["updated_at"] = _now()
        self.store.client.table("agent_delegation_runs").update(values).eq("id", run_id).eq("user_id", user_id).execute()

    def _create_step(
        self,
        run_id: str,
        user_id: str,
        step_index: int,
        *,
        step_type: str,
        title: str,
        summary: str,
        input_summary: dict[str, Any] | None = None,
        output_summary: dict[str, Any] | None = None,
        source_refs: list[dict[str, Any]] | None = None,
        tool_name: str | None = None,
        status: str = "completed",
        error_message: str | None = None,
    ) -> None:
        self.store.client.table("agent_delegation_steps").insert(
            {
                "user_id": user_id,
                "run_id": run_id,
                "step_index": step_index,
                "step_type": step_type,
                "status": status,
                "tool_name": tool_name,
                "title": title,
                "summary": summary,
                "input_summary": input_summary or {},
                "output_summary": output_summary or {},
                "source_refs": source_refs or [],
                "error_message": error_message,
            }
        ).execute()

    def _create_source(self, run_id: str, user_id: str, source: AgentSourceRef) -> None:
        self.store.client.table("agent_context_sources").insert(
            {
                "user_id": user_id,
                "run_id": run_id,
                "source_kind": source.source_kind,
                "source_id": source.source_id,
                "source_label": source.source_label,
                "source_metadata": source.source_metadata,
                "citation_payload": source.citation_payload,
            }
        ).execute()

    def _handle_document_analysis(self, context: AgentContextBundle) -> dict[str, Any]:
        findings: list[dict[str, Any]] = []
        for document in context.documents:
            findings.append(
                {
                    "type": "document_metadata",
                    "title": document.get("file_name"),
                    "summary": _document_summary(document),
                    "source_id": document.get("id"),
                }
            )
        for chunk in context.chunks:
            findings.append(
                {
                    "type": "chunk_excerpt",
                    "title": f"Chunk {chunk.get('chunk_index')}",
                    "summary": _excerpt(chunk.get("content") or ""),
                    "source_id": chunk.get("id"),
                }
            )
        if not findings:
            findings.append(
                {
                    "type": "no_sources",
                    "summary": "No scoped document sources were provided for review.",
                    "source_id": None,
                }
            )
        result_summary = f"Reviewed {len(context.documents)} document(s) and {len(context.chunks)} chunk(s)."
        return _handler_result(result_summary, findings, context.sources, confidence=0.72)

    def _handle_structured_data(self, context: AgentContextBundle) -> dict[str, Any]:
        findings = [
            {
                "type": "dataset_summary",
                "title": dataset.get("dataset_name"),
                "summary": dataset.get("summary") or f"Dataset status is {dataset.get('status')}.",
                "source_id": dataset.get("id"),
            }
            for dataset in context.datasets
        ]
        structured_query = context.context_scope.get("structured_query")
        if isinstance(structured_query, dict) and structured_query.get("generated_sql"):
            result = StructuredQueryService(self.store).execute(
                StructuredQueryRequest(
                    user_id=context.user_id,
                    question=str(structured_query.get("question") or context.task_summary),
                    generated_sql=str(structured_query["generated_sql"]),
                    max_rows=int(structured_query.get("max_rows") or 10),
                )
            )
            findings.append(
                {
                    "type": "structured_query_result",
                    "summary": f"Approved structured query returned {len(result.rows)} row(s).",
                    "query_id": result.query_id,
                    "row_count": len(result.rows),
                }
            )
        if not findings:
            findings.append(
                {
                    "type": "no_sources",
                    "summary": "No scoped structured datasets were provided for review.",
                    "source_id": None,
                }
            )
        result_summary = f"Reviewed {len(context.datasets)} dataset(s)."
        return _handler_result(result_summary, findings, context.sources, confidence=0.7)

    def _handle_kb_explorer(
        self,
        context: AgentContextBundle,
        capability: AgentCapability,
        run_id: str,
        parent_thread_id: str | None,
    ) -> dict[str, Any]:
        """Run the KB Explorer sub-agent tool-use loop."""
        exploration = KbExplorerService(self.store, model_setting_key=capability.model_setting_key).run_exploration(
            user_id=context.user_id,
            task_summary=context.task_summary,
            thread_id=parent_thread_id or context.context_scope.get("thread_id"),
            run_id=run_id,
            max_rounds=5,
        )

        findings: list[dict[str, Any]] = []
        for step in exploration.tool_steps:
            findings.append(
                {
                    "type": "tool_step",
                    "title": f"Tool: {step['tool_name']}",
                    "summary": step.get("summary", ""),
                    "source_id": None,
                    "error": step.get("error"),
                }
            )
        findings.append(
            {
                "type": "explorer_synthesis",
                "title": "Explorer synthesis",
                "summary": exploration.summary,
                "source_id": None,
            }
        )

        sources = [
            AgentSourceRef(
                source_kind="raw_document",
                source_id=doc_id,
                source_label=exploration.referenced_doc_names.get(doc_id, doc_id),
                source_metadata={"referenced_via": "kb_read"},
                citation_payload={
                    "document_id": doc_id,
                    "label": exploration.referenced_doc_names.get(doc_id, doc_id),
                },
            )
            for doc_id in exploration.referenced_doc_ids
        ]

        result_summary = exploration.summary[:500] if exploration.summary else "KB exploration complete."
        confidence = 0.75 if exploration.truncated else 0.85
        return _handler_result(result_summary, findings, sources, confidence=confidence)

    def _handle_sandbox_execution(
        self,
        context: AgentContextBundle,
        capability: AgentCapability,
        run_id: str,
    ) -> dict[str, Any]:
        """Run the Sandbox Execution sub-agent tool-use loop."""
        thread_id = str(context.context_scope.get("thread_id") or "").strip()
        if not thread_id:
            raise SubAgentError("Sandbox execution requires context_scope.thread_id.")

        default_config = capability.default_config or {}
        max_rounds = _safe_int(default_config.get("max_rounds"), default=6, minimum=1, maximum=12)
        timeout_seconds = _safe_float(default_config.get("timeout_seconds"), default=90.0, minimum=1.0, maximum=180.0)
        skill_file_ids = _safe_string_list(context.context_scope.get("skill_file_ids"))

        execution = SandboxExecutionService.from_env(model_setting_key=capability.model_setting_key).run_execution(
            user_id=context.user_id,
            thread_id=thread_id,
            task_summary=context.task_summary,
            skill_file_ids=skill_file_ids,
            run_id=run_id,
            max_rounds=max_rounds,
            timeout_seconds=timeout_seconds,
            surface=context.parent_surface,
        )

        artifact = None
        if execution.produced_file_path:
            try:
                artifact = ArtifactService.from_env().deliver_from_sandbox(
                    user_id=context.user_id,
                    thread_id=thread_id,
                    container_path=execution.produced_file_path,
                    description="Generated by the Sandbox Execution agent.",
                )
            except ArtifactServiceError as exc:
                raise SubAgentError(f"Artifact delivery failed: {exc}") from exc

        findings: list[dict[str, Any]] = []
        for step in execution.tool_steps:
            findings.append(
                {
                    "type": "tool_step",
                    "title": f"Tool: {step['tool_name']}",
                    "summary": step.get("summary", ""),
                    "source_id": None,
                    "error": step.get("error"),
                }
            )
        findings.append(
            {
                "type": "sandbox_synthesis",
                "title": "Sandbox synthesis",
                "summary": execution.summary,
                "source_id": None,
            }
        )

        result_summary = execution.summary[:500] if execution.summary else "Sandbox execution complete."
        confidence = 0.7 if execution.truncated else 0.82
        result = _handler_result(result_summary, findings, [], confidence=confidence)
        result["structured_result"].update(
            {
                "rounds_used": execution.rounds_used,
                "truncated": execution.truncated,
                "produced_file_path": execution.produced_file_path,
                "artifact_id": artifact.id if artifact else None,
                "artifact": artifact.to_dict() if artifact else None,
            }
        )
        return result

    def _handle_per_user_wiki(self, context: AgentContextBundle) -> dict[str, Any]:
        tool = str(context.context_scope.get("wiki_tool") or "").strip()
        reader = WikiReadService(self.store)
        try:
            if not tool:
                if context.context_scope.get("claim_id"):
                    tool = "wiki_get_claim"
                elif context.context_scope.get("wiki_query"):
                    tool = "wiki_search"
                elif context.context_scope.get("page_key"):
                    tool = "wiki_get_page"
                else:
                    tool = "wiki_read_digest"

            if tool == "wiki_get_page":
                result = reader.get_page(context.user_id, str(context.context_scope.get("page_key") or ""))
            elif tool == "wiki_get_claim":
                result = reader.get_claim(context.user_id, str(context.context_scope.get("claim_id") or ""))
            elif tool == "wiki_search":
                result = reader.search(
                    context.user_id,
                    str(context.context_scope.get("wiki_query") or context.task_summary),
                    page_key=context.context_scope.get("page_key"),
                )
            elif tool == "wiki_search_insight":
                result = reader.search(
                    context.user_id,
                    str(context.context_scope.get("wiki_query") or context.task_summary),
                    page_key=context.context_scope.get("page_key"),
                    insight_only=True,
                )
            elif tool == "wiki_read_digest":
                result = reader.read_digest(context.user_id)
            else:
                raise SubAgentError("Unsupported per-user wiki tool.")
        except WikiReadError as exc:
            raise SubAgentError(f"Per-user wiki read failed: {exc}") from exc

        citations = result.pop("citations", [])
        return {
            "result_summary": result.get("summary", "Per-user wiki read complete."),
            "structured_result": result,
            "citations": citations,
        }

    def _handle_per_user_document_wiki(self, context: AgentContextBundle) -> dict[str, Any]:
        tool = str(context.context_scope.get("docwiki_tool") or "").strip()
        reader = DocWikiReadService(self.store)
        try:
            if not tool:
                if context.context_scope.get("docwiki_query"):
                    tool = "docwiki_search"
                elif (
                    context.context_scope.get("canonical_key")
                    or context.context_scope.get("page_id")
                ):
                    tool = "docwiki_get_page"
                else:
                    tool = "docwiki_list"

            if tool == "docwiki_search":
                result = reader.search(
                    context.user_id,
                    str(context.context_scope.get("docwiki_query") or context.task_summary),
                    page_kinds=context.context_scope.get("page_kinds") or None,
                    limit=int(context.context_scope.get("limit", 8)),
                )
            elif tool == "docwiki_get_page":
                result = reader.get_page(
                    context.user_id,
                    canonical_key=context.context_scope.get("canonical_key"),
                    page_id=context.context_scope.get("page_id"),
                )
            elif tool == "docwiki_list":
                result = reader.list_pages(
                    context.user_id,
                    page_kinds=context.context_scope.get("page_kinds") or None,
                    source_type=context.context_scope.get("source_type"),
                    limit=int(context.context_scope.get("limit", 20)),
                )
            else:
                raise SubAgentError("Unsupported per-user document wiki tool.")
        except DocWikiReadError as exc:
            raise SubAgentError(f"Doc wiki read failed: {exc}") from exc

        citations = result.pop("citations", [])
        return {
            "result_summary": result.get("summary", "Doc wiki read complete."),
            "structured_result": result,
            "citations": citations,
        }

    def _handle_global_ip(self, context: AgentContextBundle) -> dict[str, Any]:
        selector = context.context_scope.get("global_ip_selector") or context.context_scope.get("checkpoint_selector") or {}
        try:
            result = GlobalIpReadService(self.store).get(selector)
        except GlobalIpReadError as exc:
            raise SubAgentError(f"Global IP read failed: {exc}") from exc
        citations = result.pop("citations", [])
        return {
            "result_summary": result.get("summary", "Global IP read complete."),
            "structured_result": result,
            "citations": citations,
        }


def _handler_result(
    result_summary: str,
    findings: list[dict[str, Any]],
    sources: list[AgentSourceRef],
    *,
    confidence: float,
) -> dict[str, Any]:
    citations = [_source_public_dict(source) for source in sources]
    return {
        "result_summary": result_summary,
        "structured_result": {
            "schema_version": "agent_result_v1",
            "summary": result_summary,
            "findings": findings,
            "confidence": confidence,
            "needs_review": False,
            "reasoning_visibility": "summary_only",
            "source_count": len(sources),
        },
        "citations": citations,
    }


def _not_implemented_result(
    *,
    capability_key: str,
    result_summary: str,
    contract_version: str,
    requested_scope: dict[str, Any],
) -> dict[str, Any]:
    return {
        "result_summary": result_summary,
        "structured_result": {
            "schema_version": "agent_result_v1",
            "status": "not_implemented",
            "capability_key": capability_key,
            "contract_version": contract_version,
            "summary": result_summary,
            "findings": [
                {
                    "type": "not_implemented",
                    "capability_key": capability_key,
                    "message": result_summary,
                    "requested_scope": requested_scope,
                }
            ],
            "confidence": 0.0,
            "needs_review": True,
            "reasoning_visibility": "summary_only",
            "source_count": 0,
        },
        "citations": [],
    }


def _source_public_dict(source: AgentSourceRef) -> dict[str, Any]:
    return {
        "source_kind": source.source_kind,
        "source_id": source.source_id,
        "source_label": source.source_label,
        "source_metadata": source.source_metadata,
        "citation_payload": source.citation_payload,
    }


def _document_summary(document: dict[str, Any]) -> str:
    bits = [
        document.get("metadata_document_type"),
        document.get("metadata_business_domain"),
        document.get("metadata_time_period"),
    ]
    text = ", ".join(str(bit) for bit in bits if bit)
    return text or f"Document status is {document.get('status')} with parser status {document.get('parser_status')}."


def _excerpt(content: str, max_chars: int = 360) -> str:
    text = " ".join(content.split())
    if len(text) <= max_chars:
        return text
    return f"{text[:max_chars].rstrip()}..."


def _safe_int(value: Any, *, default: int, minimum: int, maximum: int) -> int:
    try:
        return max(minimum, min(int(value), maximum))
    except (TypeError, ValueError):
        return default


def _safe_float(value: Any, *, default: float, minimum: float, maximum: float) -> float:
    try:
        return max(minimum, min(float(value), maximum))
    except (TypeError, ValueError):
        return default


def _safe_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if str(item).strip()]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
