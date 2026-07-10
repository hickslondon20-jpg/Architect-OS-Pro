# Citations & Source Grounding — Feature Planning Home (Episode 7)

This folder contains all planning and context for the **citation & source-grounding layer** — the
cross-cutting trust layer that makes every surfaced claim traceable to an exact source across all three
surfaces (Virtual CSO, Domain Agents, OS Engine) and all four knowledge tiers. It operationalizes the
canonical "everything is traceable, no hallucination" constraint (`../INTELLIGENCE-LAYER-ARCHITECTURE.md` §7.4).

Follows the same feature-folder convention as `../wiki-system/`, `../document-wiki/`, and
`../knowledge-base-explorer/`:

| File | Purpose |
|---|---|
| `CONTEXT.md` | Locked-decisions ledger (currency, resolvers, marking model, verifier, geometry posture) + the live-substrate audit + open decisions + flagged conflicts. **Read first.** Matures with an append-only Amendments section as sub-phases complete. |
| `ROADMAP.md` | The sub-phase sequence (Ep7A A0–A6, Ep7B B0–B3), dependency graph, per-phase backend wiring + surface manifestation + acceptance. |
| `REFERENCES.md` | The reference Ep7 (`docs/plans/ep7-citations/PRD-Citations.md`) machinery → sub-phase → extract / adapt / skip map. |
| `phases/NN-slug/` | One folder per sub-phase: its directional `NN-MM-PLAN.md` plan(s), plus — authored just-in-time when we reach it — its own `CONTEXT.md` + `EXECUTION-AGENT-PROMPT.md` (+ `RESEARCH.md` when there's reference extraction). |

## The reframe (why this is not greenfield)

The reference builds citations **from scratch** — evidence markers injected into model context, a parallel
per-message citations store, ingestion geometry, the whole stack. **We mostly don't need to.** The platform
has already converged on structured source-refs flowing from every tool, wiki read, and sub-agent result,
and both wiki layers already emit citation-ready reads (`agent_result_v1` with source-refs). So Ep7 is:

1. **Unify** the divergent live source-ref/evidence shapes into one citation currency (`CitationRef`).
2. **Render + verify** — build the citation UX (chips, sidecar, jump-to-evidence, Check Citations) on top.
3. **Add Tier 3 ingestion geometry** only where document-rectangle highlighting is actually needed.

Phased per L25: **Ep7A** unifies + renders + verifies with non-geometry resolvers (high reuse, auditable
answers early); **Ep7B** adds Tier 3 geometry (bounding boxes, verbatim source face, PDF highlighting) as a
follow-on, not a blocker.

## Where this sits relative to the wiki layers

| | Tier 1 — `../wiki-system/` | Tier 2 — `../document-wiki/` | Citations — this workstream |
|---|---|---|---|
| Built | complete in isolation (`wiki-1.0`) | complete in isolation (`doc-wiki-1.0`) | planning |
| Emits | claims + line-level `evidence` | pages + `source_file_ids` + inline `[[Source:]]` | consumes both → normalizes to `CitationRef` |
| Role | breadth (synthesized understanding) | depth (document-grown pages) | trust (resolve + verify any surfaced source) |

Both wiki layers are **citation-ready by design** — Ep7 unifies what they (and the Ep5 tool registry and
Ep6 provenance) already emit, rather than re-plumbing them.

## Source of truth

- **Reference machinery:** `docs/plans/ep7-citations/PRD-Citations.md` (+ its `README.md`). Reference, not
  blueprint — mapped to our phases with extract/adapt/skip in `REFERENCES.md`. Adopt the **model and UX,
  never the parallel per-message citations store** (L22).
- **Locked context:** `../INTELLIGENCE-LAYER-EPISODE-MAP.md` §4 Episode 7 + Refinement, §5 L8/L9/L11/L22–L25.
- **Architecture:** `../INTELLIGENCE-LAYER-ARCHITECTURE.md` (four-tier model, write-ownership, traceability).
- **The frozen contracts the currency normalizes:** Tier 1
  `../wiki-system/phases/02-interface-contract/02-01-CONTRACT.md`; Tier 2
  `../document-wiki/phases/02-page-contract-schema/02-01-CONTRACT.md`.
- **Live substrate:** `python-backend/services/{agent_context,tool_registry,doc_wiki_read_service,wiki_read,retrieval,vcso_chat_service,harness_engine,artifact_service}.py`.

## Scope boundary

This build owns the **capability**: the unified citation currency + adapters, the four tiered resolvers +
Tier 0 typed renderers, turn-collection/binding, the Check-Citations verifier, the functional citation UX in
VCSO + the artifact library, and (Ep7B) ingestion geometry + PDF highlight.

It does **not** own the cross-tier **retrieval router / connection phase** (L24 — consumed, not built), the
**visual polish** of the citation UX (the post-Ep7 §8 front-end pass), the wiki synthesis engines (already
built), or any new web-search producer tool. The `INTELLIGENCE-VISION.md` doc is **superseded** — not used.
