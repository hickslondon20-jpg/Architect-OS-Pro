# Sub-phase 04 — Source Adapters: Research

**Sub-phase:** 04 — Sprint-history, CSO-thread, and Domain-agent-artifact adapters
**Authored by:** Orchestration agent, 2026-06-30
**Reads into:** `CONTEXT.md` → `EXECUTION-AGENT-PROMPT.md`

---

## §1 — Framework interface (what adapters plug into)

Sub-phase 03 built `DocWikiSynthesisService` in
`python-backend/services/doc_wiki_synthesis.py`. Every adapter in sub-phase 04 is a
concrete class that uses this service — it does NOT extend `DocWikiDocumentAdapter`.
The three new adapters are parallel siblings.

**Interface contract every adapter must satisfy:**

```python
class DocWiki<Source>Adapter:
    def __init__(self, supabase: SupabaseClient, service: DocWikiSynthesisService): ...
    async def synthesize_from_<source>(self, <source_id>: str, user_id: str) -> SynthesisResult: ...
```

**What adapters must produce:** a `SourcePayload` dataclass (already defined in
`doc_wiki_synthesis.py`):

```python
@dataclass
class SourcePayload:
    page_kind: str          # from doc_wiki_schema.json vocabulary
    canonical_key: str      # (user_id, canonical_key) must be unique
    title: str
    body_text: str          # assembled narrative handed to Claude
    chunk_refs: list[ChunkRef]  # provenance — may be empty for structured sources
    metadata: dict[str, Any]
    origin_thread_id: str | None = None  # CSO thread adapter only
    synthesis_job_id: str | None = None
```

After assembling `SourcePayload`, every adapter calls:
`result = service.synthesize(user_id, payload)`

Sub-phase 03's `synthesize()` method is source-agnostic — it accepts any
`SourcePayload` and runs the full loop: Claude call → upsert page → links → log.

---

## §2 — Sprint-history adapter

### 2.1 Source tables (verified 2026-06-30 against pwacpjqkntnovndhspxt)

**`sp_sprint_goals`** — one row per sprint:
```
id, user_id, quarter, name, goal_text, directional_framing,
status (sp_goal_status enum), version, kickoff_date,
manually_closed_at, retrospective_completed_at
```

**`sp_sprint_initiatives`** (FK: `sprint_goal_id`) — initiatives within a sprint:
```
id, user_id, sprint_goal_id, quarter, capability_id, capability_name,
three_p_tier, name, outcome_statement, sprint_connection, known_constraints,
unlocks_future, binary_done_definition, what_already_exists,
adjustment_definition, time_box, signal_to_watch, status, version
```

**`sp_sprint_milestones`** (FK: `initiative_id`) — milestones within initiatives:
```
id, initiative_id, user_id, description, status (sp_milestone_status), version
```

**`quarter_map_selections`** — quarter-level context:
```
id, user_id, quarter_name, selections (jsonb), status, synthesis_output (text)
```

### 2.2 Pages produced

**Type A — `sprint_history`** (one per sprint goal, created/updated when sprint closes):
- `canonical_key`: `sprint_{quarter}_{sprint_goal_id_short8}` where `_short8` = first 8 chars of UUID
- `page_title`: e.g. `"Q3 2026 Sprint: {sprint.name or sprint.goal_text[:60]}"`
- Narrative covers: sprint goal + directional framing + each initiative (name,
  outcome, tier, constraints, unlocks) + milestone completion summary
- `source_file_ids`: `[]` (not a document) — use `connected_pages` to link to other sprint pages
- `effective_date`: `sprint.kickoff_date`; `observed_date`: `sprint.retrospective_completed_at`

**Type B — `capability_evolution`** (one per capability_id, accreting across quarters):
- `canonical_key`: `capability_evolution_{capability_id}`
- `page_title`: e.g. `"Capability Evolution: {capability_name}"`
- **Accreting pattern**: if page already exists, read existing content + new sprint data
  and synthesize an UPDATED page that incorporates both old history and the new sprint.
  Pass old content in `metadata['existing_content']`; the system prompt must instruct
  Claude to extend, not replace, the history.
- `page_kind`: `capability_evolution`
- Tracks: when the capability first appeared, what tier (Process/People/Positioning)
  it was worked on per quarter, progress direction, AE Ladder stage implication

### 2.3 Trigger and page-worthiness

**Trigger:** called after a sprint goal is closed — i.e. `manually_closed_at IS NOT NULL`
OR `retrospective_completed_at IS NOT NULL`. Manual endpoint in sub-phase 04.
Auto-trigger (on sprint close event) is activation-gated — not wired in sub-phase 04.

**Page-worthiness gate for sprint_history:**
- At least 1 initiative with a non-null `outcome_statement` OR `binary_done_definition`
- Skip draft sprints (`status = 'draft'`)

**Page-worthiness gate for capability_evolution:**
- No minimum threshold — every closed sprint that touches a capability updates or
  creates the capability_evolution page.

### 2.4 Body text assembly (for `sprint_history`)

```
## Sprint: {name or quarter}
**Quarter:** {quarter}
**Goal:** {goal_text}
**Directional framing:** {directional_framing}
**Kickoff:** {kickoff_date} | **Closed:** {manually_closed_at}

## Initiatives ({N} total)

### {initiative.name} [{three_p_tier}]
- Outcome: {outcome_statement}
- Connection to sprint: {sprint_connection}
- Known constraints: {known_constraints}
- Unlocks: {unlocks_future}
- Done definition: {binary_done_definition}
- Milestones ({M} total): {milestone.description} [{status}], ...
```

**For `capability_evolution`** — when page already exists, the body_text passed to
Claude is:

```
## Existing capability history (as of previous synthesis):
{existing_page.content}

## New sprint data to incorporate:
Quarter: {quarter}
Sprint goal: {goal_text}
Initiative name: {initiative.name}
Initiative tier: {three_p_tier}
Outcome: {outcome_statement}
Unlocks: {unlocks_future}
```

Claude is instructed to write a synthesized evolution narrative that integrates the
new sprint naturally into the existing history — not a list append, a narrative update.

### 2.5 Chunk refs and provenance

Sprint data has no document chunks. `chunk_refs` is `[]`. Provenance is recorded in
`metadata` as `{"source_tables": ["sp_sprint_goals","sp_sprint_initiatives","sp_sprint_milestones"], "sprint_goal_id": "..."}`.

---

## §3 — CSO-thread adapter

### 3.1 Source tables (verified 2026-06-30)

**`vcso_chat_threads`** — thread metadata:
```
id, user_id, project_id, title, pinned, synthesis_status (text),
message_count, last_message_at, created_at
```

**`vcso_chat_messages`** — message log:
```
id, thread_id, user_id, role (text), content (text), token_count, created_at
```

The `synthesis_status` field on `vcso_chat_threads` is the natural state machine:
- `'pending'` → thread marked for synthesis (by founder or future auto-trigger)
- `'completed'` → page was synthesized (adapter sets this when done)
- `'skipped'` → below worthiness threshold (adapter sets this on skip)

`origin_thread_id` on `ose_knowledge_pages` maps to `vcso_chat_threads.id`.

**Note:** The older `virtual_cso_sessions` / `virtual_cso_messages` tables exist but
are the legacy surface (pre-Pro Suite). The adapter reads `vcso_chat_*` tables only.

### 3.2 Page produced

**Type:** `thread_synthesis` (one per substantive thread, created when thread is synthesized)
- `canonical_key`: `thread_{thread_id_short8}`
- `page_title`: `"{thread.title}"` (or a Claude-generated summary title if title is
  "New conversation")
- `origin_thread_id`: `vcso_chat_threads.id` (UUID, stored directly in `ose_knowledge_pages`)

### 3.3 Body text assembly

```
## Thread: {thread.title}
Created: {thread.created_at} | Messages: {thread.message_count}

{for each message in chronological order:}
**{role.upper()}:** {content}
```

The full message log is the evidence — no chunk refs needed. `chunk_refs` is `[]`.
Token budget note: if the thread is very long (> 30 messages or > 6,000 words of
content), truncate to the first 20 + last 5 messages with a `[{N} messages omitted]`
marker. This keeps the prompt under Claude's practical context.

### 3.4 Trigger and page-worthiness

**Trigger:** adapter is called for all threads where `synthesis_status = 'pending'`.
Manual endpoint lets the founder trigger this per thread or in batch.
Auto-trigger (on thread close / session end) is activation-gated.

**Page-worthiness gate:**
- `message_count >= 4` (at least 2 user + 2 assistant turns)
- At least one assistant message with `len(content) >= 200` chars (substantive response)
- If below threshold: set `synthesis_status = 'skipped'`; do NOT create a page.

### 3.5 Post-synthesis state update

After `service.synthesize()` returns successfully:
```python
supabase.table("vcso_chat_threads") \
    .update({"synthesis_status": "completed"}) \
    .eq("id", thread_id).execute()
```
On worthiness-gate failure:
```python
supabase.table("vcso_chat_threads") \
    .update({"synthesis_status": "skipped"}) \
    .eq("id", thread_id).execute()
```

---

## §4 — Domain-agent-artifact adapter

### 4.1 Source tables (verified 2026-06-30)

**`agent_delegation_runs`** — one row per run:
```
id, user_id, capability_key, parent_surface, parent_thread_id,
task_title, task_summary, context_scope (jsonb),
result_summary (text), structured_result (jsonb), citations (jsonb),
confidence (numeric), status, started_at, completed_at, metadata (jsonb)
```

**`agent_delegation_steps`** (FK: `run_id`) — step trace:
```
id, run_id, user_id, step_index, step_type, tool_name, title,
summary, input_summary (jsonb), output_summary (jsonb), source_refs (jsonb)
```

**`agent_context_sources`** (FK: `run_id`) — sources used:
```
id, run_id, user_id, source_kind, source_id, source_label,
source_metadata (jsonb), citation_payload (jsonb)
```

### 4.2 Page produced

**Type:** `agent_artifact` (one per completed run, if page-worthy)
- `canonical_key`: `agent_artifact_{run_id_short8}`
- `page_title`: `"{run.task_title}"` or `"{run.capability_key}: {run.task_summary[:80]}"`
- Links to source pages referenced in `citations` / `context_scope` via `ose_page_links`

### 4.3 Page-worthiness gate

```python
def _is_artifact_worthy(run: dict) -> bool:
    return (
        run["status"] == "completed"
        and run.get("result_summary")
        and len(run["result_summary"]) >= 150
        and (run.get("confidence") or 0) >= 0.5
    )
```

Sub-threshold runs are silently skipped — no state update needed on the run itself
(unlike CSO threads, there is no `synthesis_status` field on `agent_delegation_runs`).

### 4.4 Body text assembly

```
## Agent run: {task_title or task_summary}
Capability: {capability_key} | Surface: {parent_surface}
Completed: {completed_at} | Confidence: {confidence}

## Task summary
{task_summary}

## Result
{result_summary}

## Steps ({N} total)
{for each step (step_type not 'internal' or 'context_load'):}
- {step.title}: {step.summary}

## Sources used
{for each context_source: {source_label} ({source_kind})}
```

`chunk_refs` is `[]` — no document chunks. Provenance in `metadata`:
`{"source_table": "agent_delegation_runs", "run_id": "...", "capability_key": "..."}`.

If citations jsonb contains structured_result page references, those canonical_keys
should be added to the page link graph by the adapter after synthesis.

---

## §5 — FastAPI endpoints (manual trigger surface)

Each adapter needs a manual trigger endpoint mirroring sub-phase 03's
`POST /api/doc-wiki/synthesize-document`:

```
POST /api/doc-wiki/synthesize-sprint
  Body: { sprint_goal_id: str, user_id: str }
  → synthesizes sprint_history page; also updates any capability_evolution pages

POST /api/doc-wiki/synthesize-thread
  Body: { thread_id: str, user_id: str }
  → synthesizes thread_synthesis page for one thread

POST /api/doc-wiki/synthesize-agent-artifact
  Body: { run_id: str, user_id: str }
  → synthesizes agent_artifact page for one completed run
```

Response pattern (consistent with existing endpoint):
```json
{ "status": "ok", "synthesis_job_id": "...", "pages_created": N, "pages_updated": N }
```

Optional batch endpoint:
```
POST /api/doc-wiki/synthesize-pending-threads
  Body: { user_id: str, limit: int = 10 }
  → synthesizes all threads with synthesis_status='pending' up to limit
```

---

## §6 — System prompt specialization per source type

The `DocWikiSynthesisService._build_system_prompt()` is generic. Sub-phase 04 adapters
must pass a `source_type_hint` in `metadata` so the system prompt can tailor the Claude
call for each source.

Alternatively (simpler), each adapter can override the body_text preamble with a
synthesis directive:

**Sprint:** `"Synthesize this sprint record into a professional retrospective wiki page..."`
**CSO thread:** `"Synthesize this Virtual CSO conversation into a knowledge page capturing the key insights, decisions, and frameworks discussed..."`
**Agent artifact:** `"Synthesize this domain agent run into a wiki page capturing the task, methodology, findings, and implications for the founder's business..."`

The `DocWikiSynthesisService` already passes `metadata` into `_build_user_prompt()`.
The execution agent should check whether `metadata['synthesis_directive']` is already
handled in the existing prompt builder, or add it.

---

## §7 — Canonical key collision and dedup strategy

The `(user_id, canonical_key)` unique partial index (from sub-phase 02 migration) ensures
no duplicates. The `_upsert_page()` method in `DocWikiSynthesisService` handles this via
an `ON CONFLICT (user_id, canonical_key)` upsert.

For capability_evolution pages specifically — the page is UPDATED, not created fresh,
on every sprint that touches the capability. The adapter must:
1. Read the existing page (if any) via `supabase.table("ose_knowledge_pages").select("content").eq("canonical_key", key).eq("user_id", user_id).single()`
2. Pass existing content in `metadata['existing_content']`
3. The upsert will replace the content with the updated synthesis

---

## §8 — No new schema changes

Sub-phase 04 requires NO new migrations:
- `vcso_chat_threads.synthesis_status` already exists
- `ose_knowledge_pages.origin_thread_id` already exists (added in sub-phase 02)
- `ose_page_links` already exists (sub-phase 02)
- No new columns needed on any source table

---

## §9 — Activation gating

Per CONTEXT.md §3 (v1 adapter scope decision):
> CSO-thread + domain-agent-artifact adapters are built in v1 but their live triggering
> is gated on those source systems maturing.

This means:
- The adapter classes are BUILT and WIRED to manual endpoints
- Auto-trigger hooks (e.g., calling thread synthesis on session close, calling artifact
  synthesis on run completion) are NOT wired in sub-phase 04
- Sprint adapter auto-trigger is similarly deferred — manual endpoint only
- All three adapters should be importable and callable; activation = enabling the
  auto-trigger call sites

---

## §10 — Hard rules for sub-phase 04

1. **Never call OpenAI or Pinecone.** Use `anthropic.Anthropic()` via `DocWikiSynthesisService`.
2. **Never read or write `pinecone_vector_id`** on `ose_knowledge_pages`.
3. **Never add a DB CHECK constraint to `page_kind`.**
4. **Capability evolution pages are UPDATED, not duplicated.** Read existing content
   before synthesizing; pass it to Claude for an integrated update.
5. **CSO thread state must be updated after synthesis.** Always set `synthesis_status`
   to `'completed'` or `'skipped'` — never leave it `'pending'` after the adapter runs.
6. **Adapters are parallel siblings of `DocWikiDocumentAdapter`, not subclasses.**
   All three adapters live in the same file or in separate files in
   `python-backend/services/`. No adapter-to-adapter inheritance.
7. **No new Supabase migrations.** All required columns exist.
8. **Page-worthiness gates must be explicit functions**, not inline conditionals.
   Name them `_is_sprint_worthy()`, `_is_thread_worthy()`, `_is_artifact_worthy()`.
9. **`compileall` must pass.** Run `python -m compileall python-backend` before reporting done.
10. **Endpoints follow the existing pattern** in `main.py` (Pydantic request models +
    `DocWikySynthesizeRequest` pattern from sub-phase 03). Add new Pydantic models for
    each new endpoint.
