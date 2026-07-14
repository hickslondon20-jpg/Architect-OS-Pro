# Phase 4 Live Substrate Findings

**Checked:** 2026-07-14. **Mode:** read-only; no proof turn and no flag change.

## Live findings

- The production project is on PostgreSQL 17.6. The July 2026 Supabase changes do not conflict with
  this phase; the relevant public-schema Data API grant change is avoided because Phase 4 creates no
  table and the platform-setting row remains service-role configuration.
- `agent_delegation_runs.parent_run_id` is a live self-referencing foreign key and
  `agent_delegation_steps.run_id` cascades to the run. The existing tables already carry
  `structured_result`, `citations`, `confidence`, and `assistant_message_id`; no new delegation table
  is needed.
- Seven active handlers exist and remain non-recursive (`can_spawn_agents=false`):
  `document_analysis_agent`, `structured_data_agent`, `kb_explorer_agent`,
  `sandbox_execution_agent`, `per_user_wiki`, `per_user_document_wiki`, and `global_ip`.
- MA-06 tier rows are live: `tier_worker` resolves to Claude Haiku and `tier_synthesis` resolves to
  Claude Sonnet. Six workers still use bespoke Sonnet settings on their normal paths, so Phase 4
  applies the worker-tier override only to planner-created children. This preserves flag-off behavior.
- The existing source router does not change for normal turns. A planner-only worker binding now
  selects founder-scoped ready dataset metadata at Tier 0 for structured/sandbox questions; the
  sandbox receives the compact cited structured-worker finding, never raw dataset material.
- MA-05 already renders a parent delegation step with nested child steps. Phase 4 supplies the same
  sanitized shape and persists child runs under the VCSO parent run.

## Implementation conclusion

Reuse is sufficient. Phase 4 needs one new planner module, one default-off platform setting, a
planner-scoped compact worker contract, and the narrow VCSO entry branch. No new worker, table,
frontend surface, live connector, or permission widening is required.
