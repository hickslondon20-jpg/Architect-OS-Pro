# B0 RESEARCH — The live ingestion pipeline + Docling layout (extraction)

**Extraction target:** the document ingestion path B0 modifies to capture geometry + verbatim, forward-only.
**Re-verify anchors before editing — they drift, and the Docling API varies by installed version.** Verified
2026-07-06. Paths under `python-backend/`.

---

## §1 The current pipeline (geometry is discarded)

`services/doc_processor.py`:
- **`_read_with_docling` (`:122–156`)** — `DocumentConverter().convert(tmp_path)` → `result.document`, then
  **`document.export_to_markdown()`** (`:134`). Returns `(text, metadata)`. **The structured `DoclingDocument`
  (with per-item `prov` = page_no + bbox) is discarded** — only flattened markdown survives. This is the core
  loss B0 fixes.
- **`_split_text` (`:210–225`)** — `RecursiveCharacterTextSplitter` splits the markdown **string** by separators.
  Chunks are markdown slices with no link to source layout.
- **`_chunk_context` (`:228–244`)** — regex-derives `page_number` from "page N" text (`:233`), `section_heading`,
  etc. **Unreliable, text-derived, not layout-derived.**
- **`process_document_bytes` (`:247+`)** — dispatches parser (`csv_structured` / `plain_text` / Docling), splits,
  builds `DocumentChunk(content, chunk_index, metadata)`.

`services/vector_store.py`:
- **`replace_document_chunks` (`:236–273`)** — inserts `document_chunks` rows:
  `{document_id, user_id, chunk_index, content, embedding, embedding_model, metadata}`. **No `page_number`,
  `bbox`, or `verbatim` column** — everything non-content lives in the `metadata` jsonb.
- `DocumentChunk` dataclass: `content, chunk_index, metadata` (near top of `vector_store.py`).

`document_chunks` columns today (from `agent_context.py:206` select): `id, user_id, document_id, chunk_index,
content, metadata` (+ `embedding`, `embedding_model`). **B0 adds `page_number int`, `bbox jsonb`, `verbatim text`.**

## §2 The decided approach (CONTEXT §8 Ep7B — London-confirmed)

**PDF + image → Docling layout-aware chunker.** Keep the structured `DoclingDocument` (do **not**
`export_to_markdown` first for these), and chunk it so geometry survives. **Non-PDF → current `_split_text`
path unchanged** (verbatim = source text; page_number/bbox null). Forward-only; no backfill.

## §3 Docling 2.44.0 chunking + provenance API (PINNED — authoritative, from official docs)

`requirements.txt` pins **`docling==2.44.0`**, so the API is deterministic. Verified against the Docling docs
(chunking concepts + hybrid-chunking example) 2026-07-06. Code against this; do not guess. If the run env has a
different version, reconcile against that version's docs and flag.

**Convert → structured doc → layout chunk:**
```python
from docling.document_converter import DocumentConverter
from docling.chunking import HybridChunker

doc = DocumentConverter().convert(source=path).document      # keep the DoclingDocument (do NOT export_to_markdown)
chunker = HybridChunker()                                    # tokenizer defaults to all-MiniLM-L6-v2; can pass tokenizer/max_tokens
for chunk in chunker.chunk(dl_doc=doc):
    verbatim   = chunk.text                                  # RAW face → the `verbatim` column (what the model quotes)
    enriched   = chunker.serialize(chunk=chunk)              # CONTEXT-ENRICHED face → what you EMBED (retrieval `content`)
    provs      = [p for it in chunk.meta.doc_items for p in it.prov]   # provenance items
    page_number = provs[0].page_no if provs else None        # page_no per prov item
    # bbox per prov: p.bbox has l, t, r, b + coord_origin; union the chunk's boxes per page
```

**Dual-face mapping (this is the reference's C-4, for free):**
- **`verbatim` column = `chunk.text`** — the raw source face the model quotes / highlights locate against.
- **retrieval `content` (embedded) = `chunker.serialize(chunk)`** — the context-enriched face. This is the
  Docling-recommended embed text and is a refinement over today's markdown-slice content (covered by the
  retrieval re-validation gate, §7).
- **`page_number` = `prov.page_no`**, **`bbox`** = union of the chunk's `prov.bbox` boxes on that page.

**`chunk.meta.doc_items[].prov[]`** fields: `page_no`, `bbox` (`l, t, r, b`, `coord_origin`), `charspan`.
Store bbox as jsonb with everything B2 needs to transform to the render canvas, e.g.
`{page_no, l, t, r, b, coord_origin, charspan}` (+ page width/height if the converter exposes it via
`doc.pages[page_no].size`).

**Converter with OCR/layout (PDF):** OCR via `PdfPipelineOptions(do_ocr=True, ...)` passed through
`PdfFormatOption(pipeline_options=...)` into `DocumentConverter(format_options={InputFormat.PDF: PdfFormatOption(...)})`.
Confirm the exact `ocr_options` fields in 2.44.0 at code time (stable API family; field names are the only version-sensitive part).

**Important — in-process vs docling-serve:** the known bug where `doc_items` come back as unresolved JSON-Pointer
refs (missing prov) is in **docling-serve** (the HTTP service), **not** the in-process library. ArchitectOS uses
`DocumentConverter` in-process, so `chunk.meta.doc_items[].prov[]` **is** populated — no second resolve call needed.

## §4 OCR preflight (C-3)

Detect PDFs that lack a real text layer (machine-readability preflight) and enable Docling OCR with a layered
fallback (text-layer → OCR). Default = auto. Goal: geometry + verbatim are trustworthy even for scanned PDFs.
Defer exact thresholds to tuning.

## §5 Ingestion entry points

`/api/ingest` (`main.py:759`, `require_ingest_secret` — server-to-server, correct here) → `process_document_bytes`
→ `replace_document_chunks`. Also `main.py:1408` calls `replace_document_chunks`. B0 threads geometry from
`process_document_bytes` through `DocumentChunk` into `replace_document_chunks`.

## §6 Forward-only + migration posture

- **No backfill (L10)** — existing chunks stay geometry-less; the A2/B1 resolver falls back to line-level for them.
- **Sequence before bulk-upload GA (DP6)** — every at-scale PDF is geometry-capable from day one.
- **Migration** (`document_chunks` + `page_number`/`bbox`/`verbatim`) is **additive** and **staged for a later
  B-series live-DB session** — do **not** apply to shared Supabase (mirror the A6 gated posture).

## §7 Retrieval re-validation (acceptance gate)

Switching the PDF chunker changes chunk boundaries. **B0 must re-validate** that `retrieval.hybrid_search`
still returns sensible chunks for PDFs after the switch (a real acceptance criterion, not an assumption). Keep
embeddings pipeline (`replace_document_chunks._embed_texts`) intact; verify chunk sizes remain reasonable.
