-- Module 7: governed founder datasets, read-only query audit, and disabled web-search config.

create table if not exists public.founder_datasets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source_document_id uuid references public.ose_raw_document_registry(id) on delete set null,
  dataset_name text not null,
  dataset_type text,
  status text not null default 'created',
  source_period_grain text,
  normalized_period_grain text,
  source_time_zone text,
  currency_code text,
  confidence numeric,
  summary text,
  provenance jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint founder_datasets_status_check
    check (status in ('created', 'mapping', 'ready', 'needs_review', 'failed', 'archived')),
  constraint founder_datasets_dataset_type_check
    check (
      dataset_type is null
      or dataset_type in ('pnl', 'expenses', 'utilization', 'capacity', 'client_concentration', 'pipeline', 'generic_table')
    ),
  constraint founder_datasets_period_grain_check
    check (
      source_period_grain is null
      or source_period_grain in ('day', 'week', 'month', 'quarter', 'year', 'mixed', 'unknown')
    ),
  constraint founder_datasets_normalized_period_grain_check
    check (
      normalized_period_grain is null
      or normalized_period_grain in ('day', 'week', 'month', 'quarter', 'year', 'mixed', 'unknown')
    ),
  constraint founder_datasets_confidence_check
    check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create table if not exists public.founder_dataset_tables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  dataset_id uuid not null references public.founder_datasets(id) on delete cascade,
  table_key text not null,
  label text,
  source_sheet_name text,
  source_table_name text,
  row_count integer,
  column_count integer,
  parser_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint founder_dataset_tables_key_unique unique (dataset_id, table_key)
);

create table if not exists public.founder_dataset_columns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  dataset_id uuid not null references public.founder_datasets(id) on delete cascade,
  table_id uuid not null references public.founder_dataset_tables(id) on delete cascade,
  source_column_name text not null,
  source_column_index integer,
  normalized_key text,
  data_type text,
  semantic_role text,
  unit text,
  confidence numeric,
  requires_review boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint founder_dataset_columns_data_type_check
    check (data_type is null or data_type in ('text', 'number', 'currency', 'percent', 'date', 'boolean', 'json')),
  constraint founder_dataset_columns_semantic_role_check
    check (semantic_role is null or semantic_role in ('metric', 'dimension', 'period', 'entity', 'amount', 'rate', 'notes')),
  constraint founder_dataset_columns_confidence_check
    check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create table if not exists public.founder_dataset_rows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  dataset_id uuid not null references public.founder_datasets(id) on delete cascade,
  table_id uuid not null references public.founder_dataset_tables(id) on delete cascade,
  source_row_index integer,
  row_label text,
  period_start date,
  period_end date,
  period_grain text,
  entity_name text,
  values jsonb not null default '{}'::jsonb,
  normalized_values jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  confidence numeric,
  requires_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint founder_dataset_rows_period_grain_check
    check (period_grain is null or period_grain in ('day', 'week', 'month', 'quarter', 'year', 'unknown')),
  constraint founder_dataset_rows_confidence_check
    check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create table if not exists public.founder_dataset_queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  thread_id uuid,
  tool_call_id text,
  question text not null,
  generated_sql text,
  approved_query_surface text,
  status text not null default 'created',
  rejection_reason text,
  execution_ms integer,
  row_count integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint founder_dataset_queries_status_check
    check (status in ('created', 'validated', 'rejected', 'executed', 'failed'))
);

create table if not exists public.founder_dataset_query_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  query_id uuid not null references public.founder_dataset_queries(id) on delete cascade,
  result_rows jsonb not null default '[]'::jsonb,
  result_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists founder_datasets_user_status_idx
  on public.founder_datasets(user_id, status);
create index if not exists founder_datasets_user_source_document_idx
  on public.founder_datasets(user_id, source_document_id);
create index if not exists founder_datasets_metadata_idx
  on public.founder_datasets using gin(metadata);
create index if not exists founder_dataset_tables_user_dataset_idx
  on public.founder_dataset_tables(user_id, dataset_id);
create index if not exists founder_dataset_columns_user_dataset_table_idx
  on public.founder_dataset_columns(user_id, dataset_id, table_id);
create index if not exists founder_dataset_columns_normalized_key_idx
  on public.founder_dataset_columns(user_id, normalized_key);
create index if not exists founder_dataset_rows_user_dataset_table_idx
  on public.founder_dataset_rows(user_id, dataset_id, table_id);
create index if not exists founder_dataset_rows_period_idx
  on public.founder_dataset_rows(user_id, period_start, period_end);
create index if not exists founder_dataset_rows_values_idx
  on public.founder_dataset_rows using gin(values);
create index if not exists founder_dataset_rows_normalized_values_idx
  on public.founder_dataset_rows using gin(normalized_values);
create index if not exists founder_dataset_queries_user_status_idx
  on public.founder_dataset_queries(user_id, status, created_at desc);
create index if not exists founder_dataset_query_results_user_query_idx
  on public.founder_dataset_query_results(user_id, query_id);

alter table public.founder_datasets enable row level security;
alter table public.founder_dataset_tables enable row level security;
alter table public.founder_dataset_columns enable row level security;
alter table public.founder_dataset_rows enable row level security;
alter table public.founder_dataset_queries enable row level security;
alter table public.founder_dataset_query_results enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'founder_datasets',
    'founder_dataset_tables',
    'founder_dataset_columns',
    'founder_dataset_rows',
    'founder_dataset_queries',
    'founder_dataset_query_results'
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

grant select, insert, update, delete on
  public.founder_datasets,
  public.founder_dataset_tables,
  public.founder_dataset_columns,
  public.founder_dataset_rows,
  public.founder_dataset_queries,
  public.founder_dataset_query_results
to authenticated;

grant all on
  public.founder_datasets,
  public.founder_dataset_tables,
  public.founder_dataset_columns,
  public.founder_dataset_rows,
  public.founder_dataset_queries,
  public.founder_dataset_query_results
to service_role;

create or replace view public.founder_dataset_rows_v
with (security_invoker = true)
as
select
  r.id,
  r.user_id,
  r.dataset_id,
  d.dataset_name,
  d.dataset_type,
  r.table_id,
  t.table_key,
  t.label as table_label,
  r.source_row_index,
  r.row_label,
  r.period_start,
  r.period_end,
  r.period_grain,
  r.entity_name,
  r.values,
  r.normalized_values,
  r.provenance,
  r.confidence,
  r.requires_review,
  r.created_at
from public.founder_dataset_rows r
join public.founder_datasets d on d.id = r.dataset_id and d.user_id = r.user_id
join public.founder_dataset_tables t on t.id = r.table_id and t.user_id = r.user_id
where d.status <> 'archived';

grant select on public.founder_dataset_rows_v to authenticated;
grant select on public.founder_dataset_rows_v to service_role;

insert into public.platform_ai_settings (setting_key, fallback_model_name, provider, is_enabled, settings)
values (
  'web_search_fallback',
  null,
  'disabled',
  false,
  '{"enabled":false,"provider":null,"privacy":"Do not send founder-private data to external search providers.","require_citations":true}'::jsonb
)
on conflict (setting_key) do update
set fallback_model_name = excluded.fallback_model_name,
    provider = excluded.provider,
    is_enabled = false,
    settings = excluded.settings,
    updated_at = now();
