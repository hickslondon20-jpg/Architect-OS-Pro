# Citations (Episode 7) — Sub-phase B2 Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at
> `C:\Users\Hicks\ArchitectOS Pro_beta`. This session runs sub-phase **B2 only** (PDF highlight rendering).
> Do **not** start B3. Do **not** apply the B0 migration to live Supabase.

---

You are the **execution agent** for Sub-phase B2 (PDF Highlight) of the ArchitectOS Episode 7 (Citations) build
— the geometry track's payoff phase. You build against **decided design** — implementation choices only, never
design choices. **The render approach is decided: client-side pdf.js** (London-confirmed) — do not re-open it.
This is **functional** rendering — final visual design is the §8 pass. If something needs a design decision
beyond the inputs, **stop and flag it**.

You are in the `ArchitectOS Pro_beta` repo, canonical path `C:\Users\Hicks\ArchitectOS Pro_beta`.

**What B2 is, in one line:** render the cited PDF page to a `<canvas>` via `pdfjs-dist` and overlay the exact
`bbox` rectangle (from B1's `locator.bbox`), in the shared `CitationReaderBody` so **both** VCSO and the artifact
view light up — plus an owner-scoped backend signed-URL endpoint for the source PDF.

---

## Orient first — read these in order, then build

1. `.planning/citations/phases/b2-pdf-highlight/RESEARCH.md` — **primary build source.** The sidecar mount with
   anchors (§1), source-PDF access + the signed-URL endpoint (§2), the pdf.js/Vite worker + coord transform
   (§3), fallback + deferred smoke (§4). **Re-verify anchors before editing.**
2. `.planning/citations/phases/b2-pdf-highlight/B2-01-PLAN.md` — task + criteria.
3. `.planning/citations/phases/b2-pdf-highlight/CONTEXT.md` — scope, decided decisions, file list, criteria.
4. `.planning/citations/CONTEXT.md` — locked ledger (**wins on conflict**): §3.3, §3.1 DP6, **§8 (the B2
   decision + mount points + the B0/B1 `bbox` contract)**.
5. `CitationReaderBody.tsx` (the mount), `vector_store.py` (`download_raw_document`, `raw_document_bucket`),
   `main.py` (endpoint + `get_current_user_id`), the artifact signed-url pattern.

Read 1–4 fully before writing a line.

---

## What you build

- **Backend — `GET /api/documents/{document_id}/signed-url`** (`main.py`, dependency `get_current_user_id`).
  Look up the doc by id **scoped to the authed user** on `ose_raw_document_registry`; `create_signed_url` on
  `settings.raw_document_bucket` for its `storage_path` (short expiry); return the URL. Expose `storage_path`
  where needed. Mirror the artifact signed-url pattern.
- **Frontend — add `pdfjs-dist`** to `package.json`; wire its worker for Vite
  (`GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()`
  — confirm the exact path for the installed version).
- **Frontend — `CitationReaderBody.tsx` chunk view (`:147–149`).** When `view.locator?.kind === "bbox"` **and**
  the document is a PDF: fetch the signed URL, `getDocument({url}).promise` → `getPage(bbox.page_no)` → render to
  a `<canvas>`, and overlay the rectangle — transform page-space `l,t,r,b` (in `page_w × page_h`) to canvas px,
  **honoring `coord_origin`** (Docling PDF boxes are typically bottom-left → flip Y for a top-left overlay);
  center on the highlight. Zoom = re-render viewport + re-transform.
- **Fallback:** geometry-less (pre-B0) / non-PDF / signed-url failure → keep A3's text `EvidenceHighlight`
  (line/section). Never a broken canvas.
- **Both surfaces** get this via the shared `CitationReaderBody` — do not fork a second component.
- **Tests:** endpoint owner-scoping; the page-space→canvas transform + coord-origin flip (fixtures — a real
  geometry PDF isn't available until the B-series apply).

---

## Hard constraints

- **Do not re-open the render approach** — client pdf.js, shared component, signed-URL endpoint.
- **Gate on geometry + PDF**; always fall back to text highlight otherwise (**no regression**).
- **Owner-scope the signed-URL endpoint** (`get_current_user_id`); reject cross-user docs; short expiry.
- **Honor `coord_origin`** in the transform — don't assume top-left.
- **Functional only** — no §8 visual polish. **Do NOT apply the B0 migration live.** No B0/B1 changes.
- **CONTEXT wins** on conflict. If underspecified, stop and flag.

---

## Done when (B2 success criteria — CONTEXT §"Success criteria")

1. A geometry-capable chunk chip → PDF page with the correct rectangle highlighted + centered (both surfaces).
2. Zoom keeps the highlight aligned; `coord_origin` handled.
3. Geometry-less / non-PDF / signed-url-failure → text-highlight fallback (no regression).
4. Signed-URL endpoint owner-scoped; rejects cross-user docs.
5. Frontend builds/typechecks; transform unit-tested with fixtures.

**Report back:**
- One paragraph on what was built.
- The signed-URL endpoint + its scoping; the pdf.js worker wiring; the coord transform (incl. coord-origin handling).
- Confirmation both surfaces light up via the shared component, the fallback works, and nothing was applied to shared Supabase.
- Any implementation choice deviating from/extending the design (for CONTEXT §8 reconciliation).
- Any flag needing London or a judgment call (e.g. pdfjs-dist worker/Vite issues, coord-origin ambiguity).

Then stop. Sub-phase B3 (Ep7B acceptance) is opened from the strategy thread.
