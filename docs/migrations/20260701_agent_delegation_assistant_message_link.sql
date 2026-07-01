-- Phase 2 (Agent Skills & Document Generation Engine): link agent_delegation_runs to the
-- assistant message a delegated run's result ultimately produced. parent_message_id (existing)
-- stays pointed at the triggering USER message across all parent_surface values and is NOT
-- changed; this new column is additive and Virtual-CSO-specific by construction.

ALTER TABLE public.agent_delegation_runs
  ADD COLUMN IF NOT EXISTS assistant_message_id UUID
  REFERENCES public.vcso_chat_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS agent_delegation_runs_assistant_message_idx
  ON public.agent_delegation_runs (assistant_message_id);

-- Rollback:
-- DROP INDEX IF EXISTS agent_delegation_runs_assistant_message_idx;
-- ALTER TABLE public.agent_delegation_runs DROP COLUMN IF EXISTS assistant_message_id;
