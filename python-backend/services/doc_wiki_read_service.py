"""Document Wiki Layer 2 - read service (search, get, list).

Analogous to WikiReadService (Layer 1). Provides the three docwiki tool
implementations: docwiki_search, docwiki_get_page, docwiki_list.
"""

from __future__ import annotations

import logging
from typing import Any

from supabase import Client as SupabaseClient

logger = logging.getLogger(__name__)


class DocWikiReadError(Exception):
    """Raised when a doc wiki read operation fails."""


class DocWikiReadService:
    """Read-only service for ose_knowledge_pages (Layer 2 document wiki)."""

    def __init__(self, store: Any) -> None:
        self._sb: SupabaseClient = store.client

    def search(
        self,
        user_id: str,
        query: str,
        page_kinds: list[str] | None = None,
        limit: int = 8,
    ) -> dict[str, Any]:
        """Semantic search over ose_knowledge_pages via match_ose_knowledge_pages RPC."""
        from .vector_store import VectorStore

        if not query or not query.strip():
            raise DocWikiReadError("Search query must not be empty.")
        try:
            embedding = VectorStore.from_env().embed_query(query)
        except Exception as exc:
            raise DocWikiReadError(f"Failed to embed search query: {exc}") from exc

        rpc_params: dict[str, Any] = {
            "query_embedding": embedding,
            "match_count": max(1, min(limit, 20)),
            "target_user_id": user_id,
            "match_threshold": 0.65,
        }
        if page_kinds:
            rpc_params["filter_page_kinds"] = page_kinds

        try:
            response = self._sb.rpc("match_ose_knowledge_pages", rpc_params).execute()
        except Exception as exc:
            raise DocWikiReadError(f"RPC match_ose_knowledge_pages failed: {exc}") from exc

        rows = response.data or []
        findings = [
            {
                "page_id": row["page_id"],
                "title": row["title"],
                "canonical_key": row["canonical_key"],
                "page_kind": row["page_kind"],
                "source_type": row.get("source_type"),
                "similarity": round(float(row["similarity"]), 4),
                "excerpt": (row.get("content") or "")[:400],
            }
            for row in rows
        ]
        confidence = (
            sum(f["similarity"] for f in findings) / len(findings)
            if findings else 0.0
        )
        summary = (
            f"Found {len(findings)} wiki page(s) matching query."
            if findings else "No wiki pages found matching query."
        )
        citations = [
            {
                "source_kind": "wiki_page",
                "canonical_key": f["canonical_key"],
                "title": f["title"],
                "page_kind": f["page_kind"],
                "similarity": f["similarity"],
            }
            for f in findings
        ]
        return {
            "schema_version": "agent_result_v1",
            "summary": summary,
            "findings": findings,
            "confidence": round(confidence, 4),
            "needs_review": False,
            "reasoning_visibility": "summary_only",
            "source_count": len(findings),
            "citations": citations,
        }

    def get_page(
        self,
        user_id: str,
        canonical_key: str | None = None,
        page_id: str | None = None,
    ) -> dict[str, Any]:
        """Fetch a single page by canonical_key (preferred) or page_id."""
        if not canonical_key and not page_id:
            raise DocWikiReadError("Must provide canonical_key or page_id.")
        try:
            q = (
                self._sb.table("ose_knowledge_pages")
                .select(
                    "id,page_title,content,canonical_key,page_kind,page_type,"
                    "source_file_ids,origin_thread_id,last_updated,updated_at"
                )
                .eq("user_id", user_id)
            )
            if canonical_key:
                q = q.eq("canonical_key", canonical_key)
            else:
                q = q.eq("id", page_id)
            response = q.maybe_single().execute()
        except Exception as exc:
            raise DocWikiReadError(f"Page fetch failed: {exc}") from exc

        if not response.data:
            key_display = canonical_key or page_id
            raise DocWikiReadError(f"No wiki page found for key: {key_display}")

        row = response.data
        title = row["page_title"]
        finding = {
            "page_id": row["id"],
            "title": title,
            "canonical_key": row["canonical_key"],
            "page_kind": row["page_kind"],
            "source_type": _source_type(row),
            "content": row.get("content", ""),
            "source_file_ids": row.get("source_file_ids") or [],
            "created_at": str(row.get("last_updated", "")),
            "updated_at": str(row.get("updated_at", "")),
        }
        return {
            "schema_version": "agent_result_v1",
            "summary": f"Retrieved wiki page: {title}",
            "findings": [finding],
            "confidence": 1.0,
            "needs_review": False,
            "reasoning_visibility": "summary_only",
            "source_count": 1,
            "citations": [
                {
                    "source_kind": "wiki_page",
                    "canonical_key": row["canonical_key"],
                    "title": title,
                    "page_kind": row["page_kind"],
                }
            ],
        }

    def list_pages(
        self,
        user_id: str,
        page_kinds: list[str] | None = None,
        source_type: str | None = None,
        limit: int = 20,
    ) -> dict[str, Any]:
        """List wiki pages with optional filters. Returns title + metadata."""
        capped_limit = max(1, min(limit, 100))
        fetch_limit = capped_limit if not source_type else min(capped_limit * 4, 100)
        try:
            q = (
                self._sb.table("ose_knowledge_pages")
                .select(
                    "id,page_title,canonical_key,page_kind,page_type,"
                    "source_file_ids,origin_thread_id,updated_at"
                )
                .eq("user_id", user_id)
                .order("updated_at", desc=True)
                .limit(fetch_limit)
            )
            if page_kinds:
                q = q.in_("page_kind", page_kinds)
            response = q.execute()
        except Exception as exc:
            raise DocWikiReadError(f"Page list failed: {exc}") from exc

        rows = response.data or []
        if source_type:
            rows = [row for row in rows if _source_type(row) == source_type]
        rows = rows[:capped_limit]
        findings = [
            {
                "page_id": row["id"],
                "title": row["page_title"],
                "canonical_key": row["canonical_key"],
                "page_kind": row["page_kind"],
                "source_type": _source_type(row),
                "updated_at": str(row.get("updated_at", "")),
            }
            for row in rows
        ]
        return {
            "schema_version": "agent_result_v1",
            "summary": f"Listed {len(findings)} wiki page(s).",
            "findings": findings,
            "confidence": 1.0,
            "needs_review": False,
            "reasoning_visibility": "summary_only",
            "source_count": len(findings),
            "citations": [],
        }


def _source_type(row: dict[str, Any]) -> str | None:
    page_kind = row.get("page_kind")
    if page_kind == "sprint_history":
        return "sprint"
    if page_kind == "thread_synthesis" or row.get("origin_thread_id"):
        return "cso_thread"
    if page_kind == "agent_artifact":
        return "agent_artifact"
    if row.get("source_file_ids"):
        return "document"
    return None
