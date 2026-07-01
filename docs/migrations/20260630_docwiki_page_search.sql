-- ArchitectOS Document Wiki Layer 2 Sub-phase 05: page semantic search RPC.
-- Pure cosine similarity - no hybrid BM25 (pages are synthesized prose, not raw chunks).

create or replace function public.match_ose_knowledge_pages(
  query_embedding   vector(1536),
  match_count       integer          default 8,
  target_user_id    uuid             default auth.uid(),
  match_threshold   double precision default 0.65,
  filter_page_kinds text[]           default null
)
returns table (
  page_id         uuid,
  title           text,
  content         text,
  canonical_key   text,
  page_kind       text,
  source_type     text,
  source_file_ids jsonb,
  created_at      timestamptz,
  updated_at      timestamptz,
  similarity      double precision
)
language sql
stable
as $$
  select
    p.id              as page_id,
    p.page_title      as title,
    p.content,
    p.canonical_key,
    p.page_kind,
    case
      when p.page_kind = 'sprint_history' then 'sprint'
      when p.page_kind = 'thread_synthesis' then 'cso_thread'
      when p.page_kind = 'agent_artifact' then 'agent_artifact'
      when coalesce(array_length(p.source_file_ids, 1), 0) > 0 then 'document'
      else null
    end               as source_type,
    to_jsonb(p.source_file_ids) as source_file_ids,
    p.last_updated    as created_at,
    p.updated_at,
    1 - (p.embedding <=> query_embedding) as similarity
  from public.ose_knowledge_pages p
  where p.user_id = target_user_id
    and p.embedding is not null
    and (filter_page_kinds is null or p.page_kind = any(filter_page_kinds))
    and (1 - (p.embedding <=> query_embedding)) >= match_threshold
  order by p.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_ose_knowledge_pages(
  vector(1536), integer, uuid, double precision, text[]
) to authenticated;

grant execute on function public.match_ose_knowledge_pages(
  vector(1536), integer, uuid, double precision, text[]
) to service_role;
