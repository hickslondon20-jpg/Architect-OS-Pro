# Plan B0-01 — Ingestion layout + verbatim capture (forward-only)

**Sub-phase:** B0 — Ingestion geometry (Ep7B)
**Plan:** 1 of 1
**Depends on:** A0 (`Locator` already carries `page_number`/`bbox`)
**Status:** Ready for execution — **chunker decision locked** (CONTEXT §8 Ep7B, London-confirmed 2026-07-06).
**Decisions:** `../../CONTEXT.md` §3.1 DP6, L10/L23, §8 Ep7B (chunker switch) · **Ref:** `../../REFERENCES.md` C-1/C-2/C-3/C-4

---

## Goal

Capture per-chunk **geometry + verbatim source face** at ingestion so document citations can later resolve to an
exact rectangle (B1/B2). **Forward-only — no backfill (L10); sequence before OS Engine bulk-upload GA (DP6).**

## Decided (do not re-open)
- **PDF + image:** switch to Docling's **layout-aware chunker** — each chunk carries `page_number`, `bbox`
  (union of its item boxes on the page), and a `verbatim` face. Retrieval `content` comes from the same layout
  chunks.
- **Non-PDF** (docx/pptx/xlsx/csv/txt/md/html): keep the current `_split_text` path — `verbatim` = chunk source
  text; `page_number`/`bbox` null.
- **Forward-only**, no backfill; OCR preflight for non-machine-readable PDFs.
- **Retrieval re-validation is an acceptance gate** (boundaries change for new PDFs).

## Pre-Execution Checks
1. Read `RESEARCH.md` (this folder) — the current pipeline, the **pinned Docling 2.44.0 API (§3)**, the write path.
2. **Docling is a run-env prerequisite, not a design blocker.** `requirements.txt` pins `docling==2.44.0` and
   RESEARCH §3 documents its exact chunking/prov API — **code against that.** To *run* the ingestion tests the
   env must have docling installed (the agent's local venvs lack it; the backend env per `requirements.txt`
   should have it). If it can't be installed in the run env, **implement anyway** and defer the live ingestion
   test to a docling-enabled env (deferred-test pattern) — do **not** stop-block on the missing install.
3. Confirm the live `document_chunks` columns (no `page_number`/`bbox`/`verbatim` today).

## Build
- **Layout extraction (C-1/C-2).** In `services/doc_processor.py`, for PDF/image inputs keep Docling's
  **structured `DoclingDocument`** (do not flatten to markdown first) and chunk it with the layout-aware chunker;
  per chunk emit `page_number`, `bbox` (page-space, with the page dimensions/coord-origin needed to transform at
  render time), and the `verbatim` face. Non-PDF unchanged.
- **OCR preflight (C-3).** Detect non-machine-readable PDFs; enable Docling OCR (pipeline options) with a
  layered text-layer/OCR fallback so geometry is trustworthy. Default preflight = auto.
- **Dual-face (C-4).** `verbatim` = `chunk.text` (raw face the model quotes); retrieval `content` (embedded) =
  `chunker.serialize(chunk)` (context-enriched face, Docling-recommended). `page_number`/`bbox` from
  `chunk.meta.doc_items[].prov[]` (RESEARCH §3).
- **Write path.** Extend `DocumentChunk` + `vector_store.replace_document_chunks` to persist the new fields.
- **Migration (additive, forward-only).** `document_chunks` + `page_number int`, `bbox jsonb`, `verbatim text`.
  **Staged for a later B-series live-DB session — do not apply to shared Supabase** (mirror A6 posture).

## Surface manifestation
**OS Engine** ingestion — no user-facing UI change yet (feeds B1/B2). The A2 chunk resolver stays line-level
until B1 consumes these columns.

## Success criteria
1. A newly ingested **PDF** yields chunks with valid `page_number` + `bbox` + `verbatim`.
2. Geometry-less / OCR-only pages degrade gracefully (null geometry; still citable line-level via A2).
3. **Non-PDF** ingests keep working (verbatim set; geometry null); **retrieval re-validated** — hybrid search
   returns sensible chunks after the PDF chunker switch (acceptance gate).
4. Migration is additive; existing chunk reads unaffected; **nothing applied to live Supabase.**
5. `compileall` 0; ingestion + retrieval tests green; no backfill attempted.

## Out of scope
The geometry-aware resolver branch (B1); PDF highlight rendering (B2); applying the migration live (B-series
session). Line-level chunk resolve stays A2.
