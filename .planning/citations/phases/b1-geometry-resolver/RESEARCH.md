# B1 RESEARCH — A2 chunk resolver + B0 geometry (extraction)

**Extraction target:** the as-built A2 `chunk_resolver` (B1 extends it) + the B0 geometry columns/contract it
now reads. **Re-verify anchors before editing.** Verified 2026-07-06. Paths under `python-backend/`.

---

## §1 The A2 chunk_resolver as-built (what B1 extends)

`services/citations/resolvers/chunk_resolver.py`:
- **Select (`:16–23`):** `document_chunks` → `id,user_id,document_id,chunk_index,content,metadata`, owner-scoped
  by `user_id`, `.eq("id", source_id).maybe_single()`. **B1 adds `page_number, bbox, verbatim` to this select.**
- **View (`:44–72`):** returns `{type:"chunk", source_kind, source_id, label, verbatim, locator, document, chunk}`.
  - `verbatim` (`:49`) = `chunk.get("content")` today. **B1:** `chunk.verbatim or chunk.content`.
  - `locator` (`:50–56`) already reserves the geometry slots — **currently `page_number: None`, `bbox: None`**,
    with `kind` = `"lines"`/`"section"`. **B1 populates page_number/bbox and sets `kind:"bbox"` when present.**
- **Error (`:111–118`):** typed `{type:"error", code, message}` — B1 keeps this for unresolvable/missing-id.
- **`_lines_from` (`:92–108`), `_load_document` (`:75–89`):** unchanged (line-level fallback + doc metadata).

## §2 B0 geometry columns + `bbox` contract (what B1 reads)

B0 added to `document_chunks` (migration `20260706_document_chunks_geometry.sql`, **staged not applied** — live
only after the B-series session):
- `page_number int` — layout-derived page (post-B0 PDF/image chunks).
- `verbatim text` — the raw `chunk.text` face (post-B0). Non-PDF: chunk text. Pre-B0: null.
- `bbox jsonb` — shape (CONTEXT §8 B0 reconciliation):
  `{page_no, l, t, r, b, coord_origin, charspan, page_w, page_h}` + `multi_page` + `pages[]` when a chunk spans
  pages. **Pass this through as-is** into `locator.bbox`; B2 transforms it onto the render canvas.
- Post-B0 `content` = the enriched `serialize()` face (embedded); the **raw** face lives in `verbatim`.

## §3 B1's change (small, additive)

1. Extend the select with `page_number, bbox, verbatim`.
2. `verbatim` field = `chunk.verbatim or chunk.content` (raw face preferred; content fallback for pre-B0).
3. Geometry branch: if `page_number`/`bbox` present → `locator.page_number = chunk.page_number`,
   `locator.bbox = chunk.bbox` (pass-through), `locator.kind = "bbox"`. Else → A2 line/section behavior unchanged.
4. Fallback: pre-B0 / geometry-less chunk resolves exactly as A2 (no error, no null-geometry crash).

## §4 Downstream

- **No A3 change.** A3's `CitationReaderBody` sidecar already renders line/section; it ignores `locator.bbox`
  until B2 adds the PDF-canvas highlight. B1's payload change is additive → A3 keeps working.
- **B2 consumes** `locator.bbox` + `page_number` for the pixel-precise highlight.

## §5 Test posture

The geometry columns exist **live only after the B-series migration applies**. Until then, B1's tests use
**fixtures/mocks** for the post-B0 (geometry present) and pre-B0 (geometry null → fallback) cases. Live resolve
of a real geometry-bearing chunk is deferred to the B-series live/enabled-env pass (same posture as B0's smoke).
