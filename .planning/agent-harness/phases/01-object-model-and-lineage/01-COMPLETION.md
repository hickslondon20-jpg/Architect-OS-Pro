# Phase 1 Completion — Object Model & Lineage

**Completed:** 2026-07-05 · **Migration:** `019_domain_agents_object_model.sql` · **Applied live to**
Supabase `pwacpjqkntnovndhspxt` (via MCP `apply_migration`, `{"success":true}`).

## What shipped
- **7 new tables** created: global `domain_agents`, `templates`, `workflows`, `workflow_steps`;
  founder-owned `tasks`, `workspace_files`, `freeform_requests`. (Live check: all seven present.)
- **`artifacts` (011) extended** (ALTER, not replaced): `source_kind` CHECK dropped + recreated to
  `('vcso_thread','domain_agent_task')`; added `task_id`, `workflow_id`, `agent_id`, `template_id`,
  `provenance jsonb`, `promoted_to_kb bool` + `artifacts_task_id_idx`.
- **New private Storage bucket `workspace`** with `auth.uid()`-foldername select/insert/update/delete
  policies mirroring the `artifacts` bucket.
- **RLS + grants:**
  - Global tables — all-authenticated `select` (`using (true)`); insert/update/delete gated by the
    existing `private.is_skill_admin((select auth.uid()))`; `service_role` full. (Reused the
    `skill_packs` admin path — no new admin mechanism.)
  - Founder tables — own-row via `(select auth.uid()) = user_id`, mirroring `artifacts` (011).
- **Shared `public.touch_updated_at()` trigger** on the six tables with `updated_at`.
- **Seed (POC, L19):** 5 `domain_agents` (vision §5 disciplines + placeholder capabilities/
  thought-starters), 1 `templates` (`monthly_pnl_assessment_v1`), 1 Financial `workflows`
  (`produce_monthly_pnl_assessment`), 5 ordered `workflow_steps` placeholders
  (programmatic → llm_human_input → llm_agent → llm_single → programmatic).

## Verification evidence (live queries)
- Tables present: `domain_agents,freeform_requests,tasks,templates,workflow_steps,workflows,workspace_files`.
- Seed counts: `agents=5, template=1, workflow=1, steps=5`.
- **L21 proof:** `workspace_files` insert accepted **both** `owner_type='task'` and `'thread'`
  (`ws_verify_owner_types = "task,thread"`); test rows deleted after (`remaining_verify_rows = 0`).
- `artifacts` new columns present: `agent_id,promoted_to_kb,provenance,task_id,template_id,workflow_id`.
- `artifacts_source_kind_check = CHECK ((source_kind = ANY (ARRAY['vcso_thread','domain_agent_task'])))`.
- **Lineage resolves:** `Financial -> Produce a Monthly P&L Assessment -> Monthly P&L Assessment -> 5 steps`
  (agent → workflow → template → steps join).

## Confirmed decisions honored (London checkpoint 2026-07-05)
Single `019`; new private `workspace` bucket; jsonb `capabilities`/`thought_starters`; nullable
`created_by` on `workflows`/`templates`; nullable `resulting_task_id` on `freeform_requests`;
drop+recreate CHECK; `is_skill_admin()` gate on global writes; both-owner-type L21 test.

## Residual / handoff notes
- **TypeScript types:** regenerated via MCP `generate_typescript_types`; the canonical committed
  file is `src/types/supabase.ts` (re-exported by `lib/database.types.ts`). Swapping the full
  regenerated output into that file is a mechanical step **deferred to the Phase 4 front-end wiring
  pass** (types are regenerable on demand; nothing backend depends on the committed file).
- **No Python/backend code changed** in Phase 1 (SQL + planning docs only) — no `compileall` needed.
- **FK notes:** `workflow_steps.skill_id → skill_packs.id` (verified `uuid`), soft `capability_key`
  (text, no FK) for D1 layer B, `tasks.agent_id`/`workflow_id` and `freeform_requests` FKs in place.

## Unblocks
Phase 2 (Generic Harness Engine) may now proceed — the object model it drives is live. Phase 2 adds
only migration `020_ai_usage_log_task_id.sql` (verified absent today).
