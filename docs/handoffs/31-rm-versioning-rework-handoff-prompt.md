# Handoff Prompt — #31: Revenue Model Versioning + `is_current` Rework (Frontend + DB Trigger + RLS + Cross-tab)

You are the building agent for a **frontend + Supabase** unit on ArchitectOS Pro. **No n8n** — the workflow changes are manual and out of scope. Do not edit/create/call any n8n workflow.

## Read first (in order)
1. `docs/handoffs/31-rm-versioning-rework-task-spec.md` — **the source of truth.**
2. `docs/handoffs/30-ef-versioning-rework-task-spec.md` — the established pattern this mirrors; #31 notes only the RM differences.
3. `docs/content-provenance-manifest.md` → §2 Agency Snapshot / Revenue Model.

## Project
Supabase `pwacpjqkntnovndhspxt`; DDL via `apply_migration`. **Verify the live schema of `agency_snapshot_revenue_model` first.** Component: `pages/SnapshotPages.tsx › GrowthPipeline` (inline).

## What to build (mirror of #30, plus three RM-only items)
**RM-only / easy to miss:**
- **Add an own-row UPDATE RLS policy** (the table has only INSERT + SELECT today; without UPDATE, the reactivation update *and* the demotion trigger are RLS-blocked).
- **Cross-tab:** fetch Economic Foundation `monthly_agi` by **`is_current=true`** (not `created_at desc`) for the calc inputs.
- **Save-gating fix:** Save is currently disabled when `synthesisStatus==='complete'` — gate on validity/dirty instead so a new version can be saved after a synthesis.

**Standard pattern (as #29/#30):**
1. **Migration:** UPDATE RLS policy; add `version_number int`; backfill (no-op while empty; delete nothing); `BEFORE INSERT OR UPDATE` trigger `fn_rm_versioning`/`trg_rm_versioning` (assign `version_number`; demote sibling `is_current`); partial unique index `uq_rm_one_current_per_user UNIQUE(user_id) WHERE is_current` (leave `idx_revenue_model_user_created`).
2. **Hash:** canonical `input_hash` over the **15 intake values** (13 fields incl. the 5 channel ranks + 3 concentration %s) — fixed order, numbers `undefined→null`, strings trimmed → SHA-256 hex. Not the calc metrics, not `monthly_agi`.
3. **Load:** `…eq('user_id').eq('is_current',true).maybeSingle()`; store `currentRowId`.
4. **Save:** reactivate-or-insert by `(user_id, input_hash)`; net-new insert includes `is_current=true` + the calc metrics, omits `version_number`/`snapshot_instance_id`/synthesis cols; remove the old insert-only/`created_at` logic and `crypto.randomUUID()`.
5. **Submit:** POST `{ id: currentRowId, user_id }`; poll by `id`.

## Guardrails
- Non-destructive; don't delete rows or change calc formulas / `GrowthProfile.tsx` / other sub-tabs / the webhook secret. `snapshot_instance_id` stays null. Deterministic hash. TS-clean; no visual changes.

## Verify before reporting done (written, SQL + code — no screenshots)
SQL: UPDATE policy present; two distinct RM combinations for a test user → two rows, one current, `version_number` 1→2; reactivating the first flips current with **no third row**; unique index blocks two currents; clean up. Code: hash fn, `is_current` load + `currentRowId`, EF-AGI `is_current` fetch, reactivate-vs-insert, `{id,user_id}` POST + poll-by-`id`, save-gating fix; grep-confirm no `snapshot_instance_id` in `GrowthPipeline`. Confirm TS-clean.

## Report back
Per the task-spec report-back format. Note explicitly that WF-AS-03 must be manually updated to key on `id`.
