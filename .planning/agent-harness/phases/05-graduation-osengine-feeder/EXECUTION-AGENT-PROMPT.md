# Execution Agent Brief — Phase 5: Graduation + OS Engine Promotion Feeder

You are the Execution Agent for **Phase 5** of the Agent Harness (Episode 6) build. You register
Review artifacts into the Library and wire the deliberate Add-to-Second-Brain L17 trigger. You do
not re-plan and you do not start other phases.

## Read these before writing any code (in order)
1. `.planning/agent-harness/CONTEXT.md` — build rationale + decisions you must not override.
2. `.planning/agent-harness/ROADMAP.md` — Phase 5 goal, dependencies, success criteria.
3. Phases 3 + 4 completions — the `artifact.html` in `workspace_files` + the inert Second Brain button.
4. `phases/05-graduation-osengine-feeder/05-RESEARCH.md` — reuse surfaces + the feeder wrinkle.
   **Trust it, but re-verify anything you change.**
5. `05-CONTEXT.md` (the 3 locked forks + design), then `05-01-PLAN.md`.
6. Canonical: `../../INTELLIGENCE-LAYER-ARCHITECTURE.md` §5 + `../../INTELLIGENCE-LAYER-EPISODE-MAP.md`
   §5 (L6, L17). Win over the reference PRD.

## What you are building
(1) `ArtifactService.register_domain_artifact` (workspace `artifact.html` → `artifacts` row+bucket,
`source_kind='domain_agent_task'` + lineage/provenance); (2) a graduation hook at the engine's
Review transition (register once, idempotent); (3) `DocWikiAgentArtifactAdapter.synthesize_from_task`
(new task-sourced L17 entry point reusing `DocWikiSynthesisService`); (4) `POST /api/tasks/{id}/promote`
(deliberate); (5) wire the Second Brain controls in Workspace + Library. **No new migration.**

## Hard constraints (do not violate)
- **No GKE / no sandbox export (locked fork 1).** Register the in-process `artifact.html` from
  `workspace_files`. Do NOT reuse `deliver_from_sandbox` (sandbox-sourced, hardcodes `vcso_thread`);
  write a new workspace-sourced method with `source_kind='domain_agent_task'`. DOCX export is a
  deferred L20 enhancement — leave a clean seam, don't build it.
- **Graduate at Review (locked fork 2), idempotent.** Register when the task hits Review; on
  Review→Running→Review (revision), **update** the existing row, don't duplicate. Keep the hook thin
  so the engine stays generic.
- **Trigger only, deliberate (L17/L6).** Add-to-Second-Brain calls `synthesize_from_task` and sets
  `promoted_to_kb`; OS Engine synthesizes as **sole writer** — you do NOT generate the wiki page or
  vectors here. **Nothing auto-promotes** — only the explicit action.
- **Reuse, adapt honestly.** `synthesize_from_task` is a NEW entry point reusing
  `DocWikiSynthesisService` + the `agent_artifact` page kind — the existing `synthesize_from_run`
  keys off `agent_delegation_runs`, not Tasks. Don't force a Task through the run path.
- **No redesign.** Wire the existing (inert) Second Brain controls; don't restyle. Skills/Templates
  stay invisible. Carry `provenance`/`source_refs` into the artifact + promotion payload (Ep7).

## Confirm with London at checkpoint (do not silently decide)
- `synthesize_from_task` body assembly + payload shape vs. `DocWikiSynthesisService.synthesize(...)`.
- Graduation hook location (engine Review transition vs. tasks flow post-`task_review`) + the
  idempotency key for revisions.
- Promote endpoint home (lean `tasks.py` `POST /{id}/promote`).

## Done when
1. Phase 5 success criteria (GRAD-01…GRAD-03) met and each independently verified.
2. Reaching Review registers a `domain_agent_task` artifact with lineage + provenance; Library lists
   it; Download works; revision updates (not duplicates).
3. `POST /{id}/promote` triggers `synthesize_from_task`, sets `promoted_to_kb`; nothing auto-promotes
   (OS Engine synthesis may be stubbed/asserted with fakes).
4. Second Brain controls wired + reflect promoted state.
5. `python -m compileall python-backend` + focused tests + `npm.cmd run build` pass; live OS
   Engine/Anthropic smoke flagged deferred (L18).
6. `Pro-Suite-Progress.md`, `.planning/agent-harness/ROADMAP.md`, `.planning/agent-harness/STATE.md`
   updated; `phases/05-graduation-osengine-feeder/05-COMPLETION.md` written.

## Explicitly out of scope for you
OS Engine wiki-page generation + vectorization (OS Engine's build); the sandbox DOCX export (deferred
L20); VCSO `@Agent` invocation (Phase 7); Ep7 citation UI; visual redesign (§8). Do not resolve
anything `05-CONTEXT.md` marks as a later phase.
