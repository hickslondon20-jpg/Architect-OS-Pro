# Execution Agent Brief — Spine Validation (Batched Proof, P1–P4)

You are the Execution Agent for the **batched validation pass** of the Orchestration Harness — proving
the full built-dark spine (**P1 working-state → P2 intent → P3 router → P4 planner**) together on the
founder canary, then paying down all deferred proof-debt. You run the pass; you do **not** build new
features or start Phase 5+.

## Read these first (in order)
1. `.planning/orchestration-harness/validation/SPINE-VALIDATION-RUNBOOK.md` — the ordered pass you
   execute (steps, flag SQL, proof set, verification, gates, rollback, monitoring). **This is your script.**
2. `.planning/orchestration-harness/CONTEXT.md` + `STATE.md` — the workstream state and carry-forwards.
3. The four phase `0X-COMPLETION.md` files (P1–P4) — what each layer proved individually.
4. Each phase's flag: `vcso_working_state_assembly`, `vcso_intent_read`, `vcso_source_router`,
   `vcso_planner` (all `platform_ai_settings`, Phase-1 flag shape). Supabase `pwacpjqkntnovndhspxt`.

## What you do
1. **Step 0 — deploy P4 dark (authorized):** push `67d7acd2` to `origin/main`; verify health 200, a
   smoke turn still logs `virtual_cso`, `vcso_planner` still off. Red deploy → halt + report.
2. **Step 1 — control baseline:** capture the flat-path (spine-off) control run of the capstone
   strategic question (use the same control mechanism as the Phase 3 proof).
3. **Step 2 — enable the full spine for the canary** (P1–P4 `is_enabled=true`, canary in `test_user_ids`,
   `enabled_for_all=false`, `annotations_enabled=false`); verify each row.
4. **Step 3 — coordinate the proof set with London** (he drives the ~6 VCSO turns across 2 threads per
   the runbook). Do not fabricate turns.
5. **Step 4 — verify per turn** from DB + LangSmith: intent recorded, routing recorded, planner
   decomposition + ≥2 workers with `parent_run_id`, workers on Haiku / composer on Sonnet, independent
   parent/child cost attribution, sandbox worker computed result, working-state carry, the capstone
   cost delta vs. control (strategic now cheaper — closing the Phase 3 carry-forward), all answers cited/
   on-voice, sanitized MA-05 rendering.
6. **Step 5 — deliver the integrated evidence table to London** as the cost-routing stop-and-review
   checkpoint. **Do not** broaden or flip `enabled_for_all` until London reviews.

## Hard constraints
- **Follow the runbook order.** Deploy dark → control → enable canary → prove → checkpoint. No
  `enabled_for_all` and no Phase 5+ work before the stop-and-review.
- **London drives the turns.** You deploy, flip flags, and verify — you do not invent proof turns.
- **Every claim = LangSmith trace + DB/output.** Traces are necessary, not sufficient.
- **Fail-open + rollback ready.** Any layer misbehaving → roll that flag back (runbook Rollback); each is
  fail-open, no deploy needed.
- **Preserve the locks:** founder isolation, curated transparency (no raw CoT), one-writer, Claude-lock.
  `annotations_enabled` stays off. Work from live; commit version-tagged for any doc/evidence updates.

## Done when
1. P4 deployed dark; spine enabled for the canary; the ~6-turn integrated proof set run.
2. Per-turn verification complete (intent/route/plan/working-state/attribution/cost/quality/transparency),
   paired LangSmith + DB.
3. The capstone runs end-to-end (intent → decompose → ≥2 workers incl. sandbox compute → compose) with
   independent parent/child attribution and a cited resolved answer; strategic cost is **lower than the
   control** (Phase 3 carry-forward closed).
4. The integrated evidence table + stop-and-review delivered to London; no broadening / no
   `enabled_for_all` before review.
5. On London's go (Step 6): broad rollout applied; Phases 1–4 marked Done in `ROADMAP.md`/`STATE.md`/
   `Pro-Suite-Progress.md` + `0X-COMPLETION.md`; a `validation/VALIDATION-REPORT.md` written; workstream
   carry-forwards closed.

## Out of scope
Phase 5 (reflect-and-steer / freshness / MCP), Phase 6 (generalize / enable disabled workers), Phase 7
(verification); enabling annotations; any new feature. This pass validates and rolls out the existing
spine — nothing more.
