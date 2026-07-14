-- Orchestration Harness Phase 4 / Plans 04-01 and 04-02
-- Default-off planner budget. Planner-created children select the existing
-- MA-06 tier_worker row at runtime without changing normal worker behavior.

insert into public.platform_ai_settings (
  setting_key,
  model_id,
  fallback_model_name,
  provider,
  is_enabled,
  settings
)
values (
  'vcso_planner',
  null,
  null,
  'anthropic',
  false,
  jsonb_build_object(
    'role', 'feature_flag',
    'default', false,
    'enabled_for_all', false,
    'test_user_ids', '[]'::jsonb,
    'confidence_threshold', 0.80,
    'max_subquestions', 4,
    'max_rounds', 2,
    'max_depth', 1,
    'max_estimated_spend_usd', 0.12,
    'decompose_reserve_usd', 0.02,
    'compose_reserve_usd', 0.04,
    'worker_reserve_usd', 0.01,
    'max_finding_chars', 5000,
    'compose_token_budget', 6000,
    'purpose', 'bounded_vcso_decompose_delegate_compose'
  )
)
on conflict (setting_key) do nothing;
