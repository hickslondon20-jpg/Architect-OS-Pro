# Phase 7 Context — VCSO → Domain Agent Invocation (`@Agent`)

**Phase:** 07 of the Agent Harness (Episode 6) build — the last build phase before Phase 8
verification.
**Read first:** build-level `CONTEXT.md` + `ROADMAP.md`; this phase's `07-RESEARCH.md`; Phases 2 + 4
completions (the `create_task` seam + the surfaces); `DomainAgents_Wireframe_Spec.md` §4/§10.
Domain Agents docs win.

---

## Why this phase, and what it is

Let a Virtual CSO thread invoke a domain agent (`@FinancialAgent …`) which **spawns a Task in the
same plumbing** and appears in the same Kanban + Artifacts Library — **without** turning the VCSO
thread into a Domain Agent workspace (protects **L14**). Small: `@`-detection + the existing
`create_task` hand-off + an inline thread card. **No new migration.**

## What this phase is NOT
- **Not a workspace takeover (L14).** VCSO gets a **handle** (status + links), not an inline task
  run. The task runs/streams in the Domain Agent Workspace/Kanban.
- **Not a new task path.** Reuse `create_task(origin='vcso', origin_thread_id)` (Phase 2).
- **Not new schema.** `tasks.origin` already includes `vcso`.
- **Not L16 net-new assembly.** A `@Agent` free-form maps to a workflow or logs to request-capture
  (same as Phase 4); dynamic net-new assembly stays deferred.

## Decisions that shape this phase (locked 2026-07-05)
1. **Detection = pre-loop `@mention` parse** (`_detect_agent_invocation`, mirroring
   `_detect_explicit_skill_invocation`) → resolve agent + map remainder to workflow/free-form.
2. **Run model = create + handle card + open in Workspace** — `create_task(origin='vcso')`, post an
   inline card; the task runs in the Domain Agent Workspace/Kanban, not inline. Status = Kanban state.
3. **Card = reuse `DomainAgentPrimitives`** in the VCSO thread.

## The design, concretely
- **Backend (`vcso_chat_service.py`):** before the tool loop, `_detect_agent_invocation(text)` parses
  `@AgentName …`; if matched, resolve the `domain_agents` row, map the remainder to a workflow (reuse
  the Phase‑4 matcher) or free-form (log `freeform_requests`), call
  `create_task(user_id, agent_id, workflow_id?, origin='vcso', origin_thread_id=thread_id, title)`,
  and emit an **`agent_task`** SSE event (+ route payload) carrying the task ref (id, agent, workflow,
  status). The VCSO loop does **not** run the task.
- **Frontend:** the VCSO thread renders an inline **agent-task card** (reuse `DomainAgentPrimitives`)
  — agent, workflow, status chip, **Open in Workspace** (→ the Domain Agent Workspace at that task)
  + **View artifact** (when Review/Done). Status reflects the task's Kanban state (on reload / light
  refresh).
- **Cross-surface:** the task shows in the same Kanban + Library with an `origin='vcso'` marker;
  provenance/lineage identical to a Profile-launched task.

## Ep7 seam
Identical provenance/lineage to Profile-launched tasks; `origin` is additive metadata, not a
separate path.

## Success criteria (ROADMAP Phase 7 — INVK-01, INVK-02)
1. `@FinancialAgent run a monthly P&L assessment` from a VCSO thread spawns a task indistinguishable
   in Kanban/Library from a Profile-launched one except `origin='vcso'`.
2. The VCSO thread shows a task handle + status/artifact link and does **not** morph into a workspace
   (L14 verified); all three entry points resolve to one shared task object.

## Open items to resolve at build-planning (flag, don't silently pick)
- **`@mention` grammar** — how agent names are matched (`@Financial`, `@FinancialAgent`, key vs.
  display name); lean case-insensitive key/short-name match with a small alias map.
- **Mapping ambiguity** — if the remainder maps to no workflow: create a free-form task (Phase‑4
  behavior) vs. reply asking which workflow; lean free-form task + request-capture.
- **`agent_task` event/card contract** — the payload shape the frontend card consumes; align with
  `DomainTask`/`types.ts`.
- **Status freshness** — poll vs. refresh-on-reload for the card's status chip; lean refresh-on-open
  + light poll, no inline run stream.
