# 04B Composer Output-Integrity Gate — Completion

**Status:** COMPLETE on the live dark stack; **STOP-and-review with London**. Phase E has not started.

**PATCH:** `f3d83ec2` — `v0.6.117 Enforce VCSO composer output integrity`  
**Deployed:** Railway + Vercel green; two cache-busted `/api/health` reads returned `ok=true`,
`commit_sha_short=f3d83ec2`. Local `HEAD`, `main`, `origin/main`, and Railway agree.

## Outcome

The shared VCSO compose/emission seam now fails closed when a founder asks for a new quantitative
derivation:

- no successful, cited `sandbox_execution_agent` result -> founder receives **"I cannot compute from
  current data..."**;
- `could_not_compute` / `needs_review=true` remains degraded through the existing v0.6.116
  `semantic_worker_status` classification and cannot authorize arithmetic;
- successful compute must carry citations, and the composed answer must include a citation marker;
- compute-sensitive answer tokens are buffered until the final gate, so rejected arithmetic is never
  emitted before the returned answer is replaced;
- non-compute turns keep their existing real token stream;
- direct cited retrieval and qualitative advice remain unchanged;
- capability selection and routing are untouched. Native-reasoning-first remains intact.

Code pointers:

- shared prompt contract: `python-backend/services/vcso_chat_service.py:124`;
- raw founder question supplied to the integrity classifier: `vcso_chat_service.py:765`;
- Path-A mandatory-worker fail-open remains intact: `vcso_sdk_loop.py:1970`;
- common `answer_text` seam: `vcso_sdk_loop.py:2401`;
- lifecycle decision `composer_integrity_gate`: `vcso_sdk_loop.py:2433`.

## Reproduced first

The pre-fix faithful Path-A fail-open harness returned the fabricated A1 arithmetic unchanged for both
a thrown worker failure and the v0.6.116 degraded result:

> margin falls 20%; runway drops to 8.7 months; based on $45k monthly revenue

The reproduction test passed twice before enforcement was added, demonstrating the defect rather than
inferring it from source.

The live rows that motivated and anchor the reproduction remain:

| Evidence | Row pointer | Observed fact |
|---|---|---|
| A1 run 1 parent | `agent_delegation_runs.id=f9657258-ff41-41f3-992a-be855166c7eb` | parent asserted the full scenario table |
| A1 run 1 sandbox child | `agent_delegation_runs.id=c768c2a7-f69b-4ba8-a948-b3c3345d84c0` | `status=could_not_compute`, `needs_review=true`; no valid scenario result |
| A1 run 1 structured child | `agent_delegation_runs.id=bd894d29-4093-41eb-9877-85c7d31c0d6e` | only the single seed June P&L row was available |
| A1 run 2 parent | `agent_delegation_runs.id=dc6b6e55-d4e0-4d4d-98fc-976f05fbde9c` | structured-only; composer supplied assumption math |
| A1 run 2 structured child | `agent_delegation_runs.id=4c687c05-4c6b-4f6f-8a09-1116e11c1c2e` | no sandbox child; seed P&L only |

## Fixed proof

Focused verification:

```text
90 passed
python -m compileall: clean
```

Integration cases:

| Case | Proof |
|---|---|
| no compute -> refuse | model-driven zero-worker A1 returned only the refusal; fabricated `20%`, `8.7`, and `$45k` never appeared in emitted events |
| compute present -> cite | successful non-degraded sandbox result with citations passed a cited `12% [1]` answer |
| cited retrieval -> pass | stored `$480k [economic_foundation]` plus qualitative guidance passed unchanged |
| degraded compute -> refuse | Path-A `could_not_compute` fail-open returned only the refusal; no substitute arithmetic |

Rule 10 reliability bar:

- model-driven missing-compute A1: **5/5 consecutive**;
- Path-A degraded-compute fail-open A1: **5/5 consecutive**.

Test pointers:

- `python-backend/unit_tests/test_vcso_sdk_loop.py`;
- `python-backend/integration_tests/test_vcso_composer_integrity.py:125`;
- successful compute: `test_vcso_composer_integrity.py:157`;
- honest retrieval: `test_vcso_composer_integrity.py:198`;
- degraded Path-A fail-open: `test_vcso_composer_integrity.py:227`.

## Live dark readback

After deployment:

| Setting | Readback |
|---|---|
| `vcso_sdk_loop` | `is_enabled=false`; `enabled_for_all=false`; `default=false` |
| SDK allowlists | `test_user_ids=[]`; `diagnostic_user_ids=[]` |
| model-driven | `native_model_driven_enabled=false` |
| diagnostics | single-worker, fault-injection, stream-drop, stream-disconnect, and cross-worker-probe all `false` |
| `vcso_planner` | `is_enabled=false`; `enabled_for_all=false`; `default=false`; `test_user_ids=[]` |

No flag was armed, no canary was run, no routing/capability-selection logic changed, and the
harness-root `ROADMAP.md` was not touched. `MCP_TOOL_TIMEOUT=240000`, single-process deployment, the
one-writer boundary, founder isolation, bounded non-recursive workers, tier authority, curated
transparency, and the never-move-money lock remain unchanged.

## Deviation

The first placement of the isolated integration suite under `python-backend/tests/` inherited an
unrelated live wiki-auth cleanup fixture and reported skips under sandboxed network access. The suite
was moved to `python-backend/integration_tests/`, rerun without live-data side effects, and passed
12/12. No skipped test is counted as proof.

## London checkpoint

Composer integrity is code-complete, deployed, healthy, and dark with reproduced-then-fixed evidence.
**STOP here. London reviews this gate before Phase E begins.**
