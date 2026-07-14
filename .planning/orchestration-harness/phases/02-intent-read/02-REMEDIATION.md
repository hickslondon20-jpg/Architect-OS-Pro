# Phase 2 Remediation — Intent Classifier Calibration + Observability

**Date:** 2026-07-14 · **Trigger:** the spine validation pass halted at the **P2 gate** — the canonical
strategic capstone prompt classified as `NONE / low_confidence` instead of `strategic_synthesis+deep`,
so the planner never fired and the capstone never ran. Validation was rolled back; resting state is
**P1+P3 canary-on, P2+P4 off**.

## What the diagnostic established (root cause)

The recorded intent for the failing turn was:
`{status: none, failure_reason: low_confidence, classifier_model: claude-haiku-4-5-20251001,
assembly_profile: full}`. So:

- **The classifier RAN** (it has a `run_id` + model + self-reported confidence). This is a
  **calibration** problem — Haiku judged a clearly-strategic question *below the 0.8 confidence
  threshold* — **not an execution error.**
- **The conservative gate behaved correctly.** Low-confidence → NONE → full safe assembly → no planner
  is the intended safety behavior. **We fix the classifier's confidence, not the gate.**
- **Secondary defect (observability):** the intent pre-pass **ran but emitted no scoped LangSmith trace
  and no `ai_usage_log` utility row** (unlike the `afterTurn` worker). Its cost is currently unaccounted.

## Fix scope (two items; behind the existing `vcso_intent_read` flag, still default-off, build dark)

### 1. Calibration — fix *generally*, not for one prompt
- **Build a small eval set** (~10–15 prompts) with expected labels:
  - **Strategic (should decompose):** ~6–10 varied phrasings — the capstone
    ("concentration climbing while margin compresses — what should I do"), "how do these two metrics
    connect," "what's the tradeoff between X and Y," "what should I prioritize given constraint Z," etc.
  - **Non-strategic (should NOT decompose):** ~4–6 controls — a Tier-0 record lookup, a document read,
    a brainstorm, an ambient statement.
- **Tune the classifier prompt/exemplars *and* the `confidence_threshold` (0.8) together** so strategic
  prompts reliably clear the bar **and** non-strategic prompts stay below it — **false positives cost
  money** (the planner over-firing), so both directions matter. Report **precision/recall on
  "should-decompose"** over the eval set.
- **Do not overfit** to the capstone prompt, and **do not weaken the conservative gate** — the gate
  stays; the classifier's confidence gets calibrated.

### 2. Observability — account the classifier's cost
- Make the intent pre-pass emit a **scoped LangSmith trace + `ai_usage_log` utility row**
  (`capability_key=vcso_intent_read`, `role=utility`, Haiku), mirroring the `afterTurn` worker.

### Fallback (only if tuning can't make Haiku reliable)
- A lightweight **deterministic pre-signal** for obvious strategic markers, feeding/augmenting the
  classifier (worker-tier, simple). Flag it if needed; do **not** add pre-emptively.

## Constraints
- **Build dark:** `vcso_intent_read` stays default-off; flag off ⇒ behavior unchanged. Redeploy dark.
- **Gate stays conservative;** don't lower rigor to force a pass — earn the confidence.
- **Claude-lock** (Haiku classifier), curated transparency, founder isolation, one-writer. Work from
  live; commit version-tagged.

## Acceptance criteria
1. On the eval set: strategic prompts (**incl. the exact capstone prompt**) classify
   `strategic_synthesis`+`deep` at confidence **≥ threshold**; non-strategic classify correctly and do
   **not** cross the planner gate. Precision/recall on "should-decompose" reported.
2. The intent pre-pass emits a scoped LangSmith trace **and** an `ai_usage_log` utility row for a live
   test turn (observability gap closed).
3. Redeployed **dark** (`vcso_intent_read` still off, zero enrollment); flag-off behavior unchanged;
   fail-open preserved (error/low-confidence → NONE → full assembly).
4. `python -m compileall python-backend` clean; focused tests pass; `02-COMPLETION.md` updated with the
   remediation + eval results; `STATE.md`/`ROADMAP.md` noted.

## After the fix — restart the validation
Once the fix is **deployed dark and the eval set passes (capstone → strategic+confident)**, the
**batched validation restarts from a fresh matched control** (`validation/SPINE-VALIDATION-RUNBOOK.md`
Step 0/1). The prior partial run is void (rolled back); the 28.3% P1+P3 cost result stands as a data
point, but the integrated spine + capstone must re-run clean.
