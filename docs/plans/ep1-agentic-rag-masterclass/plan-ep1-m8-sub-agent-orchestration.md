# Agentic RAG Module 8: Sub-Agent Orchestration Scaffold

This plan adapts the reference Module 8 "Sub-Agents" idea for ArchitectOS Pro. The reference module focuses on detecting full-document scenarios, spawning isolated sub-agents, and showing nested tool work in the chat UI. In ArchitectOS, Module 8 should become the first shared agent orchestration layer that Virtual CSO, OS Engine, Domain Agents, and later planning helpers can all use.

This is not the full autonomous agent harness. It is the scaffold: capability registry, scoped delegation, durable run records, safe tool permissions, and a future-ready trace shape.

## Current Gate Context

Modules 2-7 are scaffolded and partially verified:

- Module 2 established raw upload storage, registry rows, chunks, embeddings, and retrieval, but full upload -> chunks -> retrieval smoke is still OpenAI quota-gated.
- Module 3 added duplicate/record-manager behavior, with isolated live duplicate smoke still pending.
- Module 4 added metadata extraction settings/schema and metadata-filtered retrieval, with full live LLM extraction still OpenAI quota-gated.
- Module 5 added Docling-only parser metadata and lifecycle fields, with hosted Python parser fixture smoke deferred.
- Module 6 made hybrid/RRF retrieval the default and added optional Cohere reranking, with live RRF SQL smoke passed and API/key smokes pending.
- Module 7 added governed structured-data tools, `founder_dataset_*` tables, SELECT-only query safety, audit logging, and disabled web-search scaffold.

Module 8 should use those tools as available capability surfaces, but must not require the OpenAI/Cohere return passes to complete before scaffolding sub-agent delegation.

## Locked Decisions

> [!NOTE]
> **Sub-Agents Are Bounded Specialists**
> A sub-agent is not another open-ended chatbot. It is a temporary specialist given a scoped task, scoped context, allowed tools, and a structured output contract.

> [!NOTE]
> **Main Agent Owns The Conversation**
> Virtual CSO or the parent surface remains the voice of the conversation. Sub-agents perform bounded work and return evidence/results to the parent.

> [!NOTE]
> **Shared Registry, Many Surfaces**
> Agent capabilities should live in a shared registry that can eventually serve Virtual CSO, OS Engine, Domain Agents, and Sprint Planning helpers.

> [!NOTE]
> **Safe Scaffold First**
> Module 8 should add durable orchestration records, capability definitions, scoped context, and trace summaries. Do not build the full Deep Mode, workspace filesystem, domain harness engine, or autonomous workflow executor yet.

> [!NOTE]
> **No Raw Chain-of-Thought Display**
> UI and API traces should expose task summaries, tool/source usage, evidence, confidence, and outputs. Do not expose raw hidden reasoning or chain-of-thought.

## Architecture Constraints

- Raw founder uploads remain in Supabase Storage bucket `raw-documents`.
- Synthesized Wiki artifacts remain in `kb-files`.
- Raw upload metadata remains in `public.ose_raw_document_registry`.
- Searchable raw chunks remain in `public.document_chunks`.
- Retrieval remains exposed through `public.match_document_chunks`.
- Structured data remains in governed `founder_dataset_*` tables.
- Virtual CSO chat remains Claude Sonnet through Vercel serverless and canonical `vcso_*` tables.
- Batch/scheduled synthesis remains N8N.
- Docling remains the parser path for structured files in the Python/FastAPI ingestion service.
- No local or self-hosted LLMs.
- User isolation is mandatory for every sub-agent capability, run, step, tool call, source, and result.
- Sub-agents must not get broad database access. They receive scoped context bundles and approved tool permissions.
- Do not expose internal registry/prompt/tooling language in founder-facing UI.

## Relationship To Episode 6 Agent Harness

The future Episode 6 `Agent Harness & Domain-Specific Workflows` PRD includes Deep Mode, todo planning, virtual workspace files, task delegation, ask-user, deterministic harness phases, and domain workflows.

Module 8 should not implement that full feature set. It should create the reusable foundation that later Episode 6 can build on:

- capability registry
- sub-agent run records
- scoped context bundle shape
- tool permission model
- trace/result schema
- first safe sub-agent service wrapper

Do not add Deep Mode toggles, workspace filesystem, general-purpose task recursion, ask-user pauses, or deterministic harness state machines in this module.

## Proposed Module Shape

Module 8 has four parts.

### 1. Agent Capability Registry

A shared registry describes what sub-agent capabilities exist and where they are allowed.

Example capabilities:

- `document_analysis_agent`
- `retrieval_evidence_agent`
- `structured_data_agent`
- `metadata_review_agent`
- `strategy_synthesis_agent` as future/non-executable placeholder
- `sprint_planning_helper` as future/non-executable placeholder

Each capability should define:

- key/name
- founder-facing label
- internal description
- allowed surfaces: `virtual_cso`, `os_engine`, `domain_agent`, `sprint_planning`
- allowed tools: retrieval, structured query, document summary, metadata lookup, web search disabled by default
- allowed source kinds: raw chunks, document registry rows, founder datasets, wiki pages later
- model routing preference or setting key
- max rounds/timeout
- output schema/version
- enabled/disabled state
- whether it can spawn other agents, default false

### 2. Delegation Run Records

Every sub-agent task should be durable and auditable.

Run records should capture:

- user_id
- parent surface
- parent thread/message ids when available
- parent agent/capability if relevant
- sub-agent capability key
- status
- task prompt or task summary
- scoped input references
- allowed tools snapshot
- result summary
- structured result JSON
- citations/provenance
- error text
- timing and token/cost metadata when available

### 3. Scoped Context Builder

A sub-agent should not receive the full founder workspace. It should receive a bounded context bundle.

Context bundles may include:

- selected document ids
- selected chunk ids or retrieval filters
- selected dataset ids/tables
- metadata filters
- source document metadata
- parent question/task
- parent surface
- user id
- allowed tools
- max source limits

The service should enforce the scope server-side. A malicious request should not be able to pass another user's ids or broaden the context beyond allowed records.

### 4. Hierarchical Trace Shape

Even if UI changes are minimal now, the backend/API should return a future-ready trace shape.

Trace entries should show:

- which sub-agent was called
- what task it handled
- status and duration
- which tools were used
- which sources were consulted
- compact findings
- confidence/review flags
- citations/provenance
- errors if any

Do not expose raw hidden reasoning. Use `work_summary`, `evidence_summary`, or `trace_summary` instead.

## Proposed Schema

### [NEW] `docs/migrations/009_sub_agent_orchestration.sql`

Create shared orchestration tables in `public` with RLS enabled on every user-data table.

#### `public.agent_capabilities`

Registry of available sub-agent types. This table may include platform/admin-owned rows and should not expose private user data.

Suggested fields:

- `id uuid primary key default gen_random_uuid()`
- `capability_key text unique not null`
- `label text not null`
- `description text not null`
- `status text not null default 'disabled'` with values like `enabled`, `disabled`, `experimental`
- `allowed_surfaces text[] not null default '{}'::text[]`
- `allowed_tools text[] not null default '{}'::text[]`
- `allowed_source_kinds text[] not null default '{}'::text[]`
- `model_setting_key text null`
- `output_schema jsonb not null default '{}'::jsonb`
- `default_config jsonb not null default '{}'::jsonb`
- `can_spawn_agents boolean not null default false`
- timestamps

Seed initial rows disabled/experimental where appropriate:

- `document_analysis_agent`
- `retrieval_evidence_agent`
- `structured_data_agent`
- `metadata_review_agent`
- `strategy_synthesis_agent` placeholder
- `sprint_planning_helper` placeholder

Access note:

- Prefer no broad write grants from clients.
- If readable by authenticated users, expose only non-sensitive registry fields and keep RLS/security posture explicit.
- Admin editing UI is out of scope.

#### `public.agent_delegation_runs`

One row per sub-agent run.

Suggested fields:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null`
- `capability_id uuid null references public.agent_capabilities(id)`
- `capability_key text not null`
- `parent_surface text not null` such as `virtual_cso`, `os_engine`, `domain_agent`, `sprint_planning`, `system`
- `parent_thread_id uuid null`
- `parent_message_id uuid null`
- `parent_run_id uuid null references public.agent_delegation_runs(id)` for future nesting
- `status text not null default 'queued'` with values like `queued`, `running`, `completed`, `failed`, `cancelled`, `skipped`
- `task_title text null`
- `task_summary text not null`
- `context_scope jsonb not null default '{}'::jsonb`
- `allowed_tools_snapshot jsonb not null default '[]'::jsonb`
- `result_summary text null`
- `structured_result jsonb not null default '{}'::jsonb`
- `citations jsonb not null default '[]'::jsonb`
- `confidence numeric null`
- `error_message text null`
- `started_at timestamptz null`
- `completed_at timestamptz null`
- `metadata jsonb not null default '{}'::jsonb`
- timestamps

#### `public.agent_delegation_steps`

One row per visible sub-agent step or tool event.

Suggested fields:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null`
- `run_id uuid not null references public.agent_delegation_runs(id) on delete cascade`
- `step_index integer not null`
- `step_type text not null` such as `context_build`, `tool_call`, `source_review`, `result`, `error`
- `status text not null default 'completed'`
- `tool_name text null`
- `title text null`
- `summary text null`
- `input_summary jsonb not null default '{}'::jsonb`
- `output_summary jsonb not null default '{}'::jsonb`
- `source_refs jsonb not null default '[]'::jsonb`
- `error_message text null`
- `metadata jsonb not null default '{}'::jsonb`
- timestamps

#### `public.agent_context_sources`

Optional normalized source reference table for context bundles and citations.

Suggested fields:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null`
- `run_id uuid not null references public.agent_delegation_runs(id) on delete cascade`
- `source_kind text not null` such as `document_chunk`, `raw_document`, `founder_dataset`, `dataset_row`, `wiki_page`, `web_result`
- `source_id uuid null`
- `source_label text null`
- `source_metadata jsonb not null default '{}'::jsonb`
- `citation_payload jsonb not null default '{}'::jsonb`
- timestamps

### RLS Requirements

Every user-data table must:

- Enable RLS.
- Scope SELECT/INSERT/UPDATE/DELETE by `(select auth.uid()) = user_id` where client access is needed.
- Use `TO authenticated` plus ownership predicates, not role-only policies.
- Include `WITH CHECK` for INSERT/UPDATE ownership.
- Avoid `SECURITY DEFINER` unless absolutely required and protected outside public.

Capability registry access should be explicit. If it is platform-owned and not user-owned, either:

- keep it readable only through server-side service code, or
- expose a safe read policy for enabled public registry rows only.

## Backend Scope

Module 8 may touch both the Python backend and Vercel serverless code, but should keep integration minimal.

### [NEW] Python service: `python-backend/services/sub_agent_orchestrator.py`

Responsibilities:

- Load enabled capabilities.
- Validate requested capability against parent surface.
- Build scoped context from allowed document/dataset/chunk references.
- Dispatch to first safe sub-agent handlers.
- Write `agent_delegation_runs`, `agent_delegation_steps`, and source refs.
- Return structured result plus trace summary.
- Fail closed when capability/tool/source scope is invalid.

### [NEW] Python service: `python-backend/services/agent_context.py`

Responsibilities:

- Build bounded context bundles.
- Verify user ownership for document ids, chunk ids, dataset ids, and query ids.
- Apply source limits.
- Normalize source references into trace/citation shape.

### [NEW] Python service: `python-backend/services/agent_capabilities.py`

Responsibilities:

- Registry lookup and capability config helpers.
- Server-side fallback capability definitions if DB registry is unavailable.
- Avoid exposing raw prompt internals to the client.

### First Sub-Agent Handlers

Implement one or two thin handlers only:

1. `document_analysis_agent`
   - Accepts selected document ids or chunk filters.
   - Uses retrieval/document metadata services where available.
   - Produces a compact structured summary with evidence refs.

2. `structured_data_agent`
   - Accepts selected dataset ids or approved query request.
   - Uses Module 7 structured query service.
   - Produces a compact structured result with audit/query refs.

The handler can be partly stubbed if provider calls are unavailable, but the run/step/context/audit records must be real.

### API Endpoint Scope

Add internal/service endpoints only if useful for smoke tests, such as:

- `GET /api/agent-capabilities`
- `POST /api/agent-runs`
- `GET /api/agent-runs/{run_id}`

Request shape should include:

- `parent_surface`
- `capability_key`
- `task_summary`
- `context_scope`
- optional `parent_thread_id` / `parent_message_id`

Response shape should include:

- `run_id`
- `status`
- `result_summary`
- `structured_result`
- `trace`
- `citations`

Do not expose arbitrary prompt execution or arbitrary tool selection to the browser.

## Vercel / Virtual CSO Integration Scope

Module 8 can add a minimal adapter shape in Vercel serverless code, but should not rewrite chat.

Allowed:

- Add a small typed client/helper that can call the Python sub-agent endpoint server-side.
- Add feature-disabled scaffolding or comments showing where Virtual CSO can call a sub-agent in a later pass.
- Preserve existing streaming behavior.

Not allowed:

- Replacing the Virtual CSO chat loop.
- Moving Claude Sonnet chat synthesis into Python.
- Changing canonical `vcso_*` table ownership.
- Adding broad client-side access to sub-agent execution.
- Adding Deep Mode or general task recursion.

## Frontend / Trace UI Scope

Keep frontend work minimal.

Allowed:

- Add types for hierarchical trace payloads if API client types are touched.
- Add a simple expandable trace component only if there is already a safe place and it stays compact.
- Show founder-facing labels like `Analysis task`, `Sources reviewed`, `Findings`, `Needs review`.

Not allowed:

- Full nested tool-call UI rewrite.
- Raw chain-of-thought display.
- New general agent workbench.
- Admin capability editor.
- Large Domain Agents UI changes.
- Sprint Planning helper UI.

If UI is deferred, the backend response shape should still be ready for a later expandable trace panel.

## Tool Permissions

Initial allowed tool keys should be conservative:

- `retrieve_document_chunks`
- `read_raw_document_metadata`
- `run_structured_dataset_query`
- `read_founder_dataset_summary`
- `web_search` disabled by default

Not allowed in Module 8:

- arbitrary SQL
- arbitrary file system access
- code execution/sandbox
- N8N workflow execution
- database writes outside run/step/audit records
- recursive sub-agent spawning
- user-facing skill/template execution

## Context Isolation Rules

Sub-agent runs must:

- receive only the task summary and scoped context bundle
- use the parent user's identity and permissions
- never broaden source scope without explicit server-side validation
- never access another user's documents, chunks, datasets, runs, or messages
- fail closed on invalid ids or unauthorized capability/tool/source requests
- record sources used in a trace/citation-friendly format

## Verification Plan

### Code Verification

- Run `python -m compileall python-backend`.
- Run `npm.cmd run build` if TypeScript, frontend, or Vercel API files are changed.
- Add focused local smoke checks for context validation and capability dispatch if practical.

### Migration Artifact Verification

- Confirm `009_sub_agent_orchestration.sql` exists in the Episode 1 migration sequence.
- Confirm it creates capability, run, step, and source-ref records.
- Confirm capability seeds are present and conservative.
- Confirm no Deep Mode/workspace/harness tables are added in Module 8 unless explicitly justified.

### Live Supabase Verification

Apply or verify the migration live. Then confirm:

- `agent_capabilities`, `agent_delegation_runs`, `agent_delegation_steps`, and `agent_context_sources` exist.
- RLS is enabled using `pg_class.relrowsecurity` for user-data tables.
- Policies are ownership-scoped and include `WITH CHECK` for writes.
- Cross-user reads return zero rows for runs/steps/sources.
- Capability registry read posture is explicit and safe.
- Seeded capabilities exist with expected enabled/disabled status.

### Sub-Agent Smoke

Use synthetic rows and controlled source ids.

Required cases:

- List capabilities returns only safe registry fields.
- Start a `document_analysis_agent` or stubbed equivalent with valid scoped context.
- Run record moves through queued/running/completed or failed with clear error.
- Step records are created with trace summaries.
- Source refs are created only for allowed sources.
- Invalid capability is rejected.
- Capability not allowed for a parent surface is rejected.
- Unauthorized document/dataset/chunk ids are rejected or return no sources.
- Cross-user run lookup returns zero or forbidden.

### Product Alignment Smoke

Confirm the output shape can support future surfaces:

- Virtual CSO conversation trace
- OS Engine document analysis trace
- Domain Agents task trace
- Sprint Planning helper trace later

Do not require those UI integrations to be fully built in Module 8.

## Completion Criteria

Module 8 can be considered scaffolded when:

- Plan and migration artifacts exist.
- Shared capability registry exists with conservative seed capabilities.
- Durable sub-agent run/step/source records exist with RLS.
- Backend orchestration service can validate capability + surface + context scope.
- At least one sub-agent handler or stub can create a real run, steps, result, and trace.
- User isolation and invalid-scope rejection are verified.
- API response shape is future-ready for nested/hierarchical trace display.
- No raw chain-of-thought is exposed.
- No full Deep Mode, workspace filesystem, domain harness, N8N execution, code sandbox, or recursive agents are introduced.
- `Pro-Suite-Progress.md` is updated with separate code artifact, migration artifact, live schema, sub-agent smoke, and remaining return-pass items.

## Explicit Non-Goals

- Do not build Episode 6 Deep Mode.
- Do not build the virtual workspace filesystem.
- Do not build the deterministic domain harness engine.
- Do not add `ask_user` pause/resume tools.
- Do not add recursive task agents.
- Do not execute N8N workflows from sub-agents.
- Do not add code execution or sandbox tools.
- Do not build a capability admin UI.
- Do not expose raw prompts, internal registry rules, skills, templates, or chain-of-thought to founders.
- Do not build Sprint Planning helper UI yet.

## Future Expansion Notes To Preserve

- Virtual CSO can later delegate deeper analysis while remaining the main conversational voice.
- OS Engine can later use sub-agents for upload analysis, document comparison, dataset review, and Wiki-prep summaries.
- Domain Agents can later use this registry to request specialized helpers by capability.
- Sprint Planning can later add a mini helper sidebar that reviews plans, initiatives, milestones, and capability-area breakdowns.
- Episode 6 can later add Deep Mode, todos, workspace files, ask-user, domain harnesses, and batched parallel agents on top of this scaffold.
- Capability registry should grow based on observed user questions and product usage, but new capabilities should be added deliberately with tool permissions and output contracts.
