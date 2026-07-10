# Phase 4 Context — Domain Agents Surfaces (Functional Wiring)

**Phase:** 04 of the Agent Harness (Episode 6) build. Split into **04-01** (reads) + **04-02**
(workspace).
**Read first:** build-level `CONTEXT.md` + `ROADMAP.md`; this phase's `04-RESEARCH.md`; Phases 1–3
completions (the live data + engine + P&L workflow); `DomainAgents_Wireframe_Spec.md` (§§2–9, the
surface source of truth). Domain Agents docs win over the reference PRD.

---

## Why this phase, and what it is

Make the anchor P&L workflow **fully operable from the UI on real data**. The five surfaces already
exist as a wireframe scaffold on `mockDomainAgents.ts`; Phase 4 **replaces the mock with real
Phase‑1–3 backend + SSE**. This is a **functional wiring pass** — which capability feeds which
surface and what the interaction is — **not** visual/UX redesign (that is the post‑Ep7 §8 audit).

## What this phase is NOT
- **Not a redesign.** The scaffold's layout/tokens stay; Phase 4 swaps the data layer + adds live
  execution. Don't restyle.
- **Not new backend engine.** Reuse the Phase‑2 `/api/tasks/*` execution endpoints; add only
  **read/list** endpoints + free-form capture.
- **Not the OS Engine promotion.** The Second Brain button stays inert; the L17 trigger is Phase 5.
- **Not L16 net-new assembly.** Free-form does capture + workflow-mapping only this phase.
- **Not visual polish / not other agents' workflows.** Only the real seeded data (P&L for Financial).

## Decisions that shape this phase (locked 2026-07-05)
1. **Split 04-01 (reads) / 04-02 (workspace)** — each independently verifiable.
2. **Read endpoints in a new `routers/domain_agents.py`** (agents, profile, artifacts-list,
   freeform); `GET /api/tasks` list stays in `tasks.py`.
3. **Free-form = capture + workflow-mapping** now; net-new assembly deferred.
4. **Second Brain button inert** in Phase 4; L17 trigger in Phase 5.

**Inherited:** functional wiring only (no redesign, §8 later); Kanban states = the Phase‑2 state
machine (Ready→Running→Blocked→Review→Done); reuse VCSO chat components + the frozen `task_*` SSE
vocabulary; skills/templates invisible; AI Usage is a Settings link; curated trace only (L11).

## 04-01 — Reads (backend read endpoints + Gallery/Profile/Kanban/Library data wiring)
- **Backend (`routers/domain_agents.py`):** `GET /api/domain-agents` (gallery),
  `GET /api/domain-agents/{key}` (profile: capabilities, thought_starters, workflows shelf, recent
  activity), `GET /api/artifacts` (library list), `POST /api/domain-agents/{key}/freeform`
  (log `freeform_requests` + map to a workflow → `create_task` when mappable). **`tasks.py`:** add
  `GET /api/tasks` (Kanban list, filter by agent/status). All `Depends(get_current_user_id)`.
- **Frontend:** replace `mockDomainAgents.ts` reads with a `domainAgentsApi` client; map DB→frontend
  shape (see `04-RESEARCH.md`); wire Gallery (5 agents + recent tasks), Profile (capabilities/
  thought-starters/**real** workflows shelf/free-form input/recent activity), Kanban (tasks list +
  states), Artifacts Library (list + `GET /api/artifacts/{id}` preview + Download; provenance link).
- Free-form input logs to request-capture and, when mapped, launches a task (opens Workspace).

## 04-02 — Workspace (live task execution)
- **Frontend:** a `tasksApi` SSE client mirroring `lib/virtualCsoApi.ts` against `/api/tasks/*`;
  `DomainAgentWorkspace` reuses `ChatThread`/`Composer`/`MessageBubble`/`AgentStepsPanel` for the
  task-bound thread; render the frozen `task_*` events into the progress indicator + narration;
  right-rail **render panel** shows `artifact.html` (workspace file) as it appears; task meta bar
  (agent/workflow/status/resources); **reply** (unblock), **file upload** (satisfy prereq);
  completion actions on Review/Done: **Download** (live), **Add to Second Brain** (inert → Phase 5).
- **Entry points** all resolve to one task/workspace: Profile launch, Kanban card, (Phase 7) VCSO
  `@Agent`. On (re)entry, `GET /api/tasks/{id}` reconstructs; `POST /{id}/run` streams (start/resume).

## Ep7 seam
Artifact preview + trace read `provenance`/`source_refs` so Ep7 drops citation chips in without
restructuring.

## Success criteria (ROADMAP Phase 4 — SURF-01…SURF-04)
1. Gallery→Profile→Workspace→Kanban→Library operate on **real** backend data (no mock).
2. Kanban matches the Phase‑2 state machine; "waiting on you" on Blocked; entry points resolve to
   one task.
3. A launched P&L task runs live in the Workspace (SSE), blocks for upload, resumes, renders
   `artifact.html`, reaches Review; a free-form ask logs a `freeform_requests` row (+ launches when
   mapped).
4. Skills/Templates invisible; AI Usage links to Settings; Second Brain button present but inert.

## Open items to resolve at build-planning (flag, don't silently pick)
- **Task-list filters/shape** for Kanban (by agent/status/date) — confirm the query + response shape
  matches `DomainTask`/`types.ts`.
- **`activity`/`initial` derivation** on the gallery (task counts, last-run) — confirm cheap
  aggregation vs. a computed field.
- **Render panel source** — read `artifact.html` via `GET /api/tasks/{id}` workspace metadata +
  a file-content fetch; confirm the workspace-file read affordance (does a `GET /{id}/files/{path}`
  exist or need adding).
- **Reuse depth** — how much of `virtualCsoApi.ts`/chat components is shared vs. a task-bound fork;
  lean maximal reuse, thin task adapter.
- **Free-form mapping heuristic** — how a free-form string maps to a workflow (keyword/skill match
  reuse from VCSO `classify()`); lean reuse the existing matcher.
