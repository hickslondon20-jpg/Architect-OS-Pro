# Document Wiki — Feature Planning Home (Layer 2 / "Wiki 2.0")

This folder contains all planning and context for the **emergent, document-driven wiki** — the
unstructured Tier-1 layer that compounds from the founder's uploaded documents, sitting **beneath**
the seven fixed structured pages built in `../wiki-system/` (Layer 1).

Follows the same feature-folder convention as `wiki-system/` and `knowledge-base-explorer/`:

| File | Purpose |
|---|---|
| `CONTEXT.md` | Locked decisions ledger (page model, taxonomy, ingest posture, corrections, memory substrate). Read first. |
| `ROADMAP.md` | The sub-phase sequence (01–07), dependencies, acceptance. |
| `REFERENCES.md` | The theafh emergent-wiki pattern → sub-phase → extract/skip map. |
| `phases/NN-slug/` | One folder per sub-phase: its directional `NN-MM-PLAN.md` plan(s), plus — authored just-in-time when we reach it — its own `CONTEXT.md` + `EXECUTION-AGENT-PROMPT.md` (+ `RESEARCH.md` when there's extraction). |

## The two Tier-1 layers

| | Layer 1 — `wiki-system/` (built) | Layer 2 — `document-wiki/` (this) |
|---|---|---|
| Pages | 7 fixed, platform-defined | emergent, document-grown (entity / concept / comparison / …) |
| Source | Tier 0 structured data + docs | uploaded documents (via OS Engine / KB Explorer) |
| Taxonomy | bounded, CHECK-constrained | open, extensible |
| Role | breadth — the always-true structured picture | depth — document-specific, unbounded knowledge |
| Store | `wiki_*` tables | likely the existing `ose_knowledge_pages` system (verify pass decides) |

An agent reads Layer 1 for the picture → drills into Layer 2 for document-specific depth → cracks the
raw file (Tier 3 KB Explorer) only for exact source text.

## Key reframe (from the opening discuss, 2026-06-30)

Layer 2 is **not greenfield.** The OS Engine already scaffolds it: `ose_knowledge_pages` (a full
emergent-wiki page schema), the `PageType`/`WIKI_CATEGORIES` taxonomy, the `WikiView`/`IndexView`/
`ManifestView`/`LogView` UI, and a partial Virtual CSO read-hook (`api/vcso/chat.ts`). What's missing
is the **synthesis/ingest engine** that reads an uploaded document and creates/updates/cross-links
pages — `ose_knowledge_pages` has 0 rows and no Python writer. **Build the engine on the existing
rails** (pending the verify pass confirming this prior).

## Source of truth

- **Foundational pattern:** theafh "LLM Wiki" (the emergent-taxonomy half we marked *skip* for Layer 1
  in `../wiki-system/REFERENCES.md` is now the **adoption target**). Mechanics already extracted there.
- **Layer 1:** `../wiki-system/` (reuse compilation/orchestrator/health patterns; the schema object's
  `ose_page_type` mapping is the Layer-1↔Layer-2 bridge hint).
- **Document source:** the KB Explorer (`kb_folders`, `full_markdown`, ls/tree/grep/read) — Phases 1–7.

## Scope boundary (same as Layer 1)

This build owns the **capability**: the ingest/synthesis engine, the page store, the read/write tools,
and health. It does **not** own the live retrieval-router / CSO-routing wiring — that is the connection
phase, shared with Layer 1's handoff.
