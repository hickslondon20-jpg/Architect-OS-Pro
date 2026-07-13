# Phase 2 Completion - Intent & Depth Read + Adaptive Triage

**Status:** Code complete and live-dark; canary cost/quality acceptance pending founder-gated enablement

**Implementation commit:** `d2962d15` (`v0.6.16 Orchestration Harness Phase 2 intent triage`)

**Deployed:** 2026-07-13 to `origin/main`

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

## Acceptance Read

- **INT-1 implementation:** complete. The pre-pass is worker-tier, bounded, compact-or-`NONE`,
  persisted per turn when enabled, and circuit-breakered.
- **INT-3 implementation:** complete. The response contract reaches the Phase 1 seam; injection
  hygiene, flag-off identity, and forced-timeout fail-open behavior are covered.
- **INT-2 implementation:** complete. Conservative adaptive triage is enforced and locally verified.
- **Phase acceptance remains open:** the live mixed-intent cost/quality proof cannot be gathered while
  `vcso_intent_read` has zero enrollment. Per founder direction, deploying dark code does not advance
  either canary and does not authorize the Phase 2 flip.

## Carry-Forward Gates

1. Complete the Phase 1 Stage 1 observation gate and separate Stage 1-to-2 decision.
2. At a later founder-approved checkpoint, enroll only the named Phase 2 canary without changing the
   default or global state.
3. Run the fixed mixed-intent set and pair LangSmith traces with `ai_usage_log`, persisted intent,
   assembly-profile token counts, and output-quality review.
4. Confirm no strategic/brainstorm turn selected lean and that simple-turn net savings remain material
   after including Haiku pre-pass cost.
5. Return the cost/quality proof to London for the separate default-flip decision.

No Phase 3 router, tool/source selection, tier escalation, decomposition, or delegation work was
started.
