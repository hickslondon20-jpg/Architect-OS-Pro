# Document Wiki (Layer 2) — Sub-phase 01 (Verify & Delta) Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at `C:\Users\Hicks\ArchitectOS Pro_beta`.

---

You are the **verification agent** for Sub-phase 01 (Verify & Delta) of the ArchitectOS **Document Wiki
(Layer 2 / "Wiki 2.0")** build — the emergent, document-driven wiki that compounds from uploaded
documents, sitting beneath the seven fixed structured pages of Layer 1 (`.planning/wiki-system/`).

This is a **read-only investigation**. You write **no code, schema, or migrations**. Your single
deliverable is a delta document. If something would require a design decision, **flag it for the design
discuss — do not decide it.**

## Why this matters

The OS Engine appears to already scaffold most of Layer 2 — a knowledge-page table, a page taxonomy, the
viewer UI, and a partial Virtual CSO read-hook — with the **synthesis/ingest engine missing**
(`ose_knowledge_pages` has 0 rows; nothing populates it). Your job is to confirm exactly what exists,
what's mock vs. wired, what's legacy (Pinecone), and where it stalled — so we build the engine on solid
ground rather than greenfield over working assets.

## Orient first (read these, in order)

1. `.planning/document-wiki/CONTEXT.md` — what Layer 2 is, the locked approach, the open decisions, the preliminary finding.
2. `.planning/document-wiki/phases/01-verify-delta/01-01-PLAN.md` — your full task spec (sections A–I).
3. `.planning/wiki-system/CONTEXT.md` — Layer 1 (the structured 7 pages); note its schema object's
   `ose_page_type` mapping (the Layer-1↔Layer-2 bridge).
4. The code: `lib/osEngineApi.ts`, `lib/osEngineMockData.ts`, `components/pro-suite/os-engine/**`,
   `api/vcso/chat.ts`, and the Python ingestion backend.

## Hard constraints

- **Read-only.** No file edits to production code, no migrations, no DDL. Supabase = SELECT / introspection only.
- **Verify, don't build, don't design.** Every claim in the delta must be backed by something you read or
  queried. Surface decisions; don't make them.
- **Don't greenfield in your head.** Assume the scaffold is intentional until evidence says otherwise.

## Your tasks (full detail in 01-01-PLAN.md §A–I)

- **A.** `ose_knowledge_pages` full schema / constraints / indexes / RLS / rows; the `pinecone_vector_id`
  vs pgvector situation; semantics of `canonical_key`/`page_kind`/`domain`/`confidence`/date fields.
- **B.** The taxonomy (`PageType`, `PAGE_TYPE_LABELS`, `WIKI_CATEGORIES`, `STARTER_PAGE_TYPES`,
  `IMPORT_SOURCES`) — real/wired vs mock; vs theafh's page types.
- **C.** The UI surfaces (`WikiView`/`IndexView`/`ManifestView`/`LogView`/`Reader`/`NotesComposer`) —
  what binds to live `ose_*` tables vs mock; functional vs empty scaffold.
- **D.** The Virtual CSO read-hook in `api/vcso/chat.ts` — exactly how it uses `ose_knowledge_pages`.
- **E.** The ingest gap — confirm nothing writes `ose_knowledge_pages`; what `seed_core_knowledge_pages()`
  creates; surface any abandoned page-generation code.
- **F.** Related OSE tables (`ose_page_corrections`, `ose_activity_log`, `ose_knowledge_base_setup`,
  `ose_raw_document_registry`) and how they interrelate (`source_file_ids` ↔ registry = the manifest).
- **G.** Confirm the KB Explorer (`kb_folders`, `full_markdown`, ls/tree/grep/read) is the document source.
- **H.** The Layer-1 (`wiki_*`) ↔ Layer-2 (`ose_knowledge_pages`) boundary (the `ose_page_type` bridge).
- **I.** An explicit **build-on-existing vs fresh-store recommendation** with reasons + any legacy entanglement.

## Deliverable

`.planning/document-wiki/phases/01-verify-delta/01-01-DELTA.md` — sections A–I, each ending
**CONFIRMED / CORRECTED / RISK**, plus a **gap table** (what exists / what the synthesis engine must add)
and the §I recommendation.

## Done when

All six success criteria in `01-01-PLAN.md` are met; `01-01-DELTA.md` exists with A–I verdicts, the gap
table, and the build-on-existing recommendation; no production code written. Report back a one-paragraph
summary: CONFIRMED/CORRECTED/RISK counts, the headline gap, and your build-on-existing verdict. Then stop
— the design discuss is opened from the strategy thread.
