---
title: Codebase Integrations Map
created: 2026-06-28
last_mapped_commit: 78f500da675e552dc42501e59e2578d0dce29984
focus: tech
---

# INTEGRATIONS

## Summary

ArchitectOS Pro integrates with Supabase for auth, product data, storage, vector search, and backend service state; Vercel serverless functions for the Virtual CSO real-time exception; N8N for batch/writeback workflows; OpenAI for ingestion embeddings/metadata; Anthropic/Claude for streaming Virtual CSO responses; and optional Cohere/Web Search scaffolds for retrieval upgrades.

## Supabase

- Frontend client is created in `lib/supabaseClient.ts` from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Auth state is owned by `context/AuthContext.tsx`, which calls `supabase.auth.getSession()` and subscribes with `supabase.auth.onAuthStateChange`.
- Protected routes are enforced by `components/ProtectedRoute.tsx`; unauthenticated users are redirected to `/sign-in`.
- Application access and cohort data are loaded in `context/AppContext.tsx` from `profiles`, `tier_features`, `feature_registry`, and `beta_user_access`.
- Feature-gate metadata is centralized in `lib/featureGates.ts`, though runtime unlocks are loaded from Supabase when gates are not bypassed.

## Supabase Storage

- Locked storage architecture is documented in `docs/intelligence-layer-storage-architecture.md`.
- Raw founder uploads belong in the `raw-documents` bucket.
- Synthesized Wiki artifacts belong in the `kb-files` bucket.
- Raw upload registry rows live in `ose_raw_document_registry`.
- Search chunks live in `document_chunks` and link back to source documents.
- The required storage path convention is user-first: `{user_id}/{document_id}-{safe_file_name}` or `{user_id}/{file_name_or_artifact_name}`.

## Supabase Migrations

- Intelligence-layer schema migrations live in `docs/migrations/001_rag_and_chat_schema.sql` through `docs/migrations/009_sub_agent_orchestration.sql`.
- Beta access migration exists at `docs/migrations/20260513_add_beta_user_access.sql`.
- A pending Virtual CSO decommission migration exists at `docs/migrations/pending/ws5_decommission_virtual_cso_legacy_founder_confirm_required.sql`.
- Migration responsibilities include RAG/chat schema, storage/RLS, raw document repair, duplicate records, metadata extraction, Docling parser state, hybrid search/RRF, structured datasets, and sub-agent orchestration.

## Virtual CSO Streaming

- Frontend streaming client is in `lib/virtualCsoApi.ts`.
- Messages are posted to `/api/vcso/chat` with a bearer token from `supabase.auth.getSession()`.
- Serverless streaming handler is `api/vcso/chat.ts`.
- Handler validates the JWT, loads founder context from Supabase, assembles IP layer and founder wiki context, streams tokens from Anthropic, persists messages, logs usage, and emits SSE events (`ready`, `token`, `done`, `error`).
- Environment variables used by this path include `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `WS5_MAX_TOKENS`, `WS5_ALLOW_DRAFT_IP`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` or `service_role`.

## N8N Workflow Integration

- `api/vcso/writeback.ts` triggers a writeback workflow via `WF_PS_03_WEBHOOK_URL`.
- Optional webhook authentication uses `ARCHITECTOS_WEBHOOK_SECRET` as `x-architectos-secret`.
- Product instructions state that batch/scheduled synthesis routes through N8N, while the Virtual CSO interactive stream is the documented Vercel exception.
- MRA and AE Ladder PDF generation are documented as N8N + Google Docs merge-field patterns, with migration/context files under `context/mr-audit/`.

## Python Ingestion API

- FastAPI app entrypoint: `python-backend/main.py`.
- Health endpoint: `GET /api/health`.
- Document ingestion: `POST /api/ingest`, protected by `x-ingest-secret` when configured.
- Retrieval: `POST /api/retrieve`, using hybrid search and optional reranking.
- Structured data: `POST /api/datasets/register` and `POST /api/tools/structured-query`.
- Web fallback scaffold: `POST /api/tools/web-search`, disabled unless configured.
- Sub-agent scaffold: `GET /api/agent-capabilities`, `POST /api/agent-runs`, and `GET /api/agent-runs/{run_id}`.

## Ingestion and Retrieval Providers

- Docling handles document conversion in `python-backend/services/doc_processor.py`.
- CSV/TSV uses a structured local parser in `python-backend/services/doc_processor.py`.
- Embeddings and query embeddings are generated in `python-backend/services/vector_store.py`.
- Metadata extraction uses OpenAI chat completions in `python-backend/services/metadata_extractor.py`.
- Hybrid retrieval calls Supabase RPC `match_document_chunks` from `python-backend/services/retrieval.py`.
- Optional Cohere rerank is config-gated through `ARCHITECTOS_RERANK_ENABLED` and `COHERE_API_KEY`.

## Environment Boundary

- Frontend public env vars use `VITE_*` names.
- Server-only secrets include Supabase service role, Anthropic key, ingestion secret, webhook secret, OpenAI key, Cohere key, and web-search provider keys.
- `vite.config.ts` still defines `process.env.GEMINI_API_KEY` from `GEMINI_API_KEY`, which appears inherited from an earlier AI Studio setup and should be reviewed before beta hardening.
- `.env.local` exists in the repo root but was not read into the map beyond identifying required variable names; generated docs should not contain secret values.

## Integration Risks

- OpenAI quota/key readiness remains a known blocker for end-to-end ingestion, embeddings, metadata, and retrieval smoke according to `Pro-Suite-Progress.md`.
- Hosted Python runtime for Docling remains a return-pass item; local Windows Docling setup has known dependency friction.
- Feature gates default to bypassed unless `VITE_BYPASS_FEATURE_GATES === 'false'` in `context/AppContext.tsx`, which is convenient for development but risky for beta launch if environment setup is wrong.
