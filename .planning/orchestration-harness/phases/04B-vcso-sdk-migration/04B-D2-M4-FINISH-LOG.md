# 04B Phase D2 · SDK-M4 — Finish log

**Status:** CLOSED — the authorized surface re-proof held through completion, and the M4.1 zero-canary
reload verification passed on deployed `20f8ca1c` (`v0.6.113`). D2 is **done on M1–M5**: operational,
a step beyond MVP. The flag remains dark; generalization remains Phase G.

## Canary 1 — 2026-07-23

Pinned anchor, sent once from the signed-in in-app browser as
`hicks.london25@gmail.com`:

> Our client concentration is rising and our margin is compressing. What should I do in the next 90 days?

Preflight:

- Production `/api/health`: `ok=true`, deployed `b60bd599`.
- `vcso_sdk_loop`: founder-only for `cd490873-99aa-4533-9240-f0aa04deb54f`;
  `native_model_driven_enabled=true`; every diagnostic sub-flag off.
- `vcso_planner`: dark/retired.
- Fresh chat; linked-folder filter removed before send.

The turn completed under parent run `f5b8e353-25e1-4def-a4ef-f04c325bb205`.

### Passed

- Model-driven delegation completed three distinct child runs:
  - `4599abf7-0230-4692-a4bb-c1e26fce76aa` — `structured_data_agent`
  - `9fed17c4-5d0c-4206-964d-89f9d0aa190b` — `sandbox_execution_agent`
  - `37451c5b-d842-42de-b204-104770c09f7d` — `per_user_wiki`
- Per-child attribution fix held: each capability's final `ai_usage_log` row carries its own child
  `run_id`; the sandbox's two internal `tier_worker` calls correctly remain on the sandbox child.
- Tiers held: all three child rows are `claude-haiku-4-5-20251001`; the parent compose is
  `claude-sonnet-4-6` (`$0.13665825`).
- LangSmith pairing held:
  - structured child trace `104badf4-0674-4865-a531-73763f1bba56`
  - sandbox child trace `e3deac44-f161-4ace-82b8-91796d9e301b`
  - wiki child trace `6bf0824e-0559-4f8b-a8fe-5db852f194fe`
  - parent turn trace `76a977d6-3dda-4d91-84e3-b1b532e4fc69`
- The in-flight Progress panel rendered the four-item plan and grouped/collapsible child detail.
- Founder output exposed curated summaries only; no raw payload or chain-of-thought appeared.

### Failed

At the `done` event, the richer live hierarchy was replaced by the persisted flat SDK trace. The
right rail fell back from the four-item plan to the old flat `8/8` list. The SOURCES rail remained
empty even though the persisted assistant message carried cited findings.

Evidence:

- `evidence/04B-D2-M4/before-flat-progress.png`
- `evidence/04B-D2-M4/after-live-canary.png`

Root causes:

1. `done` replaced `liveAgentSteps` with `assistantMessage.agentSteps`.
2. completion immediately reloaded the thread, clearing live todos.
3. persisted citation objects use `source_label` / `source_kind`, which the frontend normalizer did
   not accept.
4. model-driven Task placeholders persisted before their authoritative child `run_id` was backfilled,
   preventing reopened threads from reconnecting Task rows to child detail.

The canary was re-darkened immediately after completion. Readback confirmed `vcso_sdk_loop`
`is_enabled=false`, both allowlists `[]`, `native_model_driven_enabled=false`, every diagnostic
sub-flag off, and `vcso_planner` dark.

## Repair after Canary 1

- Preserve the live nested hierarchy when a flat `done` trace arrives.
- Do not perform the completion-time reload that clears the live plan.
- Normalize persisted citation labels/kinds into the SOURCES rail.
- Treat persisted SDK `Task` rows as subagent parents and attach child citations.
- Backfill each Task's authoritative child `run_id` and `parent_tool_use_id` before persistence.
- Keep all child input/output fields blank on the frontend; only curated title, summary, status, and
  source chips render.

Verification after repair:

- focused nested-surface tests: 5 passed
- backend unit suite: 117 passed
- production frontend build: passed
- `git diff --check`: passed

No second canary was run at this point: the hand-off authorized one dark founder canary followed by
London review.

## Authorized surface re-proof — 2026-07-23

London authorized exactly one M4 surface-completion re-proof on deployed `f7e2ad3c`. The pinned anchor
was sent once from the signed-in founder account. Cost attribution and tiers were deliberately not
re-proven; Canary 1 had already closed those observations.

Observed before reload:

- all three nested worker groups rendered in flight;
- all three remained grouped at completion instead of reverting to the flat trace;
- SOURCES populated from cited worker findings;
- no raw payloads or chain-of-thought appeared.

The authorized reload then exposed one remaining defect: the persisted steps retained all three
`parent_tool_use_id` values, but thread loading cleared the live four-item plan, so the rail selected
its legacy flat `8/8` reconstruction. Per the authorization, the run stopped with no retry. The flag
was re-darkened immediately.

Evidence:

- `evidence/04B-D2-M4/reproof-in-flight.png`
- `evidence/04B-D2-M4/reproof-after-reload-regression.png`

## M4.1 reload repair + zero-canary verification

`v0.6.113` (`20f8ca1c`) rebuilds the same four-item native-worker plan during ordinary thread loading
from the persisted nested groups' `parent_tool_use_id` and capability keys. Ordinary non-nested SDK
traces retain their existing flat treatment.

Local verification:

- focused nested-surface suite: 7 passed;
- production frontend build: passed;
- `git diff --check`: passed.

Production verification used no new canary:

- Vercel production deployment `dpl_BCQkAPVH24YEPVUBjT5vc8YCcAWq`: READY on `20f8ca1c`;
- `/api/health`: `ok=true`, `commit_sha_short=20f8ca1c`;
- `vcso_sdk_loop`: disabled, unenrolled, native mode off, every diagnostic sub-flag off;
- `vcso_planner`: disabled and unenrolled;
- the existing canary thread `bd034f8a-8cde-4057-ae93-a7f349559e97` was reloaded in the signed-in
  founder browser without sending a message or arming any flag;
- Progress reconstructed as `4/4`, in the original plan order, with all three completed worker groups:
  `toolu_01E5LzRWgQLR6zgNJcDGvwwC`, `toolu_01FRcGQ26Sim9zSYajvmUgJn`,
  `toolu_01Q7oicuzXJJ43ZZjEAUcNzJ`;
- SOURCES retained 24 visible rows;
- no raw payload or chain-of-thought text appeared.

Passing evidence:

- `evidence/04B-D2-M4/m4-1-after-reload-pass.png`

M4 is closed. D2 is done on M1–M5. Generalization and the appropriateness rubric remain parked in
Phase G; nothing widens past the dark canary until that gate clears.

## Version-log housekeeping — two `v0.6.89` commits

The historical collision remains explicitly recorded here for the M4 close:

| Commit | Reused version | Meaning |
|---|---|---|
| `85a4409d` | `v0.6.89` | Canary 9 FAIL |
| `29742abe` | `v0.6.89` | Canary 9-retry PASS |

The retry should have incremented. All M4 commits continue forward; no version is reused.
