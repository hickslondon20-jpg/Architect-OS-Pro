"""User-scoped hybrid retrieval helpers for Virtual CSO tools."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from core.config import get_settings
from services.reranker import CohereReranker
from services.vector_store import VectorStore, VectorStoreError


@dataclass(frozen=True)
class RetrievedChunk:
    chunk_id: str
    document_id: str
    content: str
    metadata: dict[str, Any]
    vector_similarity: float
    keyword_rank: float
    hybrid_score: float
    source_kind: str = "raw_document_chunk"
    vector_rank: int | None = None
    keyword_rank_position: int | None = None
    rrf_score: float | None = None
    rerank_score: float | None = None
    retrieval_stage: str = "rrf_fused"


class RetrievalService:
    def __init__(self, store: VectorStore) -> None:
        self.store = store

    @classmethod
    def from_env(cls) -> "RetrievalService":
        return cls(VectorStore.from_env())

    def hybrid_search(
        self,
        user_id: str,
        query: str,
        match_count: int = 8,
        metadata_filter: dict[str, Any] | None = None,
        rerank_enabled: bool | None = None,
        candidate_count: int | None = None,
    ) -> list[RetrievedChunk]:
        if not query.strip():
            return []

        settings = get_settings()
        query_embedding = self.store.embed_query(query)
        rpc_args: dict[str, Any] = {
            "query_embedding": query_embedding,
            "query_text": query,
            "match_count": match_count,
            "target_user_id": user_id,
            "candidate_count": candidate_count or settings.retrieval_candidate_count,
            "rrf_k": settings.rrf_k,
        }
        if metadata_filter:
            rpc_args["metadata_filter"] = metadata_filter

        try:
            result = self.store.client.rpc(
                "match_document_chunks",
                rpc_args,
            ).execute()
        except Exception as exc:
            raise VectorStoreError(f"Hybrid retrieval failed: {exc}") from exc

        chunks = [
            RetrievedChunk(
                chunk_id=row["chunk_id"],
                document_id=row["document_id"],
                content=row["content"],
                metadata=row.get("metadata") or {},
                vector_similarity=float(row.get("vector_similarity") or 0),
                keyword_rank=float(row.get("keyword_rank") or 0),
                hybrid_score=float(row.get("hybrid_score") or 0),
                source_kind=row.get("source_kind") or "raw_document_chunk",
                vector_rank=row.get("vector_rank"),
                keyword_rank_position=row.get("keyword_rank_position"),
                rrf_score=float(row.get("rrf_score") or row.get("hybrid_score") or 0),
            )
            for row in result.data or []
        ]
        return CohereReranker(self.store, settings).rerank_chunks(
            query=query,
            chunks=chunks,
            enabled_override=rerank_enabled,
            top_n=match_count,
        )
