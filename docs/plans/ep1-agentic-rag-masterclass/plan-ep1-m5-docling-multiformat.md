# Agentic RAG Module 5: Docling Multi-Format Ingestion

This plan hardens ArchitectOS Pro ingestion around Docling as the only document parsing engine. Module 5 should support the document formats Docling supports through a cloud-hosted Python/FastAPI backend, preserve structured agency data where possible, improve extraction metadata and failure handling, and clarify cleanup behavior for raw documents and chunks.

## Current Gate Context

Modules 2-4 are soft-locked as working scaffolding:

- Module 2 storage/vector/retrieval scaffolding is wired, with full chunk/retrieval verification blocked by OpenAI quota.
- Module 3 record management is implemented and live schema was applied, with isolated duplicate smoke still pending due test-user/Auth Admin access.
- Module 4 metadata extraction is implemented and live schema was applied; retrieval RPC smoke passed with and without metadata filters, but OpenAI metadata/chunk smoke remains quota-blocked.

Module 5 can proceed because Docling parsing and local extraction checks do not require OpenAI quota. Any verification that reaches embeddings or LLM metadata extraction must report quota status separately.

## Locked Decisions

> [!NOTE]
> **Docling Only**
> Use Docling as the only parser framework for multi-format ingestion. Do not add Unstructured or parallel parser stacks.

> [!NOTE]
> **Cloud-Hosted Backend**
> Parsing runs in the persistent Python/FastAPI ingestion service. It must not be moved into Vercel serverless and must not depend on desktop-local execution.

> [!NOTE]
> **Cloud AI Only**
> ArchitectOS does not use local/self-hosted LLMs. Parsing can run inside the cloud Python service; AI/LLM work must use cloud provider APIs only.

> [!NOTE]
> **Agency Data First**
> The most important real-world files are messy agency operating exports: QuickBooks/finance exports, Excel workbooks, CSVs, utilization/staffing resources, P&L PDFs, ops docs, and strategy/client materials. Preserve enough document and table structure for later AI normalization across inconsistent agency nomenclature.

## Architecture Constraints

- Raw files stay in Supabase Storage bucket `raw-documents`.
- Synthesized Wiki artifacts stay in `kb-files`.
- Raw upload metadata stays in `public.ose_raw_document_registry`.
- Chunks stay in `public.document_chunks`.
- Embeddings remain OpenAI `text-embedding-3-small` with `vector(1536)`.
- Metadata extraction remains OpenAI via Module 4 settings.
- Virtual CSO chat remains Claude Sonnet through Vercel serverless and canonical `vcso_*` tables.
- Batch/scheduled synthesis remains N8N.
- No local/self-hosted LLMs or parser services.
- No Unstructured dependency.
- User isolation remains mandatory for storage, registry rows, chunk cleanup, and retrieval.

## Format Scope

The execution agent must verify Docling's current official supported formats before implementation. The system should be configured around Docling-supported formats rather than a narrow hard-coded list.

Expected Docling-supported families to account for include, subject to current docs/version verification:

- PDF
- DOCX
- PPTX
- XLSX
- HTML
- plain text and Markdown variants
- images where Docling/OCR support is available
- EPUB and other office/document exports if supported by the installed Docling version
- audio/transcript-style inputs only if supported and practical in the installed Docling version

High-priority MVP smoke formats for ArchitectOS:

1. CSV agency export
2. XLSX workbook
3. text-based PDF with table-like content
4. DOCX business document
5. HTML or Markdown export

OCR/scanned PDFs and images should be enabled only if Docling handles them cleanly in the deployment environment. If OCR requires additional system/runtime assets, document the requirement and defer production OCR hardening rather than silently adding fragile behavior.

## Proposed Changes

### [Python Dependencies]

#### [MODIFY] `python-backend/requirements.txt`

- Keep Docling pinned. Current pin is `docling==2.44.0`.
- Verify whether the current pin supports the target Docling format list.
- Do not upgrade Docling casually. If an upgrade is required for supported formats, update the pin deliberately and report why.
- Do not add Unstructured.
- If additional Docling extras/system dependencies are needed for OCR/images/audio, document them explicitly and keep the MVP path stable without them if necessary.

### [Parser Configuration]

#### [NEW/MODIFY] `python-backend/services/doc_processor.py`

Refactor parsing into a Docling-first format system:

- Normalize extensions/MIME-like file types into parser format keys.
- Maintain a single supported-format allowlist that can be updated as Docling support evolves.
- Use Docling for all Docling-supported complex formats.
- Keep CSV handling only if it intentionally preserves row/column semantics better than a generic converter path; if retained, treat it as part of the Docling-only policy exception for simple structured text, not a competing parser framework.
- Preserve Markdown/plain-text direct reads for simple text-like formats when they are safer and cheaper than conversion.
- Return richer `ProcessedDocument.metadata`:
  - `parser`: `docling` / `csv_structured` / `plain_text`
  - `parser_version` if accessible
  - `file_type`
  - `format_family`
  - `page_count`
  - `sheet_count`
  - `row_count`
  - `column_count`
  - `table_count`
  - `image_count`
  - `preserves_structure`
  - `warnings`
  - `extraction_quality`
  - `chunk_count`
- Normalize tables into chunk-friendly Markdown/text while preserving row labels, sheet names, table captions, or section headers where available.
- For workbooks, preserve sheet names and keep rows/sections identifiable.
- For PDFs, preserve headings/page or table boundaries where Docling exposes them.
- For DOCX/PPTX/HTML/Markdown, preserve headings/sections.

### [Chunking]

Improve chunking strategy by format family:

- CSV/XLSX/table-heavy files: prefer row/table/sheet boundaries, then token windows.
- PDF/DOCX/HTML/Markdown: prefer headings/sections, then paragraphs, then token windows.
- Avoid chunks that merge unrelated sheets or tables when possible.
- Add chunk metadata fields such as `format_family`, `sheet_name`, `page_number`, `table_index`, or `section_heading` when available.

### [Supabase Schema]

#### [NEW] `docs/migrations/006_docling_multiformat.sql`

Add extraction/format metadata to `public.ose_raw_document_registry` if not already covered by existing `metadata` JSON:

- `parser_status text not null default 'pending'`
- `parser_name text`
- `parser_version text`
- `parser_format text`
- `parser_warnings text[] not null default '{}'`
- `extraction_quality text`
- `source_format_metadata jsonb not null default '{}'`

Add or confirm constraints/indexes:

- parser status allowed values: `pending`, `processing`, `complete`, `failed`, `skipped`
- optional index on `(user_id, parser_status)`
- optional GIN index on `source_format_metadata`

Keep `documents` view compatible by exposing these fields if the view exists.

RLS:

- Continue user-owned RLS on registry rows.
- Do not create broad public access.

### [Backend Persistence]

#### [MODIFY] `python-backend/services/vector_store.py`

Add methods to:

- mark parser status as processing/complete/failed/skipped
- persist parser metadata onto `ose_raw_document_registry`
- clear chunks for a document when appropriate
- safely delete or mark deleted active source documents without deleting original storage used by duplicate rows

Update ingest flow:

- skip duplicate rows before parsing
- mark parser processing before Docling conversion
- mark parser complete with structured metadata after conversion succeeds
- mark parser failed with warnings/errors if conversion fails
- only proceed to metadata extraction/chunk/embedding when parsing succeeds

### [Deletion / Cascade Cleanup]

Harden cleanup behavior:

- Deleting a duplicate row must not remove the original storage object or chunks.
- Deleting an active source document should:
  - mark its registry row deleted or delete according to existing product behavior
  - remove its raw storage object only if no other non-deleted duplicate row still references it
  - delete or clear `document_chunks` for that document id
  - avoid cross-user deletes
- If cascade cleanup is implemented in app code, keep it explicit and user-scoped.
- If DB cascade already handles chunks, verify it live and document the behavior.

### [Frontend Uploads UI]

#### [MODIFY] `lib/osEngineApi.ts` and `lib/osEngineMockData.ts`

Expose parser/source format metadata on `RawDocument`:

- parser status
- parser name/version
- parser format
- format family
- source format metadata
- parser warnings
- extraction quality

Expand the allowed upload types to match the Docling-supported format allowlist verified by the execution agent, while keeping file-type validation user-friendly.

#### [MODIFY] `UploadsView.tsx`

Keep UI details light:

- Show compact parser information in the expanded row/detail panel only.
- Examples: `Parsed as workbook`, `3 sheets`, `12 tables`, `Warnings: scanned PDF may need OCR`.
- Keep deeper parser JSON backend-only.
- Do not make a new landing page or rebuild Uploads.
- Do not surface internal parser architecture terms beyond useful founder-facing labels.

### [Test Fixtures]

Add small local fixtures under an appropriate docs/test-fixtures path, or a documented script-generated fixture set if binaries should not be committed:

- CSV export with headers and rows
- XLSX workbook with at least two sheets, if the repo allows binary test fixtures
- Markdown or HTML sample
- DOCX/PDF sample only if practical and lightweight

If binary fixtures are not appropriate for the repo, create a clear manual fixture checklist instead.

## Verification Plan

### Documentation / Dependency Verification

- Verify current Docling official docs/README for supported formats.
- Verify installed/pinned Docling version.
- Verify whether the current environment can import Docling and run a basic conversion.
- If network/package installation is needed, report whether it was installed into a temp dependency path or the project environment.

### Code Verification

- Run `python -m compileall python-backend`.
- Run focused parser smoke tests for CSV/plain text and any available Docling-supported fixtures.
- Run `npm.cmd run build` if frontend upload types or UI are changed.

### Live Supabase Verification

- Apply or verify `006_docling_multiformat.sql`.
- Confirm parser columns and indexes exist.
- Confirm registry RLS remains enabled.
- Confirm deleting or clearing chunks remains user-scoped.

### Functional Parser Smoke

OpenAI quota is not required for parser-only verification.

1. Process a CSV or generated fixture directly through `process_document_bytes`.
2. Process an XLSX fixture if practical.
3. Process a DOCX/PDF/HTML/Markdown fixture if practical.
4. Confirm parser metadata includes format, quality/warnings, and structural counts where possible.
5. Confirm chunks preserve table/sheet/section boundaries better than naive text splitting.
6. Confirm unsupported or failed formats produce a clean parser failure state, not a silent ingest success.

### End-to-End Caveat

If OpenAI quota remains blocked, do not require metadata extraction, embeddings, or retrieval completion for Module 5. It is enough to prove parser output and parser metadata persistence, then report quota-gated steps separately.

## Completion Criteria

Module 5 can be considered implemented when:

- Plan and migration artifacts exist.
- Docling remains the only complex parser framework.
- Supported upload type handling is aligned to verified Docling-supported formats.
- Parser metadata is stored on registry rows and propagated into chunk metadata where appropriate.
- High-priority agency formats have parser smoke coverage or documented manual fixtures.
- Parser failures are recorded clearly.
- Duplicate rows skip parsing.
- Active document deletion/chunk cleanup behavior is explicitly implemented or verified.
- Uploads UI shows lightweight parser details in the expanded document panel.
- `Pro-Suite-Progress.md` is updated with separate status for code, migration, live schema, parser smoke, deletion cleanup, local build, and any remaining OpenAI quota/test-user blockers.
