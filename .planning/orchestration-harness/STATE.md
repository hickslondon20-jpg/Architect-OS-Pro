# State: Orchestration Harness — VCSO Planner — ArchitectOS Pro

**Updated:** 2026-07-13

## Current Focus

Phase 0 is at the **founder checkpoint**. CLEAN-1, CLEAN-2, CLEAN-4, and CLEAN-5 are complete and live
verified. CLEAN-3's wiki-authority map and recommendation are documented, but the choice is not
encoded and Conflict O2 remains open until London confirms it. No later phase has started.

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

**Phase 0 — Reconciliation Cleanups** (founder checkpoint). The legacy Vercel chat route is
quarantined, CLAUDE.md and endpoint evidence now point to Python, and the conversation feeder is
scoped deferred. Awaiting London's authority/read-path decision before phase closeout.

## Open Design Forks Carried Into Build-Planning

- **O1 (Phase 0) — resolved.** Python is the live chat path; the Vercel route returns 410; CLAUDE.md
  is corrected; production smoke passed with `virtual_cso` active and `ws5-chat` at zero.
- **O2 (Phase 0) — founder decision pending.** Recommend `wiki_*` / `WikiReadService` as authority
  for overlapping fixed Layer-1, and OSE / `DocWikiReadService` for emergent Layer-2; do not encode
  until London confirms.
- **O3 (Phase 0) — scoped deferred.** The thread adapter/endpoints exist, but 18 live threads were
  pending and zero OSE pages had a thread origin. Upload-derived pages confirm only that feeder.
- **F-open — planner physical shape** — extend `VcsoChatService` in place vs. a distinct planner
  module the VCSO route delegates to. Decide in Phase 1/4 planning against the live loop structure.
- **F-open — freshness policy granularity** — per-data-class defaults vs. per-connector config.
  Decide in Phase 5 planning.
- **F-open — annotation grain scope (CTX-5)** — how far the durable annotation layer goes in v1
  (thread-local notes only vs. cross-thread per-resource store) and its re-injection default. Decide
  in Phase 1 planning.
- **F-open — founder-context page ownership** — the new founder-operating pages (communication-style,
  decision-log, …) are OS Engine-authored; this build consumes them. Coordinate the expansion as a
  cross-workstream dependency, starting with the two highest-value pages.

## Progress Tracker

| Phase | Status |
|---|---|
| Seeding (5 workstream files) | **Done** (2026-07-13) |
| 0. Reconciliation Cleanups | Founder checkpoint — CLEAN-3 decision pending |
| 1. Working-State Memory + Bounded Assembly | Not started |
| 2. Intent & Depth Read + Adaptive Triage | Not started |
| 3. Tier-Escalating Source Router | Not started |
| 4. Planner (thin slice) — checkpoint | Not started |
| 5. Reflect-and-Steer + Freshness + First MCP | Not started |
| 6. Generalize + Strategic Workers | Not started |
| 7. Verification & Seams | Not started |

## Session Continuity Note

Phase 0 evidence is in `phases/00-reconciliation-cleanups/00-COMPLETION.md`. Runtime cleanup shipped
as v0.6.11 and documentation correction as v0.6.12. Resume only to record London's CLEAN-3 decision,
update O2, and close Phase 0; do not begin Phase 1 in the same pass.
