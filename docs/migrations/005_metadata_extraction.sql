-- Module 4: metadata extraction settings, document metadata fields, and retrieval filters.

create table if not exists public.ai_models (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model_name text not null,
  display_name text not null,
  model_family text,
  capabilities text[] not null default '{}'::text[],
  cost_tier text not null default 'standard',
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_models_provider_model_unique unique (provider, model_name)
);

create table if not exists public.platform_ai_settings (
  setting_key text primary key,
  model_id uuid references public.ai_models(id),
  fallback_model_name text,
  provider text,
  is_enabled boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.metadata_schema_fields (
  id uuid primary key default gen_random_uuid(),
  field_key text not null unique,
  label text not null,
  description text,
  data_type text not null,
  is_required boolean not null default false,
  is_filterable boolean not null default false,
  show_in_uploads_panel boolean not null default false,
  display_order integer not null default 100,
  allowed_values text[],
  extraction_hint text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ose_raw_document_registry
  add column if not exists extracted_metadata jsonb not null default '{}'::jsonb,
  add column if not exists metadata_extraction_status text not null default 'pending',
  add column if not exists metadata_extraction_model text,
  add column if not exists metadata_extracted_at timestamptz,
  add column if not exists metadata_extraction_error text,
  add column if not exists metadata_document_type text,
  add column if not exists metadata_business_domain text,
  add column if not exists metadata_time_period text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ose_raw_document_registry_metadata_status_check'
      and conrelid = 'public.ose_raw_document_registry'::regclass
  ) then
    alter table public.ose_raw_document_registry
      add constraint ose_raw_document_registry_metadata_status_check
      check (metadata_extraction_status in ('pending', 'processing', 'complete', 'failed', 'skipped'));
  end if;
end $$;

create index if not exists ose_raw_document_registry_extracted_metadata_idx
  on public.ose_raw_document_registry using gin(extracted_metadata);
create index if not exists ose_raw_document_registry_metadata_document_type_idx
  on public.ose_raw_document_registry(user_id, metadata_document_type);
create index if not exists ose_raw_document_registry_metadata_business_domain_idx
  on public.ose_raw_document_registry(user_id, metadata_business_domain);
create index if not exists ose_raw_document_registry_metadata_time_period_idx
  on public.ose_raw_document_registry(user_id, metadata_time_period);
create index if not exists document_chunks_metadata_idx
  on public.document_chunks using gin(metadata);

alter table public.ai_models enable row level security;
alter table public.platform_ai_settings enable row level security;
alter table public.metadata_schema_fields enable row level security;

revoke all on public.ai_models from anon, authenticated;
revoke all on public.platform_ai_settings from anon, authenticated;
revoke all on public.metadata_schema_fields from anon, authenticated;
grant all on public.ai_models to service_role;
grant all on public.platform_ai_settings to service_role;
grant all on public.metadata_schema_fields to service_role;

insert into public.ai_models (provider, model_name, display_name, model_family, capabilities, cost_tier, notes)
values
  ('openai', 'text-embedding-3-small', 'OpenAI text-embedding-3-small', 'embedding', array['embedding'], 'low', 'Locked ingestion embedding model.'),
  ('openai', 'gpt-4o-mini', 'OpenAI GPT-4o mini', 'structured_extraction', array['chat', 'json', 'metadata_extraction'], 'low', 'Default ingestion metadata extraction model.'),
  ('anthropic', 'claude-sonnet-4-5', 'Claude Sonnet', 'chat', array['chat', 'reasoning'], 'standard', 'Registry awareness only; Virtual CSO chat remains on the existing Claude/Vercel boundary.')
on conflict (provider, model_name) do update
set display_name = excluded.display_name,
    model_family = excluded.model_family,
    capabilities = excluded.capabilities,
    cost_tier = excluded.cost_tier,
    notes = excluded.notes,
    is_active = true,
    updated_at = now();

insert into public.platform_ai_settings (setting_key, model_id, fallback_model_name, provider, is_enabled, settings)
select 'ingestion_embeddings', id, 'text-embedding-3-small', 'openai', true, '{"dimensions":1536}'::jsonb
from public.ai_models
where provider = 'openai' and model_name = 'text-embedding-3-small'
on conflict (setting_key) do update
set model_id = excluded.model_id,
    fallback_model_name = excluded.fallback_model_name,
    provider = excluded.provider,
    is_enabled = excluded.is_enabled,
    settings = excluded.settings,
    updated_at = now();

insert into public.platform_ai_settings (setting_key, model_id, fallback_model_name, provider, is_enabled, settings)
select 'ingestion_metadata_extraction', id, 'gpt-4o-mini', 'openai', true, '{"response_format":"json_object"}'::jsonb
from public.ai_models
where provider = 'openai' and model_name = 'gpt-4o-mini'
on conflict (setting_key) do update
set model_id = excluded.model_id,
    fallback_model_name = excluded.fallback_model_name,
    provider = excluded.provider,
    is_enabled = excluded.is_enabled,
    settings = excluded.settings,
    updated_at = now();

insert into public.platform_ai_settings (setting_key, model_id, fallback_model_name, provider, is_enabled, settings)
select 'vcso_chat', id, 'claude-sonnet-4-5', 'anthropic', true, '{"boundary":"vercel_vcso_chat"}'::jsonb
from public.ai_models
where provider = 'anthropic' and model_name = 'claude-sonnet-4-5'
on conflict (setting_key) do update
set model_id = excluded.model_id,
    fallback_model_name = excluded.fallback_model_name,
    provider = excluded.provider,
    is_enabled = excluded.is_enabled,
    settings = excluded.settings,
    updated_at = now();

insert into public.metadata_schema_fields (
  field_key,
  label,
  description,
  data_type,
  is_required,
  is_filterable,
  show_in_uploads_panel,
  display_order,
  extraction_hint
)
values
  ('document_title', 'Document title', 'Generated title for the uploaded document.', 'text', false, false, true, 10, 'Use the document title or create a concise descriptive title.'),
  ('document_type', 'Document type', 'Document category.', 'text', false, true, true, 20, 'Examples: P&L, strategy deck, meeting notes, client roster, operating plan, proposal.'),
  ('business_domain', 'Business domain', 'Primary business area represented by the document.', 'text', false, true, true, 30, 'Examples: financial, sales, marketing, delivery, operations, team, strategy.'),
  ('time_period', 'Time period', 'Relevant date range, quarter, month, or year.', 'text', false, true, true, 40, 'Extract the period the document describes, not the upload date.'),
  ('summary', 'Summary', 'Short document summary.', 'text', false, false, true, 50, 'Keep under 90 words and focus on useful business signal.'),
  ('topics', 'Topics', 'Important topics found in the document.', 'text_array', false, true, true, 60, 'Return 3 to 8 short tags.'),
  ('entities', 'Entities', 'Important people, clients, organizations, tools, or products.', 'text_array', false, true, false, 70, 'Return concrete named entities only.'),
  ('metrics', 'Metrics', 'Important metrics or KPIs.', 'text_array', false, true, true, 80, 'Return visible metrics such as revenue, margin, MRR, churn, pipeline, utilization, or capacity.'),
  ('keywords', 'Keywords', 'Search keywords.', 'text_array', false, true, false, 90, 'Return terms likely to help future retrieval.'),
  ('confidence', 'Confidence', 'Extractor confidence from 0 to 1.', 'number', false, false, true, 100, 'Estimate confidence in the extracted metadata.'),
  ('extraction_notes', 'Extraction notes', 'Brief caveats about extraction quality.', 'text', false, false, false, 110, 'Mention missing context, OCR uncertainty, or unclear period if relevant.')
on conflict (field_key) do update
set label = excluded.label,
    description = excluded.description,
    data_type = excluded.data_type,
    is_required = excluded.is_required,
    is_filterable = excluded.is_filterable,
    show_in_uploads_panel = excluded.show_in_uploads_panel,
    display_order = excluded.display_order,
    extraction_hint = excluded.extraction_hint,
    is_active = true,
    updated_at = now();

drop function if exists public.match_document_chunks(vector(1536), text, integer, uuid, double precision, double precision);
drop function if exists public.match_document_chunks(vector(1536), text, integer, uuid, double precision, double precision, jsonb);

create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  query_text text default null,
  match_count integer default 8,
  target_user_id uuid default auth.uid(),
  keyword_weight double precision default 0.35,
  vector_weight double precision default 0.65,
  metadata_filter jsonb default '{}'::jsonb
)
returns table (
  chunk_id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  vector_similarity double precision,
  keyword_rank double precision,
  hybrid_score double precision
)
language sql
stable
as $$
  with scored as (
    select
      dc.id as chunk_id,
      dc.document_id,
      dc.content,
      dc.metadata,
      case
        when query_embedding is null or dc.embedding is null then 0
        else 1 - (dc.embedding <=> query_embedding)
      end as vector_similarity,
      case
        when query_text is null or length(trim(query_text)) = 0 then 0
        else ts_rank_cd(dc.content_tsv, websearch_to_tsquery('english', query_text))
      end as keyword_rank
    from public.document_chunks dc
    where dc.user_id = target_user_id
      and (
        query_text is null
        or length(trim(query_text)) = 0
        or dc.content_tsv @@ websearch_to_tsquery('english', query_text)
        or query_embedding is not null
      )
      and (
        metadata_filter is null
        or metadata_filter = '{}'::jsonb
        or (
          (not (metadata_filter ? 'document_type') or dc.metadata->>'document_type' = metadata_filter->>'document_type')
          and (not (metadata_filter ? 'business_domain') or dc.metadata->>'business_domain' = metadata_filter->>'business_domain')
          and (not (metadata_filter ? 'time_period') or dc.metadata->>'time_period' = metadata_filter->>'time_period')
          and (
            not (metadata_filter ? 'topics')
            or (
              jsonb_typeof(metadata_filter->'topics') = 'array'
              and coalesce(dc.metadata->'topics', '[]'::jsonb) ?| ARRAY(select jsonb_array_elements_text(metadata_filter->'topics'))
            )
            or (
              jsonb_typeof(metadata_filter->'topics') = 'string'
              and coalesce(dc.metadata->'topics', '[]'::jsonb) ? (metadata_filter->>'topics')
            )
          )
          and (
            not (metadata_filter ? 'keywords')
            or (
              jsonb_typeof(metadata_filter->'keywords') = 'array'
              and coalesce(dc.metadata->'keywords', '[]'::jsonb) ?| ARRAY(select jsonb_array_elements_text(metadata_filter->'keywords'))
            )
            or (
              jsonb_typeof(metadata_filter->'keywords') = 'string'
              and coalesce(dc.metadata->'keywords', '[]'::jsonb) ? (metadata_filter->>'keywords')
            )
          )
        )
      )
  )
  select
    scored.chunk_id,
    scored.document_id,
    scored.content,
    scored.metadata,
    scored.vector_similarity,
    scored.keyword_rank,
    (scored.vector_similarity * vector_weight) + (scored.keyword_rank * keyword_weight) as hybrid_score
  from scored
  order by hybrid_score desc, vector_similarity desc
  limit greatest(match_count, 1);
$$;

grant execute on function public.match_document_chunks(vector(1536), text, integer, uuid, double precision, double precision, jsonb) to authenticated;
grant execute on function public.match_document_chunks(vector(1536), text, integer, uuid, double precision, double precision, jsonb) to service_role;
