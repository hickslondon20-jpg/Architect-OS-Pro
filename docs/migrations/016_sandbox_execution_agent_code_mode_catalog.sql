-- Phase 4 Advanced Tool Calling (Sandbox Bridge / Code Mode): widen the
-- sandbox_execution_agent capability's authorized-tools set so the exec-channel
-- bridge's Code Mode catalog (registry.get_tools(surface, capability=
-- 'sandbox_execution_agent'), filtered host-side to exclude execute_code and
-- read_skill_file) has the KB navigation/read + wiki read tools to expose.
--
-- This does NOT change what the top-level Virtual CSO tool-use loop offers
-- Claude for this capability - that list stays exactly execute_code and
-- read_skill_file, sourced from the SANDBOX_EXECUTION_TOOLS constant in
-- sandbox_execution_service.py, independent of this table.

UPDATE public.agent_capabilities
SET
  allowed_tools = ARRAY[
    'execute_code',
    'read_skill_file',
    'kb_ls',
    'kb_tree',
    'kb_grep',
    'kb_glob',
    'kb_read',
    'wiki_search',
    'wiki_get_page',
    'wiki_list'
  ],
  updated_at = now()
WHERE capability_key = 'sandbox_execution_agent';
