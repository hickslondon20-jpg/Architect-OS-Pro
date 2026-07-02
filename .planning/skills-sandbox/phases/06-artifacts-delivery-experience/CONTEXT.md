# Phase 6 Context — Artifacts & Delivery Experience

**Written:** 2026-07-01, by the Orchestration Agent, after `06-RESEARCH.md`'s live-verification pass.

---

## 1. Domain

Generated sandbox files land in a shared, durable Storage location and reach the founder through the
delivery path that matches the file's renderability — markdown/HTML inline in the existing Reader panel,
everything else as a chat card with a signed download link. Traces ARTIFACT-01, ARTIFACT-02, ARTIFACT-03,
ARTIFACT-04.

## 2. Decisions

**Locked (carried from project `CONTEXT.md` §8–9 — not reopened):**
- Markdown/HTML output reuses the *existing* Reader panel component — no new panel gets built.
- Non-renderable output (pptx, xlsx, csv, etc.) gets an inline "your file is ready" chat card with a
  signed download link.
- The `artifacts` table/bucket is the same infrastructure the separately-designed Domain Agents
  architecture already anticipated — one shared schema, not a parallel system built now and reconciled
  later.

**Resolved by this research pass:**
- **The Reader panel is `components/pro-suite/shared/Reader.tsx`** — confirmed by reading it directly, not
  assumed. Takes `open`/`title`/`meta`/`content`/`footer`/`onClose`. `VirtualCSOWorkspace.tsx` already
  drives it via a `readerPageId`/`readerPage` state pair (currently wiki-page citations only, opened from
  `SourcesPanel`). **Decision:** extend this same state mechanism to also accept an artifact — e.g. a
  `readerPageId` value prefixed or typed to distinguish "wiki page" vs. "artifact" sources, resolving to
  different fetch calls but the same `<Reader>` render. Do not add a second, parallel panel-open
  mechanism.
- **`artifacts` table uses the `agent_context_sources` polymorphic-source pattern** (`source_kind text` +
  `source_id uuid`, soft reference, no hard FK), not a hard FK to `vcso_chat_threads.id` alone — this is
  what actually satisfies ARTIFACT-04 ("no Virtual-CSO-only assumptions"), confirmed against real
  precedent already in this schema rather than invented fresh. `source_kind` starts with one valid value
  (`'vcso_thread'`) via a `CHECK` constraint; Domain Agents adds `'domain_agent_task'` (or similar) as an
  additive migration when its live wiring lands — not this phase's job to pre-guess the exact future
  value.
- **File extraction from the sandbox pod uses `llm-sandbox`'s `copy_from_runtime()` first, with the
  Phase-5-proven in-pod-exec fallback ready if it's unreliable against this cluster** — per `06-RESEARCH.md`,
  this is a real, not hypothetical, risk given Phase 5's own file-copy findings. The execution agent must
  test this directly and early, not assume it from the library's docs alone.
- **Storage bucket + RLS follows the plain `raw-documents`/`kb-files` owner-only pattern**, not the
  `skill-files` global-read variant — no artifact is ever shared across founders, so there's no "global,
  open-read" policy to add.
- **Migration numbering continues the sequential convention**: `011_artifacts.sql` (Phase 5 used
  `010_sandbox_sessions.sql` most recently).
- **Signed URL expiry: 1 hour**, for the non-renderable download-card path (ARTIFACT-03). A function
  parameter, not a schema decision — trivially adjustable later, not worth a schema migration to change.

## 3. Canonical Refs

- `.planning/skills-sandbox/CONTEXT.md` §8, §9 — the delivery-split and shared-artifacts-table decisions
  this phase implements.
- `.planning/skills-sandbox/REQUIREMENTS.md` — ARTIFACT-01, ARTIFACT-02, ARTIFACT-03, ARTIFACT-04.
- `.planning/skills-sandbox/ROADMAP.md` — Phase 6 section, all 4 success criteria.
- `06-RESEARCH.md` (this folder) — every live-verification finding above.
- `.planning/skills-sandbox/phases/05-sandbox-infrastructure/CONTEXT.md` §2c (the corrected version, after
  execution) — the file-copy-reliability and backend-restart-state-loss findings this phase inherits.
- Domain Agents architecture (memory: `domain-agents-architecture.md`) — "Artifact — final produced file;
  logged in artifacts table with URL + Supabase storage location; client-facing, browsable, gated to the
  user's own files... Markdown auto-renders to an HTML version: right-hand side panel in the workspace
  when clicked; preview mode in the artifacts section before download." Confirms this phase's schema
  should accommodate a future browsable library (ARTIFACT-04) without building that UI now.

## 4. Code Context

- `python-backend/services/sandbox_service.py` (Phase 5) — `SandboxService.execute_code()` returns
  `SandboxExecutionResult` (stdout/stderr/exit_code only, no files). This phase adds a sibling method
  (e.g. `deliver_artifact(thread_id, container_path, ...)`) that calls `copy_from_runtime()` against the
  *same* session object already tracked in `self._sessions[thread_id]` — reuse the existing session
  lookup, don't build a second one.
- `python-backend/main.py` line 535 (`POST /api/sandbox/verify`) — the precedent for this phase's own
  verification route (e.g. `POST /api/artifacts/verify`), same `require_ingest_secret`-gated shape.
- `docs/migrations/20260701_skill_files_storage.sql` — the bucket+RLS+trigger precedent to mirror
  structurally (private bucket, metadata table, `updated_at` trigger, owner-folder RLS on
  `storage.objects`) — simplified per §2 above (no global-read variant).
- `docs/migrations/009_sub_agent_orchestration.sql` lines 81–93 (`agent_context_sources`) — the
  `source_kind`/`source_id` polymorphic pattern to mirror for `artifacts`.
- `components/pro-suite/shared/Reader.tsx` — the panel component; do not modify its props/behavior, only
  feed it artifact-sourced content from the parent.
- `pages/ProSuite/virtual-cso/VirtualCSOWorkspace.tsx` around lines 453–467 — where `readerPageId`/
  `readerPage` state and the `<Reader>`/`<SourcesPanel>` render currently live; this is where the
  artifact-opening path gets wired in.
- No existing "file is ready, download it" card exists, but a real styling/placement precedent does:
  `components/pro-suite/virtual-cso/AgentStepsPanel.tsx` — a small, collapsible card rendered inline
  inside a message bubble (`rounded-[var(--radius-xs)] border border-[var(--aos-mist)] bg-[var(--bg-sunken)]`,
  `aos-mono` labels). Use this component's styling conventions as the template for the new artifact
  delivery card rather than inventing new patterns — but it's a *different* component (tool-step
  disclosure, not file delivery), so build a new one modeled on its look, not a modification of it. Check
  `MessageBubble.tsx` (the other file this search matched) for exactly where inline cards like this get
  slotted into a message's render tree before wiring the new card in.

## 5. Specifics

This phase splits into two plans:

**06-01 — Backend: artifacts schema, storage, and delivery service.** `011_artifacts.sql` (bucket +
`artifacts` table with `source_kind`/`source_id` polymorphic reference, `storage_path`, `filename`,
`mime_type`, `size`, `description`, `renderable boolean`, timestamps, owner-folder RLS). New
`services/artifact_service.py` (mirroring `sandbox_service.py`'s shape): given a `thread_id` + a
container-side file path (or list of paths), extract via `copy_from_runtime()` (test first; fall back to
the Phase-5-proven in-pod-exec pattern if unreliable), upload to the `artifacts` bucket, insert the
metadata row, and return a delivery-shaped result — for markdown/HTML, the raw content string (for the
Reader panel); for everything else, a signed URL (1-hour expiry) plus filename/size (for the chat card).
A verification route proving this round-trip against a real sandbox session from Phase 5's
infrastructure.

**06-02 — Frontend: Reader panel wiring + chat card.** Extend `VirtualCSOWorkspace.tsx`'s existing
`readerPageId`/`readerPage` mechanism to also resolve an artifact ID into Reader-panel content (no new
panel component). Build a new, small inline "your file is ready" chat card component for non-renderable
artifacts, styled to ArchitectOS design tokens, showing filename/size and a working download link driven
by the signed URL from 06-01.

## 6. Deferred (explicitly not this phase's job)

- A browsable Artifacts Library UI surface (Domain-Agents-era, per `06-RESEARCH.md` — schema
  accommodates it, this phase doesn't build it).
- Deciding *when* a sandbox execution's output becomes an artifact — that's Phase 7's
  `execute_code` tool-wiring job. This phase's verification route calls the delivery mechanism directly
  against a test session, not through a real chat turn.
- `read_skill_file` tool wiring (Phase 7).
- Any second `source_kind` value beyond `'vcso_thread'` (Domain Agents adds its own later, additively).

---
*Context written: 2026-07-01 — Orchestration Agent, post-research, pre-checkpoint.*
