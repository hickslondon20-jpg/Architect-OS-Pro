-- Orchestration Harness Phase 2 / Plans 02-01 and 02-02
-- Per-turn intent scaffolding plus the default-off bounded pre-pass rollout flag.

alter table public.vcso_chat_messages
  add column if not exists intent jsonb;

comment on column public.vcso_chat_messages.intent is
  'Sanitized per-turn intent/depth scaffolding. Never chain-of-thought or a knowledge-base write.';

-- vcso_chat_messages already enforces founder-owned SELECT/INSERT/UPDATE/DELETE
-- with auth.uid() = user_id. The new JSONB column inherits that same boundary.

insert into public.platform_ai_settings (
  setting_key,
  model_id,
  fallback_model_name,
  provider,
  is_enabled,
  settings
)
values (
  'vcso_intent_read',
  null,
  null,
  'anthropic',
  false,
  jsonb_build_object(
    'role', 'feature_flag',
    'default', false,
    'enabled_for_all', false,
    'test_user_ids', '[]'::jsonb,
    'timeout_ms', 4000,
    'max_tokens', 220,
    'confidence_threshold', 0.80,
    'circuit_breaker_max_timeouts', 3,
    'circuit_breaker_cooldown_ms', 60000,
    'lean_assembly_token_budget', 4500,
    'purpose', 'bounded_vcso_intent_and_depth_read'
  )
)
on conflict (setting_key) do nothing;
