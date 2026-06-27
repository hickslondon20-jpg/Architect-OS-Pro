# Ep1 Module 2 - Ingestion & Vector Pipeline Task List

## Source Documents Read
- `Pro-Suite-Progress.md`
- `docs/plans/plan-ep1-m2-vector-pipeline.md`
- Existing FastAPI scaffold under `python-backend/`
- Existing OS Engine upload/status wiring

## Locked Constraints
- OpenAI `text-embedding-3-small` is the embedding model.
- Claude Sonnet remains the synthesis/chat model; this pass does not alter chat synthesis routing.
- Processing stays in persistent Python/FastAPI.
- Supabase pgvector remains the vector store.
- Storage must be isolated by user id as the first storage path segment. Raw uploads use `raw-documents`; synthesized Wiki artifacts use `kb-files`.
- Frontend document lists must remain user-scoped and update through Supabase Realtime.

## Execution Plan

### 1. Storage and RLS migration
Status: completed
- Add repair migration `docs/migrations/003_module2_repair_raw_documents_kb_files.sql`.
- Preserve/create the `raw-documents` raw upload bucket.
- Create/secure the `kb-files` synthesized Wiki artifact bucket.
- Add storage object policies keyed to the first folder segment matching `auth.uid()`.
- Align `document_chunks` vector dimension and hybrid match function with `text-embedding-3-small`.
- Add/confirm user-owned RLS policies for documents, chunks, chat threads, and chat messages.

### 2. Backend configuration
Status: completed
- Add `python-backend/core/config.py`.
- Centralize Supabase, bucket, OpenAI, chunking, and CORS config.
- Update requirements for OpenAI embeddings and token-aware chunking.

### 3. Docling extraction and chunking
Status: completed
- Preserve structured Docling markdown extraction.
- Keep CSV row/column preservation.
- Use recursive chunking with token-aware length for approximately 1000-token chunks and 200-token overlap.

### 4. OpenAI embeddings and bulk insert
Status: completed
- Replace local `sentence-transformers` with OpenAI embeddings.
- Batch embedding calls and bulk insert chunk rows into `document_chunks`.
- Update document status through `processing`, `ingested`, or `failed` for Realtime UI updates.

### 5. Retrieval tool
Status: completed
- Add `python-backend/services/retrieval.py`.
- Implement user-scoped hybrid retrieval through the `match_document_chunks` RPC.
- Generate query embeddings with the same OpenAI model.

### 6. Frontend upload alignment
Status: completed
- Upload raw files to the secured `raw-documents` bucket by default.
- Use `{user_id}/{docId}-{filename}` storage paths.
- Keep visible document list scoped by authenticated Supabase/RLS behavior.
- Display final `ingested` status as Complete.

### 7. Verification and progress update
Status: completed
- Run Python syntax checks.
- Run frontend build and report unrelated TypeScript blockers separately if present.
- Update `Pro-Suite-Progress.md` with Module 2 execution notes.






## Verification Results
- Python syntax check passed for `python-backend/main.py`, `core/config.py`, `services/doc_processor.py`, `services/vector_store.py`, and `services/retrieval.py`.
- Frontend production build passed with `npm run build`.
- Repo-wide `tsc --noEmit --pretty false --skipLibCheck` still fails on inherited TypeScript debt in unrelated App, AE Ladder, Growth Velocity, Sprint Planning, and temp skill files; no Module 2 OS Engine files appeared in the reported failures.
- FastAPI health/ingest smoke testing was not run because local backend dependencies are not installed (`fastapi` is missing). Install `python-backend/requirements.txt` before live backend smoke testing.
- Live Supabase repair migration was applied with `003_module2_repair_raw_documents_kb_files.sql`.

## Live Sense Check - 2026-06-26
- Live Supabase project `pwacpjqkntnovndhspxt` was linked and queried read-only.
- Live bucket check shows `raw-documents` exists; `kb_files` does not exist.
- Live table check shows `ose_raw_document_registry`, `vcso_chat_threads`, and `vcso_chat_messages` exist; `document_chunks` does not exist.
- Live function check shows `match_document_chunks` does not exist.
- Migration history does not show local artifacts `001_rag_and_chat_schema.sql` or `002_storage_and_rls.sql` as applied.
- `ose_raw_document_registry` currently has 0 rows.
- Module 2 is therefore not complete in the live Supabase environment until the migrations are applied and storage/RLS/ingest retrieval are smoked end-to-end.

## Repair Pass - 2026-06-26
- Codified the corrected storage model in `docs/intelligence-layer-storage-architecture.md`.
- Corrected frontend raw upload default back to `raw-documents`.
- Corrected backend ingestion default back to `raw-documents`.
- Added and applied `docs/migrations/003_module2_repair_raw_documents_kb_files.sql` to live Supabase project `pwacpjqkntnovndhspxt`.
- Verified live buckets: `raw-documents` and `kb-files` both exist and are private.
- Verified live table/view: `document_chunks` and `documents` now exist.
- Verified live vector dimension: `document_chunks.embedding` is `vector(1536)`.
- Verified live function: `match_document_chunks` exists.
- Verified live RLS policies for `raw-documents`, `kb-files`, and `document_chunks` exist.
- Current `document_chunks` row count is 0 because no backend ingest smoke has run yet.
- Remaining gate: install Python backend dependencies and run a real upload -> ingest -> chunks -> retrieval smoke test.
