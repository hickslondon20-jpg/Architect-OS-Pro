-- Ep7B B0: forward-only citation geometry for newly ingested PDF/image chunks.
-- Staged migration only. Do not apply to shared Supabase outside the gated B-series live session.

alter table public.document_chunks
  add column if not exists page_number integer,
  add column if not exists bbox jsonb,
  add column if not exists verbatim text;

comment on column public.document_chunks.page_number is
  'Ep7B forward-only layout page number for PDF/image citation geometry; null for legacy and non-layout chunks.';

comment on column public.document_chunks.bbox is
  'Ep7B forward-only page-space bbox JSON for PDF/image citation geometry, including coord origin and page dimensions when available.';

comment on column public.document_chunks.verbatim is
  'Ep7B forward-only raw source face for quote matching; PDF/image uses Docling chunk.text, non-PDF uses the chunk text.';
