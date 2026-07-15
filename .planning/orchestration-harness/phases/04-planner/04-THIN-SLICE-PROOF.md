# Phase 4 Thin-Slice Proof — Batched Pass Halted

**Status:** **Second live capstone failed; P4 rolled back again** (2026-07-15). The sandbox/runtime
remediation itself held, but the restarted planner generated only one structured-data child and never
created the mandatory sandbox child. The answer therefore fell back to the ordinary tool loop without
a computed result or derivation. Per the spine runbook, `vcso_planner` was immediately disabled and
unenrolled; the proof set again halted before turn 2. P1–P3 remain founder canaries, all global
defaults remain off, and annotations remain off.

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

## Restart 2 evidence — 2026-07-15

- **Thread:** `41397cbb-94b3-4211-af28-46a5e841881a`
- **Parent VCSO run:** `69303f3d-27db-4da6-866a-544fbb1d7de6`
- **User message:** `9bf5c2c9-dd1f-48b1-9597-df2471a355b7`
- **Assistant message:** `f0d25d61-05bc-40ad-9967-64d76cd10ca3`

The retained control remained valid: no post-control commit touched the flat assembly/retrieval path,
and no founder dataset, dataset row, structured wiki page/claim, or OSE page changed after the control
at 2026-07-14 22:12:10 UTC. The post-remediation smoke returned `READY.`, logged
`surface=virtual_cso`, and created no planner run. All four flags were then read back founder-only,
global-off, annotations-off before London sent the exact matched capstone.

P2 again persisted `strategic_synthesis / deep / 0.97`; P3 persisted Tier 1 → stop. Sonnet
decomposition used 383/509 tokens, but it generated only one child:
`structured_data_agent` run `2efb36d6-62b7-405b-9ba1-267aeae42abf`, parent-linked at depth 1. That
deterministic child returned the bounded June P&L row (`net_revenue=45000`, `net_income=8325`) and its
dataset citation. No `sandbox_execution_agent` run exists for the turn, so the mandatory concentration
and margin computation, derivation, inherited citation, Haiku worker attribution, and ≥2-child gate
all fail. The parent resumed the ordinary Sonnet tool loop, made two wiki searches, and produced a
cited answer with 50 persisted citation records. Working state populated all four families, but the
answer was not composed from the required sandbox result.

The retained flat control is 52,992 Sonnet input tokens. Restart 2 used 38,647 Sonnet input tokens
(383 decompose + 38,264 ordinary main loop), 27.1% lower, but this does **not** close the strategic
cost carry-forward because the required planner path did not complete. Total recorded input including
intent and afterTurn utilities was 40,714 tokens; `cost_usd` remains null.

Five scoped LangSmith traces exactly match five database rows for the turn:

| Capability | LangSmith trace | DB usage row | In / out |
|---|---|---|---:|
| `vcso_intent_read` | `062ce7aa-d6d9-4bf9-bf5b-779defb73300` | `c6688a1f-e18d-4865-be91-0ff9ff796464` | 693 / 54 |
| `vcso_planner_decompose` | `61683c59-85c1-41c3-a899-8aea2db0d173` | `40710eb3-ae0f-4d0b-a5c7-9fd82c52fb65` | 383 / 509 |
| `vcso_chat` | `823ad80f-2c4b-4e47-8b1b-00ef74038ddc` | `b9cbe5c8-fb58-4e01-b892-25b157a46f37` | 8,762 / 102 |
| `vcso_chat` | `61a9d5a6-dbf2-4b51-a1a2-cafa2809a79d` | `7d9e4b92-a86f-4746-af3f-d46a2080e3dc` | 13,461 / 1,259 |
| `vcso_chat` | `faa75670-3ca7-4141-9230-679cd5db1609` | `cb2ebd1a-0e04-4de5-9bba-198845f731ac` | 16,041 / 1,184 |

The working-state `afterTurn` database row `cf945053-a43f-4f81-bd8b-4b8acdd65592` recorded
1,374/457 tokens and the state update succeeded, but no LangSmith run with those token counts was
found in the configured project. The persisted P1 output is proven; full per-call trace pairing is
therefore incomplete for this turn.

At 2026-07-15 03:33:09 UTC, `vcso_planner` was set to `is_enabled=false`,
`test_user_ids=[]`, and `enabled_for_all=false`. Read-back passed. No follow-up or mixed-path turn ran.

## Rollback state

At 2026-07-14 22:22:39 UTC, `vcso_planner` was set to `is_enabled=false`,
`test_user_ids=[]`, and `enabled_for_all=false`. P1 working-state, P2 intent, and P3 router remain
enabled only for founder `cd490873-99aa-4533-9240-f0aa04deb54f`; `enabled_for_all=false` on every
layer and `annotations_enabled=false` on P1. No Phase 5+ work or broad rollout occurred.

## Stop condition

The run is halted. Do not re-enable `vcso_planner`, continue the remaining proof turns, generalize
question types, enable disabled strategic workers, or begin Phase 5/6. The new blocking defect is
planner coverage: the decomposition must deterministically preserve the mandatory structured-data →
sandbox compute chain and minimum child count before another London-authorized restart.
