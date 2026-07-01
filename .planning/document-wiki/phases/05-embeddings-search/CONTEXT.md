# Sub-phase 05 — Context: pgvector Page Embeddings + Semantic Search

**Sub-phase:** 05  
**Status:** Ready for execution  
**Prereqs:** Sub-phases 02 (migration live), 03 (synthesis engine), 04 (adapters) complete

---

## Inputs

| Input | Source | Verified |
|---|---|---|
| `ose_knowledge_pages.embedding` column (`vector(1536)`) | `20260630_docwiki_schema.sql` | ✅ |
| HNSW index on `embedding` (`vector_cosine_ops`) | `20260630_docwiki_schema.sql` | ✅ |
| `_embed_page()` stub in `doc_wiki_synthesis.py` | Line 335 | ✅ |
| `VectorStore.embed_query()` public method | `vector_store.py` line 269 | ✅ |
| `text-embedding-3-small` → `vector(1536)` in `Settings` | `core/config.py` line 29 | ✅ |
| `per_user_document_wiki` capability with 3 allowed_tools | `agent_capabilities` table (migration) | ✅ |
| `_handle_per_user_document_wiki()` stub in orchestrator | `sub_agent_orchestrator.py` line 408 | ✅ |
| No `match_ose_knowledge_pages` RPC exists | Verified across all migration files | ✅ |

---

## Scope

Sub-phase 05 implements page-level embedding and semantic search. Specifically:

1. **`_embed_page()` implementation** — replace stub; use `VectorStore.embed_query()` to embed
   synthesized page content and write to `ose_knowledge_pages.embedding`

2. **Migration: `match_ose_knowledge_pages` RPC** — pure cosine similarity search over
   `ose_knowledge_pages`; replaces the not-yet-existing RPC that the search tools need

3. **`DocWikiReadService`** — new service class (`doc_wiki_read_service.py`) with three methods:
   `search()`, `get_page()`, `list_pages()`. Analogous to `WikiReadService` for Layer 1.

4. **`_handle_per_user_document_wiki()` implementation** — replace `not_implemented` stub in
   `sub_agent_orchestrator.py` with real dispatch to `DocWikiReadService`

5. **Direct API endpoints** — add `POST /api/doc-wiki/search`, `GET /api/doc-wiki/page/{...}`,
   `GET /api/doc-wiki/pages/{...}` to `main.py` for testing/direct access

---

## Out of Scope

- Hybrid BM25 search for pages (not needed — see §3.2 of 05-RESEARCH.md)
- Batch re-embedding of pre-05 pages (pages with NULL embeddings are excluded from search until
  re-synthesized; a backfill script can be added in sub-phase 07 if needed)
- Embedding observability / cost tracking (future)
- Frontend wiring of the docwiki search UI (connection phase, post-Layer-2)

---

## Success Criteria

19 checks — see `05-RESEARCH.md §9`. All 19 must pass before reporting complete.

---

## Files

| File | Action |
|---|---|
| `docs/migrations/20260630_docwiki_page_search.sql` | CREATE |
| `python-backend/services/doc_wiki_synthesis.py` | MODIFY |
| `python-backend/services/doc_wiki_read_service.py` | CREATE |
| `python-backend/services/sub_agent_orchestrator.py` | MODIFY |
| `python-backend/main.py` | MODIFY |
