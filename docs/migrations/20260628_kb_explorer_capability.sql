-- Insert kb_explorer_agent capability into agent_capabilities table.
-- Uses INSERT ... ON CONFLICT DO NOTHING to be safe on repeated runs.
INSERT INTO agent_capabilities (
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
    'kb_explorer_agent',
    'Knowledge Base Explorer',
    'Navigates and reads the founder''s uploaded document library using ls, tree, grep, glob, and read tools. Returns synthesized findings grounded in document content.',
    'experimental',
    ARRAY['virtual_cso', 'os_engine', 'domain_agent'],
    ARRAY['kb_ls', 'kb_tree', 'kb_grep', 'kb_glob', 'kb_read'],
    ARRAY[]::TEXT[],
    'kb_explorer_agent',
    '{"version": "agent_result_v1"}'::jsonb,
    '{"max_rounds": 5, "timeout_seconds": 60}'::jsonb,
    FALSE
)
ON CONFLICT (capability_key) DO NOTHING;
