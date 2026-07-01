# Agentic RAG Module 3: Record Manager

This plan adds record-management behavior to the ArchitectOS Pro ingestion pipeline. Module 3 should prevent naive duplicate ingestion, preserve incremental processing semantics, and prepare the system for future document versioning without changing the locked storage architecture.

## Current Gate Context

Module 2 is functionally wired but not fully verified complete. A live smoke test proved:

- FastAPI `/api/health` works locally.
- `raw-documents` and `kb-files` exist separately and are private.
- `ose_raw_document_registry`, `document_chunks`, and `match_document_chunks` exist live.
- `document_chunks.embedding` is `vector(1536)`.
- A real raw file was uploaded to `raw-documents` using the user-first path convention.
- A matching `ose_raw_document_registry` row was created.
- `/api/ingest` moved the row from `uploaded` to `processing` and then recorded a failure cleanly.

The smoke test did not prove chunk insertion or retrieval because OpenAI returned an `insufficient_quota` error for `text-embedding-3-small`. This is a billing/quota blocker, not a Module 2 architecture failure. Module 3 can proceed for pre-embedding record-management logic, but final verification must note that embedding-dependent flows remain blocked until billing is updated.

## Locked Decisions

> [!NOTE]
> **Duplicate Policy**
> Exact duplicate uploads should be accepted into the registry but skipped for ingestion. The new row should point to the existing user-owned source document through duplicate metadata/status, rather than rejecting the upload or creating duplicate chunks.

> [!NOTE]
> **No Bucket Collapse**
> Raw founder uploads stay in `raw-documents`. Synthesized Wiki artifacts stay in `kb-files`. Module 3 must not merge these storage layers.

> [!NOTE]
> **Pre-Embedding First**
> Module 3 should compute and compare content hashes before calling OpenAI embeddings. This keeps duplicate detection cheap and avoids quota spend for files already known to be unchanged.

## Architecture Constraints

- Raw files remain in Supabase Storage bucket `raw-documents`.
- Raw upload metadata remains in `public.ose_raw_document_registry`.
- Searchable chunks remain in `public.document_chunks`.
- Embeddings remain OpenAI `text-embedding-3-small` with `vector(1536)`.
- Hybrid retrieval remains `public.match_document_chunks`.
- Synthesized Wiki artifacts remain in `kb-files` and `public.ose_knowledge_pages`.
- Virtual CSO chat remains Claude Sonnet through Vercel serverless and canonical `vcso_*` tables.
- Batch/scheduled synthesis remains N8N.
- Founder/user isolation is mandatory for every lookup, hash comparison, duplicate link, and chunk operation.

## Proposed Changes

### [Supabase Schema]

#### [NEW] `docs/migrations/004_record_manager.sql`

Add or confirm fields on `public.ose_raw_document_registry` for record-management state:

- `content_hash text`
- `hash_algorithm text not null default 'sha256'`
- `duplicate_of_document_id uuid null references public.ose_raw_document_registry(id)`
- `record_state text not null default 'active'`
- `source_version integer not null default 1`
- `supersedes_document_id uuid null references public.ose_raw_document_registry(id)`
- `last_hash_checked_at timestamptz`

Add constraints/indexes:

- `record_state` allowed values: `active`, `duplicate`, `superseded`, `deleted`
- user-scoped unique active hash index, likely partial: `(user_id, content_hash)` where `record_state = 'active'` and `content_hash is not null`
- index on `(user_id, duplicate_of_document_id)`
- index on `(user_id, supersedes_document_id)`

RLS must continue to require user ownership. Do not use a cross-user hash lookup.

### [Frontend React SPA]

#### [MODIFY] `lib/osEngineApi.ts`

- Compute a SHA-256 hash in the browser before upload when feasible using `crypto.subtle.digest`.
- Before uploading bytes, query `ose_raw_document_registry` for an existing row with the same `user_id`, `content_hash`, and active/non-deleted state.
- If an exact duplicate exists:
  - create a new registry row with `record_state = 'duplicate'`, `status = 'duplicate'`, `content_hash`, and `duplicate_of_document_id` pointing to the existing document.
  - do not upload the raw file again if the existing raw file remains available.
  - do not queue ingestion.
- If no duplicate exists:
  - upload to `raw-documents` as today.
  - insert registry row with `record_state = 'active'`, `content_hash`, and `hash_algorithm = 'sha256'`.
  - queue ingestion as today.

If browser hashing is not viable for a file type/size, fall back to backend hash computation, but keep duplicate detection before embedding.

#### [MODIFY] Uploads UI status handling

- Display duplicate records with a clear non-error status, reusing the current status-pill system.
- Avoid exposing internal terms like `record manager` in founder-facing copy.
- Keep the existing OS Engine Uploads layout additive; no visual rewrite.

### [Python Ingestion Backend]

#### [MODIFY] `python-backend/services/vector_store.py`

- Before processing a document, reload the registry row by `(id, user_id)`.
- If `record_state = 'duplicate'` or `status = 'duplicate'`, skip extraction, embedding, and chunk writes.
- If a content hash exists, confirm it against downloaded bytes where practical before expensive processing.
- Preserve `mark_failed` behavior for real processing failures.

#### [MODIFY] `python-backend/main.py`

- Keep `/api/ingest` behavior compatible with existing callers.
- Ensure duplicate rows return a success/skip response rather than a failure.
- Do not call OpenAI embeddings for exact duplicates.

### [Document Replacement / Incremental Update Behavior]

This module should not build full visible version history yet. It should prepare the data model for it.

For now:

- exact same file content = create duplicate registry row, skip ingestion.
- same filename but different content = treat as a new active document and ingest normally.
- deleting a duplicate row should not delete the original raw file.
- deleting an active source document should preserve existing current behavior unless the execution agent confirms safe cascade behavior for its chunks.

Future versioning can later use `source_version` and `supersedes_document_id` for explicit replace flows.

## Verification Plan

### Code Verification

- Run focused TypeScript checks or production build if the repo's known unrelated TypeScript debt permits it.
- Run Python syntax checks for changed backend files.
- Add small unit-style checks where practical for hashing/duplicate helper logic.

### Live Supabase Verification

- Confirm the live schema has the new record-management columns, constraints, indexes, and RLS policies.
- Confirm duplicate lookup is user-scoped.
- Confirm User A cannot detect or reference User B's matching content hash.

### Functional Smoke Tests

Use a small test file that does not require OpenAI embeddings to prove duplicate skip behavior.

1. Upload or stage a first test file for a test user.
2. Confirm registry row has `record_state = 'active'`, `content_hash`, `hash_algorithm = 'sha256'`, and no duplicate pointer.
3. Upload the exact same file again for the same user.
4. Confirm second registry row has `record_state = 'duplicate'`, `status = 'duplicate'`, same `content_hash`, and `duplicate_of_document_id` pointing to the first row.
5. Confirm second upload does not create another storage object when the original object exists.
6. Confirm second upload does not call `/api/ingest` or, if called directly, the backend skips before extraction/embedding.
7. Confirm `document_chunks` is not duplicated for the duplicate row.
8. Upload a same-named file with changed content.
9. Confirm it becomes a new active registry row and is eligible for ingestion.

### OpenAI Quota Caveat

If OpenAI billing/quota is still blocked, do not mark embedding-dependent verification complete. It is acceptable to mark Module 3 duplicate detection as verified if the duplicate path is proven to skip before embeddings and the changed-content path reaches the expected ingestion handoff.

## Completion Criteria

Module 3 can be considered implemented when:

- Plan and migration artifacts exist.
- Live Supabase schema is applied and verified.
- Duplicate file detection works per user.
- Exact duplicate uploads create duplicate registry rows and skip ingestion.
- Changed content remains eligible for ingestion.
- Founder-facing Uploads UI handles duplicate status cleanly.
- `Pro-Suite-Progress.md` is updated with separate status for:
  - code artifact created
  - migration artifact created
  - live Supabase applied
  - duplicate smoke tested
  - embedding-dependent ingest/retrieval still blocked or verified
