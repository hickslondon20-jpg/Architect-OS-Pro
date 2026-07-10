# Citations (Episode 7) — Sub-phase A0 Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at
> `C:\Users\Hicks\ArchitectOS Pro_beta`. This session runs sub-phase **A0 only** (citation currency +
> normalization adapters). Do **not** start A1.

---

You are the **execution agent** for Sub-phase A0 (Citation Currency + Normalization Adapters) of the
ArchitectOS Episode 7 (Citations & Source Grounding) build. You build against **decided design** — you make
implementation choices (naming, file layout, test specifics) but **never design choices**. The reference
extraction is done (against our own codebase); you do not re-interpret the reference PRD. If something would
require a design decision beyond what the inputs specify, **stop and flag it** rather than improvising.

You are running inside the `ArchitectOS Pro_beta` repo. The canonical app path is
`C:\Users\Hicks\ArchitectOS Pro_beta`. All paths below are relative to that root.

**What A0 is, in one line:** freeze the one citation currency — `CitationRef` (`citation-1.0`) — and the
adapters that converge all seven live source-ref shapes into it. This is the keystone; every later Ep7 phase
builds on it. Do not build resolvers, UI, verification, collection, or geometry.

---

## Orient first — read these in order, then build

1. `.planning/citations/phases/a0-citation-currency/RESEARCH.md` — **your primary build source.** Exact live
   producer field shapes + file:line anchors (§1–§9), the two frozen contract surfaces (§10), the union
   taxonomy → family map (§11). Build from this. **Re-verify each file:line anchor before writing its adapter
   — line numbers drift.**
2. `.planning/citations/phases/a0-citation-currency/A0-01-PLAN.md` — currency + contract-amendment task + criteria.
3. `.planning/citations/phases/a0-citation-currency/A0-02-PLAN.md` — adapters + golden-tests task + criteria.
4. `.planning/citations/phases/a0-citation-currency/CONTEXT.md` — scope, decided decisions, file list, criteria.
5. `.planning/citations/CONTEXT.md` — the locked-decisions ledger (**wins over all other docs on conflict**).
   Read §2 (audit), §3.1 DP1 + §3.2 (object + families), §5 F1/F2, §8 Amendments (the `citation_payload` refinement).
6. The two frozen contracts (**do not mutate — F1**), for the amendment note and the `AgentSourceRef[]` /
   `evidence` / inline-marker surfaces:
   - `.planning/wiki-system/phases/02-interface-contract/02-01-CONTRACT.md` (`wiki-1.0`)
   - `.planning/document-wiki/phases/02-page-contract-schema/02-01-CONTRACT.md` (`doc-wiki-1.0`)
7. The live producers (re-verify before each adapter): `python-backend/services/agent_context.py`,
   `tool_registry.py`, `doc_wiki_read_service.py`, `wiki_read.py`, `retrieval.py`, `vcso_chat_service.py`,
   `artifact_service.py`.

Read 1–6 fully, and the relevant §of RESEARCH per producer, before writing a line.

---

## What you build

Two sequential steps. Complete A0-01 before A0-02.

### Step 1 — A0-01: the currency object + contract amendment

**File:** `python-backend/services/citations/models.py` (+ package `__init__.py`).

- **`CitationRef` (`citation-1.0`)** with fields exactly per `.planning/citations/CONTEXT.md §3.2`:
  `source_kind`, `source_id`, `source_label`, `verbatim`, `locator`, `source_metadata`. Plus `Locator` with
  the Ep7A fields (`kind`, `path`, `lines`, `section_label`, `page_key`, `record_path`) and the Ep7B fields
  present-but-unused (`page_number`, `bbox`). `to_dict()` / `from_dict()`.
- **`verbatim` + `locator` are first-class on `CitationRef`.** `AgentSourceRef` already carries a
  `citation_payload: dict` hook (`agent_context.py:24`) — use it as the **on-the-wire carrier** when a
  `CitationRef` must traverse `AgentSourceRef`-typed paths, so the frozen `AgentSourceRef` dataclass is
  **not modified** (CONTEXT §8 amendment, F1). Record the exact serialization you choose.
- **`SourceKind` family map + `RAW_TO_FAMILY`** — the five families (`document_chunk`, `wiki_page`,
  `platform_record`, `web`, `derived`) and the exhaustive raw→family table from RESEARCH §11. Every mapped
  ref preserves the original in `source_metadata.raw_source_kind` (F2). Unknown raw kind → `derived` +
  warning log; **never dropped**.
- **Contract amendment (F1):** append a short `citation-1.0` **additive amendment note** to BOTH frozen
  contracts (files in Orient §6), stating read-tool citations MAY carry optional `verbatim` + `locator`
  (additive, backward-compatible). **Append only — do not edit any frozen field table or shape.**

### Step 2 — A0-02: the normalization adapters + golden tests

Only after A0-01 is complete.

**File:** `python-backend/services/citations/normalize.py`. One adapter per producer shape (RESEARCH §1–§9),
each returning `CitationRef`(s), `raw_source_kind` preserved, **pure (no I/O)**:

- `from_agent_source_ref` (near-identity; §1/§5) · `from_tool_source_ref` (`label→source_label`,
  `metadata→source_metadata`, keep `verbatim`; §2) · `from_docwiki_citation` (`source_id=canonical_key`,
  `source_label=title`; §3) · `from_wiki_evidence` (`locator.lines`/`path`, metadata `weight/note`; §4) ·
  `from_retrieved_chunk` (`raw_document_chunk→document_chunk`, `content→verbatim`; §6) ·
  `parse_inline_source_marker` (both chunk-present/absent forms; §7) · `from_vcso_stream_ref`
  (`kind`→`source_kind`; §8) · `from_provenance_ref` (normalize/pass-through Ep6 dicts; §9).

**File:** `python-backend/tests/test_citations_normalize_a0.py`. Golden tests: real-payload fixture per
producer → expected `CitationRef`; family assignment correct for every taxonomy value; `RAW_TO_FAMILY`
exhaustive over RESEARCH §11; round-trip via `to_dict`/`from_dict`.

---

## Hard constraints

- **A0 shapes refs; it does not fetch, resolve, collect, stream, verify, or render.** No I/O in adapters.
- **No producer rewrites.** `AgentSourceRef`, `ToolSourceRef`, `RetrievedChunk`, the docwiki/wiki read
  services, and the VCSO stream all keep emitting their native shapes. A0 converges at the boundary only.
- **Do not mutate the frozen contracts** — append the additive amendment note only (F1).
- **Do not modify the frozen `AgentSourceRef` dataclass** — use its existing `citation_payload` hook.
- **Normalize taxonomy, never rename at the source** — always preserve `raw_source_kind` (F2).
- **No new web producer, no resolvers, no VCSO event changes** (those are A2 / A1).
- **CONTEXT wins** over any other doc on conflict. If the design is underspecified, stop and flag.

---

## Done when (A0 success criteria — CONTEXT §"Success criteria")

1. `CitationRef` + `Locator` per CONTEXT §3.2; `verbatim`/`locator` first-class; round-trips via `to_dict`/`from_dict`.
2. `RAW_TO_FAMILY` exhaustive over RESEARCH §11; unknown → `derived` + warning; `raw_source_kind` always preserved.
3. All 8 adapters implemented; **golden tests pass** from real-payload fixtures.
4. `parse_inline_source_marker` handles chunk-present and chunk-absent forms.
5. Adapters are pure (no I/O).
6. `citation-1.0` additive amendment appended to both frozen contracts; no frozen field mutated.
7. `python -m compileall python-backend` exits 0; new tests green.

**Report back:**
- One paragraph on what was built.
- The `CitationRef`/`Locator` final field list, and your `verbatim`/`locator` ↔ `citation_payload` serialization choice.
- Confirmation the two contract amendments are appended (additive, no field edits).
- Any implementation choice that deviates from or extends the specified design (for CONTEXT §8 reconciliation).
- Any flag that required a judgment call or should go to London.

Then stop. Sub-phase A1 is opened from the strategy thread (it begins with the O3 binding spike).
