# Execution Agent Brief — Phase 2 Remediation: Intent Classifier Calibration + Observability

You are the Execution Agent for the **Phase 2 remediation**. The spine validation halted at the P2 gate:
the intent classifier judged the canonical strategic prompt below the confidence threshold → the planner
never fired. Your job is a **bounded fix** — calibrate the classifier (generally, via an eval set) and
close the observability gap — then redeploy dark so the batched validation can restart. You do **not**
build new features, weaken the gate, or restart the validation yourself.

## Read these first (in order)
1. `.planning/orchestration-harness/phases/02-intent-read/02-REMEDIATION.md` — the defect, confirmed
   root cause (calibration, not error), the two fixes, the eval-set discipline, acceptance. **Your script.**
2. `phases/02-intent-read/02-CONTEXT.md` + `02-COMPLETION.md` — the original P2 design (locked taxonomy,
   the `vcso_intent_read` flag, the worker-tier classifier).
3. `phases/01-working-state-memory/01-COMPLETION.md` — the `afterTurn` worker's `ai_usage_log`/trace
   pattern to **mirror** for the intent pre-pass (the observability fix).
4. Live grounding: the intent pre-pass in `vcso_chat_service.py`, the `vcso_intent_read` flag settings
   (`confidence_threshold=0.8`, `max_tokens=220`, etc.), MA-06 `tier_worker`. Supabase `pwacpjqkntnovndhspxt`.

## What you do
1. **Confirm the root cause** on the failing thread: the classifier ran and returned `low_confidence`
   (per `vcso_chat_messages.intent`); confirm it's calibration, not an execution bug.
2. **Calibration fix (general):** build the eval set (~10–15 prompts: strategic incl. the exact capstone,
   + non-strategic controls) with expected labels; tune the **classifier prompt/exemplars + the
   `confidence_threshold` together** so strategic reliably clears the bar and non-strategic stays below;
   **report precision/recall on "should-decompose."** Do **not** overfit to the capstone prompt; do
   **not** weaken the conservative gate.
3. **Observability fix:** make the intent pre-pass emit a scoped LangSmith trace + `ai_usage_log`
   utility row (`capability_key=vcso_intent_read`, `role=utility`, Haiku), mirroring `afterTurn`.
4. **Redeploy dark:** `vcso_intent_read` stays default-off, zero enrollment; flag-off behavior unchanged.
5. **Report** the eval results + the fix to London; the batched validation restart is a **separate,
   founder-authorized** step (do not restart it).

## Hard constraints
- **Build dark; flag stays off.** Flag off ⇒ behavior byte-for-byte unchanged. Redeploy, do not flip.
- **Fix generally, not for one prompt.** The eval set is the guardrail against overfitting.
- **Gate stays conservative.** Low-confidence → NONE → full safe assembly is correct; you're raising the
  classifier's *confidence on genuinely strategic prompts*, not lowering the bar to force a pass.
- **Fallback only if needed:** a lightweight deterministic strategic-marker pre-signal — flag it, don't
  add pre-emptively.
- **Preserve locks:** Claude-lock (Haiku classifier), curated transparency, founder isolation,
  one-writer. Work from live; commit version-tagged.

## Done when
1. Eval set passes: strategic prompts (**incl. the exact capstone**) → `strategic_synthesis`+`deep` at
   confidence ≥ threshold; non-strategic → correct, no planner gate crossed; precision/recall reported.
2. Intent pre-pass emits a scoped LangSmith trace **and** an `ai_usage_log` utility row (verified live).
3. Redeployed dark (`vcso_intent_read` off, zero enrollment); flag-off behavior unchanged; fail-open
   preserved.
4. `python -m compileall python-backend` clean; focused tests pass; `02-COMPLETION.md` + `STATE.md`/
   `ROADMAP.md` updated; `Pro-Suite-Progress.md` noted. Read-back to London, flagging that the batched
   validation restart is his to authorize.

## Explicitly out of scope
Restarting the batched validation (separate founder-authorized step); any Phase 3/4/5+ change; enabling
`vcso_intent_read` or any flag; weakening the planner gate; new features. This is a calibration +
observability fix to Phase 2 — nothing more.
