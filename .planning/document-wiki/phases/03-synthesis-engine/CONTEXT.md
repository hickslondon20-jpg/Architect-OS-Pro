# Sub-phase 03 Context — Synthesis Engine + Document Adapter

**Date:** 2026-06-30
**Outcome:** Ready to execute. Reference extraction is done (`03-RESEARCH.md`), contract is frozen
(`02-01-CONTRACT.md`), schema is live. The execution agent makes implementation choices only — not
design choices. If anything would require a design decision beyond what the inputs specify, stop
and flag it.

---

## What this sub-phase is

Builds the **missing synthesis engine** — the only thing standing between the existing scaffold
(live tables, live UI shells, live CSO hook) and a populated Layer 2 wiki. This is the core build.

Two sequential deliverables, run in one agent session:
- **03-01 (framework):** `DocWikiSynthesisService.synthesize()` — the source-agnostic loop. Takes a
  normalized `SourcePayload` and produces/updates pages, links, logs, and manifest entries.
- **03-02 (document adapter):** `DocWikiDocumentAdapter.synthesize_from_document()` — reads a
  processed document from `ose_raw_document_registry`, normalizes it into a `SourcePayload`, calls
  the framework. Hooks into `_process_ingestion()` after `mark_ingested()`.

No other adapters (04), no embeddings (05), no corrections lifecycle or health UI (06).

---

## Inputs the agent must read first (in order)

1. `03-RESEARCH.md` (this folder) — **primary build source.** Synthesis loop spec (§1), service
   conventions (§2), page-worthiness thresholds (§3), Claude call / executive_summary primitive
   (§4), document adapter trigger + evidence strategy (§5), config loading from `src/config/` (§6),
   FastAPI endpoints (§7), contradiction detection (§8), corrections overlay hook (§9), hard rules
   (§10).
2. `03-01-PLAN.md` (this folder) — 03-01 task spec + success criteria.
3. `03-02-PLAN.md` (this folder) — 03-02 task spec + success criteria.
4. `../02-page-contract-schema/02-01-CONTRACT.md` — the frozen page object + hard guarantees. Build
   to this contract exactly. §J hard guarantees are conformance clauses.
5. `../../CONTEXT.md` — locked decisions (especially §3 corrections/automated/flag-don't-resolve,
   §7 memory substrate). CONTEXT wins over any other doc when they conflict.
6. `../01-verify-delta/01-01-DELTA.md` §E (ingest gap — what the existing pipeline does today),
   §G (KB Explorer substrate — `full_markdown`, `match_document_chunks`, registry fields).
7. `python-backend/main.py` — find `_process_ingestion()` (the ingest background task). The
   document adapter hooks in here, after `store.mark_ingested()`.
8. `python-backend/services/wiki_compilation.py` — **style reference only**: how the Layer 1
   service uses service-role, `from_env()`, and error handling. Do NOT import it; never write to
   `wiki_*` tables.
9. `python-backend/services/kb_explorer_service.py` and `vector_store.py` — the KB Explorer tools
   and VectorStore pattern the adapter uses for evidence reading.
10. `python-backend/services/agent_capabilities.py` and `sub_agent_orchestrator.py` — do not break
    the existing registration + stub; the sub-phase 03 build wires real logic only into the
    document adapter path, not into the orchestrator stubs (those are 05+).
11. `src/config/doc_wiki_schema.json` — the vocabulary config the synthesis service validates against.

Read all 11 before writing a single line.

---

## Decisions already made (do not re-open)

- **Synthesis engine is FastAPI Python.** Not n8n, not Edge Functions. Same host as Layer 1.
- **Service-role writes.** Never user JWT for `ose_knowledge_pages` writes.
- **Claude Sonnet (latest) is the synthesis LLM.** Never `openai` package (dead code).
- **Structured JSON output** from Claude per §4 schema. If Claude returns an unexpected format,
  fail gracefully — log and skip the page, don't crash.
- **Document adapter hooks into `_process_ingestion()`** after `mark_ingested()`. Wrapped in
  try/except — never crashes the ingest pipeline.
- **Embedding column left null** by the synthesis engine. Sub-phase 05 fills it. Wire the stub hook
  so 05 slots in without touching the synthesis core.
- **Corrections overlay hook is here (minimal):** read pending corrections before UPDATE synthesis;
  apply as overlay; mark applied. Full corrections lifecycle is 06.
- **`page_kind` validation:** if Claude returns a value not in the config vocabulary, default to
  `entity`, warn in log, continue.
- **No `wiki_*` table writes.** Layer 1 and Layer 2 operate on separate table sets. Never cross.
- **Activity log events** use existing `kind in ('activity','decision')` — no migration needed.
- **Config path for Python:** `../src/config/doc_wiki_schema.json` relative to `python-backend/`
  root, via `python-backend/core/doc_wiki_config.py` helper.

---

## What this sub-phase does NOT do

- No other adapters (sprint-history, CSO-thread, agent-artifact) — that is sub-phase 04.
- No embedding population or semantic search — sub-phase 05.
- No corrections lifecycle UI, health checks, or lint — sub-phase 06.
- No UI changes.
- No CSO hook enhancement — connection phase.
- No changes to Layer 1 wiki services (`wiki_compilation.py`, `wiki_writeback.py`, etc.).
- No orchestrator stub-replacement — the `per_user_document_wiki` stubs stay `not_implemented`
  until 05 (real search tool) lands.

---

## Files to create or modify

| File | Action | Notes |
|---|---|---|
| `python-backend/core/doc_wiki_config.py` | **Create** | Config loader for `src/config/doc_wiki_schema.json`. `get_doc_wiki_config()` function. |
| `python-backend/services/doc_wiki_synthesis.py` | **Create** | `SourcePayload`, `SynthesisTarget`, `SynthesisResult`, `DocWikiSynthesisService` (the framework + correction hook). |
| `python-backend/services/doc_wiki_synthesis.py` | **Extend** | (Same file) `DocWikiDocumentAdapter` class — the document source adapter. |
| `python-backend/main.py` | **Modify** | Import `DocWikiDocumentAdapter`; call it after `store.mark_ingested()` in `_process_ingestion()`; add two doc-wiki endpoints. |
| (optional) `python-backend/routers/doc_wiki.py` | **Create if preferred** | Move the two endpoints here to keep `main.py` clean. Match existing router pattern. |

---

## Success criteria (combined 03-01 + 03-02)

From `03-01-PLAN.md`:
1. `synthesize()` creates **or** updates a prose page with inline citations and provenance — dedup
   via `canonical_key` works (no duplicate pages).
2. Page-worthiness gate skips non-worthy topics (passes an entity with <5% presence).
3. Contradictions are flagged via `ose_activity_log` — not resolved, not written into the page.
4. Pending corrections are applied as overlays before re-synthesis; corrections `status → 'applied'`.
5. Manifest is coherent: `source_file_ids[]` and `connected_pages[]` match after synthesis.
6. `ose_page_links` rows are written (≥2 suggested links per page target).
7. `ose_activity_log` event written on completion (kind='activity').
8. Async job id (`synthesis_job_id`) set on the page row.

From `03-02-PLAN.md`:
9. Uploading/ingesting a new document (with `full_markdown` available) fires the adapter.
10. 1+ pages are created with correct `page_kind`, inline citations, and `source_file_ids`.
11. Re-ingesting the same document updates (not duplicates) pages via `canonical_key`.
12. Adapter failure does not crash `_process_ingestion()` — ingest completes, adapter error is logged.
13. The two FastAPI endpoints (`/api/doc-wiki/synthesize-document`, `/api/doc-wiki/job/{id}`) register
    and respond correctly.
14. `python -m compileall python-backend` passes.
15. A live smoke: run the `/api/doc-wiki/synthesize-document` endpoint against one of the two existing
    `ose_raw_document_registry` rows; confirm a page appears in `ose_knowledge_pages`.

---

## Handoff

When 15 criteria pass — especially criterion 15 (live page created) — the synthesis engine is
working end-to-end for document sources. Report back with a summary of what was built, the
`canonical_key` and `page_kind` of any pages created in the live smoke, and any flags.
The strategy thread reads the result, reconciles, then opens **sub-phase 04 (source adapters)**.

*Context written: 2026-06-30 — Layer 2 orchestration thread, post-02 reconciliation.*
