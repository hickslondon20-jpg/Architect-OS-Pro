# Sub-phase 06 — Execution Agent Brief
## Corrections Lifecycle Documentation, Icon Fix, Health Service

---

## Your Role

You are the sub-phase 06 execution agent for the ArchitectOS Document Wiki (Layer 2).
Your job is to build four specific deliverables, verify success criteria, and update
`Pro-Suite-Progress.md`. Do not touch anything outside the scope below.

---

## Step 0 — Read First (required before writing any code)

Read these files in order before taking any action:

1. `.planning/document-wiki/phases/06-corrections-log-health/CONTEXT.md` — scope, constraints, success criteria
2. `.planning/document-wiki/phases/06-corrections-log-health/06-RESEARCH.md` — full spec for every deliverable
3. `.planning/document-wiki/CONTRACT.md` — shared contracts (SourcePayload, page_kind vocab)
4. `python-backend/services/doc_wiki_synthesis.py` — lines 258–290 (`_maintain_manifest`), 366–380 (`_write_log`), 485–510 (`_pending_corrections`, `_mark_corrections_applied`), 528–545 (`_pending_correction_context`), 700–730 (`_apply_corrections_overlay`), 761–780 (`_log_icon`) — to confirm these are all fully implemented and understand the icon strings they produce
5. `python-backend/services/wiki_health.py` — reference implementation for `WikiHealthService` pattern
6. `components/pro-suite/os-engine/views/LogView.tsx` — see current ICONS registry + imports (lines 1–12)
7. `python-backend/main.py` — lines 470–475 (`require_ingest_secret` definition), 836–895 (sub-phase 05 read endpoints as pattern for new health endpoint)
8. `Pro-Suite-Progress.md` — read the current state before updating

---

## Step 1 — Migration Documentation

**File:** `docs/migrations/20260630_docwiki_corrections_log.sql`

Create this file. Use `CREATE TABLE IF NOT EXISTS` throughout — both tables already exist
in the live database (`pwacpjqkntnovndhspxt`). This is schema record-keeping; it will no-op
on the live project.

```sql
-- ArchitectOS Doc Wiki (Layer 2) — Corrections and Activity Log Tables
-- Migration: 20260630_docwiki_corrections_log
--
-- These tables were created during sub-phase 03 development (2026-06-30).
-- Both exist in the live Supabase project. This migration documents the
-- schema so it can be reproduced from migrations/ if needed.
-- Safe to apply: uses CREATE TABLE IF NOT EXISTS throughout.

-- -----------------------------------------------------------------------
-- ose_page_corrections
-- Stores founder corrections (overrides) for synthesized wiki pages.
-- status='pending'  → correction written, not yet incorporated into synthesis
-- status='applied'  → correction has been included in a re-synthesis pass
-- -----------------------------------------------------------------------
create table if not exists public.ose_page_corrections (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  page_id    uuid        not null references public.ose_knowledge_pages(id) on delete cascade,
  body       text        not null,
  status     text        not null default 'pending',
  created_at timestamptz not null default now(),
  constraint ose_page_corrections_status_check
    check (status in ('pending', 'applied'))
);

create index if not exists ose_page_corrections_user_id_idx
  on public.ose_page_corrections(user_id);

create index if not exists ose_page_corrections_page_id_status_idx
  on public.ose_page_corrections(page_id, status);

alter table public.ose_page_corrections enable row level security;

-- Founders read/write their own corrections only
create policy if not exists "Users manage their own page corrections"
  on public.ose_page_corrections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- -----------------------------------------------------------------------
-- ose_activity_log
-- Chronological feed of synthesis events and strategic decisions.
-- kind='activity' → routine synthesis events (SYNTHESIS_COMPLETE, MANIFEST_UPDATE)
-- kind='decision' → flagged decisions (CONTRADICTION_FLAGGED, CORRECTIONS_APPLIED, etc.)
-- icon            → kebab-case Lucide icon name ('file-text', 'alert-triangle', 'x-circle')
-- -----------------------------------------------------------------------
create table if not exists public.ose_activity_log (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  kind       text        not null default 'activity',
  text       text        not null,
  icon       text,
  created_at timestamptz not null default now(),
  constraint ose_activity_log_kind_check
    check (kind in ('activity', 'decision'))
);

create index if not exists ose_activity_log_user_id_created_idx
  on public.ose_activity_log(user_id, created_at desc);

alter table public.ose_activity_log enable row level security;

-- Founders read their own log only
create policy if not exists "Users read their own activity log"
  on public.ose_activity_log
  for select
  using (auth.uid() = user_id);

-- Service role writes log entries (synthesis engine writes via service role key)
create policy if not exists "Service role writes activity log"
  on public.ose_activity_log
  for insert
  to service_role
  with check (true);
```

---

## Step 2 — Icon Fix in LogView.tsx

**File:** `components/pro-suite/os-engine/views/LogView.tsx`

The only change is to the import line and ICONS registry. Do not touch any other part of
this file.

**Replace:**
```typescript
import { FileCheck2, RefreshCw, Lightbulb, Loader, Activity } from 'lucide-react';

const ICONS: Record<string, React.ElementType> = {
  FileCheck2,
  RefreshCw,
  Lightbulb,
  Loader,
  Activity,
};
```

**With:**
```typescript
import { FileCheck2, RefreshCw, Lightbulb, Loader, Activity,
         AlertTriangle, XCircle, FileText } from 'lucide-react';

const ICONS: Record<string, React.ElementType> = {
  FileCheck2,
  RefreshCw,
  Lightbulb,
  Loader,
  Activity,
  'alert-triangle': AlertTriangle,   // decisions, contradictions, warnings
  'x-circle': XCircle,               // errors
  'file-text': FileText,             // routine activity events
};
```

**Why:** `_log_icon()` in `doc_wiki_synthesis.py` produces kebab-case strings
(`"file-text"`, `"alert-triangle"`, `"x-circle"`). The existing ICONS registry uses
PascalCase keys. Without this fix, the log timeline always renders the `Activity`
fallback icon regardless of event type.

Do NOT change `_log_icon()` in the Python backend.

---

## Step 3 — DocWikiHealthService

**File:** `python-backend/services/doc_wiki_health_service.py`

Create this file. It is a standalone class — do not add methods to `DocWikiReadService`.

```python
"""Document Wiki Layer 2 — health/lint service.

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

        # 1. pages_total — active pages for this user
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

        # 4. pages_with_pending_corrections — distinct page_ids with pending corrections
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

        # 5. contradiction_count — links with relation='contradicts'
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

        # 6. orphan_pages — pages whose source_file_ids contain deleted document refs
        try:
            counts["orphan_pages"] = self._count_orphan_pages(user_id)
        except Exception as exc:
            logger.warning("doc_wiki_health: orphan_pages check failed: %s", exc)
            query_errors.append("orphan_pages")

        # 7. recent_errors_7d — synthesis errors in the past 7 days
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

        # Convenience helper — treat None as 0 for comparisons
        def c(key: str) -> int:
            val = counts.get(key)
            return val if val is not None else 0

        # Collect flags
        if c("pages_without_embedding") > 0:
            flags.append(
                f"{c('pages_without_embedding')} page(s) have no embedding — "
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
```

---

## Step 4 — Health Endpoint in main.py

**File:** `python-backend/main.py`

Add the health endpoint immediately after the `/api/doc-wiki/pages/{user_id}` endpoint
(which ends around line 895). Insert:

```python
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
```

Import pattern: lazy import inside function (same as other doc-wiki endpoints).
Dependency: `require_ingest_secret` (same as all doc-wiki read endpoints).
Return shape: `{"status": "ok", "health": {...health object...}}`

---

## Step 5 — Verify and Update Progress

**Compile check:**
```bash
python -m compileall python-backend
```
Must exit 0. Fix any syntax errors before reporting.

**Walk the 12 success criteria** from `CONTEXT.md` and confirm each one:

| # | Check |
|---|---|
| 1 | Migration file created |
| 2 | status CHECK constraint present |
| 3 | kind CHECK constraint present |
| 4 | `DocWikiHealthService` class exists |
| 5 | `health()` returns all 7 counts |
| 6 | `status` field is one of three valid values |
| 7 | `flags` list populated for non-zero issues |
| 8 | Individual try/except on each query |
| 9 | Health endpoint in main.py |
| 10 | `LogView.tsx` ICONS has 3 new kebab-case keys |
| 11 | 3 new lucide-react imports in LogView.tsx |
| 12 | `compileall` exits 0 |

**Update `Pro-Suite-Progress.md`:**

Find the sub-phase 06 row and update it to:

```
✅ code-complete — Migration docs written (ose_page_corrections + ose_activity_log schemas); LogView.tsx ICONS registry fixed (alert-triangle/x-circle/file-text now resolve correctly); DocWikiHealthService created (7 health checks: pages_total, with/without embedding, pending corrections, contradictions, orphan_pages, recent_errors_7d; status: healthy/needs_attention/degraded); GET /api/doc-wiki/health/{user_id} endpoint added; compileall passes. Schema finding: ose_page_corrections and ose_activity_log were built by sub-phase 03 agent but had no migration files.
```

---

## Hard Rules (Do Not Violate)

1. **Do NOT touch** `_pending_corrections()`, `_apply_corrections_overlay()`,
   `_mark_corrections_applied()`, `_pending_correction_context()` — fully built
2. **Do NOT touch** `_write_log()` or `_log_icon()` in `doc_wiki_synthesis.py`
3. **Do NOT touch** `_maintain_manifest()` in `doc_wiki_synthesis.py`
4. **`DocWikiHealthService` is read-only** — no table writes under any condition
5. **Migration uses `CREATE TABLE IF NOT EXISTS`** — idempotent; safe on live DB
6. **Do NOT apply the migration** — write the SQL file to disk only
7. **Icon fix is frontend only** — `LogView.tsx` lines 1–12 only; no other file changes
8. **Do NOT merge** health methods into `DocWikiReadService`
9. **One `logger.warning()` per failed check** — do not raise or re-raise individual check failures
10. Report back with: files modified/created, success criteria walkthrough, compile output,
    deviations (if any), and the Pro-Suite-Progress.md update confirmation
