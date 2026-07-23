# 04B Phase D2 · SDK-M4 — Finish log

**Status:** OPEN — Canary 1 found a founder-surface completion defect; fixed in code, live re-proof
requires a new London GO. D2 is **not yet recorded done on M1–M5**.

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

No second canary was run: the hand-off authorizes one dark founder canary followed by London review.

## Version-log housekeeping — two `v0.6.89` commits

The historical collision remains explicitly recorded here for the M4 close:

| Commit | Reused version | Meaning |
|---|---|---|
| `85a4409d` | `v0.6.89` | Canary 9 FAIL |
| `29742abe` | `v0.6.89` | Canary 9-retry PASS |

The retry should have incremented. All M4 commits continue forward; no version is reused.

