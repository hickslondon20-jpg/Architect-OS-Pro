# Plan A5-01 — Domain Agents artifact citations

**Sub-phase:** A5 — Domain Agents artifact citations
**Plan:** 1 of 1
**Depends on:** A0 (currency + `from_provenance_ref`), A2 (resolvers + endpoint), A3 (chip/sidecar components)
**Status:** Ready for execution — **O4 resolved** (render surface + plumbing gap, CONTEXT §8, 2026-07-06).
**Decisions:** `../../CONTEXT.md` §3.3, §4 O4 (resolved) · **Ref:** Ep6 provenance + reuse of A2/A3

---

## Goal

Make Domain Agent artifacts **auditable** — the artifact-library Preview shows each artifact's citations,
resolvable to source. **Not just render:** `provenance.source_refs` is persisted on the artifact row but not
delivered to the frontend (O4 gap), so A5 plumbs provenance through delivery, then renders.

## Pre-Execution Checks
1. Read `RESEARCH.md` (this folder) — the render surface, the delivery-path gap with anchors, the reuse map.
2. Confirm the artifact `source_refs` shape on the row (`domain_agent_artifact_provenance_v1`) and that
   `from_provenance_ref` (A0) normalizes it to `CitationRef`.

## Build
- **Backend plumb (do first).** Add `provenance` (or `provenance.source_refs`) to `ArtifactDeliveryResult`
  (`artifact_service.py:31–43`) + `get_delivery` (read from the row, `:218–229`) + the `/api/artifacts/{id}`
  response model (`ArtifactDeliveryResponse`, `get_current_user_id`). **Normalize** the stored `source_refs` to
  `CitationRef` via A0 `from_provenance_ref` at read time (they come from `harness_engine result.citations`).
- **Frontend render.** Add `provenance`/citations to `ArtifactDelivery` (`lib/artifactsApi.ts:6`); in
  `DomainAgentArtifacts.tsx` Preview panel (~`:177–195`), render a **citations rail + resolvable chips** reusing
  the **A3 chip/sidecar components** (`CitationReaderBody`) and the **A2 resolve endpoint**.
- **Inline markers (if present).** If an artifact body contains `[[Source:]]`/`[n]` markers, bind them like A3;
  otherwise the provenance `source_refs` rail is the citation surface. Artifact citations are **static
  provenance** (no A1 turn loop / no streaming).
- **Derived → not shown as chips** (O1 consistency) — a `derived` provenance ref isn't a citable chip.

## Surface manifestation
**Domain Agents** — the artifact-library Preview shows citations (rail + chips + sidecar), same UX as VCSO,
reusing A3 components + the A2 resolve endpoint. Functional; visual polish → §8.

## Success criteria
1. An artifact from the Monthly-P&L anchor workflow (L15) delivers its `provenance.source_refs` (CitationRef-shaped)
   through `/api/artifacts/{id}` and renders a citations rail in the Preview.
2. Chips resolve to source via the shared A2 resolvers (chunk / wiki / Tier 0); sidecar reuses `CitationReaderBody`.
3. Inline `[[Source:]]`/`[n]` in an artifact body bind like A3 when present.
4. Legacy/no-provenance artifacts degrade gracefully (no citations, no error); `derived` refs not shown as chips.
5. `compileall` 0; backend delivery test green; frontend builds.

## Out of scope
New provenance capture (Ep6 already does it); verification of artifact citations (reuse A4 if wired later);
geometry (Ep7B); visual polish (§8).
