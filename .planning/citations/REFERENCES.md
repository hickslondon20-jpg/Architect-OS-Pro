# Citations & Source Grounding — Reference Map

Maps the **reference Episode 7** machinery (`docs/plans/ep7-citations/PRD-Citations.md` + `README.md` —
the AI Automators "Citations & Source Grounding" build) to its consuming sub-phase, with extract / adapt /
skip notes. **Adopt the model and UX, never the parallel per-message citations store** — our currency is
the existing `AgentSourceRef`/`agent_result_v1` shape unified into `CitationRef` (L22), not the reference's
standalone citations subsystem.

**The governing inversion.** The reference is *grounded by construction via in-context evidence markers* —
it marks spans in the model's context and the model copies markers back, because it has no structured
source-refs. **We already receive structured source-refs from every tool/wiki read**, so our default is
**source-ref-first** (cite from the ref), and we keep in-context marking only for the narrow verbatim-quote
binding case (CONTEXT §3.1 DP2). This flips the reference's central mechanism from *mandatory* to *narrow*.

---

## Adoption → sub-phase → extract / adapt / skip

### Group 1 — Evidence Locations at Ingestion → **Ep7B**

| # | Reference module | Sub-phase | EXTRACT / ADAPT | SKIP |
|---|---|---|---|---|
| C-1 | **Layout-Aware Extraction** (full + per-page markdown, structure outline, layout payload) | B0 | The layout payload → `page_number` + `bbox` on `document_chunks`; forward-only | Their doc-render metadata store shape; the clickable outline (defer) |
| C-2 | **Bounding Boxes & Page Geometry** (page-space coords, per-box origin, per-page dims, transform at render) | B0, B1, B2 | `Locator.bbox` + `page_number`; render-time transform onto pdf.js canvas | — |
| C-3 | **Machine-Readability Preflight + OCR** | B0 | OCR/text-layer fallback in ingestion so geometry is trustworthy | Their exact preflight thresholds/knobs (tune later) |
| C-4 | **Verbatim Citable Text** (dual-face chunks: enriched-for-retrieval + verbatim-for-quoting) | B0 | The verbatim source face on `document_chunks` → `CitationRef.verbatim` for chunks | — |

### Group 2 — Evidence-Marked Context → **Ep7A (A0/A1)**, adapted heavily

| # | Reference module | Sub-phase | EXTRACT / ADAPT | SKIP |
|---|---|---|---|---|
| C-5 | **Evidence Markers** (collision-resistant marker injected before each citable passage, additive/strippable) | A1 | **Narrow adaptation:** reuse only for verbatim-quote binding, via the *existing* Tier 2 `[[Source: raw_document:{id}#chunk:{id}]]` marker (already machine-parseable) → `parse_inline_source_marker` | Universal mandatory in-context marking of all sources (we cite from source-refs — DP2) |
| C-6 | **Universal Citable Context** (uniform marking across KB/doc/file/search/web; non-citable scrubbed) | A0 | The *goal* (uniform citability) achieved via the currency + adapters, not via marking every context passage | The marking mechanism as the uniformity path |
| C-7 | **Web Citations & Snapshots** (point-in-time capture, persisted only for cited pages) | A2 | The `web` resolver + snapshot concept | **Ships dark** until a web producer tool exists (F3/O2); snapshot store deferred with it |
| C-8 | **Stable Citation Identity** (content-hashed deterministic ids, thread-stable numbering) | A1 | Thread-stable ordinal ids for answer-span binding (the O3 spike decides id scheme) | Their per-message citations table as the identity home (we key off the turn's `CitationRef[]`) |
| C-9 | **Streaming Delivery** (chips light up instantly, upgrade mid-stream, settle at end) | A1, A3 | The chip lifecycle over unified `CitationRef` stream events (replacing VCSO `{kind,label,pageId}` — F4) | — |

### Group 3 — Rendering & Source Preview → **Ep7A (A2/A3)**, **Ep7B (B2)** for PDF geometry

| # | Reference module | Sub-phase | EXTRACT / ADAPT | SKIP |
|---|---|---|---|---|
| C-10 | **Inline Citation Chips** (numbered, status-colored, hover→click progressive disclosure) | A3 | The chip component + interaction, wired to resolvers; **functional only** (visual polish → §8) | — |
| C-11 | **Document Preview Sidecar** (renders source by type: PDF, paginated text, office/md/html, web) | A2, A3 | The sidecar + the by-type render dispatch, driven by resolver family | — |
| C-12 | **Jump to Bounding Box** (map stored page-space box onto live zoomable canvas, center highlight) | B2 | The pdf.js highlight-and-center behavior | — (Ep7B; A3 ships line/section/field jump first) |
| C-13 | **Text Highlighting** (locate cited quote in rendered content, tolerant of md/tables/elision) | A3 | Quote-location for chunk/wiki verbatim + `locator.lines`/`section` | — |
| C-14 | **Web Snapshot vs Live toggle** | A2 | Concept only; dark with C-7 | Build deferred with the web producer |
| C-15 | **Tier 0 record rendering** *(no reference equivalent — net-new)* | A2 | Our own: the DP3 typed-renderer registry (record → field table + deep-link) | The reference has no Tier 0 analog |

### Group 4 — Check Citations → **Ep7A (A4)**

| # | Reference module | Sub-phase | EXTRACT / ADAPT | SKIP |
|---|---|---|---|---|
| C-16 | **On-Demand Verification** (per-message action, recolors chips) | A4 | The action + chip-recolor over our turn `CitationRef[]` | — |
| C-17 | **Grounding Verifier** (utility-model pass grading co-cited markers vs sources, structured verdicts) | A4 | The utility-model grader (L12 routing), reusing our resolvers to fetch source content | Grading "co-cited markers together" (we grade per `CitationRef`) |
| C-18 | **Verdict Taxonomy** (Supported / Partial / Not supported / Contradicted / Verification failed) | A4 | Adapt to `{supported, partial, unsupported, unresolvable}`; persist per citation | — |
| C-19 | **Copy** (copies answer with markers stripped) | A3 | Trivial; fold into the answer/chip UI | — |

---

## Reused from our own stack (not the reference)

- **Ep5 tool registry** (`tool_registry.py`) — `ToolSourceRef` already emits a broad `source_kind`
  taxonomy across every tool; A0 adapts it into `CitationRef`.
- **Tier 1 `../wiki-system/`** (`wiki_read.py`, `wiki-1.0`) — claim-level `evidence` (`path/lines/weight/note`)
  is the model for `Locator.lines`; `AgentSourceRef` (agent_context.py) is the currency base.
- **Tier 2 `../document-wiki/`** (`doc_wiki_read_service.py`, `doc-wiki-1.0`) — inline `[[Source:]]` +
  `agent_result_v1` are the shapes A0 normalizes.
- **Ep6 harness/artifacts** (`harness_engine.py`, `artifact_service.py`) — `source_refs` already flow into
  `artifacts.provenance` (`domain_agent_artifact_provenance_v1`); A5 renders from it, no re-plumbing.
- **Retrieval** (`retrieval.py`) — `hybrid_search` is the live chunk producer feeding the chunk resolver.

## Hard rule

Every item above contributes a **model, UX pattern, or verification loop** — never the reference's parallel
per-message citations store, never a substrate swap. Our substrate is Supabase + pgvector + the existing
`python-backend/services/` and the unified `CitationRef` currency. Where the reference's mechanism
(mandatory in-context marking) conflicts with our reality (structured source-refs already in hand), our
reality wins and the reference mechanism is narrowed, not adopted wholesale (CONTEXT §3.1 DP2, §5 F5).
