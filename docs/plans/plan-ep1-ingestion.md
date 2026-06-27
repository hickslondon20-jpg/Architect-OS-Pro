# Agentic RAG Module 1: Ingestion Pipeline & UI

This plan adapts the ingestion pipeline and foundation layers from Episode 1 of the reference series to ArchitectOS Pro. It sets up the persistent backend for processing tabular data/PDFs, configures the database schema for both documents and chat threads, and establishes the frontend UI components.

## Decisions Made

> [!NOTE]
> **Ingestion UI Location & Organization**
> - **Uploads:** The main drag-and-drop document upload section will live in `OS Engine -> Uploads`.
> - **File Organization:** The file organization layer will live in the `OS Engine -> Wiki Page` sub-tab. It will sit side-by-side with the static Wiki system so users can see both their raw uploaded files and the platform's synthesized Wiki pages.
> - **Future Feature (No action required now):** In the future, users will be able to attach files directly in chat threads (which will function identically to uploading them in the Uploads tab).

> [!NOTE]
> **Hybrid Search & Reranking**
> We will implement the full Hybrid Search (Keyword + Vector) + Reranker pipeline from the start, as tabular/financial data heavily relies on exact keyword matching in addition to semantic similarity.

## Proposed Changes

### [Python Ingestion Backend]

A persistent Python/FastAPI service responsible for receiving files, processing them via Docling, and storing the embeddings in Supabase.

#### [NEW] `python-backend/requirements.txt`
Dependencies: `fastapi`, `uvicorn`, `docling`, `supabase`, `sentence-transformers` (or OpenAI embeddings), `langchain-text-splitters`, `langsmith`.

#### [NEW] `python-backend/main.py`
FastAPI application skeleton featuring:
- An `/api/health` endpoint for monitoring.
- An `/api/ingest` endpoint for document processing.
- Middleware setup for **LangSmith tracing** and observability.

#### [NEW] `python-backend/services/doc_processor.py`
Uses Docling to parse PDFs, CSVs, and DOCX files. Handles chunking the text (respecting table boundaries).

#### [NEW] `python-backend/services/vector_store.py`
Connects to Supabase `pgvector` to insert document chunks and metadata.

### [Supabase Database]

#### [NEW] `docs/migrations/001_rag_and_chat_schema.sql`
SQL migration to configure the backend tables:
1. **RAG Tables:** `documents` and `document_chunks` (with the `vector` extension).
2. **Chat Tables:** `threads` and `messages` for storing Virtual CSO conversation history.
3. **Security:** Row-Level Security (RLS) on all tables to ensure users only access their own files and chat history.

### [Frontend React SPA]

#### [NEW] `src/pages/os-engine/UploadsTab.tsx` (or similar)
Integrates a drag-and-drop React component using `react-dropzone` for file uploads. Listens to Supabase Realtime to show the processing status of uploaded documents (e.g., "Extracting text...", "Chunking...", "Complete").

#### [MODIFY] `src/pages/os-engine/WikiTab.tsx` (or similar)
Integrates the file organization UI layer to allow users to view and manage their uploaded documents alongside the existing Wiki pages.

#### [MODIFY] `src/pages/virtual-cso/VirtualCSOChat.tsx` (or similar)
Updates the Virtual CSO chat interface:
- **Thread list wiring:** Fetching and displaying historical threads.
- **Chat view & messages display:** Showing historical messages from Supabase.
- **SSE consumption:** Wiring the chat input to consume the streaming Server-Sent Events (SSE) from the Vercel serverless endpoint.

## Verification Plan

### Automated Tests
- N/A for this phase, focusing on end-to-end integration.

### Manual Verification
1. Run the Python backend locally and verify the `/api/health` endpoint.
2. Upload a sample P&L PDF or CSV via the `OS Engine -> Uploads` UI.
3. Verify the frontend UI updates via Supabase Realtime to show "Complete".
4. Check the `OS Engine -> Wiki Page` tab to ensure the file appears in the organization layer.
5. Create a new thread in the Virtual CSO, send a message, and verify that the SSE response streams properly and the thread/messages persist to the Supabase tables.
6. Verify logs appear in LangSmith.
