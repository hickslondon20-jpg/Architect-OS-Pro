# Phase 3 Research — Engine Seams the P&L Workflow Binds To (verified 2026-07-05)

Verified in `python-backend/services/harness_engine.py` + live Supabase. Phase 3 fills the seeded
P&L workflow's step content and adds ONE generic engine amendment (handler mode). **Trust this, but
re-verify before changing.**

## How each step type binds (from harness_engine.py)
- **`_execute_step`** (line 246) dispatches by `step_type`: programmatic / llm_single / llm_agent /
  llm_batch_agents / llm_human_input.
- **`programmatic`** (`_execute_programmatic`, 261) is **generic-data-only today**: `output_schema.mode`
  ∈ `copy_workspace` | `join_workspace` | else static `content`. **No hook to run real code.**
  → Phase 3's ONE amendment: add a generic **`handler` mode** (`output_schema.mode='handler'`,
  `output_schema.handler='<key>'`) dispatching to a **registered callable** by key, allowed to
  return a `StepResult` **or** a `BlockedResult` (so intake can request an upload). Keep it generic —
  handlers register into the engine; no P&L code inside the engine.
- **`llm_single`** (286) already builds a `record_step_output` Claude tool schema from
  `step.output_schema` and uses `step.system_prompt_template`. → Phase 3 just fills those two fields.
- **`llm_agent`** (328) **requires `capability_key`** (raises `HarnessEngineError` if missing);
  optional `skill_id` is passed to usage logging (lineage). Runs `SubAgentOrchestrator`.
- **`llm_human_input`** (413) returns a `BlockedResult` → Blocked/"waiting on you".
- **`_step_prompt`** (498) assembles the per-step prompt.

## Live capabilities (agent_capabilities) — reuse for the Analyze step (no new capability)
`document_analysis_agent`, `structured_data_agent`, `strategy_synthesis_agent`,
`retrieval_evidence_agent`, `kb_explorer_agent`, `metadata_review_agent`, `sandbox_execution_agent`,
`sprint_planning_helper`, `global_ip`, `per_user_wiki`, `per_user_document_wiki`.
→ Analyze step lean: **`document_analysis_agent`** (or `structured_data_agent` if it needs SQL over
parsed tables).

## Live skills (skill_packs) — optional lineage bind
`Diagnose the Numbers` (financial analysis — natural `skill_id` for the Analyze step lineage),
`Place on the AE Ladder`, `Find the Binding Constraint`, `Design the Next Horizon`,
`Founder Role Transition`, `Sequence the Priority`.

## P&L parsing / render building blocks (in-process, no GKE)
- `doc_processor.py` (Docling) + `structured_data.py` / `structured_query.py` — parse an uploaded
  P&L (DOCX/PDF/CSV) into markdown/tables in-process. Use in `pnl_intake`.
- Markdown→HTML render is pure in-process (no sandbox) for `pnl_render` → `artifact.html`. The Ep4
  **sandbox DOCX export + ArtifactService registration is Phase 5** (locked fork 2).

## Seeded rows Phase 3 fills (from migration 019)
`workflows.produce_monthly_pnl_assessment` (agent=financial, template=monthly_pnl_assessment_v1,
prereqs.required=["One or more monthly P&L documents"]) + 5 ordered `workflow_steps` placeholders
(programmatic → llm_human_input → llm_agent → llm_single → programmatic). Phase 3 updates their
content via migration **`021_pnl_workflow_steps_content.sql`** (latest applied = 020).

## Prereq / Blocked mechanism
The workflow's `prereqs` are seeded; the intake handler (`pnl_intake`) checks OS Engine
(`agent_context` / structured data / KB) for recent P&Ls and, if absent AND no uploaded workspace
file, returns a `BlockedResult` (upload prompt). Requires the handler mode to allow `BlockedResult`.
