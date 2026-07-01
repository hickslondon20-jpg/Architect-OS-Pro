-- Module 6: explicit hybrid search candidate sets, RRF fusion, and optional reranker settings.

create index if not exists document_chunks_user_document_idx
  on public.document_chunks(user_id, document_id);

create index if not exists document_chunks_content_tsv_idx
  on public.document_chunks using gin(content_tsv);

create index if not exists document_chunks_metadata_idx
  on public.document_chunks using gin(metadata);

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'document_chunks'
      and indexname = 'document_chunks_embedding_idx'
  ) then
    create index document_chunks_embedding_idx
      on public.document_chunks using hnsw (embedding vector_cosine_ops);
  end if;
end $$;

insert into public.ai_models (provider, model_name, display_name, model_family, capabilities, cost_tier, notes)
values
  ('cohere', 'rerank-v4.0-pro', 'Cohere Rerank v4.0 Pro', 'rerank', array['rerank'], 'standard', 'Optional retrieval reranker only; gated by platform settings and COHERE_API_KEY.')
on conflict (provider, model_name) do update
set display_name = excluded.display_name,
    model_family = excluded.model_family,
    capabilities = excluded.capabilities,
    cost_tier = excluded.cost_tier,
    notes = excluded.notes,
    is_active = true,
    updated_at = now();

insert into public.platform_ai_settings (setting_key, model_id, fallback_model_name, provider, is_enabled, settings)
select
  'retrieval_reranker',
  id,
  'rerank-v4.0-pro',
  'cohere',
  false,
  '{"enabled":false,"top_n":8,"candidate_count":40,"timeout_seconds":6}'::jsonb
from public.ai_models
where provider = 'cohere' and model_name = 'rerank-v4.0-pro'
on conflict (setting_key) do update
set model_id = excluded.model_id,
    fallback_model_name = excluded.fallback_model_name,
    provider = excluded.provider,
    is_enabled = excluded.is_enabled,
    settings = excluded.settings,
    updated_at = now();

drop function if exists public.match_document_chunks(vector(384), text, integer, uuid, double precision, double precision);
drop function if exists public.match_document_chunks(vector(1536), text, integer, uuid, double precision, double precision);
drop function if exists public.match_document_chunks(vector(1536), text, integer, uuid, double precision, double precision, jsonb);
drop function if exists public.match_document_chunks(vector(1536), text, integer, uuid, double precision, double precision, jsonb, integer, integer);

create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  query_text text default null,
  match_count integer default 8,
  target_user_id uuid default auth.uid(),
  keyword_weight double precision default 0.35,
  vector_weight double precision default 0.65,
  metadata_filter jsonb default '{}'::jsonb,
  candidate_count integer default 40,
  rrf_k integer default 60
)
returns table (
  chunk_id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  vector_similarity double precision,
  keyword_rank double precision,
  hybrid_score double precision,
  source_kind text,
  vector_rank integer,
  keyword_rank_position integer,
  rrf_score double precision
)
language sql
stable
as $$
  with params as (
    select
      nullif(trim(query_text), '') as q_text,
      greatest(match_count, 1) as result_limit,
      greatest(candidate_count, greatest(match_count, 1)) as candidate_limit,
      greatest(rrf_k, 1) as fusion_k
  ),
  filtered_chunks as (
    select
      dc.id,
      dc.document_id,
      dc.content,
      dc.metadata,
      dc.embedding,
      dc.content_tsv
    from public.document_chunks dc
    where dc.user_id = target_user_id
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
  ),
  vector_candidates as (
    select
      fc.id as chunk_id,
      row_number() over (order by fc.embedding <=> query_embedding, fc.id) as vector_rank,
      case
        when query_embedding is null or fc.embedding is null then 0
        else 1 - (fc.embedding <=> query_embedding)
      end as vector_similarity
    from filtered_chunks fc, params p
    where query_embedding is not null
      and fc.embedding is not null
    order by fc.embedding <=> query_embedding, fc.id
    limit (select candidate_limit from params)
  ),
  keyword_candidates as (
    select
      fc.id as chunk_id,
      row_number() over (order by ts_rank_cd(fc.content_tsv, websearch_to_tsquery('english', p.q_text)) desc, fc.id) as keyword_rank_position,
      ts_rank_cd(fc.content_tsv, websearch_to_tsquery('english', p.q_text)) as keyword_rank
    from filtered_chunks fc, params p
    where p.q_text is not null
      and fc.content_tsv @@ websearch_to_tsquery('english', p.q_text)
    order by ts_rank_cd(fc.content_tsv, websearch_to_tsquery('english', p.q_text)) desc, fc.id
    limit (select candidate_limit from params)
  ),
  fused as (
    select
      coalesce(vc.chunk_id, kc.chunk_id) as chunk_id,
      vc.vector_rank,
      kc.keyword_rank_position,
      coalesce(vc.vector_similarity, 0) as vector_similarity,
      coalesce(kc.keyword_rank, 0) as keyword_rank,
      (
        case when vc.vector_rank is null then 0 else 1.0 / ((select fusion_k from params) + vc.vector_rank) end
        +
        case when kc.keyword_rank_position is null then 0 else 1.0 / ((select fusion_k from params) + kc.keyword_rank_position) end
      ) as rrf_score
    from vector_candidates vc
    full outer join keyword_candidates kc on kc.chunk_id = vc.chunk_id
  )
  select
    fc.id as chunk_id,
    fc.document_id,
    fc.content,
    fc.metadata,
    fused.vector_similarity,
    fused.keyword_rank,
    fused.rrf_score as hybrid_score,
    'raw_document_chunk'::text as source_kind,
    fused.vector_rank::integer,
    fused.keyword_rank_position::integer,
    fused.rrf_score
  from fused
  join filtered_chunks fc on fc.id = fused.chunk_id
  order by fused.rrf_score desc, fused.vector_similarity desc, fused.keyword_rank desc, fc.id
  limit (select result_limit from params);
$$;

grant execute on function public.match_document_chunks(vector(1536), text, integer, uuid, double precision, double precision, jsonb, integer, integer) to authenticated;
grant execute on function public.match_document_chunks(vector(1536), text, integer, uuid, double precision, double precision, jsonb, integer, integer) to service_role;
