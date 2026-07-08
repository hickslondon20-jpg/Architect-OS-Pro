# Phase 6 Completion - Degradation Signal & Compaction

**Completed:** 2026-07-03
**Scope:** 06-01 per-thread degradation signal + 06-02 context compaction only.

## What Changed

- Added `docs/migrations/018_degradation_compaction.sql`.
- Added `ai_models.context_window`, seeded `claude-sonnet-4-6` at `200000`, and added a matching `ARCHITECTOS_LLM_CONTEXT_WINDOW` runtime fallback default.
- Seeded `vcso_context_compaction` in `platform_ai_settings` as the utility-model setting for thread compaction.
- Added minimal compaction storage on `vcso_chat_threads`: `compacted_summary`, `compacted_through_message_id`, and `compacted_at`.
- Extended model-setting resolution to read `ai_models.context_window`.
- Extended `VcsoChatService` to compute the current turn's peak main `input_tokens`, divide by the resolved context window, and emit a dedicated `context` SSE event with `remainingPercent` and `band` only.
- Added authenticated `POST /api/vcso/compact`.
- Added founder-initiated compaction that summarizes older thread messages plus prior tool results, logs the summarization as `role='utility'`, stores the summary on the thread, and has `_build_context` consume the compacted summary while keeping newer messages full-fidelity.
- Extended the frontend SSE parser for the `context` event.
- Rendered a slim per-thread context remaining bar in the Virtual CSO footer, with green/amber/red bands and an icon-only compaction affordance in amber/red.

## Acceptance Criteria Mapping

- **DEGRADE-01:** Met in code. The signal is per-thread and derived from peak main-window input tokens for the current VCSO turn against the registry context window.
- **Main-role only:** Met by construction. The signal is computed from the VCSO main loop's `role='main'` calls; utility/sub-agent usage remains excluded from degradation.
- **Founder-safe display:** Met. SSE and UI carry percentage plus band only; no raw tokens or cost are exposed.
- **Registry window:** Met in code/migration. `context_window` is on `ai_models`, seeded to 200000 for the active Claude model, and read through the registry with 200000 config fallback.
- **DEGRADE-02:** Met in code. Compaction summarizes older assembled context inputs and is consumed by `_build_context`.
- **Compaction reclaims context, not cost:** Met in code. The summarization call logs to `ai_usage_log` as `role='utility'`; prior usage rows are untouched.
- **Not writeback:** Met. Compaction stores only thread-local summary fields and does not write to the knowledge base or call `/api/vcso/writeback`.
- **Account-level % deferred:** Preserved. No ledger, quota, tier economics, or account-level percentage was built.

## Verification

- `python -m pytest python-backend\tests\test_vcso_chat_service_phase6.py python-backend\tests\test_vcso_chat_service_phase3.py` passed: 4 passed.
- `python -m py_compile python-backend\services\vcso_chat_service.py python-backend\services\vector_store.py python-backend\main.py python-backend\core\config.py` passed.
- `python -m compileall python-backend` passed. The known unreadable `.pytest_cache` listing appeared and was non-fatal.
- `npm.cmd run build` passed. Vite emitted the existing large chunk warning.
- `npx.cmd tsc --noEmit` still reports unrelated pre-existing type errors across older app surfaces; no Phase 6-specific compile error was identified.

## Remaining Gaps / Live Smoke Notes

- Live Supabase migration apply for `018_degradation_compaction.sql` was not run from this checkout.
- Full live deployed VCSO chat/compaction smoke was not run here because live runtime credentials and deployed backend access were not available in this local session.
- Post-compaction context recovery is proven structurally by `_build_context` consuming the stored summary and by focused tests; live token recovery should be checked after the migration is applied in the target environment.

## Explicit Non-Scope Preserved

- No metering ledger, account-level percentage, quota enforcement, pricing, or tier economics was built.
- No sub-agent/utility events were included in the degradation signal.
- No knowledge-base writeback path was changed.
- Phase 7 interleaved-history rendering remains untouched.
