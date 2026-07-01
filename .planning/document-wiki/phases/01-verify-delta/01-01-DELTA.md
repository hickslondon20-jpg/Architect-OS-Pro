# 01-01 DELTA - OS Engine Knowledge Pages Verification

**Date:** 2026-06-30  
**Scope:** Sub-phase 01 Verify & Delta for Document Wiki Layer 2 / Wiki 2.0  
**Mode:** Read-only investigation. No production code, schema, DDL, or migration changes.

## Evidence Sources

- Planning: `.planning/document-wiki/CONTEXT.md`, `.planning/document-wiki/phases/01-verify-delta/01-01-PLAN.md`, `.planning/wiki-system/CONTEXT.md`, `config/wiki_schema.json`.
- Frontend: `lib/osEngineApi.ts`, `lib/osEngineMockData.ts`, `pages/ProSuite/os-engine/OSEngineWorkspace.tsx`, `components/pro-suite/os-engine/**`, `api/vcso/chat.ts`.
- Backend: `python-backend/main.py`, `python-backend/services/vector_store.py`, `python-backend/services/folder_navigation.py`, `python-backend/services/kb_explorer_service.py`, `python-backend/services/wiki_*.py`.
- Live Supabase project: `pwacpjqkntnovndhspxt`, read-only SQL introspection via Supabase MCP.

## A. `ose_knowledge_pages` Storage

Live table exists with RLS enabled and **0 rows** at verification time.

Columns:

| Column | Type | Null/default | Notes |
|---|---|---|---|
| `id` | `uuid` | not null, `gen_random_uuid()` | Primary key. |
| `user_id` | `uuid` | not null | FK to auth users; all RLS is owner-scoped. |
| `page_type` | `text` | not null | Constrained to five starter types plus `custom`. |
| `page_title` | `text` | not null | Display title. |
| `content` | `text` | not null, `''` | Markdown page body; UI renders this directly. |
| `category` | `text` | nullable | Constrained to six OS Engine categories. |
| `source_file_ids` | `uuid[]` | not null, `{}` | Intended document-to-page manifest link. No FK constraint to registry. |
| `last_updated` | `timestamptz` | not null, `now()` | UI sort/display and CSO index ordering. |
| `updated_at` | `timestamptz` | not null, `now()` | Generic row update timestamp. |
| `pinecone_vector_id` | `text` | nullable | Legacy vector handle only. |
| `word_count` | `integer` | not null, `0` | UI index metric. |
| `status` | `text` | nullable, `active` | CSO excludes `deleted`; no check constraint found. |
| `canonical_key` | `text` | nullable | Unique per user when present; CSO prefers this for core page matching. |
| `page_kind` | `text` | nullable | Indexed; used only as CSO prompt metadata locally. |
| `domain` | `text` | nullable | Indexed; used only as CSO prompt metadata locally. |
| `confidence` | `numeric` | nullable | CSO selects it but does not use it in scoring/prompt. |
| `effective_date` | `date` | nullable | No local code use found. Likely intended temporal semantics. |
| `observed_date` | `date` | nullable | No local code use found. Likely source-observation date. |
| `review_date` | `date` | nullable | Indexed; no local code use found. Likely review/staleness hook. |

Constraints / indexes:

- Primary key: `ose_knowledge_pages_pkey(id)`.
- FK: `user_id`.
- Check: `page_type in ('business_context','assessment_intelligence','strategic_context','financial_patterns','conversation_intelligence','custom')`.
- Check: `category is null or category in ('financial','client_market','operational','conversation_meeting','org_health','founder_identity')`.
- Unique partial: `(user_id, canonical_key)` where `canonical_key is not null`.
- Unique partial: `(user_id, page_type)` for the five core page types.
- Indexes: `user_id`, `(user_id, category)`, `status`, `page_kind`, `domain`, `review_date`.
- No pgvector column or page-embedding index exists on `ose_knowledge_pages`.

RLS:

- RLS enabled, not forced.
- Policies for authenticated users: select/insert/update/delete own rows with `auth.uid() = user_id`.

Vector situation:

- `ose_knowledge_pages` has only `pinecone_vector_id text`.
- `document_chunks.embedding` is live as `vector(1536)` with HNSW cosine index.
- `match_document_chunks(...)` is live for raw document chunks and returns `source_kind = 'raw_document_chunk'`.
- Therefore page-level semantic search for Layer 2 must add a pgvector path for pages; it should not revive Pinecone.

Semantic evidence:

- `canonical_key`, `page_kind`, `domain`, `confidence`, and date fields are scaffolded live but only partially consumed. The CSO hook selects `canonical_key/page_kind/domain/category/status/confidence/last_updated`; it scores against metadata and injects key/kind/domain/status into the prompt. It does not use `confidence` or the date fields.

**Verdict: CONFIRMED** - The storage scaffold exists and is owner-scoped, but page embeddings are legacy/Pinecone-only and there is no populated page corpus.

## B. Taxonomy + Source Types

Code taxonomy in `lib/osEngineMockData.ts`:

- `PageType`: `business_context`, `assessment_intelligence`, `strategic_context`, `financial_patterns`, `conversation_intelligence`, `custom`.
- `PAGE_TYPE_LABELS`: founder-facing labels for those six values.
- `WIKI_CATEGORIES`: `financial`, `client_market`, `operational`, `conversation_meeting`, `org_health`, `founder_identity`.
- `STARTER_PAGE_TYPES`: the five non-custom page types.
- `IMPORT_SOURCES`: `agency_snapshot`, `gvs_scenarios`, `clarity_compass`, `architect_evolution`, `mra_audit`, `sprint_plans`.

Wired vs mock:

- The file header still says the arrays were mock/skeleton and "NOTHING here is wired to a backend."
- That is now partially stale: the **types/constants** are imported through `lib/osEngineApi.ts` and used by live UI. The sample arrays `MOCK_RAW_DOCUMENTS`, `MOCK_KNOWLEDGE_PAGES`, and `MOCK_LOG_ENTRIES` are not used by the OS Engine workspace.
- The live DB constraints mirror the code taxonomy for `page_type` and `category`, so the taxonomy is real at the storage/API/display layer.

Comparison to theafh emergent page types:

- theafh pattern: entity / concept / comparison / summary / query / procedure.
- current OSE taxonomy: platform-area starter pages and broad agency categories.
- It does **not** model emergent document page kinds like client, competitor, vendor, offer, method, market trend, comparison, query answer, or procedure.

Multi-source fit:

- `IMPORT_SOURCES` anticipates platform sources and sprints, not only uploads.
- It does not explicitly include Virtual CSO threads or domain-agent artifacts.
- `conversation_intelligence` can serve as a placeholder for CSO-derived material, and `sprint_plans` exists as an import source, but there is no distinct sprint-history / longitudinal category or page type.
- `page_kind` and `domain` are likely intended expansion fields, but they are unconstrained and unwired beyond CSO prompt metadata.

**Verdict: CORRECTED** - The constants are no longer pure mock, but the taxonomy is a starter/adaptor taxonomy, not yet the emergent multi-source Layer 2 taxonomy.

## C. UI Surfaces

Container:

- `pages/ProSuite/os-engine/OSEngineWorkspace.tsx` calls `loadOSEngineData()` and feeds live `docs/pages/logEntries/setup` into views.
- It refreshes every 30 seconds and subscribes to `ose_raw_document_registry` changes only. It does not subscribe to `ose_knowledge_pages`, `ose_activity_log`, or corrections.

Data API:

- `loadOSEngineData()` reads:
  - `ose_raw_document_registry` for docs, excluding deleted.
  - `ose_knowledge_pages` for pages, ordered by `last_updated`.
  - `ose_activity_log` for logs.
  - `ose_knowledge_base_setup` for onboarding.
- `saveKnowledgeBaseSetup()` upserts setup and calls `seed_core_knowledge_pages(p_user_id)`.
- `addPageCorrection()` inserts into `ose_page_corrections`.
- Uploads write raw files to `raw-documents`, insert registry rows, and queue Python ingestion.

Surfaces:

| Surface | Binding | Functional status |
|---|---|---|
| `WelcomeView` | live setup upsert + seed RPC; `IMPORT_SOURCES` constants | Functional setup shell; seeds empty starters only. |
| `UploadsView` / `FolderTree` / `FileNode` | live registry + folder API | Functional raw upload/folder surface; shows connected pages if registry has IDs. |
| `WikiView` | live `ose_knowledge_pages` via props + taxonomy constants | Functional page/category reader shell; empty because no pages are populated live. |
| `IndexView` | live `ose_knowledge_pages` via props | Functional catalog/table shell. |
| `ManifestView` | live `ose_raw_document_registry.connected_pages` mapped to live pages | Functional manifest shell; depends on missing synthesis links. |
| `LogView` | live `ose_activity_log` via props | Functional display shell; empty live. |
| `Reader` | page/doc markdown/details from selected prop | Functional markdown reader. |
| `NotesComposer` | inserts `ose_page_corrections` | Functional correction capture; no evidence found that corrections are applied. |
| `StructureRail` | local section state | Functional nav. |

Mock vs wired:

- The OS Engine workspace does **not** use `MOCK_*` arrays.
- It does use constants from the mock-data file, so the file name/header is misleading but not evidence that the UI is sample-only.

**Verdict: CONFIRMED** - The UI is a real live-table shell, not a greenfield mock, but it is empty because the synthesis/link/log writers are missing.

## D. Virtual CSO Read-Hook

`api/vcso/chat.ts` has a partial founder-wiki read-hook:

1. `loadFounderContext()` queries `ose_knowledge_pages` with the user JWT, scoped by `user_id`, excluding `status='deleted'`.
2. First query loads an index:
   `id,page_title,page_type,canonical_key,page_kind,domain,category,status,confidence,last_updated`.
3. `selectFounderPages(message,indexRows)` scores pages:
   - Starts with +10 if `canonical_key ?? page_type` is one of the five core keys.
   - Adds +2 for token overlap between the founder message and page title/type/key/kind/domain/category.
   - Keeps top 8 page IDs with score > 0.
4. Second query loads selected pages with `content`.
5. Prompt assembly includes:
   - `FOUNDER WIKI COMPACT INDEX` with page title, type, key, kind, domain, status.
   - `LOADED FOUNDER WIKI PAGES` with title, type, key, and full markdown content.
6. Browser source payload includes founder wiki pages as `kind: 'wiki'`, plus `sourcePages` for the right-side source reader.

Limitations:

- No vector/semantic search over pages.
- No citations/provenance from `source_file_ids`.
- `confidence` is selected but unused.
- Empty table means current runtime normally injects "No founder wiki index rows available" and "No founder pages loaded."

**Verdict: CONFIRMED** - CSO wiring exists as an index-first markdown injection hook, but it is dormant until pages exist and lacks page-level retrieval/provenance.

## E. Ingest Gap

Confirmed writers to `ose_knowledge_pages`:

- `seed_core_knowledge_pages(p_user_id)` inserts five empty starter pages with `content=''` and `word_count=0`.
- No frontend production code writes populated page content.
- No Python ingestion service writes `ose_knowledge_pages`.
- No backend search result found for page-generation writes outside the seed RPC.

What ingestion currently does:

- `/api/ingest` in `python-backend/main.py` processes raw document files, stores `full_markdown`, extracts metadata, replaces `document_chunks`, and marks registry status.
- `VectorStore.store_full_markdown()` updates `ose_raw_document_registry.full_markdown`.
- `VectorStore.replace_document_chunks()` writes `document_chunks`.
- It updates raw document status/metadata only; no page synthesis.

Seed function:

- `seed_core_knowledge_pages(p_user_id)` creates:
  - Business Context
  - Assessment Intelligence
  - Strategic Context
  - Financial Patterns
  - Conversation Intelligence
- It uses `on conflict (user_id,page_type)` for the five core page types and does nothing on existing rows.
- It does not set `canonical_key`, `page_kind`, `domain`, `confidence`, dates, `source_file_ids`, `category`, or synthesized markdown.

Abandoned / partial page-generation clues:

- `synthesis_job_id`, `connected_pages`, `origin_thread_id`, `kb-files`, `pinecone_vector_id`, `ose_activity_log`, and `ose_page_corrections` indicate a planned synthesis pipeline.
- `docs/intelligence-layer-storage-architecture.md` says future synthesis can generate Wiki artifacts into `kb-files` and `ose_knowledge_pages`.
- No active engine was found that performs that synthesis.

**Verdict: CONFIRMED** - The missing build is the synthesis engine that turns sources into pages, page links, logs, corrections, and embeddings.

## F. Related OSE Tables

Live counts:

| Table | Rows |
|---|---:|
| `ose_knowledge_pages` | 0 |
| `ose_page_corrections` | 0 |
| `ose_activity_log` | 0 |
| `ose_knowledge_base_setup` | 0 |
| `ose_raw_document_registry` | 2 |
| `kb_folders` | 1 |
| `document_chunks` | 0 |

`ose_page_corrections`:

- Columns: `id`, `user_id`, `page_id`, `body`, `status`, `created_at`.
- Status constrained to `pending` / `applied`.
- FK to `ose_knowledge_pages(id)`.
- UI writes via `NotesComposer`.
- No application code found that applies corrections back into pages.

`ose_activity_log`:

- Columns: `id`, `user_id`, `kind`, `text`, `icon`, `created_at`.
- Kind constrained to `activity` / `decision`.
- UI reads it as the Log.
- No current ingestion/page engine writes it.

`ose_knowledge_base_setup`:

- Columns: `user_id`, `onboarded`, `imported_sources[]`, `onboarded_at`, `created_at`, `updated_at`.
- Primary key `user_id`.
- UI writes it during first-run setup and calls the seed RPC.

`ose_raw_document_registry`:

- Raw upload registry with status, storage path, duplicate/supersede state, parser metadata, extracted metadata, `folder_id`, and `full_markdown`.
- `connected_pages uuid[]` is the registry-side manifest link to pages.
- `ose_knowledge_pages.source_file_ids uuid[]` is the page-side manifest link back to raw documents.
- Neither side has an FK array constraint; the engine must maintain consistency.

**Verdict: CONFIRMED** - The manifest/log/correction/onboarding tables exist, but the writer that keeps them coherent does not.

## G. Document Source / KB Explorer

Confirmed source layer:

- `kb_folders` stores hierarchy.
- `ose_raw_document_registry.folder_id` attaches documents to folders.
- `ose_raw_document_registry.full_markdown` stores full extracted markdown for read/grep tools.
- `document_chunks` stores Tier 2 chunk retrieval with `vector(1536)`, `content_tsv`, metadata, and HNSW index.
- `match_document_chunks(...)` implements hybrid retrieval over chunks with vector candidates, keyword candidates, and RRF.

KB Explorer tools:

- `KbNavigationService.execute_ls()` lists folders and raw document rows.
- `execute_tree()` builds a folder/file tree from `kb_folders` and `ose_raw_document_registry`.
- `execute_grep()` searches `full_markdown` with regex, optionally scoped to folder subtree.
- `execute_glob()` searches filenames, optionally scoped to folder subtree.
- `execute_read()` reads `full_markdown` by document ID and optional line range.
- `KbExplorerService` exposes `kb_ls`, `kb_tree`, `kb_grep`, `kb_glob`, `kb_read` to an Anthropic tool loop and records referenced document IDs/names.

Live caveat:

- The live project currently has 2 raw registry rows, 1 folder, and 0 chunks; the two sampled registry rows did not yet have `full_markdown`.
- The source machinery exists, but live data is not currently a rich corpus.

**Verdict: CONFIRMED** - KB Explorer is the document source/read substrate the synthesis engine should consume, with `document_chunks` as Tier 2 retrieval and `full_markdown` as full-document evidence.

## H. Layer 1 (`wiki_*`) vs Layer 2 (`ose_knowledge_pages`) Boundary

Layer 1:

- `.planning/wiki-system/CONTEXT.md` defines the fixed seven structured pages.
- `config/wiki_schema.json` confirms the canonical seven `page_key`s:
  - `business_context`
  - `diagnostic_synthesis`
  - `current_quarter_sprint`
  - `growth_constraints`
  - `financial_context`
  - `client_market_position`
  - `open_questions`
- Layer 1 uses structured claims/evidence/digest tables (`wiki_pages`, `wiki_claims`, `wiki_evidence`, `wiki_digest`, etc.).
- Layer 1 is claim-as-unit with provenance and trust classes.

Bridge:

- `config/wiki_schema.json` maps each Layer 1 `page_key` to an `ose_page_type`:
  - Business Context -> `business_context`
  - Diagnostic Synthesis -> `assessment_intelligence`
  - Current Quarter / Sprint -> `strategic_context`
  - Growth Constraints -> `strategic_context`
  - Financial Context -> `financial_patterns`
  - Client / Market Position -> `business_context`
  - Open Questions -> `conversation_intelligence`
- The schema note says the seven wiki page keys are canonical for Layer 1 and the OSE seed uses five adapter page types.

Boundary:

- Layer 1 = current structured breadth, claims/evidence/digest, deterministic page keys.
- Layer 2 = emergent markdown depth and longitudinal source-specific pages in `ose_knowledge_pages`.
- The bridge should map surfaced Layer 2 pages into Layer 1 contexts/adapters without duplicating Layer 1's canonical claim store.

**Verdict: CONFIRMED** - The intended boundary is complementary: Layer 1 is fixed structured breadth; Layer 2 should be emergent page-level depth with an adapter bridge through `ose_page_type`.

## I. Build-On-Existing vs Fresh-Store Recommendation

Recommendation: **Build on the existing `ose_knowledge_pages` scaffold, with targeted extensions, not a fresh greenfield store.**

Reasons:

1. The live table, RLS, category/page-type constraints, canonical-key uniqueness, manifest fields, and related correction/log/setup tables already exist.
2. The OS Engine UI is already wired to live OSE tables and expects markdown pages, source counts, categories, manifest links, and corrections.
3. Virtual CSO already has a partial read-hook for this exact table and returns wiki pages as source artifacts.
4. KB Explorer and raw ingestion already provide the document substrate (`full_markdown`, folders, chunks, hybrid retrieval) that the synthesis engine needs.
5. Layer 1 already defines the boundary/bridge: fixed seven claim pages remain canonical; OSE page types are adapters/render targets.

Do not treat the existing scaffold as complete:

- Add page embeddings in pgvector, not Pinecone.
- Decide the emergent taxonomy/page-kind model in the design discuss.
- Decide how multi-source paths write pages: uploads, CSO threads, sprint history, and domain-agent artifacts.
- Decide page-worthiness thresholds and longitudinal page lifecycle.
- Decide whether corrections are applied automatically, triaged, or founder-approved.
- Add an engine-maintained manifest contract for `source_file_ids` and `connected_pages`.
- Add activity logging and health/lint rules so the UI surfaces become meaningful.

Legacy entanglement:

- `pinecone_vector_id` is a legacy handle and should be deprecated or ignored in favor of pgvector.
- `osEngineMockData.ts` is misnamed: constants are real/wired, sample arrays are unused.
- Current DB `page_type` check constrains emergent page growth unless `custom` plus `page_kind/domain/canonical_key` are used or the schema is extended.

**Verdict: CONFIRMED** - Build on existing, but design must explicitly resolve taxonomy, pgvector embeddings, multi-source writer paths, and correction/log lifecycle.

## Gap Table

| Capability | Exists now | Synthesis engine must add |
|---|---|---|
| Page store | `ose_knowledge_pages` with markdown, page metadata, source arrays, RLS, indexes | Populate/update pages, canonical keys, page kinds, domains, confidence, dates, word counts, statuses. |
| Page taxonomy | Five starter types + `custom`; six categories; import-source checklist | Emergent taxonomy/page-worthiness rules for documents, threads, sprints, agent artifacts, longitudinal pages. |
| Page embeddings | Only `pinecone_vector_id`; no pgvector | Add page-level pgvector embedding and search path; ignore/deprecate Pinecone. |
| Raw source registry | `ose_raw_document_registry`, `raw-documents`, parser metadata, `full_markdown` | Select source candidates, read evidence, create/update `source_file_ids` and `connected_pages`. |
| Chunk retrieval | `document_chunks` + `match_document_chunks` hybrid RRF | Use chunks as evidence discovery/Tier 2 support, not as the Layer 2 page store. |
| Folder/document exploration | KB Explorer `ls/tree/grep/glob/read` tools | Reuse for synthesis evidence collection and source inspection. |
| Manifest UI | `ManifestView` maps registry `connected_pages` to page titles | Keep links coherent and update registry/page arrays during synthesis. |
| Wiki UI/index | Live table renderers for pages/categories/index/reader | Feed real content, non-empty categories, page source counts, and page metadata. |
| Corrections | `ose_page_corrections` + `NotesComposer` | Apply/triage corrections and record status transitions. |
| Activity log | `ose_activity_log` + `LogView` | Write ingestion, synthesis, correction, decision, and refresh events. |
| CSO read-hook | Index-first page selection and markdown prompt injection | Add retrieval quality, provenance/citations, confidence/date handling, and connection-phase routing. |
| Layer 1 bridge | `ose_page_type` mapping in `config/wiki_schema.json` | Define adapter/read contract so Layer 2 enriches Layer 1 without duplicating claims. |
| Multi-source memory substrate | Context decision only; `IMPORT_SOURCES` partly anticipates platform/sprints | Source-specific synthesis paths for CSO threads, sprint history, domain-agent artifacts, and memory/self-learning loops. |

## Verdict Counts

- CONFIRMED: 8
- CORRECTED: 1
- RISK: 0

Headline gap: the page synthesis engine is absent; everything around it is scaffolded enough to build on.
