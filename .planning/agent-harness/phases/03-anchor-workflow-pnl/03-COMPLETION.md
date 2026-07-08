# Phase 3 Completion - Anchor Workflow: Monthly P&L Assessment

**Completed:** 2026-07-05
**Migration:** `021_pnl_workflow_steps_content.sql`
**Live project:** Supabase `pwacpjqkntnovndhspxt`

## What shipped
- `python-backend/services/harness_engine.py`: generic `programmatic` handler mode via
  `register_programmatic_handler(...)`; handlers may return `StepResult` or `BlockedResult`.
- `python-backend/services/harness_handlers.py`: registered `pnl_intake` and `pnl_render`.
  P&L-specific logic stays outside the engine.
- `python-backend/routers/tasks.py`: imports the handler module for registration at task-router load.
- `docs/migrations/021_pnl_workflow_steps_content.sql`: update-in-place content for the five
  seeded Monthly P&L Assessment steps.
- `python-backend/tests/test_harness_engine_phase2.py`: focused Phase 3 coverage layered onto the
  Phase 2 harness tests.

## Checkpoint choices used
- Analyze capability: `document_analysis_agent`.
- Handler registry location: `services/harness_handlers.py`.
- Intake parse path: Docling `doc_processor` first, plain-text fallback when parser dependencies or
  file type support are unavailable.
- Migration shape: update the existing seeded workflow steps in place.
- OS Engine P&L-presence probe: lightweight existing founder data probe before asking for upload.

## Verification evidence
- Focused tests: `python -m pytest python-backend/tests/test_harness_engine_phase2.py` passed
  `7 passed`.
- Compile: `python -m compileall python-backend` passed; the known `.pytest_cache` listing warning
  appeared and did not fail compilation.
- Live migration: Supabase `apply_migration` returned `{"success":true}` for
  `021_pnl_workflow_steps_content`.
- Live row check: the five `produce_monthly_pnl_assessment` steps now show handler intake/render,
  `llm_human_input`, `llm_agent` with `document_analysis_agent` + `Diagnose the Numbers`, and
  `llm_single` with a Claude tool-schema output contract carrying `source_refs`.
- Supabase advisors: security/performance advisors returned the existing project backlog; Phase 3
  added no new tables, RLS policies, exposed functions, or storage buckets.

## Success criteria mapping
- ANCH-01: All five steps run on the generic engine. The engine only knows `handler` dispatch; P&L
  logic lives in registered handlers and workflow step data.
- ANCH-02: Focused fake E2E proves no-P&L launch -> Blocked upload prompt -> upload -> intake ->
  clarify -> analyze -> synthesize -> `artifact.html` -> Review. The run never auto-Done.
- ANCH-03: Artifact output is in-process HTML in workspace only. No GKE sandbox, no DOCX export,
  and no `ArtifactService` registration were added.
- Ep7 seam: `llm_agent` citations and `llm_single` `source_refs` land in `tasks.step_results`;
  render carries collected refs forward.

## Honest gaps / deferred live smokes
- No live Anthropic smoke was run; the focused test uses fake Claude tool output per L18.
- No live GKE/sandbox smoke was run; Phase 3 intentionally renders in-process HTML and defers
  sandbox export + ArtifactService registration to Phase 5.
- POC prompts are deliberately placeholder-grade and not real financial IP.

## Unblocks
Phase 4 can wire Domain Agents surfaces onto the real Phase 1-3 backend path: launch task, upload
files, stream/run steps, show workspace files, and display the Review-gated `artifact.html`.
