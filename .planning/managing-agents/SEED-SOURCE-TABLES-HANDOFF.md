# Handoff — Seed Tier-1 Wiki Source Tables (historical record)

> Standalone data-seeding task, run in its own thread. Recreated 2026-07-08. **Outcome:** seeded a fresh
> dedicated test user `cd490873-99aa-4533-9240-f0aa04deb54f` (email `hicks.london25@gmail.com`) with one
> FK-valid row across every source table for the 7 Tier-1 pages; nothing skipped; the GVS save-trigger bug
> was found here (see `.planning/codebase/CONCERNS.md`). Full detail: seed report `seed-report-test-user-2026-07-08.md`.

---

You are a **data-seeding assistant** for ArchitectOS Pro (Supabase `pwacpjqkntnovndhspxt`). Seed **one
realistic, FK-valid row into each source table** for a single test account so the 7 Tier-1 wiki pages have
data to compile from. **Data inserts only — no DDL, no code.**

**Account:** decision made to use a **fresh dedicated test user** rather than the founder's real account
(`4ef8c0e3-…`), so mock data doesn't appear in the founder's live views. Most tables key on `user_id`;
`gm_assessments` uses `respondent_user_id`. Verify each table's owner column from schema.

**Tools:** Supabase MCP (`list_tables` verbose to read columns/PKs/FKs; `execute_sql` to insert). Inspect
schema + FK deps before each insert.

**Method:** seed parents before children; insert one minimal-but-realistic row satisfying all constraints,
owned by the account; prefix free-text/name fields with `SEED —` for cleanup; skip DB VIEWS (`vw_*`, `*_v`);
confirm ref/lookup tables (`*_ref_table`) are global before touching; skip + report anything unseedable.

**Tables by wiki page:**
- **Diagnostic Synthesis:** `ae_assessments`, `ae_responses`, `ae_assessment_snapshots`, `ae_dimension_scores`,
  `ae_assessment_insights`, `gm_assessments` (`respondent_user_id`), `gm_assessment_responses`,
  `gm_assessment_checkpoint_scores`, `gm_assessment_capability_scores`, `gm_assessment_dimension_scores`,
  `gm_assessment_pillar_scores`, `gm_assessment_overall_scores`, `gm_gpt_runs` (parent), `gm_assessment_gpt_outputs`,
  `gm_capability_rankings`.
- **Current Quarter / Sprint:** `quarter_map_selections`, `sp_sprint_goals`, `sp_sprint_initiatives`, `sp_sprint_milestones`.
- **Business Context:** `cc_versions`, `cc_synthesis`, `cc_drafts_global`, `cc_version_horizon_snapshots`, `clarity_compass_versions`.
- **Growth Constraints:** (`gm_*` + `quarter_map_selections` + `cc_*` above, plus) `gvs_growth_scenarios`,
  `gvs_saved_growth_scenarios`, `gvs_scenario_synthesis`, `gvs_comparison_runs`. **Seed the CC→GVS chain so it's
  traversable:** `cc_synthesis` has no scenario column — the link is `cc_version_horizon_snapshots.scenario_id →
  gvs_saved_growth_scenarios` (which back-links `runtime_scenario_id → gvs_growth_scenarios`).
- **Financial Context:** `agency_snapshots` + `agency_snapshot_economic_foundation`/`revenue_model`/`delivery_architecture`/`market_footprint`,
  `founder_datasets`/`_tables`/`_columns`/`_rows`, `ose_raw_document_registry`, `document_chunks`.
- **Client / Market Position:** covered by `agency_snapshot_market_footprint`/`revenue_model` + `gvs_*` above.
  The `agency_snapshot_*_ref_table` tables are global lookups — not seeded.
- **Open Questions:** no source tables.

**Deliverable:** a seed report (table → rows → FK chain → skips + why) + a cleanup script scoped to the test
user's rows. Do not modify pre-existing real rows. Flag any bugs found (a broken trigger was found here).
