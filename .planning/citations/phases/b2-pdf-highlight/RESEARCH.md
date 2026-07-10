# B2 RESEARCH — Sidecar mount + source-PDF access + pdf.js transform (extraction)

**Extraction target:** where the highlight mounts, how the browser gets the source PDF, and the coord
transform. B2 = client pdf.js (London-confirmed). **Re-verify anchors before editing.** Verified 2026-07-06.

---

## §1 The sidecar mount (shared VCSO + artifact view)

`components/pro-suite/virtual-cso/CitationReaderBody.tsx`:
- **`CitationReaderBody` (`:30`)** — resolves the citation via `resolveCitation(citation)` (→ A2/B1 resolve
  endpoint), stores `result`, renders `CitationReaderView` by `view.type`.
- **The `chunk` view (default branch, `:147–149`)** — renders
  `<EvidenceHighlight ref={highlightRef}>{view.verbatim || citation.verbatim || 'Source unavailable.'}</EvidenceHighlight>`
  + `view.document`. **B2 mounts the pdf.js canvas + bbox overlay HERE**, gated on
  `view.locator?.kind === "bbox"` (geometry present, from B1) AND the document being a PDF. Else keep the text
  `EvidenceHighlight`.
- **Shared surface:** A5 renders the artifact-library citations through this **same** `CitationReaderBody`, so a
  single change lights up **both** VCSO and the artifact view. `isCitableRef` / chip gating (`:17`) unchanged.
- `EvidenceHighlight` + `highlightRef` is the existing jump-to-evidence anchor (A3) — B2's canvas centering
  replaces the scroll-to for geometry chunks.

## §2 Source-PDF access (the backend piece)

- **`download_raw_document(storage_path)` (`vector_store.py:43`)** downloads from
  `self.settings.raw_document_bucket` — so there is a raw-document storage bucket + per-doc `storage_path`.
- `ose_raw_document_registry` carries `storage_path` (the download uses it); B1's `_load_document` selects
  `file_name,file_type,status,…` — **B2 also needs `storage_path`** (add to that select or a dedicated lookup).
- **New endpoint — `GET /api/documents/{document_id}/signed-url`** (`main.py`, dependency
  `get_current_user_id` — browser-called, like resolve/check). Look up the doc row by `id` **scoped to the
  authed user**; `create_signed_url` on `raw_document_bucket` for its `storage_path` (short expiry); return the
  URL. Mirror the existing artifact signed-url pattern (`artifact_service` `create_signed_url` usage). The
  sidecar calls this only when opening a geometry chunk.

## §3 pdf.js + Vite worker + the coord transform

- **Dependency:** `pdfjs-dist` (Mozilla pdf.js). In Vite, wire the worker via
  `import * as pdfjsLib from 'pdfjs-dist'; pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();`
  (confirm the exact worker path for the installed pdfjs-dist version).
- **Render:** `getDocument({url: signedUrl}).promise` → `pdf.getPage(bbox.page_no)` → `page.getViewport({scale})`
  → render to a `<canvas>`.
- **Overlay transform:** the B0/B1 `bbox` jsonb is `{page_no, l, t, r, b, coord_origin, charspan, page_w,
  page_h}` (+ `multi_page`/`pages`). Map page-space → canvas px: `sx = canvas.width / page_w`,
  `sy = canvas.height / page_h`. **Honor `coord_origin`:** Docling PDF boxes are commonly **BOTTOM-LEFT**, so a
  top-left CSS overlay needs `top = (page_h - t_top) * sy` — flip Y when origin is bottom-left. Position an
  absolutely-placed highlight `div` (or draw on an overlay canvas) at the transformed rect; center the
  scroll/viewport on it. Zoom = re-render viewport at a new scale + re-transform.
- **Multi-page:** highlight the `bbox.page_no` page (the chunk's primary page); `pages[]` is available if a
  future pass wants multi-page highlights.

## §4 Fallback + deferred smoke

- **Fallback (no regression):** geometry-less (pre-B0) / non-PDF / signed-url failure → keep A3's text
  `EvidenceHighlight`. Never a broken canvas or empty box.
- **Deferred smoke:** geometry columns are live only after the B0 migration (B-series session), so the **full
  pixel-render smoke needs a real geometry-bearing PDF** — deferred to B3 / an enabled env. B2 unit-tests the
  transform math (page-space → canvas, coord-origin flip) with fixtures now, and builds/typechecks.
