# Plan B2-01 — PDF highlight rendering (jump to bounding box)

**Sub-phase:** B2 — PDF highlight (Ep7B)
**Plan:** 1 of 1
**Depends on:** B1 (geometry resolve payload), A3 (sidecar), A5 (artifact view)
**Status:** Ready for execution — **render approach decided: client pdf.js** (CONTEXT §8 Ep7B, London-confirmed).
**Decisions:** `../../CONTEXT.md` §3.3, §3.1 DP6, §8 (B2 decision + mount points) · **Ref:** `../../REFERENCES.md` C-12

---

## Goal

Pixel-precise source face — jump-to-evidence lands on the exact rectangle on the exact PDF page, in **both**
Virtual CSO and the Domain Agents artifact view (one shared component). Consumes `locator.bbox` (B1).

## Decided (do not re-open)
- **Client-side pdf.js (`pdfjs-dist`)** renders the cited page to a `<canvas>`; overlay the `bbox` rectangle.
- **Owner-scoped backend signed-URL endpoint** for the source document (the browser fetches the PDF from it).
- **Shared mount:** `CitationReaderBody.tsx` (used by VCSO + the A5 artifact view) — one change, both surfaces.

## Pre-Execution Checks
1. Read `RESEARCH.md` (this folder) — the sidecar mount + chunk view (§1), the signed-URL backend path (§2),
   the pdf.js/Vite worker setup + coord transform (§3), deferred smoke (§4).
2. Confirm `settings.raw_document_bucket` + `ose_raw_document_registry.storage_path` for the signed-URL lookup.

## Build
- **Backend — `GET /api/documents/{document_id}/signed-url`** (`main.py`, dependency `get_current_user_id`).
  Look up the doc's `storage_path` (user-scoped on `ose_raw_document_registry`); `create_signed_url` on
  `raw_document_bucket`; return the URL (+ short expiry). Mirror the artifact signed-url pattern.
- **Frontend — add `pdfjs-dist`** (wire its worker for Vite via `import.meta.url`).
- **Frontend — `CitationReaderBody.tsx` chunk view (`:147–148`).** When `view.locator.kind === "bbox"` and the
  document is a PDF: fetch the signed URL, render `bbox.page_no` to a canvas via pdf.js, and overlay the
  rectangle — transform page-space `l,t,r,b` (in `page_w × page_h`, honoring `coord_origin`: Docling PDF boxes
  are typically bottom-left → flip Y) onto the viewport scale; center the highlight. Zoom keeps it aligned.
- **Fallback.** No geometry (pre-B0) / non-PDF / signed-url failure → keep A3's text `EvidenceHighlight`
  (line/section) — no regression.
- **Both surfaces** get this automatically via the shared `CitationReaderBody`.

## Surface manifestation
**Virtual CSO + Domain Agents artifact view** — clicking a geometry-capable chunk chip shows the PDF page with
the exact rectangle highlighted and centered. Visual polish still coordinates with §8.

## Success criteria
1. A geometry-capable chunk chip → PDF page with the correct rectangle highlighted + centered (both surfaces).
2. Zoom keeps the highlight aligned (render-time transform correct); `coord_origin` handled.
3. Geometry-less / non-PDF / signed-url-failure chunks fall back to line-level text highlight (no regression).
4. Signed-URL endpoint is owner-scoped (`get_current_user_id`); rejects cross-user docs.
5. Frontend builds/typechecks; transform unit-tested with fixtures.

## Out of scope
Ingestion (B0); the resolver geometry branch (B1); the final visual design (§8); applying the B0 migration live
(B-series session); the full pixel-render smoke on a real geometry PDF (deferred — B3 / enabled-env).
