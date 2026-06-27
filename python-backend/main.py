"""FastAPI entrypoint for ArchitectOS document ingestion."""

from __future__ import annotations

from typing import Annotated

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from core.config import get_settings
from services.doc_processor import process_document_bytes
from services.metadata_extractor import MetadataExtractor
from services.retrieval import RetrievalService
from services.vector_store import VectorStore, VectorStoreError

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


class RetrievalResult(BaseModel):
    chunk_id: str
    document_id: str
    content: str
    metadata: dict
    vector_similarity: float
    keyword_rank: float
    hybrid_score: float


def require_ingest_secret(x_ingest_secret: Annotated[str | None, Header()] = None) -> None:
    if settings.ingest_secret and x_ingest_secret != settings.ingest_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid ingestion secret.")


app = FastAPI(title="ArchitectOS Ingestion Backend", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["authorization", "content-type", "x-ingest-secret"],
)


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
        )
    except VectorStoreError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return [RetrievalResult(**chunk.__dict__) for chunk in chunks]


def _process_ingestion(payload: IngestRequest) -> None:
    store = VectorStore.from_env()
    try:
        document = store.get_document(payload.document_id, payload.user_id)
        if store.is_duplicate_document(document):
            return
        file_bytes = store.download_raw_document(payload.storage_path)
        store.confirm_content_hash(payload.document_id, payload.user_id, file_bytes, document)
        processed = process_document_bytes(
            file_bytes=file_bytes,
            file_name=payload.file_name,
            file_type=payload.file_type,
            chunk_size_tokens=settings.chunk_size_tokens,
            chunk_overlap_tokens=settings.chunk_overlap_tokens,
        )
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
    except Exception as exc:
        try:
            store.mark_failed(payload.document_id, payload.user_id, str(exc))
        except Exception:
            pass


def _validate_user_scoped_path(user_id: str, storage_path: str) -> None:
    first_segment = storage_path.split("/", 1)[0]
    if first_segment != user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Storage path must start with the authenticated user id.",
        )
