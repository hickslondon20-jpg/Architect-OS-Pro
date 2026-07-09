-- MA-03B operational pause.
-- Applied live on 2026-07-09 after the real-synthesis smoke proved Claude auth was not
-- available in the local process. Keep these triggers disabled until the anti-clobber
-- guard is deployed and real synthesis has been verified by outcome.

alter table public.ae_assessment_snapshots disable trigger trg_wiki_autotrigger_ae_snapshot;
alter table public.agency_snapshot_delivery_architecture disable trigger trg_wiki_autotrigger_delivery_architecture;
alter table public.agency_snapshot_economic_foundation disable trigger trg_wiki_autotrigger_econ_foundation;
alter table public.agency_snapshot_market_footprint disable trigger trg_wiki_autotrigger_market_footprint;
alter table public.agency_snapshot_revenue_model disable trigger trg_wiki_autotrigger_revenue_model;
alter table public.cc_synthesis disable trigger trg_wiki_autotrigger_cc_synthesis;
alter table public.founder_dataset_rows disable trigger trg_wiki_autotrigger_dataset_rows;
alter table public.gm_assessment_overall_scores disable trigger trg_wiki_autotrigger_gm_overall;
alter table public.gm_capability_rankings disable trigger trg_wiki_autotrigger_capability_rankings;
alter table public.gvs_scenario_synthesis disable trigger trg_wiki_autotrigger_scenario_synthesis;
alter table public.sp_sprint_goals disable trigger trg_wiki_autotrigger_sprint_goals;
alter table public.sp_sprint_initiatives disable trigger trg_wiki_autotrigger_sprint_initiatives;
alter table public.sp_sprint_milestones disable trigger trg_wiki_autotrigger_sprint_milestones;
