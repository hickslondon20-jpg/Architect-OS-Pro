# Wiki System — Feature Planning Home

This folder contains **all** planning and context for the ArchitectOS Wiki System
(Tier 1 — the compiled business-knowledge layer). It is the feature-scoped home for
this build: decisions, roadmap, and phase plans live here together.

## Organization convention (applies to all major builds going forward)

> Every major feature area gets its own subfolder under `.planning/`, holding its
> own `CONTEXT.md`, `ROADMAP.md`, and `phases/` subtree. This keeps context and
> planning files organized by feature instead of pooled in a single flat directory.

The legacy KB Explorer build (Phases 1–7) remains in the flat `.planning/phases/`
structure. The Wiki System is the first feature organized under this convention.
Future builds (retrieval router / connection phase, domain agents, etc.) should each
get their own `.planning/<feature-slug>/` folder.

## Contents

| File | Purpose |
|---|---|
| `CONTEXT.md` | Locked decisions ledger from the Discuss cycle (2026-06-29). The authoritative cross-cutting decision record + interface contract the execution agents read first. |
| `ROADMAP.md` | The sub-phase sequence (01 … 08), dependencies, and acceptance definition. |
| `REFERENCES.md` | Verified map of each spec adoption (A1–A7 / B1–B8) → exact repo artifact → consuming sub-phase → extract/skip. Read before opening any sub-phase. |
| `phases/NN-slug/` | One self-contained folder per sub-phase, mirroring the KB Explorer structure. Each holds its directional plan file(s) (`NN-MM-PLAN.md`) and — authored when we reach that sub-phase — its own `CONTEXT.md` and `EXECUTION-AGENT-PROMPT.md`. |

### Sub-phase folders

`01-verify-delta` · `02-interface-contract` · `03-schema-foundation` (2 plans) ·
`04-compilation` · `05-write-back` · `06-validation-health` · `07-consolidation` ·
`08-acceptance`

The feature-root `CONTEXT.md` / `ROADMAP.md` are the shared spine across all sub-phases;
each sub-phase's own `CONTEXT.md` (added as we reach it) is scoped to that sub-phase.

## Source of truth

- **Grounded vision / spec:** `ArchitectOS-Wiki-System-Spec-v1.md` (co-located in this folder)
- **North-star architecture:** `.planning/INTELLIGENCE-VISION.md` (four-tier model; wiki = Tier 1)
- **Codebase maps:** `.planning/codebase/` (STACK / ARCHITECTURE / STRUCTURE / CONVENTIONS / TESTING / INTEGRATIONS / CONCERNS)
- **Roadmap context:** `.planning/ROADMAP.md` (KB Explorer Phases 1–7 = done; this build = Phase 8)

## Scope boundary (hard)

This build delivers the wiki as a **self-contained capability**. It does **not** wire the
wiki into the Virtual CSO streaming endpoint, the OS Engine, the Domain Agents, or build
the retrieval router / intent classifier. That connection layer is a later, separate phase
(roadmap Phase 9) owned by the KB Explorer planner once this capability exists and its
interface contract (08-02) is stable.
