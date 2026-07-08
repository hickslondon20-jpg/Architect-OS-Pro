"""FastAPI entrypoint for ArchitectOS document ingestion."""

from __future__ import annotations

from datetime import date
from typing import Annotated
import logging
import uuid

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator

from core.config import get_settings
from routers import kb_documents, kb_folders, skills
from services.doc_processor import process_document_bytes
from services.folder_navigation import KbNavigationError, KbNavigationService
from services.folder_navigation import ls_result_to_dict, tree_result_to_dict
from services.folder_navigation import grep_result_to_dict, glob_result_to_dict
from services.folder_navigation import read_result_to_dict
from services.metadata_extractor import MetadataExtractor
from services.retrieval import RetrievalService
from services.structured_data import (
    DatasetRegistrationInput,
    StructuredColumnInput,
    StructuredDataService,
    StructuredRowInput,
    StructuredTableInput,
)
from services.structured_query import StructuredQueryError
from services.structured_query import StructuredQueryRequest as StructuredQueryServiceRequest
from services.structured_query import StructuredQueryService
from services.sub_agent_orchestrator import SubAgentError
from services.sub_agent_orchestrator import SubAgentRunRequest as SubAgentServiceRunRequest
from services.sub_agent_orchestrator import SubAgentOrchestrator
from services.vector_store import VectorStore, VectorStoreError
from services.web_search import WebSearchService
from services.wiki_compilation import CompileResult, WikiCompilationError, WikiCompilationService
from services.wiki_consolidation import ConsolidationResult, WikiConsolidationError, WikiConsolidationService
from services.wiki_writeback import WikiWritebackError, WikiWritebackService

settings = get_settings()


class IngestRequest(BaseModel):
    document_id: str = Field(..., min_length=1)
    user_id: str = Field(..., min_length=1)
    storage_path: str = Field(..., min_length=1)
    file_name: str = Field(..., min_length=1)
    file_type: str = Field(..., min_length=1)


class HealthResponse(BaseModel):
    ok: bool
    service: str


class IngestResponse(BaseModel):
    document_id: str
    status: str
    chunk_count: int = 0
    skipped: bool = False


class RetrievalRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    query: str = Field(..., min_length=1)
    match_count: int = Field(default=8, ge=1, le=25)
    metadata_filter: dict = Field(default_factory=dict)
    rerank_enabled: bool | None = None
    candidate_count: int | None = Field(default=None, ge=1, le=200)


class RetrievalResult(BaseModel):
    chunk_id: str
    document_id: str
    content: str
    metadata: dict
    vector_similarity: float
    keyword_rank: float
    hybrid_score: float
    source_kind: str = "raw_document_chunk"
    vector_rank: int | None = None
    keyword_rank_position: int | None = None
    rrf_score: float | None = None
    rerank_score: float | None = None
    retrieval_stage: str = "rrf_fused"


class DatasetColumnPayload(BaseModel):
    source_column_name: str = Field(..., min_length=1)
    source_column_index: int | None = None
    normalized_key: str | None = None
    data_type: str | None = None
    semantic_role: str | None = None
    unit: str | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    requires_review: bool = False
    metadata: dict = Field(default_factory=dict)


class DatasetRowPayload(BaseModel):
    source_row_index: int | None = None
    row_label: str | None = None
    period_start: date | None = None
    period_end: date | None = None
    period_grain: str | None = None
    entity_name: str | None = None
    values: dict = Field(default_factory=dict)
    normalized_values: dict = Field(default_factory=dict)
    provenance: dict = Field(default_factory=dict)
    confidence: float | None = Field(default=None, ge=0, le=1)
    requires_review: bool = False


class DatasetTablePayload(BaseModel):
    table_key: str = Field(..., min_length=1)
    label: str | None = None
    source_sheet_name: str | None = None
    source_table_name: str | None = None
    parser_metadata: dict = Field(default_factory=dict)
    columns: list[DatasetColumnPayload] = Field(default_factory=list)
    rows: list[DatasetRowPayload] = Field(default_factory=list)


class DatasetRegisterRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    dataset_name: str = Field(..., min_length=1)
    source_document_id: str | None = None
    dataset_type: str | None = "generic_table"
    source_period_grain: str | None = "unknown"
    normalized_period_grain: str | None = None
    source_time_zone: str | None = None
    currency_code: str | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    summary: str | None = None
    provenance: dict = Field(default_factory=dict)
    metadata: dict = Field(default_factory=dict)
    tables: list[DatasetTablePayload] = Field(default_factory=list)


class DatasetRegisterResponse(BaseModel):
    dataset_id: str
    status: str
    table_count: int
    column_count: int
    row_count: int


class StructuredQueryRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    question: str = Field(..., min_length=1)
    generated_sql: str = Field(..., min_length=1)
    thread_id: str | None = None
    tool_call_id: str | None = None
    max_rows: int = Field(default=25, ge=1, le=100)


class StructuredQueryResponse(BaseModel):
    accepted: bool
    status: str
    query_id: str
    rows: list[dict]
    rejection_reason: str | None = None
    execution_ms: int | None = None


class WebSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    include_private_context: bool = False


class WebSearchResponse(BaseModel):
    enabled: bool
    provider: str | None
    retrieved_at: str
    results: list[dict]
    message: str


class KbLsRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    folder_id: str | None = Field(default=None)


class KbLsResponse(BaseModel):
    folder_id: str | None
    folder_name: str
    item_count: int
    items: list[dict]


class KbTreeRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    folder_id: str | None = Field(default=None)
    depth: int = Field(default=3, ge=1, le=10)
    limit: int = Field(default=200, ge=1, le=500)


class KbTreeResponse(BaseModel):
    folder_id: str | None
    folder_name: str
    depth_requested: int
    total_items: int
    truncated: bool
    tree: list[dict]


class KbGrepRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    pattern: str = Field(..., min_length=1)
    folder_id: str | None = Field(default=None)
    limit: int = Field(default=50, ge=1, le=100)


class KbGrepResponse(BaseModel):
    pattern: str
    scope_folder_id: str | None
    match_count: int
    matches: list[dict]


class KbGlobRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    pattern: str = Field(..., min_length=1)
    folder_id: str | None = Field(default=None)
    limit: int = Field(default=200, ge=1, le=200)


class KbGlobResponse(BaseModel):
    pattern: str
    scope_folder_id: str | None
    match_count: int
    matches: list[dict]


class KbReadRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    document_id: str = Field(..., min_length=1)
    start_line: int | None = Field(default=None, ge=1)
    end_line: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def validate_line_range(self) -> "KbReadRequest":
        start = self.start_line
        end = self.end_line
        if (start is None) != (end is None):
            raise ValueError(
                "Both start_line and end_line must be provided together, or both omitted."
            )
        if start is not None and end is not None:
            if end < start:
                raise ValueError("end_line must be >= start_line.")
            if end - start + 1 > 500:
                raise ValueError(
                    f"Line range too large: {end - start + 1} lines requested; maximum is 500."
                )
        return self


class KbReadResponse(BaseModel):
    document_id: str
    name: str
    total_lines: int
    start_line: int
    end_line: int
    truncated: bool
    content: str


class AgentCapabilityResponse(BaseModel):
    capability_key: str
    label: str
    description: str
    status: str
    allowed_surfaces: list[str]
    allowed_tools: list[str]
    allowed_source_kinds: list[str]
    output_schema: dict
    default_config: dict
    can_spawn_agents: bool


class AgentRunRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    parent_surface: str = Field(..., min_length=1)
    capability_key: str = Field(..., min_length=1)
    task_summary: str = Field(..., min_length=1, max_length=4000)
    context_scope: dict = Field(default_factory=dict)
    task_title: str | None = None
    parent_thread_id: str | None = None
    parent_message_id: str | None = None


class AgentRunResponse(BaseModel):
    run_id: str
    status: str
    result_summary: str | None
    structured_result: dict
    trace: list[dict]
    citations: list[dict]
    error_message: str | None = None


class WikiCompileRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    page_key: str = Field(..., min_length=1)
    force: bool = False


class WikiCompileEventRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    event: str = Field(..., min_length=1)
    force: bool = False


class DocWikiSynthesizeRequest(BaseModel):
    document_id: str = Field(..., min_length=1)
    user_id: str = Field(..., min_length=1)


class DocWikiSynthesizeSprintRequest(BaseModel):
    sprint_goal_id: str = Field(..., min_length=1)
    user_id: str = Field(..., min_length=1)


class DocWikiSynthesizeThreadRequest(BaseModel):
    thread_id: str = Field(..., min_length=1)
    user_id: str = Field(..., min_length=1)


class DocWikiSynthesizePendingThreadsRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    limit: int = Field(default=10, ge=1, le=50)


class DocWikiSynthesizeAgentArtifactRequest(BaseModel):
    run_id: str = Field(..., min_length=1)
    user_id: str = Field(..., min_length=1)


class DocWikiSearchRequest(BaseModel):
    user_id: str
    query: str
    page_kinds: list[str] | None = None
    limit: int = 8


class WikiCompileResponse(BaseModel):
    user_id: str
    page_key: str
    claim_count: int
    evidence_count: int
    thin: bool
    digest_generated_at: str
    rebuilt_pages: list[str]
    validation_counts: dict[str, int]
    synthesis_used: bool = False
    skipped: bool = False


class WikiEvidencePayload(BaseModel):
    source_id: str = Field(..., min_length=1)
    source_kind: str = Field(..., min_length=1)
    path: str | None = None
    lines: str | None = None
    weight: float | None = None
    note: str | None = None


class WikiProposeInsightRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    page_key: str = Field(..., min_length=1)
    text: str = Field(..., min_length=1)
    evidence: list[WikiEvidencePayload] = Field(default_factory=list)
    confidence: str = Field(..., min_length=1)
    actor: str = Field(default="domain_agent", min_length=1)


class WikiProposeInsightResponse(BaseModel):
    insight_id: str | None
    claim_id: str | None
    status: str
    gate_flags: dict[str, bool]
    rejection_reasons: list[str]


class WikiSetConfidenceRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    claim_id: str = Field(..., min_length=1)
    confidence: str = Field(..., min_length=1)
    actor: str = Field(..., min_length=1)


class WikiSetConfidenceResponse(BaseModel):
    claim_id: str
    confidence: str
    updated_at: str


class WikiFlagContradictionRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    claim_id: str = Field(..., min_length=1)
    against_claim_id: str | None = None
    page_ref: str | None = None
    note: str = Field(..., min_length=1)
    actor: str = Field(..., min_length=1)


class WikiFlagContradictionResponse(BaseModel):
    contradiction_id: str
    status: str


class WikiAddOverrideRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    page_key: str = Field(..., min_length=1)
    text: str = Field(..., min_length=1)
    claim_id: str | None = None
    actor: str = Field(..., min_length=1)


class WikiAddOverrideResponse(BaseModel):
    override_id: str
    class_name: str
    precedence: str


class WikiInsightTrustRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    insight_id: str = Field(..., min_length=1)
    actor: str = Field(..., min_length=1)


class WikiInsightTrustResponse(BaseModel):
    insight_id: str
    trust: str


class WikiFlushCandidatePayload(BaseModel):
    page_key: str = Field(..., min_length=1)
    text: str = Field(..., min_length=1)
    evidence: list[WikiEvidencePayload] = Field(default_factory=list)
    confidence: str = Field(..., min_length=1)


class WikiFlushRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    candidates: list[WikiFlushCandidatePayload] = Field(default_factory=list)
    actor: str = Field(default="domain_agent", min_length=1)


class WikiConsolidateRequest(BaseModel):
    user_id: str = Field(..., min_length=1)


class WikiConsolidateResponse(BaseModel):
    user_id: str
    deduped: int
    reconciled: int
    contradictions_flagged: int
    retired: int
    gaps_surfaced: int
    promotion_candidates_set: int
    validation_counts_before: dict[str, int]
    validation_counts_after: dict[str, int]
    change_list: list[dict]
    action_log_id: str | None


class WikiCompiledWriteProbeRequest(BaseModel):
    actor: str = Field(..., min_length=1)


def require_ingest_secret(x_ingest_secret: Annotated[str | None, Header()] = None) -> None:
    if settings.ingest_secret and x_ingest_secret != settings.ingest_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid ingestion secret.")


app = FastAPI(title="ArchitectOS Ingestion Backend", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["POST", "GET", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["authorization", "content-type", "x-ingest-secret"],
)

app.include_router(kb_folders.router, prefix="/kb/folders", tags=["KB Folders"])
app.include_router(kb_documents.router, prefix="/kb/documents", tags=["KB Documents"])
app.include_router(skills.router, prefix="/api/skills", tags=["Skills"])


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(ok=True, service="architectos-ingestion")


@app.post("/api/ingest", response_model=IngestResponse, dependencies=[Depends(require_ingest_secret)])
def ingest_document(payload: IngestRequest, background_tasks: BackgroundTasks) -> IngestResponse:
    _validate_user_scoped_path(payload.user_id, payload.storage_path)
    store = VectorStore.from_env()
    try:
        document = store.get_document(payload.document_id, payload.user_id)
        if store.is_duplicate_document(document):
            store.mark_parser_skipped(payload.document_id, payload.user_id, "Duplicate document row skipped before parsing.")
            return IngestResponse(document_id=payload.document_id, status="duplicate", chunk_count=0, skipped=True)
        store.mark_processing(payload.document_id, payload.user_id)
    except VectorStoreError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    background_tasks.add_task(_process_ingestion, payload)
    return IngestResponse(document_id=payload.document_id, status="processing", chunk_count=0)


@app.post("/api/retrieve", response_model=list[RetrievalResult], dependencies=[Depends(require_ingest_secret)])
def retrieve_chunks(payload: RetrievalRequest) -> list[RetrievalResult]:
    try:
        chunks = RetrievalService.from_env().hybrid_search(
            user_id=payload.user_id,
            query=payload.query,
            match_count=payload.match_count,
            metadata_filter=payload.metadata_filter,
            rerank_enabled=payload.rerank_enabled,
            candidate_count=payload.candidate_count,
        )
    except VectorStoreError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return [RetrievalResult(**chunk.__dict__) for chunk in chunks]


@app.post("/api/datasets/register", response_model=DatasetRegisterResponse, dependencies=[Depends(require_ingest_secret)])
def register_dataset(payload: DatasetRegisterRequest) -> DatasetRegisterResponse:
    try:
        result = StructuredDataService.from_env().register_dataset(
            DatasetRegistrationInput(
                user_id=payload.user_id,
                dataset_name=payload.dataset_name,
                source_document_id=payload.source_document_id,
                dataset_type=payload.dataset_type,
                source_period_grain=payload.source_period_grain,
                normalized_period_grain=payload.normalized_period_grain,
                source_time_zone=payload.source_time_zone,
                currency_code=payload.currency_code,
                confidence=payload.confidence,
                summary=payload.summary,
                provenance=payload.provenance,
                metadata=payload.metadata,
                tables=[
                    StructuredTableInput(
                        table_key=table.table_key,
                        label=table.label,
                        source_sheet_name=table.source_sheet_name,
                        source_table_name=table.source_table_name,
                        parser_metadata=table.parser_metadata,
                        columns=[StructuredColumnInput(**column.model_dump()) for column in table.columns],
                        rows=[StructuredRowInput(**row.model_dump()) for row in table.rows],
                    )
                    for table in payload.tables
                ],
            )
        )
    except VectorStoreError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return DatasetRegisterResponse(**result)


@app.post("/api/tools/structured-query", response_model=StructuredQueryResponse, dependencies=[Depends(require_ingest_secret)])
def structured_query(payload: StructuredQueryRequest) -> StructuredQueryResponse:
    try:
        result = StructuredQueryService.from_env().execute(
            StructuredQueryServiceRequest(
                user_id=payload.user_id,
                question=payload.question,
                generated_sql=payload.generated_sql,
                thread_id=payload.thread_id,
                tool_call_id=payload.tool_call_id,
                max_rows=payload.max_rows,
            )
        )
    except (VectorStoreError, StructuredQueryError) as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return StructuredQueryResponse(**result.__dict__)


@app.post("/api/tools/web-search", response_model=WebSearchResponse, dependencies=[Depends(require_ingest_secret)])
def web_search(payload: WebSearchRequest) -> WebSearchResponse:
    result = WebSearchService.from_env().search(
        payload.query,
        include_private_context=payload.include_private_context,
    )
    return WebSearchResponse(**result.__dict__)


@app.post("/api/tools/kb-ls", response_model=KbLsResponse, dependencies=[Depends(require_ingest_secret)])
def kb_ls(payload: KbLsRequest) -> KbLsResponse:
    try:
        result = KbNavigationService.from_env().execute_ls(
            user_id=payload.user_id,
            folder_id=payload.folder_id,
        )
    except KbNavigationError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except VectorStoreError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return KbLsResponse(**ls_result_to_dict(result))


@app.post("/api/tools/kb-tree", response_model=KbTreeResponse, dependencies=[Depends(require_ingest_secret)])
def kb_tree(payload: KbTreeRequest) -> KbTreeResponse:
    try:
        result = KbNavigationService.from_env().execute_tree(
            user_id=payload.user_id,
            folder_id=payload.folder_id,
            depth=payload.depth,
            limit=payload.limit,
        )
    except KbNavigationError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except VectorStoreError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return KbTreeResponse(**tree_result_to_dict(result))


@app.post("/api/tools/kb-grep", response_model=KbGrepResponse, dependencies=[Depends(require_ingest_secret)])
def kb_grep(payload: KbGrepRequest) -> KbGrepResponse:
    try:
        result = KbNavigationService.from_env().execute_grep(
            user_id=payload.user_id,
            pattern=payload.pattern,
            folder_id=payload.folder_id,
            limit=payload.limit,
        )
    except KbNavigationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except VectorStoreError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return KbGrepResponse(**grep_result_to_dict(result))


@app.post("/api/tools/kb-glob", response_model=KbGlobResponse, dependencies=[Depends(require_ingest_secret)])
def kb_glob(payload: KbGlobRequest) -> KbGlobResponse:
    try:
        result = KbNavigationService.from_env().execute_glob(
            user_id=payload.user_id,
            pattern=payload.pattern,
            folder_id=payload.folder_id,
            limit=payload.limit,
        )
    except KbNavigationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except VectorStoreError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return KbGlobResponse(**glob_result_to_dict(result))


@app.post("/api/tools/kb-read", response_model=KbReadResponse, dependencies=[Depends(require_ingest_secret)])
def kb_read(payload: KbReadRequest) -> KbReadResponse:
    try:
        result = KbNavigationService.from_env().execute_read(
            user_id=payload.user_id,
            document_id=payload.document_id,
            start_line=payload.start_line,
            end_line=payload.end_line,
        )
    except KbNavigationError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except VectorStoreError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return KbReadResponse(**read_result_to_dict(result))


@app.get(
    "/api/agent-capabilities",
    response_model=list[AgentCapabilityResponse],
    dependencies=[Depends(require_ingest_secret)],
)
def list_agent_capabilities() -> list[AgentCapabilityResponse]:
    try:
        capabilities = SubAgentOrchestrator.from_env().list_capabilities()
    except VectorStoreError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return [AgentCapabilityResponse(**capability) for capability in capabilities]


@app.post("/api/agent-runs", response_model=AgentRunResponse, dependencies=[Depends(require_ingest_secret)])
def start_agent_run(payload: AgentRunRequest) -> AgentRunResponse:
    try:
        result = SubAgentOrchestrator.from_env().start_run(
            SubAgentServiceRunRequest(
                user_id=payload.user_id,
                parent_surface=payload.parent_surface,
                capability_key=payload.capability_key,
                task_summary=payload.task_summary,
                context_scope=payload.context_scope,
                task_title=payload.task_title,
                parent_thread_id=payload.parent_thread_id,
                parent_message_id=payload.parent_message_id,
            )
        )
    except SubAgentError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except VectorStoreError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return AgentRunResponse(**result.__dict__)


@app.post("/api/wiki/compile-page", dependencies=[Depends(require_ingest_secret)])
def compile_wiki_page(payload: WikiCompileRequest, background_tasks: BackgroundTasks) -> dict:
    # Objective 4 (auto-trigger, 2026-07-08): moved to fire-and-forget/BackgroundTasks after a
    # live 502 proved a synchronous multi-second synthesis call can outlast Railway/Cloudflare's
    # edge gateway timeout (confirmed ~10-12s at the edge, well under a real Sonnet-call-plus-
    # Supabase-round-trips compile). pg_net (the caller for DB-trigger-fired events) never
    # inspects the response body anyway, so an immediate "queued" ack plus background execution
    # matches the existing /api/ingest and /api/doc-wiki/synthesize-document pattern in this
    # file. Errors from the actual compile are swallowed inside _run_wiki_compile_page and
    # surfaced only via logs/wiki_pages state, not this response.
    background_tasks.add_task(_run_wiki_compile_page, payload.user_id, payload.page_key, payload.force)
    return {"user_id": payload.user_id, "page_key": payload.page_key, "status": "queued"}


@app.post("/api/wiki/compile-event", dependencies=[Depends(require_ingest_secret)])
def compile_wiki_event(payload: WikiCompileEventRequest, background_tasks: BackgroundTasks) -> dict:
    # Same fire-and-forget rationale as compile_wiki_page above - compile_event can run 2-3
    # sequential page compiles (plus the open_questions chain), which is even more likely to
    # outlast a short edge-gateway timeout than a single page.
    background_tasks.add_task(_run_wiki_compile_event, payload.user_id, payload.event, payload.force)
    return {"user_id": payload.user_id, "event": payload.event, "status": "queued"}


@app.post("/api/doc-wiki/synthesize-document", dependencies=[Depends(require_ingest_secret)])
def doc_wiki_synthesize_document(
    payload: DocWikiSynthesizeRequest,
    background_tasks: BackgroundTasks,
) -> dict:
    job_id = str(uuid.uuid4())
    background_tasks.add_task(
        _run_doc_wiki_synthesis,
        payload.document_id,
        payload.user_id,
        job_id,
    )
    return {"synthesis_job_id": job_id, "status": "queued"}


@app.post("/api/doc-wiki/synthesize-sprint", dependencies=[Depends(require_ingest_secret)])
async def synthesize_sprint_wiki(payload: DocWikiSynthesizeSprintRequest) -> dict:
    from services.doc_wiki_sprint_adapter import DocWikiSprintAdapter
    from services.doc_wiki_synthesis import DocWikiSynthesisService

    try:
        service = DocWikiSynthesisService.from_env()
        adapter = DocWikiSprintAdapter(VectorStore.from_env().client, service)
        result = await adapter.synthesize_from_sprint(payload.sprint_goal_id, payload.user_id)
        return {"status": "ok", "result": result}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@app.post("/api/doc-wiki/synthesize-thread", dependencies=[Depends(require_ingest_secret)])
async def synthesize_thread_wiki(payload: DocWikiSynthesizeThreadRequest) -> dict:
    from services.doc_wiki_cso_thread_adapter import DocWikiCSOThreadAdapter
    from services.doc_wiki_synthesis import DocWikiSynthesisService

    try:
        service = DocWikiSynthesisService.from_env()
        adapter = DocWikiCSOThreadAdapter(VectorStore.from_env().client, service)
        result = await adapter.synthesize_from_thread(payload.thread_id, payload.user_id)
        return {"status": "ok", "result": result}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@app.post("/api/doc-wiki/synthesize-pending-threads", dependencies=[Depends(require_ingest_secret)])
async def synthesize_pending_thread_wikis(payload: DocWikiSynthesizePendingThreadsRequest) -> dict:
    from services.doc_wiki_cso_thread_adapter import DocWikiCSOThreadAdapter
    from services.doc_wiki_synthesis import DocWikiSynthesisService

    try:
        service = DocWikiSynthesisService.from_env()
        adapter = DocWikiCSOThreadAdapter(VectorStore.from_env().client, service)
        result = await adapter.synthesize_pending_threads(payload.user_id, payload.limit)
        return {"status": "ok", "result": result}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@app.post("/api/doc-wiki/synthesize-agent-artifact", dependencies=[Depends(require_ingest_secret)])
async def synthesize_agent_artifact_wiki(payload: DocWikiSynthesizeAgentArtifactRequest) -> dict:
    from services.doc_wiki_agent_artifact_adapter import DocWikiAgentArtifactAdapter
    from services.doc_wiki_synthesis import DocWikiSynthesisService

    try:
        service = DocWikiSynthesisService.from_env()
        adapter = DocWikiAgentArtifactAdapter(VectorStore.from_env().client, service)
        result = await adapter.synthesize_from_run(payload.run_id, payload.user_id)
        return {"status": "ok", "result": result}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@app.get("/api/doc-wiki/job/{synthesis_job_id}", dependencies=[Depends(require_ingest_secret)])
def doc_wiki_job_status(synthesis_job_id: str, user_id: str) -> dict:
    try:
        rows = (
            VectorStore.from_env()
            .client.table("ose_activity_log")
            .select("id,kind,text,created_at")
            .eq("user_id", user_id)
            .like("text", f"%job:{synthesis_job_id}%")
            .order("created_at")
            .execute()
            .data
            or []
        )
    except VectorStoreError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Doc Wiki job lookup failed: {exc}") from exc

    page_ids: list[str] = []
    for row in rows:
        text = row.get("text") or ""
        marker = "page:"
        if marker in text:
            page_ids.append(text.split(marker, 1)[1].split()[0])
    status_value = "queued"
    if any("SYNTHESIS_ERROR" in (row.get("text") or "") for row in rows):
        status_value = "error"
    if any("SYNTHESIS_COMPLETE" in (row.get("text") or "") for row in rows):
        status_value = "complete"
    if any("SYNTHESIS_SKIPPED" in (row.get("text") or "") for row in rows) and status_value == "queued":
        status_value = "skipped"
    return {
        "synthesis_job_id": synthesis_job_id,
        "status": status_value,
        "page_ids": list(dict.fromkeys(page_ids)),
        "events": rows,
    }


@app.post("/api/doc-wiki/search", dependencies=[Depends(require_ingest_secret)])
async def doc_wiki_search(payload: DocWikiSearchRequest):
    from services.doc_wiki_read_service import DocWikiReadError, DocWikiReadService
    from services.vector_store import VectorStore

    try:
        store = VectorStore.from_env()
        reader = DocWikiReadService(store)
        result = reader.search(
            payload.user_id,
            payload.query,
            page_kinds=payload.page_kinds,
            limit=payload.limit,
        )
        return {"status": "ok", "results": result}
    except DocWikiReadError as exc:
        return {"status": "error", "message": str(exc)}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@app.get("/api/doc-wiki/page/{user_id}/{canonical_key}", dependencies=[Depends(require_ingest_secret)])
async def doc_wiki_get_page(user_id: str, canonical_key: str):
    from services.doc_wiki_read_service import DocWikiReadError, DocWikiReadService
    from services.vector_store import VectorStore

    try:
        store = VectorStore.from_env()
        reader = DocWikiReadService(store)
        result = reader.get_page(user_id, canonical_key=canonical_key)
        return {"status": "ok", "page": result}
    except DocWikiReadError as exc:
        return {"status": "not_found", "message": str(exc)}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@app.get("/api/doc-wiki/pages/{user_id}", dependencies=[Depends(require_ingest_secret)])
async def doc_wiki_list_pages(
    user_id: str,
    page_kinds: str | None = None,
    source_type: str | None = None,
    limit: int = 20,
):
    from services.doc_wiki_read_service import DocWikiReadError, DocWikiReadService
    from services.vector_store import VectorStore

    try:
        store = VectorStore.from_env()
        reader = DocWikiReadService(store)
        kinds_list = [k.strip() for k in page_kinds.split(",")] if page_kinds else None
        result = reader.list_pages(
            user_id,
            page_kinds=kinds_list,
            source_type=source_type,
            limit=limit,
        )
        return {"status": "ok", "pages": result}
    except DocWikiReadError as exc:
        return {"status": "error", "message": str(exc)}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@app.get("/api/doc-wiki/health/{user_id}", dependencies=[Depends(require_ingest_secret)])
async def doc_wiki_health(user_id: str):
    from services.doc_wiki_health_service import DocWikiHealthError, DocWikiHealthService
    from services.vector_store import VectorStore

    try:
        store = VectorStore.from_env()
        svc = DocWikiHealthService(store)
        health = svc.health(user_id)
        return {"status": "ok", "health": health}
    except DocWikiHealthError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("doc_wiki_health: unexpected error for user_id=%s: %s", user_id, exc)
        raise HTTPException(status_code=500, detail="Health check failed.") from exc


@app.post(
    "/api/wiki/writeback/propose-insight",
    response_model=WikiProposeInsightResponse,
    dependencies=[Depends(require_ingest_secret)],
)
def propose_wiki_insight(payload: WikiProposeInsightRequest) -> WikiProposeInsightResponse:
    try:
        result = WikiWritebackService.from_env().propose_insight_claim(
            payload.user_id,
            payload.page_key,
            payload.text,
            [item.model_dump(exclude_none=True) for item in payload.evidence],
            payload.confidence,
            actor=payload.actor,
        )
    except WikiWritebackError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except VectorStoreError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return WikiProposeInsightResponse(**result.__dict__)


@app.post(
    "/api/wiki/writeback/set-claim-confidence",
    response_model=WikiSetConfidenceResponse,
    dependencies=[Depends(require_ingest_secret)],
)
def set_wiki_claim_confidence(payload: WikiSetConfidenceRequest) -> WikiSetConfidenceResponse:
    try:
        result = WikiWritebackService.from_env().set_claim_confidence(
            payload.user_id,
            payload.claim_id,
            payload.confidence,
            actor=payload.actor,
        )
    except WikiWritebackError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return WikiSetConfidenceResponse(**result.__dict__)


@app.post(
    "/api/wiki/writeback/flag-contradiction",
    response_model=WikiFlagContradictionResponse,
    dependencies=[Depends(require_ingest_secret)],
)
def flag_wiki_contradiction(payload: WikiFlagContradictionRequest) -> WikiFlagContradictionResponse:
    try:
        result = WikiWritebackService.from_env().flag_contradiction(
            payload.user_id,
            payload.claim_id,
            against_claim_id=payload.against_claim_id,
            page_ref=payload.page_ref,
            note=payload.note,
            actor=payload.actor,
        )
    except WikiWritebackError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return WikiFlagContradictionResponse(**result.__dict__)


@app.post(
    "/api/wiki/writeback/add-override",
    response_model=WikiAddOverrideResponse,
    dependencies=[Depends(require_ingest_secret)],
)
def add_wiki_override(payload: WikiAddOverrideRequest) -> WikiAddOverrideResponse:
    try:
        result = WikiWritebackService.from_env().add_override(
            payload.user_id,
            payload.page_key,
            payload.text,
            claim_id=payload.claim_id,
            actor=payload.actor,
        )
    except WikiWritebackError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except VectorStoreError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return WikiAddOverrideResponse(**result.__dict__)


@app.post(
    "/api/wiki/writeback/promote-insight",
    response_model=WikiInsightTrustResponse,
    dependencies=[Depends(require_ingest_secret)],
)
def promote_wiki_insight(payload: WikiInsightTrustRequest) -> WikiInsightTrustResponse:
    try:
        result = WikiWritebackService.from_env().promote_insight(payload.user_id, payload.insight_id, actor=payload.actor)
    except WikiWritebackError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return WikiInsightTrustResponse(**result.__dict__)


@app.post(
    "/api/wiki/writeback/demote-insight",
    response_model=WikiInsightTrustResponse,
    dependencies=[Depends(require_ingest_secret)],
)
def demote_wiki_insight(payload: WikiInsightTrustRequest) -> WikiInsightTrustResponse:
    try:
        result = WikiWritebackService.from_env().demote_insight(payload.user_id, payload.insight_id, actor=payload.actor)
    except WikiWritebackError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return WikiInsightTrustResponse(**result.__dict__)


@app.post(
    "/api/wiki/writeback/flush-candidates",
    response_model=list[WikiProposeInsightResponse],
    dependencies=[Depends(require_ingest_secret)],
)
def flush_wiki_candidate_insights(payload: WikiFlushRequest) -> list[WikiProposeInsightResponse]:
    try:
        results = WikiWritebackService.from_env().flush_candidate_insights(
            payload.user_id,
            [item.model_dump(exclude_none=True) for item in payload.candidates],
            actor=payload.actor,
        )
    except WikiWritebackError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except VectorStoreError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return [WikiProposeInsightResponse(**result.__dict__) for result in results]


@app.post(
    "/api/wiki/consolidate",
    response_model=WikiConsolidateResponse,
    dependencies=[Depends(require_ingest_secret)],
)
def consolidate_wiki(payload: WikiConsolidateRequest) -> WikiConsolidateResponse:
    """Internal consolidation ('dreaming') cycle — called by n8n cron only.

    assess → fix (insight layer + Open Questions only) → verify.
    No founder-facing surface; no auto-promotion.
    """
    try:
        result = WikiConsolidationService.from_env().run_consolidation(payload.user_id)
    except WikiConsolidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except VectorStoreError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return WikiConsolidateResponse(**result.__dict__)


@app.post("/api/wiki/writeback/compiled-write-probe", dependencies=[Depends(require_ingest_secret)])
def reject_wiki_compiled_write(payload: WikiCompiledWriteProbeRequest) -> dict[str, str]:
    try:
        WikiWritebackService.from_env().reject_compiled_write(actor=payload.actor)
    except WikiWritebackError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"status": "unexpected"}


@app.get("/api/agent-runs/{run_id}", response_model=AgentRunResponse, dependencies=[Depends(require_ingest_secret)])
def get_agent_run(run_id: str, user_id: str) -> AgentRunResponse:
    try:
        result = SubAgentOrchestrator.from_env().get_run(run_id, user_id)
    except SubAgentError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except VectorStoreError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return AgentRunResponse(**result.__dict__)


def _process_ingestion(payload: IngestRequest) -> None:
    store = VectorStore.from_env()
    try:
        document = store.get_document(payload.document_id, payload.user_id)
        if store.is_duplicate_document(document):
            store.mark_parser_skipped(payload.document_id, payload.user_id, "Duplicate document row skipped before parsing.")
            return
        file_bytes = store.download_raw_document(payload.storage_path)
        store.confirm_content_hash(payload.document_id, payload.user_id, file_bytes, document)
        store.mark_parser_processing(payload.document_id, payload.user_id)
        processed = process_document_bytes(
            file_bytes=file_bytes,
            file_name=payload.file_name,
            file_type=payload.file_type,
            chunk_size_tokens=settings.chunk_size_tokens,
            chunk_overlap_tokens=settings.chunk_overlap_tokens,
        )
        store.mark_parser_complete(payload.document_id, payload.user_id, processed.metadata)
        store.store_full_markdown(payload.document_id, payload.user_id, processed.text)
        document_metadata = {}
        try:
            store.mark_metadata_processing(payload.document_id, payload.user_id)
            extraction = MetadataExtractor(store, settings).extract(
                text=processed.text,
                file_name=payload.file_name,
                file_type=payload.file_type,
            )
            document_metadata = extraction.metadata
            store.mark_metadata_complete(
                payload.document_id,
                payload.user_id,
                document_metadata,
                extraction.model,
            )
        except Exception as exc:
            store.mark_metadata_failed(payload.document_id, payload.user_id, str(exc))
        store.replace_document_chunks(
            document_id=payload.document_id,
            user_id=payload.user_id,
            chunks=processed.chunks,
            metadata=processed.metadata,
            document_metadata=document_metadata,
        )
        store.mark_ingested(payload.document_id, payload.user_id, len(processed.chunks), processed.metadata)
        try:
            from services.doc_wiki_synthesis import DocWikiDocumentAdapter

            adapter = DocWikiDocumentAdapter.from_env()
            adapter.synthesize_from_document(
                document_id=payload.document_id,
                user_id=payload.user_id,
                file_name=payload.file_name,
            )
        except Exception:
            # Synthesis failure is best-effort — document ingestion already succeeded.
            # The synthesis service logs internally to ose_activity_log.
            # Do NOT call mark_metadata_failed: that would incorrectly flag a
            # successfully ingested document as having failed metadata extraction.
            pass
    except Exception as exc:
        try:
            store.mark_parser_failed(payload.document_id, payload.user_id, str(exc))
            store.mark_failed(payload.document_id, payload.user_id, str(exc))
        except Exception:
            pass


def _run_doc_wiki_synthesis(document_id: str, user_id: str, job_id: str) -> None:
    try:
        from services.doc_wiki_synthesis import DocWikiDocumentAdapter

        adapter = DocWikiDocumentAdapter.from_env()
        adapter.synthesize_from_document(
            document_id=document_id,
            user_id=user_id,
            file_name="",
            synthesis_job_id=job_id,
        )
    except Exception:
        pass


def _run_wiki_compile_page(user_id: str, page_key: str, force: bool) -> None:
    try:
        WikiCompilationService.from_env().compile_page(user_id, page_key, force=force)
    except Exception:
        logging.getLogger(__name__).exception(
            "wiki_compile_page background task failed for user=%s page_key=%s", user_id, page_key
        )


def _run_wiki_compile_event(user_id: str, event: str, force: bool) -> None:
    try:
        WikiCompilationService.from_env().compile_event(user_id, event, force=force)
    except Exception:
        logging.getLogger(__name__).exception(
            "wiki_compile_event background task failed for user=%s event=%s", user_id, event
        )


def _validate_user_scoped_path(user_id: str, storage_path: str) -> None:
    first_segment = storage_path.split("/", 1)[0]
    if first_segment != user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Storage path must start with the authenticated user id.",
        )
