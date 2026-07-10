-- Phase 7: Sandbox execution sub-agent capability and skill opt-in flag.

ALTER TABLE public.skill_packs
  ADD COLUMN IF NOT EXISTS requires_sandbox BOOLEAN NOT NULL DEFAULT false;

INSERT INTO public.agent_capabilities (
  capability_key,
  label,
  description,
  status,
  allowed_surfaces,
  allowed_tools,
  allowed_source_kinds,
  model_setting_key,
  output_schema,
  default_config,
  can_spawn_agents
)
VALUES (
  'sandbox_execution_agent',
  'Sandbox code execution',
  'Runs founder/platform-data code and document generation inside a bounded sandbox session, with access to attached skill files.',
  'experimental',
  ARRAY['virtual_cso'],
  ARRAY['execute_code', 'read_skill_file'],
  ARRAY[]::TEXT[],
  'sandbox_execution_agent',
  '{"version": "agent_result_v1"}'::jsonb,
  '{"max_rounds": 6, "timeout_seconds": 90}'::jsonb,
  FALSE
)
ON CONFLICT (capability_key) DO UPDATE
SET label = excluded.label,
    description = excluded.description,
    status = excluded.status,
    allowed_surfaces = excluded.allowed_surfaces,
    allowed_tools = excluded.allowed_tools,
    allowed_source_kinds = excluded.allowed_source_kinds,
    model_setting_key = excluded.model_setting_key,
    output_schema = excluded.output_schema,
    default_config = excluded.default_config,
    can_spawn_agents = FALSE,
    updated_at = NOW();
