# Agentic RAG Module 6: Hybrid Search and Reranking

This plan upgrades ArchitectOS Pro retrieval from weighted vector/keyword blending to an explicit hybrid retrieval pipeline: vector candidates, keyword candidates, metadata filtering, Reciprocal Rank Fusion (RRF), and optional Cohere reranking.

## Current Gate Context

Modules 2-5 are in scaffold-first sequencing:

- Module 2 created the vector/chunk/retrieval substrate, but full embedding/chunk/retrieval smoke remains OpenAI quota-gated.
- Module 4 added metadata filters and verified retrieval RPC behavior with and without metadata filters.
- Module 5 Docling multi-format ingestion is planned/running concurrently and may improve chunk structure and parser metadata.

The current `match_document_chunks` function is hybrid-like but uses weighted score blending of vector similarity and keyword rank. Module 6 should make hybrid search the default through separate candidate sets plus RRF. It should preserve backward compatibility for existing callers.

## Locked Decisions

> [!NOTE]
> **Hybrid Default**
> Hybrid retrieval becomes the default retrieval behavior. Existing callers should keep working without changing their function signatures.

> [!NOTE]
> **RRF Fusion**
> Use Reciprocal Rank Fusion as the default first-stage fusion strategy instead of weighted score blending.

> [!NOTE]
> **Cohere Optional Rerank**
> Cohere reranking is optional and configuration-gated. If `COHERE_API_KEY` is missing or rerank is disabled, retrieval should return RRF-fused results normally.

> [!NOTE]
> **Raw Chunks First, Wiki Later**
> Module 6 should prepare for future Wiki search, but should not merge `ose_knowledge_pages` retrieval into the live path yet. Use response/source shapes that can support `wiki_page` later.

## Architecture Constraints

- Raw files remain in `raw-documents`.
- Synthesized Wiki artifacts remain in `kb-files` and `public.ose_knowledge_pages`.
- Raw upload metadata remains in `public.ose_raw_document_registry`.
- Searchable raw document chunks remain in `public.document_chunks`.
- Embeddings remain OpenAI `text-embedding-3-small` with `vector(1536)`.
- Metadata filters from Module 4 remain supported.
- Virtual CSO chat remains Claude Sonnet through Vercel serverless and canonical `vcso_*` tables.
- Batch/scheduled synthesis remains N8N.
- Cohere is only a reranking provider, not the chat model and not the embedding model.
- User isolation is mandatory for every retrieval stage.

## Proposed Changes

### [Supabase Schema]

#### [NEW] `docs/migrations/007_hybrid_search_reranking.sql`

Update or replace `public.match_document_chunks` while preserving backward compatibility.

Requirements:

- Keep current callable argument compatibility:
  - `query_embedding vector(1536)`
  - `query_text text default null`
  - `match_count integer default 8`
  - `target_user_id uuid default auth.uid()`
  - existing weight args should not break callers, even if no longer primary
  - `metadata_filter jsonb default '{}'::jsonb`
- Add optional args only if they are backward compatible, such as:
  - `candidate_count integer default 40`
  - `rrf_k integer default 60`
- Generate separate candidate sets:
  - vector candidates ordered by cosine distance/similarity
  - keyword candidates ordered by full-text rank
- Apply metadata filters before ranking/fusion.
- Fuse results with RRF:
  - score contribution: `1 / (rrf_k + rank)` for each source list
  - include both vector and keyword contributions when a chunk appears in both
- Return fields compatible with current consumers:
  - `chunk_id`
  - `document_id`
  - `content`
  - `metadata`
  - `vector_similarity`
  - `keyword_rank`
  - `hybrid_score`
- Add additional fields only if safe and useful, such as:
  - `source_kind text default 'raw_document_chunk'`
  - `vector_rank integer`
  - `keyword_rank_position integer`
  - `rrf_score double precision`

Index checks:

- Confirm HNSW/vector index on `document_chunks.embedding`.
- Confirm GIN index on `document_chunks.content_tsv`.
- Confirm GIN index on `document_chunks.metadata` for metadata filters.
- Confirm user/document indexes remain present.

Do not add Wiki retrieval in this migration except optional future-safe source-kind fields/comments.

### [Platform Settings]

Extend `ai_models` and `platform_ai_settings` from Module 4:

- Seed/update Cohere rerank model row, e.g. provider `cohere`, model name from env/default.
- Add `platform_ai_settings.setting_key = 'retrieval_reranker'`.
- Add settings JSON defaults:
  - `enabled: false`
  - `top_n`
  - `candidate_count`
  - `timeout_seconds`

Use env fallback if settings table is unavailable.

### [Python Configuration]

#### [MODIFY] `python-backend/core/config.py`

Add placeholders:

- `COHERE_API_KEY`
- `COHERE_RERANK_MODEL`, default to current recommended Cohere rerank model after docs verification
- `ARCHITECTOS_RERANK_ENABLED`, default false
- `ARCHITECTOS_RERANK_TOP_N`, default equal to match_count or 8
- `ARCHITECTOS_RETRIEVAL_CANDIDATE_COUNT`, default 40
- `ARCHITECTOS_RRF_K`, default 60
- optional `ARCHITECTOS_RERANK_TIMEOUT_SECONDS`

### [Python Retrieval Pipeline]

#### [MODIFY] `python-backend/services/retrieval.py`

Refactor `RetrievalService.hybrid_search` while preserving the public method signature.

Add behavior:

1. Generate query embedding as today.
2. Call `match_document_chunks` using larger `candidate_count`.
3. Receive RRF-fused raw candidates.
4. Optionally rerank candidates with Cohere when enabled and key is present.
5. Return the same `RetrievedChunk` shape, optionally extended with rerank fields.

Add or update dataclass fields carefully:

- preserve existing fields used by callers
- optional `source_kind`
- optional `rrf_score`
- optional `rerank_score`
- optional `retrieval_stage`

### [Cohere Reranking Service]

#### [NEW] `python-backend/services/reranker.py`

Create a small Cohere reranker wrapper:

- No call if disabled or no API key.
- Load model from `platform_ai_settings` key `retrieval_reranker` with env fallback.
- Accept query + candidate chunks.
- Serialize each candidate with high-signal content and metadata:
  - content
  - document title/type/domain/time period when present
  - parser/source metadata when useful
- Call Cohere rerank API.
- Reorder candidates based on returned indexes and relevance scores.
- Preserve original candidate data and attach `rerank_score`.
- Fail open: if Cohere errors, log/report warning and return RRF-fused candidates rather than failing retrieval entirely.

Do not use Cohere for embeddings or chat.

### [API Compatibility]

#### [MODIFY] `python-backend/main.py`

Keep `/api/retrieve` backward compatible:

- Existing request shape still works.
- Optional request fields may be added:
  - `metadata_filter`
  - `rerank_enabled`
  - `candidate_count`
- Existing response fields remain present.

### [Settings / Env Placeholder]

Add placeholder env documentation if this repo has an `.env.example` or similar. Do not write secrets.

Expected placeholders:

```text
COHERE_API_KEY=
COHERE_RERANK_MODEL=rerank-v4.0-pro
ARCHITECTOS_RERANK_ENABLED=false
ARCHITECTOS_RERANK_TOP_N=8
ARCHITECTOS_RETRIEVAL_CANDIDATE_COUNT=40
ARCHITECTOS_RRF_K=60
```

If the current Cohere docs recommend a different default model, use the current documented value and note it.

### [Future Wiki Search Preparation]

Do not implement Wiki retrieval in Module 6, but prepare the interface:

- Include `source_kind` in internal retrieval result shape when safe.
- Keep raw chunks as `raw_document_chunk`.
- Leave future `wiki_page` retrieval for a later module/feature.
- Do not query `ose_knowledge_pages` in the default path yet.

## Verification Plan

### Documentation Verification

- Verify current Cohere rerank API/model docs before implementation.
- Confirm selected default rerank model and SDK/API call shape.

### Code Verification

- Run `python -m compileall python-backend`.
- Run `npm.cmd run build` only if TypeScript/API types are changed.
- Add focused tests or scripts for RRF ordering using synthetic candidates if practical.

### Live Supabase Verification

- Apply/verify `007_hybrid_search_reranking.sql`.
- Confirm only one live `match_document_chunks` overload remains if ambiguity has happened before.
- Confirm function works with old/default args.
- Confirm function works with metadata filters.
- Confirm user scoping remains mandatory and effective.
- Confirm relevant indexes exist.

### Functional Retrieval Smoke

OpenAI query embeddings are quota-gated. If quota remains blocked:

- Test SQL RRF behavior with synthetic/null embeddings or existing seeded chunks if possible.
- Verify function shape and metadata filters without requiring live OpenAI calls.
- Report embedding-dependent smoke separately.

If OpenAI quota is restored:

1. Run retrieval without metadata filters.
2. Run retrieval with metadata filters.
3. Confirm vector-only relevant candidates and keyword-only exact-match candidates can both surface.
4. Confirm RRF changes ranking compared with simple weighted blend where expected.
5. Confirm `/api/retrieve` remains backward compatible.

If Cohere API key is available:

1. Enable rerank with a small candidate set.
2. Confirm Cohere rerank reorders or annotates candidates.
3. Confirm no Cohere key/disabled setting returns normal RRF candidates.
4. Confirm Cohere failure does not fail the entire retrieval request.

## Completion Criteria

Module 6 can be considered implemented when:

- Plan and migration artifacts exist.
- `match_document_chunks` uses explicit vector candidates + keyword candidates + RRF fusion.
- Existing callers remain backward compatible.
- Metadata filters still work.
- Python retrieval defaults to hybrid/RRF.
- Cohere reranking is available behind config/env and fails open.
- Platform settings include retrieval reranker config.
- Env placeholders are added without secrets.
- Retrieval result shape is future-safe for Wiki sources without querying Wiki pages yet.
- `Pro-Suite-Progress.md` is updated with separate status for code, migration, live schema, RRF smoke, Cohere smoke, and remaining OpenAI/Cohere key blockers.
