# Episode 7 — Planning Agent Handoff (Citations & Source Grounding)

You are the **planning agent for Episode 7**. Your job is to help brainstorm and **finalize a
working model**, then produce **phased plans** (Ep7A / Ep7B — see below) for handoff to
execution agents. You are **not** implementing, and you are **not** porting the reference PRD.
Ep7 for us is substantially a **unification + rendering + verification** episode, not a
build-from-scratch one — verify what already exists before designing anything.

---

## Required reading (source of truth — read before responding)

1. **`.planning/INTELLIGENCE-LAYER-ARCHITECTURE.md`** — surfaces, four-tier knowledge layer,
   two-layer wiki, write-ownership (OS Engine sole writer), the "everything is traceable"
   constraint.
2. **`.planning/INTELLIGENCE-LAYER-EPISODE-MAP.md`** — your primary reference. Read **Section 4
   → Episode 7 including the "Episode 7 Refinement" block**, and locked decisions **L8, L9,
   L11, L22–L25** (§5).
3. **`docs/plans/ep7-citations/PRD-Citations.md`** — the reference machinery (evidence markers,
   streaming delivery, sidecar rendering, Check Citations). **Reference, not blueprint.**
4. **The wiki layers (already built in isolation, citation-ready):**
   - Tier 1: `.planning/wiki-system/` — `ROADMAP.md`, `phases/02-interface-contract/02-01-CONTRACT.md`
     (claims-with-line-level-evidence model).
   - Tier 2: `.planning/document-wiki/phases/02-page-contract-schema/02-01-CONTRACT.md`
     (`doc-wiki-1.0`: `source_file_ids[]`, inline `[[Source:…]]`, `agent_result_v1` +
     `AgentSourceRef[]`).

The older `.planning/INTELLIGENCE-VISION.md` is **superseded** — do not use it.

---

## The reframe

The reference builds citations from scratch. **We mostly don't need to.** The platform has
already converged on a source-ref shape, and the wiki layers already emit structured
citations. So Ep7 is three things: **(1) unify** the existing source-ref/evidence shapes into
one citation currency, **(2) build the rendering + verification UX** on top, and **(3) add
Tier 3 ingestion geometry only where document-rectangle highlighting is actually needed.**

## Wiki-layer reality (verify live, but this is the scoping picture)

- **Tier 1 (wiki-system):** build-complete in isolation; every compiled claim carries
  line-level evidence (`path/lines/weight/note`) + a trust class.
- **Tier 2 (document-wiki):** complete in isolation; pages carry `source_file_ids[]` +
  machine-parseable inline `[[Source: raw_document:{id}#chunk:{id}|…]]`; read tools return
  `agent_result_v1` with first-class `AgentSourceRef[]`.
- **Gap:** the cross-tier **connection phase** (retrieval router + wiring the wiki into the
  surfaces) is a separate, partly-built workstream (KB Explorer Phases 8–9 did the Layer-1
  mirror + a basic VCSO router). **Ep7 consumes what it exposes; Ep7 does not build it (L24).**

## Locked decisions to honor

- **L22 (one citation currency).** Unify on the existing `AgentSourceRef` / `agent_result_v1`
  shape (already emitted by the wiki read tools, the Ep5 registry `ToolSourceRef`, and Ep6
  `source_refs`). Normalize Tier 2 inline `[[Source:]]` and Tier 1 claim-evidence into it.
  Layer the reference's marker/streaming/rendering UX **on top** — do **not** stand up the
  reference's parallel per-message citations store.
- **L23 (source-kind readiness).** Tier 0 record (deterministic typed resolver, no geometry) ·
  wiki page (existing shape, resolves to page, no geometry) · document chunk (source-ref
  exists; bounding-box + verbatim geometry is net-new) · web (snapshot). The citation layer is
  **tier-complete by construction** — any source that reaches an answer is citable.
- **L24 (consume, don't build the connection phase).** Don't build the retrieval router or
  block on it.
- **L25 (phasing).** **Ep7A** = unify currency + rendering + Check-Citations verification +
  non-geometry resolvers (chunk / wiki page / Tier 0 record / web). **Ep7B** = Tier 3 ingestion
  geometry (layout, bounding boxes, verbatim source face) for pixel-precise PDF highlighting.
- **L8** citations resolve to all four tiers · **L9** one provenance mechanism for chat + wiki
  (preferred, not forced) · **L11** curated trace / no raw chain-of-thought (applies to how
  verification and evidence surface).

## Reuse-before-create (audit these before designing)

The substrate is far along. Verify and build on:
- `AgentSourceRef` / `agent_result_v1` (wiki read tools: `docwiki_get_page/search/list`,
  `wiki_get_page/search`) — the citation currency to unify on.
- Ep5 registry `ToolSourceRef` (`tool_registry.py`) — tool results are already citation-ready.
- Ep6 `source_refs` carried in `tasks.step_results` and `artifacts.provenance` — Ep6 was built
  Ep7-ready; citations should layer on without re-plumbing.
- Tier 2 inline `[[Source: raw_document:{id}#chunk:{id}]]` and Tier 1 claim-evidence — the
  shapes to normalize into the currency.

## Decision points to work through (brainstorm before plans)

1. **Currency normalization design** — the concrete mapping of the three+ existing shapes
   (`AgentSourceRef`, inline `[[Source:]]`, Tier 1 claim-evidence, `ToolSourceRef`,
   `source_refs`) into one citation object with a `source_kind` discriminator (chunk / wiki_page
   / platform_record / web).
2. **Marking vs. source-ref.** The reference marks spans *in the model's context* and has the
   model copy markers. We already have structured source-refs coming back from tools/wiki. Decide
   how much in-context span-marking we still need vs. citing directly from tool source-refs — this
   is the core architectural reconciliation of Ep7A.
3. **Tier 0 record resolver** — how a platform record (MRA result, sprint state) is rendered as
   a viewable cited source (table/row/field → rendered record).
4. **Check Citations verifier** over the unified currency — reuse a utility model (L12); grade,
   don't re-author.
5. **Verify what the connection phase currently exposes** (Phases 8–9) so Ep7A knows which
   source-kinds actually reach an answer today vs. light up later.
6. **Ep7B ingestion geometry** — what Docling/ingestion changes capture layout + bounding boxes
   + a verbatim source face; confirm forward-only (no users, no backfill — but sequence it before
   scale uploads).

## Dependencies & sequencing

- Ep7 comes **before** the §8 front-end/UX audit; its citation rendering (chips, sidecar,
  jump-to-evidence) is built functionally here, with visual polish folded into §8.
- Ep6 is Ep7-ready (source_refs carried) — no re-plumbing expected.
- The Ep5/§8 live-credential verification debt is not a gate (L18); it rolls into the
  consolidated smoke phase.

## Your task & output

1. **Brainstorm and finalize the working model** — resolve/ frame the decision points above,
   honoring L22–L25.
2. Produce **phased plans (GSD)** split as **Ep7A** and **Ep7B**, each phase naming its backend
   wiring **and** its surface manifestation (VCSO citation UX; Domain Agents artifact-library
   rendered views; OS Engine ingestion for Ep7B).
3. Surface **what still needs brainstorming vs. decided**, and **flag any conflict** with the
   locked decisions or the wiki contracts rather than resolving it silently.

## How to work

- Map to **our reality** (unify existing shapes) — do not port the reference's parallel model.
- Plan **surface + backend together**; functional citation UX now, visual polish in §8.
- **Reuse before create**; verify the wiki tools, registry, and Ep6 source_refs before designing.
- Go **one source-kind / capability at a time**; settle the currency normalization first, since
  everything else depends on it.
