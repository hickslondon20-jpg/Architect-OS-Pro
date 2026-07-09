# MA-01 — Episode 1 Gate 1 Findings & Enablement Matrix

**Managing agent:** MA-01 (Ep1 verification & wiring) · **Gate:** Gate 1 — "does the brain turn on" ·
**Date:** 2026-07-08

> Recreated 2026-07-08 from the strategy-thread record after the managing-agents docs were lost in the
> commit/session-boundary incident. Faithful to the original execution-agent findings.

## Headline
The brain turns on. One real document went through the full pipeline — upload → registry → parse →
OpenAI metadata extraction → chunk → embed → `document_chunks` → automatic Claude doc-wiki synthesis →
`ose_knowledge_pages` (2 pages) → hybrid/RRF retrieval — with real DB rows and traced LLM calls, no
mocks. M3/M5/M7/M8 got dedicated live smoke on top. Ep1 is **backend-live-verified**; it is **not yet
usable** (front-end wiring is §8, out of scope).

## Fixed in place (Task 0 preflight)
1. **Env naming trap.** Root `.env.local` had wrong-named Supabase vars and no `ANTHROPIC_API_KEY`.
   Corrected to `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` in
   root `.env.local` + a new `python-backend/.env`.
2. **LangSmith wired.** Added `load_dotenv()` to `main.py` (pydantic parses env into Settings but never
   exports to `os.environ`, where the LangSmith SDK reads). Wrapped every Anthropic/OpenAI client site
   with `wrap_anthropic`/`wrap_openai`: `citations/verify.py`, `doc_wiki_synthesis.py` (x2),
   `harness_engine.py`, `kb_explorer_service.py`, `sandbox_execution_service.py`, `skill_draft_synthesis.py`,
   `vcso_chat_service.py`, and `vector_store.py` (OpenAI). Added `python-dotenv` to requirements.
   Confirmed live in LangSmith project `ArchitectOS-pro`.
   *(NOTE: this instrumentation was later LOST in the incident and must be rebuilt — see MA-01 rebuild.)*

## Architecture correction
The "Tier-1 compile → `_project_to_ose` mirror" framing applies ONLY to the 7 fixed structured-data
pages (from `ae_*`/`gm_*`/`sp_*`/`cc_*` platform tables via `WikiCompilationService`). **Document-sourced
pages are written directly to `ose_knowledge_pages` by `DocWikiSynthesisService._upsert_page()` — no
compile step.** The scope doc conflated the two. Confirmed by Task 1's live run (2 pages written without
touching `WikiCompilationService`).

## Enablement Matrix (readiness ladder: backend-complete → live-verified → usable → polished)
- **M2** vector pipeline — **live-verified** (real doc/chunk, `hybrid_score` returned).
- **M3** backend duplicate-skip — **live-verified** (`parser_status='skipped'`, 0 chunks — correct).
  Frontend dedup (`lib/osEngineApi.ts` SHA-256) — **backend-complete only** (browser-untested).
- **M4** OpenAI metadata extraction — **live-verified**; inherits into chunk metadata.
- **M5** CSV parse — **live-verified**; deliberate corrupt-file failure recorded cleanly. **Gap:**
  `ose_raw_document_registry_file_type_check` allows only pdf/docx/csv/xlsx/txt/png/jpg — html/md rejected.
- **M6** hybrid + RRF — **live-verified**; Cohere fails open with no key.
- **M7** structured-data tools — **live-verified**; SQL validator rejects DDL / unapproved tables /
  multi-statement.
- **M8** sub-agent orchestration — **live-verified** with a real (non-simulated) run.

## Findings flagged (not fixed)
1. `file_type` constraint rejects `html`/`md` (M5 plan lists them). Needs a migration if wanted for beta.
2. Frontend M3 dedup unverified outside a browser (§8).
3. `/api/doc-wiki/synthesize-document` swallows errors with a bare `except: pass` (not on critical path).
4. Stale model alias: `services/citations/verify.py` `UTILITY_FALLBACK_MODEL = claude-3-5-haiku-latest`
   404s against the live API.

## Stop point
Gate 1 closed. Ep1 backend-live-verified across M2–M8. Episode 2 not started.
