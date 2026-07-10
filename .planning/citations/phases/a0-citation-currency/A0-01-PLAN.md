# Plan A0-01 — Citation currency (`CitationRef` / `citation-1.0`) + contract amendment

**Sub-phase:** A0 — Citation currency + normalization adapters
**Plan:** 1 of 2
**Depends on:** nothing (keystone — all phases depend on A0)
**Status:** Directional (first-pass) — refine at sub-phase entry; this is the Ep7A entry point
**Decisions:** `../../CONTEXT.md` §3.1 DP1, §3.2, §5 F1/F2 · **Ref:** `../../REFERENCES.md` C-6/C-8

---

## Goal

Define the **one citation currency** every downstream phase speaks: `CitationRef` (`citation-1.0`), an
**additive extension of the canonical `AgentSourceRef`** (adds `verbatim` + `locator`), plus the normalized
`source_kind` **resolver-family** taxonomy. No producer changes yet (that's A0-02 adapters) — this plan
freezes the object + the taxonomy map + records the frozen-contract amendment.

## Pre-Execution Checks
1. Read `../../CONTEXT.md` §2 (the seven live producer shapes) and §3.2 (the object + families).
2. Read the two frozen contracts' citation surfaces: `../../../wiki-system/phases/02-interface-contract/02-01-CONTRACT.md`
   (`evidence` / `AgentSourceRef[]`) and `../../../document-wiki/phases/02-page-contract-schema/02-01-CONTRACT.md`
   (`agent_result_v1` / inline `[[Source:]]`).
3. Confirm live `AgentSourceRef` (`python-backend/services/agent_context.py`) and `ToolSourceRef`
   (`tool_registry.py`) field sets before extending.

## Build
- **`python-backend/services/citations/models.py`** — `CitationRef`, `Locator`, and the `SourceKind`
  family map (`document_chunk` / `wiki_page` / `platform_record` / `web` / `derived`), each with a
  `raw_source_kind` preservation slot (F2). Exact fields per CONTEXT §3.2. `to_dict()` / `from_dict()`.
- **First-class vs. `citation_payload` decision (CONTEXT §8 amendment 2026-07-06).** `AgentSourceRef`
  already carries a `citation_payload: dict` hook (`agent_context.py:24`). Make `verbatim` + `locator`
  **first-class `CitationRef` fields**, and use `citation_payload` as the on-the-wire carrier when a
  `CitationRef` must pass through `AgentSourceRef`-typed paths — leaving the frozen `AgentSourceRef`
  dataclass untouched (reinforces F1). Confirm/adjust and record the call.
- **Taxonomy map** — an explicit `RAW_TO_FAMILY` table covering the full union taxonomy (CONTEXT §2):
  `raw_document_chunk→document_chunk`, `tier0_record/founder_dataset/dataset_row/global_checkpoint→platform_record`,
  etc. Exhaustive; unknown raw kinds route to `derived` with a warning, never dropped.
- **Contract amendment (F1)** — append a `citation-1.0` **additive amendment note** to BOTH frozen
  contracts stating that read-tool citations MAY carry optional `verbatim` + `locator` fields; additive,
  backward-compatible, no in-place mutation of the frozen shapes. (Note only — do not edit frozen field tables.)

## Surface manifestation
None (pure backend foundation + docs).

## Success criteria
1. `CitationRef` + `Locator` defined exactly per CONTEXT §3.2; round-trips through `to_dict`/`from_dict`.
2. `RAW_TO_FAMILY` is exhaustive over the CONTEXT §2 union taxonomy; unknown → `derived` + warning.
3. `raw_source_kind` preserved on every mapped ref (no silent renames — F2).
4. `citation-1.0` additive amendment appended to both frozen contracts; no frozen field mutated.

## Out of scope
The normalization adapters + golden tests (A0-02); any producer/emit changes (A1); resolvers (A2).
