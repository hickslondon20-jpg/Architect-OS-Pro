-- Phase 4 remediation: bound sandbox execution to two model rounds.
-- The planner remains dark; this only tightens the existing worker capability budget.

UPDATE public.agent_capabilities
SET default_config = jsonb_set(
      COALESCE(default_config, '{}'::jsonb),
      '{max_rounds}',
      '2'::jsonb,
      true
    ),
    updated_at = NOW()
WHERE capability_key = 'sandbox_execution_agent';
