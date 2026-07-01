-- Module 5: Docling multi-format parser metadata and cleanup support.

alter table public.ose_raw_document_registry
  add column if not exists parser_status text not null default 'pending',
  add column if not exists parser_name text,
  add column if not exists parser_version text,
  add column if not exists parser_format text,
  add column if not exists parser_warnings text[] not null default '{}'::text[],
  add column if not exists extraction_quality text,
  add column if not exists source_format_metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ose_raw_document_registry_parser_status_check'
      and conrelid = 'public.ose_raw_document_registry'::regclass
  ) then
    alter table public.ose_raw_document_registry
      add constraint ose_raw_document_registry_parser_status_check
      check (parser_status in ('pending', 'processing', 'complete', 'failed', 'skipped'));
  end if;
end $$;

create index if not exists ose_raw_document_registry_user_parser_status_idx
  on public.ose_raw_document_registry(user_id, parser_status);

create index if not exists ose_raw_document_registry_source_format_metadata_idx
  on public.ose_raw_document_registry using gin(source_format_metadata);

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
  last_hash_checked_at,
  extracted_metadata,
  metadata_extraction_status,
  metadata_extraction_model,
  metadata_extracted_at,
  metadata_extraction_error,
  metadata_document_type,
  metadata_business_domain,
  metadata_time_period,
  parser_status,
  parser_name,
  parser_version,
  parser_format,
  parser_warnings,
  extraction_quality,
  source_format_metadata
from public.ose_raw_document_registry
where status <> 'deleted';
