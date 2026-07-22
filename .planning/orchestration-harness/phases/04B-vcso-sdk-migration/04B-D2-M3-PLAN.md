# Phase D2 · SDK-M3 Plan — Reliable Model-Driven Delegation

> Read `04B-D2-PLAN.md`, `04B-D2-TIER2-CLOSE-HANDOFF.md` (§4 backlog, §5 canary runbook, §7 key files),
> `04B-D2-M2-FINISH-LOG.md`, and the `ROADMAP.md` D2 detail + **Process Rule 10** first. Behind
> `vcso_sdk_loop` (dark, founder-only). **Confirm deployed head == intended SHA + `/api/health ok=true`
> before every canary.** Path A stays the dark fallback; do **not** prune native scaffolding.

## Why this milestone
D2 tiers 1 & 2 are **proven once, not reliable** — delegation is **3 passes / 2 failures across five
live runs** on an **uncontrolled anchor**, and Tier 2 was closed on a single run. M3 makes delegation
*reliable* and adds the *reasoning quality* (effort-scaling + explicit per-worker contracts), and it
closes **Defect 7** — the worker cross-tool isolation gap that was live and unseen through the Tier-2
close. Per **Process Rule 10**, M3 exits on **N consecutive passes on a pinned anchor**, not one green
run. Defect 7 is a **hard gate**: the flag does not leave dark until it is closed. **Sequence matters —
instrument first, because you cannot measure reliability with an uncontrolled input and a flaky stream.**

## Steps (in this order)

### A. Instrumentation — make reliability measurable (do first)
1. **Pin the anchor.** Fix a single canonical anchor prompt (the financial-risk / client-concentration /
   90-day question) in version control, so reliability is measured against a controlled input. Respect
   the trigger regex (financial term + `concentration` + `90 days` **with a space**, `\b90\s+days?\b` —
   a hyphenated "90-day" silently no-ops).
2. **Stream keepalive** for the model-driven stream so the slow sandbox worker's ~113s in-band run does
   not idle-disconnect the SSE.
3. **Cheaper give-up** when the lead won't delegate — detect non-delegation early and degrade instead of
   burning the full turn cap thrashing.
4. **`try/finally` around the diagnostics drain** so diagnostics can't leak or hang the turn.
Output: a controlled, observable delegation run — the substrate for a real reliability measurement.

### B. Defect 7 — close the worker isolation gap (DARK-EXIT GATE)
1. Mint the worker token per **`(turn, capability)`** instead of per turn; the existing scope check then
   refuses cross-worker tool calls with **no new authorization logic**.
2. Prove it: a test that a worker subagent **cannot** invoke another worker's handler tool, plus a canary
   observation confirming the bounded-worker isolation lock holds. This is a **hard gate** — the flag
   does not leave dark until Defect 7 is closed.

### C. Reasoning quality — effort-scaling + delegation contracts (M3 core)
1. **Effort-scaling both directions.** A simple lookup answers directly (no decomposition); a genuine
   multi-part strategic question decomposes. Prove **both** — the pinned anchor decomposes; a simple
   control answers directly.
2. **Explicit per-worker delegation contracts.** Each `Task` carries objective, output format,
   tools/sources, and boundaries — the reasoning discipline the dropped-child failure lacked. The lead
   composes the contract; the worker executes against it.
3. Reflect-and-steer stays a first-class terminal mode.

### D. Reliability proof (the exit bar) + checkpoint
1. Run the **pinned anchor N consecutive times** on the dark founder canary — **recommend N ≥ 5**
   (founder confirms N). Require **N/N** successful model-driven delegations: the lead reasons, spawns the
   required workers via `Task`, correct tiers (Haiku workers / Sonnet compose), cited compose, nested UI
   + child traces paired to `ai_usage_log`. **This — not one green run — is the exit** (Process Rule 10).
2. Confirm the simple control answers directly on each run (effort-scaling holds; no over-decomposition).
3. **STOP-and-review with London** with the N-run reliability record + the Defect-7 isolation proof. Only
   on clearing the bar does D2 move from "proven once" to **reliable / closed**.

## Acceptance criteria
1. Anchor pinned; stream keepalive, cheap give-up, and diagnostics-drain `try/finally` in place.
2. **Defect 7 closed** — a worker cannot call another worker's tool (test + canary); isolation lock holds.
3. Effort-scaling holds both ways (pinned anchor decomposes; simple control answers directly).
4. Per-worker delegation contracts enforced (objective / format / tools / boundaries per `Task`).
5. **Reliability bar met: N/N consecutive successful delegations on the pinned anchor** (N ≥ 5), each with
   correct tiers, cited compose, nested UI, and paired child traces.
6. Path A retained (dark) as fallback; native scaffolding **not** pruned; `compileall` clean; frontend
   green; `04B-D2-M3-COMPLETION.md` written with the N-run record; `ROADMAP.md`/`STATE.md` updated.
   STOP-and-review with London.

## Hard rules
- **Confirm deployed head == intended SHA + `/api/health ok=true` before every canary.** Keep
  `vcso_sdk_loop` dark/founder-only; arm with the seeded account `cd490873…` (`hicks.london25@gmail.com`)
  only; **re-darken immediately after each turn** and read back both flags off.
- **Never touch or lose `MCP_TOOL_TIMEOUT=240000` on Railway** (the slow worker's timeout lives only
  there, not in code). **Do NOT re-add** the per-agent `timeout` config key (rejected by the deployed
  CLI; reverted v0.6.82). **Single-process env only** — no `WEB_CONCURRENCY` / `--workers` (the
  `TURN_REGISTRY` is process-global).
- **Version-tagged commits, always forward — even a failed/retry commit increments** (a retry that
  re-used `v0.6.89` created a collision; PATCH++ with no exception).
- Keep **Path A as the fallback**; do not prune native-delegation scaffolding. Preserve every lock
  (founder isolation, one-writer, Claude-lock — Sonnet compose / Haiku workers via the MA-06 tier map,
  no founder-facing model selector, tier authority at the capability grain). `vcso_planner` stays
  retired. **Do not flip defaults or edit the harness-root `ROADMAP.md`.**
- Pause mid-milestone only for a genuine new conflict — add a row to `../../CONTEXT.md` and stop.

## Out of scope / deferred
- **M4** — the full C2 progress-surface treatment, and the mid-stream finding-injection TODO
  (`vcso_sdk_loop.py:~1002–1005`).
- **Sandbox real computation + financial-series storage** — Phase F (couples to MCP retrieval).
- **Phases E / F / G.** Do not start them.

## Housekeeping (fold into this batch's doc updates)
- The **two-`v0.6.89` version collision** (`85a4409d` Canary 9 FAIL, `29742abe` Canary 9-retry PASS) — add
  a note to the finish log mapping both SHAs so a cold `git log` reader isn't confused. History is pushed;
  do **not** rewrite it — document it.
