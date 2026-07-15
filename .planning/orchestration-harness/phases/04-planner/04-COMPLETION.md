# Phase 4 Completion — Planner (Decompose → Delegate → Compose)

**Implementation status:** Planner code remains complete; the bounded sandbox-worker remediation was
deployed dark on 2026-07-14. P4 remains disabled with zero enrollment.
**Version:** v0.6.22 planner; v0.6.26 sandbox/observability remediation.
**Validation status:** The London-authorized restart ran on 2026-07-15 and halted again before turn 2.
Intent, Tier-1 routing, working-state persistence, citations, and scoped main/decompose traces passed,
but Sonnet decomposition generated only one structured-data child and omitted the mandatory sandbox
child. PLAN-5 remains open and P4 is rolled back to dark with zero enrollment.

## Delivered

- Added the separate `vcso_planner` flow. Its runtime entry gate requires a persisted Phase 2 intent
  of `strategic_synthesis`, depth `deep`, and threshold confidence. When Phase 2 is absent/off,
  confidence is low, intent is non-strategic, or planner execution errors, the existing Phase 3/flat
  path remains authoritative.
- Added synthesis-tier decomposition into explicit source/worker-bound sub-questions with bounded
  mid-turn revisions. Runtime code, not prompt text, caps sub-questions, rounds, depth, estimated
  spend, finding bytes, and compose context.
- Reused `sub_agent_orchestrator` and its seven existing handlers. Planner children persist beneath
  the VCSO parent via `parent_run_id`, are fixed at depth 1/non-recursive, and use the MA-06 worker
  tier without changing normal worker routing outside the planner.
- Hardened the planner-scoped worker return contract to summary, claims, evidence/citations,
  provenance, and confidence. Oversized output is normalized and capped before compose. The existing
  sandbox handler additionally returns computed result, derivation, and inherited citations when
  called by the planner.
- Added a planner-only Phase 3 worker binding for founder-owned ready dataset metadata. Structured
  data gathers the evidence; sandbox compute receives the compact cited prior finding rather than a
  raw dataset dump.
- Added synthesis-tier compose through the Phase 1 `assemble()` seam using working state and compact
  findings only. Compose has no source/tool access and requires cited claims.
- Reused MA-05's parent/child trace shape for an explicit sanitized plan and nested worker steps.
  Raw reasoning remains absent; one-writer, founder isolation, and existing tool permissions are
  unchanged.
- Added the default-off `vcso_planner` Phase-1-shape migration and applied that additive config row to
  Supabase project `pwacpjqkntnovndhspxt`. Verified live: `is_enabled=false`,
  `default=false`, `enabled_for_all=false`, and zero allowlisted founders.

## Acceptance evidence available now

| Requirement | Implementation evidence | Current status |
|---|---|---|
| PLAN-1 | Conservative strategic+deep entry gate; explicit capped/revisable plan; P3 worker bindings | Passed locally |
| PLAN-2 | Existing orchestrator; depth-1 parent-linked children; worker-tier override; compact cited schema; sandbox compute fields | Passed locally and live substrate verified |
| PLAN-3 | Phase 1 assembly over compact findings; tool-free synthesis-tier compose; citation requirement | Passed locally |
| PLAN-4 | Runtime caps, non-recursion rejection, bounded partial compose, planner-error flat fallback, sanitized nesting | Passed locally |
| PLAN-5 | Integrated capstone and evidence table in `04-THIN-SLICE-PROOF.md` | Failed twice; restart 2 omitted mandatory sandbox child |

Focused remediation/regression result: **46 passed**. `python -m compileall python-backend` exited
cleanly. No frontend files were changed, so the conditional frontend build was not required.

## Sandbox-worker remediation — v0.6.26

- Restored the versioned sandbox image source and published
  `sandbox-python:2026-07-14-p4-remediation`; `latest` resolves to digest
  `sha256:6b726090f70ffb6801eeaa58f70f9eac37af3020e64c4fba4f755a34c78cda26`.
- Added `scipy` and `statsmodels` alongside numpy/pandas. The protected production `imports` verify
  returned `status=ok`, exit code 0, `all imports OK`, and no stderr.
- Capped the sandbox model loop at two rounds in code and live `agent_capabilities.default_config`.
  Repeated compute failures now return `status=could_not_compute`, `needs_review=true`, no
  `computed_result`, and a clean bounded finding.
- Carried a maximum of 20 founder-scoped numeric dataset rows into the existing compact structured
  finding. The planner architecture, depth-1 boundary, and one-writer compose path are unchanged.
- Scoped sandbox, KB Explorer, and document-analysis child LLM calls with user/thread/run/capability
  metadata before the paired `ai_usage_log` write.
- Successful production worker smoke `29063008-901a-459b-840c-e4055fc67637` completed in two rounds
  and computed 40.0% concentration, 18.0% current margin, and -6.0 percentage points. LangSmith traces
  `099019ce-1b9d-44dd-8c66-5c267dcb5a60` (1322/668) and
  `dd50ef73-ff45-459e-a586-49536bf4f804` (2518/549) exactly match its two usage rows.
- Forced-error smoke `2d86ac1d-9bc0-4a37-b186-1e2fb1f4e008` stopped after two rounds with the clean
  `could_not_compute` finding. LangSmith traces `0dd4715c-db64-4f5a-bdb7-c0e79660b4df`
  (1301/116) and `1dd8d17d-4067-43ef-bb4e-79ed663a310a` (1967/101) exactly match its two usage rows.
- Focused tests additionally prove planner-scoped `computed_result` + derivation and inherited
  founder-dataset citations. The standalone production worker smoke intentionally has no parent
  finding, so live inherited-citation proof remains part of the London-authorized PLAN-5 restart.
- Railway shows v0.6.26 active; production health is 200. `vcso_planner` reads back disabled,
  `test_user_ids=[]`, and `enabled_for_all=false`. No validation turn or flag flip was performed.
- Removed the two tracked `.pyc` artifacts; `__pycache__` remains ignored.

## Failed live capstone and remaining gates

- The approved P1–P4 canary sequence and matched flat control were captured.
- The hard founder question reached intent → plan → two workers, but the sandbox worker exhausted
  six rounds after execution errors including missing `scipy`; it returned a bounded fallback rather
  than a concentration/margin computation.
- Parent/child DB lineage and Haiku usage attribution exist, but scoped LangSmith traces were not
  found for either child run ID.
- The worker-level forced-error and observability defects are closed by the evidence above. Re-run
  the integrated capstone, inherited-citation/Haiku routing proof, cap-hit control, and remaining proof
  set only after London authorizes the validation restart.
- Deliver the cost/quality/transparency/attribution read-back and stop for London.

The 2026-07-15 restart is recorded in `04-THIN-SLICE-PROOF.md`. Parent run
`69303f3d-27db-4da6-866a-544fbb1d7de6` used Sonnet for decomposition but created only child
`2efb36d6-62b7-405b-9ba1-267aeae42abf` (`structured_data_agent`). No sandbox run exists. Five scoped
LangSmith traces match the intent, decompose, and three main-loop database rows exactly; the P1
`afterTurn` usage row has no matching trace. Sonnet input was 27.1% below the retained control, but
the cost carry-forward remains open because the required
planner path did not complete.

P4 is disabled and unenrolled. P1/P2/P3 remain founder canaries; global enablement and annotations
remain off. No stop-and-review, later-phase work, new handler, external source, freshness policy, MCP
integration, reflect-and-steer behavior, or generalization was performed.
