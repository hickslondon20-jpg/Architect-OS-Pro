-- Phase 2: Connect documents to kb_folders, store full extracted markdown.
-- Table: ose_raw_document_registry
-- Does NOT modify document_chunks.

-- 1. Add folder_id - nullable FK to kb_folders, SET NULL on folder delete
ALTER TABLE public.ose_raw_document_registry
  ADD COLUMN IF NOT EXISTS folder_id UUID
    REFERENCES public.kb_folders(id)
    ON DELETE SET NULL;

-- 2. Add full_markdown - full extracted text for grep/read tools (Phases 5-6)
ALTER TABLE public.ose_raw_document_registry
  ADD COLUMN IF NOT EXISTS full_markdown TEXT;

-- 3. Index for folder-based document lookups
CREATE INDEX IF NOT EXISTS ose_raw_document_registry_folder_id_idx
  ON public.ose_raw_document_registry (folder_id)
  WHERE folder_id IS NOT NULL;

-- 4. Recreate the documents view to include folder_id.
--    Preserves all 27 columns from 006_docling_multiformat (the last view definition).
--    full_markdown is intentionally excluded — large; agent tools query ose_raw_document_registry directly.
CREATE OR REPLACE VIEW public.documents
WITH (security_invoker = true)
AS
SELECT
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
  source_format_metadata,
  folder_id
FROM public.ose_raw_document_registry
WHERE status <> 'deleted';

-- Restore grant (CREATE OR REPLACE view drops and recreates grants)
GRANT SELECT ON public.documents TO authenticated;

-- Rollback:
-- ALTER TABLE public.ose_raw_document_registry DROP COLUMN IF EXISTS folder_id;
-- ALTER TABLE public.ose_raw_document_registry DROP COLUMN IF EXISTS full_markdown;
-- DROP INDEX IF EXISTS public.ose_raw_document_registry_folder_id_idx;
-- (Recreate documents view without folder_id if needed)
