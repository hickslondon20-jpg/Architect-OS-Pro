# Execution Agent Brief — Phase 4: Planner (Decompose → Delegate → Compose)

You are the Execution Agent for **Phase 4** of the Orchestration Harness workstream in ArchitectOS
Pro. You build the **reasoning half of the spine** — a distinct planner flow that decomposes a
strategic ask, delegates gathering to bounded workers, and composes a cited answer on the synthesis
tier over compact findings. This is the workstream's **cost-routing capstone**: its thin-slice proof
is the founder stop-and-review gate.

You build it **dark** (behind `vcso_planner`, default off) per the founder's build-dark decision — the
thin-slice proof + checkpoint runs later in the **batched validation pass**, not now. You do not
re-plan the phase, and you do not start any later phase (no generalization, no reflect-and-steer, no
freshness/MCP).

## Read these before writing any code (in order)
1. `.planning/orchestration-harness/CONTEXT.md` — workstream rationale, the F1 distinct-planner
   decision, the bounds (one-writer, curated transparency, bounded non-recursive sub-agents,
   Claude-lock), and the carry-forwards.
2. `.planning/orchestration-harness/ROADMAP.md` — Phase 4 goal + success criteria (PLAN-1..5).
3. `phases/04-planner/04-CONTEXT.md` — phase rationale, the mechanism, and the **Locked decisions**
   (founder-confirmed) you build to.
4. `phases/04-planner/04-01-PLAN.md` (PLAN-1..4, planner core) and `04-02-PLAN.md` (PLAN-2 contract +
   PLAN-5 thin-slice proof) — the two plans you execute.
5. Phases 1–3: `../01-working-state-memory/01-CONTEXT.md` (the `assemble()` seam), `../02-intent-read/02-CONTEXT.md`
   (the intent gate), `../03-source-router/03-CONTEXT.md` (the source router the decomposition binds to).
6. Canonical (win over anything): `.planning/COGNITIVE-ORCHESTRATION-ARCHITECTURE.md` §2–§4.
7. Reuse substrate (verify live before changing): `python-backend/services/sub_agent_orchestrator.py`
   (7 handlers incl. `sandbox_execution_agent`), `agent_capabilities`, `agent_delegation_runs`/`_steps`
   (`parent_run_id` linkage), MA-05 nested sub-agent rendering, MA-06 tiers (`tier_worker`/synthesis).
   Supabase `pwacpjqkntnovndhspxt`; live `api.architectospro.com`.

## What you are building

**Plan 04-01 — planner core (PLAN-1..4):**
- Flag `vcso_planner` (default **off**, Phase-1-flag shape; flips last in the stack).
- **Entry gate:** invoke the planner **only** for Phase 2 intent `strategic_synthesis`+`deep` above the
  confidence threshold; **conservative default when Phase 2 is off → do not decompose** (fall back to
  the Phase 3 path). Flag off ⇒ Phase 3/flat path unchanged.
- **Decompose** (synthesis tier) → budget-bounded sub-questions bound to sources/workers (via the P3
  router); explicit + revisable mid-turn within budget.
- **Delegate** each sub-question to a bounded worker via `sub_agent_orchestrator` (existing handlers,
  incl. sandbox compute) on the **worker tier**; persist `agent_delegation_*` with `parent_run_id`;
  **depth-bounded (one level, no recursion)**.
- **Compose** on the synthesis tier over `working_state` + compact worker findings via the P1 seam —
  **never raw dumps, never re-crawl.** Every claim cited.
- **Runtime-enforced budget** (max sub-questions/rounds/depth/spend); **fail-open** to the P3/flat path;
  plan + workers render nested via MA-05 (sanitized).

**Plan 04-02 — worker return contract + thin-slice proof (PLAN-2 contract, PLAN-5):**
- Harden the **worker return contract**: compact + claim(s) + evidence/citations + provenance +
  confidence, size-capped (oversized summarized to contract, never raw into compose); the sandbox
  worker returns a **computed result + derivation + citations**.
- Set up (do not run now) the **thin-slice end-to-end proof**: one hard strategic question through
  intent → decompose → ≥2 workers incl. sandbox compute over a founder dataset → compose, with the
  evidence table scaffolded for the batched pass.

## Hard constraints (do not violate)
- **Default-off flag; build dark; flip last.** Flag off ⇒ behavior unchanged. Do **not** flip any
  flag, and do **not** run the thin-slice proof or the stop-and-review now — those are the batched pass.
- **Reuse, don't rebuild.** Use the Ep6 `sub_agent_orchestrator` handlers + `agent_delegation_*`
  records + MA-05 nesting. **Add no new worker handlers** (that's Phase 6).
- **Adaptive.** Only `strategic_synthesis`+`deep` invokes the planner; non-strategic and low-confidence
  never decompose; conservative no-decompose default when Phase 2 is off.
- **Compose over findings only.** The synthesis-tier composer reads working state + compact worker
  findings — never raw source, never re-crawl.
- **Bounded + non-recursive.** One controlled level of sub-delegation; per-turn budget/depth caps
  enforced by the **runtime**, not the prompt. Fail-open to the Phase 3 path on any planner error.
- **Preserve the locks:** VCSO voice; curated transparency (no raw CoT, thinking off); one-writer
  (no KB writes); founder isolation + tool permissions unchanged; Claude-lock (workers Haiku, composer
  Sonnet, via MA-06). Work from live; commit version-tagged.
- **Scope wall.** No generalization/disabled-worker enablement (P6); no reflect-and-steer, freshness,
  or live MCP (P5). If you're rolling across question types or pulling live external data, you've left
  Phase 4.

## Checkpoint — proceed straight through; no flip, no proof-run
The three design decisions are **locked** (see `04-CONTEXT.md` Locked decisions) — implement on them,
no further checkpoint. Build the planner dark and scaffold the proof; **do not run the thin-slice proof,
do not stop-and-review, do not flip** — those are the batched validation pass, on the founder's go.
Only pause mid-phase for a genuine new conflict with the workstream CONTEXT — add a Conflict Register
row and stop.

## Done when
1. **PLAN-1:** strategic turns decompose into an explicit, budget-bounded, revisable set of
   sub-questions bound to sources/workers; non-strategic intents never invoke the planner.
2. **PLAN-2:** workers dispatch via the existing orchestrator (incl. sandbox compute) on the worker
   tier, linked by `parent_run_id`, and return findings conforming to the compact/cited/structured
   contract (size-capped).
3. **PLAN-3:** compose runs on the synthesis tier over working state + compact findings only (no raw
   dump); answer cited.
4. **PLAN-4:** depth-bounded (one level, no recursion); per-turn budget runtime-enforced (proof: a cap
   is hit → bounded compose, not runaway); fail-open to the Phase 3 path proven.
5. Plan + workers render nested + sanitized via MA-05; independent parent/child cost attribution is
   available (parent Sonnet vs. child Haiku, `parent_run_id`).
6. The thin-slice proof is **scaffolded** (question, expected route, evidence table) but **not run**;
   flag remains default-off; no stop-and-review performed.
7. `python -m compileall python-backend` clean; frontend build green if any `src` touched (none
   expected); `.planning/orchestration-harness/ROADMAP.md` + `STATE.md` updated; `04-COMPLETION.md`
   written (implementation evidence; proof marked pending the batched pass); `Pro-Suite-Progress.md`
   updated. Deliver a read-back to London.

## Explicitly out of scope for you
Generalization across question types + enabling the disabled strategic workers (Phase 6);
reflect-and-steer / freshness / live MCP (Phase 5); verification (Phase 7); new worker handlers;
running the thin-slice proof or the stop-and-review; flipping any flag; and the Phase 1/2/3 canary
flips (batched pass). Do not resolve anything `04-CONTEXT.md` marks as a later phase.
