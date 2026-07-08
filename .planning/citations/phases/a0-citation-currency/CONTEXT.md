# Sub-phase A0 Context — Citation Currency + Normalization Adapters

**Date:** 2026-07-06
**Outcome:** Ready to execute. Reference extraction is done (`RESEARCH.md` — our own codebase) and all design
decisions are locked in `../../CONTEXT.md`. The execution agent makes implementation choices only —
not design choices.

---

## What this sub-phase is

Freezes the **one citation currency** — `CitationRef` (`citation-1.0`) — the seam every downstream Ep7 phase
(A1 collection, A2 resolvers, A4 verifier, A5 artifacts, Ep7B geometry) builds against, and the normalization
adapters that converge all seven live producer shapes into it. This is the **keystone**: nothing else in Ep7
starts until A0 lands.

Two sequential deliverables:
- **A0-01 (currency + contract amendment):** the `CitationRef`/`Locator` object, the `SourceKind` family map,
  and the additive `citation-1.0` amendment note to the two frozen wiki contracts. See `A0-01-PLAN.md`.
- **A0-02 (adapters + golden tests):** one adapter per producer shape, with golden tests from real payloads.
  See `A0-02-PLAN.md`.

Both are light enough to run in one execution-agent session — A0-01 first, then A0-02.

---

## Inputs the agent must read first (in order)

1. `RESEARCH.md` (this folder) — **primary build source.** Exact producer field shapes + file:line anchors
   (§1–§9), the frozen contract surfaces (§10), the union taxonomy → family map (§11).
2. `A0-01-PLAN.md` + `A0-02-PLAN.md` (this folder) — task specs + success criteria.
3. `../../CONTEXT.md` — locked-decisions ledger. §2 (audit), §3.1 DP1 + §3.2 (the object + families), §5 F1/F2,
   §8 Amendments (the `citation_payload` refinement). Where CONTEXT and any other doc differ, CONTEXT wins.
4. The two frozen contracts (do not mutate — F1): `../../../wiki-system/phases/02-interface-contract/02-01-CONTRACT.md`
   and `../../../document-wiki/phases/02-page-contract-schema/02-01-CONTRACT.md`.
5. Live producers before writing each adapter (re-verify line numbers): `agent_context.py`, `tool_registry.py`,
   `doc_wiki_read_service.py`, `wiki_read.py`, `retrieval.py`, `vcso_chat_service.py`, `artifact_service.py`.

---

## Decisions already made (do not re-open)

- **Currency = additive extension of `AgentSourceRef`** (DP1). Add `verbatim` + `locator`; broadest taxonomy,
  most consumers.
- **`verbatim`/`locator` are first-class on `CitationRef`**, carried via the existing `AgentSourceRef.citation_payload`
  hook when traversing `AgentSourceRef`-typed paths — frozen dataclass untouched (CONTEXT §8, F1).
- **Four tiered families + a `derived` non-tier bucket** (DP1 / L23); `raw_source_kind` preserved on every ref (F2).
- **Adapters converge at the boundary** — producers keep their native shapes; no producer rewrites in A0.
- **Frozen contracts get an additive amendment note only** — no in-place field mutation (F1).
- **Taxonomy is normalized, never renamed at the source** — `raw_document_chunk→document_chunk`,
  `tier0_record↔platform_record`, etc. via the map (F2).

---

## What this sub-phase does NOT do

- No turn collection / stream wiring / VCSO event replacement (A1).
- No resolvers that fetch source content (A2); adapters only *shape* refs, no I/O.
- No verifier (A4), no artifact rendering (A5), no ingestion geometry (Ep7B).
- No producer rewrites; no mutation of `AgentSourceRef`, `ToolSourceRef`, or the frozen contract shapes.
- No UI.

---

## Files to create or modify

| File | Action | Notes |
|---|---|---|
| `python-backend/services/citations/__init__.py` | Create | New package. |
| `python-backend/services/citations/models.py` | Create | `CitationRef`, `Locator`, `SourceKind` family map + `RAW_TO_FAMILY`; `to_dict`/`from_dict`; `verbatim`/`locator` first-class. |
| `python-backend/services/citations/normalize.py` | Create | The 8 adapters (RESEARCH §1–§9). Pure, no I/O. |
| `python-backend/tests/test_citations_normalize_a0.py` | Create | Golden tests: each producer shape → expected `CitationRef`; taxonomy exhaustiveness; round-trip. |
| `../../../wiki-system/phases/02-interface-contract/02-01-CONTRACT.md` | Append | `citation-1.0` additive amendment note (no field edits). |
| `../../../document-wiki/phases/02-page-contract-schema/02-01-CONTRACT.md` | Append | Same additive amendment note. |

---

## Success criteria (combined A0-01 + A0-02)

1. `CitationRef` + `Locator` defined per CONTEXT §3.2; `verbatim`/`locator` first-class; round-trips via `to_dict`/`from_dict`.
2. `RAW_TO_FAMILY` exhaustive over RESEARCH §11; unknown → `derived` + warning; `raw_source_kind` always preserved.
3. All 8 adapters implemented; **golden tests pass** from real-payload fixtures for each producer shape.
4. `parse_inline_source_marker` handles chunk-present and chunk-absent forms.
5. Adapters are pure (no I/O), safe in hot paths.
6. `citation-1.0` additive amendment appended to both frozen contracts; no frozen field mutated.
7. `python -m compileall python-backend` exits 0; new tests green.

---

## Handoff

When `models.py` + `normalize.py` land with green golden tests and the contract amendments are appended, the
currency is frozen. The strategy thread logs an A0 completion-reconciliation amendment in `../../CONTEXT.md §8`,
then opens **sub-phase A1 (turn collection + binding)** — which begins with the O3 design spike.

*Context written: 2026-07-06 — Ep7 citations planning thread, at A0 sub-phase entry.*
