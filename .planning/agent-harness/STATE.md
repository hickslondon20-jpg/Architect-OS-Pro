# State: Agent Harness - Domain Agents + VCSO Deep Mode (Episode 6) - ArchitectOS Pro

**Last updated:** 2026-07-06

## Current Focus

**Phase 1 DONE (live); Phase 2 DONE (backend/local verification + live `020`); Phase 3 DONE
(backend/local verification + live `021`); Phase 4 DONE (functional wiring; live smoke deferred
per L18); Phase 5 DONE (graduation + deliberate L17 trigger; live smoke deferred per L18);
Phase 6 DONE (VCSO Deep Mode); Phase 7 DONE (`@Agent` task handoff).**

Migration `019_domain_agents_object_model.sql` was applied live to `pwacpjqkntnovndhspxt` on
2026-07-05 and verified (7 tables, seeds, `artifacts` ALTER, lineage join, L21 both-owner-type
proof; see `phases/01-object-model-and-lineage/01-COMPLETION.md`). Phase 2 added the generic
backend harness engine, task execution endpoints, and migration `020_ai_usage_log_task_id.sql`;
`020` is applied live and verified (`ai_usage_log.task_id` + index present). Phase 3 added generic
programmatic `handler` mode, registered `pnl_intake` + `pnl_render` outside the engine, filled the
5 P&L workflow steps via `021_pnl_workflow_steps_content.sql`, applied `021` live, and verified the
no-P&L -> Blocked upload -> upload -> fake run -> `artifact.html` -> Review path with focused tests.

Phase 4 replaced the Domain Agents mock-data scaffold with real Phase 1-3 backend wiring:
`routers/domain_agents.py` read endpoints, `GET /api/tasks`, read-only nested workspace file reads,
live Gallery/Profile/Kanban/Library data, free-form capture/mapping, and a task-bound Workspace
with SSE/reply/upload/render-panel behavior. Second Brain remains present-but-inert for Phase 5.
See `phases/04-domain-agents-surfaces/04-COMPLETION.md`.

**Phase 5 completed (2026-07-05).** Full set at
`phases/05-graduation-osengine-feeder/` (RESEARCH + CONTEXT + PLAN + EXECUTION-AGENT-PROMPT), no new
migration. Forks locked: (1) register the in-process `artifact.html` from `workspace_files` into
`artifacts` (`source_kind='domain_agent_task'` + lineage/provenance) â€” **no GKE**; sandbox DOCX
export deferred; (2) **graduate at Review** (idempotent on revision); (3) L17 promotion reuses the
doc-wiki agent-artifact feeder via a **new `synthesize_from_task`** entry point (the existing
`synthesize_from_run` keys off `agent_delegation_runs`, not Tasks â€” flagged in `05-RESEARCH.md`),
`POST /api/tasks/{id}/promote`, sets `promoted_to_kb`, deliberate/opt-in. Wires the Phaseâ€‘4 inert
Second Brain controls.

Phase 5 closed the persistence arc at code/build level: `ArtifactService.register_domain_artifact`
registers task `workspace_files.artifact.html` into the existing `artifacts` bucket/table with
`source_kind='domain_agent_task'`, lineage, provenance, and idempotent task-based revision updates;
the harness Review transition calls the thin graduation hook; `DocWikiAgentArtifactAdapter` now has
task-sourced `synthesize_from_task`; `POST /api/tasks/{id}/promote` deliberately triggers that L17
handoff and sets `promoted_to_kb`; Workspace + Library Second Brain controls call the endpoint and
reflect promoted state. No migration and no GKE/sandbox DOCX export were added.

**Phase 6 completed (2026-07-06).** Full set at `phases/06-vcso-deep-mode/`, including
`06-COMPLETION.md`. Migration `022_vcso_deep_mode` was applied live to Supabase
`pwacpjqkntnovndhspxt` and verified: `agent_todos`, `vcso_chat_messages.deep_mode`,
`vcso_chat_threads.agent_status`, and `vcso_chat_threads.deep_resume_state` exist; `agent_todos`
has own-row RLS; a temp live smoke proved `agent_todos` plus `workspace_files owner_type='thread'`
inserts and cleanup. Deep-mode tools are registry natives scoped to `virtual_cso_deep`; usage
continues to tag `surface='virtual_cso'`. `stream_chat` branches additively with `MAX_DEEP_ROUNDS=50`,
`ask_user` pause/resume-as-tool-result, todo/workspace SSE events, and OFF path retaining normal
`virtual_cso` tool scope/prompt/cap. Frontend extends the existing VCSO API/Composer/workspace with
the Deep Mode toggle, editable Plan Panel, decoupled Workspace Panel, and inline waiting prompt.
Domain Agents leakage scan returned no matches for Deep Mode terms.

**Phase 7 completed (2026-07-06).** Full set at `phases/07-vcso-agent-invocation/`, including
`07-COMPLETION.md`. No migration was added. `vcso_chat_service.py` now detects leading/standalone
`@Agent` mentions before the normal VCSO tool loop, resolves case-insensitive key/name aliases,
maps the remainder to an existing workflow when possible, captures `freeform_requests`, and calls
the Phase-2 `HarnessEngine.create_task(origin='vcso', origin_thread_id=...)` seam. The VCSO thread
gets an `agent_task` handle card and persisted history payload; the task runs only in the Domain
Agent Workspace/Kanban, preserving L14.

**Phase 8 verification run completed (2026-07-06); Ep6 is code-complete at the local/fake gate.**
See `phases/08-verification-and-seams/08-COMPLETION.md`. The first Phase 8 pass caught a subtle
normal VCSO OFF-path regression: non-`@Agent` turns evaluated the Domain Agent lookup before the
existing stream. That seam is now restored; `test_vcso_chat_service_phase3.py` passed, and the
focused Ep6 suite passed `27 passed`. `python -m compileall python-backend` and `npm.cmd run build`
also pass. The standalone `test_sandbox_bridge_phase4.py` local `run_with_bridge(...)` timeout is
reclassified as pre-existing Ep4/Ep5 sandbox-test friction, not an Ep6 regression, and is folded
into the §8 live GKE/sandbox smoke per L18.

**Next action:** begin the section 8 next gate: front-end/UX real-wiring audit, then consolidated
live smokes. Residual live smokes remain consolidated into the Phase 8 -> §8 checklist:
authenticated browser click-through, live Anthropic Deep Mode / `@Agent` turn, live sub-agent/GKE
execution, live OS Engine synthesis/promotion, GKE/sandbox export, and Ep5 verification debt.

## Documents

- `CONTEXT.md` - why the build exists, the reframe + Rosetta, reuse map, governing principles, the
  11 decisions execution agents must not override, resolved forks (D1/D2/D4), conflict register,
  deferred/out-of-scope.
- `REQUIREMENTS.md` - adaptation notes vs. reference, 25 v1 requirements across 8 groups
  (OBJ/HARN/ANCH/SURF/GRAD/DEEP/INVK/VERIF), v2/deferred, out-of-scope, traceability.
- `ROADMAP.md` - 8 phases with goal/depends-on/requirements/success criteria + progress tracker.
- `STATE.md` - this file.
- `REFERENCES.md` - reference PRD -> phase extract/adapt/skip map + canonical sources.
- `phases/NN-slug/NN-01-PLAN.md` - the directional plan per phase. Each phase's CONTEXT /
  RESEARCH / EXECUTION-AGENT-PROMPT / COMPLETION are added as we reach it.

## Current Phase

**Phase 1 complete (live). Phase 2 complete (backend). Phase 3 complete (backend POC). Phase 4
complete (functional wiring). Phase 5 complete (graduation + feeder trigger). Phase 6 complete
(VCSO Deep Mode).**

Phase 1 (`phases/01-object-model-and-lineage/`) has the full set including `01-COMPLETION.md`;
migration `019` is applied + verified live. Phase 2 (`phases/02-harness-engine/`) has RESEARCH +
CONTEXT + PLAN + EXECUTION-AGENT-PROMPT + `02-COMPLETION.md`; migration `020` is applied + verified
live. Phase 3 (`phases/03-anchor-workflow-pnl/`) has RESEARCH + CONTEXT + PLAN +
EXECUTION-AGENT-PROMPT + `03-COMPLETION.md`; migration `021` is applied + verified live. Phase 4
(`phases/04-domain-agents-surfaces/`) has RESEARCH + CONTEXT + PLAN + EXECUTION-AGENT-PROMPT +
`04-COMPLETION.md`. Phase 5 (`phases/05-graduation-osengine-feeder/`) has RESEARCH + CONTEXT +
PLAN + `05-COMPLETION.md`. Phase 6 (`phases/06-vcso-deep-mode/`) has RESEARCH + CONTEXT + PLAN +
EXECUTION-AGENT-PROMPT + `06-COMPLETION.md`. Phase 7
(`phases/07-vcso-agent-invocation/`) has RESEARCH + CONTEXT + PLAN +
EXECUTION-AGENT-PROMPT + `07-COMPLETION.md`. Phase 8 remains.

## Open Design Forks Carried Into Build-Planning

- **D1 - RESOLVED (two layers bridged by scope sources).** Reconfirm against live
  `tool_registry.py` at Phase 2 build-planning; no re-decision expected.
- **D2 - RESOLVED via L17.** Harness does not synthesize the wiki; promotion triggers OS Engine.
  Keep the engine generic (Phase 2) so it stays reusable.
- **D4 - RESOLVED (three-tier graduation).** Confirm the artifact-registration point at Phase 5
  build-planning.
- **Wireframe section 12 opens** - auto-ingest -> deliberate confirmed; review gate -> always stop
  at Review confirmed; free-form guardrails -> broad-but-bounded (L16) confirmed.
- **Ep5 verification debt (L18)** - non-gating; tracked for the consolidated smoke/credentials
  phase (episode-map section 8). Not an Ep6 blocker.

## Progress Tracker

| Phase | Status |
|---|---|
| 1. Object Model & Lineage | Done (live `019`, 2026-07-05) |
| 2. Generic Harness Engine | Done (backend, `020` live, 2026-07-05) |
| 3. Anchor Workflow - Monthly P&L (POC) | Done (live `021`, fake E2E, 2026-07-05) |
| 4. Domain Agents Surfaces | Done (functional wiring, 2026-07-05; live smokes deferred per L18) |
| 5. Graduation + OS Engine Feeder | Done (workspace artifact graduation + deliberate L17 trigger, 2026-07-05; live smokes deferred per L18) |
| 6. VCSO Deep Mode | Done (live `022`, local build/tests, 2026-07-06; live Anthropic/browser smoke deferred per L18) |
| 7. VCSO -> Domain Agent Invocation | Done (pre-loop `@Agent` task handoff + VCSO handle card, 2026-07-06; live Anthropic/browser smoke deferred per L18) |
| 8. Verification & Seams | Done (focused suite green; §8 live-smoke checklist is next-gate input) |

## Session Continuity Note

Scoped across a Discuss-and-Plan session on 2026-07-03. Planning Round 1 approved the working model
and folded four alignments into the episode map as L16-L21 (free-form latitude, promotion trigger,
non-gating verification debt, generic anchor POC) plus L20-L21 (Rule #4 scoping, owner-flexible
substrate). CLAUDE.md Rule #4 was annotated to scope it to the fixed platform reports (L20).
Canonical docs are `../INTELLIGENCE-LAYER-ARCHITECTURE.md` and
`../INTELLIGENCE-LAYER-EPISODE-MAP.md`; where they or the Domain Agents vision/wireframe conflict
with the reference PRD, they win.
