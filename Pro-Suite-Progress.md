# Pro Suite ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Intelligence Layer Progress

> **Ground truth for all agents.** Read this first. Update this when done. Never assume ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â verify.

**Initiative started:** 2026-06-26
**Strategy thread ID:** 26b4a9c5-c287-4583-adcd-3158f909be53
**Owner:** Hicks / ArchitectOS Pro Beta

---

## Purpose

We are systematically adapting the agentic RAG patterns from two reference repositories into the ArchitectOS Pro Suite. The goal is to enrich the platform's intelligence, ingestion, and retrieval layers without rewriting the existing frontend or disrupting the current N8N/Vercel synthesis pipeline.

Reference repos:
- **Series (PRDs/specs):** https://github.com/theaiautomators/claude-code-agentic-rag-series
- **Masterclass (implementation):** https://github.com/theaiautomators/claude-code-agentic-rag-masterclass

Full ways-of-working context: see `CLAUDE.md` ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ "Intelligence Layer ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Ways of Working"

---

## Episode Status

| Episode | Title | Status | Plan File | Notes |
|---|---|---|---|---|
| Ep1 | Agentic RAG Foundation | Ã¢Å“â€¦ Done | `plan-ep1-ingestion.md` | Local ingestion scaffold, RAG migration artifact, OS Engine upload/wiki wiring added. |
| Ep2 | Knowledge Base Explorer | ÃƒÂ¢Ã‚Â¬Ã…â€œ Not Started | ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â | Pending Ep1 decisions |
| Ep3 | PII Redaction & Anonymization | ÃƒÂ¢Ã‚Â¬Ã…â€œ Not Started | ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â | Pending Ep1 decisions |
| Ep4 | Agent Skills & Code Sandbox | ÃƒÂ¢Ã‚Â¬Ã…â€œ Not Started | ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â | ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â |
| Ep5 | Advanced Tool Calling | ÃƒÂ¢Ã‚Â¬Ã…â€œ Not Started | ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â | ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â |
| Ep6 | Agent Harness & Workflows | ÃƒÂ¢Ã‚Â¬Ã…â€œ Not Started | ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â | ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â |
| Ep7 | Citations & Source Grounding | ÃƒÂ¢Ã‚Â¬Ã…â€œ Not Started | ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â | ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â |

**Status key:** ÃƒÂ¢Ã‚Â¬Ã…â€œ Not Started Ãƒâ€šÃ‚Â· ÃƒÂ°Ã…Â¸Ã…Â¸Ã‚Â¡ In Analysis Ãƒâ€šÃ‚Â· ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Âµ Plan Written Ãƒâ€šÃ‚Â· ÃƒÂ°Ã…Â¸Ã…Â¸Ã‚Â  In Execution Ãƒâ€šÃ‚Â· ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Done Ãƒâ€šÃ‚Â· ÃƒÂ¢Ã¢â‚¬ÂºÃ¢â‚¬Â Skipped

---

## Architectural Decisions Log

> This table is the living record of all major decisions made during this initiative. Execution agents must not contradict or override these without explicit instruction.

| Decision | Choice | Decided | Rationale |
|---|---|---|---|
| LLM provider (synthesis) | **Claude Sonnet (locked)** | 2026-06-26 | Platform constraint ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â never substitute OpenAI-compatible APIs for chat synthesis |
| Embedding model | **OpenAI `text-embedding-3-small`** | 2026-06-26 | Industry standard for vector embeddings; API key already configured |
| Frontend framework | **React 19 / Vite 6 / TypeScript (locked)** | 2026-06-26 | No rewrite ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â additive only |
| AI synthesis routing | **N8N (batch/scheduled) + Vercel serverless (streaming chat)** | 2026-06-26 | Existing architecture preserved |
| Vector database | **Supabase pgvector (confirmed)** | 2026-06-26 | Matches reference implementation ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â no change needed |
| Backend for ingestion | **Python / FastAPI (Persistent)** | 2026-06-26 | Need robust doc processing (Docling) for tables/P&Ls, which exceeds Vercel limits |
| Doc processing | **Docling** | 2026-06-26 | Best-in-class for tabular data (CSVs, P&L PDFs), justifies the persistent Python backend |
| Hybrid search / reranking | **TBD** | ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â | Evaluate Ep1: adopt their approach or build equivalent |
| LangSmith observability | **TBD** | ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â | Evaluate Ep1: adopt vs. N8N execution logs as proxy |
| User-facing ingestion UI | **TBD** | ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â | Evaluate Ep1: drag-and-drop upload + processing status |
| Sub-agent dispatch | **TBD** | ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â | Evaluate Ep6: domain-specific harness pattern |

---

## Feature Delivery Tracker

> One row per feature/plan. Populated as episodes are analyzed and plans are written.

| Feature | Episode Source | Plan File | Status | Execution Thread | Completed |
|---|---|---|---|---|---|
| Ingestion Backend + UI | Ep1 | `plan-ep1-ingestion.md` | Ã¢Å“â€¦ Done | Codex desktop 2026-06-26 | 2026-06-26 |
| Vector Pipeline Logic | Ep1 M2 | `plan-ep1-m2-vector-pipeline.md` | Partial - wired; live smoke blocked by OpenAI quota | Codex desktop 2026-06-26 | — |
| Record Manager | Ep1 M3 | `plan-ep1-m3-record-manager.md` | Partial - code + live schema applied; live smoke blocked | Codex desktop 2026-06-27 M3 | — |
| Metadata Extraction | Ep1 M4 | `plan-ep1-m4-metadata-extraction.md` | Partial - code + live schema applied; OpenAI smoke blocked by quota | Codex desktop 2026-06-27 M4 | — |

---

## Open Questions

> Unresolved questions that block or influence planning. Clear these before writing a plan file.

| # | Question | Episode | Blocking | Raised |
|---|---|---|---|---|
| 1 | *Resolved: Using Python/FastAPI for ingestion/Docling, keeping Vercel for streaming chat.* | Ep1 | Ingestion plan | 2026-06-26 |
| 2 | *Resolved: PDFs, DOCX, CSVs, especially tabular financial data.* | Ep1 | Ingestion plan | 2026-06-26 |
| 3 | Do we build a standalone Ingestion UI page, or embed upload into the Virtual CSO panel? | Ep1 | Ingestion UI plan | 2026-06-26 |
| 4 | Is there a PII concern for founder documents in our beta context? | Ep3 | Redaction plan | 2026-06-26 |

---

## Plan File Registry

> All plan files live in `docs/plans/`. Naming convention: `plan-[feature-slug].md`

| Plan File | Episode | Status | Created | Last Updated |
|---|---|---|---|---|
| `plan-ep1-ingestion.md` | Ep1 | In Execution | 2026-06-26 | 2026-06-26 |
| `plan-ep1-m2-vector-pipeline.md` | Ep1 M2 | Partial - quota-blocked smoke | 2026-06-26 | 2026-06-26 |
| `plan-ep1-m3-record-manager.md` | Ep1 M3 | Plan Written | 2026-06-27 | 2026-06-27 |
| `plan-ep1-m4-metadata-extraction.md` | Ep1 M4 | Partial - quota-blocked smoke | 2026-06-27 | 2026-06-27 |

---

## Execution Agent Log

> One entry per agent spun up to execute a plan. Agents append their own row when complete.

| Thread ID | Plan File | Agent Task | Status | Started | Completed | Notes |
|---|---|---|---|---|---|---|
| Codex desktop 2026-06-26 | `plan-ep1-ingestion.md` | FastAPI ingestion scaffold, RAG schema artifact, OS Engine Uploads/Wiki wiring, Virtual CSO attachment foundation | Partial - local build passed | 2026-06-26 | Ã¢â‚¬â€ | Pending live Supabase migration apply, Python dependency install, and backend health/ingest smoke test |
| Codex desktop 2026-06-26 M2 | `plan-ep1-m2-vector-pipeline.md` | Corrected raw-documents/kb-files architecture, applied live document_chunks/retrieval/storage repair | Partial - live smoke blocked by OpenAI quota | 2026-06-26 | — | Backend health, upload, registry insert, processing transition, and failure recording worked; chunk insertion/retrieval blocked by OpenAI insufficient_quota. |
| Pending Module 3 agent | `plan-ep1-m3-record-manager.md` | Record Manager: content hashing, duplicate registry rows, skip duplicate ingestion, changed-content handoff | Planned | — | — | Execution prompt drafted by orchestration agent. |
| Codex desktop 2026-06-27 M3 | `plan-ep1-m3-record-manager.md` | Added SHA-256 upload hashing, user-scoped duplicate registry rows, duplicate ingestion skip, duplicate status UI, and `004_record_manager.sql` | Partial - build/syntax passed; live schema applied; isolated live smoke blocked | 2026-06-27 | — | Migration artifact created and applied to Supabase, including duplicate status support and same-user duplicate/supersedes links. `npm.cmd run build` and `python -m compileall python-backend` passed. Isolated smoke could not create a temp auth user because the local service key was rejected by Auth Admin, and Supabase connector usage limit blocked final post-repair introspection. OpenAI embedding-dependent chunk/retrieval verification remains quota-gated. |
| Codex desktop 2026-06-27 M4 | `plan-ep1-m4-metadata-extraction.md` | Metadata Extraction: model/settings/schema tables, one OpenAI structured extraction call per non-duplicate upload, metadata propagation to chunks, retrieval filters, Uploads detail panel | Partial - code + live schema applied; OpenAI smoke blocked | 2026-06-27 | — | Created `005_metadata_extraction.sql`; added metadata extractor service, settings fallbacks, document metadata status/storage, chunk metadata inheritance, optional retrieval filters, and Uploads row details. Live migration applied and verified: config tables/columns/seed rows exist; RLS enabled; authenticated/anon have no table grants on config tables; retrieval RPC works with and without filters. Local `npm.cmd run build` and `python -m compileall python-backend` passed. OpenAI metadata and embedding quota probes both returned 429 quota errors, so full upload-to-metadata-to-chunk retrieval smoke remains blocked. |

---

## Change Log

| Date | Change | Author |
|---|---|---|
| 2026-06-26 | File created. Ep1 analysis started in strategy thread. | Hicks / Antigravity |
| 2026-06-26 | Ep1 execution started. Added `task.md`, Python/FastAPI ingestion scaffold, `001_rag_and_chat_schema.sql`, OS Engine upload ingestion queueing, realtime document refresh, Wiki source-file organization, and future `vcso_message_attachments` foundation. | Codex |


| 2026-06-26 | Module 2 vector pipeline execution: added OpenAI text-embedding-3-small embedding batches, Docling/token chunking, hybrid retrieval service, and Complete status label. Later repaired bucket architecture to raw-documents for raw intake and kb-files for synthesized Wiki artifacts. | Codex |


| 2026-06-26 | Live Module 2 sense check found raw-documents and ose_raw_document_registry exist, but kb_files, document_chunks, and match_document_chunks are not present in Supabase. Module is not complete until migrations are applied and smoked. | Codex |


| 2026-06-26 | Module 2 repair pass applied live Supabase schema: raw-documents preserved, kb-files created, document_chunks created with vector(1536), match_document_chunks created, and RLS policies verified. Remaining gate is live ingest/retrieval smoke. | Codex |


| 2026-06-27 | Module 2 smoke showed the pipeline is functionally wired through backend health, raw upload, registry insert, processing transition, and failure recording, but chunk insertion/retrieval remains blocked by OpenAI insufficient_quota. Module 3 Record Manager plan created with exact duplicates accepted as registry rows and skipped for ingestion. | Codex |
| 2026-06-27 | Module 3 Record Manager implementation pass: created `docs/migrations/004_record_manager.sql`; added browser SHA-256 hashing before raw upload; duplicate lookup is scoped by `user_id`; exact duplicates create duplicate registry rows and skip storage upload plus ingestion queueing; same filename with changed content remains active/eligible; backend `/api/ingest` skips duplicate rows before extraction/embedding/chunk writes; Uploads UI shows duplicate as "Already added." Live Supabase schema apply succeeded, including record-management columns/indexes/constraints and same-user duplicate/supersedes foreign keys. Local build and Python compile passed. Full isolated live duplicate smoke is still pending because the local service key was rejected for Auth Admin temp-user creation and the Supabase connector hit a usage limit before final introspection. Embedding-dependent ingest/retrieval remains blocked by OpenAI insufficient_quota. | Codex |

| 2026-06-27 | Module 4 Metadata Extraction plan created. Locked direction: Python ingestion enrichment, OpenAI structured extraction model via platform settings, no N8N, no backfill, document-level metadata stored on `ose_raw_document_registry`, propagated to `document_chunks.metadata`, retrieval filters prepared, and Uploads detail panel planned. | Codex |
| 2026-06-27 | Module 4 Metadata Extraction implementation pass: created `docs/migrations/005_metadata_extraction.sql`; added `ai_models`, `platform_ai_settings`, and `metadata_schema_fields`; added document-level metadata fields to `ose_raw_document_registry`; added OpenAI metadata extraction service with Supabase settings/env fallback; records metadata extraction status/error; propagates extracted metadata into `document_chunks.metadata`; extended retrieval with optional filters; added high-signal Uploads row expansion. Live schema applied and verified, including config-table RLS and no broad authenticated/anon grants. Retrieval RPC smoke passed with and without metadata filters. `npm.cmd run build` and `python -m compileall python-backend` passed. Full upload/metadata/chunk/retrieval smoke remains blocked because OpenAI `gpt-4o-mini` and `text-embedding-3-small` both returned 429 quota errors. | Codex |

