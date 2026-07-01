"""Document Wiki Layer 2 - health/lint service.

Read-only health checks for ose_knowledge_pages and related tables.
Analogous to WikiHealthService (Layer 1, services/wiki_health.py)
but scoped to the doc wiki data model.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


class DocWikiHealthError(Exception):
    """Raised when the health check itself fails to run."""


class DocWikiHealthService:
    """Read-only health/lint checker for ose_knowledge_pages (Layer 2)."""

    def __init__(self, store: Any) -> None:
        self._sb = store.client

    def health(self, user_id: str) -> dict[str, Any]:
        """Return a health snapshot for this user's doc wiki.

        Each sub-check is individually try/except'd so a single Supabase
        query failure returns partial data rather than crashing the whole call.
        """
        counts: dict[str, int | None] = {
            "pages_total": None,
            "pages_with_embedding": None,
            "pages_without_embedding": None,
            "pages_with_pending_corrections": None,
            "contradiction_count": None,
            "orphan_pages": None,
            "recent_errors_7d": None,
        }
        query_errors: list[str] = []

        # 1. pages_total - active pages for this user
        try:
            resp = (
                self._sb.table("ose_knowledge_pages")
                .select("id", count="exact")
                .eq("user_id", user_id)
                .neq("status", "deleted")
                .execute()
            )
            counts["pages_total"] = resp.count or 0
        except Exception as exc:
            logger.warning("doc_wiki_health: pages_total query failed: %s", exc)
            query_errors.append("pages_total")

        # 2. pages_with_embedding
        try:
            resp = (
                self._sb.table("ose_knowledge_pages")
                .select("id", count="exact")
                .eq("user_id", user_id)
                .neq("status", "deleted")
                .not_.is_("embedding", "null")
                .execute()
            )
            counts["pages_with_embedding"] = resp.count or 0
        except Exception as exc:
            logger.warning("doc_wiki_health: pages_with_embedding query failed: %s", exc)
            query_errors.append("pages_with_embedding")

        # 3. pages_without_embedding (derived)
        if counts["pages_total"] is not None and counts["pages_with_embedding"] is not None:
            counts["pages_without_embedding"] = (
                counts["pages_total"] - counts["pages_with_embedding"]
            )

        # 4. pages_with_pending_corrections - distinct page_ids with pending corrections
        try:
            resp = (
                self._sb.table("ose_page_corrections")
                .select("page_id")
                .eq("user_id", user_id)
                .eq("status", "pending")
                .execute()
            )
            page_ids = {row["page_id"] for row in (resp.data or [])}
            counts["pages_with_pending_corrections"] = len(page_ids)
        except Exception as exc:
            logger.warning("doc_wiki_health: pages_with_pending_corrections query failed: %s", exc)
            query_errors.append("pages_with_pending_corrections")

        # 5. contradiction_count - links with relation='contradicts'
        try:
            resp = (
                self._sb.table("ose_page_links")
                .select("id", count="exact")
                .eq("user_id", user_id)
                .eq("relation", "contradicts")
                .execute()
            )
            counts["contradiction_count"] = resp.count or 0
        except Exception as exc:
            logger.warning("doc_wiki_health: contradiction_count query failed: %s", exc)
            query_errors.append("contradiction_count")

        # 6. orphan_pages - pages whose source_file_ids contain deleted document refs
        try:
            counts["orphan_pages"] = self._count_orphan_pages(user_id)
        except Exception as exc:
            logger.warning("doc_wiki_health: orphan_pages check failed: %s", exc)
            query_errors.append("orphan_pages")

        # 7. recent_errors_7d - synthesis errors in the past 7 days
        try:
            resp = (
                self._sb.table("ose_activity_log")
                .select("id", count="exact")
                .eq("user_id", user_id)
                .ilike("text", "%SYNTHESIS_ERROR%")
                .gte("created_at", "now() - interval '7 days'")
                .execute()
            )
            counts["recent_errors_7d"] = resp.count or 0
        except Exception as exc:
            logger.warning("doc_wiki_health: recent_errors_7d query failed: %s", exc)
            query_errors.append("recent_errors_7d")

        # Build status + flags
        status, flags = self._evaluate(counts)

        result: dict[str, Any] = {
            "schema_version": "doc_wiki_health_v1",
            "user_id": user_id,
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "counts": counts,
            "status": status,
            "flags": flags,
        }
        if query_errors:
            result["query_errors"] = query_errors
        return result

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _count_orphan_pages(self, user_id: str) -> int:
        """Count pages with source_file_ids that reference deleted documents.

        Multi-step query (cannot be expressed as a single PostgREST call):
        1. Load all pages with non-empty source_file_ids for this user
        2. Collect all unique source file IDs referenced
        3. Batch-query ose_raw_document_registry to find which are deleted
        4. Count pages that reference at least one deleted document
        """
        # Step 1: pages with non-empty source_file_ids (select minimal columns)
        pages_resp = (
            self._sb.table("ose_knowledge_pages")
            .select("id,source_file_ids")
            .eq("user_id", user_id)
            .neq("status", "deleted")
            .not_.is_("source_file_ids", "null")
            .execute()
        )
        pages = pages_resp.data or []
        if not pages:
            return 0

        # Step 2: collect unique source IDs
        all_source_ids: set[str] = set()
        page_source_map: dict[str, list[str]] = {}
        for page in pages:
            raw = page.get("source_file_ids") or []
            source_ids = [str(sid) for sid in raw if sid]
            if source_ids:
                page_source_map[page["id"]] = source_ids
                all_source_ids.update(source_ids)

        if not all_source_ids:
            return 0

        # Step 3: find deleted docs among those IDs
        docs_resp = (
            self._sb.table("ose_raw_document_registry")
            .select("id,record_state")
            .in_("id", list(all_source_ids))
            .execute()
        )
        deleted_ids = {
            row["id"]
            for row in (docs_resp.data or [])
            if row.get("record_state") == "deleted"
        }
        if not deleted_ids:
            return 0

        # Step 4: count pages referencing at least one deleted source
        orphan_count = sum(
            1
            for page_id, source_ids in page_source_map.items()
            if any(sid in deleted_ids for sid in source_ids)
        )
        return orphan_count

    @staticmethod
    def _evaluate(counts: dict[str, int | None]) -> tuple[str, list[str]]:
        """Determine overall status and build human-readable flag list."""
        flags: list[str] = []

        # Convenience helper - treat None as 0 for comparisons
        def c(key: str) -> int:
            val = counts.get(key)
            return val if val is not None else 0

        # Collect flags
        if c("pages_without_embedding") > 0:
            flags.append(
                f"{c('pages_without_embedding')} page(s) have no embedding - "
                "not discoverable via semantic search"
            )
        if c("pages_with_pending_corrections") > 0:
            flags.append(
                f"{c('pages_with_pending_corrections')} page(s) have pending founder "
                "corrections not yet incorporated"
            )
        if c("contradiction_count") > 0:
            flags.append(
                f"{c('contradiction_count')} flagged contradiction(s) in the knowledge graph"
            )
        if c("orphan_pages") > 0:
            flags.append(
                f"{c('orphan_pages')} page(s) reference deleted or missing source documents"
            )
        if c("recent_errors_7d") > 0:
            flags.append(
                f"{c('recent_errors_7d')} synthesis error(s) in the past 7 days"
            )

        # Determine status
        if c("recent_errors_7d") > 5 or c("pages_without_embedding") > 20:
            return "degraded", flags
        if any([
            c("pages_with_pending_corrections") > 0,
            c("orphan_pages") > 0,
            c("contradiction_count") > 0,
            c("recent_errors_7d") > 0,
        ]):
            return "needs_attention", flags

        return "healthy", flags
