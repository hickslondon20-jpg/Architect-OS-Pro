# Episode 7 — Citations & Source Grounding: Phased Roadmap (GSD)

> Ep7 planning agent, 2026-07-06. Companion to `CONTEXT.md` (the locked-decisions ledger — read that first).
> Split per L25: **Ep7A** = unify currency + rendering + Check-Citations + non-geometry resolvers.
> **Ep7B** = Tier 3 ingestion geometry (bounding boxes, verbatim source face, PDF highlighting).
> Each phase names its **backend wiring** and its **surface manifestation**. Functional citation UX
> is built here; visual polish folds into the §8 front-end pass.
>
> Handoff model: one execution agent per phase, in a new thread, pointed at this file + `CONTEXT.md`
> + the two frozen contracts. Settle Phase A0 (currency) before anything else — all phases depend on it.

---

## Dependency graph

```
A0 (currency + adapters)  ──┬──▶ A1 (collection + turn binding) ──▶ A3 (VCSO citation UX) ──┐
                            ├──▶ A2 (four resolvers) ───────────────┴──────────────────────┼──▶ A6 (smoke + acceptance)
                            │                                        A4 (Check Citations) ──┤
                            └──▶ A5 (Domain Agents artifact citations) ─────────────────────┘

B0 (ingestion geometry) ──▶ B1 (geometry resolver) ──▶ B2 (PDF highlight surface) ──▶ B3 (acceptance)
      (B-series depends on A2's chunk resolver; otherwise independent of A3–A6)
```

---

# Ep7A — Unify + Render + Verify (non-geometry)

## Phase A0 — Citation currency + normalization adapters
**Goal.** One currency (`CitationRef` / `citation-1.0`) and adapters that converge all seven producer
shapes into it. This is the keystone; nothing else starts until it lands.

**Backend wiring.**
- New `python-backend/services/citations/` package: `models.py` (`CitationRef`, `Locator`, `SourceKind`
  family map + `raw_source_kind` preservation), `normalize.py` (adapters: `from_agent_source_ref`,
  `from_tool_source_ref`, `from_docwiki_citation`, `from_wiki_evidence`, `from_retrieved_chunk`,
  `parse_inline_source_marker`, `from_vcso_stream_ref`, `from_provenance_ref`).
- Taxonomy map table (raw → family) with `raw_document_chunk→document_chunk`,
  `tier0_record/founder_dataset/dataset_row/global_checkpoint→platform_record`, etc. (CONTEXT §3.1 DP1, §3.2).
- Append a `citation-1.0` **additive amendment note** to `wiki-system/…/02-01-CONTRACT.md` and
  `document-wiki/…/02-01-CONTRACT.md` (F1) — new optional fields only; do not mutate frozen shapes.

**Surface manifestation.** None (pure backend foundation).

**Reuse.** `AgentSourceRef` (agent_context.py), `ToolSourceRef` (tool_registry.py), the docwiki/wiki
read-service citation builders, `retrieval.RetrievedChunk`.

**Acceptance.** Golden tests: each of the 7 producer shapes → expected `CitationRef`; taxonomy map is
exhaustive over the union taxonomy (CONTEXT §2); round-trip stable; raw kind preserved in metadata.

**Resolves/needs:** O4 (confirm artifact render surface for A5 wiring). Depends on: nothing.

---

## Phase A1 — Turn collection + answer-span binding
**Goal.** Collect a turn's `CitationRef[]` once, and bind answer spans to them source-ref-first
(CONTEXT §3.1 DP2).

**Backend wiring.**
- Normalize the orchestrator's existing `all_sources` collection into `CitationRef[]` via A0 adapters.
- Binding: ordinal-id map (answer references `[n]` → `CitationRef`); `parse_inline_source_marker` handles
  the verbatim-quote escape hatch only.
- Replace `vcso_chat_service` stream `source_refs` `{kind,label,pageId}` with `CitationRef` events (F4).

**Surface manifestation.** VCSO stream now emits unified citations (frontend chip source, Phase A3).

**Reuse.** `vcso_chat_service._build_context` / `all_sources`, `sub_agent_orchestrator` result citations.

**Acceptance.** A VCSO turn that reads a chunk + a wiki page + a Tier 0 record streams three
`CitationRef`s with correct families; verbatim quote binds to the right chunk.

**Resolves/needs:** **O3 design spike (binding mechanism) at phase top.** Depends on: A0.

---

## Phase A2 — Four resolver families (chunk / wiki_page / platform_record / web)
**Goal.** Turn a `CitationRef` into a renderable source view. One resolver per tiered family.

**Backend wiring.**
- `services/citations/resolvers/`: `chunk_resolver` (verbatim + `locator.lines`, **no geometry** yet),
  `wiki_resolver` (page/claim → prose + claim evidence), `platform_record_resolver` (DP3 typed-renderer
  registry: MRA / AE Ladder / sprint / Quarter Map / Clarity Compass / Reflection Review → field table +
  deep-link), `web_resolver` (snapshot; **ships dark** per O2).
- `POST /api/citations/resolve` FastAPI endpoint (owner-scoped) returning the rendered source view.

**Surface manifestation.** Resolve endpoint the sidecar calls (Phase A3).

**Reuse.** `retrieval` + `kb_read` for chunks; `wiki_read`/`docwiki_read` for wiki; structured dataset
query service for Tier 0.

**Acceptance.** Each live family resolves a real ref to a viewable payload; unresolvable refs return a
typed error, never a fabricated source. `web` returns "no producer" cleanly (O2).

**Resolves/needs:** O1 (derived kinds render-as-trace vs chip), O2 (web scope). Depends on: A0.

---

## Phase A3 — Virtual CSO citation UX (functional)
**Goal.** The user-facing citation experience: chip → sidecar → jump-to-evidence.

**Backend wiring.** None new (consumes A1 stream + A2 resolve endpoint).

**Surface manifestation.** Inline citation chips on answers; source-preview sidecar (calls
`/api/citations/resolve`); jump-to-evidence scrolls to `locator.lines`/section/record field. **Functional,
not polished** — visual design deferred to §8 (F4 coordination).

**Reuse.** Existing VCSO message/stream React components.

**Acceptance.** Click a chip → sidecar shows the resolved source with the cited span highlighted (line-
level for chunks/wiki, field-level for Tier 0). Derived kinds render per O1 decision.

**Depends on:** A1, A2.

---

## Phase A4 — Check Citations verifier
**Goal.** On-demand grading of an answer's citations against their resolved sources (DP4).

**Backend wiring.**
- `services/citations/verify.py`: utility-model grader (model via registry, cheap tier, **never** the
  conversation model — L12). Per-citation verdict `{supported|partial|unsupported|unresolvable}` + overall.
- `POST /api/citations/check` taking a turn/answer id → verdicts. Reuses A2 resolvers for source fetch.

**Surface manifestation.** "Check Citations" action in VCSO; per-chip verdict badge + summary verdict
(curated, no raw CoT — L11).

**Acceptance.** A planted unsupported claim grades `unsupported`; a faithful quote grades `supported`;
grader output is a verdict only, never a rewrite.

**Depends on:** A2 (A1 for turn refs).

---

## Phase A5 — Domain Agents artifact citations
**Goal.** Artifacts become auditable — the artifact-library rendered view shows its citations.

**Backend wiring.** Minimal — `artifacts.provenance.source_refs` are already CitationRef-shaped after
A0/A1 (Ep6 carried them). Add a read/normalize pass if any legacy provenance predates A0.

**Surface manifestation.** Artifact-library rendered view renders citation chips + sidecar, reusing the
A3 components and A2 resolvers.

**Reuse.** `artifact_service._domain_artifact_provenance` (`domain_agent_artifact_provenance_v1`),
Ep6 `harness_engine` source_refs, A3 components.

**Acceptance.** An artifact produced by the Monthly-P&L anchor workflow (L15) renders each figure/claim's
citation, resolvable to source. Confirms O4 render surface.

**Depends on:** A0, A2, A3.

---

## Phase A6 — Ep7A smoke + acceptance
**Goal.** End-to-end proof across every lit source-kind, plus the folded-in debt.

**Backend + surface.** Scripted E2E: for each live family, a real query → chip → sidecar → resolved view →
Check Citations verdict, in both VCSO and an artifact view. Fold in the L18 Ep5/§8 live-credential
verification debt as the consolidated smoke (per handoff — not a gate, rolls in here).

**Acceptance.** Matrix (family × surface) green for lit families; dark families (`web` per O2) explicitly
marked pending-producer, not failing. Update `Pro-Suite-Progress.md`.

**Depends on:** A3, A4, A5.

---

# Ep7B — Tier 3 ingestion geometry (follow-on, not a blocker)

## Phase B0 — Ingestion layout + verbatim capture
**Goal.** Capture per-chunk geometry at ingestion, forward-only (DP6).

**Backend wiring.** Extend the ingestion pipeline (Docling or current processor) to emit `page_number`,
`bbox`, and the `verbatim` source face per chunk. New `document_chunks` columns (`page_number int`,
`bbox jsonb`, `verbatim text`). **No backfill (L10); sequence before OS Engine bulk-upload GA.**

**Surface manifestation.** OS Engine ingestion (no user-facing UI change yet).

**Acceptance.** A newly ingested PDF yields chunks with valid `page_number` + `bbox` + `verbatim`; OCR-only
/ geometry-less pages degrade gracefully (null geometry, still citable line-level).

**Depends on:** A0 (Locator already has `page_number`/`bbox` fields).

---

## Phase B1 — Geometry-aware chunk resolver + verbatim face
**Goal.** Extend A2's chunk resolver with a geometry branch.

**Backend wiring.** Chunk resolver returns `locator.bbox` + `page_number` + `verbatim` when present; falls
back to A2 line-level behavior when absent (older docs).

**Surface manifestation.** Resolve endpoint now returns geometry for forward-ingested docs.

**Acceptance.** Resolver returns pixel-box for a B0-ingested chunk; graceful fallback for a pre-B0 chunk.

**Depends on:** B0, A2.

---

## Phase B2 — PDF highlight rendering
**Goal.** Pixel-precise source face — jump-to-evidence lands on the rectangle.

**Surface manifestation.** Sidecar renders the PDF page with the `bbox` highlighted, in **both** VCSO and
the Domain Agents artifact view. Visual polish still coordinates with §8.

**Acceptance.** Clicking a chip for a geometry-capable chunk shows the PDF page with the exact rectangle
highlighted.

**Depends on:** B1, A3 (+ A5 for artifact surface).

---

## Phase B3 — Ep7B acceptance
**Goal.** Confirm the geometry path end-to-end on forward-ingested documents.

**Acceptance.** Ingest → chunk geometry → resolve → highlighted PDF rectangle verified; sequencing note
confirmed (Ep7B live before bulk-upload GA). Update `Pro-Suite-Progress.md`.

**Depends on:** B2.

---

## Open items carried into execution (from CONTEXT §4)
- **O1** (A2/A3): derived operational kinds — citation chips or trace-only? Lean trace-only. Confirm.
- **O2** (A2/A6): `web` resolver dark vs. descoped. Lean build-dark.
- **O3** (A1): answer-span↔citation binding — spike at A1 top.
- **O4** (A0/A5): confirm the artifact-library render surface for provenance display.

## Contract-touch note (CONTEXT §5, F1)
Phase A0 appends an additive `citation-1.0` amendment to both frozen wiki contracts. Additive-only
(new optional fields). Do **not** edit the frozen shapes in place.
