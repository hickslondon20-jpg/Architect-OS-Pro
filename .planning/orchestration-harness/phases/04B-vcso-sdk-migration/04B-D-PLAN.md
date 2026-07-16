# Phase D Plan — Native Subagents (the P4 Re-Approach) — CHECKPOINT

> Read `../../CONTEXT.md` + `../../ROADMAP.md` and this folder's `CONTEXT.md` + `ROADMAP.md` first.
> Covers **SDK-D1..D6**. This is the re-approach to the harness Phase 4 planner that **failed restart 2
> on 2026-07-15** (decomposition omitted the mandatory sandbox child). **STOP-and-review checkpoint with
> London before broadening.** Behind the flag; parallel; budget/depth capped.

## Deliverable
The decompose→delegate→compose turn on **SDK-native subagents** (per-agent tools + model,
`parent_tool_use_id`), reusing the 7 bounded capability handlers as subagent implementations, with
effort-scaling and explicit delegation contracts in the lead prompt — proven on the P4 thin-slice
strategic question, correctly spawning **both** the mandatory structured-data **and** sandbox children,
plan + workers visible via MA-05 (with nested subagent steps rendered natively in the C2 surface),
correct tiers, caps enforced.

## Steps

### A. Native subagents replace bespoke plumbing (SDK-D1/D2)
1. Replace the planner futures/heartbeats + generic orchestration plumbing with SDK subagents. **Keep**
   the 7 capability *handlers* (`document_analysis`, `structured_data`, `kb_explorer`,
   `sandbox_execution`, `per_user_wiki`, `per_user_document_wiki`, `global_ip`) as the subagent
   implementations/tools; scope each subagent's tools + model via the Phase C compiler.
2. Retire or refactor `_run_planner_or_none` onto the SDK-native path (resolves Q5).

### B. Delegation that doesn't drop children (SDK-D3) — the actual P4 fix
1. Encode **effort-scaling** in the lead prompt (scale to query complexity; simple turns answer
   directly, no decomposition). Teach the orchestrator to delegate with **explicit task contracts**
   (objective, output format, tools/sources, boundaries) — the multi-agent-writeup fix for the exact
   defect where decomposition created only one child and dropped sandbox compute.
2. Reflect-and-steer stays a first-class terminal mode inside the SDK loop.

### C. Guardrails (SDK-D4)
1. Enforce per-turn budget + delegation depth cap; **one** controlled level of sub-delegation, no
   recursion; bounded, founder-isolated workers.

### D. Thin-slice proof + checkpoint (SDK-D5/D6)
1. Run the P4 thin-slice strategic question (see `../04-planner/04-THIN-SLICE-PROOF.md`) end-to-end on
   the SDK path. It **must** decompose correctly — spawning the mandatory structured-data **and**
   sandbox children — with plan + workers visible via MA-05 and correct tiers (Sonnet compose / Haiku
   workers per MA-06).
2. **STOP.** Bring the proof (plan, worker runs, tiers, cost, quality, traces paired to usage rows) to
   London for the go/no-go **before** any broadening.

### E. Streaming surface extension — render the nested workers (C2 follow-on)
1. Extend the Phase C2 streaming surface to render **nested subagent steps** under the plan panel
   (grouped by `parent_tool_use_id`, **collapsible** so the plan stays scannable as workers nest) and to
   **populate the SOURCES panel** from the workers' cited findings. This is a **visual extension**
   consuming the new subagent events — same locks (no raw payloads / no raw CoT; drill-down to curated
   detail only).
2. Land it **with** the backend subagent events so D never ships events the C2 surface renders flatly.
   The C2 out-of-scope note deferred this exactly here — this is where it comes due.

## Acceptance criteria
1. SDK-native subagents run the turn; the 7 handlers reused; no bespoke planner plumbing on the SDK path.
2. Effort-scaling gates decomposition (a simple lookup answers directly; a genuine multi-part synthesis
   decomposes).
3. The P4 thin-slice question spawns **both** required children; plan + workers visible via MA-05; tiers
   correct; budget/depth caps enforced.
4. Traces paired to `ai_usage_log`; founder isolation intact.
5. **Nested subagent steps render natively** under the plan panel (grouped/collapsible by
   `parent_tool_use_id`); SOURCES populates from cited worker findings; no raw payloads / no raw CoT.
6. **Founder checkpoint reached and passed** before broadening.
7. `compileall` clean; frontend build green; `ROADMAP.md`/`STATE.md` + `04B-D-COMPLETION.md` updated.
   Read-back to London.

## Out of scope
Sessions / Deep Mode (E); live MCP (F); generalization across all question types + domain agents (G);
retiring the hand-rolled path (G). Do not broaden past the thin-slice before the checkpoint.
