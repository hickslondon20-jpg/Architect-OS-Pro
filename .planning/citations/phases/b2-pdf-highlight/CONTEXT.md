# Sub-phase B2 Context — PDF Highlight Rendering (Ep7B)

**Date:** 2026-07-06
**Outcome:** Ready to execute. **Render approach decided: client pdf.js** (CONTEXT §8 Ep7B, London-confirmed).
The execution agent makes implementation choices only, not design choices.

---

## What this sub-phase is

The geometry track's payoff: render the cited PDF page on a canvas and highlight the exact `bbox` rectangle, in
**both** Virtual CSO and the artifact view (via the shared `CitationReaderBody`). Consumes B1's `locator.bbox`.
Single deliverable: **B2-01** (see `B2-01-PLAN.md`).

---

## Inputs the agent must read first (in order)

1. `RESEARCH.md` (this folder) — **primary build source.** The sidecar mount (§1), source-PDF access + the
   signed-URL endpoint (§2), pdf.js/Vite worker + coord transform (§3), fallback + deferred smoke (§4).
2. `B2-01-PLAN.md` (this folder) — task + criteria.
3. `../../CONTEXT.md` — locked ledger. §3.3, §3.1 DP6, **§8 (the B2 decision + mount points + the B0/B1 `bbox`
   contract)**. **CONTEXT wins on conflict.**
4. `components/pro-suite/virtual-cso/CitationReaderBody.tsx` (the mount), `python-backend/services/vector_store.py`
   (`download_raw_document`, `raw_document_bucket`), `python-backend/main.py` (endpoint + `get_current_user_id`),
   the artifact signed-url pattern.

---

## Decisions already made (do not re-open)

- **Client pdf.js (`pdfjs-dist`)** — canvas render + bbox overlay; not server-rendered images.
- **Owner-scoped signed-URL endpoint** for the source doc (`get_current_user_id`).
- **Shared `CitationReaderBody`** — one change covers VCSO + artifact view.
- **Gate on `view.locator.kind === "bbox"` + PDF** — else fall back to text `EvidenceHighlight` (no regression).
- **Honor `coord_origin`** (Docling PDF boxes typically bottom-left → flip Y).
- **Full pixel smoke deferred** (needs a real geometry PDF; B-series/enabled env) — transform unit-tested now.

---

## What this sub-phase does NOT do

- No ingestion (B0), no resolver change (B1), no final visual design (§8).
- No live-Supabase apply (B0 migration is B-series-gated).
- No multi-page multi-box highlight (single primary page now).

---

## Files to create or modify

| File | Action | Notes |
|---|---|---|
| `python-backend/main.py` | Modify | `GET /api/documents/{document_id}/signed-url` (`get_current_user_id`, user-scoped, raw-document bucket). |
| `python-backend/services/vector_store.py` (or resolver) | Modify (maybe) | Expose the doc `storage_path` for the signed-url lookup. |
| `package.json` | Modify | Add `pdfjs-dist`. |
| `components/pro-suite/virtual-cso/CitationReaderBody.tsx` | Modify | Chunk view: pdf.js canvas + bbox overlay when geometry+PDF; text fallback else. |
| pdf.js worker wiring (Vite) | Create/config | `GlobalWorkerOptions.workerSrc` via `import.meta.url`. |
| `python-backend/tests/…` + a frontend transform test | Create | Endpoint owner-scoping; page-space→canvas transform + coord-origin flip (fixtures). |

---

## Success criteria (B2-01)

1. A geometry-capable chunk chip → PDF page with the correct rectangle highlighted + centered (both surfaces).
2. Zoom keeps the highlight aligned; `coord_origin` handled.
3. Geometry-less / non-PDF / signed-url-failure → text-highlight fallback (no regression).
4. Signed-URL endpoint owner-scoped; rejects cross-user docs.
5. Frontend builds/typechecks; transform unit-tested with fixtures.

---

## Handoff

When the canvas highlight renders in both surfaces with a clean fallback and the signed-URL endpoint is
owner-scoped, the strategy thread logs a B2 completion amendment in `../../CONTEXT.md §8`, then opens
**sub-phase B3 (Ep7B acceptance)** — the end-to-end geometry path on a real forward-ingested PDF (the deferred
pixel smoke), plus the B-series live-DB apply session with London.

*Context written: 2026-07-06 — Ep7 citations planning thread, at B2 sub-phase entry (client pdf.js locked).*
