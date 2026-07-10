# Ep7A A6 Live-DB Runbook (Staged, Not Applied)

Date: 2026-07-06
Status: staged for London working session. Do not run from the execution agent.

## Boundary

This runbook is for Track 2 only. It mutates the shared Supabase project and must be run with London in the strategy-thread working session. The A6 execution agent validated the files and queries only; no shared Supabase migration or write query was applied.

## Preflight

Confirm the target project is the shared ArchitectOS Pro Supabase project and that London has explicitly approved the session.

Confirm R2 dependencies before applying `20260706_citation_verifier_model_setting.sql`:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = any(array['ai_models','platform_ai_settings']);
```

Confirm the expected dependency columns:

```sql
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'ai_models' and column_name = any(array['provider','model_name','display_name','model_family','capabilities','cost_tier','notes','is_active','updated_at']))
    or
    (table_name = 'platform_ai_settings' and column_name = any(array['setting_key','model_id','fallback_model_name','provider','is_enabled','settings','updated_at']))
  )
order by table_name, column_name;
```

## R1: Assistant-message citations column

File: `docs/migrations/20260706_vcso_message_citations.sql`

Validated posture: additive and idempotent via `add column if not exists`.

Apply:

```sql
alter table public.vcso_chat_messages
  add column if not exists citations jsonb not null default '[]'::jsonb;
```

Verify:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'vcso_chat_messages'
  and column_name = 'citations';
```

## R2: Citation verifier model setting

File: `docs/migrations/20260706_citation_verifier_model_setting.sql`

Validated posture: idempotent via `on conflict (provider, model_name) do update` and `on conflict (setting_key) do update`. It references existing `ai_models` and `platform_ai_settings` columns and does not introduce a new verdict column; verdicts ride inside `vcso_chat_messages.citations`.

Apply the file contents after the preflight dependency check passes.

Verify:

```sql
select setting_key, fallback_model_name
from public.platform_ai_settings
where setting_key = 'citation_verifier';
```

## R3: Platform-record table confirmation

This is a schema confirmation only, not a migration.

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = any(array[
    'mra_checkpoints',
    'gm_assessment_checkpoint_scores',
    'ae_assessments',
    'ae_dimension_scores',
    'ae_assessment_insights',
    'sp_sprint_goals',
    'sp_sprint_initiatives',
    'sp_sprint_milestones',
    'quarter_map_selections',
    'cc_versions',
    'cc_synthesis',
    'clarity_compass_versions',
    'reflection_reviews',
    'founder_dataset_rows',
    'founder_dataset_rows_v'
  ])
order by table_name;
```

Expected handling:

- `reflection_reviews` may be absent; mark that renderer dormant, not failed.
- If either `cc_versions` or `clarity_compass_versions` is absent or duplicative in practice, record the finding for the strategy thread before changing any renderer behavior.
- Any absent table means the corresponding platform-record renderer is dormant until that platform surface produces real rows.

## Post-Apply Smoke

After R1/R2/R3 in the London session, rerun the A6 acceptance harness against a branch or the approved live smoke path:

```powershell
python -m pytest python-backend/tests/test_ep7a_acceptance.py
```

Record live-only blockers as `pending-live`; do not backfill existing messages or artifacts.
