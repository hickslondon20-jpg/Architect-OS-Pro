# Episode 7 — PRD: Citations & Source Grounding

## Overview

This episode turns the platform's answers into **auditable, source-linked claims**. Every statement the agent makes can carry inline citation markers; every marker resolves to a precise, viewable location in the original source — a highlighted bounding box on a PDF page, a highlighted passage in extracted text, or a captured snapshot of a web page. The user can then optionally ask the system to **check** whether each citation's source actually supports the claim.

It builds four layers, each a prerequisite for the next:

1. **Evidence locations at ingestion** — When a document is imported, the platform captures not just its text but *where every piece of text lives* on the page: bounding boxes, page geometry, and a structural outline. This is what later lets a citation jump to an exact rectangle on a PDF.

2. **Evidence-marked context** — Before retrieved knowledge-base passages or web results are handed to the model, the platform injects lightweight **evidence markers** into them. The model can only cite text that was actually placed in its context, and it cites by copying a marker verbatim. This makes citations *grounded by construction* — the model cannot cite a source it was never shown.

3. **Interactive source preview** — Inline citation markers render as clickable chips. Clicking opens a document preview sidecar that renders the source and scrolls to (and highlights) the exact cited evidence — a bounding box for PDFs, a text highlight for everything else.

4. **Check Citations** — An on-demand action under any answer that runs a lightweight verifier pass: for each citation, does the cited source actually support the claim? Results recolor the chips (supported / partially supported / not supported / contradicted) and persist.

The key insight: **a citation is only worth anything if you can click it and land on the exact evidence — and, when it matters, have the system check that the evidence really says what the answer claims.** Most RAG systems emit citations the model invented and never verifies. This platform makes the model cite only what it was shown, resolves every citation to a viewable location, and offers one-click grounding verification on top.

A second principle runs through the whole feature: **citation wiring is always best-effort and never breaks the answer.** Every step — marking, identity assignment, location resolution, verification — is wrapped so that a failure degrades gracefully (a missing highlight, an "unverified" chip) and never crashes the chat stream or a tool call.

---

## Part 1: Capturing Evidence Locations at Ingestion

A citation that says "this is on page 4" is useful. A citation that highlights the exact sentence on page 4 is trustworthy. The difference is decided at ingestion: the platform must capture, for every span of text, *where it physically renders*. This part covers how that geometry is extracted and stored.

### Feature 1.1: Layout-Aware Document Extraction

#### What It Does

Ingestion routes documents through a layout-aware extraction engine (Docling in the reference implementation) that produces, alongside the document's text, a structured description of the page: which text item sits where, on which page, inside which bounding box. Plain-text formats skip this and take a fast path, since they have no page geometry to capture.

#### How It Works

1. **Format routing** — PDFs, office documents (DOCX/PPTX/XLSX), HTML, and images are sent to the layout engine. Plain text and markdown take a fast path: decoded directly, given a single synthetic page, and assigned **no layout** (text-only documents can never be highlighted by coordinate — only by text search).

2. **Four extraction faces** — For layout-bearing documents, the engine produces:
   - **Full markdown** — the complete document text, used for chunking and retrieval.
   - **Per-page markdown** — the text of each page, used by the sidecar's "Text" view.
   - **A structure outline** — a clickable, versioned tree of pages and section headings, used for navigation. Section nodes can carry their own page number and bounding box.
   - **A layout payload** — the citation-highlight data: a flat list of *text items*, each with the text, a page number, a bounding box, a coordinate origin, and an optional character span.

3. **Tables** — Tables are handled separately from flowing text. Each cell becomes its own layout item with its own bounding box, so a citation that quotes a table row can highlight the specific cells; a whole-table fallback box is emitted if per-cell geometry is unavailable.

4. **Progress streaming** — Ingestion is long-running, so stage and progress are streamed to the UI (via the realtime channel established in earlier episodes) throughout extraction, chunking, and embedding.

#### Design Decisions

- **Extraction is layered behind a clean seam.** The rest of the platform consumes four well-defined faces (markdown, per-page text, structure, layout). The specific engine is an implementation detail and can be swapped.
- **Plain text is not second-class — it just has no geometry.** It still gets a page and structure, so it previews and text-highlights normally; it simply has no bounding boxes.

---

### Feature 1.2: Bounding Boxes & Page Geometry

#### What It Does

Captures, for each text item, the rectangle it occupies on its page — in a way that survives to render time and can be mapped precisely onto a client-rendered page at any zoom level.

#### How It Works

1. **Page-space coordinates, not normalized.** Bounding boxes are stored in the page's own coordinate space (PDF points — 1/72 inch), exactly as the extraction engine reports them. They are **not** pre-normalized to 0–1 and **not** pre-scaled to image pixels. The layout payload records the coordinate system explicitly so the renderer knows how to interpret it.

2. **Origin is recorded per box.** Different extraction paths emit different vertical origins (some measure from the bottom-left of the page, some from the top-left). Rather than normalizing at ingestion, each box carries its own origin flag, and the **renderer performs the flip** against the live page. This is the single load-bearing detail that makes highlights land correctly.

3. **Page dimensions travel with the layout.** For every page, the width and height (in the same coordinate space) are stored. The renderer needs these to flip the origin and to scale boxes to the displayed page size.

4. **Cross-page passages are split by provenance.** A paragraph that spans a page break is one logical item but renders on two pages. It is split into per-page provenance segments, each with its own page number and box, so a quote highlights on the page where that specific sentence actually appears.

#### Design Decisions

- **Defer the transform to render time.** Because the box, its origin, and the page dimensions are all stored raw, the client can reconcile them against whatever zoom and viewport it is currently displaying. Pre-baking pixel coordinates at ingestion would break the moment the user zoomed.
- **Page images are not stored.** The platform persists geometry, not rasterized pages. At view time the client fetches the original document via a short-lived signed URL and rasterizes pages itself, drawing highlight overlays on top. This keeps storage small and highlights crisp at any resolution.

---

### Feature 1.3: Machine-Readability Preflight & OCR Fallbacks

#### What It Does

Decides, before extraction, whether a PDF's text needs OCR — and recovers gracefully when a PDF lies about being machine-readable (e.g. a scanned page with only a title in its text layer and the real body as an image).

#### How It Works

1. **Preflight sampling** — Before extraction, a sample of pages is analyzed for several signals: how many characters are present, how much of the page area is covered by text, text density, and how much of the page is covered by images/graphics.

2. **OCR decision** — A page with substantial visual content but too little real text is treated as needing OCR. If the share of genuinely machine-readable pages falls below a threshold, OCR is enabled for the document; heavily image-based pages trigger full-page OCR.

3. **Post-extraction fallbacks** — After extraction, if the recovered text is far smaller than the preflight predicted (or blank for a visually dense PDF), the platform retries via a direct OCR path and/or a direct text-layer extraction path, keeping whichever result recovers more text.

4. **Geometry guardrails** — Oversized pages/images (pixel-count bombs) are rejected by reading geometry only, never decoding. Very large PDFs are converted in page-range windows and merged, with page numbers renormalized to absolute values.

#### Design Decisions

- **Character count alone is a bad OCR heuristic.** A scanned page with a few title characters reads as "machine-readable" and silently drops its body. Combining text *and* visual-area signals is what catches this.
- **Ingestion must be crash-proof under memory pressure.** Native extraction is the dominant resource risk on this platform. The reference implementation gates concurrency, recycles the converter to contain native-memory growth, and can isolate native extraction in a child process so a native crash cannot take down the backend.

---

### Feature 1.4: Verbatim Citable Text

#### What It Does

Guarantees that the text the model quotes can actually be located in the source for highlighting — by giving each chunk two faces: an enriched face for retrieval and a verbatim face for citation.

#### How It Works

1. **The provenance problem.** Chunks are produced from the document's markdown, not from layout items. A chunk does not itself store page numbers or boxes — provenance is **recovered at citation time** by text-matching the cited quote against the layout's text items. That only works if the quoted text is verbatim.

2. **Why enriched text breaks matching.** To improve retrieval, the chunker bakes scaffolding into chunk content — synthetic "(Part N)" continuation headings, a prepended document-headline sentence. If the model quotes that enriched text, the quote contains characters that never appear in the source, and the highlighter fails to find it.

3. **Two faces per chunk** — Each chunk therefore carries:
   - an **index face** (the enriched content) — still what gets embedded and keyword-indexed, so retrieval quality is unchanged by construction; and
   - a **source face** (the verbatim slice, captured before any enrichment) — what the model is shown and asked to quote.

4. **Citations quote the source face.** Retrieval tools and the model-facing context use the verbatim source face, so every quote the model copies is a string the highlighter can locate in the original document.

#### Design Decisions

- **Decouple retrieval text from citation text.** Optimizing chunk content for recall and optimizing it for verbatim highlighting are different goals; the chunk holds both.
- **Backfill is forward-only.** Existing documents fall back to using their content as the source face until re-ingested; there is no automatic rewrite of historical chunks.

---

## Part 2: Evidence-Marked Context (How the Model Earns Citations)

This is the heart of the feature. Rather than asking the model to "add citations" after the fact (which invites fabrication), the platform marks the evidence *as it enters the model's context* and the model cites by copying those markers. A citation is therefore a pointer back to a specific span the model was actually shown.

### Feature 2.1: Evidence Markers & Span Registration

#### What It Does

Injects a lightweight, collision-resistant marker immediately before every citable passage in the context the model reads. The model copies the marker verbatim to cite that passage.

#### How It Works

1. **Marker format** — Each citable span gets a numbered marker. The reference implementation uses a brace-wrapped token, e.g. `{[S1]}`, `{[S2]}`. The wrapper is deliberately distinct from ordinary bracketed text that appears in tool output (document references, ranges, footnotes) so the model does not mistake noise for a citation token. *(The exact delimiter is a design choice; what matters is that it is unambiguous and easy to strip.)*

2. **Deterministic span splitting** — Retrieved text is split into spans by a pure-code routine (sentence boundaries, with short fragments merged and over-long sentences broken on whitespace). No LLM is involved in splitting — it must be deterministic and cheap.

3. **Additive, in-place labeling** — Each span is registered (Feature 2.4 assigns it a number), and its marker is inserted immediately before the span's text **inside the single copy of the tool result the model already reads**. There is no separate re-quoted "evidence block." Marking is purely additive: stripping every marker yields the original text back.

4. **Never-skip invariant** — If a span's text cannot be located for in-place insertion, its marker is anchored at the running cursor rather than dropped. Every registered span gets exactly one marker — markers and spans stay 1:1.

5. **The model is instructed how to cite** — A citation section in the system prompt tells the model to cite by copying the exact marker shown, to place markers adjacent for multiple sources (never merged into one token), to use only markers present this turn, and not to write a manual "Sources:" list.

#### Design Decisions

- **Ground by construction, not by trust.** The model can only emit a marker it was shown, so it cannot cite a source that was not in context.
- **One copy, marked in place.** Earlier designs re-quoted evidence into a second block, which doubled tokens and created two numbering systems to keep in sync. Marking the single existing copy removed that whole class of bugs.

---

### Feature 2.2: Universal Citable Context

#### What It Does

Applies evidence marking **uniformly across every source the model reads** — knowledge-base search, document section reads, file reads, web results, workspace files — so the citable surface equals the in-context source surface. Tool outputs that have no openable region are explicitly made non-citable.

#### How It Works

1. **Fully citable sources** — Any tool result that lifts verbatim text from an openable artifact into the model's context is evidence-marked: knowledge-base search results, document section/full-text reads, workspace file reads, content search results, and web search snippets.

2. **Non-citable sources** — Tool outputs with no highlightable region (directory listings, structure outlines, calculator/code execution, skill loading, search-index listings) are routed through a neutral path that *scrubs* any stray markers, so the model cannot accidentally cite a directory listing.

3. **Never-citable sources** — System prompt, user messages, prior AI answers, and tool-call arguments are never marked.

4. **No artificial caps** — Every eligible span is registered. A very high backstop guards against runaway loops, but in normal use every citable passage is markable. (Streaming is what keeps this affordable — see Feature 2.5.)

#### Design Decisions

- **The rule is simple and total:** if verbatim text from an openable source entered the model's context this turn, it carries a marker. This is what makes citations comprehensive rather than sampled.
- **Navigation is not evidence.** Outlines and listings are explicitly non-citable; allowing them to be cited both produced useless citations and starved the budget for real evidence.

---

### Feature 2.3: Web Search Citations & Snapshots

#### What It Does

Lets the model cite web results the same way it cites documents, and captures a **point-in-time snapshot** of each cited page so the citation remains viewable and highlightable even if the live page changes, disappears, or blocks embedding.

#### How It Works

1. **Web spans are labeled passages.** Unlike a knowledge-base chunk (whose full text is in context and can be marked in place), a web result puts only a short snippet in the model's context. Web spans are therefore appended as labeled passages (marker + title + quote) beneath the result.

2. **Snapshot capture** — The search provider returns full page text alongside the snippet. The platform cleans and caps this full text and holds it aside during the turn, keyed by source.

3. **Persist only what's cited** — At the end of the turn, snapshots are persisted **only for web sources the model actually cited**, de-duplicated so a page cited by several markers stores one snapshot.

4. **Snapshot is the default view; live page is opt-in.** The cited snippet is constructed to be a verbatim substring of the snapshot, so the same text highlighter used for documents works on the snapshot. The viewer can also load the live URL on demand (see Feature 3.5).

#### Design Decisions

- **Faithful to what the model read.** A snapshot reflects the page at the moment of retrieval — the actual evidence — and is immune to later edits or takedowns.
- **Storage follows citation.** Snapshots are only kept for cited pages, so search breadth doesn't bloat storage.

---

### Feature 2.4: Stable, De-duplicated Citation Identity

#### What It Does

Ensures a citation number means the **same span** everywhere — across a streaming response, across multiple turns in a thread, and across a page reload — and that invalid or invented markers never reach the user.

#### How It Works

1. **Two-layer identity** — Each citable span resolves to:
   - a **stable source id** (same document / web page / workspace file → same id across turns), and
   - a **content-hashed span id** (identical text → same span id), which together yield a **deterministic citation id**. The same span produces the same id whether it was streamed mid-answer or rebuilt on reload.

2. **Idempotent registration** — Registering the same span twice in a turn returns the same number; the per-turn registry is a map, not an append log.

3. **Thread-stable numbering** — A span's display number is assigned once and reused for the **whole thread**, persisted in a per-thread registry. At the start of each turn the registry is rehydrated so previously seen spans keep their numbers and new spans continue above the thread's maximum. This means a marker the model copies from earlier in the conversation resolves to the *same* span — eliminating cross-turn mis-attribution.

4. **Validation and repair at finalize** — When the answer is finalized:
   - markers that don't correspond to a registered span (the model invented one, or copied a stale token) are **stripped** from the saved text;
   - near-miss forms are **normalized** (e.g. a combined `{[S1, S8]}` is split into `{[S1]}{[S8]}`; a bare `[S5]` is recovered to `{[S5]}` *only* if 5 is a real alias);
   - adjacent markers pointing at the same PDF region are coalesced.

#### Design Decisions

- **Determinism over bookkeeping.** Because identity is content-hashed and numbers are persisted, the system never has to "recompute" what a citation meant — it is eviction-proof and reload-stable.
- **The user never sees a raw marker.** Anything that can't be resolved is stripped server-side, and the frontend also drops unresolved markers, so `{[S#]}` tokens never leak into displayed text.

---

### Feature 2.5: Streaming Citation Delivery

#### What It Does

Delivers citation data over the response stream in three escalating stages so chips appear instantly as the answer streams, become clickable-to-evidence mid-stream, and settle to an authoritative set at the end — without shipping every passage's full text over the wire.

#### How It Works

1. **Stage 1 — lightweight alias map.** As tools register citable spans, a *lightweight* map (marker number → source identity only: title, type, source id — no quote, no target) is streamed. This lets a chip light up the instant its marker streams into the text.

2. **Stage 2 — mid-stream upgrade of cited markers.** As the answer text streams, whenever a marker token completes, the platform re-parses the answer so far and, for each *newly cited* number not yet upgraded, streams the **full** citation for it (with the exact quote and resolved target, including page and bounding boxes for PDFs) under the same deterministic citation id. The chip upgrades in place, so a click mid-stream can already scroll the source to the cited passage. Only spans the model actually cites pay the full-payload cost.

3. **Stage 3 — authoritative metadata at end of turn.** A final event narrows to cited-only citations with complete quotes and targets and replaces the set. Because the citation id is identical whether streamed or finalized, chips don't churn.

4. **On reload, no stream** — Persisted citations are loaded with the message over REST and rendered identically.

#### Design Decisions

- **Lazy by design.** Removing per-source caps (Feature 2.2) would have bloated the stream if every citable passage's full text were pushed eagerly. Streaming identity first and full payloads only for *cited* spans keeps it cheap.
- **Stable ids are the anti-flicker mechanism.** The same id across all three stages is what lets the UI upgrade a chip in place instead of tearing it down and rebuilding.

---

## Part 3: Rendering Citations & Source Preview

This part is what the user actually touches: numbered chips inline in the answer, a hover preview, and a source sidecar that renders the original and jumps to the exact evidence.

### Feature 3.1: Inline Citation Chips & Progressive Disclosure

#### What It Does

Renders each inline marker as a small numbered chip, colored by verification status, with progressive disclosure: hover for a preview, click to open the full source.

#### How It Works

1. **Marker → chip** — Before the answer markdown is rendered, each marker token is rewritten into a clickable element carrying its citation id. The user sees a compact numbered pill, not a raw token. Runs of several adjacent chips collapse behind a "more" affordance to avoid clutter; unresolved markers are removed entirely (including their leading space).

2. **Status color** — The chip's color reflects its state: a neutral tint for unverified (Quick) citations, and supported / partial / contradicted colors after a check pass (Part 4).

3. **Hover → preview popover** — Hovering (or focusing) a chip opens a small popover: source type icon, source title and number, the cited quote, any problem note, a **View source** action, and an **Open original** external link. The popover dismisses on leave or scroll, and can be pinned open by clicking into it.

4. **Click → source panel** — Clicking the chip (or "View source") opens the document preview sidecar focused on this citation. On click, the citation is re-resolved from the live citation set, so a chip clicked mid-stream picks up its upgraded full target rather than a stale one.

#### Design Decisions

- **Three tiers of disclosure** — number → preview → full source — so the inline reading experience stays clean while evidence is always one or two interactions away.

---

### Feature 3.2: Document Preview Sidecar

#### What It Does

A side panel that renders the cited source in its native form and dispatches on content type: PDFs as rasterized pages, extracted text as paginated "sheets," office/text/markdown as rendered HTML, and web sources as a snapshot or live page.

#### How It Works

1. **Lazy content fetch** — The citation stream/metadata carries only identity and the target (quote + location). The actual source content is fetched **on demand when the panel opens**: the rendered extraction for an ingested document, a signed URL for the raw PDF, the file text for a workspace file, or the stored snapshot for a web source.

2. **Type dispatch** —
   - **PDF** → a canvas viewer that rasterizes pages and draws highlight overlays (Feature 3.3), with a Page/Text toggle.
   - **Extracted text** → per-page markdown rendered as paginated sheets with a "find in text" search, available for any ingested document.
   - **Office / text / markdown / HTML** → rendered preview (markdown rendered, HTML sandboxed).
   - **Web** → snapshot mini-browser or live iframe (Feature 3.5).

3. **Same-source reuse** — Clicking different citations that point into the *same* document re-highlights and re-scrolls without re-fetching or re-rasterizing, so navigating between citations in one source is instant.

#### Design Decisions

- **Render the source, not a paraphrase.** The point of the sidecar is to show the user the actual document with the actual evidence highlighted, so they can judge it themselves.
- **Fetch content lazily.** Citation metadata stays small (it rides the stream); heavyweight source content is only loaded when the user opens it.

---

### Feature 3.3: Jump to Bounding Box (PDF)

#### What It Does

For a PDF citation, scrolls to the cited page, draws a highlight rectangle over the exact cited region, and centers it in view — mapping the stored page-space box onto the live, zoomable canvas.

#### How It Works

1. **Client-side rasterization** — The viewer renders each PDF page to its own canvas, fit to the panel width and multiplied by a user zoom. Each page records its rendered scale and natural dimensions.

2. **Box → pixels** — A stored box (in page points) is converted to CSS pixels against the page's current scale. The vertical origin is resolved per box: bottom-left origin boxes are flipped using the stored page height; top-left origin boxes are used directly. Values are validated, normalized, and clamped before drawing.

3. **Overlay + scroll** — Highlight overlays are absolutely-positioned divs over the page (translucent fill, no pointer capture). The first highlight is scrolled to the center of the viewport (so a footnote near a page edge stays visible).

4. **Decoupled redraw** — Switching citations within the same PDF redraws overlays and re-scrolls *without* re-rasterizing the pages. Zooming captures and restores the reading position so it doesn't snap back to the citation.

5. **Whole-page and no-box fallbacks** — If the citation has a page but no box, the viewer shows the page with a banner ("Cited on page N; highlight unavailable"). If there are no boxes *and* an extracted-text render exists, the viewer auto-switches to the Text view (Feature 3.4), since text search is more reliable than coordinates in that case.

#### Design Decisions

- **Reconcile geometry at render time.** Because the box, origin, and page dimensions were stored raw (Feature 1.2), the viewer can map them onto whatever scale it is currently displaying.
- **Center, don't top-align.** Centering keeps edge-of-page evidence (footers, footnotes) visible.

---

### Feature 3.4: Text Highlighting for Non-PDF Sources

#### What It Does

For extracted text, markdown, office docs, workspace files, and web snapshots, locates the cited quote in the *rendered* content and highlights it — robust to markdown formatting, tables, and elided quotes.

#### How It Works

1. **Match against rendered DOM, not raw text.** Highlighting walks the rendered text nodes and builds a character index, so it never depends on character offsets from the original markdown (which the rendered HTML doesn't preserve).

2. **Normalization** — Both the rendered text and the cited quote are normalized: whitespace runs collapsed, smart quotes/dashes folded to ASCII. A back-index maps normalized positions to original DOM positions.

3. **Tolerant variants** — The cited quote is matched in several forms: raw, table-row-flattened (so a stored markdown table row matches a rendered HTML table), and fully markdown-stripped. It also strips the chunker's synthetic "(Part N)" headings so split spans still match.

4. **Elided quotes** — A quote containing an omitted-text marker (`[...]`) is split into segments matched in order, so summarized quotes still highlight each piece.

5. **Best-effort, with status** — The first match is wrapped in a highlight and scrolled to center. If nothing matches, the panel reports "not found," auto-expands the metadata drawer, and shows the cited passage as text. Matching is exact/normalized/segmented — there is no edit-distance fuzzy fallback.

#### Design Decisions

- **Verbatim text matters here.** This is exactly why chunks keep a verbatim source face (Feature 1.4) — so the quote the model copied is findable in the rendered source.
- **Degrade visibly, not silently.** A missed highlight surfaces the cited passage and a "not found" notice rather than failing quietly.

---

### Feature 3.5: Web Source Preview (Snapshot vs Live)

#### What It Does

Renders a web citation as the captured snapshot by default (highlightable, faithful to what the model read) with a one-click toggle to the live page.

#### How It Works

1. **Snapshot view (default)** — The stored snapshot is rendered as a mini-browser: a faux address bar plus the captured page content on a light "page," with the cited passage highlighted via the same text highlighter (Feature 3.4). A "captured at" timestamp is shown.

2. **Live view (opt-in)** — Switching to live renders the original URL in a sandboxed iframe with a best-effort warning and an "open in new tab" action. No highlighting is applied in live mode (cross-origin content is inaccessible). PDF URLs are special-cased to an "open in new tab" card, since browsers block PDFs in iframes.

3. **Link-only fallback** — If no snapshot was captured (a snippet-only result), the snapshot view shows the cited quote plus a link to the original.

#### Design Decisions

- **Snapshot first because it's the evidence.** The live page may have changed; the snapshot is what the answer was actually based on, and it's the only thing that can be highlighted.

---

## Part 4: Check Citations (On-Demand Grounding)

Quick citations are grounded by construction (the model can only cite what it was shown) but not *verified* — nothing yet confirms the cited source actually supports the specific claim. Check Citations is the optional, user-triggered verification pass that closes that gap.

### Feature 4.1: The Check Citations Action

#### What It Does

Adds a **Check citations** action under any finished answer that has citations. Running it grades every citation against its source and recolors the inline chips with the verdict. Results persist, so the action becomes "Re-check" and survives reload.

#### How It Works

1. **Where it lives** — An action row under each assistant message offers **Copy** and (when the message has citations) **Check citations**.

2. **States** — The button moves through idle ("Check citations") → running (disabled, spinner, "Checking…") → done. On success it becomes "Re-check citations" with a success indicator; on error it becomes "Retry check" with the error in its tooltip. It is disabled while a response is still streaming.

3. **Per-message, all-or-nothing** — Running a check grades all of the message's citations and flips the message into the "checked" state; a message is either Quick or Checked, not a mix.

#### Design Decisions

- **On demand, not automatic.** Verification costs an extra model pass, so it is paid only when the user asks — keeping the default fast and cheap while making rigor one click away.

---

### Feature 4.2: Grounding Verifier

#### What It Does

For each citation, runs a focused verification: does the cited source support the cited claim? It grades co-cited markers together against the union of their sources and returns a structured verdict per claim.

#### How It Works

1. **Separate verifier pass.** Check Citations is a distinct pass that runs on demand. It uses a **utility model** (the same lower-cost tier used for metadata/title work), not necessarily the primary chat model. It **trusts and grades the model's existing markers** — it does not rewrite the answer or re-author citations.

2. **Claim grouping** — Adjacent markers separated only by whitespace are treated as one **co-citation claim** and graded once against the combined sources, so co-cited sources are judged collectively (one source isn't penalized for omitting a detail another supplies).

3. **Windowed excerpts** — For each claim the verifier assembles two bounded excerpts:
   - the **generated** excerpt: a window of the answer around the cited marker run, with the cited run flagged; and
   - the **source** excerpt: a window of the cited source around the cited span, with that span flagged. The exact span is located by offset, then by quote substring, then by stored quote fallback.

4. **Structured verdict** — The model returns a constrained, structured verdict — a status, a support score, and a one-line problem note — at zero temperature, with bounded concurrency and a per-call timeout.

5. **Persist and recolor** — Each verdict is written back to the citation, the message is marked "checked," and the chips recolor. Results survive reload.

#### Design Decisions

- **Grade the markers; don't re-derive them.** The model already cited grounded spans; the verifier's job is to judge support, not to re-author citations — which keeps it simple, stateless, and non-streaming.
- **Anchor the judgment.** Flagging the exact cited span in the source and the cited sentence in the answer keeps the verifier focused on entailment rather than whole-document relevance.

---

### Feature 4.3: Verdict Taxonomy & Status Surfacing

#### What It Does

Categorizes each citation's support level and reflects it through chip color, the hover popover, and the source panel — all persisted.

#### How It Works

1. **Verdict categories** —
   - **Supported** — the source clearly supports the whole claim.
   - **Partially supported** — only part is supported, or support is weak/indirect.
   - **Not supported** — the source contains no support.
   - **Contradicted** — a source conflicts with the claim.
   - **Verification failed** — a defensive status assigned when a source can't be retrieved, the verifier errors, or it isn't configured (so a complete verdict set is always returned).

2. **Surfacing** — Status drives chip color everywhere; the popover shows the one-line problem note (red for contradicted, amber otherwise); the source panel badge shows the status. There is no separate verification panel — color plus the problem note carry the result.

3. **Quick vs Checked labeling** — In the default (Quick) state, chips are labeled as unverified and a "supported"-looking color is not shown; the supported/contradicted colors only appear after a check pass. The mode label distinguishes "Quick Citation" from "Checked Citation."

#### Design Decisions

- **Don't imply verification that didn't happen.** A Quick citation is never colored as "supported"; that state is reserved for citations a check pass actually confirmed.

---

### Feature 4.4: Copy (Clean Answer Text)

#### What It Does

A Copy action that copies the answer text with all citation markers stripped, so users can paste a clean answer elsewhere.

#### How It Works

1. The answer text is copied with marker tokens removed (matching the same marker grammar used everywhere else), with a brief "Copied" confirmation. It is independent of verification state.

---

## Cross-Cutting Concerns

### Security & Data Isolation

- All citation-related stores (per-message citations, the per-thread citation registry, web snapshots, document layout) are owner-scoped via Row-Level Security — users only ever see citations, snapshots, and source content for their own data.
- Source content fetches (signed URLs, snapshots, file reads) go through the same ownership checks as the rest of the platform.
- The live-page iframe is sandboxed and served with a no-referrer policy.

### SSE Streaming

- Citations ride the existing response stream as additional event types (a lightweight alias event, full-citation upgrade events, and an authoritative end-of-turn metadata event). Transport is unchanged — these are new payloads inside the existing streaming response.

### Model Provider Compatibility

- The primary chat model only needs to follow the citation prompt and copy markers — any capable model works.
- The verifier uses an OpenAI-compatible structured-output call and can run on a separate, cheaper provider/model from the chat model. Provider selection is configuration, not code.

### Observability

- The verification pass is traceable in the observability stack, so checks can be inspected like any other model call.

### Best-Effort Principle

- Every citation step is wrapped so failure degrades gracefully: a span that can't be marked still cites at the cursor; an invalid marker is stripped; an unlocatable quote shows a "not found" notice; a missing snapshot falls back to a link; a verifier failure yields "verification failed." None of these ever break a tool call or the chat stream.

### Backfill & Re-Ingestion

- Layout, render metadata, and verbatim citable text are populated for **new** ingestions. Documents ingested before this episode preview and text-highlight normally but gain precise bounding-box highlights and verbatim-matchable quotes only after re-ingestion.

---

## Data Model

Described by role; names are illustrative — adapt to your own schema.

| Store | Purpose |
|-------|---------|
| **Document render metadata** | Per-document: full markdown, per-page markdown, and the clickable structure outline. Drives the Text view and structure navigation. |
| **Document layout metadata** | Per-document: the highlight payload — text items with page number, bounding box, coordinate origin, and char span, plus per-page dimensions and the coordinate system. Drives PDF bounding-box highlights. |
| **Chunk verbatim source text** | Per-chunk: the pre-enrichment verbatim slice used for quoting/citation, alongside the enriched content used for retrieval. |
| **Citations** | One row per cited span on a message: deterministic citation id, display number/marker, source identity (type, title, document/web/workspace reference, content type), the resolved target (kind, exact quote, char offsets, and for PDFs page + bounding boxes), the verdict status, support score, and problem note. Owner-scoped. |
| **Thread citation registry** | Per-thread map of span → assigned display number (and span metadata), so numbering is stable across turns and reloads. |
| **Web snapshots** | Per cited web source: the cleaned point-in-time page content, content type, and capture time. De-duplicated per source. Owner-scoped. |
| **Message verification mode** | Per message: whether its citations are Quick (unverified) or Checked. |

---

## Configuration

Reference knobs; names and defaults are illustrative.

| Area | Knob | Purpose |
|------|------|---------|
| Citations | Enable inline (Quick) citations | Master switch for evidence marking. |
| Citations | Max markers per turn | High runaway backstop (normal use is uncapped). |
| Verification | Check model | Model used by the Check Citations pass (defaults to the utility model). |
| Web search | Provider / API key | Web search backend. |
| Web search | Include raw page content | Whether to capture full-page snapshots. |
| Web search | Max snapshot size | Cap on stored snapshot length. |
| Ingestion (OCR) | OCR mode + readability thresholds | Auto/always/never OCR and the preflight thresholds. |
| Ingestion (perf) | Device / batch / table mode | Extraction throughput tuning. |
| Ingestion (safety) | Concurrency / page-pixel caps / process isolation | Memory and crash guardrails. |

---

## Citation Lifecycle (End to End)

1. **Ingest** — A document is extracted with layout: full + per-page markdown, structure outline, and a layout payload of text items with boxes, origins, and page dimensions. Chunks are stored with both an enriched (retrieval) face and a verbatim (citation) face.
2. **Retrieve** — A tool fetches relevant chunks (or web results). The verbatim text is split into spans; each span is registered and assigned a thread-stable number.
3. **Mark** — A marker is inserted before each span, in place, in the single copy the model reads. Non-citable tool outputs are scrubbed of markers.
4. **Answer** — The model writes its answer, copying markers to cite. Chips light up from the lightweight alias stream; cited markers upgrade mid-stream to carry full quote + location.
5. **Finalize** — Invalid markers are stripped, near-misses normalized, PDF targets enriched with page + boxes, web snapshots persisted for cited pages, and the authoritative citation set is saved with the message.
6. **Preview** — The user hovers a chip (popover) and clicks (sidecar). The sidecar fetches the source lazily and jumps to the evidence: a bounding box on a PDF page, a text highlight in extracted text/office/web, scrolled to center.
7. **Check (optional)** — The user runs Check Citations. Each claim (co-cited markers grouped) is graded against its source via a structured verifier pass. Chips recolor with the verdict; results persist and survive reload.

---

## Phased Delivery

| Phase | What |
|-------|------|
| Ingestion geometry | Layout-aware extraction, bounding boxes + page geometry, render/structure/layout persistence |
| Ingestion robustness | Machine-readability preflight, OCR + text-layer fallbacks, memory/pixel guardrails, page-range windowing |
| Verbatim citable text | Dual-face chunks (enriched index face + verbatim source face); retrieval returns the verbatim face |
| Evidence marking | Marker grammar, deterministic span splitting, in-place additive labeling, citation system prompt |
| Universal citable context | Uniform marking across all sources; non-citable scrubbing; remove per-source caps |
| Identity & consistency | Two-layer identity, deterministic citation ids, thread-stable numbering, validation/normalization |
| Streaming delivery | Lightweight alias stream, mid-stream full-citation upgrade, authoritative end-of-turn metadata |
| Web citations | Web span labeling, snapshot capture, persist-only-cited, snapshot/live viewer |
| Rendering | Inline chips + progressive disclosure, document sidecar, PDF box highlight, non-PDF text highlight |
| Check Citations | Action + states, grounding verifier, verdict taxonomy, status surfacing, persistence |

---

## Post-MVP / Future

- **Deterministic char-offset highlighting** — store the source once and highlight by exact offset slice instead of text-matching, eliminating "not found" misses.
- **Fuzzy highlight fallback** — edit-distance matching when normalized exact matching fails.
- **Precise boxes for office formats** — bounding-box highlights for DOCX/PPTX, not just PDFs and OCR'd images.
- **Support-score thresholds** — surface or gate on the numeric support score (e.g. auto-flag low-confidence citations).
- **Automatic / background checking** — optionally run Check Citations automatically for sensitive answers.
- **Cross-document evidence clustering** — group citations by source in a dedicated evidence panel.
