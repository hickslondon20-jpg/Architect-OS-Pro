# Phase 2 Completion - Intent & Depth Read + Adaptive Triage

**Status:** Code complete; calibration/observability remediation deployed live-dark; integrated canary
acceptance and spine-validation restart remain founder-gated

**Implementation commits:** `d2962d15` (`v0.6.16 Orchestration Harness Phase 2 intent triage`) and
`e14f1f24` (`v0.6.23 Calibrate Phase 2 intent classifier`)

**Deployed:** initial dark build 2026-07-13; remediation dark build 2026-07-14 to `origin/main`

## Delivered

- Added a bounded Claude Haiku pre-pass resolved through `tier_worker`, with `role=utility` and
  `capability_key=vcso_intent_read`.
- Implemented the locked five-move taxonomy, shallow/deep classification, confidence threshold,
  deterministic response posture, compact input/output bounds, timeout, `NONE` fail-open behavior,
  and a consecutive-timeout circuit breaker.
- Added nullable per-turn `vcso_chat_messages.intent` JSONB persistence. Intent remains turn
  scaffolding only; it is founder-owned through the existing message RLS and never writes to the KB.
- Injected the deterministic response contract through the existing Phase 1
  `systemPromptAddition` seam. Founder/message/working-state content is explicitly framed as
  untrusted data and is never copied into the contract.
- Reused the Phase 1 assembly path for both profiles. Only high-confidence `lookup` and `ambient`
  may select the lean starting profile; strategic, brainstorm, produce, low-confidence, timeout,
  error, and `NONE` use full assembly. The existing tool loop remains available mid-turn.
- Added a sanitized MA-05 intent/profile step without raw reasoning or chain-of-thought.
- Added `vcso_intent_read` as a separate default-off flag with zero enrollment. No flag was changed
  during deployment.

## Evidence

| Gate | Evidence | Result |
|---|---|---|
| Worker-tier classifier | Unit coverage resolves the pre-pass through worker routing, records utility usage, and persists the sanitized compact result. Live `tier_worker` resolves to Claude Haiku. | Pass |
| Taxonomy and conservative triage | Tests cover lookup/ambient lean eligibility, strategic/brainstorm full-only behavior, produce/full behavior, and low-confidence `NONE`. | Pass |
| Response-contract seam | Test proves the deterministic contract reaches Phase 1 `systemPromptAddition`; no founder payload is copied. | Pass |
| Fail-open and circuit breaker | Forced timeout opens the breaker; malformed/injected output and low confidence return `NONE`, no steering, full assembly. | Pass |
| Flag-off identity | Test proves Phase 2 off returns the exact legacy context object even when an intent is supplied. | Pass |
| Same assembly/tool path | Lean trims only the initial component/budget profile and leaves all existing tools available. | Pass |
| Focused regression suite | `20 passed, 7 skipped`; one pre-existing warning. | Pass |
| Python syntax gate | `python -m compileall -q -x '[/\\](venv|\.venv-kb-nav)[/\\]' python-backend` exited 0; only the ignored pytest-cache listing notice appeared. | Pass |
| Live schema | Migration applied to Supabase `pwacpjqkntnovndhspxt`; `intent` is nullable JSONB and the flag is default-off with `timeout_ms=4000`, breaker threshold 3, confidence threshold 0.80, and lean budget 4500. | Pass |
| Live-dark deploy | `d2962d15` pushed to `origin/main`; production `/api/health` returned HTTP 200. | Pass |
| Flag-off production smoke | Fresh VCSO turn `7ea8a8f4-4b2f-4759-9255-2bfc79b03217` returned and persisted `READY.`. Usage run `94b89889-3930-4051-b7bc-350d190d7566` logged `surface=virtual_cso`, `role=main`, `capability_key=vcso_chat`, 6,696 input / 6 output tokens. The user message intent was null. | Pass |
| Live flag state | `vcso_intent_read`: disabled, global off, zero test users. `vcso_working_state_assembly`: enabled, global off, one founder canary. | Pass; unchanged |
| Mixed-intent cost + quality proof | Requires founder-gated Phase 2 canary enrollment and paired LangSmith/usage/output evidence. | Deferred/gated |

## 2026-07-14 Remediation — calibration + scoped observability

The first batched P1–P4 validation halted correctly at the P2 gate. On thread
`e1f82344-6e9f-4c95-bf38-599bd1159dfa`, Haiku ran but persisted `NONE / low_confidence` for the
canonical concentration-plus-margin prompt. The fallback stayed conservative (`full` assembly, no
planner), proving a calibration defect rather than an execution or gate defect.

`v0.6.23` calibrates the classifier generally with explicit taxonomy boundaries, varied exemplars,
and the rule that confidence measures label certainty rather than evidence sufficiency. A reproducible
14-case eval covers seven strategic/decompose prompts and seven controls across lookup, document read,
brainstorm, produce, and ambient moves. The exact capstone classified
`strategic_synthesis / deep / 0.97`. All 14 labels were correct. At the retained 0.80 threshold,
should-decompose precision was **100%** and recall was **100%** (7 TP, 0 FP, 0 FN). Sweeps at 0.75,
0.80, 0.85, and 0.90 produced the same precision/recall, so the live threshold remains the original
conservative **0.80**. No deterministic marker fallback was added.

The observability investigation corrected the initial diagnosis: the failed turn already had a
Haiku `ai_usage_log` utility row, but no scoped LangSmith trace. Anthropic `with_options()` returned a
new raw client and dropped the wrapper. The remediation re-wraps that bounded client before the
scoped call. Production-backed proof run `ebdfdb7e-fe8c-4cee-b919-33f0adc4369f` produced LangSmith
trace `019f628a-d447-7d02-8c74-4135adc9e22f` and usage row
`fdb39349-f8d1-4545-a9a6-323866246728`, both at **693 input / 54 output** tokens with matching founder,
thread, capability, run ID, and Haiku model.

Verification:

- P1–P4 focused regression: **41 passed**; one existing LangSmith deprecation warning.
- `python -m compileall -q -x '[/\\](venv|\.venv-kb-nav)[/\\]' python-backend`: exit 0; only the
  known inaccessible `.pytest_cache` listing notice.
- Production `/api/health`: HTTP 200 after `e14f1f24` deployment.
- Post-deploy dark smoke thread `9029b443-faf0-4b9d-9abd-454cd663a872` returned `READY.`, persisted
  `intent = null`, and emitted no `vcso_intent_read` usage row.
- Live `vcso_intent_read`: `is_enabled=false`, `test_user_ids=[]`, `enabled_for_all=false`, threshold
  0.80. No flag was flipped during remediation.

## Acceptance Read

- **INT-1 implementation:** complete. The pre-pass is worker-tier, bounded, compact-or-`NONE`,
  persisted per turn when enabled, and circuit-breakered.
- **INT-3 implementation:** complete. The response contract reaches the Phase 1 seam; injection
  hygiene, flag-off identity, and forced-timeout fail-open behavior are covered.
- **INT-2 implementation:** complete. Conservative adaptive triage is enforced and locally verified.
- **Remediation acceptance is complete:** calibration, paired trace/usage accounting, dark deployment,
  flag-off identity, and fail-open behavior pass.
- **Phase integrated acceptance remains open:** restarting the batched validation from a fresh matched
  control is a separate London authorization. The remediation does not enroll the canary or authorize
  a default flip.

## Carry-Forward Gates

1. Complete the Phase 1 Stage 1 observation gate and separate Stage 1-to-2 decision.
2. On London's explicit go, restart the batched P1–P4 validation from a fresh matched control; the
   prior partial run is void.
3. Enroll only the named Phase 2/P4 canary inside that runbook sequence without changing the global
   default, then pair LangSmith traces with `ai_usage_log`, persisted intent, assembly profile,
   planner lineage, cost, and output-quality review.
4. Confirm no strategic/brainstorm turn selected lean and that simple-turn net savings remain material
   after including Haiku pre-pass cost.
5. Return the cost/quality proof to London for the separate default-flip decision.

No Phase 3/4/5+ behavior changed, no classifier gate was weakened, and validation was not restarted.
