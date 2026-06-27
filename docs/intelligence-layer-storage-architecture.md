# Intelligence Layer Storage Architecture

## Locked Bucket Roles

ArchitectOS Pro uses separate storage layers for raw intake and synthesized knowledge artifacts.

### Raw Intake

- Bucket: `raw-documents`
- Registry table: `public.ose_raw_document_registry`
- Path convention: `{user_id}/{document_id}-{safe_file_name}`
- Purpose: founder-uploaded source files such as PDFs, DOCX, CSVs, spreadsheets, notes, and images.

Raw uploads are the source of truth for ingestion. The OS Engine Uploads UI writes the physical file to `raw-documents` and records the upload in `ose_raw_document_registry`.

### Vector Retrieval

- Chunk table: `public.document_chunks`
- Source link: `document_chunks.document_id -> ose_raw_document_registry.id`
- Embedding model: OpenAI `text-embedding-3-small`
- Embedding dimension: `vector(1536)`
- Retrieval RPC: `public.match_document_chunks`

The ingestion backend downloads raw files from `raw-documents`, extracts structured text, chunks it, embeds it, and stores searchable chunks in `document_chunks`.

### Synthesized Wiki Artifacts

- Bucket: `kb-files`
- Wiki table: `public.ose_knowledge_pages`
- Purpose: generated or synthesized knowledge-base artifacts created from raw ingestion, conversations, and platform context.

`kb-files` is not the raw upload bucket. It is reserved for generated Wiki artifacts and future knowledge-base files. Raw source files remain in `raw-documents`.

## User Isolation

Both storage buckets use the same user-first path convention:

```text
{user_id}/{file_name_or_artifact_name}
```

Storage policies should require `(storage.foldername(name))[1] = auth.uid()::text`.

Public tables that store user data should use RLS policies scoped by `user_id = auth.uid()`.

## End-To-End Flow

1. Founder uploads a file in OS Engine -> Uploads.
2. Frontend stores the file in `raw-documents`.
3. Frontend inserts a row in `ose_raw_document_registry`.
4. Backend marks that row `processing`.
5. Backend extracts text/tables from the raw file.
6. Backend chunks and embeds the extracted content.
7. Backend stores chunks in `document_chunks`.
8. Backend marks the source document `ingested`.
9. Future synthesis can generate Wiki artifacts and store them in `kb-files`.
