# Phase 4 Completion - Domain Agents Surfaces

**Completed:** 2026-07-05
**Scope:** 04-01 reads first, then 04-02 workspace. Functional wiring only; no visual redesign.

## What shipped
- `python-backend/routers/domain_agents.py`: founder-auth read endpoints for `GET /api/domain-agents`, `GET /api/domain-agents/{key}`, `GET /api/artifacts`, and `POST /api/domain-agents/{key}/freeform`.
- `python-backend/routers/tasks.py`: added `GET /api/tasks` returning the existing `DomainTask` shape with `agent`, `status`, `q`, `dateFrom`, and `dateTo` filters; added read-only `GET /api/tasks/{id}/files/{file_path:path}` for nested workspace paths.
- `python-backend/main.py`: mounted the Domain Agents read router and Phase 2 task router.
- `lib/domainAgentsApi.ts`: live API client for Gallery/Profile/Kanban/Library/free-form.
- `lib/tasksApi.ts`: task create/reconstruct/run/reply/upload/cancel/file-read client with frozen `task_*` SSE parsing.
- Domain Agents surfaces now load real backend data instead of `mockDomainAgents.ts`: Gallery, Profile, Kanban, Artifacts Library, and Workspace.
- `DomainAgentWorkspace` now reconstructs a task, streams/resumes `/api/tasks/{id}/run`, posts replies, uploads files, renders `artifact.html`, and shows fixed workflow progress plus curated trace.

## Guardrails honored
- Skills and Templates remain invisible.
- Only real seeded workflows render; the mock hiring/pricing workflows are not used.
- Free-form requests log to `freeform_requests` and conservatively map to real workflows; unmapped requests return `mapped=false`.
- Second Brain controls remain present but inert/disabled; Phase 5 owns the L17 trigger.
- Workspace remains task-bound with fixed workflow progress; no editable todo panel and no open-ended brainstorming surface.
- Workspace file read uses founder ownership, task ownership, table rows only, nested `{file_path:path}`, and rejects traversal.

## Verification
- PASS: `python -m compileall python-backend`
- PASS: `python -m pytest python-backend/tests/test_harness_engine_phase2.py` (`7 passed`)
- PASS: `npm.cmd run build`
- NOTE: `npm run build` through PowerShell is blocked by local execution policy; `npm.cmd run build` is the working Windows path.
- NOTE: build completed with the existing large chunk warning.

## Live smoke status
- Deferred: live Anthropic task execution smoke remains credential/runtime-gated per L18.
- Deferred: live GKE/sandbox artifact export smoke remains Phase 5 / consolidated smoke debt.
- Not run locally: authenticated browser click-through against live Supabase; protected route still requires a signed-in browser session.

## Success criteria mapping
- SURF-01: Met at code/build level. Gallery, Profile, Workspace, Kanban, and Library are wired to backend APIs.
- SURF-02: Met at code/build level. Kanban uses the Phase 2 task states and Workspace reads the same task object.
- SURF-03: Met at code/build level. Free-form capture and conservative mapping are implemented; P&L live run path is wired to SSE/reply/upload/render, with external live smoke deferred.
- SURF-04: Met. Skills/Templates hidden; AI Usage links to Settings; Second Brain is present but inert.

## Residual notes
- Phase 5 should register Review artifacts into `artifacts` via the sandbox/export path and wire the deliberate Add-to-Second-Brain trigger.
- Phase 8 should perform the full authenticated browser and live-runtime seam verification.
