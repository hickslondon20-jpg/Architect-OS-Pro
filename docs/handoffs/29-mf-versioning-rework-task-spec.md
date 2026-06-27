# Handoff Task Spec — #29: Agency Snapshot / Market Footprint — Versioning + `is_current` Rework (Frontend + DB Trigger)

> **Status:** Ready for execution. **Frontend + Supabase only — NO n8n.** The WF-AS-01 workflow changes are **manual** (London) and specified separately in `docs/handoffs/29-mf-versioning-rework-n8n-manual-walkthrough.md`. Do **not** attempt to edit, create, or call n8n.
> **Source of truth:** `docs/content-provenance-manifest.md` → §2 Agency Snapshot / Market Footprint (mapping + open build items).
> **Companions:** `CLAUDE.md` (architecture rules — AI synthesis stays in n8n; this unit touches none of it), the n8n manual walkthrough (above).
> **Project:** Supabase `pwacpjqkntnovndhspxt`. All DDL/data via `apply_migration`, matching `docs/migrations/`.
> **Role boundary:** Executing agent. **Verify the live schema before changing.** Non-destructive. Deterministic. Flag, don't improvise.

---

## Objective

Convert Market Footprint from **single-row-per-user overwrite** to **content-addressed versioning**:

- One row per **unique input combination** per user in `agency_snapshot_market_footprint`.
- `input_hash` = a canonical content hash of the meaningful inputs (frontend-owned).
- `is_current = true` marks the **active** version; **exactly one** per user, enforced by a DB trigger + partial unique index.
- Synthesis is cached on each row. Re-selecting a previously-recorded combination **re-promotes that row without re-synthesizing** (Option A — handled at save, **no workflow call**).
- A genuinely new combination inserts a new row, promotes it to current **on insert**, and triggers synthesis (running/error states shown).
- `version_number` increments per user (viewable run count).
- `snapshot_instance_id` is **dashboard-owned** — this unit must **stop using/writing it** at the sub-tab level (leave `null`).

---

## Context (verify first)

- Table `agency_snapshot_market_footprint` already has: intake columns, synthesis columns (`synthesis_beat_1..3` + `_headline`, `synthesis_signal`, `synthesis_payload`), async envelope (`synthesis_status`, `input_hash`, `synthesis_model`, `prompt_version`, `synthesis_error`, `synthesis_generated_at`, `is_complete`), `is_current` (bool, default true), `snapshot_instance_id` (uuid, nullable), timestamps. **No `version_number` column yet.**
- RLS is enabled with own-row policies (`auth.uid() = user_id`) for SELECT/INSERT/UPDATE/DELETE. Ref tables have authenticated SELECT.
- Live data is seed/test: 4 rows, **0** `is_current=true`, one user with 2 rows. Backfill must make this consistent (see migration).
- Component: `components/snapshot/IdentityPositioningTab.tsx` (Market Footprint form + profile + synthesis render). `pages/SnapshotPages.tsx › IdentityPositioning` just wraps it.

---

## In scope

### A. Supabase migration(s) — `apply_migration`

1. **Add column** `version_number integer` (nullable) to `agency_snapshot_market_footprint`.
2. **Backfill (one-time):** per `user_id`, set `version_number` by `created_at` ascending (1,2,…); set `is_current = true` on each user's **most-recent** row (`created_at` desc), `false` on the rest. Do **not** delete any rows.
3. **Trigger function + trigger** (`BEFORE INSERT OR UPDATE` on the table, `FOR EACH ROW`):
   - On `INSERT`, if `NEW.version_number IS NULL`, set it to `coalesce(max(version_number),0)+1` for that `user_id`.
   - When `NEW.is_current IS TRUE`, demote siblings: `UPDATE … SET is_current=false WHERE user_id=NEW.user_id AND id<>NEW.id AND is_current`. (Demotion sets others to `false`, whose re-fire of the trigger is a no-op because `NEW.is_current` is false — no recursion.)
4. **Partial unique index:** `UNIQUE (user_id) WHERE is_current` — hard guarantee of one current per user. (The `BEFORE` trigger demotes siblings before the row commits, so the index is satisfied.)

Reference implementation (adapt to migration conventions; confirm names against live schema first):

```sql
alter table public.agency_snapshot_market_footprint
  add column if not exists version_number integer;

with ranked as (
  select id,
         row_number() over (partition by user_id order by created_at asc)  as vn,
         row_number() over (partition by user_id order by created_at desc) as rn_desc
  from public.agency_snapshot_market_footprint
)
update public.agency_snapshot_market_footprint m
set version_number = r.vn,
    is_current     = (r.rn_desc = 1)
from ranked r
where r.id = m.id;

create or replace function public.fn_mf_versioning()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' and new.version_number is null then
    select coalesce(max(version_number),0)+1 into new.version_number
    from public.agency_snapshot_market_footprint
    where user_id = new.user_id;
  end if;

  if new.is_current is true then
    update public.agency_snapshot_market_footprint
      set is_current = false
      where user_id = new.user_id and id <> new.id and is_current is true;
  end if;

  return new;
end $$;

drop trigger if exists trg_mf_versioning on public.agency_snapshot_market_footprint;
create trigger trg_mf_versioning
  before insert or update on public.agency_snapshot_market_footprint
  for each row execute function public.fn_mf_versioning();

create unique index if not exists uq_mf_one_current_per_user
  on public.agency_snapshot_market_footprint (user_id) where is_current;
```

### B. Frontend — `components/snapshot/IdentityPositioningTab.tsx`

1. **Canonical content hash.** Compute `input_hash` over the meaningful inputs, order-stable so the same combination always hashes identically. Build a canonical object with **sorted** uuid arrays (the same filtered arrays written to the DB — `'other'`/`'generalist'` stripped) and normalized scalars (`trim`, `'' → null`), in a fixed key order, then SHA-256 → hex (Web Crypto `crypto.subtle.digest('SHA-256', …)`). Fields, in order:
   `agency_types[] (sorted)`, `agency_types_other`, `services_offered[] (sorted)`, `services_offered_other`, `industries_served[] (sorted)`, `industries_served_other`, `geographic_footprint`, `pricing_strategies[] (sorted)`, `website_url`, `positioning_context`.
2. **Load (on mount):** read the user's current version —
   `select('*').eq('user_id', user.id).eq('is_current', true).maybeSingle()` — hydrate form + synthesis state, and store its `id` as `currentRowId`. (Replaces the unfiltered `maybeSingle()` that breaks on multi-row users.)
3. **Save logic (Option A — reactivate-or-insert):**
   - Compute `h = input_hash` of the current form.
   - Look up `select('*').eq('user_id', user.id).eq('input_hash', h).limit(1).maybeSingle()`.
   - **Resurfaced (match found):** `update({ is_current: true, updated_at }).eq('id', match.id)` (the trigger demotes others); hydrate that row's cached synthesis into state; set `currentRowId = match.id`. **Do not insert; do not call the workflow.**
   - **Net-new (no match):** `insert({ …intake columns (uuid arrays filtered), input_hash: h, is_current: true, is_complete: true, user_id })` — **do not set** `version_number` (trigger assigns) or `snapshot_instance_id` (leave null) or `synthesis_status` (leave null/idle); `.select('id').single()` → set `currentRowId`; clear synthesis state. (Promote-on-insert: the new row is current immediately; the trigger demotes the prior current.)
4. **Submit for Synthesis:** ensure saved first (run save if dirty). If `currentRowId`'s row already has a **complete** synthesis (resurfaced/cached), do nothing. Otherwise POST `{ id: currentRowId, user_id }` to `${VITE_N8N_WEBHOOK_URL}/agency-snapshot/market-footprint/synthesize` (drop `snapshot_instance_id` and `force` from the payload), set status `running`, and **poll by `id`**: `select(<synthesis cols>).eq('id', currentRowId).single()` until `synthesis_status ∈ {complete, error}`.
5. **Remove `snapshot_instance_id`** generation (`crypto.randomUUID()`) and all sub-tab usage of it. It stays `null` until the dashboard owns it.
6. **Save-button gating:** disabled unless the form differs from the loaded **current** version (dirty-check against the hydrated current row, not a stale `initialData`). A no-op save must not be possible.

---

## Out of scope (do not do)

- **No n8n** — the WF-AS-01 edits are manual (separate doc). Do not edit/create/call workflows.
- **No dashboard work**; do not write/manage `snapshot_instance_id` here.
- **No changes to the other three sub-tabs** (Economic Foundation / Revenue Model / Delivery).
- **No row deletions** — seed/test rows stay (backfill makes them consistent).
- **No visual/AOS changes**; don't touch the static right-panel sidebar or the dead `SERVICE_OPTIONS`/`INDUSTRY_OPTIONS` consts (separate cleanup item).
- Do not change the webhook secret handling (parked config item).

---

## Constraints

- Non-destructive, idempotent migrations; canonical names; verify live schema before DDL.
- Trigger runs under invoker rights and only touches the user's own rows — confirm it functions under RLS.
- TypeScript/build clean. No new TS errors. No design regressions.
- Hash must be deterministic across reloads and selection order (sorted arrays, normalized scalars).

---

## Acceptance criteria

1. `version_number` column exists; existing rows backfilled; each user has exactly one `is_current=true` row post-migration.
2. Trigger assigns `version_number` on insert and enforces single `is_current` per user; partial unique index present and blocks a second current.
3. Load reads the `is_current=true` row; multi-row users no longer break (`maybeSingle` safe under the unique index).
4. Save computes the canonical hash; **resurfaced** combination re-promotes the existing row (is_current flips, cached synthesis shown, **no new row, no workflow call**); **net-new** inserts a new row, promotes it on insert, increments `version_number`, leaves `snapshot_instance_id` null.
5. Submit posts `{ id, user_id }` and polls by `id`; a net-new row pre-synthesis renders the idle state, `running`/`error` states render correctly.
6. No `snapshot_instance_id` keying remains in the Market Footprint component.
7. TypeScript clean; no visual changes.

---

## Verification (before reporting done — SQL + code, written, no screenshots)

1. **SQL:** insert two distinct input combinations for a test `user_id` → two rows, exactly one `is_current`, `version_number` 1 then 2. Update the first row `is_current=true` (reactivation) → it becomes current, the other flips false, **no third row**, `version_number` unchanged. Attempt to set two rows current in one statement path → blocked by the unique index. Clean up test rows afterward.
2. **SQL:** confirm the backfill left each existing user with exactly one current row and sequential `version_number`.
3. **Code:** show the hash function (fields + sort + normalize + SHA-256), the load query, the reactivate-vs-insert branch, and the `{ id, user_id }` POST + poll-by-`id`. Grep-confirm no remaining `snapshot_instance_id` usage in the component.
4. Confirm build is TypeScript-clean.

---

## Report-back format

Migrations added (one-line intent each) + the trigger/function/index DDL; backfill result (rows per user, version numbers, current counts); the SQL verification output (two-combo insert, reactivation, unique-index block); the frontend changes (hash, load, save branch, submit/poll, snapshot_instance_id removal, save gating) with before/after notes; confirmation of TS-clean build and no visual changes; anything flagged rather than decided. **Note:** the n8n workflow must be updated manually (separate doc) for end-to-end synthesis — call out that the frontend now sends `{ id, user_id }` so the workflow must key on `id`.
