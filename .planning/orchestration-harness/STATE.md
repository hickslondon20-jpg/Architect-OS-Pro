# State: Orchestration Harness — VCSO Planner — ArchitectOS Pro

**Updated:** 2026-07-13

## Current Focus

**Phase 2 CODE COMPLETE; LIVE-DARK** (2026-07-13). INT-1..3 are implemented in commit `d2962d15`
and deployed behind `vcso_intent_read`, which remains disabled with zero enrollment. The migration is
live, focused tests and compile pass, and the post-deploy flag-off VCSO smoke returned and persisted
`READY.` with `intent = null` and `surface=virtual_cso`. Phase 2's mixed-intent cost/quality proof and
default flip remain founder-gated. Phase 1 Stage 1 remains active only for founder
`cd490873-99aa-4533-9240-f0aa04deb54f`; its Stage 2 observation/flip gate is unchanged.

## Documents

**This workstream (`.planning/orchestration-harness/`):**
- `CONTEXT.md` — seeding narrative: why-exists, target shape, reuse map, principles, locked decisions,
  conflict register, deferred.
- `REFERENCES.md` — reference pattern → phase → extract/adapt/skip; inherited assets.
- `REQUIREMENTS.md` — v1 requirements (CLEAN/CTX/INT/ROUT/PLAN/STEER/GEN/VERIF) + deferred + OOS.
- `ROADMAP.md` — 8 phases (0–7) + per-phase detail + progress tracker.
- `STATE.md` — this file.
- `phases/` — per-phase plans and completion/checkpoint evidence.

**Canonical sources at `.planning/` root (referenced via `../`):**
- `../COGNITIVE-ORCHESTRATION-ARCHITECTURE.md` — North Star (vision).
- `../INTELLIGENCE-LAYER-ARCHITECTURE.md` — parent architecture (tiers, surfaces, one-writer).
- `../RECONCILIATION-COGNITIVE-ORCHESTRATION.md` — live wired/partial/missing map.
- `../OPENCLAW-ANALYSIS-ORCHESTRATION-REPURPOSE.md` — patterns to repurpose.

**External reference repos (mine patterns; reference back as phases need specifics):**
- `github.com/andrewyng/context-hub` — annotations (durable, untrusted re-injection), feedback→author
  loop, incremental fetch → sharpens CTX + ROUT.
- `github.com/nlwhittemore/personal-context-portfolio` — modular founder-operating context taxonomy
  (communication-style, decision-log, goals, role, constraints, …) → sharpens ROUT-5; page authoring
  is an OS Engine dependency.
- Prior scopes: `../managing-agents/MA-05-CSO-TRANSPARENCY-SCOPE.md`,
  `../managing-agents/MA-06-TOOL-REGISTRY-ROUTING-SCOPE.md`; sibling: `../agent-harness/`.

## Current Phase

**Phase 0 — Done (2026-07-13).** Legacy Vercel chat route quarantined (410), CLAUDE.md + endpoint
point to Python, conversation feeder scoped deferred, wiki authority resolved (layer-split + projection
caveat). **Phase 1's Stage 1 founder canary remains active and Stage 2 remains observation-gated.**
**Phase 2 code is deployed live-dark; its canary proof is pending and no flag was flipped.**

## Open Design Forks Carried Into Build-Planning

- **O1 (Phase 0) — resolved.** Python is the live chat path; the Vercel route returns 410; CLAUDE.md
  is corrected; production smoke passed with `virtual_cso` active and `ws5-chat` at zero.
- **O2 (Phase 0) — resolved (founder-approved 2026-07-13, projection caveat).** `wiki_*` /
  `WikiReadService` authoritative for the fixed Layer-1 seven; OSE / `DocWikiReadService` for emergent
  Layer-2; OSE Layer-1 rows = materialized projections. **Caveat:** the wiki_*→OSE-Layer-1 projection
  is unverified → OS-Engine dependency; **Phase 3 composes the seven fixed pages from `wiki_*` directly**
  (two-source read), not depending on the projection.
- **O3 (Phase 0) — scoped deferred.** The thread adapter/endpoints exist, but 18 live threads were
  pending and zero OSE pages had a thread origin. Upload-derived pages confirm only that feeder.
- **F-open — planner physical shape** — extend `VcsoChatService` in place vs. a distinct planner
  module the VCSO route delegates to. Decide in Phase 1/4 planning against the live loop structure.
- **F-open — freshness policy granularity** — per-data-class defaults vs. per-connector config.
  Decide in Phase 5 planning.
- **annotation grain scope (CTX-5) — resolved (founder-confirmed 2026-07-13):** cross-thread,
  per-resource store over wiki components + tools + skills; re-injection off by default, untrusted.
- **F-open — founder-context page ownership** — the new founder-operating pages (communication-style,
  decision-log, …) are OS Engine-authored; this build consumes them. Coordinate the expansion as a
  cross-workstream dependency, starting with the two highest-value pages.

## Progress Tracker

| Phase | Status |
|---|---|
| Seeding (5 workstream files) | **Done** (2026-07-13) |
| 0. Reconciliation Cleanups | **Done** (2026-07-13; O1 resolved, O2 resolved w/ caveat, O3 deferred) |
| 1. Working-State Memory + Bounded Assembly | **Done; Stage 1 canary active** (2026-07-13) — Stage 2 awaits observation |
| 2. Intent & Depth Read + Adaptive Triage | **Code complete; live-dark; canary proof pending** (v0.6.16, 2026-07-13) |
| 3. Tier-Escalating Source Router | Not started |
| 4. Planner (thin slice) — checkpoint | Not started |
| 5. Reflect-and-Steer + Freshness + First MCP | Not started |
| 6. Generalize + Strategic Workers | Not started |
| 7. Verification & Seams | Not started |

## Session Continuity Note

Phase 0 is closed. Evidence in `phases/00-reconciliation-cleanups/00-COMPLETION.md`; runtime + docs
cleanups shipped as v0.6.11–v0.6.14. CLEAN-3 was founder-approved (layer-split authority + projection
caveat) and O2 is recorded resolved in `CONTEXT.md`, `ROADMAP.md`, and here. Two OS-Engine dependencies
carry forward for Phase 3: (1) the conversation→wiki feeder (deferred), (2) the wiki_*→OSE-Layer-1
projection (unverified; Phase 3 bypasses it by composing the seven fixed pages from `wiki_*` directly).
**Founder decision (2026-07-13):** defer the Stage 1 canary observation + Stage 2 flip to conserve
usage/context; proceed with **Phase 2 planning** in parallel (the flip is a production-rollout gate,
not a design gate for Phase 2). The canary stays enrolled (passive, fail-open) and accumulates data.

**CARRY-FORWARD — must close before the workstream closes:** (1) Phase 1 Stage 1 observation, (2)
Stage 2 `enabled_for_all` flip, (3) mark Phase 1 *fully* Done. Runbook: `phases/01-working-state-memory/
01-STAGED-FLIP-RUNBOOK.md`. Also: when Phase 2 later *executes*, its production flip should land **after**
Phase 1's flip (don't stack two unproven assembly changes live).

**Phase 2 DEPLOYED DARK** (2026-07-13): `d2962d15` adds the locked five-move classifier, depth,
confidence, deterministic response contract, conservative lean/full triage, per-turn intent JSONB,
bounded timeout/circuit breaker, worker-tier usage accounting, and sanitized MA-05 step. The migration
is applied live. Production health and a real flag-off VCSO turn passed; both feature flags retained
their prior state. **Next action:** leave Phase 2 unenrolled until a separate founder-approved canary,
then run the paired mixed-intent cost/quality proof. Do not advance Phase 1 or Phase 2 merely because
the dark code is deployed. No Phase 3 work has started.
