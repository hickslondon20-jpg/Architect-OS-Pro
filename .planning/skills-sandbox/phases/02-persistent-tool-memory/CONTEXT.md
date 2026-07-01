# Phase 2 Context — Persistent Tool Memory

**Written:** 2026-07-01, by the Orchestration Agent, after the `02-RESEARCH.md` verification pass.
**Format:** GSD per-phase CONTEXT.md — six sections (domain, decisions, canonical_refs, code_context,
specifics, deferred), per `.claude/gsd-core/references/artifact-types.md`.

**Read `02-RESEARCH.md` first.** This phase's scope is meaningfully smaller than `ROADMAP.md`'s
Phase 2 description implies, in the good direction — a real, already-wired, already-shared-
cross-surface persistence system (`agent_delegation_runs` / `agent_delegation_steps`, Module 8)
already exists and covers most of what MEMORY-01 asks for. This phase extends and wires it; it does
not invent a new schema.

---

## 1. Domain

Make tool call results (skill loads, code executions, KB Explorer delegations, and any future
tool-calling surface) reconstructable on thread reload and available to follow-up-turn prompt
assembly, without needing to re-invoke the underlying tool. Concretely:

1. Add one column to the existing `agent_delegation_runs` table so a run can be linked directly to
   the assistant message it produced (today it only links to the triggering *user* message).
2. Wire the currently-missing read path: reconstruct `agentSteps` from `agent_delegation_runs`/
   `agent_delegation_steps` on thread reload (UI) and fold persisted tool results into
   `assemblePrompt()`'s context for follow-up turns (chat backend).
3. As a consequence of (2), KB Explorer's existing client-side-only `agentSteps` behavior gains
   reload/persistence for free — no separate build.
4. **(Added 2026-07-01, confirmed by London at the checkpoint)** Fix the live-streaming timing gap
   this research surfaced: the nested sub-agent "thinking/processing" section (the `AgentStepsPanel`
   built in KB Explorer Phase 9) is meant to render *above the message, streamed live during
   generation* — not appear only once the whole response is done. That was never actually possible
   with the current SSE event order, independent of persistence. This phase fixes both the "it
   disappears on reload" problem (items 1–3 above) and the "it doesn't appear live in the first
   place" problem (item 4) together, since both trace back to the same underlying gap: `agentSteps`
   are computed early but only ever transmitted to the client in the final `done` event. See §5 for
   the exact fix.

This phase does **not** touch `skill_packs`/`skill_files` (Phase 1, done), skill discovery/routing
(Phase 3), skill creation UX (Phase 4), or the sandbox (Phase 5+). It has no dependency on those
phases and they have none on it structurally, but per project `CONTEXT.md` §7 it's sequenced early
because it's foundational plumbing every later tool-calling phase (skills, sandbox) benefits from.

## 2. Decisions

**Carried from the project-root `CONTEXT.md` (locked):**

- Persistent Tool Memory is built now, early, as shared cross-surface infrastructure — not deferred,
  not scoped to skills/sandbox alone (project `CONTEXT.md` §7, confirmed 2026-07-01).
- "Confirm the actual current shape of ArchitectOS's thread/message storage... verify first, do not
  assume" (project `ROADMAP.md` Phase 2 note) — done; see `02-RESEARCH.md`.

**New for this phase — proposed by the Orchestration Agent based on the research pass, confirmed by
London (2026-07-01) at the orchestration checkpoint:**

- **Do not build a new tool-call-result schema.** `agent_delegation_runs` / `agent_delegation_steps`
  already are that schema, already shared across `virtual_cso`/`os_engine`/`domain_agent`/
  `sprint_planning`/`system`, already RLS'd correctly, already actively written to by
  `python-backend/services/sub_agent_orchestrator.py`. Building a second, parallel "tool memory"
  table would be exactly the near-duplicate-systems anti-pattern the project's governing principle
  warns against.
- **Add `agent_delegation_runs.assistant_message_id UUID` (nullable, FK to
  `public.vcso_chat_messages(id)`).** This is new, Virtual-CSO-specific, and additive — it does not
  touch the existing `parent_thread_id`/`parent_message_id` columns, which must stay exactly as they
  are (soft references, no FK, because they're shared across surfaces with their own thread/message
  tables — see `02-RESEARCH.md` §4c for why a hard FK there would be wrong).
- **KB Explorer's `agentSteps` should gain reload/persistence** (resolving ROADMAP success criterion
  #4) as a direct consequence of building the general reload mechanism in 02-02, not as separate
  scoped work. This does not change KB Explorer's re-invocation behavior — re-running a KB Explorer
  lookup on demand stays cheap and unchanged; this only makes the *historical* trace visible again
  after a reload, which today silently disappears even though the underlying rows exist.
- **Confirmed by London: this phase also fixes the live-streaming display, not only reload.** The
  nested "thinking/sub-agent processing" section was always meant to stream above the returned
  message *as the response generates* — this was never actually wired, independent of any persistence
  gap. London: "the thinking process that we wanted streamed in a nested section above the returned
  message... wasn't necessarily possible or persistent before" — both halves (live display during
  generation, and surviving a reload afterward) are this phase's job, because both trace back to the
  same root cause: `agentSteps` are known early (`kbResult` resolves before the `ready` SSE event
  even fires) but are currently only ever transmitted to the client in the final `done` event, after
  the assistant's text has already fully streamed. See §5 for the concrete fix (emit `agentSteps`
  earlier, before/alongside token streaming, not only at `done`).

## 3. Canonical Refs

- `.planning/skills-sandbox/CONTEXT.md` §7 ("Persistent tool memory: shared plumbing, not a
  skills-only feature").
- `.planning/skills-sandbox/REQUIREMENTS.md` — MEMORY-01 (this phase's sole traced requirement).
- `.planning/skills-sandbox/ROADMAP.md` — Phase 2 section (goal, depends-on, success criteria).
- `02-RESEARCH.md` (this folder) — the live-verification findings this CONTEXT.md and both plans
  build against; read in full before either plan file.
- `docs/migrations/009_sub_agent_orchestration.sql` — the existing Module 8 schema this phase
  extends (do not re-read as "reference," this is the literal current schema).
- `.planning/knowledge-base-explorer/phases/09-retrieval-router/09-RESEARCH.md` §6–§8 — that phase's
  own research confirming `agentSteps` is client-side-only; cross-checked and consistent with this
  phase's findings.

## 4. Code Context

- `api/vcso/chat.ts` — `callKbExplorer()` (~line 270) currently discards `data.run_id` from the
  Python backend's `AgentRunResponse`; only extracts `resultSummary`/`steps`. Needs to also return
  `runId` so it can be attached to the assistant message once that's inserted.
- `api/vcso/chat.ts` — the assistant message insert (~line 593) and the `recentMessages` query used
  in `assemblePrompt()` (~line 512, currently `.select('role,content,created_at')`, limit 8) are the
  two places that need to change: the former to backfill `assistant_message_id` onto the triggering
  run; the latter to also pull matching `agent_delegation_runs`/`steps` so persisted tool context
  reaches follow-up-turn prompt assembly.
- `lib/virtualCsoApi.ts` — `toMessage()` (~line 95) needs to populate `agentSteps` from a joined
  query result when reconstructing message history for the UI (today it only reads `row.agentSteps`,
  which is never actually present on a `vcso_chat_messages` row).
- `components/pro-suite/virtual-cso/MessageBubble.tsx` and `AgentStepsPanel.tsx` (built in KB
  Explorer Phase 9) — already render `message.agentSteps` when present; no component changes should
  be needed if the data reaches `Message.agentSteps` in the same shape Phase 9 already established
  (`{tool, input, output}` — extend with `status` per MEMORY-01's "name, arguments, status, and
  result," sourced from `agent_delegation_steps.status`/`tool_name`/`input_summary`/`output_summary`).
- `python-backend/services/sub_agent_orchestrator.py` — confirmed to actually perform the
  `agent_delegation_runs`/`agent_delegation_steps` inserts/updates. This phase does not need to
  modify this file — the new `assistant_message_id` backfill happens from the Node/Vercel side
  (`chat.ts`, via the user's own Supabase client, same as every other write in that file), after the
  assistant message exists, which the Python service has no visibility into at run-creation time.

## 5. Specifics

**Schema (02-01):**
```sql
ALTER TABLE public.agent_delegation_runs
  ADD COLUMN assistant_message_id UUID REFERENCES public.vcso_chat_messages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS agent_delegation_runs_assistant_message_idx
  ON public.agent_delegation_runs (assistant_message_id);
```
No RLS changes needed — the existing owner-only policies on `agent_delegation_runs` already cover
SELECT/UPDATE of this new column.

**Backend wiring (02-02):**
- `callKbExplorer()` return type gains `runId: string | null` (from `data.run_id`).
- After the assistant message insert succeeds, if `kbResult?.runId` is set: `UPDATE
  agent_delegation_runs SET assistant_message_id = assistantMessage.data.id WHERE id = kbResult.runId
  AND user_id = userId` (founder's own Supabase client — RLS already scopes this correctly).
- `recentMessages` query extended (or a second parallel query) to fetch, for each assistant message
  id in the window, any `agent_delegation_steps` joined via `agent_delegation_runs.
  assistant_message_id` — reconstructed into the same `{tool, input, output, status}` shape and
  folded into `assemblePrompt()`'s context so a follow-up turn can reference prior structured results
  without re-invoking the tool.
- Thread-reload path (wherever the UI fetches full message history for a reopened thread — locate
  this before assuming it's the same `recentMessages` query; it may be a separate, unpaginated or
  differently-paginated fetch) gets the equivalent join, feeding `toMessage()`'s `agentSteps`.

**Live-streaming fix — confirmed by London, added to this phase's scope (02-02):**
- **Root cause:** `kbResult` (containing `steps`) is fully resolved at `api/vcso/chat.ts` ~line 501,
  well before the `ready` SSE event fires (~line 560) and long before `streamAnthropic()` (~line 588)
  begins streaming the assistant's text. But `agentSteps` is currently only attached to the `done`
  event's `assistantMessage` (~line 646) — sent *after* the full text stream has already completed.
  There is no architectural reason for this delay; the data has been sitting in scope, unused, the
  entire time the response was streaming.
- **Fix:** emit `kbResult.steps` to the client as soon as it's known — either added to the existing
  `ready` event payload (~line 560, alongside `route`/`assembledContext`), or as a new dedicated SSE
  event (e.g. `agent_steps`) fired immediately after `ready` and before `streamAnthropic()` begins.
  Either is acceptable; adding to `ready` is simpler (no new event type for the client to handle) and
  is the default unless the execution agent finds a concrete reason to prefer a separate event.
- **Client-side:** whichever surface currently assembles the streaming message state (the same one
  KB Explorer Phase 9 wired `onReady`/`onToken`/`done` handling into — locate the exact hook/component
  before assuming; `09-RESEARCH.md` mentions `VirtualCSOWorkspace.tsx`'s streaming state pattern) needs
  to render `AgentStepsPanel` as soon as the early steps arrive, *above* the streaming text bubble
  that starts filling in via `onToken` shortly after — this is what makes the nested section feel
  "streamed first, message follows," not "everything pops in at once when done." The `done` event's
  `agentSteps` remains the source of truth for the final committed `Message` object (what gets stored
  in the chat state array and is what `getMessagesForChat()`/reload reproduce later) — the early
  emission is purely a UI-timing improvement, not a replacement for the final, complete payload.
- **This is the same underlying data, sent twice, for two different jobs:** early (for live display
  during generation) and final/persisted (for state commitment and later reload). Do not build two
  different data shapes for these — one `AgentStep[]` shape, emitted once early and once at
  completion, backed by the one `agent_delegation_runs`/`steps` persistence path already described
  above.

## 6. Deferred (explicitly not this phase's job)

- Anything about `skill_packs`/`skill_files` (Phase 1, done) or skill discovery/creation (Phases
  3–4).
- Turning on any currently-`disabled`/`experimental` `agent_capabilities` row, or building new
  capabilities — Phase 2 is about the memory/reload plumbing, not about which capabilities are live.
- Enabling `ARCHITECTOS_PYTHON_BACKEND_URL`/`ARCHITECTOS_INGEST_SECRET` in this environment if unset
  — an ops/config concern outside this phase's schema-and-code scope. Note it if found unset during
  execution, don't silently work around it.
- Any change to `parent_thread_id`/`parent_message_id`'s soft-reference (no-FK) design — that's
  correct as-is for the shared, multi-surface table (`02-RESEARCH.md` §4c).
- Sandbox-originated tool calls (Phase 7) writing into this same system — that's Phase 7's job, once
  `execute_code` exists; this phase only needs to make sure the read/reload path it builds is generic
  enough that Phase 7 doesn't need its own parallel memory mechanism (reuse-check for Phase 7's
  execution agent, not something to pre-build now).

---
*Context written: 2026-07-01 — Orchestration Agent, post-research.*
