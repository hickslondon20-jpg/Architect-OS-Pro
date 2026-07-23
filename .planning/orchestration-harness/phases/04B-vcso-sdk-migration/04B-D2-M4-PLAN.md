# Phase D2 · SDK-M4 Plan — Surface + Observability Hold (D2's last milestone)

> Read `04B-D2-PLAN.md` (Step E = SDK-M4), `04B-D2-M3-COMPLETION.md`, `04B-D2-TIER2-CLOSE-HANDOFF.md` §4,
> `04B-C2-PLAN.md` (the streaming surface this extends), and the `ROADMAP.md` D2 detail + Process Rule 10
> first. Covers **SDK-M4.1–M4.4**. Behind `vcso_sdk_loop` (dark, founder-only). **Confirm deployed head ==
> SHA + `/api/health ok=true` before the canary.** This is **D2's last milestone** — closing it puts D2
> done on M1–M5: operational, a step beyond MVP.

## Why this milestone
M1–M3 and M5 are done; **M4 ("surface + observability *hold*") is partial.** Its three sub-parts today:
tiers (Haiku/Sonnet) hold ✅; nested rendering — the progress bridge *emits* `sub_agent_step` events but
the **full C2 frontend surface treatment is pending**; and **per-child cost/trace attribution is broken**
(all five M3 runs collapsed two `ai_usage_log` rows onto the sandbox child). M4 closes both — the
founder-facing nested surface and clean per-worker observability — which also clears M5's one asterisk
(its "traces paired" claim is only clean once attribution is fixed). Founder decision (2026-07-22): do
the **full** frontend treatment and fix cost attribution **inside M4**. **Generalization (Phase G) is not
part of M4** — it is the deferred gate before wider founder exposure.

## Steps

### A. Full C2 nested-step frontend surface (SDK-M4.1) — founder-facing
1. Extend the C2 streaming surface to render the **nested subagent steps** under the plan panel, grouped
   and **collapsible by `parent_tool_use_id`** (the bridge already emits `sub_agent_step`; this is the
   frontend treatment consuming them). Match the C2 design language: drill-down chips → curated detail
   only, worker status (running / completed / failed), and the **SOURCES rail populating from the
   workers' cited findings**.
2. Locks: **no raw payloads / no raw chain-of-thought**; drill-down stops at curated detail. Additive to
   the SSE contract (no breaking changes). Build against a mock event stream first, then verify live.

### B. Per-child cost/trace attribution fix (SDK-M4.2) — observability
1. Fix the attribution so each worker's `ai_usage_log` rows land on **its own child run** (`parent_run_id`
   → correct child), not collapsed onto the sandbox child. Confirm from data: the five M3 runs (and
   Canary 8 / 9-retry) collapse two rows onto sandbox — a **pre-existing write-side** mis-attribution, not
   an M3 regression. Each worker's cost then reads individually; child traces pair per worker.

### C. Observability hold — verify M4's original bar (SDK-M4.3)
1. Under **model-driven** delegation, confirm all three hold cleanly: nested rendering shows each worker;
   child traces paired to `ai_usage_log` **per worker** (post-fix); tiers correct (Haiku workers / Sonnet
   compose). This is M4's defining "keep working" bar, now met on all three sub-parts.

### D. Proof + close (SDK-M4.4)
1. One dark founder canary on the **pinned anchor** (confirm deployed head first): the nested surface
   renders cleanly (capture a before/after or screenshot), per-child cost attribution is correct (each
   worker's rows on its own child), tiers correct, no raw payloads / no raw CoT. Re-darken immediately.
2. **STOP-and-review with London.** On pass, **D2 is done on M1–M5** — record it: operational, a step
   beyond MVP. Generalization (Phase G) remains the deferred gate before wider exposure.

## Acceptance criteria
1. Full nested-step surface renders under the plan panel (grouped/collapsible by `parent_tool_use_id`), in
   the C2 design language, with SOURCES populating from cited worker findings; no raw payloads / no raw CoT.
2. Per-child cost attribution fixed — each worker's `ai_usage_log` rows on its own child run; no
   two-rows-onto-sandbox collapse; child traces pair per worker.
3. Observability hold verified under model-driven delegation (nested render + per-worker traces + tiers).
4. One dark-canary proof on the pinned anchor: surface + attribution + tiers all clean; re-darkened.
5. Path A retained (dark); native scaffolding **not** pruned; `compileall` clean; frontend build green;
   `04B-D2-M4-COMPLETION.md` + `../../ROADMAP.md`/`../../STATE.md` updated; **D2 recorded done on M1–M5.**
   STOP-and-review with London.

## Hard rules
- Confirm deployed head == SHA + `/api/health ok=true` before the canary; keep `vcso_sdk_loop`
  dark/founder-only (`hicks.london25@gmail.com`), **arm on London's go**, re-darken immediately after.
- Never lose `MCP_TOOL_TIMEOUT=240000`; do not re-add the per-agent `timeout` key; single-process only
  (no `WEB_CONCURRENCY` / `--workers`).
- Version-tagged commits, **always forward** (no reuse). Keep Path A; do not prune native scaffolding.
  Preserve every lock (founder isolation, one-writer, Claude-lock, no model selector, tier authority at
  the capability grain). `vcso_planner` stays retired. **Do not flip defaults or edit the harness-root
  `ROADMAP.md`.** STOP at the checkpoint.

## Deferred / out of scope
- **Mid-stream finding-injection** (`vcso_sdk_loop.py:~1002–1005`, labeled "M4, optional") — stays
  **deferred**: significant machinery, and graceful-compose already makes the timed-out-worker case
  non-fatal. Not in this M4 pass.
- **Generalization** — Phase G, deferred to a future agent + the full-fledged testing pass (the gate
  before wider founder exposure).
- **Real sandbox computation + financial-series storage** — Phase F. **Phases E / F / G** — not started.
- Housekeeping still owed: the two-`v0.6.89` version-collision note in the finish log.
