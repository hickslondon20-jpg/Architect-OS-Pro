# ArchitectOS Document Wiki Page Contract

contract_version: doc-wiki-1.0
status: frozen for sub-phases 03-06 and connection phase

This contract is the authoritative surface for Layer 2 Document Wiki pages. It defines the page object,
taxonomy, provenance, graph links, read tools, write guards, Layer-1 bridge, memory hooks, and
conformance guarantees. It intentionally does not define synthesis prompts, engine internals, UI
implementation, or any markdown-vault substrate.

## Actor Classes

- synthesis engine: internal service-role writer for synthesized page prose, metadata, provenance,
  embeddings, links, and activity events.
- founder correction path: authenticated founder path through `ose_page_corrections`; writes preserved
  overlays, never synthesized base prose.
- connection phase: future retrieval/runtime bridge that increments recall fields and routes page reads.
- read-capable agents: Virtual CSO, OS Engine, Domain Agents, Sprint Planning, and orchestrator read
  paths allowed to call the documented read tools.
- lint/health service: future sub-phase 06 verifier for orphan links, citation integrity, manifest
  coherence, and stale pages.

## Page Object

Storage table: `public.ose_knowledge_pages`.

| Field | Type | Semantics | Writer | Set when | Blank or null means |
|---|---|---|---|---|---|
| `id` | `uuid` | Primary key for the page row. | Database default. | Row creation. | Never blank. |
| `user_id` | `uuid` | Founder owner; every read/write is owner-scoped by RLS or service-role checks. | Synthesis engine or seed/setup path. | Row creation. | Never blank. |
| `page_type` | `text` | Layer-1 bridge/area value constrained to existing OSE page types. It is not the emergent type. | Synthesis engine. | Row creation and reclassification. | Never blank; fully emergent pages use `custom`. |
| `page_kind` | `text` | Emergent page kind from config vocabulary. | Synthesis engine. | Row creation and reclassification. | Legacy/scaffold page not yet classified; lint finding once engine is active. |
| `page_title` | `text` | Human-readable display title. | Synthesis engine; seed path for starter pages. | Row creation and topic/title changes. | Never blank. |
| `content` | `text` | Prose markdown with machine-parseable inline citations. The synthesis engine is the sole writer of synthesized prose. | Synthesis engine only. | Create/resynthesis. | Empty string is an unsynthesized starter or invalid generated page. |
| `category` | `text` | Existing UI group constrained to OSE categories. | Synthesis engine. | Row creation and reclassification. | Not categorized yet; lint finding once engine is active. |
| `domain` | `text` | Optional sub-domain tag, such as `client_services`, `growth`, or `finance`. | Synthesis engine. | When source context supports a domain. | No reliable domain classification. |
| `source_file_ids` | `uuid[]` | Page-to-document manifest of `ose_raw_document_registry.id` values that contributed to the page. | Synthesis engine. | Every create/resynthesis/source deletion reconciliation. | Pure non-document synthesis page, or orphan candidate if document-derived. |
| `canonical_key` | `text` | Stable identity/dedup key, unique per user when set. | Synthesis engine. | Row creation before write-time dedup. | Legacy row not yet dedup-addressable; not allowed for engine-created pages. |
| `confidence` | `numeric` | Synthesis confidence from 0.0 to 1.0. | Synthesis engine. | Every create/resynthesis. | Confidence not computed yet. |
| `word_count` | `integer` | Computed markdown word count for index display. | Synthesis engine. | Every content write. | `0` means starter/empty page or no prose. |
| `status` | `text` | Lifecycle state: `active`, `archived`, or `deleted`. Read paths exclude `deleted`. | Synthesis engine; future health/archive path. | Row creation and lifecycle changes. | Defaults to `active` in current schema. |
| `effective_date` | `date` | Date from which the page content is valid, especially sprint/longitudinal pages. | Synthesis engine. | When source has temporal validity. | No validity window known. |
| `observed_date` | `date` | Date the source was observed/uploaded. | Synthesis engine. | Document/thread/sprint/artifact ingestion. | No observation date known. |
| `review_date` | `date` | Staleness/review signal derived from source recency and page kind. | Synthesis engine. | Create/resynthesis. | No scheduled review yet. |
| `origin_thread_id` | `text` | CSO thread id for `thread_synthesis` pages. | Synthesis engine. | Thread-derived page creation/update. | Page did not originate from a CSO thread. |
| `synthesis_job_id` | `text` | Async synthesis job id that last wrote the synthesized base. | Synthesis engine. | Every engine write. | Legacy/manual/starter row or no job tracking yet. |
| `pinecone_vector_id` | `text` | Deprecated legacy Pinecone handle. New paths never read or write it. | No new writer. | Never in new code. | Expected. |
| `embedding` | `vector(1536)` | Page-level pgvector embedding for semantic page retrieval. | Synthesis/embedding service in sub-phase 05. | Embedding creation/refresh. | Page has not been embedded. |
| `recall_count` | `integer` | Memory substrate count of genuine retrievals. | Connection phase. Engine sets default `0`. | Incremented on retrieval after connection phase. | `0` means not recalled yet. |
| `last_recalled_at` | `timestamptz` | Most recent genuine retrieval timestamp. | Connection phase. | Retrieval after connection phase. | Never recalled or recall tracking dormant. |
| `promotion_state` | `text` | Memory substrate state: `default`, `promoted`, or `dormant`; extensible, no DB CHECK. | Engine on create; connection/memory phase later. | Create and memory-loop updates. | Never blank; engine creates as `default`. |
| `last_updated` | `timestamptz` | User-facing page update/sort timestamp. | Synthesis engine. | Every synthesis write. | Never blank. |
| `updated_at` | `timestamptz` | Generic row update timestamp. | Database/app update path. | Every row update. | Never blank. |

Reserved phase ownership:

- synthesis engine writes: `page_type`, `page_kind`, `page_title`, `content`, `category`, `domain`,
  `source_file_ids`, `canonical_key`, `confidence`, `word_count`, `status`, `effective_date`,
  `observed_date`, `review_date`, `origin_thread_id`, `synthesis_job_id`, `embedding`, `last_updated`,
  and `promotion_state` defaults.
- founder correction path writes: `ose_page_corrections.body` and `ose_page_corrections.status`; it
  does not write `ose_knowledge_pages.content` directly.
- connection phase reserves: `recall_count`, `last_recalled_at`, and post-beta updates to
  `promotion_state`.

## Page Kind Vocabulary

`page_kind` is the emergent taxonomy axis. It is extensible config, not a database CHECK constraint.
Canonical config location: `src/config/doc_wiki_schema.json`. New kinds are added by editing config
and updating engine validation, not by running a migration.

| `page_kind` | Meaning | Primary sources |
|---|---|---|
| `client` | A specific client or prospect. | Documents. |
| `competitor` | A named competitor. | Documents. |
| `vendor_partner` | Tool, vendor, or strategic partner. | Documents. |
| `offer` | A productized service or offer. | Documents, sprint artifacts. |
| `method` | A methodology, framework, or process. | Documents, CSO threads. |
| `market_trend` | A market pattern or macro signal. | Documents. |
| `comparison` | A head-to-head or decision matrix. | Documents, CSO threads. |
| `query_answer` | A filed answer to a specific founder question. | CSO threads. |
| `sprint_history` | A completed sprint record. | Sprint data. |
| `capability_evolution` | AE Ladder/capability arc over time. | Sprint and diagnostic data. |
| `thread_synthesis` | A substantive CSO conversation distilled into a page. | CSO threads. |
| `agent_artifact` | A domain-agent output that earned its own page. | Domain-agent artifacts. |
| `entity` | Generic named entity that does not fit a more specific kind. | Documents. |
| `concept` | A named concept, principle, or idea. | Documents, CSO threads. |

## Page Type Bridge Rule

`page_type` and `page_kind` must never be collapsed.

- `page_type` is the existing Layer-1 bridge/area value constrained to `business_context`,
  `assessment_intelligence`, `strategic_context`, `financial_patterns`,
  `conversation_intelligence`, and `custom`.
- `page_kind` is the emergent topic/type vocabulary above.
- The synthesis engine sets `page_type` from `kind_to_page_type` in `src/config/doc_wiki_schema.json`.
- Fully emergent pages with no Layer-1 counterpart default `page_type` to `custom`.

## Provenance Contract

### Document Manifest

`source_file_ids[]` is the page-to-document manifest. Each value is an
`ose_raw_document_registry.id` that contributed to the page. The synthesis engine maintains this array
on every create/update. It adds new source ids and removes ids only when a source document is deleted.
There is no DB FK array; this is an app-level invariant.

### Reverse Manifest

`ose_raw_document_registry.connected_pages[]` is the document-to-page reverse manifest. The synthesis
engine updates it in the same unit of work as `source_file_ids[]`, or performs a compensating update
before completing the job.

Manifest coherence rule:

```text
page.source_file_ids contains doc_id <=> doc.connected_pages contains page.id
```

Any divergence is a lint finding for sub-phase 06.

### Inline Citations

`content` uses machine-parseable inline citations. Canonical format:

```text
[[Source: raw_document:{document_id}#chunk:{chunk_id}|{doc_title} section {section_label}]]
```

When chunk id is unavailable, omit the `#chunk:{chunk_id}` segment. Citations resolve to
`ose_raw_document_registry` ids or `document_chunks` ids. Page-bottom source lists, YAML frontmatter,
and footnote-only provenance are outside this contract.

### Non-Document Sources

Thread, sprint, and agent-artifact pages may have empty `source_file_ids`. Their provenance is carried
by `origin_thread_id`, `synthesis_job_id`, `effective_date`, and `observed_date`. If a non-document
page also used uploaded documents, it still records those documents in `source_file_ids`.

## Links Contract

Semantic page-to-page links live in `public.ose_page_links`, not in prose wiki-link syntax.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id)`
- `from_page_id uuid not null references public.ose_knowledge_pages(id) on delete cascade`
- `to_page_id uuid not null references public.ose_knowledge_pages(id) on delete cascade`
- `relation text`
- `created_at timestamptz not null default now()`

Relation vocabulary is extensible config, not a DB CHECK: `related`, `supersedes`, `supports`,
`contradicts`, `derived_from`, `summarizes`.

RLS mirrors `ose_knowledge_pages`: authenticated users can manage rows where `auth.uid() = user_id`.
Uniqueness: `(user_id, from_page_id, to_page_id)` prevents duplicate directional links.

The synthesis engine targets at least two semantic links per page. A page with zero incoming and zero
outgoing links is an orphan lint finding.

## Index And Log Semantics

The index is `ose_knowledge_pages` rendered through the existing IndexView. The engine must populate
`page_title`, `page_kind`, `category`, `word_count`, `status`, `source_file_ids`, and `last_updated`.

The event log is `ose_activity_log`. Engine event rows use:

- `kind = 'activity'` for ingestion/synthesis events.
- `kind = 'decision'` for judgment events such as contradiction flagged, page-worthiness skipped, or
  correction applied.
- `text = '[EventType] {details}'`.

No markdown `index.md` or `log.md` exists in this substrate.

## Read Operations

All operations return `agent_result_v1` with first-class citations.

### docwiki_get_page

Signature:

```text
docwiki_get_page(user_id: string, canonical_key?: string, page_id?: uuid) -> agent_result_v1
```

Args:

- `user_id`: founder owner id.
- `canonical_key`: stable page key. Required unless `page_id` is supplied.
- `page_id`: page id. Required unless `canonical_key` is supplied.

Return shape:

```text
{
  schema_version: "agent_result_v1",
  summary: string,
  findings: [{
    type: "docwiki_page",
    page_object: object,
    links: object[],
    corrections_overlay_applied: boolean
  }],
  citations: AgentSourceRef[],
  confidence: number,
  needs_review: boolean,
  reasoning_visibility: "summary_only",
  source_count: number
}
```

Error modes: `not_found`, `unauthorized`, `invalid_page_ref`.

Actor scope: Virtual CSO, OS Engine, Domain Agents, orchestrator read path.

Invariant upheld: page reads return founder-owned markdown, metadata, links, and provenance without
granting a write surface.

### docwiki_search

Signature:

```text
docwiki_search(user_id: string, query: string, page_kind?: string, category?: string, limit?: int = 5) -> agent_result_v1
```

Args:

- `user_id`: founder owner id.
- `query`: semantic search query.
- `page_kind`: optional config-vocabulary filter.
- `category`: optional OSE category filter.
- `limit`: max result count, default `5`.

Return shape:

```text
{
  schema_version: "agent_result_v1",
  summary: string,
  findings: [{
    type: "docwiki_search_result",
    pages: object[],
    ranking: object
  }],
  citations: AgentSourceRef[],
  confidence: number,
  needs_review: boolean,
  reasoning_visibility: "summary_only",
  source_count: number
}
```

Error modes: `invalid_query`, `invalid_page_kind`, `invalid_category`, `unauthorized`.

Actor scope: Virtual CSO, Domain Agents, orchestrator read path.

Invariant upheld: search returns ranked page-level results only; chunk retrieval remains Tier 2 support.

### docwiki_list

Signature:

```text
docwiki_list(user_id: string, category?: string, page_kind?: string, status?: string = "active", limit?: int = 20) -> agent_result_v1
```

Args:

- `user_id`: founder owner id.
- `category`: optional OSE category filter.
- `page_kind`: optional config-vocabulary filter.
- `status`: lifecycle filter, default `active`.
- `limit`: max index rows, default `20`.

Return shape:

```text
{
  schema_version: "agent_result_v1",
  summary: string,
  findings: [{
    type: "docwiki_index",
    index: [{
      title: string,
      kind: string,
      category: string,
      word_count: number,
      last_updated: string,
      canonical_key: string
    }]
  }],
  citations: AgentSourceRef[],
  confidence: number,
  needs_review: boolean,
  reasoning_visibility: "summary_only",
  source_count: number
}
```

Error modes: `invalid_page_kind`, `invalid_category`, `invalid_status`, `unauthorized`.

Actor scope: all registered read-capable surfaces.

Invariant upheld: index reads expose catalog metadata without scraping prose or accessing deleted pages
by default.

## Write Surface

### Engine Synthesis Write

Signature:

```text
internal_synthesize_docwiki_page(user_id: string, source_refs: object[], synthesis_job_id: string) -> { page_id: uuid, canonical_key: string, status: string }
```

Actor scope: synthesis engine through service role only.

Writes: `content`, metadata fields, `source_file_ids`, `embedding` when embedding service is active,
`ose_page_links`, and `ose_activity_log`.

Error modes: `unauthorized_service_role`, `invalid_page_kind`, `manifest_write_failed`,
`dedup_conflict_unresolved`, `source_not_found`.

Invariant upheld: the synthesis engine is the sole writer of page prose.

### Founder Correction

Signature:

```text
addPageCorrection(page_id: uuid, body: string) -> { correction_id: uuid, status: "pending" }
```

Actor scope: founder through `NotesComposer` and `lib/osEngineApi.ts`.

Writes: `ose_page_corrections.body` and `ose_page_corrections.status`.

Error modes: `not_found`, `unauthorized`, `empty_body`.

Invariant upheld: founder corrections are preserved overlays. The engine reads pending corrections,
applies them during re-synthesis, marks them `applied`, and never clobbers founder edits.

Hard exclusion: no agent-facing `docwiki_write_page` tool exists.

## Layer-1 Bridge Contract

Layer 1 page keys map to OSE page types as verified in `config/wiki_schema.json`:

| Layer-1 `page_key` | `ose_page_type` |
|---|---|
| `business_context` | `business_context` |
| `diagnostic_synthesis` | `assessment_intelligence` |
| `current_quarter_sprint` | `strategic_context` |
| `growth_constraints` | `strategic_context` |
| `financial_context` | `financial_patterns` |
| `client_market_position` | `business_context` |
| `open_questions` | `conversation_intelligence` |

Layer 2 enriches Layer 1 by making matching `page_type` pages readable as contextual depth. Layer 2
never writes Layer 1 `wiki_claims` or `wiki_evidence`, and never duplicates the claim store. From
Layer 1's perspective, the bridge is read-only.

## Memory Substrate Hooks

These fields are dormant in beta but must be present now:

- `recall_count`: incremented by the connection phase when a page is genuinely retrieved in a CSO or
  agent context. Engine sets `0` on page creation.
- `last_recalled_at`: set by the connection phase to the most recent genuine retrieval time. Engine
  leaves it null on page creation.
- `promotion_state`: memory-loop state. Engine sets `default` on page creation. The memory/connection
  phase may later set `promoted`, `dormant`, or future states without requiring a DB CHECK migration.

## Hard Guarantees

1. The synthesis engine is the sole writer of `content`. No other actor writes page prose.
2. Founder corrections (`ose_page_corrections`) are preserved overrides. They survive every
   re-synthesis and are never clobbered.
3. Every engine-created page has a `canonical_key`. Dedup is enforced at write time via the
   `(user_id, canonical_key)` unique partial index.
4. `source_file_ids[]` and `ose_raw_document_registry.connected_pages[]` are always kept coherent by
   the synthesis engine. There is no DB FK array; this is an app-level invariant.
5. Contradictions are flagged, never resolved. The engine writes the flag; the founder resolves.
6. `pinecone_vector_id` is never written or read by any new code path. pgvector is the page-embedding
   substrate.
7. `page_kind` is never DB-CHECK constrained. It is extensible config; the engine validates against
   the vocabulary at synthesis time.
8. Layer 2 pages never duplicate Layer 1's claim store. The bridge is read-only from Layer 1's
   perspective.
