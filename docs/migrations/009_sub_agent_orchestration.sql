-- Module 8: bounded sub-agent orchestration scaffold.

create table if not exists public.agent_capabilities (
  id uuid primary key default gen_random_uuid(),
  capability_key text unique not null,
  label text not null,
  description text not null,
  status text not null default 'disabled',
  allowed_surfaces text[] not null default '{}'::text[],
  allowed_tools text[] not null default '{}'::text[],
  allowed_source_kinds text[] not null default '{}'::text[],
  model_setting_key text,
  output_schema jsonb not null default '{}'::jsonb,
  default_config jsonb not null default '{}'::jsonb,
  can_spawn_agents boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_capabilities_status_check
    check (status in ('enabled', 'disabled', 'experimental')),
  constraint agent_capabilities_no_spawning_check
    check (can_spawn_agents = false)
);

create table if not exists public.agent_delegation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  capability_id uuid references public.agent_capabilities(id) on delete set null,
  capability_key text not null,
  parent_surface text not null,
  parent_thread_id uuid,
  parent_message_id uuid,
  parent_run_id uuid references public.agent_delegation_runs(id) on delete set null,
  status text not null default 'queued',
  task_title text,
  task_summary text not null,
  context_scope jsonb not null default '{}'::jsonb,
  allowed_tools_snapshot jsonb not null default '[]'::jsonb,
  result_summary text,
  structured_result jsonb not null default '{}'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  confidence numeric,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_delegation_runs_surface_check
    check (parent_surface in ('virtual_cso', 'os_engine', 'domain_agent', 'sprint_planning', 'system')),
  constraint agent_delegation_runs_status_check
    check (status in ('queued', 'running', 'completed', 'failed', 'cancelled', 'skipped')),
  constraint agent_delegation_runs_confidence_check
    check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create table if not exists public.agent_delegation_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  run_id uuid not null references public.agent_delegation_runs(id) on delete cascade,
  step_index integer not null,
  step_type text not null,
  status text not null default 'completed',
  tool_name text,
  title text,
  summary text,
  input_summary jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_delegation_steps_type_check
    check (step_type in ('context_build', 'tool_call', 'source_review', 'result', 'error')),
  constraint agent_delegation_steps_status_check
    check (status in ('queued', 'running', 'completed', 'failed', 'skipped')),
  constraint agent_delegation_steps_unique_index unique (run_id, step_index)
);

create table if not exists public.agent_context_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  run_id uuid not null references public.agent_delegation_runs(id) on delete cascade,
  source_kind text not null,
  source_id uuid,
  source_label text,
  source_metadata jsonb not null default '{}'::jsonb,
  citation_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_context_sources_kind_check
    check (source_kind in ('document_chunk', 'raw_document', 'founder_dataset', 'dataset_row', 'wiki_page', 'web_result'))
);

create index if not exists agent_capabilities_status_idx
  on public.agent_capabilities(status, capability_key);
create index if not exists agent_delegation_runs_user_status_idx
  on public.agent_delegation_runs(user_id, status, created_at desc);
create index if not exists agent_delegation_runs_user_capability_idx
  on public.agent_delegation_runs(user_id, capability_key, created_at desc);
create index if not exists agent_delegation_runs_parent_thread_idx
  on public.agent_delegation_runs(user_id, parent_thread_id);
create index if not exists agent_delegation_steps_user_run_idx
  on public.agent_delegation_steps(user_id, run_id, step_index);
create index if not exists agent_context_sources_user_run_idx
  on public.agent_context_sources(user_id, run_id);
create index if not exists agent_context_sources_user_kind_idx
  on public.agent_context_sources(user_id, source_kind, source_id);

alter table public.agent_capabilities enable row level security;
alter table public.agent_delegation_runs enable row level security;
alter table public.agent_delegation_steps enable row level security;
alter table public.agent_context_sources enable row level security;

drop policy if exists agent_capabilities_safe_read on public.agent_capabilities;
create policy agent_capabilities_safe_read
on public.agent_capabilities
for select
to authenticated
using (status in ('enabled', 'experimental'));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'agent_delegation_runs',
    'agent_delegation_steps',
    'agent_context_sources'
  ]
  loop
    execute format('drop policy if exists %I_select_own on public.%I', table_name, table_name);
    execute format('drop policy if exists %I_insert_own on public.%I', table_name, table_name);
    execute format('drop policy if exists %I_update_own on public.%I', table_name, table_name);
    execute format('drop policy if exists %I_delete_own on public.%I', table_name, table_name);

    execute format(
      'create policy %I_select_own on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      table_name,
      table_name
    );
    execute format(
      'create policy %I_insert_own on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      table_name,
      table_name
    );
    execute format(
      'create policy %I_update_own on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      table_name,
      table_name
    );
    execute format(
      'create policy %I_delete_own on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      table_name,
      table_name
    );
  end loop;
end $$;

grant select on public.agent_capabilities to authenticated;
grant select, insert, update, delete on
  public.agent_delegation_runs,
  public.agent_delegation_steps,
  public.agent_context_sources
to authenticated;

grant all on
  public.agent_capabilities,
  public.agent_delegation_runs,
  public.agent_delegation_steps,
  public.agent_context_sources
to service_role;

insert into public.agent_capabilities (
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
values
  (
    'document_analysis_agent',
    'Document analysis',
    'Reviews scoped founder documents and chunks, then returns compact findings with citations.',
    'experimental',
    array['virtual_cso', 'os_engine', 'domain_agent'],
    array['retrieve_document_chunks', 'read_raw_document_metadata'],
    array['raw_document', 'document_chunk'],
    'document_analysis_agent',
    '{"version":"agent_result_v1","required":["summary","findings","sources"]}'::jsonb,
    '{"max_sources":8,"max_rounds":1,"timeout_seconds":20}'::jsonb,
    false
  ),
  (
    'retrieval_evidence_agent',
    'Evidence review',
    'Collects scoped retrieval evidence for a parent answer without writing synthesis content.',
    'disabled',
    array['virtual_cso', 'os_engine', 'domain_agent'],
    array['retrieve_document_chunks'],
    array['document_chunk'],
    'retrieval_evidence_agent',
    '{"version":"agent_result_v1","required":["summary","sources"]}'::jsonb,
    '{"max_sources":8,"max_rounds":1,"timeout_seconds":20}'::jsonb,
    false
  ),
  (
    'structured_data_agent',
    'Dataset analysis',
    'Reviews scoped founder datasets or approved structured query results.',
    'experimental',
    array['virtual_cso', 'os_engine', 'domain_agent'],
    array['run_structured_dataset_query', 'read_founder_dataset_summary'],
    array['founder_dataset', 'dataset_row'],
    'structured_data_agent',
    '{"version":"agent_result_v1","required":["summary","findings","sources"]}'::jsonb,
    '{"max_sources":8,"max_rounds":1,"timeout_seconds":20}'::jsonb,
    false
  ),
  (
    'metadata_review_agent',
    'Metadata review',
    'Reviews scoped document metadata quality and flags gaps for later review.',
    'disabled',
    array['os_engine', 'domain_agent'],
    array['read_raw_document_metadata'],
    array['raw_document'],
    'metadata_review_agent',
    '{"version":"agent_result_v1","required":["summary","review_flags"]}'::jsonb,
    '{"max_sources":8,"max_rounds":1,"timeout_seconds":20}'::jsonb,
    false
  ),
  (
    'strategy_synthesis_agent',
    'Strategy synthesis',
    'Future placeholder for bounded strategy synthesis after evidence and dataset tools mature.',
    'disabled',
    array['virtual_cso', 'domain_agent'],
    array[]::text[],
    array[]::text[],
    'strategy_synthesis_agent',
    '{"version":"agent_result_v1","required":["summary"]}'::jsonb,
    '{"max_sources":0,"max_rounds":1,"timeout_seconds":20}'::jsonb,
    false
  ),
  (
    'sprint_planning_helper',
    'Sprint planning helper',
    'Future placeholder for scoped sprint planning review without Deep Mode or harness execution.',
    'disabled',
    array['sprint_planning'],
    array[]::text[],
    array[]::text[],
    'sprint_planning_helper',
    '{"version":"agent_result_v1","required":["summary"]}'::jsonb,
    '{"max_sources":0,"max_rounds":1,"timeout_seconds":20}'::jsonb,
    false
  )
on conflict (capability_key) do update
set label = excluded.label,
    description = excluded.description,
    status = excluded.status,
    allowed_surfaces = excluded.allowed_surfaces,
    allowed_tools = excluded.allowed_tools,
    allowed_source_kinds = excluded.allowed_source_kinds,
    model_setting_key = excluded.model_setting_key,
    output_schema = excluded.output_schema,
    default_config = excluded.default_config,
    can_spawn_agents = false,
    updated_at = now();
