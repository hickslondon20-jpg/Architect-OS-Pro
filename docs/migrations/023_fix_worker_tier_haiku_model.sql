-- MA-06 Obj2 fix: correct the worker-tier Haiku model id.
-- 'claude-3-5-haiku-latest' (seeded in 013) returns 404 not_found on this account. The valid current
-- Haiku id is 'claude-haiku-4-5-20251001' — the same string the code already uses as the known-good
-- utility model (services/citations/verify.py UTILITY_FALLBACK_MODEL). Tier routing itself is proven
-- (the worker sub-agent resolved tier_worker and attempted the call); only the model string was wrong.

update public.ai_models
set model_name = 'claude-haiku-4-5-20251001',
    display_name = 'Claude Haiku 4.5',
    notes = 'Low-cost worker-tier model for bounded sub-agent tasks.',
    updated_at = now()
where provider = 'anthropic' and model_name = 'claude-3-5-haiku-latest';

-- Keep the fallback strings consistent with the corrected model id.
update public.platform_ai_settings
set fallback_model_name = 'claude-haiku-4-5-20251001',
    updated_at = now()
where setting_key in ('tier_worker', 'citation_verifier')
  and fallback_model_name = 'claude-3-5-haiku-latest';
