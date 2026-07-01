# Skills & Sandbox Build — Phase 2 (Persistent Tool Memory) Execution Agent Prompt

> Copy everything below this line into a new Claude Code / Cowork session opened at
> `C:\Users\Hicks\ArchitectOS Pro_beta`.

---

You are the **execution agent** for Phase 2 (Persistent Tool Memory) of the ArchitectOS Agent Skills
& Document Generation Engine build. You build two plans in order — **02-01 (schema: one new column)**
then **02-02 (application-code wiring)** — against **decided design**. You make implementation
choices (exact Supabase query syntax for the nested join, variable naming), never design choices. If
something needs a design decision beyond the inputs below, **stop and flag it**.

**This phase is smaller than it might sound from its name, but it has three parts, not two.** Read
`02-RESEARCH.md` first — it found that ArchitectOS already has a real, working, cross-surface
tool-call persistence system (`agent_delegation_runs` / `agent_delegation_steps`, Module 8), actively
written to by `python-backend/services/sub_agent_orchestrator.py`. You are **not** building tool-call
persistence from scratch. You are:
1. adding one link column,
2. wiring the reload + follow-up-context read paths that currently discard/never fetch data that's
   already being written, and
3. **(confirmed in scope by London directly)** fixing the fact that the nested sub-agent
   "thinking/processing" section (`AgentStepsPanel`) has never actually been able to stream live,
   above the response, *during generation* — independent of the reload problem. Both (2) and (3)
   trace back to the same root cause (see below), which is why they're one phase, not two.

London's own framing, worth carrying into how you verify this: *"the thinking process that we wanted
streamed in a nested section above the returned message... wasn't necessarily possible or persistent
before."* Two distinct failures, one root cause, one fix. Don't treat this as "just add persistence
and call it done" — the live-streaming half is just as much a pass/fail criterion as the reload half.

## Orient first (read these, in order)

1. `.planning/skills-sandbox/phases/02-persistent-tool-memory/02-RESEARCH.md` — the live
   verification pass. Its central finding: `vcso_chat_messages` has no tool-call column (confirming
   the reference PRD's "no migration needed" does NOT carry over) — but `agent_delegation_runs`/
   `agent_delegation_steps` already exist, are already shared cross-surface infrastructure, and are
   already actively used. Do not re-derive this — it was verified directly against the live Supabase
   project and codebase on 2026-07-01. Re-check only if you suspect drift.
2. `.planning/skills-sandbox/phases/02-persistent-tool-memory/CONTEXT.md` — this phase's decisions,
   all proposed by the Orchestration Agent based on the research and (per the checkpoint note in
   `STATE.md`) confirmed or corrected by London before this thread opened. If you're picking this up
   and don't see confirmation logged in `STATE.md`, stop and ask rather than assuming.
3. `02-01-PLAN.md` and `02-02-PLAN.md` (same folder) — the two build specs.
4. `.planning/skills-sandbox/CONTEXT.md` §7 — the project-wide decision this phase implements
   (persistent tool memory as shared plumbing, built early).
5. `docs/migrations/009_sub_agent_orchestration.sql` — the existing schema you're extending. Read
   this in full; don't assume the column list from `02-RESEARCH.md`'s summary is complete for every
   detail you might need (e.g. exact constraint names, if you need to reference them).
6. `api/vcso/chat.ts` in full, at least the region from `shouldCallKbExplorer` through the end of the
   chat handler (~lines 257–630). You're editing three separate spots in this file; read it end to
   end once before touching any of them so your edits stay mutually consistent.
7. `lib/virtualCsoApi.ts` — `getMessagesForChat()` and `toMessage()`.

## What you build

### Plan 02-01 — `docs/migrations/20260701_agent_delegation_assistant_message_link.sql`
One column: `agent_delegation_runs.assistant_message_id UUID REFERENCES vcso_chat_messages(id) ON
DELETE SET NULL`, plus an index. No RLS changes (existing owner-only policies already cover it). Do
**not** touch `parent_thread_id`/`parent_message_id` — those are deliberately soft references shared
across `virtual_cso`/`os_engine`/`domain_agent`/`sprint_planning`/`system`; leave them exactly as they
are.

### Plan 02-02 — wiring, three files, three fixes
1. `api/vcso/chat.ts`: `callKbExplorer()` returns `runId: data.run_id ?? null` alongside its existing
   fields.
2. `api/vcso/chat.ts`: after the assistant message insert succeeds, if `kbResult?.runId` is set,
   `UPDATE agent_delegation_runs SET assistant_message_id = <new message id> WHERE id = runId AND
   user_id = userId` using the founder's own client.
3. `api/vcso/chat.ts`: extend the `recentMessages` query (or add one parallel query) to also fetch
   `agent_delegation_steps` joined via `agent_delegation_runs.assistant_message_id` for assistant
   messages in the window, and pass the reconstructed data into `assemblePrompt()` as a new,
   separate input — do not change the existing `recentMessages` shape other consumers rely on.
4. `lib/virtualCsoApi.ts`: `getMessagesForChat()` gets the same join; `toMessage()` accepts the
   reconstructed steps instead of reading the dead `row.agentSteps` field.
5. No component changes should be needed in `MessageBubble.tsx`/`AgentStepsPanel.tsx` (KB Explorer
   Phase 9 already built them to render `message.agentSteps` when present) — if you find they need
   changes to consume the shape you're producing, make the minimal fix and note it; don't redesign
   them.
6. **Live-streaming fix (§6 of `02-02-PLAN.md`).** `kbResult.steps` is fully known at ~line 501, well
   before the `ready` SSE event (~line 560) and long before `streamAnthropic()` starts (~line 588) —
   but today `agentSteps` is only ever sent in the final `done` event (~line 646), after the text has
   already fully streamed. Add `agentSteps: kbResult?.steps ?? undefined` to the `ready` payload (or a
   new dedicated event if you find a concrete reason to prefer one). Find wherever the client assembles
   streaming message state from `onReady`/`onToken`/`done` (likely `VirtualCSOWorkspace.tsx` — confirm,
   don't assume) and make it render `AgentStepsPanel` as soon as the early steps arrive, above the text
   bubble that fills in via `onToken` shortly after. Leave the `done` event's `agentSteps` untouched —
   it's still what gets committed to the persisted `Message` object.

## Hard constraints

- **Do not create a new tool-call-result table.** `agent_delegation_runs`/`agent_delegation_steps`
  already are that table. If you find yourself wanting to add a second one, stop — you've likely
  misread something in the research; re-read `02-RESEARCH.md` §2 before proceeding.
- **Do not touch `python-backend/services/sub_agent_orchestrator.py`.** The Python service already
  writes `agent_delegation_runs`/`agent_delegation_steps` correctly; this phase's new column is
  populated from the Node/Vercel side (`chat.ts`) after the fact, since the Python service has no
  visibility into the assistant message (which doesn't exist yet when the Python call happens).
- **Do not add a hard FK to `parent_thread_id`/`parent_message_id`.** They're intentionally soft,
  shared across surfaces with their own thread tables.
- **Do not enable any `agent_capabilities` row** or build new capabilities. Out of scope.
- If `ARCHITECTOS_PYTHON_BACKEND_URL`/`ARCHITECTOS_INGEST_SECRET` are unset in this environment (they
  may be — `agent_delegation_runs` had 0 rows at research time), you can't fully live-test the
  KB-Explorer-triggering path end to end. Verify what you can (schema, type-checking, direct SQL
  simulation of a run + assistant message + steps), note what you couldn't live-test, and don't treat
  an unset env var as a blocker to stop work entirely — flag it in your report instead.

## Done when

All success criteria in both `02-01-PLAN.md` and `02-02-PLAN.md` are met. Verify with real
queries/test messages where the environment allows; where it doesn't (env vars unset), simulate by
directly inserting a test `agent_delegation_runs`/`agent_delegation_steps` row pair and confirming
the reload path (`getMessagesForChat()`) and follow-up-context path reconstruct it correctly.

Report back: a one-paragraph summary, the migration filename, confirmation of each success
criterion's result (including which were live-tested vs. simulated due to env config), whether KB
Explorer's `agentSteps` reload was confirmed working with no KB-Explorer-specific code change, **and
explicit confirmation of the live-streaming fix** — that `agentSteps` reaches the client via `ready`
(or your chosen early event) ahead of the first streamed text token, not only at `done`. Then stop —
Phase 3 (Skill Discovery & Routing) is opened from the orchestration thread, not by you.
