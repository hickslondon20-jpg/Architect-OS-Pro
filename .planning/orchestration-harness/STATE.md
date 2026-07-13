# State: Orchestration Harness — VCSO Planner — ArchitectOS Pro

**Updated:** 2026-07-13

## Current Focus

Workstream **seeded**. The five top-level files (CONTEXT, REFERENCES, REQUIREMENTS, ROADMAP, STATE)
are in place. Next: develop the **planning files** — the per-phase plans under `phases/`, starting
with Phase 0 (Reconciliation Cleanups). No code has been written for this workstream yet; the
substrate it builds on is live (MA-05, MA-06, Ep6).

## Documents

**This workstream (`.planning/orchestration-harness/`):**
- `CONTEXT.md` — seeding narrative: why-exists, target shape, reuse map, principles, locked decisions,
  conflict register, deferred.
- `REFERENCES.md` — reference pattern → phase → extract/adapt/skip; inherited assets.
- `REQUIREMENTS.md` — v1 requirements (CLEAN/CTX/INT/ROUT/PLAN/STEER/GEN/VERIF) + deferred + OOS.
- `ROADMAP.md` — 8 phases (0–7) + per-phase detail + progress tracker.
- `STATE.md` — this file.
- `phases/` — per-phase plans (to be created, Phase 0 first).

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

**Phase 0 — Reconciliation Cleanups** (not started). First move per process rule: live code/schema
re-check of the three drift items before any change.

## Open Design Forks Carried Into Build-Planning

- **O1 (Phase 0)** — Dead Vercel `api/vcso/chat.ts` vs. live Python `/api/vcso/chat`; CLAUDE.md
  Rule #1 stale. Resolution direction set (retire Vercel, fix CLAUDE.md); execution pending.
- **O2 (Phase 0)** — Authoritative query-time wiki: `ose_knowledge_pages` (VCSO-read) vs. `wiki_*`
  claim/evidence system. Decision pending in Phase 0.
- **O3 (Phase 0)** — Conversation→wiki feeder running? Verify or scope-as-deferred in Phase 0.
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
| 0. Reconciliation Cleanups | Not started |
| 1. Working-State Memory + Bounded Assembly | Not started |
| 2. Intent & Depth Read + Adaptive Triage | Not started |
| 3. Tier-Escalating Source Router | Not started |
| 4. Planner (thin slice) — checkpoint | Not started |
| 5. Reflect-and-Steer + Freshness + First MCP | Not started |
| 6. Generalize + Strategic Workers | Not started |
| 7. Verification & Seams | Not started |

## Session Continuity Note

The workstream was seeded on 2026-07-13 directly after the MA-06 cost-routing checkpoint, the North
Star doc, the OpenClaw analysis, and the reconciliation pass — all of which are the inputs above.
The immediate next action is to develop the `phases/00-reconciliation-cleanups/` plan (the first
"planning file"). Nothing in this workstream has been committed to code; the last live change was
MA-06's Haiku worker routing (v0.6.4). Honor the Phase 4 stop-and-review checkpoint before broadening
sub-agent/tool-chain testing.
