# Handoff Prompt — #30: Economic Foundation Versioning + `is_current` Rework (Frontend + DB Trigger)

You are the building agent for a **frontend + Supabase** unit on ArchitectOS Pro. **No n8n** — the workflow changes are manual and out of scope. Do not edit/create/call any n8n workflow.

## Read first (in order)
1. `docs/handoffs/30-ef-versioning-rework-task-spec.md` — **the source of truth** (scope, migration/trigger, frontend logic, acceptance criteria, verification).
2. `docs/handoffs/29-mf-versioning-rework-task-spec.md` — the **established pattern** this mirrors (Market Footprint). #30 notes only the EF differences.
3. `docs/content-provenance-manifest.md` → §2 Agency Snapshot / Economic Foundation.

## Project
Supabase `pwacpjqkntnovndhspxt`; DDL via `apply_migration`. **Verify the live schema of `agency_snapshot_economic_foundation` first.** Component: `pages/SnapshotPages.tsx › FinancialSnapshot` (inline — not a separate component file).

## What to build (mirror of #29 on the EF table)
1. **Migration:** add `version_number int`; backfill (no-op while empty — keep for safety; delete nothing); `BEFORE INSERT OR UPDATE` trigger `fn_ef_versioning`/`trg_ef_versioning` (assign `version_number` on insert; demote sibling `is_current` rows when a row is set current); partial unique index `uq_ef_one_current_per_user UNIQUE(user_id) WHERE is_current`. Leave the existing plain `idx_economic_foundation_current`.
2. **Frontend hash:** canonical `input_hash` over the **13 intake fields only** (not the 6 calculated metrics) — fixed key order, numbers `undefined→null`, strings trimmed `''→null` → SHA-256 hex.
3. **Load:** keep `…eq('user_id').eq('is_current',true).maybeSingle()`; store the row's `id` as `currentRowId`.
4. **Save (reactivate-or-insert):** hash the form; if `(user_id, input_hash)` exists → `update is_current=true` on it (trigger demotes others), hydrate cached synthesis, no insert/workflow; else → insert a new row (13 inputs + 6 calc metrics + `input_hash` + `is_current=true` + `is_complete=true`; **omit** `version_number`/`snapshot_instance_id`/`synthesis_status`), `.select().single()`. **Remove the existing blanket `update is_current=false` demote** (trigger owns it) and the `crypto.randomUUID()` `snapshot_instance_id`.
5. **Submit for Synthesis:** POST `{ id: currentRowId, user_id }` (drop `snapshot_instance_id` + `force`); set `running`; **poll by `id`**. The post-rework workflow won't return `skipped`.
6. Calculated metrics unchanged (still computed + saved). Optional parity: save-gating against the loaded current version.

## Guardrails
- Non-destructive; don't delete rows or change calc formulas / `FinancialProfile.tsx` / other sub-tabs / the webhook secret / the `alert()` UX.
- `snapshot_instance_id` stays null (dashboard-owned). Deterministic hash. TypeScript-clean. No visual changes.

## Verify before reporting done (written, SQL + code — no screenshots)
SQL: two distinct EF combinations for a test user → two rows, one current, `version_number` 1→2; reactivating the first flips current with **no third row**; unique index blocks two currents; clean up. Code: show the hash fn, load `currentRowId`, reactivate-vs-insert branch (blanket demote removed), `{id, user_id}` POST + poll-by-`id`; grep-confirm no `snapshot_instance_id` usage remains in `FinancialSnapshot`. Confirm TS-clean.

## Report back
Per the task-spec report-back format: migrations + DDL, SQL verification, frontend before/after, TS-clean, flags. Note explicitly that WF-AS-02 must be manually updated to key on `id`.
