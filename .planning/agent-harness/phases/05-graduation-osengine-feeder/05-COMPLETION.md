# Phase 5 Completion - Graduation + OS Engine Feeder

**Completed:** 2026-07-05
**Scope:** Workspace `artifact.html` graduation, deliberate L17 promotion trigger, and existing Second Brain control wiring.
**Migration:** None.

## What shipped
- `python-backend/services/artifact_service.py`: added `register_domain_artifact(...)`, a workspace-sourced registration path from task `workspace_files.artifact.html` into the existing `artifacts` bucket/table.
- `python-backend/services/harness_engine.py`: added a thin Review-transition graduation hook. Reaching Review registers the artifact; rerunning Review updates the existing task artifact instead of duplicating it.
- `python-backend/services/doc_wiki_agent_artifact_adapter.py`: added task-sourced `synthesize_from_task(...)`, reusing `DocWikiSynthesisService`, `SourcePayload`, and `agent_artifact` page kind without forcing Tasks through `agent_delegation_runs`.
- `python-backend/routers/tasks.py`: added deliberate `POST /api/tasks/{id}/promote`, requiring an owned registered task artifact, triggering `synthesize_from_task`, and setting `artifacts.promoted_to_kb=true`.
- `lib/tasksApi.ts`, `DomainAgentWorkspace.tsx`, `DomainAgentArtifacts.tsx`: wired existing Add-to-Second-Brain controls and promoted state.

## Guardrails honored
- No new migration.
- No GKE or sandbox export path used for graduation; `deliver_from_sandbox` remains sandbox-sourced and untouched for its existing VCSO path.
- DOCX export remains deferred for L20.
- Nothing auto-promotes. Review only registers the Library artifact; only `POST /api/tasks/{id}/promote` triggers OS Engine synthesis.
- OS Engine remains sole writer. Phase 5 sends a synthesis payload and does not generate wiki pages or vectors directly.
- Provenance/source refs are carried into both the registered artifact and promotion payload.

## Verification
- PASS: `python -m pytest python-backend\tests\test_harness_engine_phase2.py` (`8 passed`)
- PASS: `python -m compileall python-backend`
  - Existing non-fatal `.pytest_cache` listing warning still appears.
- PASS: `npm.cmd run build`
  - Existing large chunk warning still appears.

## Success criteria mapping
- GRAD-01: Met at code/test level. Review graduation inserts `source_kind='domain_agent_task'` artifact rows with task/workflow/agent/template lineage and provenance; revision updates the same row.
- GRAD-02: Met at code/test level. `POST /api/tasks/{id}/promote` calls `synthesize_from_task`, forwards artifact content + provenance/source refs, and sets `promoted_to_kb`; no auto-promotion path was added.
- GRAD-03: Met at code/build level. Workspace + Library controls now support download and deliberate Second Brain promotion while reflecting promoted state.

## Deferred / not run
- Live authenticated browser click-through was not run in this session.
- Live Anthropic task execution smoke remains deferred per L18.
- Live OS Engine promotion/synthesis smoke remains deferred per L18; focused tests assert the payload with fakes.
- Live GKE/sandbox DOCX export remains out of scope and deferred.
