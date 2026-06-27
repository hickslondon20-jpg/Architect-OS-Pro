# Agentic RAG Module 2: Ingestion & Vector Pipeline

This plan focuses on the backend implementation of the ingestion pipeline and the completion of the RAG retrieval loop. It covers user-isolated file storage, data processing (Docling + OpenAI), pgvector integration, and the hybrid search retrieval tool.

## Decisions Made

> [!NOTE]
> **Embedding Model**
> We are using **OpenAI `text-embedding-3-small`** for vector embeddings. This is the industry standard for RAG and avoids bloating the Python backend with local ML models. The `OPENAI_API_KEY` is already configured in the `.env` file.

> [!NOTE]
> **Chunking Strategy**
> We will use recursive character chunking (e.g., 1000 tokens, 200 overlap) for standard text. For tables and financial data (PDFs/CSVs), we will rely on Docling's structural extraction to ensure rows and columns are preserved accurately within chunks.

## Proposed Changes

### [Supabase Storage & Security Setup]

#### [NEW/MODIFY] `docs/migrations/002_storage_and_rls.sql`
- **User-Isolated Storage Bucket:** Create a Supabase Storage bucket (e.g., `kb_files`) configured so that files are uploaded to `/{user_id}/{filename}`.
- **Storage RLS:** Implement Row-Level Security on the storage bucket so a user can only read, write, or delete files within their own `{user_id}` directory.
- **Confirm Chat & Vector RLS:** Ensure the previously created `documents`, `document_chunks`, `threads`, and `messages` tables all correctly enforce `user_id = auth.uid()` isolation.

### [Frontend React SPA]

#### [MODIFY] `src/pages/os-engine/UploadsTab.tsx`
- **Ingestion UI:** Ensure the drag-and-drop UI uploads files directly to the user's isolated Supabase Storage folder (`/{user_id}/{filename}`).
- **Document List:** Display the list of documents belonging *only* to the current user.
- **Real-Time Status:** Continue listening to Supabase Realtime for the `documents` table to update the ingestion status ("Processing...", "Complete").

### [Python Ingestion Backend]

We will implement the core business logic inside the FastAPI service to handle the file processing pipeline.

#### [MODIFY] `python-backend/requirements.txt`
- Add `openai` for accessing the embeddings API.
- Ensure `docling` and `supabase` are present.

#### [NEW] `python-backend/core/config.py`
- Setup environment variable parsing for `OPENAI_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.

#### [MODIFY] `python-backend/services/doc_processor.py`
- Implement the `Docling` parser logic to extract structured text from the raw files downloaded from Supabase Storage.
- Implement the chunking strategy described above.

#### [MODIFY] `python-backend/services/vector_store.py`
- Implement the embedding generation using `openai` (`text-embedding-3-small`).
- Implement the Supabase insertion logic:
  - Update the `document` record status to "Processing".
  - Bulk insert the `document_chunks` (content, metadata, vector).
  - Update the document status to "Complete" to trigger the Supabase Realtime event for the frontend.

#### [NEW] `python-backend/services/retrieval.py`
- **Retrieval Tool:** Implement a hybrid search query (vector similarity + keyword match) against the `document_chunks` table. This function will be exposed as a tool for the Virtual CSO / LLM to call during synthesis. Ensure the search is scoped by `user_id`.

#### [MODIFY] `python-backend/main.py`
- Wire the `/api/ingest` endpoint to receive a webhook or direct call with the Supabase Storage file path.
- Trigger the full pipeline asynchronously so the API can respond immediately while processing happens in the background.

## Verification Plan

### Automated Tests
- N/A for this phase.

### Manual Verification
1. Ensure `OPENAI_API_KEY` and Supabase credentials are in the `.env` for the Python backend.
2. Verify Supabase Storage RLS: Attempt to upload a file as User A, and verify User B cannot read or access it.
3. Start the FastAPI server locally.
4. Upload a sample financial CSV or PDF via the frontend UI. Verify the UI uploads it to the correct user-gated path.
5. Verify the backend logs show Docling successfully parsing the file and chunking the text.
6. Verify the chunks and their vector arrays appear correctly in the Supabase `document_chunks` table.
7. Confirm the frontend UI updates to "Complete" once the database records are fully inserted.
8. Test the hybrid search retrieval tool function locally to ensure it returns the correct chunks for a given query, scoped to the user.
