# Phase 4 Context — Planner: Decompose → Delegate → Compose (thin slice)

**Phase:** 04 of the Orchestration Harness workstream. **This is the North Star's stop-and-review
capstone** (the matured MA-06 cost-routing checkpoint).
**Read first:** the workstream `../../CONTEXT.md` (target shape, F1 distinct-planner decision, bounds),
`../../ROADMAP.md` (Phase 4), `../../REQUIREMENTS.md` (PLAN-1..5), and Phases 1–3 (`../01-working-state-memory/`
the `assemble()` seam; `../02-intent-read/` the intent gate; `../03-source-router/` the source router).
North Star `../../../COGNITIVE-ORCHESTRATION-ARCHITECTURE.md` §2–§4 wins over any reference. Reuse
substrate: `../agent-harness/` (Ep6 `sub_agent_orchestrator` + `agent_capabilities` + `agent_delegation_*`).

---

## Why this phase, and what it is

Phases 1–3 built the retrieval half of the spine (memory → intent → router). Phase 4 builds the
**reasoning half**: for a genuinely multi-part strategic ask, the planner **decomposes** it into
sub-questions, **delegates** the token-heavy gathering to bounded workers that return compact cited
findings, and **composes** a judgment-bearing, cited answer on the synthesis tier over those compact
findings — not raw source. This is the "thought partner" behavior, and it is deliberately proven on
**one hard strategic question** end-to-end, then **stop-and-review with the founder** before any
breadth (Phase 6).

**It closes the Phase 3 strategy-path cost question.** In Phase 3 a strategic turn paid twice
(router pre-fetch *plus* the main model still crawling). The planner is the fix: workers gather on the
**worker tier** and hand back compact findings; the main **synthesis-tier** call **composes over those
findings instead of re-crawling raw source.** That is where strategy turns should finally get cheaper
*and* better-cited.

## The mechanism (build to this; confirm the checkpoint items)

```
intent = strategic_synthesis + deep (P2)  ─▶  PLANNER (distinct flow, F1)
  1. DECOMPOSE   → budget-bounded sub-questions, each bound to a source/worker (via P3 router)
  2. DELEGATE    → bounded workers (existing Ep6 handlers, incl. sandbox compute) on the worker tier
                    → each returns a COMPACT, CITED, STRUCTURED finding (lane-contract/handoff shape)
  3. COMPOSE     → the synthesis-tier main call reasons over working_state + the compact findings
                    (fed through the P1 assemble() seam) → cited, sequenced answer
  guardrails: per-turn budget (rounds/depth/spend) + depth-bounded sub-delegation (one level, no recursion)
  transparency: plan + each worker render through the MA-05 sub-agent surface (parent_run_id nesting)
```

Simple / lookup / brainstorm / ambient turns **do not** invoke the planner — the Phase 2/3 lean and
full paths handle them. Adaptive granularity: only genuinely multi-part strategic turns pay for a plan.

## What this phase is NOT

- **Not generalization (P6).** Prove **one** hard strategic question; do not roll the planner across
  all question types/domains or enable the disabled strategic workers yet.
- **Not new workers.** Reuse the Ep6 `sub_agent_orchestrator` handlers (incl. `sandbox_execution_agent`).
  The planner is the decompose/compose brain over the existing bounded specialists.
- **Not reflect-and-steer / freshness / live MCP (P5).** The planner composes or (for this phase)
  falls back; the reflect-and-steer terminal mode + freshness + MCP are Phase 5.
- **Not open recursion or an agent swarm.** Depth-bounded (one controlled level), budget-capped,
  runtime-enforced.

## Decisions that shape this phase (grounded; confirm the checkpoint items)

1. **Distinct planner flow (F1, founder-chosen).** For strategic-synthesis turns, the VCSO route
   invokes a distinct decompose→delegate→compose flow — not the flat loop. This resolves the F-open
   "planner physical shape" fork toward a distinct module the route delegates to.
2. **Compose = the synthesis-tier main call over compact findings.** Workers gather (worker tier);
   the main Sonnet call composes over `working_state` + compact worker findings via the P1 seam. The
   composer never re-crawls raw source.
3. **Worker return contract (lane-contract/handoff shape).** Each worker returns a **compact, cited,
   structured** finding (claim + evidence + provenance) — composition depends on this. Reuse the Ep6
   structured output contract + `agent_delegation_*` records; render nested via MA-05.
4. **Guardrails runtime-enforced.** Per-turn budget (max sub-questions/rounds/spend) + depth-bounded
   sub-delegation (one level); enforced by the runtime, not the prompt.
5. **Adaptive: planner fires only for multi-part strategic turns** (gated by P2 intent; conservative
   default when P2 off = do **not** decompose — fall back to the P3 path).
6. **Own flag, prove-then-flip, flips last.** Behind `vcso_planner` (default off), fail-open to the
   P3/flat path; composes atop the P1/P2/P3 flags; its production flip is the last in the stack.
7. **Preserve the locks:** VCSO voice; curated transparency (no raw CoT); one-writer; founder
   isolation; Claude-lock (workers Haiku, composer Sonnet, via MA-06); bounded non-recursive sub-agents.

## Success criteria (from ROADMAP Phase 4 — PLAN-1..5)

1. **PLAN-1:** decompose a strategic ask into budget-bounded sub-questions bound to sources/workers;
   plan explicit + revisable mid-turn.
2. **PLAN-2:** delegate gathering to bounded workers (incl. sandbox compute) returning compact cited
   structured findings.
3. **PLAN-3:** compose on the synthesis tier over working state + compact findings only (never raw
   dumps); every claim cited.
4. **PLAN-4:** depth-bounded sub-delegation (one level, no recursion); per-turn budget runtime-enforced.
5. **PLAN-5 (thin-slice proof + CHECKPOINT):** one hard strategic question end-to-end —
   intent → decompose → ≥2 workers incl. a sandbox compute over a dataset → compose — with plan +
   workers visible via MA-05, each on the correct tier, independent parent/child cost attribution, a
   cited resolved answer, and **no quality regression**. **STOP-and-review with the founder before
   Phase 6.** (Proof runs in the batched validation pass per the build-dark decision.)
6. Workstream `ROADMAP.md` + `STATE.md` updated; `04-COMPLETION.md` written.

## Locked decisions (founder-confirmed 2026-07-14)

- **Planner physical shape: a distinct decompose→delegate→compose flow** the VCSO route invokes for
  strategic turns (per F1). Resolves the F-open "planner physical shape" fork → distinct module the
  route delegates to.
- **Decompose trigger + granularity:** the planner fires **only** for `strategic_synthesis`+`deep`
  intent above the confidence threshold; **conservative default (no decomposition) when Phase 2 is
  off** → fall back to the Phase 3 path; a **budget cap on sub-questions** (runtime-enforced).
- **Proof/checkpoint sequencing:** the thin-slice proof + stop-and-review is the **workstream's
  cost-routing capstone**, run in the **batched validation pass** (needs P1–P4 flags on for the
  canary), not now.
