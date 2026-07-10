# Phase 3 Context — Anchor Workflow: Monthly P&L Assessment (Generic POC)

**Phase:** 03 of the Agent Harness (Episode 6) build.
**Read first:** build-level `CONTEXT.md` + `ROADMAP.md`; this phase's `03-RESEARCH.md`; Phase 2's
`02-CONTEXT.md` + `02-COMPLETION.md` (the engine you bind to); canonical
`../../INTELLIGENCE-LAYER-EPISODE-MAP.md` §4 Ep6 + §5 (esp. **L15/L19**, L20, L4). Domain Agents docs
win over the reference PRD.

---

## Why this phase, and what it is

Prove the Phase-2 engine and the full wiring **end to end** with the vision's happy-path example: a
founder launches "Produce a Monthly P&L Assessment," the agent checks OS Engine, prompts for an
upload if needed, runs its steps narrating progress, and an assessment artifact takes shape and
reaches Review. It is a **generic proof-of-concept (L19)** — real analytical IP is refined later; do
**not** port the reference Contract Review harness (L15).

It is a **backend** phase: it fills the seeded P&L `workflow_steps` with real POC content, adds ONE
generic engine amendment (a programmatic **handler mode**), registers the P&L handlers, and proves
the run with tests (fakes for Claude/OS-Engine). No frontend (Phase 4), no sandbox export /
ArtifactService registration (Phase 5).

## What this phase is NOT

- **Not new engine architecture.** The only engine change is a **generic handler-dispatch mode** on
  programmatic steps (registered callables) — not P&L-specific engine code. All P&L logic lives in
  registered handlers + step data.
- **Not the surfaces.** No Gallery/Profile/Workspace/Kanban/Library UI — Phase 4.
- **Not artifact export/graduation.** In-process markdown→HTML into the workspace only; the Ep4
  sandbox DOCX export + `ArtifactService` registration + Library graduation are **Phase 5** (locked
  fork 2). No GKE dependency here (honors L18).
- **Not real financial IP.** POC-grade prompts (L19); content refined later.
- **Not a live Anthropic/GKE smoke.** Proven with fakes (scaffold-first; L18).

## Decisions that shape this phase (locked 2026-07-05)

1. **Generic handler mode (fork 1).** Extend `_execute_programmatic` with `output_schema.mode='handler'`
   + `output_schema.handler='<key>'` → dispatch to a registered callable, which may return a
   `StepResult` **or** a `BlockedResult`. Handlers register into the engine (generic); Phase 3
   registers `pnl_intake` + `pnl_render`.
2. **Artifact scope (fork 2).** `pnl_render` produces an in-process markdown→HTML `artifact.html`
   into the workspace and the run reaches **Review** (render-panel-ready). Sandbox DOCX export +
   `ArtifactService` registration + Library graduation are deferred to Phase 5.

**Inherited (do not override):** generic engine (L15/L19); Claude structured output, no OpenAI
`response_format` (L12/C1); review gate always on (no running→done); curated trace (L11); metering
tagged `surface='domain_agents'` + `task_id` (L13); Ep7 provenance via `source_refs`.

## The P&L step chain, concretely (fills the 019-seeded steps)

| # | Step (seeded) | Type | Binding | Reads → Writes |
|---|---|---|---|---|
| 1 | Prereq / Intake | `programmatic` | **handler `pnl_intake`** | OS Engine P&L probe; if absent + no upload → **BlockedResult** (upload prompt). On upload: Docling/`structured_data` parse → `pnl-source.md` (+ table JSON) |
| 2 | Clarify Context | `llm_human_input` | question (entity/period, one-offs to normalize, comparison basis) | → `review-context.md` |
| 3 | Analyze P&L | `llm_agent` | `capability_key='document_analysis_agent'`, `skill_id`='Diagnose the Numbers' (lineage) | `pnl-source.md` + `review-context.md` → `analysis.md` (+ `source_refs`) |
| 4 | Synthesize Assessment | `llm_single` | `system_prompt_template` + `output_schema` (headline, findings[], risks[], questions[]) | → `assessment.md` |
| 5 | Render Artifact | `programmatic` | **handler `pnl_render`** | `assessment.md` + template `render_spec` → `artifact.html`; reach **Review** |

Prompts/schemas are POC-grade and clearly marked, so the later IP pass swaps content without
touching the engine or wiring.

## Ep7 seam
`analysis.md` and `assessment.md` carry `source_refs` back to the P&L source, and `tasks.step_results`
holds them — so Ep7 renders citations in the artifact view later with no re-plumbing.

## Success criteria (from ROADMAP Phase 3 — ANCH-01…ANCH-03)
1. All 5 steps run on the generic engine with **zero P&L-specific engine code** (P&L logic only in
   registered handlers + step data).
2. No-P&L launch → Blocked upload prompt; upload resolves it → run proceeds → `artifact.html`
   produced in workspace → run ends at **Review** (never auto-Done).
3. Proven by tests with fakes (Claude tool output, OS-Engine probe, sample P&L text); the render
   step writes an in-process HTML artifact (no GKE).

## Open items to resolve at build-planning (flag, don't silently pick)
- **Analyze capability** — `document_analysis_agent` (lean) vs `structured_data_agent` if the step
  needs SQL over parsed tables.
- **Handler registry location** — lean a `services/harness_handlers.py` (or `workflows/pnl_assessment.py`)
  that registers into the engine at import; confirm the registration seam keeps the engine generic.
- **`pnl_intake` parse path** — Docling `doc_processor` for the uploaded file (lean) vs the
  `structured_data` dataset path; confirm which handles a founder-uploaded monthly P&L cleanly.
- **Migration `021`** updates the 5 seeded step rows' content by (workflow key, position) — confirm
  update-in-place vs re-seed.
- **OS Engine P&L probe** — how `pnl_intake` detects "recent P&Ls exist" (KB search / structured
  dataset / wiki) for the prereq/Blocked decision; lean a lightweight KB/structured probe.
