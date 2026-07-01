# Sub-phase 05 — Research: pgvector Page Embeddings + Semantic Search

**Verify-pass date:** 2026-06-30  
**Verified by:** Orchestration agent  
**Status:** Complete — ready for execution

---

## 1. Embedding Model Decision

### 1.1 Decision: Reuse `text-embedding-3-small` via `VectorStore`

**Do not introduce a new embedding provider.** Use the OpenAI `text-embedding-3-small`
embedding path already present in `python-backend/services/vector_store.py`.

**Evidence:**
- `ose_knowledge_pages.embedding` column is `vector(1536)` — set in sub-phase 02 migration
  (`docs/migrations/20260630_docwiki_schema.sql`) to match `document_chunks.embedding`
- `VectorStore._embed_texts()` (line 357) uses `openai.embeddings.create(model=self.settings.embedding_model)`
- `Settings.embedding_model` defaults to `"text-embedding-3-small"` (`core/config.py` line 29)
- `Settings.embedding_batch_size` defaults to `64` (`core/config.py` line 42)
- `VectorStore.embed_query()` (line 269) is a public method that calls `_embed_texts([query])[0]`
- `match_document_chunks` RPC uses `vector(1536)` cosine similarity — same dimension as pages
- HNSW index on `ose_knowledge_pages.embedding` uses `vector_cosine_ops` — matches OpenAI embedding geometry

**Why not Voyage AI?**
- Would require a new `VOYAGE_API_KEY` env var, a new client dependency, a new Python package
- `vector(1536)` would need to change to `vector(1024)` — breaking migration required
- All existing `document_chunks` embeddings are OpenAI; mixing models breaks cross-type recall
- No Voyage AI configuration exists anywhere in the codebase or environment

**Why CLAUDE.md's "openai is dead code" does NOT apply here:**
- CLAUDE.md says the `openai` **npm package** is dead code (JavaScript/frontend side)
- The Python `openai` package in `vector_store.py` is the live, in-use embedding infrastructure
- All `document_chunks` in production use it; removing it would break existing search

---

## 2. `_embed_page()` Implementation

### 2.1 Current state

`doc_wiki_synthesis.py` line 335:
```python
def _embed_page(self, page_id: str, content: str) -> None:
    """Stub - raises EmbeddingNotImplementedError. Sub-phase 05 implements."""
    raise EmbeddingNotImplementedError("Embedding not yet implemented (sub-phase 05)")
```

Called at line 126:
```python
try:
    self._embed_page(page_id, output.get("content", ""))
except EmbeddingNotImplementedError:
    pass  # Sub-phase 05 implements; skip silently until then
```

### 2.2 Implementation spec

```python
def _embed_page(self, page_id: str, content: str) -> None:
    """Embed the synthesized page content and store in ose_knowledge_pages.embedding."""
    from .vector_store import VectorStore
    if not content or not content.strip():
        return  # Nothing to embed; leave embedding NULL
    store = VectorStore.from_env()
    embedding: list[float] = store.embed_query(content)
    self._supabase.table("ose_knowledge_pages") \
        .update({"embedding": embedding}) \
        .eq("id", page_id) \
        .execute()
```

**Notes:**
- Lazy import of `VectorStore` inside the method body (same pattern as adapter lazy imports in `main.py`)
- `embed_query()` is the public entry point — it calls `_embed_texts([content])[0]` internally
- `embed_query()` requires `OPENAI_API_KEY` in env; if missing, `VectorStore.from_env()` raises
  `VectorStoreError` — this bubbles up and is caught by the caller's outer `except Exception: pass`
  (line 127 of the synthesis flow), so a missing API key silently skips embedding without
  corrupting the page record
- Remove the `EmbeddingNotImplementedError` catch block at line 127 and replace with a general
  `except Exception` catch that logs the error — embedding failures should be observable, not silent
- Keep the `EmbeddingNotImplementedError` class definition in case it's imported elsewhere;
  the stub method is replaced, not the class
- Max content length for `embed_query`: `text-embedding-3-small` supports up to 8191 tokens.
  Synthesized pages are typically 400–1200 words. No truncation needed for normal pages.
  If content exceeds ~6000 words, truncate to first 6000 words before embedding (defensive only).

---

## 3. `match_ose_knowledge_pages` Supabase RPC

### 3.1 Confirmed missing

No `match_ose_knowledge_pages` function exists in any migration file. The
`20260630_docwiki_schema.sql` migration added only the `embedding` column and HNSW index.
A new migration must create this RPC.

### 3.2 Design decision: pure cosine similarity (no hybrid BM25)

`match_document_chunks` uses a hybrid RRF (cosine + BM25) search. Pages do NOT need hybrid.

**Why:**
- Synthesized pages are semantically dense, well-structured prose — ideal for pure vector search
- Pages do not have a `content_tsv` tsvector column; adding one would require maintaining a trigger
- The BM25 fallback in `match_document_chunks` exists because raw document chunks can be
  short/terse and keyword-heavy; synthesized pages are the opposite
- Simple cosine similarity keeps the RPC maintainable and fast

### 3.3 RPC specification

**File:** `docs/migrations/20260630_docwiki_page_search.sql`

```sql
create or replace function public.match_ose_knowledge_pages(
  query_embedding   vector(1536),
  match_count       integer         default 8,
  target_user_id    uuid            default auth.uid(),
  match_threshold   double precision default 0.65,
  filter_page_kinds text[]          default null
)
returns table (
  page_id        uuid,
  title          text,
  content        text,
  canonical_key  text,
  page_kind      text,
  source_type    text,
  source_file_ids jsonb,
  created_at     timestamptz,
  updated_at     timestamptz,
  similarity     double precision
)
language sql
stable
as $$
  select
    p.id            as page_id,
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

**Parameter notes:**
- `match_threshold` default `0.65`: cosine similarity ≥ 0.65 (1 - cosine distance ≤ 0.35).
  Calibrated for `text-embedding-3-small`; lower than `match_document_chunks` default
  because page content is longer and more semantically spread.
- `filter_page_kinds`: optional `text[]` to restrict search to specific page kinds
  (e.g., `['sprint_history', 'capability_evolution']` for execution-context queries)
- `embedding <=>` is cosine distance operator (requires `vector_cosine_ops` index, already built)

---

## 4. `DocWikiReadService`

### 4.1 Purpose

A new service class modeled on `WikiReadService` (Layer 1). Encapsulates the three
docwiki read operations called by `sub_agent_orchestrator._handle_per_user_document_wiki()`.

**File:** `python-backend/services/doc_wiki_read_service.py`

### 4.2 Method specs

#### `search(user_id, query, page_kinds=None, limit=8)`

1. Embed the query: `VectorStore.from_env().embed_query(query)` → `list[float]`
2. Call `match_ose_knowledge_pages` RPC via `supabase.rpc(...)`
3. Return structured result with `findings` list + `citations` + `summary`

Return shape:
```python
{
    "schema_version": "agent_result_v1",
    "summary": "Found N wiki pages matching query.",
    "findings": [
        {
            "page_id": str,
            "title": str,
            "canonical_key": str,
            "page_kind": str,
            "source_type": str,
            "similarity": float,
            "excerpt": str,  # first 400 chars of content
        },
        ...
    ],
    "confidence": float,       # mean similarity of top results
    "needs_review": False,
    "reasoning_visibility": "summary_only",
    "source_count": int,
    "citations": [...]          # same items as findings, in citation format
}
```

#### `get_page(user_id, canonical_key=None, page_id=None)`

Direct table fetch by `canonical_key` (preferred) or `page_id`.

Return shape: same `agent_result_v1` envelope, `findings` = list of one page (full content).

Raises `DocWikiReadError` if the page is not found.

#### `list_pages(user_id, page_kinds=None, source_type=None, limit=20)`

Table query with optional filters. Ordered by `updated_at DESC`.

Return shape: same `agent_result_v1` envelope, `findings` = list of pages (title + canonical_key
+ page_kind + source_type + updated_at; no full content to keep payload small).

### 4.3 Error class

```python
class DocWikiReadError(Exception):
    """Raised when a doc wiki read operation fails."""
```

---

## 5. `_handle_per_user_document_wiki()` Dispatch

### 5.1 Current state (stub to replace)

```python
def _handle_per_user_document_wiki(self, context: AgentContextBundle) -> dict[str, Any]:
    return {
        "result_summary": "Document wiki synthesis engine not yet built (sub-phase 03).",
        ...
        "status": "not_implemented",
        ...
    }
```

### 5.2 Dispatch pattern (mirrors `_handle_per_user_wiki`)

```python
def _handle_per_user_document_wiki(self, context: AgentContextBundle) -> dict[str, Any]:
    tool = str(context.context_scope.get("docwiki_tool") or "").strip()
    reader = DocWikiReadService(self.store)
    try:
        # Fallback inference from scope keys
        if not tool:
            if context.context_scope.get("docwiki_query"):
                tool = "docwiki_search"
            elif context.context_scope.get("canonical_key") or context.context_scope.get("page_id"):
                tool = "docwiki_get_page"
            else:
                tool = "docwiki_list"

        if tool == "docwiki_search":
            result = reader.search(
                context.user_id,
                str(context.context_scope.get("docwiki_query") or context.task_summary),
                page_kinds=context.context_scope.get("page_kinds"),
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
                page_kinds=context.context_scope.get("page_kinds"),
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

**Import to add at top of `sub_agent_orchestrator.py`:**
```python
from .doc_wiki_read_service import DocWikiReadService, DocWikiReadError
```

---

## 6. Direct API Endpoints

Add to `main.py` for testing and direct programmatic access (outside the sub-agent orchestrator path).

### 6.1 Search endpoint

```
POST /api/doc-wiki/search
Body: { "user_id": str, "query": str, "page_kinds": list[str] | null, "limit": int }
Returns: { "status": "ok", "results": [...] }
```

### 6.2 Get page endpoint

```
GET /api/doc-wiki/page/{user_id}/{canonical_key}
Returns: { "status": "ok", "page": {...} }
```

### 6.3 List pages endpoint

```
GET /api/doc-wiki/pages/{user_id}
Query params: page_kinds (comma-separated), source_type, limit
Returns: { "status": "ok", "pages": [...] }
```

---

## 7. Hard Rules

1. **Never call OpenAI directly** — always via `VectorStore.from_env().embed_query()`
2. **Never use Pinecone** — `pinecone_vector_id` is deprecated; do not read or write it
3. **Never add a DB CHECK constraint on `page_kind`** — the vocabulary lives in `doc_wiki_schema.json`
4. **`_embed_page()` failure must not corrupt the page** — the page record is already upserted;
   embedding is a post-write enhancement; any exception must be caught and logged, not raised
5. **`match_ose_knowledge_pages` requires `embedding IS NOT NULL`** — pages synthesized before
   sub-phase 05 ships have `NULL` embeddings; the RPC must exclude them (already in the WHERE clause)
6. **No new migration that alters `ose_knowledge_pages` column types** — `vector(1536)` is locked
7. **The dispatch key is `docwiki_tool`** — not `wiki_tool` (that's Layer 1)
8. **`DocWikiReadService` must NOT inherit from any adapter** — it is a read-only service, parallel
   to `WikiReadService`, not an adapter

---

## 8. Files Touched

| File | Action | Notes |
|---|---|---|
| `docs/migrations/20260630_docwiki_page_search.sql` | CREATE | New migration: `match_ose_knowledge_pages` RPC |
| `python-backend/services/doc_wiki_synthesis.py` | MODIFY | Implement `_embed_page()`; update error handling |
| `python-backend/services/doc_wiki_read_service.py` | CREATE | `DocWikiReadService` + `DocWikiReadError` |
| `python-backend/services/sub_agent_orchestrator.py` | MODIFY | Replace `_handle_per_user_document_wiki()` stub |
| `python-backend/main.py` | MODIFY | Add three direct API endpoints |

---

## 9. Success Criteria (19 checks)

| # | Criterion |
|---|---|
| 1 | `_embed_page()` calls `VectorStore.from_env().embed_query(content)` |
| 2 | `_embed_page()` writes embedding to `ose_knowledge_pages.embedding` via Supabase update |
| 3 | `_embed_page()` returns silently on empty content (does not write NULL embedding) |
| 4 | `_embed_page()` failure (missing API key, network) does not raise — exception caught and logged |
| 5 | `EmbeddingNotImplementedError` catch removed; replaced with general except + log |
| 6 | `match_ose_knowledge_pages` RPC created in new migration file |
| 7 | RPC filters `embedding IS NOT NULL` (excludes pre-05 pages) |
| 8 | RPC accepts optional `filter_page_kinds text[]` |
| 9 | RPC grants execute to `authenticated` and `service_role` |
| 10 | `DocWikiReadService` class created with `search()`, `get_page()`, `list_pages()` |
| 11 | `DocWikiReadError` exception class present |
| 12 | `search()` embeds query via `VectorStore.from_env().embed_query()` |
| 13 | `search()` calls `match_ose_knowledge_pages` RPC (not raw table scan) |
| 14 | `get_page()` accepts either `canonical_key` or `page_id`; raises `DocWikiReadError` if not found |
| 15 | `list_pages()` accepts optional `page_kinds` and `source_type` filters |
| 16 | `_handle_per_user_document_wiki()` dispatches on `docwiki_tool` scope key |
| 17 | Fallback inference works: `docwiki_query` → search; `canonical_key/page_id` → get_page; else → list |
| 18 | Three direct API endpoints in `main.py` (search, get page, list pages) |
| 19 | `python -m compileall python-backend` exits 0 |
