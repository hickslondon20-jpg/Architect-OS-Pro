-- Module 2 repair: preserve raw uploads in raw-documents, add kb-files for synthesized Wiki artifacts,
-- and create the vector retrieval substrate against raw document registry rows.

create extension if not exists vector;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'raw-documents',
    'raw-documents',
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
  ),
  (
    'kb-files',
    'kb-files',
    false,
    52428800,
    array[
      'application/pdf',
      'text/markdown',
      'text/plain',
      'application/json'
    ]
  )
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.ose_raw_document_registry
  add column if not exists ingestion_error text,
  add column if not exists ingested_at timestamptz,
  add column if not exists chunk_count integer not null default 0,
  add column if not exists embedding_model text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.ose_raw_document_registry(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  content_tsv tsvector generated always as (to_tsvector('english', coalesce(content, ''))) stored,
  embedding vector(1536),
  embedding_model text not null default 'text-embedding-3-small',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_chunks_chunk_index_nonnegative check (chunk_index >= 0),
  constraint document_chunks_unique_chunk unique (document_id, chunk_index)
);

do $$
declare
  embedding_type text;
  existing_chunks integer;
begin
  select format_type(a.atttypid, a.atttypmod)
  into embedding_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'document_chunks'
    and a.attname = 'embedding'
    and not a.attisdropped;

  select count(*) into existing_chunks from public.document_chunks;

  if embedding_type <> 'vector(1536)' then
    if existing_chunks > 0 then
      raise exception 'document_chunks.embedding is %, but table has % rows. Refusing to clear existing embeddings automatically.', embedding_type, existing_chunks;
    end if;

    drop index if exists public.document_chunks_embedding_idx;

    alter table public.document_chunks
      alter column embedding type vector(1536)
      using null::vector(1536);
  end if;

  alter table public.document_chunks
    alter column embedding_model set default 'text-embedding-3-small';
end $$;

create index if not exists document_chunks_document_idx on public.document_chunks(document_id);
create index if not exists document_chunks_user_idx on public.document_chunks(user_id);
create index if not exists document_chunks_content_tsv_idx on public.document_chunks using gin(content_tsv);
create index if not exists document_chunks_embedding_idx on public.document_chunks using hnsw (embedding vector_cosine_ops);

alter table public.ose_raw_document_registry enable row level security;
alter table public.document_chunks enable row level security;
alter table public.vcso_chat_threads enable row level security;
alter table public.vcso_chat_messages enable row level security;

create or replace view public.documents
with (security_invoker = true)
as
select
  id,
  user_id,
  file_name,
  file_type,
  storage_path,
  size_bytes,
  status,
  content_hash,
  connected_pages,
  upload_timestamp,
  ingested_at,
  chunk_count,
  embedding_model,
  metadata
from public.ose_raw_document_registry
where status <> 'deleted';

grant select on public.documents to authenticated;
grant select, insert, update, delete on public.document_chunks to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_document_chunks_updated_at on public.document_chunks;
create trigger trg_document_chunks_updated_at
before update on public.document_chunks
for each row execute function public.set_updated_at();

drop function if exists public.match_document_chunks(vector(384), text, integer, uuid, double precision, double precision);

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
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'raw_documents_select_own_folder') then
    create policy raw_documents_select_own_folder on storage.objects
      for select to authenticated
      using (bucket_id = 'raw-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'raw_documents_insert_own_folder') then
    create policy raw_documents_insert_own_folder on storage.objects
      for insert to authenticated
      with check (bucket_id = 'raw-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'raw_documents_update_own_folder') then
    create policy raw_documents_update_own_folder on storage.objects
      for update to authenticated
      using (bucket_id = 'raw-documents' and (storage.foldername(name))[1] = (select auth.uid())::text)
      with check (bucket_id = 'raw-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'raw_documents_delete_own_folder') then
    create policy raw_documents_delete_own_folder on storage.objects
      for delete to authenticated
      using (bucket_id = 'raw-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'kb_files_select_own_folder') then
    create policy kb_files_select_own_folder on storage.objects
      for select to authenticated
      using (bucket_id = 'kb-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'kb_files_insert_own_folder') then
    create policy kb_files_insert_own_folder on storage.objects
      for insert to authenticated
      with check (bucket_id = 'kb-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'kb_files_update_own_folder') then
    create policy kb_files_update_own_folder on storage.objects
      for update to authenticated
      using (bucket_id = 'kb-files' and (storage.foldername(name))[1] = (select auth.uid())::text)
      with check (bucket_id = 'kb-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'kb_files_delete_own_folder') then
    create policy kb_files_delete_own_folder on storage.objects
      for delete to authenticated
      using (bucket_id = 'kb-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'document_chunks' and policyname = 'document_chunks_select_own') then
    create policy document_chunks_select_own on public.document_chunks
      for select to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'document_chunks' and policyname = 'document_chunks_insert_own') then
    create policy document_chunks_insert_own on public.document_chunks
      for insert to authenticated
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'document_chunks' and policyname = 'document_chunks_update_own') then
    create policy document_chunks_update_own on public.document_chunks
      for update to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'document_chunks' and policyname = 'document_chunks_delete_own') then
    create policy document_chunks_delete_own on public.document_chunks
      for delete to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end $$;
