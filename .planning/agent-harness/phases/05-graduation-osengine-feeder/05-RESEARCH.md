# Phase 5 Research — Graduation + OS Engine Feeder Reuse Surfaces (verified 2026-07-05)

Verified in `python-backend/`. Phase 5 = register the Review artifact into the Library + wire the
deliberate Add-to-Second-Brain L17 trigger. **No new migration** (Phase 1 already added
`artifacts.source_kind='domain_agent_task'` to the CHECK + `promoted_to_kb` + lineage columns).
Trust this; re-verify before changing.

## ArtifactService (`services/artifact_service.py`)
- `deliver_from_sandbox(...)` stores a file in the `artifacts` bucket + inserts a row, but
  **hardcodes `source_kind="vcso_thread"`** and **extracts from the sandbox** (lines ~95/115).
- `get_delivery`, `delete_artifact`, `create_signed_url`, `_get_owned_row` exist (founder-scoped).
- **Gap:** Phase 3's deliverable is an **in-process `artifact.html` in `workspace_files`**
  (`owner_type='task'`), not a sandbox file. So Phase 5 needs a **workspace-sourced registration**
  method: store the workspace content in the `artifacts` bucket + insert a row with
  `source_kind='domain_agent_task'` and the Phase‑1 lineage (`task_id/workflow_id/agent_id/template_id`)
  + `provenance` (the `source_refs` from `tasks.step_results`). No GKE (locked fork 1).

## OS Engine feeder — the L17 trigger (with an adaptation)
- Endpoint `POST /api/doc-wiki/synthesize-agent-artifact` + `services/doc_wiki_agent_artifact_adapter.py`
  (`DocWikiAgentArtifactAdapter`) + `DocWikiSynthesisService`.
- **`synthesize_from_run(run_id, user_id)`** synthesizes a completed **`agent_delegation_run`** into
  an `agent_artifact` wiki page (`source_kind='agent_artifact'`, `forced_page_kind='agent_artifact'`),
  assembling the body from run/steps/`agent_context_sources`.
- **Wrinkle (flag, don't paper over):** its input is a **delegation run**, not a Domain Agent
  **Task/artifact**. A Task has many steps/runs; no single `run_id` represents the assessment.
  → Phase 5 adds a **`synthesize_from_task(task_id | artifact_id, user_id)`** entry point that reuses
  `DocWikiSynthesisService` + the `agent_artifact` page kind, but assembles the body from
  `tasks.step_results` + the registered artifact + `provenance`. **Reuse = synthesis service +
  adapter pattern + page kind; new task-sourced method** — not a literal `synthesize_from_run` call.

## Data already in place (Phase 1)
`artifacts`: `source_kind` CHECK allows `domain_agent_task`; columns `task_id/workflow_id/agent_id/
template_id/provenance(jsonb)/promoted_to_kb(bool)` present. Storage buckets `artifacts` (private) +
`workspace` (private) exist.

## Frontend (Phase 4)
Second Brain controls are **present but inert** in the Workspace + Library (`lib/domainAgentsApi.ts`
/ `lib/tasksApi.ts`). Phase 5 wires them to the trigger and shows the promoted state + provenance link.

## Locked forks (2026-07-05)
1. **Register the in-process `artifact.html` from `workspace_files` → `artifacts`** (no GKE); the
   sandbox DOCX export (L20 richer format) is a deferred enhancement.
2. **Graduate at Review** — auto-register the terminal artifact when the run reaches Review.
3. **Reuse the doc-wiki agent-artifact feeder** for the L17 trigger (via the new `synthesize_from_task`
   entry point); set `promoted_to_kb`; deliberate/opt-in, never auto.
