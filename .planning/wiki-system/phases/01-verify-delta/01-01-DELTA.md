# 01-01 DELTA - Verify & Delta Pass

**Date:** 2026-06-30  
**Scope:** Read-only verification against `.planning/wiki-system/CONTEXT.md` sections 4 and 5.  
**Database checked:** Supabase project `pwacpjqkntnovndhspxt`, public schema, SELECT/introspection only.

---

## A. Checkpoint Table

### What was read

- `lib/gm-audit.ts`
- Supabase catalog query for checkpoint / GM / MRA table candidates.
- Column and row-count dumps for the checkpoint, question, scoring, meaning, stage, capability, pillar, dimension, and assessment-score tables.

### Findings

`lib/gm-audit.ts` uses `gm_audit_questions` as the UI-facing stage-calibrated question source. The selected fields are `gm_audit_question_id`, `gm_checkpoint_id`, `checkpoint_id_display`, `checkpoint_title_display`, `question_text`, `question_help_text`, `response_scale_id`, `gm_dimension_id`, `gm_pillar_id`, `gm_capability_id`, plus joined display metadata from `gm_dimensions`, `gm_pillars`, and `gm_capabilities`.

Live Supabase confirms the real checkpoint family is GM-keyed, not `mra_checkpoints`:

| Table | Rows | Role |
|---|---:|---|
| `gm_checkpoints` | 125 | Canonical checkpoint definitions keyed by `checkpoint_id`; includes base description, proof of readiness, display hierarchy fields. |
| `gm_audit_questions` | 500 | Stage-calibrated question text keyed by `gm_audit_question_id`, `gm_checkpoint_id`, and `stage_id`; includes `checkpoint_id_display` and `checkpoint_title_display`. |
| `gm_checkpoint_stage_meaning` | 500 | Stage-calibrated checkpoint meaning keyed by `checkpoint_id` + `stage_id`; includes `meaning_summary`, `evidence_examples`, `wgl_line`, `tooltip_text`. |
| `gm_checkpoint_scoring` | 500 | Stage-calibrated scoring weights and expected percentages keyed by `checkpoint_id` + `stage_id`. |
| `gm_checkpoint_stage_dimension_order` | 625 | Stage-specific ordering metadata; this table includes all five `gm_stg_1` through `gm_stg_5`. |
| `gm_capability_stage_meaning` | 100 | Capability-level stage meaning for four stages, 25 capabilities x 4. |
| `gm_dimension_band_stage_meaning` | 220 | Dimension-band stage meaning for four stages. |
| `gm_stages` | 5 | Five active stages: Rising, Striving, Thriving, Driving, Arriving. |

The locked assumption that the stage-calibrated content is approximately 125 x 5 is not fully true in the live data. Five stages exist in `gm_stages`, but the physically stored question, checkpoint-meaning, checkpoint-scoring, capability-meaning, and dimension-band-meaning data currently covers four stage IDs:

- `gm_audit_questions`: 500 rows = 125 checkpoints x 4 AE stage IDs (`ae_stg_1` through `ae_stg_4`)
- `gm_checkpoint_stage_meaning`: 500 rows = 125 checkpoints x 4 GM stage IDs (`gm_stg_1` through `gm_stg_4`)
- `gm_checkpoint_scoring`: 500 rows = 125 checkpoints x 4 GM stage IDs (`gm_stg_1` through `gm_stg_4`)
- `gm_stages`: includes active `gm_stg_5` / `ae_stg_5`, but the content-bearing calibration tables above do not have stage-5 rows.

### Query interface for `structured_data` and stage-primer

For "what good looks like at stage N for checkpoint/capability X", use deterministic joins rather than generated ad hoc SQL:

```sql
select
  q.gm_audit_question_id,
  q.gm_checkpoint_id,
  q.stage_id as ae_stage_id,
  s.stage_id as gm_stage_id,
  s.stage_name,
  q.checkpoint_id_display,
  q.checkpoint_title_display,
  q.question_text,
  q.question_help_text,
  c.checkpoint_name,
  c.checkpoint_base_description,
  c.proof_of_readiness,
  m.meaning_summary,
  m.evidence_examples,
  m.wgl_line,
  m.tooltip_text,
  sc.expected_min_pct,
  sc.expected_target_pct,
  sc.expected_max_pct,
  sc.criticality,
  sc.impact,
  sc.urgency_normalized,
  cap.capability_id,
  cap.capability_name,
  cap.capability_code,
  p.pillar_id,
  p.pillar_name,
  d.dimension_id,
  d.dimension_name
from public.gm_audit_questions q
join public.gm_stages s
  on s.ae_frontend_stage_id = q.stage_id
left join public.gm_checkpoints c
  on c.checkpoint_id = q.gm_checkpoint_id
left join public.gm_checkpoint_stage_meaning m
  on m.checkpoint_id = q.gm_checkpoint_id
 and m.stage_id = s.stage_id
left join public.gm_checkpoint_scoring sc
  on sc.checkpoint_id = q.gm_checkpoint_id
 and sc.stage_id = s.stage_id
left join public.gm_capabilities cap
  on cap.capability_id = q.gm_capability_id
left join public.gm_pillars p
  on p.pillar_id = q.gm_pillar_id
left join public.gm_dimensions d
  on d.dimension_id = q.gm_dimension_id
where q.is_active = true
  and s.stage_id = :gm_stage_id
  and (:capability_id is null or q.gm_capability_id = :capability_id)
order by d.dimension_order, p.pillar_order, cap.capability_order, q.question_order;
```

If the caller only has `ae_frontend_stage_id`, it can filter on `q.stage_id = :ae_stage_id` and join to `gm_stages` for the GM stage ID.

### Verdict

**CORRECTED** against CONTEXT section 5.1. The GM-keyed table family is confirmed and `mra_checkpoints` is not the target, but the live content-bearing calibration is 125 x 4, not 125 x 5. Stage 5 exists as a stage row and in ordering metadata, but not in the question/meaning/scoring content tables inspected here.

---

## B. Orchestrator Hosting

### What was read

- `python-backend/services/sub_agent_orchestrator.py`
- `python-backend/services/agent_capabilities.py`
- `python-backend/services/agent_context.py`
- `python-backend/services/structured_data.py`
- `python-backend/services/structured_query.py`
- Supabase `agent_capabilities` rows and delegation table columns.

### Findings

The row-backed capability registry exists and matches much of CONTEXT L10:

- `agent_capabilities` has `capability_key`, `allowed_surfaces`, `allowed_tools`, `allowed_source_kinds`, `model_setting_key`, `output_schema`, `default_config`, and `can_spawn_agents`.
- Live rows exist for `document_analysis_agent`, `structured_data_agent`, and `kb_explorer_agent` as enabled or experimental patterns.
- `AgentCapabilityRegistry.get_for_surface()` validates active/experimental status, parent surface, and non-recursive delegation.
- Delegation runs snapshot `allowed_tools` and store `structured_result`, `citations`, and trace steps.
- Handler outputs are `agent_result_v1`-shaped and citations are first-class through `AgentSourceRef`.

However, dispatch is not fully row-dispatched. `SubAgentOrchestrator.start_run()` has explicit branches:

- `document_analysis_agent` -> `_handle_document_analysis`
- `structured_data_agent` -> `_handle_structured_data`
- `kb_explorer_agent` -> `_handle_kb_explorer`
- anything else -> `Capability handler is not available yet.`

`AgentContextBuilder` also has hard-coded loaders and safe-scope keys for only `document_ids`, `chunk_ids`, `dataset_ids`, `structured_query`, and source/metadata filters. So `per_user_wiki` and `global_ip` can be registered as capability rows, but they will not run solely by adding rows. They need handler insertion points and context-loading support.

### Required rework

No parallel orchestrator is needed. The required work is inside the existing orchestrator:

1. Add `per_user_wiki` and `global_ip` rows to `agent_capabilities`.
2. Add allowed source kinds such as `wiki_page`, `wiki_claim`, `wiki_evidence`, `wiki_digest`, `global_ip_page`, and `global_checkpoint`.
3. Extend `AgentContextBuilder` safe scope and loaders for page keys, claim IDs, global IP selectors, and/or checkpoint selectors.
4. Add `start_run()` branches such as `_handle_per_user_wiki()` and `_handle_global_ip()`, or replace the if/elif block with a handler registry while keeping the existing service.
5. Expand `StructuredQueryService.APPROVED_SURFACES` or add a separate deterministic service for GM checkpoint/global IP reads. Current approved surfaces are only `founder_dataset_rows` and `founder_dataset_rows_v`.

### Verdict

**CORRECTED** against CONTEXT L10. The existing FastAPI orchestrator is the right host and the registry shape is compatible, but "no new plumbing" is too strong. It needs bounded in-place extensions: capability rows plus explicit handlers/context loaders/source kinds.

---

## C. Existing Wiki UI

### What was read

- `components/pro-suite/os-engine/views/WikiView.tsx`
- `components/pro-suite/os-engine/views/IndexView.tsx`
- `components/pro-suite/os-engine/views/UploadsView.tsx`
- `components/pro-suite/os-engine/views/ManifestView.tsx`
- `components/pro-suite/os-engine/views/LogView.tsx`
- `components/pro-suite/os-engine/StructureRail.tsx`
- `components/pro-suite/os-engine/kb/FileNode.tsx`
- `pages/ProSuite/os-engine/OSEngineWorkspace.tsx`
- `lib/osEngineApi.ts`
- `lib/osEngineMockData.ts`
- live OS Engine table inventory

### Findings

The OS Engine wiki surface already exists and should be mapped onto, not rebuilt:

- `StructureRail` exposes `welcome`, `uploads`, `wiki`, `index`, `manifest`, and `log`.
- `WikiView` shows categories, synthesized pages, and source files.
- `IndexView` lists page title, type, source count, word count, and last updated.
- `UploadsView` and `FileNode` render raw files, folder placement, metadata extraction details, parser details, parser warnings, and delete flow.
- `ManifestView` maps files to ingested pages.
- `LogView` renders activity/decision events.
- `OSEngineWorkspace` opens both knowledge pages and raw documents in the shared `Reader`.
- `NotesComposer` writes founder corrections through `addPageCorrection()`.

Current wired data comes from `ose_raw_document_registry`, `ose_knowledge_pages`, `ose_activity_log`, `ose_knowledge_base_setup`, `ose_page_corrections`, `kb_folders`, and `document_chunks` for document deletion cleanup.

Live table inventory confirms the useful OS Engine scaffolding. `ose_knowledge_pages` exists with `user_id`, `page_type`, `page_title`, markdown `content`, `category`, `source_file_ids`, `word_count`, `status`, `canonical_key`, `page_kind`, `domain`, `confidence`, and dates. `ose_page_corrections`, `ose_raw_document_registry`, `ose_activity_log`, `ose_knowledge_base_setup`, and `kb_folders` also exist, with RLS enabled on inspected OS Engine tables.

The current page model is not yet the locked three-class claim model. `KnowledgePage` is a simple page-level markdown object: `id`, `pageType`, `title`, `content`, `lastUpdated`, `sourceFileIds`, `wordCount`, and `category`.

### Three-class mapping

| Locked model | Existing UI target | Gap the schema/API must bridge |
|---|---|---|
| Compiled base | `ose_knowledge_pages.content` and Reader body; page rows in Wiki/Index | New wiki schema should expose compiled claims as a composed page body or Reader-ready sections while preserving claim IDs and evidence. |
| Insight layer | Could render as additional Reader sections, page badges, Log entries, or category/page rows | Current UI has no trust/quarantine/status display for individual claims. API must expose class/trust so UI can distinguish reasoning-only insight. |
| Override layer | `NotesComposer` + `ose_page_corrections` is the closest existing surface | Existing corrections are notes, not highest-precedence override claims. Schema/API must map founder overrides to rendered effective page content and retain auditability. |
| Claim/evidence | Current page/source count and source file IDs | No claim-level rendering exists. Reader or SourcesPanel integration must carry claim IDs and evidence refs. |
| Digest/index | `IndexView` already shows page map and summary metrics | Needs `one_line`, confidence rollup, stale flag, claim counts, top claims from the compiled digest. |

### Verdict

**CONFIRMED** against CONTEXT section 5.3. Existing wiki UI scaffolding exists and should be reused. The schema/API must provide an adapter from claim-class/evidence data into the current page/index/reader surfaces; no greenfield UI is justified by this pass.

---

## D. Provenance UI

### What was read

- `components/pro-suite/virtual-cso/SourcesPanel.tsx`
- `lib/virtualCsoApi.ts`
- `lib/virtualCsoMockData.ts`

### Findings

`SourcesPanel` exists and groups sources by four current source kinds: `wiki`, `platform`, `ip`, and `context`.

The render shape is `SourceRef`:

```ts
{
  kind: 'wiki' | 'platform' | 'ip' | 'context';
  label: string;
  pageId?: string;
}
```

When `pageId` exists, it opens a source in the shared Reader. Without `pageId`, it renders a compact non-clickable pill. `virtualCsoApi.ts` stores streamed `sources` and `sourcePages` from `/api/vcso/chat`, but the UI contract remains the simplified `SourceRef` / `SourcePage` model.

The locked evidence shape is richer:

```ts
{
  source_id,
  source_kind,
  path,
  lines,
  weight,
  note
}
```

The current panel can render evidence only after adaptation into grouped `SourceRef` items. It cannot directly show line ranges, paths, weights, notes, claim IDs, or per-claim evidence lists.

### Gaps

- Add an adapter from `evidence[]` to UI source groups.
- Add a way to preserve or reveal `path`, `lines`, `weight`, and `note`.
- Add source-kind mapping from planned evidence kinds (`wiki_claim`, `wiki_page`, `global_ip_page`, `global_checkpoint`, `document_chunk`, etc.) to existing panel groups.
- For claim-level provenance, either extend `SourcesPanel` or pair it with Reader claim sections; the current panel is conversation-level, not claim-level.

### Verdict

**RISK** against CONTEXT section 5.4. The provenance panel exists and is a valid render target, but it cannot currently render the locked `evidence[]` shape without an adapter and likely a small display extension.

---

## E. Pre-existing Wiki Tables

### What was queried

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name ilike '%wiki%';
```

### Findings

No live public tables matching `%wiki%` were found.

Related but not `wiki_*` tables do exist:

| Table | Rows at inspection | Relevance |
|---|---:|---|
| `ose_knowledge_pages` | 0 | Existing OS Engine synthesized-page scaffold; page-level markdown, not claim/evidence wiki storage. |
| `ose_page_corrections` | 0 | Existing founder correction notes. |
| `ose_knowledge_base_setup` | 0 | OS Engine onboarding/import setup. |
| `ose_activity_log` | 0 | Existing activity/decision feed. |
| `ose_raw_document_registry` | 2 | Raw upload registry; source/provenance input. |
| `document_chunks` | 0 | Chunked document retrieval surface. |
| `kb_folders` | 1 | KB Explorer folder organization. |

The function `seed_core_knowledge_pages(p_user_id)` seeds five OS Engine page types: `business_context`, `assessment_intelligence`, `strategic_context`, `financial_patterns`, and `conversation_intelligence`. These do not match the locked seven beta page keys exactly and are page-level scaffolding, not the planned claim/evidence schema.

### Verdict

**CONFIRMED** against CONTEXT section 5.5. There are no existing `wiki_*` tables to inventory or preserve. There is reusable OS Engine page/correction/log scaffolding, but it is not a conflict with the planned wiki tables.

---

## F. Tier 0 Source Inventory

### What was read / queried

- `.from(...)` references across `lib`, `pages`, and `components`.
- Live table/view inventory and row counts for candidate Tier 0 source tables.
- OS Engine, diagnostic, snapshot, Clarity Compass, Growth Velocity, Quarter Map, Sprint Planning, AE, GM, and structured-data table families.

### Event to rebuild map

| Compiled-base page | Source event | Real source tables/views to watch |
|---|---|---|
| Diagnostic Synthesis | AE Ladder completion/update | `ae_assessments`, `ae_responses`, `ae_assessment_snapshots`, `ae_dimension_scores`, `ae_assessment_insights`, `ae_reports`, `vw_ae_dashboard_results`, `vw_ae_stage_context` |
| Diagnostic Synthesis | GM / M&R audit completion/update | `gm_assessments`, `gm_assessment_responses`, `gm_assessment_checkpoint_scores`, `gm_assessment_capability_scores`, `gm_assessment_dimension_scores`, `gm_assessment_pillar_scores`, `gm_assessment_overall_scores`, `gm_assessment_gpt_outputs`, `gm_capability_rankings` |
| Current Quarter / Sprint | Quarter Map selection changes | `quarter_map_selections`; also reads diagnostic sources above in Quarter Map flows |
| Current Quarter / Sprint | Sprint planning changes | `sp_sprint_goals`, `sp_sprint_initiatives`, `sp_sprint_milestones` |
| Business Context | Clarity Compass version/draft/synthesis changes | `cc_versions`, `cc_synthesis`, `cc_drafts_global`, `cc_version_horizon_snapshots`, `clarity_compass_versions` |
| Growth Constraints | Diagnostic and planning constraint changes | `gm_assessment_capability_scores`, `gm_capability_rankings`, `gm_assessment_checkpoint_scores`, `quarter_map_selections`, `cc_versions`, `cc_synthesis`, `gvs_saved_growth_scenarios`, `gvs_comparison_runs` |
| Financial Context | Agency Snapshot economic/revenue/delivery changes | `agency_snapshot_economic_foundation`, `agency_snapshot_revenue_model`, `agency_snapshot_delivery_architecture`, `agency_snapshot_dashboard`, `agency_snapshot_dashboard_view`, `agency_snapshots` |
| Financial Context | Structured upload changes | `founder_datasets`, `founder_dataset_rows`, `founder_dataset_rows_v`, `ose_raw_document_registry`, `document_chunks` |
| Client / Market Position | Snapshot market/client/offer changes | `agency_snapshot_market_footprint`, `agency_snapshot_market_footprint_readable`, `agency_snapshot_agency_type_ref_table`, `agency_snapshot_services_ref_table`, `agency_snapshot_industries_ref_table`, `agency_snapshot_revenue_model` |
| Client / Market Position | Growth Velocity scenario changes | `gvs_growth_scenarios`, `gvs_saved_growth_scenarios`, `gvs_comparison_runs`, `gvs_saved_comparisons`, `gvs_scenario_synthesis` |
| Open Questions & Unresolved Tensions | Validation/health/consolidation outputs | No `wiki_*` health tables exist yet. Inputs will be produced by later wiki validation/consolidation phases; raw tension inputs can also derive from low-confidence diagnostics, corrections, and source drift. |

### Live row-count notes

At inspection, representative source tables had live rows, including `ae_assessments` 1, `ae_responses` 19, `vw_ae_dashboard_results` 1, `vw_ae_stage_context` 1, `gm_assessments` 5, `gm_assessment_checkpoint_scores` 250, `gm_assessment_capability_scores` 50, `gm_assessment_gpt_outputs` 72, `quarter_map_selections` 1, `cc_versions` 3, `cc_synthesis` 3, `cc_version_horizon_snapshots` 8, `cc_drafts_global` 1, `agency_snapshot_economic_foundation` 2, `agency_snapshot_revenue_model` 1, `agency_snapshot_delivery_architecture` 1, `agency_snapshot_market_footprint` 1, `gvs_growth_scenarios` 10, `gvs_saved_growth_scenarios` 11, `gvs_comparison_runs` 8, `gvs_saved_comparisons` 1, and `ose_raw_document_registry` 2. `founder_datasets`, `founder_dataset_rows`, `document_chunks`, and Sprint Planning `sp_*` tables were present but had zero rows at inspection.

### Caveats

- Sprint Planning tables exist but currently have zero rows in the live project queried.
- `agency_snapshot_dashboard` and `agency_snapshot_dashboard_view` exist but currently have zero rows; underlying row-id/content-hash tables are the direct source for most snapshot tab data.
- `founder_dataset_*` tables exist but currently have zero rows; they are still the governed target for structured uploads once populated.
- This is an event-source inventory only. It does not decide compilation logic or table ownership.

### Verdict

**CONFIRMED** against the sub-phase task and CONTEXT section 5 verify-before-build rule. The event to rebuild map can be grounded in existing Tier 0 tables and views; no new source taxonomy is needed before sub-phase 04.

---

## Summary Verdicts

| Task | Verdict |
|---|---|
| A. Checkpoint table | CORRECTED |
| B. Orchestrator hosting | CORRECTED |
| C. Existing wiki UI | CONFIRMED |
| D. Provenance UI | RISK |
| E. Pre-existing wiki tables | CONFIRMED |
| F. Tier 0 source inventory | CONFIRMED |

Totals: **3 CONFIRMED**, **2 CORRECTED**, **1 RISK**.
