# Phase 5 Context — Graduation + OS Engine Promotion Feeder

**Phase:** 05 of the Agent Harness (Episode 6) build.
**Read first:** build-level `CONTEXT.md` + `ROADMAP.md`; this phase's `05-RESEARCH.md`; Phases 3 + 4
completions (the artifact.html + inert Second Brain button); canonical
`../../INTELLIGENCE-LAYER-ARCHITECTURE.md` §5 (one-writer/feeder) + `../../INTELLIGENCE-LAYER-EPISODE-MAP.md`
§5 (**L6, L17**, D4). Domain Agents docs win over the reference PRD.

---

## Why this phase, and what it is

Close the persistence arc: **task workspace → Artifacts Library (graduation) → OS Engine second
brain (opt-in promotion)**. The Review artifact becomes a first-class Library object with lineage,
and the Phase‑4 Second Brain button finally gets wired to the L17 OS Engine ingestion trigger. Ep6
builds **only the trigger/hand-off**; OS Engine synthesizes as sole writer (architecture §5).

Backend + a thin frontend wiring. **No new migration** (Phase 1 provided `domain_agent_task` +
lineage + `promoted_to_kb`).

## What this phase is NOT
- **Not the OS Engine wiki generation.** Ep6 emits the trigger; the wiki page + vector asset are OS
  Engine's build (L17).
- **Not the sandbox DOCX export.** Register the in-process `artifact.html` (no GKE); the richer L20
  export is a deferred enhancement (locked fork 1).
- **Not auto-ingest.** Promotion is deliberate/opt-in only (L6). Nothing auto-promotes.
- **Not a redesign.** Wire the existing (inert) Second Brain controls; don't restyle.

## Decisions that shape this phase (locked 2026-07-05)
1. **Register the workspace `artifact.html`** into `artifacts` via a new ArtifactService method (no
   GKE); DOCX export deferred.
2. **Graduate at Review** — auto-register the terminal artifact when the run reaches Review, so the
   Library shows it + Download works immediately (D4).
3. **L17 trigger reuses the doc-wiki agent-artifact feeder** via a **new `synthesize_from_task`**
   entry point (the existing `synthesize_from_run` keys off `agent_delegation_runs`, not Tasks — see
   `05-RESEARCH.md`). Sets `promoted_to_kb`; deliberate/opt-in.

## The design, concretely
- **Graduation (at Review):** add `ArtifactService.register_domain_artifact(task, workspace_path,
  ...)` — read the terminal `workspace_files` row (`owner_type='task'`, e.g. `artifact.html`), store
  it in the `artifacts` bucket, insert a row with `source_kind='domain_agent_task'` + lineage
  (`task_id/workflow_id/agent_id/template_id`) + `provenance` (from `tasks.step_results` source_refs).
  Called when the engine transitions the task to Review (a Review hook, or in the task flow right
  after `task_review`).
- **Promotion trigger (opt-in, L17):** `POST /api/tasks/{id}/promote` (or a domain-agents endpoint)
  → `DocWikiAgentArtifactAdapter.synthesize_from_task(task_id/artifact_id, user_id)` (new) → reuses
  `DocWikiSynthesisService` + the `agent_artifact` page kind; set `artifacts.promoted_to_kb=true`.
  OS Engine does the synthesis (sole writer). Never auto.
- **Frontend:** wire the Second Brain button (Workspace completion actions + Library row) to the
  promote endpoint; reflect promoted state; Library provenance link → task→workflow→agent (already
  present from Phase 4). Download stays live.

## Ep7 seam
The registered artifact carries `provenance`/`source_refs`; the promotion payload passes them to OS
Engine so the resulting wiki page inherits per-claim provenance (L8/L9).

## Success criteria (ROADMAP Phase 5 — GRAD-01…GRAD-03)
1. Reaching Review registers an `artifacts` row (`source_kind='domain_agent_task'`) with complete
   lineage + provenance; the Library lists it and Download works.
2. Add-to-Second-Brain emits a well-formed OS Engine ingestion trigger (`synthesize_from_task`),
   sets `promoted_to_kb`; downstream OS Engine synthesis may be stubbed/asserted; **nothing
   auto-promotes**.
3. Workspace + Library completion actions present (Download, Add to Second Brain, provenance link).

## Open items to resolve at build-planning (flag, don't silently pick)
- **`synthesize_from_task` body assembly** — from `tasks.step_results` + the artifact content +
  provenance; confirm the payload matches `DocWikiSynthesisService.synthesize(...)` shape and the
  `agent_artifact` page kind.
- **Graduation hook location** — engine Review transition vs. the tasks flow post-`task_review`; lean
  a small hook so the artifact is registered exactly once (idempotent on re-render/revision).
- **Promote endpoint home** — `tasks.py` (`POST /{id}/promote`) vs. `domain_agents.py`; lean `tasks.py`.
- **Revision idempotency** — Review→Running→Review should update, not duplicate, the artifact row.
- **DOCX export** — confirmed deferred (fork 1); leave a clean seam for the L20 sandbox export later.
