---
status: awaiting_human_verify
trigger: "Fix failure propagation and run-attribution persistence after A1 G-gate canary."
created: 2026-07-23
updated: 2026-07-23T21:42:00Z
---

# Symptoms

## Expected behavior

- A worker result with `structured_result.status = could_not_compute` or
  `needs_review = true` must propagate as a failure/degraded result to the
  parent composer and founder-facing progress.
- The parent must not present computed claims as successfully proven when the
  sandbox worker did not produce them.
- Every G-gate parent run must persist the exact armed attribution:
  `sdk_phase`, `native_subagent_scope`, `delegation_selection`,
  `available_subagents`, and `required_subagents`.

## Actual behavior

- A1 parent run `f9657258-ff41-41f3-992a-be855166c7eb` displayed and persisted a
  completed answer with numeric scenario claims.
- Sandbox child `c768c2a7-f69b-4ba8-a948-b3c3345d84c0` persisted
  `structured_result.status = could_not_compute`, `needs_review = true`, and a
  summary saying no computed result was available.
- Parent lifecycle and UI treated that child as completed.
- The expected G-gate attribution keys were null in the parent run metadata.

## Error evidence

- Sandbox result: "Could not compute the requested result within the bounded
  sandbox retry budget. No computed result is available."
- Parent attribution keys were null, although lifecycle recorded
  `runtime_manifest = model_driven`.

## Timeline

Observed in the first live A1 breadth canary on 2026-07-23 at deployed SHA
`0de5ebe52e7a75838cc67e66b61a97917b6d1c4a`.

## Reproduction

Founder-only G-gate A1 selected structured data then dependent sandbox. The
sandbox exhausted its bounded retry budget, after which the parent composed a
successful numeric answer and persisted no exact G-gate attribution fields.

# Current Focus

- hypothesis: Confirmed and locally fixed: VCSO SDK completion must use the structured semantic outcome rather than outer transport completion, and final parent metadata must explicitly persist the exact G-gate attribution with the terminal lifecycle snapshot.
- test: Self-verification is complete across the focused RED-to-GREEN regressions, the broader always-on VCSO unit suites, available integration-style coverage, targeted compilation, whitespace checks, and exact owned-diff review.
- expecting: The next authorized founder workflow should preserve a degraded child as degraded and persist all five exact attribution keys without enabling any currently dark rollout flag.
- next_action: await human acceptance of the local fix; a separately authorized dark-deploy/canary cycle is required for live PostgREST and real SDK/FastMCP proof
- reasoning_checkpoint:
    hypothesis: Outer database status `completed` is a transport lifecycle state, but the SDK path uses it as semantic success; independently, final G-gate attribution is written only into `structured_result` while run `metadata` is replaced by lifecycle-only snapshots.
    confirming_evidence:
      - The live sandbox child row had outer `completed` with `structured_result.status=could_not_compute` and `needs_review=true`, while the parent completed.
      - `_compact_result` copies `SubAgentRunResult.status` unchanged and the completion bridge selects only outer `status=completed`.
      - `_complete_main_run(metadata=...)` expands that argument into `structured_result`, and lifecycle persistence writes a separate metadata object without the five attribution keys.
      - All three focused regression tests fail on the exact expected assertions.
    falsification_test: If semantic status is normalized and DB-completed children are filtered by structured semantics but the parent still completes, or if explicit run metadata is written but the five keys remain absent, this hypothesis is wrong.
    fix_rationale: Deriving the transport result from the structured semantic state prevents degraded findings from being cached, chained, or counted as completed; explicit final run metadata preserves the exact armed attribution together with lifecycle evidence.
    blind_spots: The RED tests use in-process doubles and do not exercise a real Claude SDK/FastMCP process or live PostgREST JSONB behavior; live flags and canary proof remain deliberately out of scope and dark.
- tdd_checkpoint:
    test_files:
      - python-backend/unit_tests/test_vcso_worker_mcp.py
      - python-backend/unit_tests/test_vcso_g_gate_result_integrity.py
    test_names:
      - test_semantically_degraded_worker_result_is_not_propagated_as_completed
      - test_completion_bridge_excludes_semantically_degraded_children
      - test_complete_main_run_persists_exact_g_gate_parent_attribution
    status: green
    failure_output: Initial RED was 3 failed; worker status was `completed` instead of `could_not_compute`; completion bridge counted degraded sandbox/wiki children; `_complete_main_run` rejected `run_metadata`. The unchanged regressions now pass.
- fault_tree:
  - semantic worker failure accepted as success:
      OR:
        - terminal database status is trusted without checking structured payload
        - structured payload is dropped by transport/deserialization
        - parent composer ignores a correctly propagated degraded marker
  - parent attribution fields persisted null:
      OR:
        - attribution is never assembled
        - attribution is assembled under a different key or shape
        - a later parent metadata write replaces or omits it

# Evidence

- timestamp: 2026-07-23T19:05:00Z
  observation: A1 parent completed and asserted numeric margin/runway results.
- timestamp: 2026-07-23T19:04:30Z
  observation: Sandbox child persisted `could_not_compute` and `needs_review=true`.
- timestamp: 2026-07-23T19:05:00Z
  observation: Parent metadata lacked all expected G-gate attribution keys.
- timestamp: 2026-07-23T20:03:00Z
  checked: `.planning/debug/knowledge-base.md`
  found: No debug knowledge base exists, so there is no known-pattern candidate to test first.
  implication: Continue from direct code evidence and common Data Shape / Error Handling patterns.
- timestamp: 2026-07-23T20:04:00Z
  checked: Phase 04B vision, context, roadmap, handoff, and rollout skill
  found: The fix must preserve dark flags, synthesis-only SDK leadership, bounded non-recursive workers, curated output, exact parent linkage, and honest gap reporting; A1 is delegation-shape smoke rather than real financial-compute proof.
  implication: Changes are limited to semantic result propagation and exact parent attribution persistence; no rollout or broader component behavior is authorized.
- timestamp: 2026-07-23T20:07:00Z
  checked: `git status --short`
  found: The checkout already contains unrelated modified/untracked Phase E/F/G and 04B planning files; this debug file is also untracked under `.planning/debug/`.
  implication: Preserve all pre-existing work and edit only the owned backend/tests/debug paths.
- timestamp: 2026-07-23T20:09:00Z
  checked: Result and attribution symbol search across `python-backend/services` and `python-backend/tests`
  found: Sandbox semantic status is stored inside `structured_result`, while `SubAgentOrchestrator` persists child rows as `status=completed`; exact G-gate attribution is assembled in `vcso_chat_service.py` near the SDK path, and SDK trace metadata uses separately prefixed `sdk_*` keys.
  implication: The live symptom fits a Data Shape contract mismatch for result success and a parent-run create/update persistence mismatch for attribution.
- timestamp: 2026-07-23T20:15:00Z
  checked: `SubAgentOrchestrator.start_run`, sandbox handler, compact contract, and `vcso_worker_mcp._compact_result`
  found: A non-exceptional sandbox handler result always produces a child row with outer `status=completed`; the semantic outcome survives only inside `structured_result.status` and `needs_review`.
  implication: Transport completion and semantic success are dual states, but downstream code currently treats the outer transport state as authoritative.
- timestamp: 2026-07-23T20:17:00Z
  checked: `vcso_sdk_loop.model_driven_completed_children`, Task post-hook, stop-hook, and terminal check
  found: All three completion decisions use a database lookup restricted to `status=completed` and never select or validate `structured_result`; a degraded child is therefore synthesized as a successful Task and can satisfy the required-worker gate.
  implication: H1 is directly supported; the completion bridge is the root propagation seam.
- timestamp: 2026-07-23T20:19:00Z
  checked: `VcsoChatService._stream_chat_impl`, `persist_sdk_lifecycle`, and `_complete_main_run`
  found: The five exact attribution fields are passed through `_complete_main_run(metadata=...)` but are expanded only into `structured_result`; the JSONB `metadata` column is written separately by lifecycle snapshots that contain none of those fields.
  implication: H2 is directly supported; final parent completion needs an explicit run-metadata persistence contract that preserves lifecycle evidence.
- timestamp: 2026-07-23T20:29:00Z
  checked: Focused RED pytest run for three new regressions
  found: Worker transport test failed because outer status remained `completed`; completion bridge test failed because both `could_not_compute` and `needs_review` children were counted. The parent-attribution test was skipped by its test module/environment gate.
  implication: H1 is reproduced exactly. H2 needs its regression relocated or unskipped before the TDD checkpoint is complete.
- timestamp: 2026-07-23T20:34:00Z
  checked: Always-on focused RED unit suite after relocating the attribution test
  found: All three tests failed as predicted: semantic result remained completed, degraded children satisfied the DB bridge, and `_complete_main_run` had no `run_metadata` parameter.
  implication: Root causes are confirmed and the TDD RED gate is complete; production fixes must wait for the green continuation.
- timestamp: 2026-07-23T20:49:00Z
  checked: Three focused TDD GREEN regressions
  found: All three passed unchanged after the minimal implementation.
  implication: Semantic degradation, DB completion filtering, and parent metadata persistence now satisfy their direct contracts.
- timestamp: 2026-07-23T20:54:00Z
  checked: Full `test_vcso_worker_mcp.py`, `test_vcso_sdk_loop.py`, `test_vcso_graceful_failure.py`, and G-gate integrity unit suites
  found: 95 tests passed with no failures.
  implication: Successful completion rescue, worker cache/chaining, isolation, lifecycle, progress, and graceful partial-answer behavior did not regress.
- timestamp: 2026-07-23T20:59:00Z
  checked: `tests/test_vcso_turn_lifecycle.py` and `tests/test_sandbox_worker_remediation.py`
  found: 6 tests passed; 7 turn-lifecycle tests were skipped because the sandbox forbids the auth-user socket lookup.
  implication: Sandbox remediation is green; environment-backed lifecycle coverage could not run, but the new parent-attribution contract is covered by an always-on unit test.
- timestamp: 2026-07-23T21:04:00Z
  checked: Targeted compile, whitespace check, status, and exact owned diff
  found: Syntax and whitespace passed, but the diff showed `sdk_run_attribution` initialization in the planner completion branch due to a duplicated patch context.
  implication: Verification caught an untested runtime scoping defect before handoff; fix placement and add caller-level coverage.
- timestamp: 2026-07-23T21:14:00Z
  checked: Full always-on relevant unit suite after placement correction and caller-level regression
  found: 96 tests passed with no failures.
  implication: Both root-cause fixes and the corrected SDK caller placement are locally regression-protected.
- timestamp: 2026-07-23T21:19:00Z
  checked: Integration-style turn-lifecycle and sandbox-remediation suites after correction
  found: 6 tests passed; the same 7 auth-user socket-dependent tests skipped.
  implication: No sandbox remediation regression; remaining skips are environment access limitations rather than failures.
- timestamp: 2026-07-23T21:24:00Z
  checked: Final semantic call-site review
  found: The retained app-owned Path A fallback still accepted `SubAgentRunResult.status=completed` without inspecting `structured_result`, even though it is another VCSO SDK result-propagation path.
  implication: Apply the same semantic guard through Path A's existing mandatory/best-effort failure handling so the fallback cannot repeat the A1 false green.
- timestamp: 2026-07-23T21:30:00Z
  checked: Focused semantic-degradation, completion-bridge, attribution, caller-placement, and Path A fallback regressions after applying the retained-path guard
  found: 6 tests passed with no failures.
  implication: The newly covered Path A degraded-result case now follows its existing mandatory-worker fallback instead of being accepted as a successful child.
- timestamp: 2026-07-23T21:40:00Z
  checked: Final targeted service compilation
  found: `vcso_worker_mcp.py`, `vcso_sdk_loop.py`, and `vcso_chat_service.py` compiled successfully with `py_compile`.
  implication: The final implementation has no Python syntax/import-compilation defect in the edited service modules.
- timestamp: 2026-07-23T21:41:00Z
  checked: `git diff --check`, explicit trailing-whitespace scan of the two untracked owned files, `git status --short`, and exact owned diff
  found: Tracked whitespace validation passed; the untracked regression/debug files have no trailing whitespace; the owned changes are limited to three service files, three unit-test files, and this debug record. Pre-existing Phase E/F/G planning and local-settings changes remain untouched.
  implication: The patch is scope-contained and ready for human acceptance without any deployment, flag change, database write, or live canary.
- timestamp: 2026-07-23T21:55:00Z
  checked: Root-agent acceptance review and repeated focused suite
  found: Review exposed and fixed two attribution/semantic edge cases: `needs_review=true` now overrides a nominal semantic `completed` label, and every lifecycle metadata snapshot carries the exact G-gate attribution rather than waiting for terminal completion. The expanded focused suite passed 98 tests.
  implication: Degraded results cannot false-green through a conflicting status label, and in-progress or failed G-gate runs remain attributable to the armed configuration.

# Eliminated

# Resolution

- root_cause: VCSO model-driven delegation conflated child transport completion with semantic success, allowing `could_not_compute` / `needs_review` results to be cached, chained, and counted by the DB completion bridge. Separately, exact G-gate attribution was expanded into the parent `structured_result` while lifecycle persistence replaced the parent run `metadata` JSONB with a lifecycle-only object.
- fix: Normalize worker semantic status from `structured_result`; return degraded status without caching/chaining and emit a curated failed progress update; require semantic success in the model-driven DB completion bridge, in-process native handler, and retained Path A fallback; persist a final parent-run metadata object containing the exact G-gate attribution and terminal lifecycle snapshot.
- verification: Initial RED reproduced all three failures. Focused GREEN passed 3 tests; the broader always-on VCSO suite passed 95 tests, then 96 tests after the SDK caller-placement regression; the final root-agent acceptance suite passed 98 tests after adding `needs_review` precedence and lifecycle-attribution coverage. Integration-style coverage passed 6 tests with 7 environment-skipped auth-socket tests. Targeted `py_compile`, `git diff --check`, untracked-file trailing-whitespace scan, and exact owned-diff review all passed. Live SDK/FastMCP/PostgREST behavior remains intentionally untested because flags stayed dark and no canary was authorized.
- files_changed:
  - python-backend/services/vcso_worker_mcp.py
  - python-backend/services/vcso_sdk_loop.py
  - python-backend/services/vcso_chat_service.py
  - python-backend/unit_tests/test_vcso_worker_mcp.py
  - python-backend/unit_tests/test_vcso_sdk_loop.py
  - python-backend/unit_tests/test_vcso_g_gate_result_integrity.py
  - .planning/debug/g-gate-result-integrity.md
