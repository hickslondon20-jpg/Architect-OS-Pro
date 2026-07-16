# 04B Phase D — Live Thin-Slice Proof Report

**Checkpoint status:** **NOT READY — STOPPED FOR LONDON REVIEW** (2026-07-16)

**Implementation:** v0.6.46–v0.6.50 (`55a3d506`, `27517c2b`, `190f2c24`, `738ce51f`,
`ef4a5816`) on `main`.

**Production state after proof:** `vcso_sdk_loop` disabled, `test_user_ids=[]`,
`enabled_for_all=false`, `default=false`. The retired `vcso_planner` is also disabled, unenrolled,
and global/default off. No Phase E/F/G work started.

Phase D's native-subagent implementation is deployed, but the required live P4 thin-slice proof did
not pass. The final founder-only SDK canary persisted the correct deep strategic intent and displayed
the four-step plan, then the SDK session denied the three handler-backed native worker tools. The
stop hook detected the missing delegation, but no child run was created. The parent exhausted six
turns, failed, and the UI persisted the safe failure response. The canary was immediately returned to
dark.

## Final anchor run

- Exact anchor prompt: “Using the latest founder financial dataset and compiled strategic context,
  client concentration is rising while margin is compressing. What is driving the combined risk,
  and what should I do in the next 90 days?”
- Thread: `00bbf8d0-1d18-4ea9-b927-756abcdf200e`
- Parent run: `39d4ad4c-b273-4608-a2e1-7ac0a0d45940`
- User message: `6c51a477-b6ed-42f0-b401-9737f816d4df`
- Assistant message: `dc0dc67d-edb8-42e0-a403-0e9bc88d6c56`
- Intent: `strategic_synthesis / deep / 0.97`, full assembly profile.
- Routing: Tier 1 selected and stopped at Tier 1.
- Parent result: failed at the six-turn cap with
  `Claude Code returned an error result: Reached maximum number of turns (6)`.
- Child rows: zero. There is no `structured_data_agent`, `sandbox_execution_agent`, or
  `per_user_wiki` child linked to the parent.
- SDK usage row: `b9896eac-64b5-4639-a6fb-09f5bfb35873`, Sonnet,
  73,899 input / 3,390 output tokens, `cost_usd=0.12808795`.
- UI result: four planned steps remained 0/4; the persisted response was “I couldn't complete that
  response. Your request was saved; please try again.” The compact surface showed one step needing
  attention and no raw payload or chain-of-thought.
- Screenshot: `evidence/04B-D-final-canary-failure.png`.

The live SDK transcript explicitly reported permission denial for
`run_structured_data_agent`, `run_sandbox_execution_agent`, and `run_per_user_wiki`. This is the
blocking defect. It is not safe to call Phase D ready until those handler-backed tools are permitted
inside the native Task lifecycle and the exact anchor is re-run.

## Gate table

This table reuses the P4 thin-slice gates from `../04-planner/04-THIN-SLICE-PROOF.md`.

| Gate | Control evidence | Phase D live evidence | Status |
|---|---|---|---|
| P1–P4 canary flag state captured before run | Retained flat control had all master gates off | `vcso_sdk_loop` founder-only/global-off; `vcso_planner` retired/off | **Pass** |
| Intent = strategic_synthesis + deep + confidence | `intent=null` | `strategic_synthesis / deep / 0.97`, full profile | **Pass** |
| Explicit plan, revisions, and budget ledger | Flat path | Four-step plan rendered; six-turn and $0.25 caps configured; no completed worker ledger | **Partial** |
| At least 2 children including sandbox compute | None | Zero child rows; native worker tools denied | **Fail** |
| Runtime cap hit produces bounded compose | N/A | Six-turn cap stopped the loop and persisted a safe failure, not a composed answer | **Fail-safe pass; proof gate fail** |
| Forced planner error returns to P3/flat path | — | Thread `337a2a99-d5e9-44fe-b160-465efea0915b` completed on `vcso_tool_loop_v1`; zero children; diagnostic seam removed afterward | **Pass** |
| Parent/child `parent_run_id` linkage | N/A | No child rows exist to link | **Fail** |
| Children Haiku; decompose/compose Sonnet | Control Sonnet | Parent Sonnet; live worker rows absent. Live registry read-back confirms all seven worker capabilities resolve through `tier_worker` to `claude-haiku-4-5` | **Partial; dispatch proof absent** |
| Compact contract + sandbox result/derivation/citations | N/A | No sandbox execution or computed result | **Fail** |
| MA-05 nested sanitized rendering | N/A | Four-step plan rendered, but no nested workers existed; safe failure chip captured | **Fail** |
| Answer cited, resolved, VCSO voice preserved | Matched flat answer retained | No completed founder answer; safe failure persisted | **Fail** |
| No quality regression vs control | Baseline captured | Required sandbox-grounded answer absent | **Fail** |
| Strategy-path total cost/context below flat control | 52,992 Sonnet input | 73,899 Sonnet input; planner path failed. Final SDK dollar cost exists, but the control's `cost_usd` is null | **Fail on token proxy; dollar gate carried forward** |
| LangSmith traces paired to exact usage/run rows | Control 3/3 paired | No child usage rows or child traces; failed anchor did not reach `afterTurn` | **Fail** |

## Additional required tests

### Effort-scaling holds down — Pass

The simple lookup “What was the latest net revenue in the founder financial dataset? Answer
directly with the value and period.” ran on the same SDK canary without decomposition.

- Thread: `5589fdd7-f7a0-48ad-b6fe-7d903d2de778`
- Parent: `b4b92275-4493-47d6-848f-4b621ca5c332`
- Child count: zero
- Answer: `$45,000/month`, July 2026
- Usage: `0709e7af-2682-4e5b-9154-dd003f98a09a`, Sonnet,
  6,803 input / 36 output, `$0.026049`

Missing-child enforcement did not force decomposition on a simple lookup.

### Forced native-planner error → flat path — Pass

A founder-scoped, temporary `force_fail_open_user_ids` diagnostic forced the native path to fail
open. The exact anchor then completed through the ordinary flat loop.

- Thread: `337a2a99-d5e9-44fe-b160-465efea0915b`
- Parent: `36cc204a-8c3c-402a-9737-ba3ffe0cb6ee`
- Output schema: `vcso_tool_loop_v1`
- Child count: zero
- Result: completed

The temporary diagnostic founder ID was removed and read back absent before the final anchor.

## Required questions

### Third worker?

The final proof attempted the full expected three-worker route: structured data → sandbox compute,
plus `per_user_wiki` for strategic context. This was chosen because the anchor genuinely needs both
numeric derivation and strategic constraint context, and because it exercises the expected route
rather than relying on compose-time working state. The hard minimum remains the two compute workers,
but none of the three was permitted or created in the failed live run.

### `cost_usd`

Phase D now records the final SDK parent cost (`$0.12808795` for the failed anchor). The retained flat
control predates dollar metering and still has `cost_usd=null`, so the dollar-comparison gate cannot be
claimed. It is carried forward; `ai_usage_log` remains the separate metering ledger. The token proxy
also fails because 73,899 parent input tokens exceed the 52,992-input flat control.

### Flag and control hygiene

The final run was under `vcso_sdk_loop`, enrolled only for founder
`cd490873-99aa-4533-9240-f0aa04deb54f`, with `enabled_for_all=false` and `default=false`.
`vcso_planner` stayed retired/off throughout. The retained 2026-07-14 control remained valid because
the founder dataset, dataset rows, wiki, and OSE evidence were unchanged after that control; no fresh
flat control was captured. After the failure, both flags were read back disabled with empty founder
allowlists and global/default off.

## Implementation and verification completed before the failed gate

- Native subagent implementation and nested UI extension: v0.6.46 (`55a3d506`).
- Sandbox runtime verification: v0.6.47 (`27517c2b`); production verification reported
  `scipy 1.17.1` and `statsmodels 0.14.6` available.
- Exact child usage/trace attribution and after-turn trace-wrapper correction: v0.6.48
  (`190f2c24`). These paths passed focused tests, but child and after-turn live pairing remain unproven
  because the anchor created no children and failed before after-turn.
- Delegation-only lead restriction: v0.6.49 (`738ce51f`).
- Two-turn handler lifecycle for native workers: v0.6.50 (`ef4a5816`).
- Backend compile passed; 38 focused tests passed.

## Stop decision

Phase D is **not approved-ready**. The implementation is deployed dark, but the proof gate remains
open on native worker permission, both mandatory children, real sandbox compute, nested worker
rendering, sandbox-resolved answer quality, cost/context parity, and child/after-turn trace pairing.
Per the checkpoint instruction, work stops here for London. Do not broaden, re-enable either flag,
generalize question types, or begin Phase E until London approves a narrowly scoped remediation and
another exact-anchor proof run.
