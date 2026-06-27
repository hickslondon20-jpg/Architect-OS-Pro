# Handoff Task Spec — #30: Agency Snapshot / Economic Foundation — Versioning + `is_current` Rework (Frontend + DB Trigger)

> **Status:** Ready for execution. **Frontend + Supabase only — NO n8n.** The WF-AS-02 workflow changes are **manual** (London) and specified separately in `docs/handoffs/30-ef-versioning-rework-n8n-manual-walkthrough.md`. Do **not** edit/create/call n8n.
> **Source of truth:** `docs/content-provenance-manifest.md` → §2 Agency Snapshot / Economic Foundation (mapping + open build items).
> **Precedent:** This mirrors **#29** (Market Footprint). Read `docs/handoffs/29-mf-versioning-rework-task-spec.md` for the established pattern; this spec notes only the Economic-Foundation differences.
> **Project:** Supabase `pwacpjqkntnovndhspxt`. DDL/data via `apply_migration`.
> **Role boundary:** Executing agent. Verify live schema before changing. Non-destructive. Flag, don't improvise.

---

## Objective

Bring Economic Foundation to the same **content-addressed versioning** model shipped for Market Footprint in #29: one row per unique input combination per user; `input_hash` identifies a combination; `is_current=true` marks the active version (exactly one per user, DB-enforced); synthesis cached per row; reactivating a prior combination re-promotes its row **without** re-synthesizing; net-new inserts + promotes-on-insert + synthesizes.

**Why this matters here (not just cleanup):** EF's frontend already inserts a new row per save but **reuses `snapshot_instance_id`**, so multiple version rows share one `snapshot_instance_id`. The synthesis workflow keys on `snapshot_instance_id`, so it can read a **stale version** and write to **all** rows sharing that id. Moving the version key to the row **`id`** closes this hole.

---

## Context (verify first)

- Table `agency_snapshot_economic_foundation` (41 cols): 13 intake fields, 6 **persisted calculated** columns (`agi_percentage_calculated`, `annual_revenue_run_rate`, `annual_agi_run_rate`, `monthly_operating_profit`, `monthly_operating_expenses`, `cash_runway_months`), synthesis columns + the same async/`is_current`/`snapshot_instance_id`/`input_hash` envelope as MF. **No `version_number` column.** Only an `updated_at` trigger exists; `idx_economic_foundation_current` is a **plain** index (not partial-unique). RLS own-row INSERT/SELECT/UPDATE present (no DELETE policy — fine).
- The table is **currently empty** (seed cleared 2026-06-24), so the migration backfill is effectively a no-op — keep the backfill statements anyway for safety/idempotency.
- Component: `pages/SnapshotPages.tsx › FinancialSnapshot` (the EF form/metrics/synthesis live **inline** in `SnapshotPages.tsx`, not a separate component file). Saved-profile render is `components/snapshot/FinancialProfile.tsx` (no change needed there).
- EF already: load filters `is_current=true` (`maybeSingle`); save does a blanket `update is_current=false where user_id` then `insert`. The rework **replaces** the blanket demote with the DB trigger and adds the hash/reactivate path.

---

## In scope

### A. Supabase migration(s) — mirror #29 on this table

1. **Add** `version_number integer` (nullable).
2. **Backfill** (no-op while empty, keep for safety): per `user_id`, `version_number` by `created_at` asc; most-recent row per user `is_current=true`, others `false`. Delete nothing.
3. **Trigger** `fn_ef_versioning` + `trg_ef_versioning` (`BEFORE INSERT OR UPDATE`, per row): on insert assign `version_number = coalesce(max,0)+1` per user; when `NEW.is_current` is true, demote siblings (`user_id=NEW.user_id AND id<>NEW.id AND is_current`). Same shape as `fn_mf_versioning`.
4. **Partial unique index** `uq_ef_one_current_per_user UNIQUE (user_id) WHERE is_current`. (Leave the existing plain `idx_economic_foundation_current` in place.)

### B. Frontend — `pages/SnapshotPages.tsx › FinancialSnapshot`

1. **Canonical `input_hash`** over the **13 intake fields only** (not the calculated metrics — they derive from the inputs): `monthly_revenue, monthly_agi, monthly_payroll, profit_margin_percentage, cash_available, financial_health_status, monthly_passthrough_costs, monthly_overhead, owner_compensation, gross_margin_percentage, accounts_receivable, accounts_payable, cash_flow_health`. Canonical object with a **fixed key order**, numbers normalized (`undefined → null`, otherwise the numeric value), strings trimmed (`'' → null`) → `JSON.stringify` → SHA-256 hex (Web Crypto). (Same approach as MF's `computeInputHash`.)
2. **Load:** keep the existing `is_current=true` `maybeSingle()` read; additionally store the loaded row's **`id`** as `currentRowId`. (No change to hydrating the calc/profile/synthesis state.)
3. **Save (reactivate-or-insert)** — replace the current "demote-all then insert":
   - Compute `h = input_hash`.
   - Look up `…eq('user_id').eq('input_hash', h).limit(1).maybeSingle()`.
   - **Match (resurfaced):** `update({ is_current:true, updated_at }).eq('id', match.id)` (trigger demotes others); set `currentRowId = match.id`; hydrate `profileData` + cached synthesis from `match`. **No insert; no workflow.**
   - **No match (net-new):** `insert({ …13 inputs, …6 calculated metrics, input_hash:h, is_current:true, is_complete:true, user_id })` — **omit** `version_number` (trigger), `snapshot_instance_id` (stop using; leave null), `synthesis_status`; `.select().single()` → `currentRowId`; set `profileData`, clear synthesis state. **Remove the blanket `update is_current=false` demote** (the trigger owns demotion now).
   - **Remove** `crypto.randomUUID()` `snapshot_instance_id` generation and all `snapshot_instance_id` usage.
4. **Submit for Synthesis:** POST `{ id: currentRowId, user_id }` to `${VITE_N8N_WEBHOOK_URL}/agency-snapshot/economic-foundation/synthesize` (drop `snapshot_instance_id` + `force`); set `running`; **poll by `id`** (`…eq('id', currentRowId).single()`). The workflow no longer returns `skipped` post-rework — the `skipped`-status handling can be removed (harmless if left, but the branch will never fire).
5. **Calculated metrics:** unchanged — still computed in-component and written on insert (they remain in the insert payload).
6. **(Parity, recommended)** save-button gating: disable save unless the form differs from the loaded current version (mirrors #29). Lower priority than the above; with content-hash reactivation a no-op save is harmless (it re-promotes the already-current row), so this is polish, not correctness.

---

## Out of scope

- **No n8n** (manual, separate doc). **No dashboard work.** `snapshot_instance_id` stays null at the sub-tab level (dashboard-owned).
- No changes to the calculated-metric formulas, `FinancialProfile.tsx`, or the other sub-tabs.
- No row deletions. Don't change the webhook secret handling (parked).
- The `alert()`-based save UX is **not** in scope to refactor (leave as-is).

---

## Constraints

- Non-destructive, idempotent migrations; verify live schema first.
- Trigger runs under invoker rights on own rows only — confirm under RLS.
- Deterministic hash (fixed key order; normalized numbers/strings). TypeScript-clean; no visual/AOS changes.

---

## Acceptance criteria

1. `version_number` exists; trigger assigns it on insert and enforces single `is_current` per user; partial unique index present and blocks a second current.
2. Save computes the canonical hash; **resurfaced** combination re-promotes the existing row (no new row, no workflow call, cached synthesis shown); **net-new** inserts + promotes-on-insert (`version_number` via trigger; `snapshot_instance_id` null).
3. Blanket frontend demote removed; load reads `is_current=true`; poll + synthesis POST key on row `id` (`{id, user_id}`).
4. No `snapshot_instance_id` keying remains in `FinancialSnapshot`.
5. Calculated metrics still computed + persisted unchanged.
6. TypeScript clean; no visual changes.

---

## Verification (SQL + code, written, no screenshots)

1. **SQL:** insert two distinct EF input combinations for a test `user_id` → two rows, one `is_current`, `version_number` 1 then 2; reactivating the first flips current with **no third row**; unique index blocks two currents. Clean up test rows.
2. **Code:** show the hash fn (13 fields, fixed order, normalized → SHA-256), the load `currentRowId` capture, the reactivate-vs-insert branch (blanket demote removed), and the `{id, user_id}` POST + poll-by-`id`. Grep-confirm no `snapshot_instance_id` usage remains in `FinancialSnapshot`.
3. Confirm TypeScript-clean build.

---

## Report-back format

Migrations + DDL (trigger/function/index); backfill result (empty table → none); SQL verification (two-combo insert, reactivation, unique-index block); the frontend changes (hash, load, reactivate-vs-insert, blanket-demote removal, `{id, user_id}` POST + poll, `snapshot_instance_id` removal) with before/after; TS-clean confirmation; anything flagged. **Note:** WF-AS-02 must be manually updated to key on `id` (frontend now sends `{id, user_id}`) for end-to-end synthesis.
