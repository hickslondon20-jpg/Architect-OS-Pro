# Execution Agent Brief — Phase 3: Anchor Workflow (Monthly P&L Assessment, Generic POC)

You are the Execution Agent for **Phase 3** of the Agent Harness (Episode 6) build. You wire the
Monthly P&L Assessment workflow onto the Phase-2 engine as a generic POC. You do not re-plan it and
you do not start other phases.

## Read these before writing any code (in order)
1. `.planning/agent-harness/CONTEXT.md` — build rationale + decisions you must not override.
2. `.planning/agent-harness/ROADMAP.md` — Phase 3 goal, dependencies, success criteria.
3. `phases/02-harness-engine/02-COMPLETION.md` — the engine you bind to (live; do not rework).
4. `phases/03-anchor-workflow-pnl/03-RESEARCH.md` — verified engine seams + live capabilities/skills.
   **Trust it, but re-verify anything you change.**
5. `phases/03-anchor-workflow-pnl/03-CONTEXT.md` (step chain + the two locked forks), then `03-01-PLAN.md`.
6. Canonical: `../../INTELLIGENCE-LAYER-EPISODE-MAP.md` §5 (L15/L19, L20, L12). Wins over the reference PRD.

## What you are building
(1) A **generic `handler` mode** on the engine's programmatic executor (registered callables that may
return `StepResult` or `BlockedResult`); (2) the `pnl_intake` + `pnl_render` handlers; (3) migration
`021_pnl_workflow_steps_content.sql` filling the 5 seeded P&L steps; (4) focused tests proving the
run end to end with fakes.

## Hard constraints (do not violate)
- **Generic POC (L19).** No P&L-specific code in the engine — P&L logic lives only in registered
  handlers + step data. Prompts are POC-grade, clearly marked; do NOT source real financial IP. Do
  NOT port the reference Contract Review harness (L15).
- **The handler mode is generic.** The engine looks up handlers by key from a registry; handlers
  register from a separate module at import. Preserve existing `copy_workspace`/`join_workspace`/
  static behavior byte-for-byte.
- **Artifact scope = in-process HTML only (locked fork 2).** `pnl_render` writes `artifact.html` to
  the workspace and the run reaches **Review**. Do NOT call the GKE sandbox, do NOT export DOCX, do
  NOT register via `ArtifactService` — that is Phase 5.
- **Claude structured output (L12/C1).** Step 4 uses the engine's existing `record_step_output`
  tool-schema path — no OpenAI `response_format`.
- **Review gate always on.** The run ends at **Review**, never auto-Done. Curated trace only (L11);
  usage tagged `surface='domain_agents'` + `task_id` (already handled by the engine).
- **Reuse, don't rebuild.** Phase-2 engine + `/api/tasks/*`; `SubAgentOrchestrator` via `llm_agent`;
  existing `document_analysis_agent` capability + `Diagnose the Numbers` skill (lineage);
  `doc_processor`(Docling)/`structured_data` for parsing. Don't fork these.
- **Ep7 seam.** `analysis.md`/`assessment.md` carry `source_refs` into `step_results`.

## Confirm with London at checkpoint (do not silently decide)
- Analyze capability: `document_analysis_agent` (lean) vs `structured_data_agent`.
- Handler registry location + registration seam (lean `services/harness_handlers.py`).
- `pnl_intake` parse path: Docling `doc_processor` (lean) vs `structured_data` dataset.
- `021` update-in-place vs re-seed; and the OS-Engine P&L-presence probe shape.

## Done when
1. Phase 3 success criteria (ANCH-01…ANCH-03) met and each independently verified.
2. Generic handler mode added (existing programmatic behavior unchanged); `pnl_intake`/`pnl_render`
   registered; `021` applied live and step content verified.
3. End-to-end test passes: no-P&L → Blocked upload → upload → steps run (fake Claude) →
   `artifact.html` in workspace → **Review**; handler-mode + provenance covered.
4. `python -m pytest` focused + `python -m compileall python-backend` pass; live Anthropic/GKE smoke
   flagged deferred (L18).
5. `Pro-Suite-Progress.md`, `.planning/agent-harness/ROADMAP.md`, `.planning/agent-harness/STATE.md`
   updated; `phases/03-anchor-workflow-pnl/03-COMPLETION.md` written.

## Explicitly out of scope for you
Surfaces/UI (Phase 4); sandbox export + `ArtifactService` registration + Library graduation + OS
Engine promotion (Phase 5); real financial IP; live smokes. Do not resolve anything `03-CONTEXT.md`
marks as a later phase.
