# Phase 4 Remediation — Sandbox Compute Worker: Environment, Bounding, Observability

**Date:** 2026-07-14 · **Trigger:** the restarted spine validation reached the **P4 gate and the
spine mechanism fired correctly** (P2 strategic 0.97 → P3 Tier-1 stop → P4 decomposed into two depth-1,
parent-linked workers) — but the **sandbox compute worker failed**: it wrote `scipy`-dependent code,
`scipy` is missing from the sandbox, and it burned **six Haiku rounds** with no valid computed result.
Validation was halted and P4 rolled back. Resting state: **P1–P3 canary-on, P4 off**.

**This is a downstream failure, not a planner-architecture failure.** The decompose→delegate machinery
works; the compute *worker* and its environment need hardening.

## Root cause (four parts)

1. **Sandbox environment — missing `scipy`.** The sandbox image has pandas/numpy/matplotlib (per its
   own import smoke) but not `scipy`. The worker's `import scipy` failed.
2. **Worker over-reach + no adaptation.** A client-concentration ratio and a margin trend need only
   basic arithmetic (pandas/numpy, which *are* present). The worker reached for `scipy` unnecessarily and,
   on `ImportError`, did not fall back — it retried the same approach.
3. **Bounding.** Six failed compute rounds is far too many; a failing sandbox computation must fail fast.
4. **Observability.** The child workers emitted `ai_usage_log` rows but **no scoped LangSmith traces** —
   the same class of gap closed for the intent pre-pass in the P2 remediation, now at the sub-agent layer.

## Fix scope (behind `vcso_planner`, still default-off, build dark)

1. **Round out the sandbox scientific stack** — add `scipy` (verify `numpy`/`pandas`/`statsmodels`) to
   the sandbox image so genuine quantitative compute has what it needs; re-run the sandbox verify.
2. **Tighten the sandbox worker's round/retry budget** — fail fast on repeated compute errors (a couple
   of rounds, not six); a bounded failure returns a clean "could-not-compute" finding, not a runaway.
3. **Close child-worker observability** — scope the sub-agent worker LangSmith traces (mirror the
   intent/`afterTurn` fix) so child calls pair a trace with their `ai_usage_log` row.
4. *(Secondary)* nudge the worker toward the **simplest sufficient library** and to **adapt on
   `ImportError`** — lower priority once (1) makes scipy available and (3) caps the rounds.

**Bundled hygiene:** untrack the leftover-tracked bytecode (`git rm --cached
python-backend/__pycache__/main.cpython-314.pyc python-backend/core/__pycache__/config.cpython-314.pyc`;
they are already in `.gitignore`).

## Constraints
- **Build dark:** `vcso_planner` stays default-off; flag off ⇒ behavior unchanged. Redeploy dark.
- **Bounded + non-recursive** worker discipline preserved; depth-1 delegation unchanged.
- **Claude-lock** (workers Haiku, composer Sonnet), curated transparency, founder isolation, one-writer.
  Work from live; commit version-tagged.

## Acceptance criteria
1. The sandbox worker computes the capstone quantities (concentration ratio + margin trend) **cleanly in
   ≤ the tightened round cap**, returning a **valid computed result + derivation + citations**.
2. `scipy` (and the verified scientific stack) is available in the sandbox (sandbox verify passes).
3. A failing compute **fails fast** within the round budget and returns a clean "could-not-compute"
   finding (proof: force a compute error → bounded stop, not six rounds).
4. Child worker LLM calls emit a **scoped LangSmith trace paired with the `ai_usage_log` row**.
5. Redeployed **dark** (`vcso_planner` off, zero enrollment); flag-off behavior unchanged; fail-open
   preserved. The two leftover `.pyc` files untracked.
6. `python -m compileall python-backend` clean; focused tests pass; `04-COMPLETION.md` updated;
   `STATE.md`/`ROADMAP.md` noted.

## After the fix — restart the validation (with control reuse)
Redeploy dark → confirm the sandbox worker computes cleanly (sandbox verify + a worker smoke) → restart
the batched validation. **Control reuse (budget conservation):** the failure was in flag-gated spine
code, which does not run on the control/spine-off path — so **reuse the retained matched control** for
the capstone cost comparison **if** (a) no change since capture touched the flat/spine-off
assembly+retrieval code and (b) the founder's wiki/dataset is unchanged; **re-run only the canary** and
compare to the retained control. Re-establish control only if either changed. (Folded into
`validation/SPINE-VALIDATION-RUNBOOK.md` Step 1.)
