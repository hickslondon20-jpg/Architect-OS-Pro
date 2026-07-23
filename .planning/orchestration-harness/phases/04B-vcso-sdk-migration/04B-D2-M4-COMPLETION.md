# 04B Phase D2 · SDK-M4 Completion

**Status:** CLOSED — 2026-07-23  
**Deployed close SHA:** `20f8ca1c` (`v0.6.113`)  
**D2 outcome:** done on M1–M5; operational, a step beyond MVP  
**Rollout state:** `vcso_sdk_loop` dark and unenrolled; `vcso_planner` dark/retired

## Delivered

### M4.1 — full C2 nested-step founder surface

- Nested workers render under the right-hand plan, grouped and collapsible by `parent_tool_use_id`.
- Worker state is founder-legible (`running`, `completed`, `failed`) with curated child detail only.
- Worker citations populate the SOURCES rail.
- Completion preserves the live grouped hierarchy.
- Ordinary thread loading reconstructs the same four-item grouped plan from persisted worker parents,
  child runs, capability keys, and citations.
- Raw payloads and chain-of-thought are not passed into the child drill-down surface.

### M4.2 — per-child cost and trace attribution

Canary 1 proved each worker's final `ai_usage_log` row on its own child run:

- `4599abf7-0230-4692-a4bb-c1e26fce76aa` — `structured_data_agent`
- `9fed17c4-5d0c-4206-964d-89f9d0aa190b` — `sandbox_execution_agent`
- `37451c5b-d842-42de-b204-104770c09f7d` — `per_user_wiki`

The sandbox's internal tier calls correctly remain on the sandbox child. Child LangSmith traces pair
to the corresponding child usage rows rather than collapsing onto one run.

### M4.3 — observability hold

- workers: `claude-haiku-4-5-20251001`
- parent compose: `claude-sonnet-4-6`
- nested render, per-worker traces, and per-child usage attribution held under model-driven delegation
- Path A and native scaffolding remain intact
- `MCP_TOOL_TIMEOUT=240000` and single-process deployment locks remain intact

### M4.4 — proof and close

The authorized one-run surface re-proof sent the pinned anchor exactly once. Nested groups rendered in
flight and remained grouped at completion; SOURCES populated; no raw payloads or chain-of-thought
appeared. The first reload exposed a thread-load reconstruction defect and stopped without retry.

`v0.6.113` fixed only that reconstruction path. Zero-canary verification then reloaded the existing
signed-in founder thread after `/api/health` advanced to `20f8ca1c`:

- Progress: `4/4`
- Structured data worker: completed and grouped
- Sandbox compute worker: completed and grouped
- Strategic context worker: completed and grouped
- Compose: completed
- three persisted `parent_tool_use_id` groups present
- 24 SOURCES rows present
- no new message, no flag arming, no raw payloads, no chain-of-thought

Evidence:

- `evidence/04B-D2-M4/reproof-in-flight.png`
- `evidence/04B-D2-M4/reproof-after-reload-regression.png`
- `evidence/04B-D2-M4/m4-1-after-reload-pass.png`

## Verification

- `vitest`: 7 focused nested-surface tests passed
- production frontend build passed
- Vercel production deployment READY on `20f8ca1c`
- `/api/health`: `ok=true`, `commit_sha_short=20f8ca1c`
- flag readback: SDK loop and planner dark; allowlists empty; native and diagnostics off

## Honest boundaries carried forward

- Mid-stream finding injection remains deferred.
- Real sandbox computation and financial-series storage remain Phase F.
- Question-shape expansion and the delegation-appropriateness rubric remain Phase G.
- Nothing widens past the dark canary until the Phase G generalization gate clears.
- The historical two-`v0.6.89` collision is recorded in `04B-D2-M4-FINISH-LOG.md`.

## Close

SDK-M4 closes the last outstanding D2 milestone. D2 is done on M1–M5: model-driven delegation is
operational, founder-visible, persistently grouped, individually attributable, and observable beyond
the MVP bar.
