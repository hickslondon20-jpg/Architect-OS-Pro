# Phase 1 Completion - Model Routing & Tagged Usage Events

**Completed:** 2026-07-03
**Scope:** 01-01 model routing + 01-02 tagged usage events only.

## What Changed

- Added live migrations `013_capability_model_routing_usage_events` and `014_ai_usage_log_surface_tags`.
- Added `anthropic/claude-sonnet-4-6` to `ai_models`.
- Pointed `vcso_chat`, all seven active experimental capability settings, and two utility synthesis settings at `claude-sonnet-4-6`.
- Extended `ai_usage_log` in place with `role`, `provider`, `capability_key`, `run_id`, and nullable `cost_usd`.
- Preserved RLS and widened the existing `surface` check to include live intelligence-layer telemetry surfaces.
- Updated `api/vcso/chat.ts` to resolve `vcso_chat` from `platform_ai_settings`, with a Claude-only guard and fail-open fallback.
- Updated chat usage logging to use the service client and tag `role='main'`, `provider='anthropic'`.
- Added a shared Python best-effort usage helper and tagged KB Explorer / sandbox as `sub_agent`, and metadata extraction, embeddings, doc-wiki synthesis, doc-wiki embeddings, and guided skill draft as `utility`.
- Updated Python Claude defaults to `claude-sonnet-4-6`.

## Verification

- Live Supabase pre-check confirmed `ai_usage_log` lacked tags and only the original platform settings existed.
- Live migrations applied to project `pwacpjqkntnovndhspxt` and are present in migration history.
- Live query confirmed `ai_usage_log.role` is non-null, defaults to `main`, and has the `main`/`sub_agent`/`utility` check.
- Live query confirmed RLS remains enabled on `ai_usage_log`; existing read-own policy is intact.
- Live query confirmed all seeded settings resolve to their expected models.
- Rollback-only row-edit proof confirmed changing `kb_explorer_agent` to `claude-sonnet-4-5` changes the resolved model with no code change, then rolls back to `4-6`.
- Rollback-only usage smokes confirmed degradation query (`thread_id` + `role='main'`) and ledger-style all-role aggregation.
- Smoke rows and temp thread did not persist.
- `python -m compileall python-backend` passed. Note: the known unreadable `.pytest_cache` warning appeared and was non-fatal.
- `npm.cmd run build` passed. Note: Vite emitted the existing large chunk warning.

## Explicit Non-Scope Preserved

- No tool registry, tool loop, sandbox bridge, MCP connector, degradation UI, ledger, quotas, pricing, or account-level metering was built.
- Primary chat remains Claude-locked with no per-thread switching and no user-facing model dropdown.
