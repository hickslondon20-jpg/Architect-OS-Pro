# Phase 4 Thin-Slice Proof — Batched Pass Halted

**Status:** **Failed live capstone; P4 rolled back** (2026-07-14). London ran the authorized matched
control and founder-canary capstone. Intent, routing, bounded decomposition, parent/child lineage,
working-state update, cited answer quality, and reduced Sonnet context passed. The mandatory sandbox
worker did not return a computed result, and its scoped LangSmith trace evidence was absent. Per the
spine runbook, `vcso_planner` was immediately disabled and unenrolled; the proof set halted before
turn 2. P1–P3 remain founder canaries, all global defaults remain off, and annotations remain off.

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

## Live evidence — 2026-07-14

- **Matched control thread:** `a4333347-f431-4377-b28b-17e462a84e94`
- **Founder-canary capstone thread:** `2136f46d-5baa-4937-bf2d-b2def25276b8`
- **Parent VCSO run:** `81ece07c-5b94-4773-9ea6-2e8c845943b8`

The control used the runbook's canonical prompt with all four master gates off. Its three Sonnet
`vcso_chat` calls totaled 52,992 input / 2,215 output tokens. LangSmith traces
`22352172-2fd8-4fa0-aec8-0f2a1fbc696d`, `466ade35-869b-425d-b0d8-b1d27882947d`, and
`705be2ab-32ed-47f0-b437-f975ad38bc4d` matched the three DB rows exactly.

London then repeated the exact prompt on the full founder-only P1–P4 canary. P2 persisted
`strategic_synthesis / deep / 0.97`; P3 persisted Tier 1 → stop. P4 decomposed to a structured-data
child (`d8f70336-5a96-44b5-a303-d0b49c66b269`) and sandbox child
(`deb60a01-4766-40f3-95dd-1af020b08a1e`), both depth 1 and linked to the parent. The sandbox child
exhausted six worker rounds after execution errors including `ModuleNotFoundError: scipy`; its
persisted `computed_result` was only the max-rounds fallback, not the requested concentration/margin
calculation. It consumed six independently attributed Haiku rows totaling 22,210 input / 1,369 output
tokens. No scoped LangSmith runs were found for either child run ID in the pass query.

The canary's Sonnet decompose + main calls totaled 38,549 input tokens, 27.3% below the 52,992-input
flat control. Across every tier, canary input totaled 62,786 tokens; `cost_usd` was not populated, so
the all-model dollar-cost gate cannot be claimed. The final answer remained cited and on-voice, but it
was not composed from a successful sandbox computation and therefore does not close PLAN-5 or the
Phase 3 strategic-cost carry-forward.

| Gate | Control evidence | Planner evidence | Status |
|---|---|---|---|
| P1–P4 canary flag state captured before run | All four off for matched control | All four founder-only, global off, annotations off | Pass |
| Intent = strategic_synthesis + deep + confidence | `intent=null` | `strategic_synthesis / deep / 0.97`, full profile | Pass |
| Explicit plan, revisions, and budget ledger | Flat path | Sonnet decomposition persisted; no revision required | Pass |
| At least 2 children including sandbox compute | None | Structured-data + sandbox children created | Pass for dispatch; **fail for compute** |
| Runtime cap hit produces bounded compose | N/A | Sandbox stopped after six rounds and returned bounded fallback | Fail-safe pass; proof gate fail |
| Forced planner error returns to P3/flat path | — | — | Pending |
| Parent/child `parent_run_id` linkage | N/A | Both children link to parent `81ece07c-...` | Pass |
| Children Haiku; decompose/compose Sonnet | Control Sonnet | Decompose/main Sonnet; six sandbox calls Haiku; structured-data deterministic | Pass |
| Compact contract + sandbox result/derivation/citations | N/A | Compact prior finding passed in; no valid calculation returned | **Fail** |
| MA-05 nested sanitized rendering | N/A | Persisted steps are `summary_only`; browser rendering not independently captured | Partial |
| Answer cited, resolved, VCSO voice preserved | Cited and on-voice | Cited and on-voice, but not resolved from successful compute | Partial |
| No quality regression vs control | Baseline captured | Founder-facing answer remained coherent; required computed basis absent | **Fail** |
| Strategy-path total cost/context below flat control | 52,992 Sonnet input | 38,549 Sonnet input (-27.3%); 62,786 all-tier input; dollar cost unavailable | Partial; carry-forward open |
| LangSmith traces paired to exact usage/run rows | 3/3 main rows paired | Intent, decompose, and 3 main rows paired; child traces absent | **Fail** |

## Rollback state

At 2026-07-14 22:22:39 UTC, `vcso_planner` was set to `is_enabled=false`,
`test_user_ids=[]`, and `enabled_for_all=false`. P1 working-state, P2 intent, and P3 router remain
enabled only for founder `cd490873-99aa-4533-9240-f0aa04deb54f`; `enabled_for_all=false` on every
layer and `annotations_enabled=false` on P1. No Phase 5+ work or broad rollout occurred.

## Stop condition

The run is halted. Do not re-enable `vcso_planner`, continue the remaining proof turns, generalize
question types, enable disabled strategic workers, or begin Phase 5/6 until the sandbox compute and
child-tracing defects are remediated and London explicitly authorizes a fresh matched restart.
