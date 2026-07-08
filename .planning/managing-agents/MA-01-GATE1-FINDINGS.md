# MA-01 — Episode 1 Gate 1 Findings & Enablement Matrix

**Managing agent:** MA-01 (Ep1 verification & wiring)
**Gate:** Gate 1 — "does the brain turn on"
**Date:** 2026-07-08
**Scope:** `.planning/managing-agents/MA-01-EP1-HANDOFF.md`, `MA-01-testing-verification-debt-SCOPE.md`

---

## Headline

The brain turns on. Before this pass, every Ep1 module (M2–M8) had only ever been exercised through code review, `compileall`, local builds, and synthetic/rollback-only SQL smoke — never a live document, moving through the live backend, hitting the live LLM providers, with LangSmith watching. That changed today. One real document went through the full pipeline — upload → registry → parse → OpenAI metadata extraction → chunk → embed → `document_chunks` → automatic Claude doc-wiki synthesis → `ose_knowledge_pages` → hybrid/RRF retrieval — with real DB rows and traced LLM calls, no mocks. Four more modules (M3, M5, M7, M8) got dedicated live smoke on top of that.

Ep1 is **backend-live-verified**. It is **not yet usable** — no front-end is wired to any of this (that's §8, explicitly out of MA-01 scope).

---

## What was fixed in place (Task 0 — preflight)

1. **Env naming trap.** Root `.env.local` had wrong-named Supabase vars (`VITE_SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `service_role`) and no `ANTHROPIC_API_KEY`. Corrected to `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` in both root `.env.local` and a new `python-backend/.env` (founder-applied).
2. **LangSmith observability wired.** Added `load_dotenv()` to the top of `main.py` (pydantic-settings parses env vars into its own `Settings` model but never exports them to `os.environ`, which is where the LangSmith SDK reads from). Wrapped every Anthropic/OpenAI client construction site with `wrap_anthropic`/`wrap_openai`:
   - `services/citations/verify.py`
   - `services/doc_wiki_synthesis.py` (two sites)
   - `services/harness_engine.py`
   - `services/kb_explorer_service.py`
   - `services/sandbox_execution_service.py`
   - `services/skill_draft_synthesis.py`
   - `services/vcso_chat_service.py`
   - `services/vector_store.py` (OpenAI)

   Added `python-dotenv` to `requirements.txt`. Confirmed live in the founder's LangSmith UI, project `ArchitectOS-pro` — clean traces for both `ChatAnthropic` and `ChatOpenAI` spans.

---

## Architecture correction

The scope doc's framing of "Tier-1 compile → `_project_to_ose` mirror" as a required step for **document-sourced** wiki pages is incorrect. That mechanism (`WikiCompilationService.compile_page`/`compile_event`, `_project_to_ose`) is a **separate, unrelated system** that only applies to the 7 fixed structured-data pages defined in `config/wiki_schema.json` (`business_context`, `diagnostic_synthesis`, `current_quarter_sprint`, `growth_constraints`, `financial_context`, `client_market_position`, `open_questions`) — sourced from platform tables (`ae_*`, `gm_*`, `sp_*`, `cc_*`), not from documents.

Document-sourced wiki pages are written **directly** to `ose_knowledge_pages` by `DocWikiSynthesisService._upsert_page()` — its own docstring states "the synthesis engine is the sole writer of `ose_knowledge_pages.content`." There is no separate compile step for these. This was confirmed by Task 1's live run: two knowledge pages were synthesized and written without ever touching `WikiCompilationService`.

---

## Ep1 Enablement Matrix

Readiness ladder: **backend-complete** (code exists, unexercised) → **live-verified** (proven with a real call/trace/DB row today) → **usable** (reachable through the real front-end) → **polished**.

| Module | Capability | Rung reached | Evidence |
|---|---|---|---|
| M2 | Vector pipeline (upload → chunk → embed → retrieve) | **live-verified** | `gate1_ingest_smoke.py`: doc `3b26fe0f-…`, chunk `29aad709-…`, `status=ingested`, `chunk_count=1`. `gate1_retrieval_smoke.py`: same chunk returned, `hybrid_score=0.0328`. |
| M3 | Backend duplicate-skip contract | **live-verified** | Pre-marked duplicate row → `_process_ingestion()` → `parser_status='skipped'`, 0 rows in `document_chunks`. Correct terminal state per the M5-defined status set (`pending/processing/complete/failed/skipped`) — **not** a defect (see correction note below). |
| M3 | Frontend duplicate detection (SHA-256 hash + lookup) | **backend-complete only** | Logic confirmed present in `lib/osEngineApi.ts` via code read (`crypto.subtle.digest`, `content_hash`+`record_state='active'` lookup, `record_state='duplicate'` insert) — matches the M3 plan, but is browser-dependent and untestable from this pass. |
| M4 | OpenAI structured metadata extraction | **live-verified** | Task 1's ingested document has populated `extracted_metadata`; `document_chunks.metadata` confirmed to inherit document-level metadata. |
| M4 | Retrieval metadata filters | **live-verified (structurally)** | `match_document_chunks` RPC exercised with and without a `metadata_filter` argument during earlier module work and again in Task 1's retrieval smoke path; no live smoke run with a *non-empty* filter value in this pass specifically — low-risk residual, not re-tested today. |
| M5 | CSV parse (non-Docling multiformat path) | **live-verified** | `m5_csv_and_failure()`: CSV ingested, `status='ingested'`, `chunk_count>0`, parser metadata populated. |
| M5 | Parser failure handling | **live-verified** | Deliberate corrupt-docx (non-OOXML bytes, `.docx` extension): `status='failed'` with `ingestion_error`/`error_message` populated — a clean recorded failure, not a silent success or a crash. |
| M5 | Format coverage vs. `file_type` constraint | **gap found** | `ose_raw_document_registry_file_type_check` only allows `pdf, docx, csv, xlsx, txt, png, jpg`. The M5 plan's supported-format priority list includes HTML/Markdown, which the DB constraint doesn't allow today. |
| M6 | Hybrid vector+keyword candidates, RRF fusion | **live-verified** | Task 1 retrieval smoke returned `retrieval_stage='rrf_fused'` on a real embedded chunk. |
| M6 | Cohere optional rerank (fail-open) | **live-verified (no-key path)** | No `COHERE_API_KEY` configured → retrieval returned normal RRF results with no error, confirming fail-open behavior. Live rerank-with-key smoke remains a return-pass item (unchanged from prior status). |
| M7 | Governed dataset registration | **live-verified** | `register_dataset()` created a dataset + table + rows live; `founder_dataset_rows` row count confirmed via direct query. |
| M7 | SQL validator — approved SELECT | **live-verified** | Valid `select … from founder_dataset_rows …` accepted, rows returned. |
| M7 | SQL validator — DDL rejection | **live-verified** | `drop table founder_dataset_rows` rejected. |
| M7 | SQL validator — unapproved table rejection | **live-verified** | `select id from profiles limit 5` (a real platform table) rejected. |
| M7 | SQL validator — multi-statement rejection | **live-verified** | Stacked `select …; drop table …;` rejected. |
| M8 | Real (non-simulated) sub-agent run | **live-verified** | `document_analysis_agent` run against the Gate 1 test document completed with `status='completed'`, a populated trace, and a result summary — supersedes the earlier synthetic/rollback-only delegation row referenced in the M8 execution log. |
| M8 | Capability registry listing | **live-verified** | `list_capabilities()` returned real registered capabilities live. |

---

## Findings not fixed (flagged for follow-up, not on the Gate 1 critical path)

1. **`file_type` check constraint gap (M5).** `html`/`md` are in the M5 plan's supported-format list but rejected by `ose_raw_document_registry_file_type_check`. Needs a migration if HTML/Markdown ingestion is actually wanted for beta.
2. **Frontend-only M3 dedup detection is unverified outside a browser.** The hash computation and lookup only exist in `lib/osEngineApi.ts`; this pass could only confirm the backend half of the contract (skip-on-duplicate).
3. **Manual doc-wiki synthesis endpoint swallows errors silently.** `/api/doc-wiki/synthesize-document` → `_run_doc_wiki_synthesis` in `main.py` has a bare `except Exception: pass` with no logging. Lower priority because it's not on the critical path — the automatic inline synthesis triggered by `/api/ingest` (which *is* on the critical path) logs failures to `ose_activity_log` via `_write_log()`.
4. **Stale model alias.** `services/citations/verify.py`'s `UTILITY_FALLBACK_MODEL` references `"claude-3-5-haiku-latest"`, which 404s against the live API today. Caught only because this pass's own `verify_langsmith_tracing.py` script copied the same alias and failed the same way.

---

## Test-script self-correction (M3)

`gate1_task2_module_smoke.py`'s own M3 assertion was wrong on first pass: it treated `parser_status in (None, "pending")` as the only valid "skipped correctly" condition and printed **FAIL** when the real system returned `parser_status='skipped'`. But `skipped` is a deliberate, valid terminal state in the M5-defined status set — the system's actual behavior (0 chunks, `status='duplicate'`, `parser_status='skipped'`) is correct. Corrected in the matrix above to **live-verified / PASS**. This was a bug in the verification script, not in the product.

---

## Stop point

Per MA-01 scope: Gate 1 is closed. Ep1 is backend-live-verified across the core pipeline (M2) plus M3/M4/M5/M6/M7/M8. Front-end wiring (making any of this *usable*) is explicitly Section 8 and out of scope for this pass. **Episode 2 has not been started.**
