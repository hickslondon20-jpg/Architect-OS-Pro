# Sub-phase 05 Execution Agent Prompt

**You are a focused execution agent.** Your task is to implement sub-phase 05 of the
ArchitectOS Document Wiki (Layer 2): pgvector page embeddings + the three semantic search
tools. This is a build sub-phase — you are writing production code.

Read the files listed in Step 0 before writing a single line of code. Then execute
Steps 1–5 in order.

---

## Step 0 — Read before writing a single line of code

1. `.planning/document-wiki/CONTEXT.md` — locked decisions (especially §J hard rules)
2. `.planning/document-wiki/phases/05-embeddings-search/05-RESEARCH.md` — full verify-pass
   findings: embedding decision, `_embed_page()` spec, RPC spec, service spec, dispatch spec,
   19 success criteria
3. `.planning/document-wiki/phases/05-embeddings-search/CONTEXT.md` — scope and file list
4. `python-backend/services/doc_wiki_synthesis.py` — find the `_embed_page()` stub (line ~335)
   and the `EmbeddingNotImplementedError` catch (line ~127)
5. `python-backend/services/vector_store.py` — read `embed_query()` (line 269) to understand
   how to call it; do NOT change this file
6. `python-backend/services/sub_agent_orchestrator.py` — read `_handle_per_user_wiki()` (~line 363)
   for the dispatch pattern to mirror; read `_handle_per_user_document_wiki()` (~line 408) which
   is the stub you replace
7. `docs/migrations/007_hybrid_search_reranking.sql` — read `match_document_chunks` RPC (~line 61)
   as the template for `match_ose_knowledge_pages` (simpler, no hybrid BM25)
8. `python-backend/main.py` — find the existing doc-wiki endpoints to understand where to append
   the three new direct API endpoints
9. `Pro-Suite-Progress.md` — your status manifest; update when done

---

## Step 1 — Migration: `match_ose_knowledge_pages` RPC

Create `docs/migrations/20260630_docwiki_page_search.sql`.

This is a pure cosine similarity search function over `ose_knowledge_pages`. Do NOT add
BM25/hybrid logic — synthesized pages are semantically dense and don't need keyword fallback.

```sql
-- ArchitectOS Document Wiki Layer 2 Sub-phase 05: page semantic search RPC.
-- Pure cosine similarity — no hybrid BM25 (pages are synthesized prose, not raw chunks).

create or replace function public.match_ose_knowledge_pages(
  query_embedding   vector(1536),
  match_count       integer          default 8,
  target_user_id    uuid             default auth.uid(),
  match_threshold   double precision default 0.65,
  filter_page_kinds text[]           default null
)
returns table (
  page_id         uuid,
  title           text,
  content         text,
  canonical_key   text,
  page_kind       text,
  source_type     text,
  source_file_ids jsonb,
  created_at      timestamptz,
  updated_at      timestamptz,
  similarity      double precision
)
language sql
stable
as $$
  select
    p.id              as page_id,
    p.title,
    p.content,
    p.canonical_key,
    p.page_kind,
    p.source_type,
    p.source_file_ids,
    p.created_at,
    p.updated_at,
    1 - (p.embedding <=> query_embedding) as similarity
  from public.ose_knowledge_pages p
  where p.user_id = target_user_id
    and p.embedding is not null
    and (filter_page_kinds is null or p.page_kind = any(filter_page_kinds))
    and (1 - (p.embedding <=> query_embedding)) >= match_threshold
  order by p.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_ose_knowledge_pages(
  vector(1536), integer, uuid, double precision, text[]
) to authenticated;

grant execute on function public.match_ose_knowledge_pages(
  vector(1536), integer, uuid, double precision, text[]
) to service_role;
```

**Do not apply this migration** — write the SQL file only. The migration is applied manually
(or via the acceptance harness in sub-phase 07). If you have Supabase MCP access, flag it
in your report and wait for confirmation before applying.

---

## Step 2 — Implement `_embed_page()` in `doc_wiki_synthesis.py`

### 2.1 Replace the stub method

Find `_embed_page()` at line ~335. Replace it with:

```python
def _embed_page(self, page_id: str, content: str) -> None:
    """Embed the synthesized page content and store in ose_knowledge_pages.embedding.

    Uses VectorStore (text-embedding-3-small, vector(1536)) — same model as document_chunks.
    Skips silently on empty content. On embedding failure, logs and returns; the page
    record is already upserted so embedding failure never corrupts page data.
    """
    from .vector_store import VectorStore
    if not content or not content.strip():
        return
    # Defensive truncation: text-embedding-3-small supports ~8191 tokens.
    # Synthesized pages are typically 400-1200 words; truncate only if unusually long.
    words = content.split()
    if len(words) > 6000:
        content = " ".join(words[:6000])
    try:
        store = VectorStore.from_env()
        embedding: list[float] = store.embed_query(content)
        self._supabase.table("ose_knowledge_pages") \
            .update({"embedding": embedding}) \
            .eq("id", page_id) \
            .execute()
    except Exception as exc:  # noqa: BLE001
        # Embedding failure must not corrupt the page; log and continue.
        # Common causes: missing OPENAI_API_KEY, rate limit, network error.
        import logging
        logging.getLogger(__name__).warning(
            "doc_wiki: _embed_page failed for page_id=%s: %s", page_id, exc
        )
```

### 2.2 Update the call site (line ~126–128)

The current call site silently catches `EmbeddingNotImplementedError`. Now that the method
is real, keep it catch-all but add a log:

```python
# Before (current):
try:
    self._embed_page(page_id, output.get("content", ""))
except EmbeddingNotImplementedError:
    pass  # Sub-phase 05 implements; skip silently until then

# After (replace with):
# _embed_page handles its own exceptions internally — no outer try/except needed.
self._embed_page(page_id, output.get("content", ""))
```

Since `_embed_page()` now catches all exceptions internally and logs them, the outer call
does not need a try/except wrapper.

### 2.3 Leave `EmbeddingNotImplementedError`

Do NOT remove the `EmbeddingNotImplementedError` class (line ~54). It may be imported by
tests or other files. The class stays; only the stub method body is replaced.

---

## Step 3 — Create `DocWikiReadService`

Create `python-backend/services/doc_wiki_read_service.py`.

```python
"""Document Wiki Layer 2 — read service (search, get, list).

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
        # store is VectorStore (provides store.client: SupabaseClient)
        self._sb: SupabaseClient = store.client

    # ── Public API ────────────────────────────────────────────────────────────

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
                .select("id, title, content, canonical_key, page_kind, source_type, "
                        "source_file_ids, created_at, updated_at")
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
        finding = {
            "page_id": row["id"],
            "title": row["title"],
            "canonical_key": row["canonical_key"],
            "page_kind": row["page_kind"],
            "source_type": row.get("source_type"),
            "content": row.get("content", ""),
            "source_file_ids": row.get("source_file_ids") or [],
            "created_at": str(row.get("created_at", "")),
            "updated_at": str(row.get("updated_at", "")),
        }
        return {
            "schema_version": "agent_result_v1",
            "summary": f"Retrieved wiki page: {row['title']}",
            "findings": [finding],
            "confidence": 1.0,
            "needs_review": False,
            "reasoning_visibility": "summary_only",
            "source_count": 1,
            "citations": [
                {
                    "source_kind": "wiki_page",
                    "canonical_key": row["canonical_key"],
                    "title": row["title"],
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
        """List wiki pages with optional filters. Returns title + metadata (no full content)."""
        try:
            q = (
                self._sb.table("ose_knowledge_pages")
                .select("id, title, canonical_key, page_kind, source_type, updated_at")
                .eq("user_id", user_id)
                .order("updated_at", desc=True)
                .limit(max(1, min(limit, 100)))
            )
            if page_kinds:
                q = q.in_("page_kind", page_kinds)
            if source_type:
                q = q.eq("source_type", source_type)
            response = q.execute()
        except Exception as exc:
            raise DocWikiReadError(f"Page list failed: {exc}") from exc

        rows = response.data or []
        findings = [
            {
                "page_id": row["id"],
                "title": row["title"],
                "canonical_key": row["canonical_key"],
                "page_kind": row["page_kind"],
                "source_type": row.get("source_type"),
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
```

---

## Step 4 — Implement `_handle_per_user_document_wiki()` in `sub_agent_orchestrator.py`

### 4.1 Add import

At the top of `sub_agent_orchestrator.py`, near the other service imports, add:

```python
from .doc_wiki_read_service import DocWikiReadService, DocWikiReadError
```

### 4.2 Replace the stub

Find `_handle_per_user_document_wiki()` (~line 408). Replace the entire method body:

```python
def _handle_per_user_document_wiki(self, context: AgentContextBundle) -> dict[str, Any]:
    tool = str(context.context_scope.get("docwiki_tool") or "").strip()
    reader = DocWikiReadService(self.store)
    try:
        # Fallback inference from other scope keys when docwiki_tool is not set
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
```

---

## Step 5 — Add direct API endpoints to `main.py`

Find the existing doc-wiki endpoints (search for `"/api/doc-wiki/synthesize-document"`).
Append these three endpoints after the existing doc-wiki block.

### 5.1 New Pydantic model

```python
class DocWikiSearchRequest(BaseModel):
    user_id: str
    query: str
    page_kinds: list[str] | None = None
    limit: int = 8
```

### 5.2 New endpoints

```python
@app.post("/api/doc-wiki/search")
async def doc_wiki_search(payload: DocWikiSearchRequest):
    from services.doc_wiki_read_service import DocWikiReadService, DocWikiReadError
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


@app.get("/api/doc-wiki/page/{user_id}/{canonical_key}")
async def doc_wiki_get_page(user_id: str, canonical_key: str):
    from services.doc_wiki_read_service import DocWikiReadService, DocWikiReadError
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


@app.get("/api/doc-wiki/pages/{user_id}")
async def doc_wiki_list_pages(
    user_id: str,
    page_kinds: str | None = None,   # comma-separated, e.g. "sprint_history,thread_synthesis"
    source_type: str | None = None,
    limit: int = 20,
):
    from services.doc_wiki_read_service import DocWikiReadService, DocWikiReadError
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
```

---

## Step 6 — Compile check + progress update

```bash
python -m compileall python-backend
```

Fix any errors before reporting done.

**Do not apply the SQL migration** — write it to disk only. Flag in your report whether
the Supabase MCP is available for migration application or if it must be done manually.

Update `Pro-Suite-Progress.md` to mark sub-phase 05 as code-complete (or partial with a
flag if live smoke/RPC application wasn't possible due to env constraints).

---

## Hard constraints

- **Never call OpenAI directly** — always via `VectorStore.from_env().embed_query()`
- **Never use Pinecone** — do not read/write `pinecone_vector_id`
- **Never add DB CHECK constraint on `page_kind`**
- **Do not change `vector_store.py`** — it is read-only for this sub-phase
- **Do not change the `vector(1536)` column type** — it is locked
- **`DocWikiReadService` must not inherit from any adapter or synthesis class**
- **Dispatch key is `docwiki_tool`** — not `wiki_tool` (that's Layer 1)
- **No new migrations that alter existing tables** — the `match_ose_knowledge_pages` RPC
  is the only DB change; it is additive (new function only)

---

## Done-when report

When complete, report back with:

1. Files created/modified (with line counts for new files)
2. All 19 success criteria from `05-RESEARCH.md §9` — checked or flagged
3. `compileall` output
4. Whether the migration was written only (expected) or also applied (flag for London)
5. Any deviations from the research spec, with rationale
6. Whether a live smoke test was possible (it likely isn't — same env constraint as 03/04)
