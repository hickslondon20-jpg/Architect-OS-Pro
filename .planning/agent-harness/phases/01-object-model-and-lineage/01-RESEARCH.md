# Phase 1 Research — Live-Verified State (2026-07-03)

Verified against `docs/migrations/` and `python-backend/`. **Trust this, but re-verify anything
you're about to change** (live Supabase project `pwacpjqkntnovndhspxt`).

## Migration numbering
- Latest applied: **`018_degradation_compaction.sql`**. Phase 1 lands as **`019_domain_agents_object_model.sql`** (split into `019a/019b` only if size warrants).
- `docs/migrations/pending/ws5_decommission_virtual_cso_legacy_founder_confirm_required.sql` exists and is unrelated — do not touch.

## `artifacts` (migration 011) — EXISTS, VCSO-only, must be extended
Columns today: `id`, `user_id`, `source_kind`, `source_id`, `filename`, `mime_type`, `size`,
`storage_path`, `renderable`, `description`, `created_at`, `updated_at`.
- **CHECK constraint** `artifacts_source_kind_check` currently allows **only `'vcso_thread'`** — must be extended to add `'domain_agent_task'`.
- **No lineage columns** — Phase 1 adds `task_id`, `workflow_id`, `agent_id`, `template_id`, `provenance jsonb`, `promoted_to_kb boolean`.
- RLS pattern to mirror everywhere: `alter table … enable row level security`; `grant select,insert,update,delete … to authenticated`; `grant all … to service_role`; per-op policies `using ((select auth.uid()) = user_id)`.
- `updated_at` maintained by a `before update` trigger calling a `update_*_updated_at()` plpgsql fn (reuse the pattern).
- Storage bucket `artifacts` exists (private) with `storage.foldername(name)[1] = auth.uid()` policies.

## `agent_capabilities` (migration 009) — EXISTS, this is D1 layer B
Columns: `capability_key` (unique), `label`, `description`, `status` (enabled/disabled/experimental),
`allowed_surfaces text[]`, `allowed_tools text[]`, `allowed_source_kinds text[]`, `model_setting_key`,
`output_schema jsonb`, `default_config jsonb`, `can_spawn_agents boolean`, timestamps.
- **Hard constraint `can_spawn_agents = false`** — sub-agents cannot recursively spawn. Batch fan-out (Phase 2 `llm_batch_agents`) goes through the orchestrator, not capability recursion. Not a Phase-1 concern, but do not collide with this table.
- Sibling tables: `agent_delegation_runs`, `agent_delegation_steps` (the delegation trace). Reused by Phase 2, not touched in Phase 1.

## `skill_packs` — EXISTS (renamed from `ip_skill_packs`, migration `20260701_skill_packs_rename_and_ownership.sql`)
- Founder ownership added: `user_id` (FK `auth.users`), `scope text` CHECK `('global','private')`. Six pre-existing rows backfilled as `global` admin content.
- Admin model: `profiles.is_admin` + `private.is_skill_admin(uuid)` SECURITY DEFINER fn gate global writes.
- Bundled files: `skill_files` (+ `20260701_skill_files_storage.sql`).
- **This is the Domain Agent "Skill" primitive.** `workflow_steps.skill_id → skill_packs.id`. No new skills table (locked fork #2).

## Net-new confirmed (no existing tables)
`domain_agents`, `workflows`, `workflow_steps`, `templates`, `tasks`, `workspace_files`,
`freeform_requests` — none exist. Grep of migrations for `workflow`/`task`/`harness`/`template` returned nothing.

## Global vs. founder-owned split (modeling decision, grounded in the skill_packs precedent)
- **Global platform reference content** (admin/service_role-writable, all-authenticated-readable): `domain_agents` (5 fixed), `workflows`, `workflow_steps`, `templates`. Mirrors global-scope `skill_packs`.
- **Founder-owned, RLS by `user_id`/`auth.uid()`** (mirror `artifacts`): `tasks`, `workspace_files`, `freeform_requests`, and the artifact rows.

## TypeScript types
Regenerate via the Supabase `generate_typescript_types` tool after the migration so Phase 4's
frontend has the shapes. Beta is founder-only (`beta_cohort_week` / `beta_feature_gates`); no team scoping.
