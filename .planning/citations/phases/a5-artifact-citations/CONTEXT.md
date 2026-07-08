# Sub-phase A5 Context — Domain Agents Artifact Citations

**Date:** 2026-07-06
**Outcome:** Ready to execute. **O4 resolved** (render surface + the provenance-plumbing gap, CONTEXT §8). The
execution agent makes implementation choices only, not design choices.

---

## What this sub-phase is

Makes Domain Agent artifacts **auditable** — the artifact-library Preview shows each artifact's citations,
resolvable to source. Because `provenance.source_refs` is persisted on the artifact row but **not delivered** to
the frontend, A5 **plumbs provenance through the delivery path first, then renders** it reusing A2 resolvers + A3
components. Single deliverable: **A5-01** (see `A5-01-PLAN.md`).

---

## Inputs the agent must read first (in order)

1. `RESEARCH.md` (this folder) — **primary build source.** The plumbing gap (§1), provenance origin (§2), the
   render surface (§3), the reuse map (§4), the static-vs-streamed differences (§5), scope (§6).
2. `A5-01-PLAN.md` (this folder) — task (plumb-first) + criteria.
3. `../../CONTEXT.md` — locked ledger. §3.3, §4 O4 (resolved), §8 amendments (A0 `from_provenance_ref`; A2
   resolvers; A3 chip/sidecar; **A4 auth = `get_current_user_id`**). **CONTEXT wins on conflict.**
4. `services/artifact_service.py` (delivery path), `lib/artifactsApi.ts` (`ArtifactDelivery` + `getArtifact`),
   `pages/ProSuite/domain-agents/DomainAgentArtifacts.tsx` (render surface), `services/citations/normalize.py`
   (`from_provenance_ref`), the A3 chip/`CitationReaderBody` components, `services/citations/resolvers/` (A2).

---

## Decisions already made (do not re-open)

- **Render surface = `DomainAgentArtifacts.tsx` Preview panel** (O4).
- **Plumb before render** — provenance must be surfaced through `ArtifactDeliveryResult` → `/api/artifacts/{id}`
  → `ArtifactDelivery`; A5 is not a pure-frontend phase.
- **Normalize with `from_provenance_ref`** (A0) at read time — reuse, don't re-plumb Ep6.
- **Reuse A2 resolvers + A3 chip/sidecar** — no new resolver, no new reader.
- **Static provenance, not streamed** — number the stored `source_refs` at delivery/render time; no A1 turn loop.
- **`derived` provenance refs are not chips** (O1 consistency).
- **Functional only** — visual polish → §8.

---

## What this sub-phase does NOT do

- No new provenance capture (Ep6 owns it); no changes to `harness_engine`/artifact-creation provenance building.
- No verification of artifact citations (A4 is VCSO-scoped for now); no geometry (Ep7B).
- No new resolver / reader / retrieval; no visual/design polish.

---

## Files to create or modify

| File | Action | Notes |
|---|---|---|
| `python-backend/services/artifact_service.py` | Modify | Add `provenance`/`source_refs` to `ArtifactDeliveryResult` + `get_delivery`; normalize via `from_provenance_ref`. |
| `python-backend/main.py` | Modify | Add provenance/citations to `ArtifactDeliveryResponse` (`/api/artifacts/{id}`, already `get_current_user_id`). |
| `lib/artifactsApi.ts` | Modify | Add `provenance`/citations to `ArtifactDelivery`. |
| `pages/ProSuite/domain-agents/DomainAgentArtifacts.tsx` | Modify | Preview panel: citations rail + resolvable chips (reuse A3 components + A2 endpoint); bind inline markers if present. |
| `python-backend/tests/test_artifact_citations_a5.py` | Create | Delivery includes normalized `CitationRef[]`; legacy/no-provenance degrades; derived not chip. |

---

## Success criteria (A5-01)

1. A Monthly-P&L artifact (L15) delivers its `provenance.source_refs` (CitationRef-shaped) through `/api/artifacts/{id}`
   and renders a citations rail in the Preview.
2. Chips resolve via the shared A2 resolvers; sidecar reuses `CitationReaderBody`.
3. Inline `[[Source:]]`/`[n]` in an artifact body bind like A3 when present.
4. Legacy/no-provenance artifacts degrade gracefully; `derived` refs not shown as chips.
5. `compileall` 0; backend delivery test green; frontend builds.

---

## Handoff

When provenance is delivered + rendered as resolvable citations in the library, the strategy thread logs an A5
completion amendment in `../../CONTEXT.md §8`, then opens **sub-phase A6 (Ep7A smoke + acceptance)** — the
end-to-end matrix + the **consolidated live-DB apply pass** (CONTEXT §8 ledger).

*Context written: 2026-07-06 — Ep7 citations planning thread, at A5 sub-phase entry (O4 resolved).*
