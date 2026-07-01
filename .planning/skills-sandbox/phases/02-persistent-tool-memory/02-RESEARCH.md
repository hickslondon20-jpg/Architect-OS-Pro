# Phase 2 — Live Verification Pass (build-ready)

**Purpose:** confirm the actual current shape of ArchitectOS's thread/message storage before
assuming anything about how tool-call persistence should be built — per `ROADMAP.md`'s explicit
instruction for this phase ("verify first, do not assume a JSONB-only, no-migration path carries
over from the reference"). Performed 2026-07-01 against the live Supabase project
(`pwacpjqkntnovndhspxt`) and the current codebase.

**Headline finding: this phase's scope is smaller than `ROADMAP.md` assumed, in the good direction.**
The reference PRD's premise ("persist tool call results in a JSONB column alongside messages, no
migration needed") does **not** carry over — confirmed false, exactly as flagged. But a separate,
already-built, already-correctly-scoped-as-shared-infrastructure system already exists and covers
most of MEMORY-01's substance: `agent_delegation_runs` / `agent_delegation_steps` (Module 8,
`docs/migrations/009_sub_agent_orchestration.sql`). This is a "reuse before creating" finding, not a
"build from scratch" one — see §4 for what's actually still missing.

---

## 1. `vcso_chat_threads` / `vcso_chat_messages` — current live shape

Queried via `information_schema.columns`. **No JSONB tool-call column exists on either table:**

```
vcso_chat_threads: id, user_id, project_id, title, pinned, created_at, last_message_at,
                   synthesis_status, message_count
vcso_chat_messages: id, thread_id, user_id, role, content (TEXT), created_at, token_count
```

Confirms the reference's "no migration needed" assumption does not carry over — there is genuinely
no place today to inline a tool-call/result blob alongside a message row. **If this were the only
persistence mechanism in the codebase, Phase 2 would need to add a column here.** It is not the only
mechanism — see §2.

## 2. `agent_delegation_runs` / `agent_delegation_steps` — already built, already the right shape

`docs/migrations/009_sub_agent_orchestration.sql` ("Module 8: bounded sub-agent orchestration
scaffold") already created exactly the persistence shape MEMORY-01 asks for, as **shared,
cross-surface infrastructure** — not scoped to Virtual CSO or KB Explorer specifically:

```
agent_capabilities        — capability registry (capability_key, allowed_tools, allowed_surfaces, ...)
agent_delegation_runs     — one row per delegated tool/agent invocation:
                            user_id, capability_key, parent_surface ∈ {virtual_cso, os_engine,
                            domain_agent, sprint_planning, system}, parent_thread_id, parent_message_id,
                            parent_run_id (self-FK, nesting), status, task_summary, result_summary,
                            structured_result (jsonb), citations (jsonb), confidence, error_message,
                            started_at/completed_at, metadata (jsonb)
agent_delegation_steps    — one row per step within a run:
                            run_id (FK), step_index, step_type ∈ {context_build, tool_call,
                            source_review, result, error}, status, tool_name, title, summary,
                            input_summary (jsonb), output_summary (jsonb), source_refs (jsonb),
                            error_message, metadata (jsonb)
agent_context_sources     — per-run source/citation records
```

RLS on all three is already the standard owner-only pattern (`(select auth.uid()) = user_id`) — no
gap there. `agent_delegation_runs.parent_surface` explicitly enumerates `virtual_cso`, `os_engine`,
`domain_agent`, `sprint_planning`, `system` — this table was deliberately built to be shared across
surfaces, which is exactly what project `CONTEXT.md` §7 asks Phase 2 to treat tool memory as.

**This is actively wired, not just scaffolded-and-abandoned.** `python-backend/services/
sub_agent_orchestrator.py` performs real inserts/updates against both tables (`.table
("agent_delegation_runs").insert(...)`, `.table("agent_delegation_steps").insert(...)`) when the
`/api/agent-runs` endpoint is called — confirmed by reading the file directly, not inferred from the
table's existence alone. `api/vcso/chat.ts`'s `callKbExplorer()` calls exactly this endpoint
(`POST {backendUrl}/api/agent-runs`) when `shouldCallKbExplorer(text)` matches, passing
`parent_thread_id: threadId, parent_message_id: userMessageId`.

**Currently dormant in this environment:** `agent_delegation_runs` and `agent_delegation_steps` both
have **0 rows**, and `agent_capabilities` has **0 rows with `status='enabled'`** (all seeded rows are
`experimental` or `disabled`). The mechanism is real and exercised in code, but either the relevant
env vars (`ARCHITECTOS_PYTHON_BACKEND_URL`, `ARCHITECTOS_INGEST_SECRET`) aren't set in this
environment, or genuine founder traffic hasn't triggered `shouldCallKbExplorer()`'s keyword heuristic
yet, or both. Either way: **the table exists, is written to by real code, and is empty because it
hasn't been exercised — not because it's inert scaffolding.**

## 3. `agentSteps` — confirmed client-side-only, exactly as `CONTEXT.md` §7 describes

Cross-checked against `.planning/knowledge-base-explorer/phases/09-retrieval-router/09-RESEARCH.md`
§6–§7 (that phase's own research, already on file): `AgentStep { tool, input, output }` is a
TypeScript-only interface (`lib/virtualCsoMockData.ts`). `toMessage()` in `lib/virtualCsoApi.ts`
reads `row.agentSteps ?? undefined` defensively, but **no `agentSteps` column exists on
`vcso_chat_messages`** — confirmed by §1's column list. The `done` SSE event in `api/vcso/chat.ts`
is the only place `agentSteps` ever gets populated on a `Message`, sourced from the *live HTTP
response* to `/api/agent-runs` (`data.trace`), not from a database read. **Reload the page or reopen
an old thread, and `agentSteps` are gone from the client — even on messages where a corresponding
`agent_delegation_runs`/`agent_delegation_steps` row genuinely exists in Supabase.** This is the real
gap, not "no persistence exists at all."

## 4. What's actually missing (the real Phase 2 scope)

Given §1–§3, MEMORY-01 is not "invent a tool-call persistence schema" — it already exists and is
already shared cross-surface infrastructure. What's missing:

**(a) No direct link from a run to the assistant message it produced.** `agent_delegation_runs.
parent_message_id` is set to the **user** message's id (`callKbExplorer(userId, text, threadId!,
userMessage.data.id)`), not the assistant reply that follows. Reconstructing "assistant-message +
tool-call + tool-result + assistant-response" (ROADMAP success criterion #2) by joining only on
`parent_message_id` gets you the triggering user message, not the resulting assistant message —
you'd have to additionally correlate via `thread_id` + timestamp adjacency, which is fragile. A
nullable `assistant_message_id` column on `agent_delegation_runs`, populated once the assistant
message is inserted (`chat.ts` line ~593), is the clean fix — an extension of existing structure,
not a new table.

**(b) No read path reconstructs `agentSteps` from persisted rows.** Neither the initial thread-load
query, nor the `recentMessages` query used in `assemblePrompt()` (`api/vcso/chat.ts`, `.select
('role,content,created_at')`, limit 8, reversed), joins `agent_delegation_runs`/`agent_delegation_
steps` at all. This is the actual missing piece for both ROADMAP success criteria #2 (thread reload)
and #3 (follow-up referencing a prior tool result without re-invoking): the data to satisfy both
already exists in Supabase once (a) is in place — nothing reads it back today.

**(c) `parent_thread_id`/`parent_message_id` are plain `uuid` columns with no `REFERENCES` clause.**
This appears intentional, not an oversight — `parent_surface` spans multiple surfaces
(`os_engine`, `domain_agent`, `sprint_planning`) that presumably have their own thread/message tables
distinct from `vcso_chat_*`, so a single FK target wouldn't hold across surfaces. Do not "fix" this
by adding a hard FK to `vcso_chat_messages` — that would break the table's whole-platform-shared
design for the sake of one surface. If a scoped FK is wanted for Virtual CSO's own new
`assistant_message_id` column specifically (§4a), that's fine to add as its own column with its own
FK, since it's new and Virtual-CSO-specific by construction — leave the existing `parent_thread_id`/
`parent_message_id` columns exactly as they are.

**(d) KB Explorer's `agentSteps` reload behavior (ROADMAP success criterion #4).** Once (a) and (b)
are built, reloading KB Explorer's persisted `agentSteps` on thread reopen becomes a natural
consequence of the same mechanism — not separate work. The KB-Explorer-specific design note from
`CONTEXT.md` §7 ("Phase 9 deliberately kept `agentSteps` client-side only... because KB Explorer
results are read-only lookups a founder can re-trigger cheaply") is about whether re-invoking KB
Explorer is *necessary* on reload — it isn't, cheaply re-triggering is fine for KB lookups — but that
doesn't mean *displaying* the historical trace on reload is undesirable. Recommendation: wire the
reload path generally (it has to exist for skills/sandbox anyway, since those results aren't cheap to
re-run); KB Explorer gets working historical-trace display for free as a side effect, without
forcing anything to actually re-execute.

## 5. Recommendation summary

| Reference PRD assumption | What's actually true here |
|---|---|
| Tool results persist in a JSONB column alongside messages, no migration needed | False for `vcso_chat_messages` directly — confirmed via live schema query. **But** true in spirit: `agent_delegation_runs.structured_result` / `agent_delegation_steps.output_summary` are exactly that JSONB-alongside-the-record shape, just on a purpose-built companion table already in production code, not the message table itself. |
| Build persistence from scratch | **Do not.** Extend `agent_delegation_runs` with one new nullable column (`assistant_message_id`); build the read/reload path that's currently missing. This is squarely a "reuse before creating" case per the project's governing principle. |

---
*Verification performed 2026-07-01 against Supabase project `pwacpjqkntnovndhspxt` and the live
`ArchitectOS Pro_beta` codebase (`api/vcso/chat.ts`, `lib/virtualCsoApi.ts`, `lib/
virtualCsoMockData.ts`, `python-backend/services/sub_agent_orchestrator.py`,
`docs/migrations/009_sub_agent_orchestration.sql`). No production code or schema was written during
this pass — read-only throughout.*
