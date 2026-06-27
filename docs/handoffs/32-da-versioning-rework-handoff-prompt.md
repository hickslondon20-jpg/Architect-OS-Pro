# Handoff Prompt — #32: Delivery Architecture Versioning + `is_current` Rework (Frontend + DB Trigger)

You are the building agent for a **frontend + Supabase** unit on ArchitectOS Pro. **No n8n** — the workflow changes are manual and out of scope. Do not edit/create/call any n8n workflow.

## Read first (in order)
1. `docs/handoffs/32-da-versioning-rework-task-spec.md` — **the source of truth.**
2. `docs/handoffs/30-ef-versioning-rework-task-spec.md` — the established pattern this mirrors (Delivery ≈ EF). #32 notes only the Delivery differences.
3. `docs/content-provenance-manifest.md` → §2 Agency Snapshot / Delivery Architecture.

## Project
Supabase `pwacpjqkntnovndhspxt`; DDL via `apply_migration`. **Verify the live schema of `agency_snapshot_delivery_architecture` first.** Component: `pages/SnapshotPages.tsx › DeliveryArchitectureTab` (inline).

## What to build (mirror of #30)
1. **Migration:** add `version_number int`; backfill (no-op while empty; delete nothing); `BEFORE INSERT OR UPDATE` trigger `fn_da_versioning`/`trg_da_versioning` (assign `version_number`; demote sibling `is_current`); partial unique index `uq_da_one_current_per_user UNIQUE(user_id) WHERE is_current` (leave plain `idx_delivery_architecture_user_current`). **No RLS change needed** (own-row UPDATE policy already exists).
2. **Hash:** canonical `input_hash` over the **11 intake fields** (incl. the two `text[]` arrays `key_leadership_roles`/`specialized_roles`, **sorted**) — fixed key order, numbers `undefined→null`, strings trimmed → SHA-256 hex. Not the calc metrics, not `monthly_agi`.
3. **Load:** keep `…eq('user_id').eq('is_current',true).maybeSingle()`; store `currentRowId`. (Leave the EF-AGI fetch — already `is_current`.)
4. **Save:** reactivate-or-insert by `(user_id, input_hash)` — match → `update is_current=true` on it (trigger demotes others), hydrate cached synthesis, no insert/workflow; else → insert (11 inputs + 4 calc metrics + `input_hash` + `is_current=true` + `is_complete=true`; omit `version_number`/`snapshot_instance_id`/synthesis cols). **Remove the blanket `update is_current=false`** and `crypto.randomUUID()`.
5. **Submit:** POST `{ id: currentRowId, user_id }`; poll by `id`.

## Guardrails
- Non-destructive; don't delete rows or change calc formulas / `TeamProfile.tsx` / other sub-tabs / the webhook secret. `snapshot_instance_id` stays null. Deterministic hash (sorted arrays). TS-clean; no visual changes.

## Verify before reporting done (written, SQL + code — no screenshots)
SQL: two distinct DA combinations for a test user → two rows, one current, `version_number` 1→2; reactivating the first flips current with **no third row**; unique index blocks two currents; clean up. Code: hash fn (with sorted arrays), `currentRowId`, reactivate-vs-insert (blanket demote removed), `{id,user_id}` POST + poll-by-`id`; grep-confirm no `snapshot_instance_id` in `DeliveryArchitectureTab`. Confirm TS-clean.

## Report back
Per the task-spec report-back format. Note explicitly that WF-AS-04 must be manually updated to key on `id`.
