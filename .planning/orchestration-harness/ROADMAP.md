# Roadmap: Orchestration Harness — VCSO Planner — ArchitectOS Pro

## Overview

Stand up the VCSO **planner/harness** — the decompose→delegate→compose turn — over the existing
substrate (MA-05 transparency, MA-06 tier routing + registry, Ep6 workers/sandbox, Ep1–5 retrieval).
Sequenced by the North Star's thin-slice discipline: **clean up drift → build the pieces (context
seam, intent read, router, planner) → prove one hard strategic question end-to-end (checkpoint) →
add reflect-and-steer + freshness + a live MCP source → generalize → verify.** Cost, quality, and
UX are co-equal gates throughout.

Baseline: the platform is post cost-routing checkpoint (MA-06, v0.6.x). This workstream produces its
own version-tagged commits per CLAUDE.md.

## Process Rules

1. **Research first, per phase.** Each phase's first move is a live code/schema check against the
   reconciliation map; write a short findings note before wiring.
2. **Verify before building.** Most substrate exists — default action is compose/wire, not rebuild.
3. **Work from live.** `main` → auto-deploy → verify on `architectospro.com` / `api.architectospro.com`;
   commit version-tagged; pair LangSmith traces with DB/output checks.
4. **One phase at a time; do not batch.** Report findings + acceptance per phase before the next.
5. **Contracts before coordinator** (OpenClaw lesson): worker/handoff contracts and the pieces land
   before the planner coordinates them.
6. **Preserve the locks:** VCSO voice, curated transparency (no raw CoT, thinking off), bounded
   non-recursive sub-agents, one-writer, Claude-lock, founder isolation, no model selector.
7. **Stop at the Phase 4 thin-slice checkpoint** for founder review before broadening.

## Phases

| # | Phase | Requirement IDs | Gate |
|---|---|---|---|
| 0 | Reconciliation Cleanups | CLEAN-1..5 | Live VCSO confirmed single-path; CLAUDE.md corrected; wiki authority + feeder resolved/scoped. |
| 1 | Working-State Memory + Bounded Assembly | CTX-1..5 | Turn assembles from working state + components, not raw history; durable annotation grain; fail-open. |
| 2 | Intent & Depth Read + Adaptive Triage | INT-1..3 | Cheap pre-pass classifies move + depth; simple turns skip decomposition. |
| 3 | Tier-Escalating Source Router | ROUT-1..5 | Cheapest-first escalation over Tiers 0–3 + live; consumes a modular founder-context set; decisions recorded + rendered. |
| 4 | Planner (Decompose→Delegate→Compose) — thin slice | PLAN-1..5 | **One hard question end-to-end; STOP-and-review checkpoint.** |
| 5 | Reflect-and-Steer + Freshness + First MCP | STEER-1..4 | Human-in-loop terminal mode; freshness policy; live QuickBooks pull; runtime-enforced policy. |
| 6 | Generalize + Strategic Workers | GEN-1..3 | Planner across question types; retrieval-evidence + strategy-synthesis enabled. |
| 7 | Verification & Seams | VERIF-1..5 | Cost/quality/UX/safety gates proven on live. |

## Phase Details

### Phase 0: Reconciliation Cleanups
De-risk before building. Confirm the live Python VCSO path and retire/quarantine the dead Vercel
`chat.ts`; fix CLAUDE.md Rule #1. Resolve the two-wiki authority question and confirm/scope the
conversation→wiki feeder. Output: the drift items from `../RECONCILIATION-COGNITIVE-ORCHESTRATION.md`
closed or explicitly scoped, so later phases build on one clear surface.

**Status (2026-07-13): Founder checkpoint.** CLEAN-1, CLEAN-2, CLEAN-4, and CLEAN-5 are complete and
live verified. O1 is resolved; O3 is scoped deferred because the thread adapter is not operationally
feeding live pages. CLEAN-3/O2 has a documented recommendation but remains open until London confirms
the authoritative overlapping Layer-1 and emergent Layer-2 read paths. Phase 1 has not started.

### Phase 1: Working-State Memory + Bounded Assembly
Introduce the per-thread working-state artifact (decisions / open questions / gathered findings /
known-unknowns) and an `assemble()`-style context seam that returns a windowed, budgeted context
(working state + selected wiki components + current move). Adopt `isolated`/`fork` context modes for
workers. Compaction demoted to fallback. Add the **durable annotation grain** (Context Hub pattern):
notes agents attach to reusable resources that persist across threads and re-inject (untrusted,
opt-in) — the "learns and holds on" behavior beyond a single thread. This is the foundation the
router and planner reason over, and the primary cost lever on long conversations.

**Status (2026-07-13): Done; Stage 1 founder canary active.** CTX-1..5 are implemented and
live-verified. The matched
live set reduced first-call assembled input from 55,922 to 25,590 tokens (54.2%) and total main-loop
input from 178,476 to 141,415 tokens (20.8%) without a quality regression. Forced assembly failure
completed on legacy; worker-tier afterTurn usage, cross-thread untrusted annotations, founder RLS,
and cleanup were proven. The named founder is allowlisted behind the master gate; global enablement
and annotation re-injection remain off.
Three scoped LangSmith main-call traces are paired to the exact `ai_usage_log` rows and token counts in
`01-COMPLETION.md`. Stage 2 remains blocked on the canary observation gate.

### Phase 2: Intent & Depth Read + Adaptive Triage
A cheap worker-tier pre-pass (active-memory pattern) that reads the *kind* and *depth* of the move
before any retrieval, sets the response contract, selects the initial terminal mode, and gates
decomposition (simple lookups answer directly). Bounded timeout + circuit breaker + `NONE` sentinel;
injection hygiene on injected founder data.

**Status (2026-07-13): Code complete and live-dark; canary proof pending.** Commit `d2962d15`
implements INT-1..3 behind the separate default-off `vcso_intent_read` flag and is deployed to main.
The live flag has zero enrollment. A post-deploy flag-off VCSO smoke returned `READY.`, persisted with
`intent = null`, and logged `surface=virtual_cso`; production health returned HTTP 200. The mixed-intent
cost/quality proof and any default flip remain founder-gated and are not claimed complete. See
`phases/02-intent-read/02-COMPLETION.md`.

### Phase 3: Tier-Escalating Source Router
The cheapest-first source selector: Tier-0 records → Tier-1 wiki components → Tier-2 semantic →
Tier-3 raw → live MCP, stopping at the cheapest sufficient source, composing existing retrieval/KB/
`wiki_*` tools with **selective/incremental fetch** (Context Hub — grab only the component/file
needed). Consumes a **modular, extensible founder-context set** (Personal Context Portfolio — business
*and* founder-operating pages, grabbed as needed, never the fixed 7; missing pages degrade
gracefully). Wiki-component composition (not re-crawl). **Per O2 (resolved Phase 0):** compose the seven fixed
Layer-1 pages from `wiki_*` (claim/evidence = superior cited component) and emergent Layer-2 from
`ose_knowledge_pages` — a deliberate **two-source read** that does not depend on the unverified
`wiki_*`→OSE-Layer-1 projection. Router decisions recorded per turn and rendered through MA-05. This
is the retrieval half of the spine. *Dependencies:* authoring the new founder-operating pages, and
confirming/owning the OSE-Layer-1 projection, are OS Engine's job; this phase designs to consume.

**Status (2026-07-14): Done; founder canary proven; global default flip pending London.**
Commit `04222dbb` (`v0.6.18`) implements ROUT-1..5 behind the separate
`vcso_source_router` flag. The additive migration is live, global enablement remains off, and only the
existing Phase 1 test founder is enrolled. Read-only live-data acceptance stopped at Tier 0 for a
sprint-record question, Tier 1 for a strategic question, and Tier 3 for a named-document question.
The fixed seven remain `wiki_*` reads and Layer 2 remains OSE. Focused/regression tests and backend
compile pass. The matched authenticated control/canary set reduced total main-model input from
108,209 to 96,888 tokens (10.5%) without a quality regression; all 19 calls matched LangSmith traces
to exact usage rows. Global enablement remains off and the default-flip decision is London-gated. Do
not flip the router before the separate Phase 1/2 flip sequence or begin Phase 4 before direction. See
`phases/03-source-router/03-COMPLETION.md`.

### Phase 4: Planner (Decompose→Delegate→Compose) — thin slice
The reasoning half of the spine: decompose a strategic ask into budget-bounded sub-questions, delegate
gathering to bounded workers (incl. sandbox compute) returning compact cited findings, compose the
judgment on the synthesis tier over small inputs. Depth-bounded sub-delegation; runtime-enforced
per-turn budget. **Prove on one hard strategic question end-to-end, plan + workers visible via MA-05,
correct tiers.** **STOP-and-review checkpoint with the founder before broadening.**

**Status (2026-07-14): Code complete; live flag dark; batched proof/checkpoint pending.** v0.6.22
implements PLAN-1..4 and the PLAN-2 worker contract behind the default-off `vcso_planner` flag. The
flag row is live with zero enrollment. The distinct planner gates on Phase 2
`strategic_synthesis + deep`, decomposes and composes on the synthesis tier, delegates depth-1
children through the existing orchestrator on the worker tier, and fails open to the Phase 3/flat
path. Runtime budget/depth/contract tests pass. PLAN-5's question, expected route, and evidence table
are scaffolded in `phases/04-planner/04-THIN-SLICE-PROOF.md`; the founder proof, cap-hit live run,
stop-and-review, and every flag flip remain intentionally pending the batched validation pass.

### Phase 5: Reflect-and-Steer + Freshness + First MCP
Add the third terminal mode (surface-the-gap-and-ask), the freshness/authority policy the router
consults, and the first live MCP connector (QuickBooks) proving a live pull chosen by the freshness
policy and flowing through a bounded worker with citations. Runtime-enforced tool policy + hard blocks
for the powered workers.

### Phase 6: Generalize + Strategic Workers
Extend the planner across question types and domains; enable the disabled strategic workers selectively
(retrieval-evidence + strategy-synthesis) with scoped context + structured contracts + tier routing.
Optional light proactive follow-up from working-state.

### Phase 7: Verification & Seams
Prove the co-equal gates on live: cost (smaller synthesis context vs. baseline), quality (cited
CFO/CSO answers), UX (legible plan/workers + partner-like steer), safety (isolation, budgets,
runtime-enforced policy under adversarial prompts). Traces paired with DB/output checks.

## Progress Tracker

| Phase | Status | Completed |
|---|---|---|
| 0. Reconciliation Cleanups | **Done** (v0.6.11–v0.6.14; O1 resolved, O2 resolved w/ projection caveat, O3 scoped deferred) | 2026-07-13 |
| 1. Working-State Memory + Bounded Assembly | **Done; Stage 1 canary active** — live gates and paired-trace proof passed; Stage 2 awaits observation | 2026-07-13 |
| 2. Intent & Depth Read + Adaptive Triage | **Code complete; live-dark; canary proof pending** (v0.6.16) | — |
| 3. Tier-Escalating Source Router | **Done; founder canary proven; global flip pending London** (v0.6.18–v0.6.20) | 2026-07-14 |
| 4. Planner (thin slice) — checkpoint | **Code complete; live flag dark; batched proof/checkpoint pending** (v0.6.22) | — |
| 5. Reflect-and-Steer + Freshness + First MCP | Not started | — |
| 6. Generalize + Strategic Workers | Not started | — |
| 7. Verification & Seams | Not started | — |

**Status key:** Not started · In analysis · Plan written · In execution · Done · Deferred
