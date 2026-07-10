# Execution Agent Brief — Phase 4: Domain Agents Surfaces (Functional Wiring)

You are the Execution Agent for **Phase 4** of the Agent Harness (Episode 6) build. You wire the
existing Domain Agents UI scaffold to the real Phase‑1–3 backend. Run **04-01 (reads) first, then
04-02 (workspace)**. You do not re-plan and you do not start other phases.

## Read these before writing any code (in order)
1. `.planning/agent-harness/CONTEXT.md` — build rationale + decisions you must not override.
2. `.planning/agent-harness/ROADMAP.md` — Phase 4 goal, dependencies, success criteria.
3. Phases 1–3 completions — the live data model, engine, and P&L workflow you wire to.
4. `phases/04-domain-agents-surfaces/04-RESEARCH.md` — the existing scaffold, mock shape, endpoints,
   reuse points. **Trust it, but re-verify anything you change.**
5. `04-CONTEXT.md` (the four locked forks + field map), then `04-01-PLAN.md`, then `04-02-PLAN.md`.
6. `DomainAgents_Wireframe_Spec.md` §§2–9 — the surface source of truth. Wins over the reference PRD.

## What you are building
(04-01) `routers/domain_agents.py` read endpoints + `GET /api/tasks` list, and wiring
Gallery/Profile/Kanban/Library to real data (replacing `mockDomainAgents.ts`), plus free-form
capture+mapping. (04-02) a `tasksApi` SSE client + the live `DomainAgentWorkspace` (task thread,
render panel, reply, upload, completion actions), reusing the `virtual-cso/` chat components.

## Hard constraints (do not violate)
- **Functional wiring only — no visual redesign.** Keep the scaffold's layout + AOS tokens; swap the
  data layer + add live execution. Visual/UX polish is the post‑Ep7 §8 audit. If you're restyling,
  you've left Phase 4.
- **Reuse, don't rebuild.** Mirror `lib/virtualCsoApi.ts` for the SSE client; reuse
  `components/pro-suite/virtual-cso/` (`ChatThread`/`Composer`/`MessageBubble`/`AgentStepsPanel`) for
  the Workspace; reuse the Phase‑2 `/api/tasks/*` execution endpoints (add only reads/list);
  `ArtifactService` for the Library.
- **Frozen SSE vocabulary.** Render exactly the Phase‑2 `task_*` events. Curated trace only (L11);
  progress = fixed workflow steps, **no editable todo panel** (C4); no open-ended brainstorming
  surface (L14).
- **Read endpoints location (locked fork 2).** Agent/profile/artifacts-list/freeform → new
  `routers/domain_agents.py`; `GET /api/tasks` list → `tasks.py`.
- **Free-form scope (locked fork 3).** Capture to `freeform_requests` + map-to-workflow → launch
  when mappable; **do not** build L16 net-new dynamic assembly.
- **Second Brain button inert (locked fork 4).** Present but disabled/no-op; the L17 trigger is
  Phase 5. Download is live.
- **Real data only.** Render the seeded 5 agents + the real P&L workflow; do NOT render the mock's
  extra workflows (hiring/pricing) that aren't in the DB. Skills/Templates never render.
- **Founder-auth.** All new endpoints use `Depends(get_current_user_id)`; RLS-scoped.

## Confirm with London at checkpoint (do not silently decide)
- Kanban task-list filters + response shape vs. `types.ts` (`DomainTask`).
- Gallery `activity`/`initial` derivation (task-count aggregation).
- Render-panel workspace-file read affordance (does `GET /api/tasks/{id}/files/{path}` exist, or add
  a minimal read?).
- Reuse depth of `virtualCsoApi.ts`/chat components (lean maximal reuse + thin task adapter).
- Free-form→workflow mapping heuristic (lean reuse the VCSO `classify()` matcher).

## Done when
1. Phase 4 success criteria (SURF-01…SURF-04) met and each independently verified.
2. 04-01: Gallery/Profile/Kanban/Library render real data (no mock); free-form capture+mapping works.
3. 04-02: a P&L task runs live in the Workspace (SSE) — blocks for upload, resumes, renders
   `artifact.html`, reaches **Review**; reply unblocks; reconnect reconstructs (L21).
4. `python -m compileall python-backend` + `npm run build`/focused TS check pass; live Anthropic/GKE
   smoke flagged deferred (L18).
5. `Pro-Suite-Progress.md`, `.planning/agent-harness/ROADMAP.md`, `.planning/agent-harness/STATE.md`
   updated; `phases/04-domain-agents-surfaces/04-COMPLETION.md` written.

## Explicitly out of scope for you
The OS Engine promotion trigger + graduation (Phase 5); VCSO `@Agent` invocation (Phase 7); L16
net-new assembly; visual/UX redesign (§8); other agents' workflows. Do not resolve anything the
CONTEXT marks as a later phase.
