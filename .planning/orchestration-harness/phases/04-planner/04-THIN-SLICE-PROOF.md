# Phase 4 Thin-Slice Proof Scaffold — Deferred Batched Pass

**Status:** Scaffolded only. **Do not run until London authorizes the batched P1–P4 canary pass.**

## Anchor question

> Using the latest founder financial dataset and compiled strategic context, client concentration is
> rising while margin is compressing. What is driving the combined risk, and what should I do in the
> next 90 days?

Before the run, replace the generic “latest founder financial dataset” wording only if the canary
founder has more than one relevant ready dataset and the intended dataset must be named explicitly.

## Expected route

1. P2 intent persists `strategic_synthesis` + `deep` at or above the planner confidence threshold.
2. P4 records an explicit bounded plan. Expected minimum decomposition:
   - structured-data worker binds the founder-scoped ready dataset at P3 Tier 0 and returns compact,
     cited numeric inputs;
   - sandbox worker computes concentration/margin trend over that compact prior finding and returns
     the result, derivation, inherited evidence, and confidence;
   - a wiki/KB worker gathers the relevant pricing, positioning, or constraint context.
3. Every child is depth 1, `can_spawn_agents=false`, linked to the parent by `parent_run_id`, and
   resolves through `tier_worker` (Haiku).
4. Compose resolves through `tier_synthesis` (Sonnet) over Phase 1 working state plus compact findings
   only. It performs no source re-crawl and emits a cited founder answer.
5. MA-05 shows the explicit plan and each nested worker without raw reasoning.

## Evidence table — populate only in the batched pass

| Gate | Control evidence | Planner evidence | Status |
|---|---|---|---|
| P1–P4 canary flag state captured before run | — | — | Pending |
| Intent = strategic_synthesis + deep + confidence | — | — | Pending |
| Explicit plan, revisions, and budget ledger | — | — | Pending |
| At least 2 children including sandbox compute | — | — | Pending |
| Runtime cap hit produces bounded compose | — | — | Pending |
| Forced planner error returns to P3/flat path | — | — | Pending |
| Parent/child `parent_run_id` linkage | — | — | Pending |
| Children Haiku; decompose/compose Sonnet | — | — | Pending |
| Compact contract + sandbox result/derivation/citations | — | — | Pending |
| MA-05 nested sanitized rendering | — | — | Pending |
| Answer cited, resolved, VCSO voice preserved | — | — | Pending |
| No quality regression vs control | — | — | Pending |
| Strategy-path total cost/context below flat control | — | — | Pending |
| LangSmith traces paired to exact usage/run rows | — | — | Pending |

## Stop condition

After the evidence table is populated, deliver the cost/quality/transparency/attribution read-back to
London and stop. Do not flip `vcso_planner`, generalize question types, enable disabled strategic
workers, or begin Phase 5/6 without the founder decision.
