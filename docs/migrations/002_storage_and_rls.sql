-- Ep1 Module 2: user-isolated storage, OpenAI embedding dimensions, and user-scoped retrieval.
-- Assumes Module 1 created the OS Engine registry and document chunk tables.

create extension if not exists vector;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kb_files',
  'kb_files',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.ose_raw_document_registry enable row level security;
alter table public.document_chunks enable row level security;
alter table public.vcso_chat_threads enable row level security;
alter table public.vcso_chat_messages enable row level security;

-- text-embedding-3-small returns 1536-dimensional embeddings.
drop index if exists public.document_chunks_embedding_idx;
drop function if exists public.match_document_chunks(vector(384), text, integer, uuid, double precision, double precision);

alter table public.document_chunks
  alter column embedding type vector(1536)
  using null::vector(1536),
  alter column embedding_model set default 'text-embedding-3-small';

create index if not exists document_chunks_embedding_idx
on public.document_chunks using hnsw (embedding vector_cosine_ops);

create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  query_text text default null,
  match_count integer default 8,
  target_user_id uuid default auth.uid(),
  keyword_weight double precision default 0.35,
  vector_weight double precision default 0.65
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

grant execute on function public.match_document_chunks(vector(1536), text, integer, uuid, double precision, double precision) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'kb_files_select_own_folder'
  ) then
    create policy kb_files_select_own_folder on storage.objects
      for select to authenticated
      using (bucket_id = 'kb_files' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'kb_files_insert_own_folder'
  ) then
    create policy kb_files_insert_own_folder on storage.objects
      for insert to authenticated
      with check (bucket_id = 'kb_files' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'kb_files_update_own_folder'
  ) then
    create policy kb_files_update_own_folder on storage.objects
      for update to authenticated
      using (bucket_id = 'kb_files' and (storage.foldername(name))[1] = (select auth.uid())::text)
      with check (bucket_id = 'kb_files' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'kb_files_delete_own_folder'
  ) then
    create policy kb_files_delete_own_folder on storage.objects
      for delete to authenticated
      using (bucket_id = 'kb_files' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ose_raw_document_registry' and policyname = 'ose_raw_document_registry_select_own'
  ) then
    create policy ose_raw_document_registry_select_own on public.ose_raw_document_registry
      for select to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ose_raw_document_registry' and policyname = 'ose_raw_document_registry_insert_own'
  ) then
    create policy ose_raw_document_registry_insert_own on public.ose_raw_document_registry
      for insert to authenticated
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ose_raw_document_registry' and policyname = 'ose_raw_document_registry_update_own'
  ) then
    create policy ose_raw_document_registry_update_own on public.ose_raw_document_registry
      for update to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ose_raw_document_registry' and policyname = 'ose_raw_document_registry_delete_own'
  ) then
    create policy ose_raw_document_registry_delete_own on public.ose_raw_document_registry
      for delete to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'vcso_chat_threads' and column_name = 'user_id') then
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vcso_chat_threads' and policyname = 'vcso_chat_threads_select_own') then
      create policy vcso_chat_threads_select_own on public.vcso_chat_threads for select to authenticated using ((select auth.uid()) = user_id);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vcso_chat_threads' and policyname = 'vcso_chat_threads_insert_own') then
      create policy vcso_chat_threads_insert_own on public.vcso_chat_threads for insert to authenticated with check ((select auth.uid()) = user_id);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vcso_chat_threads' and policyname = 'vcso_chat_threads_update_own') then
      create policy vcso_chat_threads_update_own on public.vcso_chat_threads for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vcso_chat_threads' and policyname = 'vcso_chat_threads_delete_own') then
      create policy vcso_chat_threads_delete_own on public.vcso_chat_threads for delete to authenticated using ((select auth.uid()) = user_id);
    end if;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'vcso_chat_messages' and column_name = 'user_id') then
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vcso_chat_messages' and policyname = 'vcso_chat_messages_select_own') then
      create policy vcso_chat_messages_select_own on public.vcso_chat_messages for select to authenticated using ((select auth.uid()) = user_id);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vcso_chat_messages' and policyname = 'vcso_chat_messages_insert_own') then
      create policy vcso_chat_messages_insert_own on public.vcso_chat_messages for insert to authenticated with check ((select auth.uid()) = user_id);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vcso_chat_messages' and policyname = 'vcso_chat_messages_update_own') then
      create policy vcso_chat_messages_update_own on public.vcso_chat_messages for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vcso_chat_messages' and policyname = 'vcso_chat_messages_delete_own') then
      create policy vcso_chat_messages_delete_own on public.vcso_chat_messages for delete to authenticated using ((select auth.uid()) = user_id);
    end if;
  end if;
end $$;

