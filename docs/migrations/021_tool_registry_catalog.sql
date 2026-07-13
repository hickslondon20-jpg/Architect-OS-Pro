-- MA-06 Objective 1: tool registry catalog (hybrid overlay, keyed by slug) + tier -> model rows.
-- Catalog table lists every tool an agent can reach (native / skill / mcp). Code stays authoritative
-- for what a tool DOES (ToolDefinition + executor); this table is the runtime-editable catalog +
-- governance overlay (enabled, routing_tier). It does NOT track invocations or cost (that is
-- ai_usage_log's metering job, out of MA-06 scope).

-- 1) Catalog table --------------------------------------------------------------------------------
create table if not exists public.tool_registry (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text,
  description text,
  tool_type text not null check (tool_type in ('native', 'skill', 'mcp')),
  source_ref jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  routing_tier text check (routing_tier in ('worker', 'reasoning', 'synthesis')),
  is_code_registered boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tool_registry_type_idx on public.tool_registry(tool_type);
create index if not exists tool_registry_enabled_idx on public.tool_registry(enabled);
create index if not exists tool_registry_drift_idx on public.tool_registry(is_code_registered);

-- Platform-global config: match platform_ai_settings / ai_models (RLS on, no public policies -> service-role only).
alter table public.tool_registry enable row level security;

-- 2) Tier -> model rows (reuse platform_ai_settings + resolve_platform_model; no parallel table) ---
--    worker = Haiku (low cost); synthesis / reasoning = Sonnet (current standard). Haiku already
--    exists in ai_models. Swapping a tier's model is a one-row edit here.
insert into public.platform_ai_settings (setting_key, model_id, fallback_model_name, provider, is_enabled, settings)
select 'tier_worker', id, 'claude-3-5-haiku-latest', 'anthropic', true,
       '{"tier":"worker","purpose":"low-cost bounded worker tasks"}'::jsonb
from public.ai_models
where provider = 'anthropic' and model_name = 'claude-3-5-haiku-latest'
on conflict (setting_key) do update
set model_id = excluded.model_id,
    fallback_model_name = excluded.fallback_model_name,
    provider = excluded.provider,
    is_enabled = excluded.is_enabled,
    settings = public.platform_ai_settings.settings || excluded.settings,
    updated_at = now();

insert into public.platform_ai_settings (setting_key, model_id, fallback_model_name, provider, is_enabled, settings)
select tier.key, model.id, 'claude-sonnet-4-6', 'anthropic', true,
       jsonb_build_object('tier', tier.tier_name, 'purpose', tier.purpose)
from (
  values
    ('tier_synthesis', 'synthesis', 'primary synthesis / chat quality'),
    ('tier_reasoning', 'reasoning', 'multi-step reasoning (Sonnet until a distinct reasoning model is adopted)')
) as tier(key, tier_name, purpose)
cross join public.ai_models model
where model.provider = 'anthropic' and model.model_name = 'claude-sonnet-4-6'
on conflict (setting_key) do update
set model_id = excluded.model_id,
    fallback_model_name = excluded.fallback_model_name,
    provider = excluded.provider,
    is_enabled = excluded.is_enabled,
    settings = public.platform_ai_settings.settings || excluded.settings,
    updated_at = now();

-- 3) Seed native tool identities (idempotent). Descriptions are enriched from code by the boot sync;
--    on conflict we refresh catalog-derived fields only and PRESERVE governance (enabled, routing_tier).
insert into public.tool_registry (slug, label, tool_type, source_ref, is_code_registered, last_synced_at)
select v.slug, v.label, 'native', '{"kind":"native"}'::jsonb, true, now()
from (
  values
    ('kb_ls', 'KB: List Folder'),
    ('kb_tree', 'KB: Tree'),
    ('kb_grep', 'KB: Grep'),
    ('kb_glob', 'KB: Glob'),
    ('kb_read', 'KB: Read File'),
    ('wiki_search', 'Wiki: Search'),
    ('wiki_get_page', 'Wiki: Get Page'),
    ('wiki_list', 'Wiki: List'),
    ('execute_code', 'Sandbox: Execute Code'),
    ('read_skill_file', 'Skill: Read File'),
    ('tool_search', 'Registry: Tool Search'),
    ('delegate_to_sub_agent', 'Delegate to Sub-Agent'),
    ('read_todos', 'Todos: Read'),
    ('write_todos', 'Todos: Write'),
    ('list_files', 'Files: List'),
    ('read_file', 'Files: Read'),
    ('write_file', 'Files: Write'),
    ('edit_file', 'Files: Edit'),
    ('task', 'Task'),
    ('ask_user', 'Ask User')
) as v(slug, label)
on conflict (slug) do update
set label = excluded.label,
    tool_type = excluded.tool_type,
    source_ref = excluded.source_ref,
    is_code_registered = true,
    last_synced_at = now(),
    updated_at = now();
