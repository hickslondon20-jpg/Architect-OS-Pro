# Plan A0-02 — Normalization adapters + golden tests

**Sub-phase:** A0 — Citation currency + normalization adapters
**Plan:** 2 of 2
**Depends on:** A0-01 (the `CitationRef` object + taxonomy map)
**Status:** Directional (first-pass) — refine at sub-phase entry
**Decisions:** `../../CONTEXT.md` §3.1 DP1, §3.2 (adapters list), §5 F2 · **Ref:** `../../REFERENCES.md` C-5/C-6

---

## Goal

Converge all seven live producer shapes into `CitationRef` at the boundary — producers keep emitting their
native shapes; adapters normalize. This is the mechanism that makes L22's "one currency" real.

## Pre-Execution Checks
1. Read `../../CONTEXT.md` §2 (each producer's exact fields) and A0-01's `models.py`.
2. Re-verify each producer live before writing its adapter: `agent_context.py`, `tool_registry.py`,
   `doc_wiki_read_service.py`, `wiki_read.py`, `retrieval.py`, `vcso_chat_service.py`, `artifact_service.py`.

## Build — `python-backend/services/citations/normalize.py`
One adapter per shape (CONTEXT §3.2), each returning `CitationRef(s)` with `raw_source_kind` preserved:
- `from_agent_source_ref` — native; `verbatim=None`, `locator` from `source_metadata` (page_key etc.).
- `from_tool_source_ref` — `label→source_label`, `metadata→source_metadata`, keep `verbatim`.
- `from_docwiki_citation` — `source_kind=wiki_page`, `source_id=canonical_key`, `source_label=title`,
  metadata `page_kind/similarity`.
- `from_wiki_evidence` — normalize `source_kind`; `locator.lines` from `lines`, `path`; metadata `weight/note`.
- `from_retrieved_chunk` — `raw_document_chunk→document_chunk`; carry chunk text as `verbatim`.
- `parse_inline_source_marker` — parse `[[Source: raw_document:{id}#chunk:{id}|label]]` →
  `document_chunk`, `source_id=chunk_id||doc_id`, `source_label=label`, metadata `document_id`.
- `from_vcso_stream_ref` — map `kind→source_kind` (`wiki→wiki_page`, `platform→platform_record`,
  `ip→wiki_page/global_ip`, `context→derived`).
- `from_provenance_ref` — pass-through/normalize the Ep6 `artifacts.provenance.source_refs` dicts.

## Surface manifestation
None yet (A1 wires these into the VCSO stream + turn collection).

## Success criteria
1. **Golden tests**: each of the 7 producer shapes → expected `CitationRef` (fixtures from real payloads).
2. Family assignment correct for every taxonomy value; `raw_source_kind` always preserved.
3. `parse_inline_source_marker` handles the chunk-present and chunk-absent marker forms.
4. Round-trip stable; adapters are pure (no I/O), safe to call in hot paths.

## Out of scope
Turn collection / stream wiring (A1); resolvers that fetch source content (A2). Adapters only *shape*.
