# Episode 7: Citations & Source Grounding

This episode turns the platform's answers into **auditable, source-linked claims**. The agent cites by copying evidence markers that were injected into the exact text it was shown — so it can only cite sources it actually read. Every citation renders as a clickable chip that opens a document preview sidecar and jumps to the precise evidence: a highlighted bounding box on a PDF page, a highlighted passage in extracted text, or a captured snapshot of a web page. And with one click, **Check Citations** verifies whether each cited source really supports the claim.

## What It Is

**A citation is only worth anything if you can click it and land on the exact evidence — and, when it matters, have the system check that the evidence really says what the answer claims.**

- **Grounded by construction** — Evidence is marked *as it enters the model's context*. The model cites by copying a marker, so it cannot cite a source it was never shown. No after-the-fact "add citations" step that invites fabrication.
- **Resolves to a precise location** — Ingestion captures bounding boxes and page geometry, so a citation jumps to the exact rectangle on the exact PDF page (or a highlighted passage for everything else).
- **Verifiable on demand** — Quick citations are instant and free; **Check Citations** runs a verifier pass that grades each citation Supported / Partially supported / Not supported / Contradicted, and the result persists.

## What You'll Build

### Evidence Locations at Ingestion
- **Layout-Aware Extraction** — Full markdown, per-page markdown, a clickable structure outline, and a layout payload of text items with boxes
- **Bounding Boxes & Page Geometry** — Page-space coordinates with per-box origin and per-page dimensions, transformed at render time
- **Machine-Readability Preflight** — Detects PDFs that lie about being machine-readable and enables OCR; layered OCR/text-layer fallbacks
- **Verbatim Citable Text** — Dual-face chunks: an enriched face for retrieval, a verbatim face the model quotes so highlights can be located

### Evidence-Marked Context
- **Evidence Markers** — A collision-resistant marker injected before each citable passage, in place, additively (strip markers → original text)
- **Universal Citable Context** — Uniform marking across knowledge base, document reads, file reads, content search, and web; non-citable outputs scrubbed
- **Web Citations & Snapshots** — Point-in-time page capture, persisted only for cited pages, faithful to what the model read
- **Stable Citation Identity** — Content-hashed, deterministic ids and thread-stable numbering so a number means the same span across stream, turns, and reload
- **Streaming Delivery** — Chips light up instantly, upgrade to full evidence mid-stream, and settle to an authoritative set at the end

### Rendering & Source Preview
- **Inline Citation Chips** — Numbered, status-colored, with hover-preview → click-to-source progressive disclosure
- **Document Preview Sidecar** — Renders the source by type: PDF canvas, paginated extracted text, office/markdown/HTML, web
- **Jump to Bounding Box** — Maps a stored page-space box onto the live, zoomable PDF canvas and centers the highlight
- **Text Highlighting** — Locates the cited quote in rendered content, tolerant of markdown, tables, and elided quotes
- **Web Snapshot vs Live** — Highlightable snapshot by default, one-click toggle to the live page

### Check Citations
- **On-Demand Verification** — A per-message action that grades all citations and recolors the chips
- **Grounding Verifier** — A utility-model pass that grades co-cited markers together against their sources with structured verdicts
- **Verdict Taxonomy** — Supported / Partially supported / Not supported / Contradicted / Verification failed, persisted and reloadable
- **Copy** — Copies the answer with all citation markers stripped

## Key Concepts

| Aspect | Before | After |
|--------|--------|-------|
| Citation origin | Model adds citations after writing (invites fabrication) | Model copies markers injected into the text it was shown (grounded by construction) |
| Citable surface | Ad hoc / inconsistent across tools | Universal — every verbatim source passage in context is markable |
| Citation target | "See document X" / page number at best | Exact bounding box on the exact page, or a highlighted passage |
| Source view | Open the raw file | Sidecar renders the source and scrolls to the highlighted evidence |
| PDF location | None, or whole page | Page-space box mapped onto a zoomable canvas, centered |
| Web evidence | A link that may rot or change | Point-in-time snapshot, highlightable, with a live-page toggle |
| Numbering | Per-response, can drift across turns | Thread-stable, deterministic, reload-safe |
| Verification | None | One-click grounding check with persisted per-citation verdicts |
| Failure behavior | Broken/raw markers leak into text | Best-effort everywhere; unresolved markers stripped, misses shown as "not found" |

## Citation States

| State | Meaning | Cost |
|-------|---------|------|
| **Quick Citation** (default) | Grounded by construction (model cited text it was shown), but support not yet verified | Free — no extra model call |
| **Checked Citation** | A verifier pass graded each citation against its source | One on-demand utility-model pass |

### Verdicts (after a check)

| Verdict | Meaning |
|---------|---------|
| **Supported** | The source clearly supports the whole claim |
| **Partially supported** | Only part is supported, or support is weak/indirect |
| **Not supported** | The source contains no support |
| **Contradicted** | A source conflicts with the claim |
| **Verification failed** | Source unavailable, verifier errored, or not configured (defensive) |

## How a Citation Flows

```
Ingest (layout + boxes + verbatim text)
  → Retrieve (split into spans, assign thread-stable numbers)
    → Mark (inject markers in place, in the copy the model reads)
      → Answer (model copies markers; chips stream + upgrade)
        → Finalize (strip invalid, enrich PDF boxes, persist snapshots + citations)
          → Preview (hover → popover; click → sidecar; jump to evidence)
            → Check (optional: grade each citation, recolor chips, persist)
```

## Data Model

Described by role; names are illustrative.

| Store | Purpose |
|-------|---------|
| Document render metadata | Full + per-page markdown and the clickable structure outline |
| Document layout metadata | Text items with page, bounding box, origin, char span; per-page dimensions |
| Chunk verbatim source text | Pre-enrichment verbatim slice for quoting, alongside enriched retrieval content |
| Citations | Per-cited-span: id, marker, source identity, resolved target (quote + page + boxes), verdict status |
| Thread citation registry | Span → stable display number, persisted per thread |
| Web snapshots | Cleaned point-in-time page capture for cited web sources |
| Message verification mode | Quick (unverified) vs Checked |

## Configuration

Reference knobs; names and defaults are illustrative.

| Area | Knob | Purpose |
|------|------|---------|
| Citations | Enable inline citations | Master switch for evidence marking |
| Verification | Check model | Model for the Check Citations pass (defaults to the utility model) |
| Web search | Include raw content / max snapshot size | Whether and how much page text to snapshot |
| Ingestion (OCR) | OCR mode + readability thresholds | Auto/always/never OCR and preflight sensitivity |
| Ingestion (perf/safety) | Device, batch, table mode, concurrency, pixel caps, process isolation | Throughput and crash/memory guardrails |

## Prerequisites

- Completed Episodes 1–6
- Supabase with Postgres + pgvector + Storage (signed URLs for source files)
- A layout-aware document extraction engine (Docling in the reference build) for bounding boxes and page geometry
- Client-side PDF rendering (pdf.js in the reference build) for canvas highlights
- A web search provider that returns full page content (for snapshots)
- An OpenAI-compatible model for the verifier (can be a cheaper utility model, separate from the chat model)

## Documentation

See the [PRD](./PRD-Citations.md) for complete functional specifications.

## Community

Join [The AI Automators community](https://www.theaiautomators.com/) to connect with other builders creating production-grade AI and RAG systems.
