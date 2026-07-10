-- Advanced Tool Calling Phase 1: capability model routing + tagged usage events.

insert into public.ai_models (provider, model_name, display_name, model_family, capabilities, cost_tier, notes)
values
  (
    'anthropic',
    'claude-sonnet-4-6',
    'Claude Sonnet 4.6',
    'chat',
    array['chat', 'reasoning', 'tool_use'],
    'standard',
    'Current Claude standard for Virtual CSO chat and beta sub-agent routing.'
  )
on conflict (provider, model_name) do update
set display_name = excluded.display_name,
    model_family = excluded.model_family,
    capabilities = excluded.capabilities,
    cost_tier = excluded.cost_tier,
    notes = excluded.notes,
    is_active = true,
    updated_at = now();

insert into public.platform_ai_settings (setting_key, model_id, fallback_model_name, provider, is_enabled, settings)
select 'vcso_chat', id, 'claude-sonnet-4-6', 'anthropic', true, '{"boundary":"vercel_vcso_chat","primary_chat_locked":true}'::jsonb
from public.ai_models
where provider = 'anthropic' and model_name = 'claude-sonnet-4-6'
on conflict (setting_key) do update
set model_id = excluded.model_id,
    fallback_model_name = excluded.fallback_model_name,
    provider = excluded.provider,
    is_enabled = excluded.is_enabled,
    settings = public.platform_ai_settings.settings || excluded.settings,
    updated_at = now();

insert into public.platform_ai_settings (setting_key, model_id, fallback_model_name, provider, is_enabled, settings)
select capability_key, model.id, 'claude-sonnet-4-6', 'anthropic', true, '{}'::jsonb
from (
  values
    ('document_analysis_agent'),
    ('structured_data_agent'),
    ('kb_explorer_agent'),
    ('sandbox_execution_agent'),
    ('per_user_wiki'),
    ('per_user_document_wiki'),
    ('global_ip')
) as capability(capability_key)
cross join public.ai_models model
where model.provider = 'anthropic' and model.model_name = 'claude-sonnet-4-6'
on conflict (setting_key) do update
set model_id = excluded.model_id,
    fallback_model_name = excluded.fallback_model_name,
    provider = excluded.provider,
    is_enabled = excluded.is_enabled,
    settings = excluded.settings,
    updated_at = now();

insert into public.platform_ai_settings (setting_key, model_id, fallback_model_name, provider, is_enabled, settings)
select utility_key, model.id, 'claude-sonnet-4-6', 'anthropic', true, '{}'::jsonb
from (
  values
    ('doc_wiki_synthesis'),
    ('skill_draft_synthesis')
) as utility(utility_key)
cross join public.ai_models model
where model.provider = 'anthropic' and model.model_name = 'claude-sonnet-4-6'
on conflict (setting_key) do update
set model_id = excluded.model_id,
    fallback_model_name = excluded.fallback_model_name,
    provider = excluded.provider,
    is_enabled = excluded.is_enabled,
    settings = excluded.settings,
    updated_at = now();

alter table public.ai_usage_log
  add column if not exists role text not null default 'main',
  add column if not exists provider text,
  add column if not exists capability_key text,
  add column if not exists run_id uuid,
  add column if not exists cost_usd numeric;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_usage_log_role_check'
      and conrelid = 'public.ai_usage_log'::regclass
  ) then
    alter table public.ai_usage_log
      add constraint ai_usage_log_role_check
      check (role in ('main', 'sub_agent', 'utility'));
  end if;
end $$;

create index if not exists ai_usage_log_user_created_role_idx
  on public.ai_usage_log(user_id, created_at desc, role);

create index if not exists ai_usage_log_thread_role_idx
  on public.ai_usage_log(thread_id, role, created_at desc);
