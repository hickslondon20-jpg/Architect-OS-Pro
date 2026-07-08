# Execution Agent Brief — Phase 7: VCSO → Domain Agent Invocation (`@Agent`)

You are the Execution Agent for **Phase 7** (the last build phase) of the Agent Harness (Episode 6).
You add `@Agent` invocation from Virtual CSO. You do not re-plan and you do not start Phase 8.

## Read these before writing any code (in order)
1. `.planning/agent-harness/CONTEXT.md` — build rationale + decisions you must not override.
2. `.planning/agent-harness/ROADMAP.md` — Phase 7 goal, dependencies, success criteria.
3. `phases/07-vcso-agent-invocation/07-RESEARCH.md` — the seam already exists; reuse points.
   **Trust it, but re-verify anything you change.**
4. `07-CONTEXT.md` (the 3 locked forks + design), then `07-01-PLAN.md`.
5. `DomainAgents_Wireframe_Spec.md` §4/§10. Wins over the reference PRD.

## What you are building
A pre-loop `_detect_agent_invocation` in `vcso_chat_service.py` that resolves `@AgentName …` and
calls the existing `create_task(origin='vcso', origin_thread_id=…)`; an `agent_task` SSE
event/route payload; and a VCSO-thread agent-task card reusing `DomainAgentPrimitives`. **No new
migration.**

## Hard constraints (do not violate)
- **VCSO gets a handle, not a workspace takeover (L14).** Do NOT run/stream the task inside the VCSO
  loop. VCSO creates the task and posts a card; the task runs in the Domain Agent Workspace/Kanban.
  If you're streaming `task_*` run events into the VCSO thread, you've violated L14.
- **Reuse the seam.** Use `HarnessEngine.create_task(origin='vcso', origin_thread_id=…)` (Phase 2) —
  do NOT add a new task-creation path. `tasks.origin` already includes `vcso`; **no new schema**.
- **Detection is pre-loop + deterministic** (mirror `_detect_explicit_skill_invocation`). Map the
  remainder to a workflow via the Phase‑4 matcher; unmapped → free-form task + `freeform_requests`
  (no L16 net-new assembly).
- **One task object.** The spawned task is indistinguishable in Kanban/Library from a Profile-launched
  one except `origin='vcso'`; all three entry points resolve to the same task. Provenance/lineage
  identical.
- **Reuse the card.** Reuse `DomainAgentPrimitives`; status = the task's Kanban state (refresh-on-open
  + light poll), not an inline run stream. Curated trace (L11).

## Confirm with London at checkpoint (do not silently decide)
- `@mention` grammar (key vs. display name; alias map) — lean case-insensitive key/short-name.
- Unmapped-request behavior — lean free-form task + request-capture (vs. asking which workflow).
- The `agent_task` event/card payload shape vs. `DomainTask`/`types.ts`.
- Status freshness — lean refresh-on-open + light poll, no inline run stream.

## Done when
1. Phase 7 success criteria (INVK-01, INVK-02) met and each independently verified.
2. `@FinancialAgent …` spawns a task indistinguishable from a Profile-launched one except
   `origin='vcso'`; the VCSO thread shows a handle card and does NOT morph into a workspace (L14).
3. All three entry points resolve to one task; unmapped `@Agent` → free-form task + `freeform_requests`.
4. `python -m compileall python-backend` + focused tests + `npm.cmd run build` pass; live Anthropic
   smoke flagged deferred (L18).
5. `Pro-Suite-Progress.md`, `.planning/agent-harness/ROADMAP.md`, `.planning/agent-harness/STATE.md`
   updated; `phases/07-vcso-agent-invocation/07-COMPLETION.md` written.

## Explicitly out of scope for you
Running the task inline in VCSO (L14); L16 net-new assembly; new schema; Ep7 citation UI; the Phase 8
verification/seam pass; visual redesign (§8).
