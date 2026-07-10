# Sub-phase B0 Context — Ingestion Layout + Verbatim Capture (Ep7B)

**Date:** 2026-07-06
**Outcome:** Ready to execute. **Chunker decision locked** (CONTEXT §8 Ep7B, London-confirmed). The execution
agent makes implementation choices only, not design choices.

---

## What this sub-phase is

The first Ep7B phase: capture per-chunk **geometry (page_number + bbox) + verbatim source face** at ingestion so
document citations can resolve to an exact PDF rectangle later (B1/B2). Forward-only; no backfill. Single
deliverable: **B0-01** (see `B0-01-PLAN.md`).

---

## Inputs the agent must read first (in order)

1. `RESEARCH.md` (this folder) — **primary build source.** The current pipeline with anchors (§1), the decided
   approach (§2), the Docling layout/chunking API + version caveat (§3), OCR preflight (§4), entry points (§5),
   forward-only/migration posture (§6), the retrieval re-validation gate (§7).
2. `B0-01-PLAN.md` (this folder) — task + decided approach + criteria.
3. `../../CONTEXT.md` — locked ledger. §3.1 DP6, L10/L23, **§8 Ep7B (the chunker decision + retrieval flag)**.
   **CONTEXT wins on conflict.**
4. `services/doc_processor.py`, `services/vector_store.py` (`replace_document_chunks`, `DocumentChunk`),
   `services/retrieval.py` (re-validation), the installed Docling package (verify its chunking/prov API).

---

## Decisions already made (do not re-open)

- **PDF + image → Docling layout-aware chunker** (keep the structured doc; don't flatten to markdown first);
  per-chunk `page_number` + `bbox` + `verbatim`.
- **Non-PDF → current `_split_text` path unchanged** — `verbatim` = source text; geometry null.
- **Forward-only, no backfill** (L10); **sequence before bulk-upload GA** (DP6).
- **OCR preflight** (auto) for non-machine-readable PDFs.
- **Additive migration, staged not applied** — joins a later B-series live-DB session (mirror A6 gating).
- **Retrieval re-validation is an acceptance gate** — the PDF chunker switch changes boundaries.

---

## What this sub-phase does NOT do

- No geometry-aware resolver branch (B1); no PDF highlight rendering (B2); no user-facing UI.
- No backfill of existing chunks; no live-Supabase apply (staged for the B-series session).
- No change to non-PDF chunking; no change to the embeddings model/pipeline.

---

## Files to create or modify

| File | Action | Notes |
|---|---|---|
| `python-backend/services/doc_processor.py` | Modify | PDF/image: keep structured `DoclingDocument`, layout-chunk it → `page_number`/`bbox`/`verbatim`; OCR preflight. Non-PDF unchanged. |
| `python-backend/services/vector_store.py` | Modify | Extend `DocumentChunk` + `replace_document_chunks` to persist the new fields. |
| `docs/migrations/2026XXXX_document_chunks_geometry.sql` | Create | Additive `page_number int`, `bbox jsonb`, `verbatim text`. **Staged, not applied.** |
| `python-backend/tests/test_ingestion_geometry_b0.py` | Create | PDF → geometry present; scanned PDF → OCR fallback / graceful null; non-PDF → verbatim set, geometry null; retrieval re-validation. |

---

## Success criteria (B0-01)

1. A newly ingested **PDF** yields chunks with valid `page_number` + `bbox` + `verbatim`.
2. Geometry-less / OCR-only pages degrade gracefully (null geometry; still citable line-level via A2).
3. Non-PDF ingests keep working (verbatim set; geometry null); **retrieval re-validated** post-switch.
4. Migration additive; existing reads unaffected; **nothing applied to live Supabase.**
5. `compileall` 0; ingestion + retrieval tests green; no backfill attempted.

---

## Handoff

When PDF ingestion captures geometry + verbatim, non-PDF still works, retrieval is re-validated, and the
migration is staged (not applied), the strategy thread logs a B0 completion amendment in `../../CONTEXT.md §8`,
then opens **sub-phase B1 (geometry-aware chunk resolver)**. The B0 migration joins the B-series live-DB apply
session (with London), separate from A6's.

*Context written: 2026-07-06 — Ep7 citations planning thread, at B0 sub-phase entry (chunker decision locked).*
