-- Orchestration Harness Phase 1 / Plan 01-01
-- Per-thread working-state memory and the default-off bounded assembly rollout flag.

alter table public.vcso_chat_threads
  add column if not exists working_state jsonb;

comment on column public.vcso_chat_threads.working_state is
  'Thread-scoped conversational working state. Never a knowledge-base write.';

-- vcso_chat_threads already has founder-scoped SELECT/INSERT/UPDATE/DELETE RLS policies
-- (auth.uid() = user_id). The new JSONB column is therefore covered by the same boundary.

insert into public.platform_ai_settings (
  setting_key,
  model_id,
  fallback_model_name,
  provider,
  is_enabled,
  settings
)
values (
  'vcso_working_state_assembly',
  null,
  null,
  'anthropic',
  false,
  jsonb_build_object(
    'role', 'feature_flag',
    'default', false,
    'enabled_for_all', false,
    'test_user_ids', '[]'::jsonb,
    'annotations_enabled', false,
    'assembly_token_budget', 6000,
    'recent_message_tail', 2,
    'purpose', 'bounded_working_state_context_assembly'
  )
)
on conflict (setting_key) do update
set settings = public.platform_ai_settings.settings || excluded.settings,
    updated_at = now();
