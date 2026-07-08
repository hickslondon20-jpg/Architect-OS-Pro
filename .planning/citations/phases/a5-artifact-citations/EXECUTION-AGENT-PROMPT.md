# Citations (Episode 7) — Sub-phase A5 Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at
> `C:\Users\Hicks\ArchitectOS Pro_beta`. This session runs sub-phase **A5 only** (Domain Agents artifact
> citations). Do **not** start A6.

---

You are the **execution agent** for Sub-phase A5 (Domain Agents Artifact Citations) of the ArchitectOS Episode 7
build. You build against **decided design** — implementation choices only, never design choices. If something
needs a design decision beyond the inputs, **stop and flag it**.

You are in the `ArchitectOS Pro_beta` repo, canonical path `C:\Users\Hicks\ArchitectOS Pro_beta`. All paths
below are relative to that root.

**What A5 is, in one line:** make artifacts auditable — surface `provenance.source_refs` through the artifact
**delivery path** (a real plumbing gap, not just render), then show a resolvable citations rail in the
artifact-library Preview, reusing A2 resolvers + A3 chip/sidecar components. Functional only.

---

## Orient first — read these in order, then build

1. `.planning/citations/phases/a5-artifact-citations/RESEARCH.md` — **primary build source.** The plumbing gap
   with anchors (§1), provenance origin (§2), the render surface (§3), the reuse map (§4), static-vs-streamed
   differences (§5), scope (§6). **Re-verify every anchor before editing — they drift.**
2. `.planning/citations/phases/a5-artifact-citations/A5-01-PLAN.md` — task (plumb-first) + criteria.
3. `.planning/citations/phases/a5-artifact-citations/CONTEXT.md` — scope, decided decisions, file list, criteria.
4. `.planning/citations/CONTEXT.md` — locked ledger (**wins on conflict**): §4 O4 (resolved), §8 amendments (A0
   `from_provenance_ref`, A2 resolvers, A3 chip/sidecar, A4 auth = `get_current_user_id`).
5. `services/artifact_service.py`, `lib/artifactsApi.ts`, `pages/ProSuite/domain-agents/DomainAgentArtifacts.tsx`,
   `services/citations/normalize.py` (`from_provenance_ref`), the A3 chip/`CitationReaderBody` components,
   `services/citations/resolvers/` (A2).

Read 1–4 fully before writing a line.

---

## What you build

### Step 1 — Backend plumb (do first)
`provenance.source_refs` is written to the artifact row but dropped before delivery (RESEARCH §1). Add it back:
- Add `provenance` (or just `provenance.source_refs`) to `ArtifactDeliveryResult` (`artifact_service.py:31–43`)
  + `get_delivery` (read the row's `provenance`, `:218–229`) + the `/api/artifacts/{id}` response model
  (`ArtifactDeliveryResponse` in `main.py`, already `get_current_user_id`).
- **Normalize** the stored `source_refs` → `CitationRef` via A0 `from_provenance_ref` at read time (they come
  from `harness_engine result.citations`, `AgentSourceRef`-derived dicts; legacy rows handled by the same normalize).

### Step 2 — Frontend render
- Add `provenance`/citations to `ArtifactDelivery` (`lib/artifactsApi.ts:6`).
- In `DomainAgentArtifacts.tsx` Preview panel (~`:177–195`), render a **citations rail + resolvable chips**,
  reusing the **A3 chip/`CitationReaderBody` sidecar** and the **A2 resolve endpoint**. Number the stored
  `source_refs` at render time (dedup + ordinal, like A1 but computed from the static set).
- **Inline markers:** if an artifact body contains `[[Source:]]`/`[n]`, bind them like A3; otherwise the
  provenance rail is the citation surface.
- **`derived` refs are not chips** (O1 consistency).

---

## Hard constraints

- **Plumb before render** — provenance must flow through delivery; A5 is not pure-frontend.
- **Reuse, don't rebuild** — A0 `from_provenance_ref`, A2 resolvers, A3 chip/sidecar. No new resolver/reader/retrieval.
- **No new provenance capture** — Ep6 owns it; do not touch `harness_engine`/artifact-creation provenance building.
- **Static provenance** — number from the stored set; no streaming/turn loop.
- **Derived → not a chip.** Legacy/no-provenance artifacts degrade gracefully (no citations, no error).
- **No verification (A4 is VCSO-scoped), no geometry (Ep7B), no visual polish (§8).**
- **CONTEXT wins** on conflict. If underspecified, stop and flag.

---

## Done when (A5 success criteria — CONTEXT §"Success criteria")

1. A Monthly-P&L artifact (L15) delivers its `provenance.source_refs` (CitationRef-shaped) through `/api/artifacts/{id}`
   and renders a citations rail in the Preview.
2. Chips resolve via the shared A2 resolvers; sidecar reuses `CitationReaderBody`.
3. Inline `[[Source:]]`/`[n]` in an artifact body bind like A3 when present.
4. Legacy/no-provenance artifacts degrade gracefully; `derived` refs not shown as chips.
5. `compileall` 0; backend delivery test green; frontend builds.

**Report back:**
- One paragraph on what was built.
- The delivery-path change (what `ArtifactDeliveryResult` / `ArtifactDelivery` now carry) and the normalize step.
- How the Preview renders the rail/chips and reuses the A3 components.
- Any implementation choice deviating from/extending the design (for CONTEXT §8 reconciliation).
- Any flag needing London or a judgment call.

Then stop. Sub-phase A6 is opened from the strategy thread.
