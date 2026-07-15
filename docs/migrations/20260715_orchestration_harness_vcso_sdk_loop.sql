-- Orchestration Harness 04B Phase A: dark Claude Agent SDK streaming spike.
-- The row is deliberately off and unenrolled. It reuses the established
-- platform_ai_settings rollout shape; no live VCSO turn changes until London
-- explicitly enrolls the founder canary.

insert into public.platform_ai_settings (
  setting_key,
  model_id,
  fallback_model_name,
  provider,
  is_enabled,
  settings
)
values (
  'vcso_sdk_loop',
  null,
  null,
  'anthropic',
  false,
  jsonb_build_object(
    'role', 'feature_flag',
    'default', false,
    'enabled_for_all', false,
    'test_user_ids', '[]'::jsonb,
    'phase', '04B-A',
    'purpose', 'claude_agent_sdk_streaming_spike'
  )
)
on conflict (setting_key) do nothing;
