# Handoff Task Spec — #31: Agency Snapshot / Revenue Model — Versioning + `is_current` Rework (Frontend + DB Trigger + RLS + Cross-tab)

> **Status:** Ready for execution. **Frontend + Supabase only — NO n8n.** The WF-AS-03 workflow changes are **manual** (London) in `docs/handoffs/31-rm-versioning-rework-n8n-manual-walkthrough.md`. Do **not** edit/create/call n8n.
> **Source of truth:** `docs/content-provenance-manifest.md` → §2 Agency Snapshot / Revenue Model (mapping + open build items).
> **Precedent:** mirrors **#29 / #30**. Read `docs/handoffs/30-ef-versioning-rework-task-spec.md` for the established pattern; this notes only the Revenue-Model differences — and RM has **three extra items** EF didn't.
> **Project:** Supabase `pwacpjqkntnovndhspxt`. DDL via `apply_migration`.
> **Role boundary:** Executing agent. Verify live schema first. Non-destructive. Flag, don't improvise.

---

## Objective

Bring Revenue Model to the same **content-addressed versioning** model as MF (#29) and EF (#30): one row per unique input combination per user; `input_hash` identifies a combination; `is_current=true` marks the active version (exactly one per user, DB-enforced); synthesis cached per row; reactivation re-promotes without re-synthesizing; net-new inserts + promotes-on-insert + synthesizes.

**RM starts furthest behind** — it doesn't use `is_current` at all today (load is `created_at desc`, save is insert-only with no `is_current`/demote), the table is **missing an UPDATE RLS policy**, and the calc inputs depend on Economic Foundation's `monthly_agi`.

---

## Context (verify first)

- Table `agency_snapshot_revenue_model` (50 cols): 13 intake fields, 13 **persisted calculated** columns, synthesis + the same `is_current`/`snapshot_instance_id`/`input_hash` envelope. **No `version_number`.** Triggers: only `update_growth_pipeline_updated_at`. Indexes: pkey + `idx_revenue_model_user_created` (no `is_current` index). RLS: **only own-row INSERT + SELECT — no UPDATE, no DELETE.** Currently empty (seed cleared) → backfill no-op.
- Component: `pages/SnapshotPages.tsx › GrowthPipeline` (inline). Saved-profile render `components/snapshot/GrowthProfile.tsx` (no change). Calc metrics need `monthly_agi` fetched from `agency_snapshot_economic_foundation`.
- Current load: `…eq('user_id').order('created_at',{ascending:false}).limit(1).single()` (no `is_current`). Current save: INSERT only; no `is_current` set, no demote; `snapshot_instance_id = existing || crypto.randomUUID()` (reused).

---

## In scope

### A. Supabase migration(s)

1. **Add own-row UPDATE RLS policy** (CRITICAL — without it the reactivation update *and* the demotion trigger are blocked):
   ```sql
   create policy "Users can update their own revenue model data"
     on public.agency_snapshot_revenue_model for update
     using (auth.uid() = user_id) with check (auth.uid() = user_id);
   ```
2. **Add** `version_number integer` (nullable).
3. **Backfill** (no-op while empty; keep for safety): per `user_id`, `version_number` by `created_at` asc; most-recent row per user `is_current=true`, others `false`. Delete nothing.
4. **Trigger** `fn_rm_versioning` + `trg_rm_versioning` (`BEFORE INSERT OR UPDATE`, per row): assign `version_number = coalesce(max,0)+1` per user on insert; when `NEW.is_current` is true, demote siblings (`user_id=NEW.user_id AND id<>NEW.id AND is_current`). Same shape as `fn_ef_versioning`.
5. **Partial unique index** `uq_rm_one_current_per_user UNIQUE (user_id) WHERE is_current`. (Leave `idx_revenue_model_user_created`.)

### B. Frontend — `pages/SnapshotPages.tsx › GrowthPipeline`

1. **Canonical `input_hash`** over the **13 intake fields only** (not the calculated metrics, not `monthly_agi`): `revenue_mix_mrr_percentage, active_client_count, client_tier_mix, monthly_churn_rate, average_client_lifetime_months, typical_win_rate, average_sales_cycle, channel_referrals_rank, channel_partnerships_rank, channel_content_rank, channel_paid_rank, channel_outbound_rank, concentration_top5_pct, concentration_top10_pct, concentration_top20_pct`. Fixed key order; numbers `undefined→null`; strings trimmed `''→null` → SHA-256 hex. (Same approach as `computeEFInputHash`.)
2. **Load:** switch from `order('created_at' desc)` to **`…eq('user_id').eq('is_current', true).maybeSingle()`**; store the row's `id` as `currentRowId`. Keep hydrating form + calc + synthesis state.
3. **Cross-tab AGI fetch:** when fetching Economic Foundation `monthly_agi` for the calc inputs, query EF by **`is_current=true`** (not `created_at desc`).
4. **Save (reactivate-or-insert)** — replace the current insert-only save:
   - Compute `h = input_hash`.
   - Look up `…eq('user_id').eq('input_hash', h).limit(1).maybeSingle()`.
   - **Match (resurfaced):** `update({ is_current:true, updated_at }).eq('id', match.id)` (trigger demotes others); set `currentRowId = match.id`; hydrate cached synthesis. **No insert; no workflow.**
   - **No match (net-new):** `insert({ …13 inputs, …13 calculated metrics, input_hash:h, is_current:true, is_complete:true, user_id })` — **omit** `version_number` (trigger), `snapshot_instance_id` (stop using; leave null), synthesis cols; `.select().single()` → `currentRowId`; clear synthesis state.
   - **Remove** `crypto.randomUUID()` `snapshot_instance_id` generation and all `snapshot_instance_id` usage.
5. **Submit for Synthesis:** POST `{ id: currentRowId, user_id }` (drop `snapshot_instance_id` + `force`); set `running`; **poll by `id`**.
6. **Fix the save-disabled-on-`complete` quirk:** gate Save on validity / dirty state, **not** on `synthesisStatus==='complete'`, so a new version can be saved after a prior synthesis.

---

## Out of scope

- **No n8n** (manual, separate). **No dashboard work.** `snapshot_instance_id` stays null (dashboard-owned).
- No changes to the calc formulas, `GrowthProfile.tsx`, other sub-tabs, the webhook secret, or the `alert()` UX (beyond the save-gating fix).
- No row deletions.

---

## Constraints

- Non-destructive, idempotent migrations; verify live schema first.
- Trigger + reactivation run under the user's RLS — the new UPDATE policy must be in place for them to work; confirm.
- Deterministic hash (fixed key order; normalized). TypeScript-clean; no visual/AOS changes.

---

## Acceptance criteria

1. UPDATE RLS policy exists; `version_number` exists; trigger assigns it + enforces single `is_current` per user; partial unique index present and blocks a second current.
2. Save computes the canonical hash; **resurfaced** combination re-promotes the existing row (no new row, no workflow, cached synthesis shown); **net-new** inserts + promotes-on-insert (`version_number` via trigger; `snapshot_instance_id` null).
3. Load reads `is_current=true`; EF `monthly_agi` fetched by `is_current`; poll + synthesis POST key on row `id` (`{id, user_id}`).
4. No `snapshot_instance_id` keying remains in `GrowthPipeline`; calc metrics still computed + persisted; save no longer permanently disabled after a complete synthesis.
5. TypeScript clean; no visual changes.

---

## Verification (SQL + code, written, no screenshots)

1. **SQL:** confirm the UPDATE policy exists. Insert two distinct RM combinations for a test `user_id` → two rows, one `is_current`, `version_number` 1 then 2; reactivating the first flips current with **no third row**; unique index blocks two currents. Clean up.
2. **Code:** show the hash fn (15 fields incl. channel ranks + concentration), the `is_current` load + `currentRowId`, the EF-AGI `is_current` fetch, the reactivate-vs-insert branch, the `{id, user_id}` POST + poll-by-`id`, and the save-gating fix. Grep-confirm no `snapshot_instance_id` usage remains in `GrowthPipeline`.
3. Confirm TypeScript-clean build.

---

## Report-back format

Migrations + DDL (UPDATE policy, trigger/function/index, version_number); SQL verification (policy present, two-combo insert, reactivation, unique-index block); frontend before/after (hash, is_current load, EF-AGI is_current fetch, reactivate-vs-insert, `{id,user_id}` POST + poll, save-gating fix, snapshot_instance_id removal); TS-clean; flags. **Note:** WF-AS-03 must be manually updated to key on `id`.
