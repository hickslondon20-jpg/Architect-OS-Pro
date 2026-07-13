-- MA-06 Objective 2: tier-based routing at the capability grain.
-- A capability may reference a routing tier; tiers map to concrete Claude models centrally via
-- platform_ai_settings (tier_worker -> Haiku, tier_synthesis/tier_reasoning -> Sonnet). When
-- routing_tier is set, the sub-agent resolves its model through the tier row; otherwise it falls
-- back to its bespoke model_setting_key. This keeps model_setting_key semantics clean (per-capability
-- override) while making tier a first-class, editable attribute.

alter table public.agent_capabilities
  add column if not exists routing_tier text
  check (routing_tier in ('worker', 'reasoning', 'synthesis'));

-- Thin vertical slice: route the bounded document-analysis sub-agent to the worker tier (Haiku).
-- VCSO main chat stays on Sonnet (vcso_chat setting, unchanged).
update public.agent_capabilities
set routing_tier = 'worker',
    updated_at = now()
where capability_key = 'document_analysis_agent';
