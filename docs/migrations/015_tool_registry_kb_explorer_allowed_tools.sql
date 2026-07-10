-- Phase 2 Advanced Tool Calling: align kb_explorer_agent authorization with
-- the already-live KB Explorer tool surface before the tool registry enforces it.

UPDATE public.agent_capabilities
SET
  allowed_tools = ARRAY[
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
WHERE capability_key = 'kb_explorer_agent';
