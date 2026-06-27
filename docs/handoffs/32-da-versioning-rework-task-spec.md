# Handoff Task Spec — #32: Agency Snapshot / Delivery Architecture — Versioning + `is_current` Rework (Frontend + DB Trigger)

> **Status:** Ready for execution. **Frontend + Supabase only — NO n8n.** WF-AS-04 changes are **manual** (London) in `docs/handoffs/32-da-versioning-rework-n8n-manual-walkthrough.md`. Do **not** edit/create/call n8n.
> **Source of truth:** `docs/content-provenance-manifest.md` → §2 Agency Snapshot / Delivery Architecture.
> **Precedent:** mirrors **#30** (Economic Foundation) almost exactly — Delivery is in the same shape EF was (load-on-`is_current` + insert+demote already present; UPDATE RLS policy already present; cross-tab AGI fetch already `is_current`). Read `docs/handoffs/30-ef-versioning-rework-task-spec.md` for the pattern; this notes the Delivery differences.
> **Project:** Supabase `pwacpjqkntnovndhspxt`. DDL via `apply_migration`.
> **Role boundary:** Executing agent. Verify live schema first. Non-destructive. Flag, don't improvise.

---

## Objective

Bring Delivery Architecture to the content-addressed versioning model (as #29/#30/#31): one row per unique input combination per user; `input_hash` identifies a combination; `is_current=true` marks the active version (exactly one per user, DB-enforced); synthesis cached per row; reactivation re-promotes without re-synthesizing; net-new inserts + promotes-on-insert + synthesizes.

**Delivery is the lightest of the four** — load already filters `is_current`, the EF-AGI cross-tab fetch is already `is_current`, save already inserts+demotes, and the UPDATE RLS policy already exists. The gaps are `input_hash`/reactivation, `version_number`, the demotion trigger + unique index, and `id`-keying.

---

## Context (verify first)

- Table `agency_snapshot_delivery_architecture` (37 cols): 11 intake fields (incl. two `text[]` multi-selects `key_leadership_roles`, `specialized_roles`), 4 **persisted calculated** cols (`agi_per_fte_monthly/annual`, `billable_ratio_calculated`, `contractor_percentage_calculated`), synthesis + the same `is_current`/`snapshot_instance_id`/`input_hash` envelope. **No `version_number`.** **No triggers at all** (not even `updated_at`). Indexes: pkey + `idx_delivery_architecture_user_id` + `idx_delivery_architecture_user_current` (plain). RLS: own-row SELECT/INSERT/UPDATE/DELETE all present (with **redundant duplicate** INSERT/UPDATE/SELECT policies — leave them). Currently empty → backfill no-op.
- Component: `pages/SnapshotPages.tsx › DeliveryArchitectureTab` (inline). Saved-profile render `components/snapshot/TeamProfile.tsx` (no change). Calc `agi_per_fte` needs EF `monthly_agi` — **already fetched by `is_current`** (no change needed).
- Current load: `…eq('user_id').eq('is_current', true).maybeSingle()` (good). Current save: `update is_current=false where user_id` (blanket demote) then INSERT; `snapshot_instance_id = existing || crypto.randomUUID()` (reused).

---

## In scope

### A. Supabase migration(s) — mirror #30 on this table

1. **Add** `version_number integer` (nullable).
2. **Backfill** (no-op while empty; keep for safety): per `user_id`, `version_number` by `created_at` asc; most-recent row per user `is_current=true`, others `false`. Delete nothing.
3. **Trigger** `fn_da_versioning` + `trg_da_versioning` (`BEFORE INSERT OR UPDATE`, per row): assign `version_number = coalesce(max,0)+1` per user on insert; when `NEW.is_current` is true, demote siblings (`user_id=NEW.user_id AND id<>NEW.id AND is_current`). Same shape as `fn_ef_versioning`.
4. **Partial unique index** `uq_da_one_current_per_user UNIQUE (user_id) WHERE is_current`. (Leave the plain `idx_delivery_architecture_user_current`.)
5. **No RLS change** — the own-row UPDATE policy already exists. (Optional, low priority: dedupe the redundant duplicate policies — not required.)

### B. Frontend — `pages/SnapshotPages.tsx › DeliveryArchitectureTab`

1. **Canonical `input_hash`** over the **11 intake fields only** (not the 4 calculated metrics, not `monthly_agi`): `total_team_size_fte, billable_staff_count, non_billable_staff_count, team_structure_type, founder_time_allocation, average_team_utilization, average_contractor_count, key_leadership_roles[] (sorted), management_layers, specialized_roles[] (sorted), average_team_experience`. Fixed key order; numbers `undefined→null`; strings trimmed `''→null`; the two `text[]` arrays **sorted** before hashing → `JSON.stringify` → SHA-256 hex. (Same approach as `computeEFInputHash`.)
2. **Load:** keep the existing `is_current=true` read; additionally store the loaded row's **`id`** as `currentRowId`. (No change to the EF-AGI fetch — already `is_current`.)
3. **Save (reactivate-or-insert)** — replace the current "blanket demote then insert":
   - Compute `h = input_hash`.
   - Look up `…eq('user_id').eq('input_hash', h).limit(1).maybeSingle()`.
   - **Match:** `update({ is_current:true, updated_at }).eq('id', match.id)` (trigger demotes others); set `currentRowId`; hydrate cached synthesis. No insert; no workflow.
   - **No match:** `insert({ …11 inputs, …4 calculated metrics, input_hash:h, is_current:true, is_complete:true, user_id })` — **omit** `version_number` (trigger), `snapshot_instance_id` (stop using; null), synthesis cols; `.select().single()` → `currentRowId`; clear synthesis state. **Remove the blanket `update is_current=false`.**
   - **Remove** `crypto.randomUUID()` `snapshot_instance_id` generation + all `snapshot_instance_id` usage.
4. **Submit for Synthesis:** POST `{ id: currentRowId, user_id }` to `${VITE_N8N_WEBHOOK_URL}/agency-snapshot/delivery/synthesize` (drop `snapshot_instance_id` + `force`); set `running`; **poll by `id`**.
5. Calculated metrics unchanged (still computed + persisted on insert). The `text[]` multi-selects continue to save as arrays.

---

## Out of scope

- **No n8n** (manual, separate). **No dashboard work.** `snapshot_instance_id` stays null (dashboard-owned).
- No changes to calc formulas, `TeamProfile.tsx`, other sub-tabs, the webhook secret, or the `alert()` UX.
- No row deletions. Don't add an RLS policy (already present); don't remove the duplicate policies unless trivial.

---

## Constraints

- Non-destructive, idempotent migrations; verify live schema first.
- Trigger + reactivation run under the existing own-row UPDATE policy — confirm they work under RLS.
- Deterministic hash (fixed key order; sorted arrays; normalized scalars). TypeScript-clean; no visual/AOS changes.

---

## Acceptance criteria

1. `version_number` exists; `trg_da_versioning` assigns it + enforces single `is_current` per user; partial unique index present and blocks a second current.
2. Save computes the canonical hash; **resurfaced** combination re-promotes the existing row (no new row, no workflow, cached synthesis); **net-new** inserts + promotes-on-insert (`version_number` via trigger; `snapshot_instance_id` null).
3. Blanket frontend demote removed; load reads `is_current=true`; poll + synthesis POST key on row `id` (`{id, user_id}`).
4. No `snapshot_instance_id` keying remains in `DeliveryArchitectureTab`; calc metrics + `text[]` arrays still persist; EF-AGI fetch still `is_current`.
5. TypeScript clean; no visual changes.

---

## Verification (SQL + code, written, no screenshots)

1. **SQL:** insert two distinct DA input combinations for a test `user_id` → two rows, one `is_current`, `version_number` 1 then 2; reactivating the first flips current with **no third row**; unique index blocks two currents. Clean up.
2. **Code:** show the hash fn (11 fields incl. the 2 sorted arrays), the `currentRowId` capture, the reactivate-vs-insert branch (blanket demote removed), the `{id, user_id}` POST + poll-by-`id`. Grep-confirm no `snapshot_instance_id` usage remains in `DeliveryArchitectureTab`.
3. Confirm TypeScript-clean build.

---

## Report-back format

Migrations + DDL (trigger/function/index; `version_number`); SQL verification (two-combo insert, reactivation, unique-index block); frontend before/after (hash, `currentRowId`, reactivate-vs-insert, blanket-demote removal, `{id,user_id}` POST + poll, `snapshot_instance_id` removal); TS-clean; flags. **Note:** WF-AS-04 must be manually updated to key on `id`.
