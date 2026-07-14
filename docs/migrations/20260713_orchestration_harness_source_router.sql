-- Orchestration Harness Phase 3 / Plans 03-01 and 03-02
-- Per-turn sanitized source routing plus the default-off router rollout flag.

alter table public.vcso_chat_messages
  add column if not exists routing jsonb;

comment on column public.vcso_chat_messages.routing is
  'Sanitized per-turn source-routing decision. Never chain-of-thought or a knowledge-base write.';

-- vcso_chat_messages already has founder-owned SELECT/INSERT/UPDATE/DELETE
-- policies (auth.uid() = user_id); this column inherits the same boundary.

insert into public.platform_ai_settings (
  setting_key,
  model_id,
  fallback_model_name,
  provider,
  is_enabled,
  settings
)
values (
  'vcso_source_router',
  null,
  null,
  'anthropic',
  false,
  jsonb_build_object(
    'role', 'feature_flag',
    'default', false,
    'enabled_for_all', false,
    'test_user_ids', '[]'::jsonb,
    'purpose', 'deterministic_cheapest_first_internal_source_routing',
    'tier_order', jsonb_build_array(0, 1, 2, 3),
    'live_tier_hook', 'phase_5_noop'
  )
)
on conflict (setting_key) do nothing;
