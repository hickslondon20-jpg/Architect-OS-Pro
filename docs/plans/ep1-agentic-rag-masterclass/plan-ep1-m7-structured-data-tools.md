# Agentic RAG Module 7: Structured Data Tools and External Fallbacks

This plan adapts the reference Module 7 "Additional Tools" idea for ArchitectOS Pro. The reference module calls for text-to-SQL and web search fallback. In ArchitectOS, this must become a governed structured-data workspace that lets agents analyze founder datasets safely without letting agents create arbitrary platform tables, views, functions, or unmanaged schemas.

The intent is simple: make structured agency data usable for analysis now, keep the database organized, and leave room to make the analyst layer more powerful later.

## Current Gate Context

Modules 2-6 are scaffolded and partially verified:

- Module 2 established raw upload storage, registry rows, chunks, embeddings, and retrieval, but full upload -> chunks -> retrieval smoke is still OpenAI quota-gated.
- Module 3 added duplicate/record-manager behavior, but isolated live duplicate smoke remains pending.
- Module 4 added metadata extraction settings/schema and metadata-filtered retrieval, but live LLM extraction remains OpenAI quota-gated.
- Module 5 added Docling-only multi-format parser metadata and lifecycle fields, but parser fixture smoke should move to the hosted Python/FastAPI runtime return pass.
- Module 6 made hybrid/RRF retrieval the default and added optional Cohere reranking, with live RRF SQL smoke passed and API/key smokes pending.

Module 7 should not depend on OpenAI quota to create its schema/tool scaffolding. Any normalization that uses LLMs can be wired with placeholders and marked as provider/key/quota-gated for full smoke.

## Locked Decisions

> [!NOTE]
> **No Freeform Agent DDL**
> Agents must not directly create arbitrary Supabase tables, views, functions, policies, or schemas from chat. Text-to-SQL is read-only over approved query surfaces.

> [!NOTE]
> **Governed Dataset Workspace**
> Founder structured data belongs in controlled `founder_dataset_*` tables with strict ownership, provenance, and audit logging. This avoids dozens or hundreds of one-off user-created database objects.

> [!NOTE]
> **Safe First, Powerful Later**
> Module 7 should build the safe path: dataset registry, normalized rows/columns, read-only query execution, and audit logs. Do not build the full autonomous analyst yet.

> [!NOTE]
> **Agency Data Normalization Is the Centerpiece**
> The long-term value is normalizing messy P&Ls, QuickBooks exports, utilization sheets, capacity trackers, client concentration files, and similar agency data into consistent analysis-ready shapes.

> [!NOTE]
> **Web Search Is Optional and Clearly Attributed**
> Web search fallback can be scaffolded, but it must be config-gated, citation-first, and kept separate from private founder data unless a later explicit policy allows private context in external searches.

## Architecture Constraints

- Raw founder uploads remain in Supabase Storage bucket `raw-documents`.
- Synthesized Wiki artifacts remain in `kb-files`.
- Raw upload metadata remains in `public.ose_raw_document_registry`.
- Searchable raw chunks remain in `public.document_chunks`.
- Embeddings remain OpenAI `text-embedding-3-small` with `vector(1536)`.
- Retrieval remains exposed through `public.match_document_chunks`.
- Virtual CSO chat remains Claude Sonnet through Vercel serverless and canonical `vcso_*` tables.
- Batch/scheduled synthesis remains N8N.
- Docling remains the parser path for structured files in the Python/FastAPI ingestion service.
- No local or self-hosted LLMs.
- User isolation is mandatory on every dataset, row, query, and result.
- Do not expose internal database language in founder-facing UI. Use language like datasets, mapped metrics, analysis-ready data, source rows, and reviewed mappings.

## Proposed Module Shape

Module 7 should add three controlled tool families:

1. **Dataset Normalization Scaffold**
   - Converts uploaded structured files into a governed dataset workspace.
   - Stores source structure, normalized columns, row values, period metadata, and provenance.
   - Can start deterministic/parser-first, with LLM-assisted semantic mapping behind config when available.

2. **Read-Only Structured Query Tool**
   - Lets Virtual CSO/domain agents answer questions over approved founder datasets.
   - Uses constrained SELECT-only SQL against approved views/functions or a tightly controlled schema surface.
   - Requires user scoping, limits, timeouts, audit logging, and rejection of unsafe SQL.

3. **Web Search Fallback Scaffold**
   - Provides a future fallback when private documents/datasets do not answer a question.
   - Must be disabled by default unless provider/key/settings are configured.
   - Must return citations and separate external evidence from founder-private evidence.

## Proposed Schema

### [NEW] `docs/migrations/008_structured_data_tools.sql`

Create the governed dataset workspace in `public` with RLS enabled on every table.

Recommended tables:

#### `public.founder_datasets`

One row per uploaded/imported dataset.

Suggested fields:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null`
- `source_document_id uuid null references public.ose_raw_document_registry(id) on delete set null`
- `dataset_name text not null`
- `dataset_type text null` such as `pnl`, `expenses`, `utilization`, `capacity`, `client_concentration`, `pipeline`, `generic_table`
- `status text not null default 'created'` with allowed values like `created`, `mapping`, `ready`, `needs_review`, `failed`, `archived`
- `source_period_grain text null` such as `day`, `week`, `month`, `quarter`, `year`, `mixed`, `unknown`
- `normalized_period_grain text null`
- `source_time_zone text null`
- `currency_code text null`
- `confidence numeric null`
- `summary text null`
- `provenance jsonb not null default '{}'::jsonb`
- `metadata jsonb not null default '{}'::jsonb`
- timestamps

#### `public.founder_dataset_tables`

One row per sheet/table detected inside a dataset.

Suggested fields:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null`
- `dataset_id uuid not null references public.founder_datasets(id) on delete cascade`
- `table_key text not null`
- `label text null`
- `source_sheet_name text null`
- `source_table_name text null`
- `row_count integer null`
- `column_count integer null`
- `parser_metadata jsonb not null default '{}'::jsonb`
- timestamps

#### `public.founder_dataset_columns`

One row per detected source column, with optional normalized meaning.

Suggested fields:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null`
- `dataset_id uuid not null references public.founder_datasets(id) on delete cascade`
- `table_id uuid not null references public.founder_dataset_tables(id) on delete cascade`
- `source_column_name text not null`
- `source_column_index integer null`
- `normalized_key text null` such as `revenue`, `cogs`, `payroll_expense`, `billable_hours`, `available_capacity_hours`, `client_name`
- `data_type text null` such as `text`, `number`, `currency`, `percent`, `date`, `boolean`, `json`
- `semantic_role text null` such as `metric`, `dimension`, `period`, `entity`, `amount`, `rate`, `notes`
- `unit text null`
- `confidence numeric null`
- `requires_review boolean not null default false`
- `metadata jsonb not null default '{}'::jsonb`
- timestamps

#### `public.founder_dataset_rows`

Stores row-level source and normalized values without creating arbitrary per-user tables.

Suggested fields:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null`
- `dataset_id uuid not null references public.founder_datasets(id) on delete cascade`
- `table_id uuid not null references public.founder_dataset_tables(id) on delete cascade`
- `source_row_index integer null`
- `row_label text null`
- `period_start date null`
- `period_end date null`
- `period_grain text null` such as `day`, `week`, `month`, `quarter`, `year`, `unknown`
- `entity_name text null`
- `values jsonb not null default '{}'::jsonb`
- `normalized_values jsonb not null default '{}'::jsonb`
- `provenance jsonb not null default '{}'::jsonb`
- `confidence numeric null`
- `requires_review boolean not null default false`
- timestamps

#### `public.founder_dataset_queries`

Audit log for generated structured-data queries.

Suggested fields:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null`
- `thread_id uuid null`
- `tool_call_id text null`
- `question text not null`
- `generated_sql text null`
- `approved_query_surface text null`
- `status text not null default 'created'` with `created`, `validated`, `rejected`, `executed`, `failed`
- `rejection_reason text null`
- `execution_ms integer null`
- `row_count integer null`
- `metadata jsonb not null default '{}'::jsonb`
- timestamps

#### `public.founder_dataset_query_results`

Optional stored result snapshots for tool transparency and follow-up analysis.

Suggested fields:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null`
- `query_id uuid not null references public.founder_dataset_queries(id) on delete cascade`
- `result_rows jsonb not null default '[]'::jsonb`
- `result_summary text null`
- `metadata jsonb not null default '{}'::jsonb`
- timestamps

### Optional Approved Views

If views are created, they must use `security_invoker = true` on Postgres 15+ and must preserve user scoping.

Possible future views:

- `public.founder_dataset_rows_v`
- `public.founder_financial_metrics_v`
- `public.founder_utilization_metrics_v`

Module 7 may create only minimal views needed for the read-only query tool. Avoid premature taxonomy-heavy views until the normalization model is clearer.

## RLS and Access Requirements

Every new table must:

- Enable RLS.
- Include user-owned policies scoped by `(select auth.uid()) = user_id`.
- Use `TO authenticated` plus ownership checks, not role-only policies.
- For update policies, include both `USING` and `WITH CHECK`.
- Avoid `SECURITY DEFINER` unless absolutely required; if required, keep it out of public and require explicit ownership checks.
- Avoid broad anon/authenticated grants unless the existing app access pattern requires them and RLS is verified.

Every query path must:

- Filter by the requesting `user_id`.
- Reject cross-user access even if a malicious user supplies another `user_id`, `dataset_id`, `table_id`, or raw SQL predicate.
- Log rejected attempts where practical.

## Python Backend Scope

### [NEW] `python-backend/services/structured_data.py`

Add a service for dataset registration and normalization scaffolding.

Responsibilities:

- Create/update `founder_datasets` from registry rows that contain supported structured files.
- Record detected tables/sheets and parser metadata from Docling/parser output.
- Store columns and rows in the governed dataset tables.
- Normalize obvious period fields and simple data types where deterministic parsing is safe.
- Mark uncertain mappings as `requires_review = true` rather than pretending confidence is high.
- Preserve provenance back to source document, table, row, and column.

Do not build a full semantic financial taxonomy in this module. Seed only enough normalized keys/roles to prove the scaffold.

### [NEW] `python-backend/services/structured_query.py`

Add a read-only query validator/executor.

Requirements:

- Accept a user question and either generated SQL or a structured query plan.
- Only allow `SELECT` queries.
- Reject DDL/DML and dangerous statements, including `CREATE`, `ALTER`, `DROP`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `GRANT`, `REVOKE`, `COPY`, `CALL`, `DO`, `EXECUTE`, `SET`, comments hiding extra statements, and multi-statement SQL.
- Restrict queries to approved dataset tables/views only.
- Require a hard row limit and timeout.
- Enforce or inject user scoping server-side.
- Audit query attempts in `founder_dataset_queries` and optional result snapshots in `founder_dataset_query_results`.
- Return compact result summaries that Virtual CSO can cite back to the founder.

Prefer a structured SQL parser if a suitable dependency already exists or can be safely added. If not, keep the validator conservative and easy to reject.

### Optional LLM Use

If an LLM is used for SQL generation or semantic mapping:

- Use provider/model settings from `ai_models` and `platform_ai_settings` where practical.
- Do not send arbitrary private data externally for web search.
- Keep Claude Sonnet as the Virtual CSO chat model; do not move chat synthesis into Python.
- If using OpenAI for structured mapping, make it config-gated and report OpenAI quota as a verification blocker if it occurs.

## API / Tool Surface Scope

Module 7 may add Python API endpoints or internal service methods for execution-agent smoke tests, such as:

- `POST /api/datasets/register`
- `POST /api/datasets/{dataset_id}/normalize`
- `POST /api/tools/structured-query`
- `POST /api/tools/web-search` as disabled/fail-closed scaffold only

Keep endpoints service-side. Do not expose unsafe query execution to the browser.

If wiring into Virtual CSO is included, keep it minimal:

- The Vercel chat route may know that a structured-data tool exists.
- The actual tool execution should remain server-side.
- Do not change canonical `vcso_*` table ownership.
- Do not rewrite the chat interface.
- Do not build Module 8 sub-agents yet.

## Frontend Scope

Keep frontend work very light and additive.

Allowed:

- Show a small dataset/mapping status in the OS Engine Uploads detail panel if a source document creates a dataset.
- Use founder-facing labels such as `Dataset`, `Mapped metrics`, `Review needed`, and `Analysis ready`.

Not allowed in Module 7:

- A full admin data workbench.
- A raw SQL editor.
- A user-facing table/schema creator.
- Exposing internal table names or platform schema details to founders.
- Rebuilding OS Engine, Uploads, Wiki, or Virtual CSO UI.

## Web Search Fallback Scope

Module 7 can scaffold provider configuration and a disabled tool wrapper.

Requirements:

- Disabled by default.
- Provider/API key placeholder only, no secrets.
- Results must include URL, title, snippet/summary, and retrieval timestamp.
- Returned answers must distinguish external web evidence from private founder evidence.
- Do not include private founder data in external search queries unless a future explicit privacy policy allows it.

Add progress notes for the future provider choice and privacy policy.

## Period Normalization Policy for Iteration 1

The first pass should store period information without over-normalizing.

Required behavior:

- Detect and store `period_start`, `period_end`, and `period_grain` when obvious.
- Support `month`, `quarter`, `year`, `mixed`, and `unknown` at minimum.
- Preserve original period labels in `values` or provenance.
- Mark ambiguous period mappings as `requires_review`.
- Do not force monthly data, quarterly data, and annual data into one merged metric table yet.

Future behavior to log, not fully build now:

- Monthly/quarterly/yearly rollups.
- Period alignment across mixed-grain documents.
- Confidence scoring for inferred periods.
- Review/approval UX before normalized metrics power major strategy answers.

## Verification Plan

### Code Verification

- Run `python -m compileall python-backend`.
- Run `npm.cmd run build` if TypeScript/frontend/API client files change.
- Add small service-level tests or smoke scripts for SQL rejection/acceptance if practical.

### Migration Artifact Verification

- Confirm `008_structured_data_tools.sql` exists and is idempotent enough for the project migration style.
- Confirm all new tables/indexes/policies are included.
- Confirm no arbitrary user-generated table creation path exists.

### Live Supabase Verification

Apply or verify the migration live. Then confirm:

- All `founder_dataset_*` tables exist.
- RLS is enabled using `pg_class.relrowsecurity`.
- Policies are ownership-scoped, not merely `TO authenticated`.
- Indexes exist for `user_id`, `dataset_id`, `table_id`, and useful JSONB search where added.
- Cross-user selects return zero rows.
- Query audit tables are also user-scoped.
- Any views are `security_invoker = true` or otherwise protected.

### Structured Query Safety Smoke

Use synthetic rows, not private production data.

Required cases:

- A valid SELECT over the current user's dataset returns expected rows.
- A query for another user's dataset returns zero or is rejected.
- DDL is rejected.
- INSERT/UPDATE/DELETE are rejected.
- Multi-statement SQL is rejected.
- Unapproved tables such as platform tables, auth tables, and raw schema internals are rejected.
- Missing LIMIT is capped or rejected.
- Audit rows are created for accepted and rejected attempts.

### Dataset Scaffold Smoke

Use a small CSV/XLSX-style fixture or direct parser fixture data.

Required cases:

- Create a dataset from a source document id.
- Insert a table, columns, and rows.
- Store source values and normalized values.
- Store period fields where obvious.
- Mark ambiguous mapping as `requires_review`.
- Delete/archive behavior does not leak rows across users.

### Web Search Scaffold Smoke

If implemented in Module 7:

- With no provider/key, tool is disabled/fail-closed with a clear response.
- No private founder data is sent externally.
- If a key is configured, return citations and timestamped web evidence.

## Completion Criteria

Module 7 can be considered scaffolded when:

- The governed structured-data plan is implemented without arbitrary agent-created platform schema objects.
- Migration artifact exists and is live-applied or explicitly marked pending.
- `founder_dataset_*` tables exist with RLS and ownership policies.
- Dataset registration/normalization scaffold can store tables, columns, rows, periods, provenance, and review flags.
- Read-only structured query tool rejects unsafe SQL and unapproved tables.
- Synthetic query smoke proves user isolation and audit logging.
- Web search fallback is either scaffolded disabled-by-default or explicitly deferred with config notes.
- Frontend changes, if any, are small Uploads/detail additions only.
- `Pro-Suite-Progress.md` is updated with separate statuses for code artifact, migration artifact, live Supabase apply, structured query safety smoke, dataset scaffold smoke, and web search/provider blockers.

## Explicit Non-Goals

- Do not build Module 8 sub-agents.
- Do not build a raw SQL editor.
- Do not let agents create arbitrary Supabase tables, views, or functions.
- Do not expose platform schema internals to founders.
- Do not normalize every agency financial/use case taxonomy in this module.
- Do not merge raw document retrieval with Wiki page retrieval here.
- Do not change Virtual CSO's canonical `vcso_*` storage or Claude Sonnet chat boundary.
- Do not add local or self-hosted LLMs.

## Future Expansion Notes To Preserve

- Build a canonical agency metric taxonomy for P&L, expenses, payroll, utilization, capacity, client concentration, pipeline, and delivery performance.
- Decide how normalized metrics roll up and drill down across monthly, quarterly, annual, and mixed-grain data.
- Add a review UX for low-confidence mappings before those mappings power high-stakes analysis.
- Add approved query views/functions for common analyst questions once the row model is proven.
- Consider whether structured dataset summaries should be promoted into Wiki pages later, while keeping raw datasets and synthesized Wiki artifacts as separate memory layers.
- Decide which web search provider to use and what privacy policy governs external queries.
