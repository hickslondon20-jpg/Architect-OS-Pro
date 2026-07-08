# Handoff — Seed Tier-1 Wiki Source Tables (standalone task)

> Paste the block below to a **fresh assistant in its own thread.** This is a focused,
> self-contained data-seeding task — deliberately kept out of the strategy thread. It seeds one
> realistic entry into each Tier-1 wiki source table for a single test account so all 7 Tier-1
> wiki pages have source data for future compile testing. It is **data seeding only — no code,
> no schema changes, no synthesis build.**

---

You are a **data-seeding assistant** for ArchitectOS Pro (Supabase project `pwacpjqkntnovndhspxt`).
Your one job: seed **one realistic, FK-valid row into each source table below** for a single test
account, so the 7 Tier-1 wiki pages have data to compile from later. Data inserts only — **no DDL,
no code, no app changes.**

**Test account (owner):** `user_id = 4ef8c0e3-d0bf-4420-990d-3d5dbe1aa1aa`
- Most tables key on `user_id`. Known exception: `gm_assessments` uses `respondent_user_id`.
  **Verify each table's owner column from its schema** before inserting.

**Tools:** use the Supabase MCP (`list_tables` verbose to read columns/PKs/FKs/constraints;
`execute_sql` to insert). **Always inspect a table's schema and FK dependencies before inserting.**

## Method (per table)
1. Read the schema: columns, NOT NULL, enums/check constraints, FKs.
2. **Seed parents before children** (e.g. an `ae_assessments` row before `ae_responses`; a
   `gm_assessments` row before its score children; a `cc_versions` row before `cc_synthesis`).
3. Insert **one** minimal-but-realistic row that satisfies all constraints, owned by the account.
4. Prefer a recognizable marker in a free-text/name field (e.g. prefix `SEED —`) so rows are
   identifiable for cleanup. Record every insert.
5. **Skip database VIEWS** (`vw_*`, `*_v`) — they derive from base tables, you don't insert into them.
6. **Reference/lookup tables** (`*_ref_table` — agency type / services / industries) are likely
   global lookups, not per-user. Confirm; only seed if the schema shows they're user-scoped and empty.
7. If a table can't be seeded (unclear required FK, opaque constraint), **skip and report it** — do
   not force it.

## Already populated (do NOT duplicate — augment only if a child row needs a specific parent)
`ae_assessments` (1), `gm_assessments` (2), `quarter_map_selections` (1), `cc_versions` (2).
Everything else below is empty for this account.

## Tables to seed, grouped by the wiki page they feed

**Diagnostic Synthesis:** `ae_assessments`, `ae_responses`, `ae_assessment_snapshots`,
`ae_dimension_scores`, `ae_assessment_insights`, `gm_assessments` (`respondent_user_id`),
`gm_assessment_responses`, `gm_assessment_checkpoint_scores`, `gm_assessment_capability_scores`,
`gm_assessment_dimension_scores`, `gm_assessment_pillar_scores`, `gm_assessment_overall_scores`,
`gm_assessment_gpt_outputs`, `gm_capability_rankings`. *(Views `vw_ae_dashboard_results`,
`vw_ae_stage_context` — skip.)*

**Current Quarter / Sprint:** `quarter_map_selections`, `sp_sprint_goals`, `sp_sprint_initiatives`,
`sp_sprint_milestones`.

**Business Context:** `cc_versions`, `cc_synthesis`, `cc_drafts_global`,
`cc_version_horizon_snapshots`, `clarity_compass_versions`.

**Growth Constraints:** (`gm_*` + `quarter_map_selections` + `cc_*` above, plus)
`gvs_saved_growth_scenarios`, `gvs_comparison_runs`. **Important linkage:** `cc_synthesis` is meant
to link to a **GVS growth scenario** for the founder's selected Clarity Compass horizon — seed the
`cc_synthesis` row and the linked `gvs_*` scenario row **so that FK relationship is populated and
traversable** (this link drives the Growth Constraints page).

**Financial Context:** `agency_snapshots`, `agency_snapshot_economic_foundation`,
`agency_snapshot_revenue_model`, `agency_snapshot_delivery_architecture`, `founder_datasets`,
`founder_dataset_rows`, `ose_raw_document_registry`, `document_chunks`. *(View `founder_dataset_rows_v`
— skip.)*

**Client / Market Position:** `agency_snapshot_market_footprint`, `agency_snapshot_revenue_model`,
`gvs_growth_scenarios`, `gvs_saved_growth_scenarios`, `gvs_comparison_runs`, `gvs_scenario_synthesis`.
*(`agency_snapshot_agency_type_ref_table`, `agency_snapshot_services_ref_table`,
`agency_snapshot_industries_ref_table` — likely global ref tables; confirm, seed only if user-scoped.)*

**Open Questions:** no source tables (derives from wiki validation) — nothing to seed.

## ⚠️ Flag to the founder before you insert
This is the founder's **real/admin account**, so seeded mock rows may appear in their live platform
views (e.g. a fake sprint goal). Before bulk-inserting, confirm with the founder: **seed into this
account (mock data will show in their UI; tag with `SEED —` and provide a cleanup script)**, or
**use a separate dedicated test user** instead. Proceed per their answer.

## Deliverable
A **seed report**: table → row(s) inserted → the FK chain used → any tables skipped/blocked and why →
a **cleanup script** (delete all `SEED —`-marked rows for this account). Do not modify or delete any
pre-existing real rows.
