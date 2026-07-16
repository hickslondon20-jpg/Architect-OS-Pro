-- Orchestration Harness 04B Phase D: native subagent worker routing and dark canary metadata.
-- This data migration does not enable the SDK flag, enroll a founder, or touch ai_usage_log.

update public.agent_capabilities
set
  routing_tier = 'worker',
  updated_at = now()
where capability_key in (
  'document_analysis_agent',
  'structured_data_agent',
  'kb_explorer_agent',
  'sandbox_execution_agent',
  'per_user_wiki',
  'per_user_document_wiki',
  'global_ip'
)
and routing_tier is distinct from 'worker';

update public.platform_ai_settings
set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
  'phase', '04B-D',
  'purpose', 'claude_agent_sdk_native_subagents_p4_thin_slice',
  'native_subagent_max_depth', 1,
  'native_subagent_max_children', 3,
  'native_subagent_scope', 'p4_thin_slice_only'
)
where setting_key = 'vcso_sdk_loop';
