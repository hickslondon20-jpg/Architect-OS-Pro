# Agentic RAG Module 4: Metadata Extraction

This plan adds structured metadata extraction to the ArchitectOS Pro ingestion pipeline. Module 4 enriches each non-duplicate upload with document-level metadata, propagates that metadata into chunks, and prepares retrieval to support metadata filtering.

## Current Gate Context

Modules 2 and 3 are soft-locked as working scaffolding:

- Module 2 is functionally wired through raw upload, registry insert, ingestion handoff, status transitions, live schema repair, and failure recording.
- Module 2 chunk insertion and retrieval remain blocked by OpenAI `insufficient_quota` until billing is restored.
- Module 3 code and migration work are implemented, locally verified, and applied live, but isolated duplicate smoke still needs a return pass once live test-user access is unblocked.

Module 4 may proceed as scaffolding because metadata extraction sits after duplicate detection and before embedding/chunk persistence. The execution agent must report OpenAI quota-gated verification separately.

## Locked Decisions

> [!NOTE]
> **Ingestion Enrichment, Not Chat Synthesis**
> Metadata extraction belongs to the Python/FastAPI ingestion backend. It is not Virtual CSO chat synthesis and should not move the chat model boundary.

> [!NOTE]
> **OpenAI for Metadata Extraction**
> Use OpenAI for ingestion-side structured metadata extraction, with a cheaper configurable model by default. This is separate from the embedding model and separate from Claude Sonnet chat.

> [!NOTE]
> **No N8N and No Backfill**
> Module 4 should not use N8N and should not backfill existing test documents. It should apply only to newly ingested, non-duplicate documents from this point forward.

> [!NOTE]
> **Platform Settings Scaffold**
> Add global model/settings/schema tables now, but do not build full admin gating in this module. Settings should be backend-readable and not broadly user-writable. A founder-facing admin/settings UI can be built later.

## Architecture Constraints

- Raw files stay in Supabase Storage bucket `raw-documents`.
- Synthesized Wiki artifacts stay in `kb-files`.
- Raw upload metadata stays in `public.ose_raw_document_registry`.
- Searchable chunks stay in `public.document_chunks`.
- Embeddings remain OpenAI `text-embedding-3-small` with `vector(1536)`.
- Metadata extraction uses a separate configurable OpenAI model, defaulting to a cheaper structured extraction model.
- Retrieval remains `public.match_document_chunks`, extended with optional metadata filters.
- Virtual CSO chat remains Claude Sonnet through Vercel serverless and canonical `vcso_*` tables.
- Batch/scheduled synthesis remains N8N.
- Founder/user isolation remains mandatory for raw documents, chunks, and retrieval results.

## Proposed Changes

### [Supabase Schema]

#### [NEW] `docs/migrations/005_metadata_extraction.sql`

Add platform configuration tables:

1. `public.ai_models`
   - `id uuid primary key`
   - `provider text not null`
   - `model_name text not null`
   - `display_name text not null`
   - `model_family text`
   - `capabilities text[] not null default '{}'`
   - `cost_tier text not null default 'standard'`
   - `is_active boolean not null default true`
   - `notes text`
   - timestamps

2. `public.platform_ai_settings`
   - `setting_key text primary key`
   - `model_id uuid references public.ai_models(id)`
   - `fallback_model_name text`
   - `provider text`
   - `is_enabled boolean not null default true`
   - `settings jsonb not null default '{}'`
   - timestamps

Seed at least:

- `ingestion_embeddings` -> OpenAI `text-embedding-3-small`
- `ingestion_metadata_extraction` -> cheaper OpenAI structured extraction model, with env fallback
- `vcso_chat` -> Claude Sonnet, for registry awareness only; do not rewire chat in this module

Add metadata schema configuration:

3. `public.metadata_schema_fields`
   - `id uuid primary key`
   - `field_key text not null unique`
   - `label text not null`
   - `description text`
   - `data_type text not null`
   - `is_required boolean not null default false`
   - `is_filterable boolean not null default false`
   - `show_in_uploads_panel boolean not null default false`
   - `display_order integer not null default 100`
   - `allowed_values text[]`
   - `extraction_hint text`
   - `is_active boolean not null default true`
   - timestamps

Seed MVP metadata fields:

- `document_title` text, shown in UI
- `document_type` text, filterable, shown in UI
- `business_domain` text, filterable, shown in UI
- `time_period` text, filterable, shown in UI
- `summary` text, shown in UI
- `topics` text array, filterable, shown in UI
- `entities` text array, filterable
- `metrics` text array, filterable, shown in UI when present
- `keywords` text array, filterable
- `confidence` number, shown in UI
- `extraction_notes` text

Add document metadata fields to `public.ose_raw_document_registry`:

- `extracted_metadata jsonb not null default '{}'`
- `metadata_extraction_status text not null default 'pending'`
- `metadata_extraction_model text`
- `metadata_extracted_at timestamptz`
- `metadata_extraction_error text`

Optionally add indexed generated/plain columns for frequent filters if simple and safe:

- `metadata_document_type text`
- `metadata_business_domain text`
- `metadata_time_period text`

Add indexes:

- GIN index on `ose_raw_document_registry.extracted_metadata`
- GIN index on `document_chunks.metadata` if not already present
- B-tree indexes on any plain filter columns added above

RLS and grants:

- Keep founder-owned document/chunk tables scoped by `user_id`.
- For platform config tables, enable RLS. For this module, allow service-role/backend access and avoid broad authenticated writes.
- If read access is needed from the frontend later, expose only read policies or gated admin policies in a future module.

### [Python Ingestion Backend]

#### [NEW] `python-backend/services/metadata_extractor.py`

Create a service that:

- Loads active metadata field definitions from `metadata_schema_fields`.
- Loads the configured model from `platform_ai_settings` using key `ingestion_metadata_extraction`.
- Falls back to env config if settings are missing.
- Calls OpenAI once per non-duplicate upload after Docling/text extraction.
- Requests structured JSON only.
- Validates and normalizes the returned metadata.
- Returns a dictionary that can be stored on the document and copied into chunk metadata.

The extraction prompt should use document-level extracted text, not raw bytes. If needed, cap the input to a safe token/window size and prefer first pages/headers/tables plus representative excerpts.

#### [MODIFY] `python-backend/core/config.py`

Add env fallbacks:

- `OPENAI_METADATA_MODEL`, default to the chosen cheaper structured extraction model.
- `ARCHITECTOS_METADATA_MAX_INPUT_CHARS` or equivalent.
- Optional `ARCHITECTOS_METADATA_EXTRACTION_ENABLED`, default true.

#### [MODIFY] `python-backend/main.py`

In `_process_ingestion`:

1. Load document and skip duplicate rows as Module 3 already does.
2. Download file and confirm content hash.
3. Process document with Docling/chunking.
4. Extract document-level metadata once.
5. Store metadata on `ose_raw_document_registry`.
6. Pass inherited metadata into `replace_document_chunks` so each chunk row contains the same document-level metadata plus chunk-local metadata.
7. Continue embedding/chunk insertion as Module 2 currently does.

If metadata extraction fails but parsing succeeds, mark `metadata_extraction_status = 'failed'` and decide whether ingestion should continue. Recommended MVP: continue chunking/embedding when possible, but record the metadata error.

#### [MODIFY] `python-backend/services/vector_store.py`

Add methods to:

- Load platform model/settings rows.
- Load metadata schema field definitions.
- Mark metadata extraction status as `processing`, `complete`, or `failed`.
- Update document metadata fields.
- Include extracted metadata when inserting `document_chunks.metadata`.

#### [MODIFY] `python-backend/services/retrieval.py`

Prepare for optional metadata filters:

- `document_type`
- `business_domain`
- `time_period`
- `topics`
- `keywords`

The first pass may expose filter arguments in Python even if the frontend/chat caller does not use them yet.

### [Retrieval RPC]

#### [MODIFY] `public.match_document_chunks`

Add optional metadata filter parameters while preserving existing callers:

- default null metadata filter JSON, e.g. `metadata_filter jsonb default '{}'`
- filter against `document_chunks.metadata` and/or joined document metadata
- keep `target_user_id` mandatory

Do not break the existing `/api/retrieve` smoke path.

### [Frontend React SPA]

#### [MODIFY] `lib/osEngineApi.ts` and `lib/osEngineMockData.ts`

Extend `RawDocument` mapping with:

- `extractedMetadata`
- `metadataExtractionStatus`
- `metadataDocumentType`
- `metadataBusinessDomain`
- `metadataTimePeriod`
- `metadataSummary`
- `metadataTopics`
- `metadataConfidence`

#### [MODIFY] `components/pro-suite/os-engine/views/UploadsView.tsx`

Add expandable metadata detail for uploaded documents:

- Keep the table compact by default.
- Add an expand/view interaction per row or reuse the existing open-doc pattern if that is the local design convention.
- Show high-signal fields only:
  - generated title
  - summary
  - document type
  - business domain
  - time period
  - topics/tags
  - metrics/entities when present
  - extraction confidence/status
- Do not expose internal labels such as `metadata_schema_fields`, `model registry`, or `record manager` in founder-facing copy.
- Keep visual changes additive and aligned with the current OS Engine Uploads design. Do not rebuild the page.

### [Settings/Admin Scaffold]

This module should create the backend tables for global settings and model/schema configuration. It should not build the full Global Settings admin area yet unless the execution agent can do it as a very small additive stub.

If a UI stub is added, it should be clearly internal/admin-oriented and not required for founder upload usage. Permissioning can be hardened later.

## Verification Plan

### Code Verification

- Run `npm.cmd run build`.
- Run `python -m compileall python-backend`.
- Add focused Python checks for metadata normalization if practical.

### Migration Verification

- Verify `005_metadata_extraction.sql` exists.
- Apply or prepare the migration per current project workflow.
- Verify live columns on `ose_raw_document_registry`.
- Verify `ai_models`, `platform_ai_settings`, and `metadata_schema_fields` exist with seed rows.
- Verify RLS is enabled and no broad authenticated write policy exists for platform config tables.

### Functional Verification

If OpenAI billing is restored:

1. Upload a new non-duplicate text or CSV document.
2. Confirm metadata extraction status moves through processing to complete.
3. Confirm `extracted_metadata` is populated on `ose_raw_document_registry`.
4. Confirm selected metadata is copied into `document_chunks.metadata`.
5. Confirm `/api/retrieve` still works without filters.
6. Confirm metadata filter arguments work when called directly.
7. Confirm Uploads UI displays the high-signal metadata fields in the expanded detail panel.

If OpenAI quota remains blocked:

- Confirm the code reaches the metadata extraction call and records the exact quota error.
- Confirm duplicate rows still skip metadata extraction and embeddings.
- Confirm schema/config/UI scaffolding is complete.
- Do not mark metadata extraction smoke fully complete.

## Completion Criteria

Module 4 can be considered implemented when:

- Plan and migration artifacts exist.
- Live schema/config tables are applied and verified.
- Backend can load metadata schema and model settings with env fallback.
- Non-duplicate ingestion attempts one document-level metadata extraction call before chunk persistence.
- Extracted metadata is stored on the raw document row.
- Chunk metadata receives inherited document metadata.
- Retrieval supports optional metadata filters without breaking existing callers.
- Uploads UI has an additive expandable metadata detail panel.
- `Pro-Suite-Progress.md` is updated with separate status for code, migration, live schema, local verification, metadata smoke, retrieval filter smoke, and any remaining OpenAI quota or auth/test-user blockers.
