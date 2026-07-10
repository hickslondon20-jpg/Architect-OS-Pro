# Skills & Sandbox Build — Phase 6 (Artifacts & Delivery Experience) Execution Agent Prompt

> Copy everything below this line into a new Claude Code / Cowork session opened at
> `C:\Users\Hicks\ArchitectOS Pro_beta`.

---

You are the **execution agent** for Phase 6 (Artifacts & Delivery Experience) of the ArchitectOS Agent
Skills & Document Generation Engine build. Two plans, in order: **06-01 (backend)** →
**06-02 (frontend)**. You make implementation choices, never design choices. If something needs a design
decision beyond the inputs below, **stop and flag it** — the same discipline every prior phase in this
build has followed.

This phase is lower operational risk than Phase 5 (no new billed cloud infrastructure, no new GCP
credentials) but has one real technical unknown carried over from Phase 5's own findings — see "The one
thing to test first" below.

## Orient first (read these, in order)

1. `.planning/skills-sandbox/phases/06-artifacts-delivery-experience/06-RESEARCH.md` — live-codebase
   verification: no `artifacts` table exists, the exact Reader panel component and its current wiring,
   no file-extraction path exists yet from Phase 5's sandbox service, the `agent_context_sources`
   polymorphic pattern to reuse for the schema.
2. `.planning/skills-sandbox/phases/06-artifacts-delivery-experience/CONTEXT.md` — every decision this
   phase implements, including the confirmed 1-hour signed-URL expiry.
3. `06-01-PLAN.md`, `06-02-PLAN.md` (same folder) — the two build specs, in order.
4. `.planning/skills-sandbox/CONTEXT.md` §8, §9 — the project-wide delivery-split and shared-artifacts
   decisions this phase implements.
5. `.planning/skills-sandbox/phases/05-sandbox-infrastructure/CONTEXT.md` §2c — **read the corrected
   version, including the post-execution amendments** (session state does not survive a Railway backend
   restart; the default Kubernetes file-copy path was unreliable and needed an in-pod-exec workaround).
   Both findings are directly load-bearing for this phase.
6. `python-backend/services/sandbox_service.py` — the actual, live `SandboxService` class this phase
   builds on top of. Read `KubernetesInteractiveSandboxSession._upload_runner_script` specifically — it's
   the exact workaround pattern to mirror if `copy_from_runtime()` turns out to be unreliable too.
7. `components/pro-suite/shared/Reader.tsx` and `pages/ProSuite/virtual-cso/VirtualCSOWorkspace.tsx`
   (around lines 453–467) — read these directly before writing any frontend code; `06-RESEARCH.md`
   describes them accurately as of 2026-07-01, but confirm the current state yourself, per standing
   process, rather than trusting the research file as still-current without a check.

## The one thing to test first

**Before writing any other code in 06-01, test `llm-sandbox`'s `copy_from_runtime()` directly against
the live cluster.** Phase 5 already found the library's default Kubernetes file-copy mechanism unreliable
against this specific cluster (that's why the interactive runner script upload needed a custom
in-pod-exec workaround instead of the library's built-in transfer). `copy_from_runtime()` likely rides
the same underlying mechanism and may have the same problem. Test it with a trivial file first — if it
fails or returns corrupted content, don't debug the library itself; go straight to the fallback (base64
encode via an in-pod exec command, decode on the host), exactly mirroring the pattern already proven
working in `sandbox_service.py`. This is Pre-Execution Check #2 in `06-01-PLAN.md` — do not skip past it
to build the rest of the service first.

## What you build

### 06-01 — Backend (do first)
`docs/migrations/011_artifacts.sql` (bucket + `artifacts` table using the `source_kind`/`source_id`
polymorphic pattern from `agent_context_sources`, not a hard FK to `vcso_chat_threads` alone — owner-only
RLS, no global-read variant). New `services/artifact_service.py` (`deliver_from_sandbox`, reusing the
*existing* live session from `SandboxService` for a given `thread_id` — do not open a second session).
`POST /api/artifacts/verify` proving the full round trip for both a renderable and non-renderable file,
against the real cluster.

### 06-02 — Frontend
Extend `VirtualCSOWorkspace.tsx`'s existing `readerPageId`/`readerPage` mechanism to also resolve
artifacts into the same `<Reader>` panel — no second panel component. New
`ArtifactDeliveryCard.tsx` for non-renderable output, styled per `AgentStepsPanel.tsx`'s conventions. A
temporary, clearly-marked dev-only trigger to exercise both paths against 06-01's verification route,
since real chat-turn-triggered delivery is Phase 7's job, not this phase's.

## Hard constraints

- **Reuse the existing live sandbox session for a given `thread_id` when extracting a file — never open a
  new session to do this.** The file only exists in the pod that produced it; a fresh session would be a
  fresh, empty pod.
- **`Reader.tsx` itself does not get modified in its own props or behavior.** Feed it new data from a new
  source; don't change what it already does for wiki pages.
- **No second panel component.** If you find yourself wanting to build a new "Artifact Reader" component
  instead of extending the existing one, stop — that's exactly the kind of duplication the project's
  standing "reuse before creating" principle rules out.
- **No global/shared artifact concept.** Every artifact belongs to exactly one founder — don't add a
  `skill-files`-style admin/global-read RLS variant; it doesn't apply here.
- **Don't build a browsable Artifacts Library UI.** It's a real, anticipated future surface (per the
  Domain Agents architecture) but explicitly not this phase's job — the schema should merely not preclude
  it later.
- **The `source_kind` CHECK constraint should list only `'vcso_thread'` for now** — don't
  pre-guess Domain Agents' eventual value name; that gets added additively when Domain Agents' live wiring
  actually lands.
- **The Part C dev-trigger scaffolding (06-02) must be clearly marked temporary and not reachable in any
  founder-facing path.** It exists to prove this phase's own work, not as a shipped feature.
- **Never consider a claim confirmed until independently re-verified against the live system** — same
  standing discipline as every prior phase, and worth repeating given what happened mid-Phase-5: a report
  saying "compile/import passes" was independently checked and found false (a truncated `main.py`) before
  anything shipped. Run your own `py_compile` (or equivalent) pass, and actually click through both
  delivery paths in a running app, before reporting success.

## Done when

All success criteria across both plan files are met, independently re-verified by you (not just the
first command's exit status). Specifically: `copy_from_runtime()` (or its fallback) proven working against
a real file in a real pod; a renderable artifact opens correctly in the existing `Reader` panel with no
new panel built; a non-renderable artifact's signed download link actually downloads the correct file;
the `artifacts` schema has nothing hard-coded that would block a future Domain-Agents `source_kind` value.

Report back: a one-paragraph summary; confirmation of each plan's success criteria; whether
`copy_from_runtime()` worked as-is or needed the exec-based fallback (this is genuinely useful information
for whoever eventually touches this layer again); the exact frontend approach taken for distinguishing
artifact vs. wiki-page IDs in the `readerPageId` mechanism (§ Part A of `06-02-PLAN.md` left this as an
implementation choice); and confirmation that `python-backend/requirements.txt` and `main.py` both pass a
fresh `py_compile` check before you call anything done — given what happened mid-Phase-5, don't skip this.
Then stop — Phase 7 (Sandbox Tool Integration) is opened from the orchestration thread, not by you.
