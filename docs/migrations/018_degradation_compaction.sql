-- Advanced Tool Calling Phase 6: per-thread degradation signal + compaction.

alter table public.ai_models
  add column if not exists context_window integer;

update public.ai_models
set context_window = 200000,
    updated_at = now()
where provider = 'anthropic'
  and model_name = 'claude-sonnet-4-6'
  and (context_window is null or context_window <> 200000);

insert into public.platform_ai_settings (setting_key, model_id, fallback_model_name, provider, is_enabled, settings)
select 'vcso_context_compaction', id, 'claude-sonnet-4-6', 'anthropic', true, '{"role":"utility","purpose":"thread_context_compaction"}'::jsonb
from public.ai_models
where provider = 'anthropic' and model_name = 'claude-sonnet-4-6'
on conflict (setting_key) do update
set model_id = excluded.model_id,
    fallback_model_name = excluded.fallback_model_name,
    provider = excluded.provider,
    is_enabled = excluded.is_enabled,
    settings = public.platform_ai_settings.settings || excluded.settings,
    updated_at = now();

alter table public.vcso_chat_threads
  add column if not exists compacted_summary jsonb,
  add column if not exists compacted_through_message_id uuid references public.vcso_chat_messages(id) on delete set null,
  add column if not exists compacted_at timestamptz;

create index if not exists vcso_chat_threads_compacted_at_idx
  on public.vcso_chat_threads(user_id, compacted_at desc)
  where compacted_at is not null;
