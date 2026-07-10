# Citations (Episode 7) — Sub-phase B0 Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at
> `C:\Users\Hicks\ArchitectOS Pro_beta`. This session runs sub-phase **B0 only** (ingestion layout + verbatim
> capture). Do **not** start B1. Do **not** apply any migration to live Supabase.

---

You are the **execution agent** for Sub-phase B0 (Ingestion Geometry) of the ArchitectOS Episode 7 (Citations)
build — the first Ep7B phase. You build against **decided design** — implementation choices only, never design
choices. **The PDF chunker approach is already decided** (London-confirmed) — do not re-open it. If something
needs a design decision beyond the inputs, **stop and flag it**.

**Docling API is pinned — do NOT stop-block on it.** A prior B0 attempt stopped because `docling` wasn't
installed locally to introspect. That is resolved: `requirements.txt` pins `docling==2.44.0` and **RESEARCH §3
documents its exact chunking/provenance/OCR API from the official docs.** Code against RESEARCH §3. Docling
being installed is a **run-env prerequisite for the tests** (the backend env per `requirements.txt` should have
it; install if you can). If you cannot install it in your env, **implement anyway** and defer the live ingestion
test to a docling-enabled env — do not stop without writing code.

You are in the `ArchitectOS Pro_beta` repo, canonical path `C:\Users\Hicks\ArchitectOS Pro_beta`.

**What B0 is, in one line:** capture per-chunk `page_number` + `bbox` + `verbatim` source face at ingestion for
**PDF/image** inputs (via Docling's layout-aware chunker), forward-only, so citations can later resolve to an
exact rectangle. Non-PDF formats keep their current chunking. No backfill; nothing applied live.

---

## Orient first — read these in order, then build

1. `.planning/citations/phases/b0-ingestion-geometry/RESEARCH.md` — **primary build source.** The current
   pipeline with anchors (§1), the decided approach (§2), the **Docling layout/chunking API + the version
   caveat** (§3), OCR preflight (§4), entry points (§5), forward-only/migration posture (§6), the retrieval
   re-validation gate (§7). **Re-verify every anchor AND the installed Docling API before editing.**
2. `.planning/citations/phases/b0-ingestion-geometry/B0-01-PLAN.md` — task + decided approach + criteria.
3. `.planning/citations/phases/b0-ingestion-geometry/CONTEXT.md` — scope, decided decisions, file list, criteria.
4. `.planning/citations/CONTEXT.md` — locked ledger (**wins on conflict**): §3.1 DP6, L10/L23, **§8 Ep7B (the
   chunker decision + the retrieval-validation flag)**.
5. `services/doc_processor.py`, `services/vector_store.py`, `services/retrieval.py`, and the installed Docling
   package (confirm its chunking/prov/OCR API — it varies by version).

Read 1–4 fully before writing a line.

---

## Decided (do not re-open)

- **PDF + image → Docling layout-aware chunker** (keep the structured `DoclingDocument`; do **not**
  `export_to_markdown` first for these). Per chunk: `page_number`, `bbox` (page-space union + page dims +
  coord-origin for render-time transform), `verbatim` face (`chunk.text`).
- **Non-PDF → current `_split_text` path unchanged** — `verbatim` = source text; `page_number`/`bbox` null.
- **Forward-only, no backfill** (L10); OCR preflight (auto) for non-machine-readable PDFs.
- **Migration additive + STAGED (not applied live)**; retrieval **must be re-validated** post-switch.

---

## What you build

- **`services/doc_processor.py`** — for PDF/image, keep the structured Docling document and chunk it with the
  layout-aware chunker (`HybridChunker` or the installed equivalent); emit `page_number`, `bbox` (with page
  dims + coord origin), `verbatim`. Add OCR preflight + Docling OCR pipeline options for scanned PDFs. Leave the
  non-PDF (`csv_structured` / `plain_text` / other) paths unchanged.
- **`services/vector_store.py`** — extend `DocumentChunk` + `replace_document_chunks` to persist `page_number`,
  `bbox`, `verbatim`.
- **`docs/migrations/2026XXXX_document_chunks_geometry.sql`** — additive `page_number int`, `bbox jsonb`,
  `verbatim text`. **Write it; DO NOT apply it to shared Supabase.**
- **`python-backend/tests/test_ingestion_geometry_b0.py`** — PDF → geometry present; scanned PDF → OCR
  fallback / graceful null; non-PDF → verbatim set + geometry null; **retrieval re-validation** (hybrid search
  still returns sensible chunks).

---

## Hard constraints

- **Do not re-open the chunker decision.** PDF/image → layout chunker; non-PDF unchanged.
- **Forward-only, no backfill.** Existing chunks stay geometry-less (resolver falls back to line-level).
- **Do NOT apply the migration to live Supabase** — stage it (mirror the A6 gated posture).
- **Re-validate retrieval** after the PDF chunker switch — it's an acceptance criterion, not an assumption.
- **Code against the pinned Docling 2.44.0 API in RESEARCH §3** (not guesswork). Docling install is an env
  prerequisite for tests — if the run env lacks it, implement + defer the live ingestion test; don't stop-block.
  If the installed version differs from 2.44.0, reconcile against that version's docs and flag.
- **No B1/B2 work** (resolver/highlight), no UI, no embeddings-model change. **CONTEXT wins** on conflict.

---

## Done when (B0 success criteria — CONTEXT §"Success criteria")

1. A newly ingested **PDF** yields chunks with valid `page_number` + `bbox` + `verbatim`.
2. Geometry-less / OCR-only pages degrade gracefully (null geometry; still citable line-level).
3. Non-PDF ingests keep working (verbatim set; geometry null); **retrieval re-validated** post-switch.
4. Migration additive; existing reads unaffected; **nothing applied to live Supabase.**
5. `compileall` 0; ingestion + retrieval tests green; no backfill attempted.

**Report back:**
- One paragraph on what was built.
- The Docling chunking/OCR API you used (+ installed version) and the `bbox` jsonb shape you chose.
- Retrieval re-validation result (did hybrid search stay sensible after the PDF chunker switch?).
- Confirmation the migration is staged and **nothing was applied to shared Supabase.**
- Any implementation choice deviating from/extending the design (for CONTEXT §8 reconciliation).
- Any flag needing London or a judgment call (e.g. Docling API gaps, retrieval regressions).

Then stop. Sub-phase B1 is opened from the strategy thread.
