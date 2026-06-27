# Handoff Prompt — #29: Market Footprint Versioning + `is_current` Rework (Frontend + DB Trigger)

You are the building agent for a **frontend + Supabase** unit on ArchitectOS Pro. **No n8n** — the workflow changes are performed manually by the owner and are out of your scope. Do not edit, create, or call any n8n workflow.

## Read first (in order)
1. `docs/handoffs/29-mf-versioning-rework-task-spec.md` — **the source of truth.** Scope, the migration/trigger DDL, the frontend logic, acceptance criteria, verification, report-back format.
2. `docs/content-provenance-manifest.md` → §2 Agency Snapshot / Market Footprint — the content/provenance map and open build items this executes.
3. `CLAUDE.md` — architecture rules (AI synthesis stays in n8n; this unit touches none of it).

## Project
Supabase `pwacpjqkntnovndhspxt`. All DDL/data via `apply_migration`, matching `docs/migrations/`. **Verify the live schema of `agency_snapshot_market_footprint` before writing any migration.** Component: `components/snapshot/IdentityPositioningTab.tsx`.

## What to build

**Model:** content-addressed versioning — one row per unique input combination per user; `input_hash` identifies a combination; `is_current=true` marks the active version (exactly one per user); synthesis cached per row; reactivating a prior combination re-promotes its row **without** re-synthesizing (handled at save, no workflow call); a new combination inserts a row, promotes it on insert, and triggers synthesis.

1. **Migration:** add `version_number int`; backfill (`version_number` per user by `created_at`; set most-recent row per user `is_current=true`, others false — **delete nothing**); add a `BEFORE INSERT OR UPDATE` trigger that assigns `version_number` on insert and demotes sibling `is_current` rows when a row is set current; add a partial unique index `UNIQUE(user_id) WHERE is_current`. Reference DDL is in the task-spec — adapt and verify.
2. **Frontend hash:** canonical `input_hash` over sorted uuid arrays + normalized scalars (fields/order in the task-spec) → SHA-256 hex via Web Crypto.
3. **Load:** read `is_current=true` row (`eq('user_id').eq('is_current', true).maybeSingle()`), hydrate form + synthesis, store its `id`.
4. **Save (reactivate-or-insert):** hash the form; if a row with that `(user_id, input_hash)` exists → `update is_current=true` on it (trigger demotes others), hydrate its cached synthesis, no insert, no workflow; else → insert a new row (`is_current=true`, `is_complete=true`, **don't** set `version_number`/`snapshot_instance_id`/`synthesis_status`), `.select('id').single()`.
5. **Submit for Synthesis:** save first if dirty; if the current row already has a complete synthesis, do nothing; else POST `{ id, user_id }` to `…/agency-snapshot/market-footprint/synthesize` (drop `snapshot_instance_id` + `force`), set `running`, and **poll by `id`**.
6. **Remove** `snapshot_instance_id` generation and all sub-tab usage (leave the column null).
7. **Save gating:** disable unless the form differs from the loaded current version.

## Guardrails
- Non-destructive: don't drop/rename columns or delete rows; don't touch the other sub-tabs, the static right-panel sidebar, the dead `SERVICE_OPTIONS`/`INDUSTRY_OPTIONS` consts, or the webhook-secret handling.
- No dashboard work; `snapshot_instance_id` stays dashboard-owned (null here).
- Deterministic hash (sorted arrays, normalized scalars). TypeScript-clean. No visual/AOS changes.

## Verify before reporting done (written, SQL + code — no screenshots)
SQL: two distinct combinations for a test user → two rows, one current, `version_number` 1→2; reactivating the first flips current with **no third row**; unique index blocks two currents; backfill left one current per existing user. Code: show the hash fn, load query, reactivate-vs-insert branch, `{ id, user_id }` POST + poll-by-`id`; grep-confirm no `snapshot_instance_id` usage remains. Confirm TS-clean build. Clean up test rows.

## Report back
Per the task-spec's report-back format: migrations + DDL, backfill result, SQL verification output, the frontend changes with before/after, TS-clean confirmation, and anything flagged. Note explicitly that the n8n workflow must be manually updated to key on `id` (the frontend now sends `{ id, user_id }`) for end-to-end synthesis to work.
