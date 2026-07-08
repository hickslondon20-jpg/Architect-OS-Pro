# Roadmap: Agent Harness — Domain Agents + VCSO Deep Mode (Episode 6) — ArchitectOS Pro

## Overview

Builds the platform's **production layer** (Domain Agents) and Virtual CSO's **Deep Mode** on one
shared substrate. Starts with the object model + lineage and the owner-flexible substrate, then
the generic hard-harness state machine, proves it with the Monthly P&L Assessment anchor
(generic POC), wires the five Domain Agents surfaces, closes the persistence arc (workspace →
artifact → opt-in OS Engine promotion trigger), adds VCSO Deep Mode (the soft harness, VCSO
only), reconciles cross-surface `@Agent` invocation, and verifies the seams. Everything reuses
the Ep1–Ep5 substrate; net-new is the workflow/task engine, its data model, and the surfaces.

## Process Rules

- **One phase at a time.** Each phase completes fully before the next begins.
- **Alignment checkpoint between phases.** Walk each phase's plan, align on what's done, then
  author that phase's `NN-CONTEXT.md` + `EXECUTION-AGENT-PROMPT.md` (+ `NN-RESEARCH.md` when there
  is live verification/extraction) **just-in-time** — not all upfront.
- **Verify before building.** Each phase's first move is a live-codebase / live-schema check.
- **Reuse before creating.** Check the existing substrate (orchestrator, tool registry, artifacts,
  sandbox, usage events, wiki feeders) before any new table/service.
- **Plan surface + backend together.** Functional wiring only; visual/UX polish is the post-Ep7
  audit (§8).
- **Execution agents are separate threads**, each pointed at its phase's plan + prompt files, per
  the GSD framework.
- **Flag conflicts, don't resolve silently.** New conflicts with L1–L21 or the Domain Agents docs
  go to the `CONTEXT.md` conflict register.

---

## Phases

- [x] **Phase 1: Object Model & Lineage** — `domain_agents`, `workflows`, `workflow_steps`,
  `templates`, `tasks`, `workspace_files` (owner-flexible), `freeform_requests`; Agent→Workflow→
  Task→Artifact lineage + provenance columns.
- [x] **Phase 2: Generic Harness Engine** — backend state machine, 5 step modes, workspace context
  passing, per-step tool scope (D1), prereq check, Kanban state transitions, curated trace,
  metering.
- [x] **Phase 3: Anchor Workflow — Monthly P&L Assessment (generic POC)** — prove the engine +
  full happy path end to end.
- [ ] **Phase 4: Domain Agents Surfaces** — Gallery, Profile, Workspace (two-pane), Tasks/Kanban,
  Artifacts Library, free-form ask (functional wiring).
- [x] **Phase 5: Graduation + OS Engine Feeder** — workspace→artifact registration; opt-in
  Add-to-Second-Brain promotion **trigger** (L17).
- [x] **Phase 6: VCSO Deep Mode** — soft harness (toggle, todos, workspace tools, `task`,
  `ask_user`), **Virtual CSO only** (L14), reusing the owner-flexible substrate (L21).
- [x] **Phase 7: VCSO → Domain Agent Invocation** — `@Agent` hand-off spawning a Task in shared
  plumbing; cross-surface reconciliation.
- [x] **Phase 8: Verification & Seams** — end-to-end + locked-decision + Ep7-seam audit complete; Ep6 code-complete at local/fake gate.

**Dependency spine:** P1 → P2 → P3 → {P4 → P5} ; P6 depends on P1 (substrate) and may run parallel
to P4/P5 ; P7 depends on P1–P4 + P6 ; P8 last.

---

## Phase Details

### Phase 1: Object Model & Lineage
**Goal:** Stand up the Domain Agents object model and the owner-flexible substrate so later phases
wire, not re-migrate.
**Depends on:** Nothing net-new (extends `artifacts`; references Ep4 skills, `agent_capabilities`).
**Requirements:** OBJ-01 … OBJ-06
**Success Criteria:**
  1. Migration applies with founder-scoped RLS on every new table; 5 `domain_agents` seeded.
  2. Lineage resolves Agent→Workflow→Task→Artifact; `artifacts` extended (not replaced) with
     lineage + `provenance`.
  3. `workspace_files` accepts `owner_type` task **and** thread (L21).
  4. `workflow_steps` carry step_type + skill_id + tools subset + capability_key + workspace io.
  5. TypeScript types regenerated.
**Guardrail:** name the discipline table `domain_agents`; never overload `agent_capabilities`.

### Phase 2: Generic Harness Engine
**Goal:** A domain-agnostic state machine that advances a Task through typed steps; the system
advances steps, not the LLM.
**Depends on:** Phase 1.
**Requirements:** HARN-01 … HARN-07
**Success Criteria:**
  1. A trivial 2-step test workflow runs end to end, advancing state, writing workspace files,
     emitting SSE, honoring the review gate.
  2. Each of the 5 step modes works; `llm_human_input` blocks + resumes; `llm_batch_agents` runs
     concurrently and resumes from partial output.
  3. Per-step tool scope built from registry subset + `capability_key` (D1); never a flat list.
  4. Orchestrator main-window overhead stays small (paths, not content).
  5. Usage events tagged `surface='domain_agents'` + role; trace curated only.
**Guardrail:** build generic (no P&L-specific code); Claude orchestration (no OpenAI
`response_format`); no Running→Done skip.

### Phase 3: Anchor Workflow — Monthly P&L Assessment (generic POC)
**Goal:** Prove the engine and full wiring end to end with the vision's happy-path example.
**Depends on:** Phase 2.
**Requirements:** ANCH-01 … ANCH-03
**Success Criteria:**
  1. All steps run on the generic engine with zero P&L-specific engine code.
  2. No-P&L launch → Blocked upload prompt → upload resolves → run proceeds → artifact renders
     live → ends at Review.
  3. Downloadable artifact produced through the sandbox path (L20), registered with provenance.
**Guardrail:** generic POC content only (L19); do not port Contract Review (L15).

### Phase 4: Domain Agents Surfaces
**Goal:** The anchor workflow is fully operable from the UI with real data.
**Depends on:** Phases 1–3.
**Requirements:** SURF-01 … SURF-04
**Success Criteria:**
  1. Gallery → Profile → Workspace → Kanban → Library operate on real backend data.
  2. Kanban matches the HARN state machine; "waiting on you" on Blocked; all entry points resolve
     to one task.
  3. A net-new free-form ask produces a scoped, Review-gated, labeled artifact + a
     `freeform_requests` row (L16).
  4. Skills/Templates invisible; AI Usage links out to global Settings.
**Guardrail:** functional wiring only — no visual/UX polish (post-Ep7 §8).

### Phase 5: Graduation + OS Engine Feeder
**Goal:** Close the persistence arc: workspace → Library → opt-in second-brain promotion trigger.
**Depends on:** Phases 1–4.
**Requirements:** GRAD-01 … GRAD-03
**Success Criteria:**
  1. Reaching Review registers an `artifact` with complete lineage + provenance.
  2. Add-to-Second-Brain emits a well-formed OS Engine ingestion trigger (assert payload; downstream
     may be stubbed); nothing auto-promotes.
  3. Workspace + Library completion actions present (download, delete, promote, provenance link).
**Guardrail:** Ep6 builds only the trigger (L17); OS Engine owns the wiki generation.

### Phase 6: VCSO Deep Mode
**Goal:** Give a Virtual CSO thread an open-ended, LLM-driven autonomous mode, reusing the
substrate.
**Depends on:** Phase 1 (substrate); may run parallel to P4/P5.
**Requirements:** DEEP-01 … DEEP-04
**Success Criteria:**
  1. Toggle ON grants planning/workspace/sub-agent/ask-user; OFF is byte-for-byte current behavior.
  2. Todos (`agent_todos`, editable panel) + workspace (`workspace_files`, `owner_type='thread'`)
     work; both persist and survive reload.
  3. Deep Mode is Virtual CSO only (no surface leaks into Domain Agents); Claude orchestration;
     usage tagged `surface='virtual_cso'`.
**Guardrail:** editable plan panel is Deep-Mode-only (C4); reuse the L21 substrate — do not fork a
thread-scoped copy.

### Phase 7: VCSO → Domain Agent Invocation
**Goal:** `@Agent` spawns a Task in the same plumbing, in the same Kanban + Library, without a
workspace takeover of the CSO thread.
**Depends on:** Phases 1–4 + Phase 6.
**Requirements:** INVK-01, INVK-02
**Success Criteria:**
  1. `@FinancialAgent …` spawns a task indistinguishable from a Profile-launched one except
     `origin='vcso'`.
  2. The VCSO thread shows a task handle + status/artifact link and does not morph into a workspace
     (L14 verified); all three entry points resolve to one task object.

### Phase 8: Verification & Seams
**Goal:** Prove internal consistency, locked-decision adherence, and Ep7 readiness.
**Depends on:** Phases 1–7.
**Requirements:** VERIF-01 … VERIF-03
**Success Criteria:**
  1. Anchor workflow runs end to end from all three entry points; state machine + resumability +
     review gate hold.
  2. L14 / L11 / L12 / L13 / L20 / L21 assertions pass.
  3. Ep7 seams verified (`source_refs` through lineage; L17 trigger payload well-formed); Ep5
     verification debt left flagged for §8 (non-gating, L18).
**Guardrail:** verification only — no new features. Consider a dedicated verification subagent.

---

## Progress Tracker

| Phase | Status | Completed |
|---|---|---|
| 1. Object Model & Lineage | Done (migration `019` applied live) | 2026-07-05 |
| 2. Generic Harness Engine | Done (engine + endpoints + migration `020` applied live) | 2026-07-05 |
| 3. Anchor Workflow — Monthly P&L (POC) | Done (generic handler mode + `021` live; fake E2E) | 2026-07-05 |
| 4. Domain Agents Surfaces | Done (functional wiring; live Anthropic/GKE smoke deferred per L18) | 2026-07-05 |
| 5. Graduation + OS Engine Feeder | Done (workspace artifact graduation + deliberate L17 trigger; live OS Engine smoke deferred per L18) | 2026-07-05 |
| 6. VCSO Deep Mode | Done (migration `022` live; Deep Mode toggle/tools/panels; live schema + local build verified) | 2026-07-06 |
| 7. VCSO → Domain Agent Invocation | Done (pre-loop `@Agent` task handoff + VCSO handle card; live Anthropic smoke deferred per L18) | 2026-07-06 |
| 8. Verification & Seams | Done (focused suite green; §8 live-smoke checklist is next-gate input) | 2026-07-06 |

---
*Roadmap created: 2026-07-03 (Ep6 planning pass). 8 phases; directional plans in
`phases/NN-slug/NN-01-PLAN.md`. Per-phase CONTEXT/RESEARCH/EXECUTION-AGENT-PROMPT authored
just-in-time. 25 v1 requirements traced (see REQUIREMENTS.md).*
