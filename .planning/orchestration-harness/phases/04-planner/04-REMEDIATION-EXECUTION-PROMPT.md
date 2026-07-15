# Execution Agent Brief — Phase 4 Remediation: Sandbox Compute Worker Hardening

You are the Execution Agent for the **Phase 4 remediation**. The restarted spine validation reached the
P4 gate — the spine mechanism fired correctly (intent strategic → router Tier-1 → planner decomposed
into two parent-linked workers) — but the **sandbox compute worker failed** (missing `scipy`, six Haiku
rounds, no result), and child workers emitted no scoped LangSmith traces. Your job is a **bounded fix**
to the compute worker + its environment + observability, then redeploy dark so validation can restart.
You do **not** change the planner architecture, build new features, or restart the validation yourself.

## Read these first (in order)
1. `.planning/orchestration-harness/phases/04-planner/04-REMEDIATION.md` — the defect, four-part root
   cause, fix scope, acceptance. **Your script.**
2. `phases/04-planner/04-CONTEXT.md` + `04-THIN-SLICE-PROOF.md` + `04-COMPLETION.md` — the planner design
   and the failed-proof evidence.
3. `phases/02-intent-read/02-COMPLETION.md` — the observability fix pattern (scoped LangSmith trace +
   `ai_usage_log` utility row) to **mirror** for the child workers.
4. Live grounding: `sub_agent_orchestrator.py` (`sandbox_execution_agent` handler + round/retry budget),
   `sandbox_service.py`/`sandbox_execution_service.py` + the sandbox image/deps, the sandbox verify
   endpoint, MA-06 `tier_worker`. Supabase `pwacpjqkntnovndhspxt`.

## What you do
1. **Round out the sandbox scientific stack:** add `scipy` (verify `numpy`/`pandas`/`statsmodels`) to
   the sandbox image; re-run the sandbox verify to confirm the imports succeed.
2. **Tighten the sandbox worker round/retry budget:** fail fast on repeated compute errors (a couple of
   rounds, not six); a bounded failure returns a clean "could-not-compute" finding.
3. **Close child-worker observability:** scope the sub-agent worker LangSmith traces so each child call
   pairs a trace with its `ai_usage_log` row (mirror the intent/`afterTurn` fix).
4. *(Secondary, lower priority)* nudge the worker toward the simplest sufficient library + adapt on
   `ImportError`.
5. **Hygiene:** `git rm --cached python-backend/__pycache__/main.cpython-314.pyc
   python-backend/core/__pycache__/config.cpython-314.pyc` (already in `.gitignore`); commit the
   uncommitted `.planning/…md` docs alongside.
6. **Redeploy dark;** confirm the sandbox worker computes the capstone quantities cleanly (sandbox verify
   + a worker smoke). **Report** to London; the validation restart is a separate, founder-authorized step.

## Hard constraints
- **Build dark; `vcso_planner` stays off.** Flag off ⇒ behavior unchanged. Redeploy, do not flip.
- **Do not change the planner architecture.** Decompose→delegate→compose + depth-1 bounding are correct;
  this is a *worker + environment + observability* fix.
- **Bounded + non-recursive** preserved; **Claude-lock**, curated transparency, founder isolation,
  one-writer. Work from live; commit version-tagged.
- **Do not commit `.pyc` bytecode** (untrack it); do not restart the validation.

## Done when
1. Sandbox worker computes the capstone quantities cleanly in ≤ the tightened round cap, returning a
   valid computed result + derivation + citations; sandbox verify passes with `scipy` present.
2. A forced compute error fails fast (bounded) with a clean "could-not-compute" finding.
3. Child worker calls emit scoped LangSmith traces paired with `ai_usage_log` rows.
4. Redeployed dark (`vcso_planner` off, zero enrollment); flag-off behavior unchanged; fail-open
   preserved; the two `.pyc` untracked; the `.planning/…md` docs committed.
5. `python -m compileall python-backend` clean; focused tests pass; `04-COMPLETION.md` + `STATE.md`/
   `ROADMAP.md` updated; `Pro-Suite-Progress.md` noted. Read-back to London; note the validation restart
   (with control reuse per the runbook) is his to authorize.

## Explicitly out of scope
Restarting the batched validation (separate founder-authorized step, with control reuse); the planner
architecture; Phase 5+ (reflect-and-steer / freshness / MCP); enabling any flag; new features. This is a
sandbox compute worker + observability hardening pass — nothing more.
