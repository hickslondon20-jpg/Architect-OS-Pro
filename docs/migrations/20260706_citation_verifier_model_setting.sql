-- Episode 7 A4 - utility-model registry route for on-demand citation checking.

insert into public.ai_models (provider, model_name, display_name, model_family, capabilities, cost_tier, notes)
values
  (
    'anthropic',
    'claude-3-5-haiku-latest',
    'Claude 3.5 Haiku',
    'utility',
    array['classification', 'json'],
    'low',
    'Utility-class model for citation verification. Not used for conversation responses.'
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
select 'citation_verifier', id, 'claude-3-5-haiku-latest', 'anthropic', true, '{"role":"utility","surface":"virtual_cso"}'::jsonb
from public.ai_models
where provider = 'anthropic' and model_name = 'claude-3-5-haiku-latest'
on conflict (setting_key) do update
set model_id = excluded.model_id,
    fallback_model_name = excluded.fallback_model_name,
    provider = excluded.provider,
    is_enabled = excluded.is_enabled,
    settings = public.platform_ai_settings.settings || excluded.settings,
    updated_at = now();
