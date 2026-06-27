-- Module 3 Record Manager: content hashing and user-scoped duplicate handling.

alter table public.ose_raw_document_registry
  add column if not exists content_hash text,
  add column if not exists hash_algorithm text not null default 'sha256',
  add column if not exists duplicate_of_document_id uuid null references public.ose_raw_document_registry(id),
  add column if not exists record_state text not null default 'active',
  add column if not exists source_version integer not null default 1,
  add column if not exists supersedes_document_id uuid null references public.ose_raw_document_registry(id),
  add column if not exists last_hash_checked_at timestamptz;

update public.ose_raw_document_registry
set record_state = case
    when status = 'deleted' then 'deleted'
    when status = 'duplicate' then 'duplicate'
    else coalesce(nullif(record_state, ''), 'active')
  end,
  hash_algorithm = coalesce(nullif(hash_algorithm, ''), 'sha256'),
  source_version = greatest(coalesce(source_version, 1), 1);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ose_raw_document_registry_record_state_check'
      and conrelid = 'public.ose_raw_document_registry'::regclass
  ) then
    alter table public.ose_raw_document_registry
      add constraint ose_raw_document_registry_record_state_check
      check (record_state in ('active', 'duplicate', 'superseded', 'deleted'));
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'ose_raw_document_registry_status_check'
      and conrelid = 'public.ose_raw_document_registry'::regclass
      and pg_get_constraintdef(oid) not like '%duplicate%'
  ) then
    alter table public.ose_raw_document_registry
      drop constraint ose_raw_document_registry_status_check;

    alter table public.ose_raw_document_registry
      add constraint ose_raw_document_registry_status_check
      check (status in ('uploaded', 'processing', 'ingested', 'failed', 'deleted', 'duplicate'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ose_raw_document_registry_source_version_check'
      and conrelid = 'public.ose_raw_document_registry'::regclass
  ) then
    alter table public.ose_raw_document_registry
      add constraint ose_raw_document_registry_source_version_check
      check (source_version >= 1);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ose_raw_document_registry_no_self_duplicate'
      and conrelid = 'public.ose_raw_document_registry'::regclass
  ) then
    alter table public.ose_raw_document_registry
      add constraint ose_raw_document_registry_no_self_duplicate
      check (duplicate_of_document_id is null or duplicate_of_document_id <> id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ose_raw_document_registry_no_self_supersede'
      and conrelid = 'public.ose_raw_document_registry'::regclass
  ) then
    alter table public.ose_raw_document_registry
      add constraint ose_raw_document_registry_no_self_supersede
      check (supersedes_document_id is null or supersedes_document_id <> id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ose_raw_document_registry_id_user_unique'
      and conrelid = 'public.ose_raw_document_registry'::regclass
  ) then
    alter table public.ose_raw_document_registry
      add constraint ose_raw_document_registry_id_user_unique unique (id, user_id);
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'ose_raw_document_registry_duplicate_of_document_id_fkey'
      and conrelid = 'public.ose_raw_document_registry'::regclass
  ) then
    alter table public.ose_raw_document_registry
      drop constraint ose_raw_document_registry_duplicate_of_document_id_fkey;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ose_raw_document_registry_duplicate_same_user_fkey'
      and conrelid = 'public.ose_raw_document_registry'::regclass
  ) then
    alter table public.ose_raw_document_registry
      add constraint ose_raw_document_registry_duplicate_same_user_fkey
      foreign key (duplicate_of_document_id, user_id)
      references public.ose_raw_document_registry(id, user_id);
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'ose_raw_document_registry_supersedes_document_id_fkey'
      and conrelid = 'public.ose_raw_document_registry'::regclass
  ) then
    alter table public.ose_raw_document_registry
      drop constraint ose_raw_document_registry_supersedes_document_id_fkey;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ose_raw_document_registry_supersedes_same_user_fkey'
      and conrelid = 'public.ose_raw_document_registry'::regclass
  ) then
    alter table public.ose_raw_document_registry
      add constraint ose_raw_document_registry_supersedes_same_user_fkey
      foreign key (supersedes_document_id, user_id)
      references public.ose_raw_document_registry(id, user_id);
  end if;
end $$;

create unique index if not exists ose_raw_document_registry_user_active_hash_uidx
  on public.ose_raw_document_registry(user_id, content_hash)
  where record_state = 'active' and content_hash is not null;

create index if not exists ose_raw_document_registry_user_duplicate_idx
  on public.ose_raw_document_registry(user_id, duplicate_of_document_id);

create index if not exists ose_raw_document_registry_user_supersedes_idx
  on public.ose_raw_document_registry(user_id, supersedes_document_id);

create index if not exists ose_raw_document_registry_user_hash_idx
  on public.ose_raw_document_registry(user_id, content_hash);

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
  metadata,
  hash_algorithm,
  duplicate_of_document_id,
  record_state,
  source_version,
  supersedes_document_id,
  last_hash_checked_at
from public.ose_raw_document_registry
where status <> 'deleted';
