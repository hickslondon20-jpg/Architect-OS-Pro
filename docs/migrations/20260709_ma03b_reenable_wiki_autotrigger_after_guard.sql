-- MA-03B operational re-enable.
-- Applied live on 2026-07-09 after the anti-clobber guard was committed and all
-- seven Tier-1 wiki pages were verified with real Claude synthesis and embeddings.

alter table public.ae_assessment_snapshots enable trigger trg_wiki_autotrigger_ae_snapshot;
alter table public.agency_snapshot_delivery_architecture enable trigger trg_wiki_autotrigger_delivery_architecture;
alter table public.agency_snapshot_economic_foundation enable trigger trg_wiki_autotrigger_econ_foundation;
alter table public.agency_snapshot_market_footprint enable trigger trg_wiki_autotrigger_market_footprint;
alter table public.agency_snapshot_revenue_model enable trigger trg_wiki_autotrigger_revenue_model;
alter table public.cc_synthesis enable trigger trg_wiki_autotrigger_cc_synthesis;
alter table public.founder_dataset_rows enable trigger trg_wiki_autotrigger_dataset_rows;
alter table public.gm_assessment_overall_scores enable trigger trg_wiki_autotrigger_gm_overall;
alter table public.gm_capability_rankings enable trigger trg_wiki_autotrigger_capability_rankings;
alter table public.gvs_scenario_synthesis enable trigger trg_wiki_autotrigger_scenario_synthesis;
alter table public.sp_sprint_goals enable trigger trg_wiki_autotrigger_sprint_goals;
alter table public.sp_sprint_initiatives enable trigger trg_wiki_autotrigger_sprint_initiatives;
alter table public.sp_sprint_milestones enable trigger trg_wiki_autotrigger_sprint_milestones;
