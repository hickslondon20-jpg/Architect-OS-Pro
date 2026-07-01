# Sub-phase 02 Context — Page Contract + Schema

**Date:** 2026-06-30
**Outcome:** Ready to execute. The reference extraction is done (`02-RESEARCH.md`) and all design
decisions are baked in. The execution agent makes implementation choices only — not design choices.

---

## What this sub-phase is

Freezes the **Layer 2 page contract** — the seam the synthesis engine (03), source adapters (04),
embeddings (05), corrections/health (06), and the memory loop (connection phase) all build against.
Then makes the contract real in the database (additive, non-breaking) and registers the page-wiki
tools on the orchestrator as stubs.

Sub-phase 02 has two sequential deliverables:
- **02-01 (page contract):** a versioned `02-01-CONTRACT.md` — "what a page is" in full; no code.
- **02-02 (schema + tools):** the additive migration + `page_kind` vocabulary + links model +
  stub tool registration. No engine logic.

Both are light enough to run in one execution agent session. The agent does 02-01 first, then 02-02.

---

## Inputs the agent must read first (in order)

1. `02-RESEARCH.md` (this folder) — **primary build source.** Decided taxonomy (§1), provenance
   contract (§2), links model (§3), index/log semantics (§4), page object field-by-field (§5),
   read tool surface (§6), write surface (§7), Layer-1 bridge (§8), memory hooks (§9), hard rules (§10).
2. `02-01-PLAN.md` (this folder) — 02-01 task spec + success criteria.
3. `02-02-PLAN.md` (this folder) — 02-02 task spec + success criteria.
4. `../../CONTEXT.md` — locked decisions (page model, `page_kind` axis, provenance, corrections,
   memory substrate §7). Where CONTEXT and any other doc differ, CONTEXT wins.
5. `../01-verify-delta/01-01-DELTA.md` §A (live columns), §F (related tables), §H (Layer-1 bridge).
6. `../../wiki-system/phases/02-interface-contract/02-01-CONTRACT.md` — Layer 1 contract (style
   reference — see how operations are specified with actor-scope + invariant).
7. `python-backend/services/agent_capabilities.py` and `sub_agent_orchestrator.py` — mirror the
   existing `document_analysis_agent` / `kb_explorer_agent` registration + dispatch pattern exactly.
8. `config/wiki_schema.json` — the Layer-1 bridge mapping (verify the `ose_page_type` values).

---

## Decisions already made (do not re-open)

- **Page model:** prose markdown (`content`) + structured provenance (`source_file_ids[]`, inline
  citations). No claim-level decomposition in Layer 2.
- **`page_kind`:** the emergent type axis; extensible config (NOT a DB CHECK). Vocabulary in
  `02-RESEARCH.md` §1. `page_type` stays as the Layer-1 bridge; never collapse the two.
- **Provenance:** `source_file_ids[]` ↔ `ose_raw_document_registry.connected_pages[]` maintained
  by the engine. Inline citations in prose. Spec in `02-RESEARCH.md` §2.
- **Links model:** `ose_page_links` table (from/to/relation). Arrays on the page row are for
  doc-manifest only. Spec in `02-RESEARCH.md` §3.
- **Write surface:** engine synthesis write (service-role) is the only writer of `content`. Founder
  correction via `ose_page_corrections` is the override path. No agent write-back surface.
- **Memory hooks:** `recall_count`, `last_recalled_at`, `promotion_state` are added to the schema
  now; engine writes defaults; connection phase activates the increment loop.
- **Pinecone:** deprecated. Column stays; no new reads/writes. pgvector is the page-embedding path.
- **Tool names:** `docwiki_get_page`, `docwiki_search`, `docwiki_list`. Fixed; connection phase
  binds to these exact names.
- **Capability key:** `per_user_document_wiki`.

---

## What this sub-phase does NOT do

- No synthesis engine logic (03).
- No real handler implementations (stubs returning `not_implemented` only).
- No embedding population or semantic search (05).
- No corrections lifecycle or health/lint (06).
- No UI changes.
- No substrate from theafh repos (no markdown vaults, no CLI tools, no JSON-file caches).
- No touch to Layer 1's `wiki_*` tables or compilation logic.

---

## Files to create or modify

### 02-01 (page contract — no code changes)

| File | Action | Notes |
|---|---|---|
| `phases/02-page-contract-schema/02-01-CONTRACT.md` | **Create** | Versioned `doc-wiki-1.0`. Every field specified. Every tool specified with actor-scope + invariant. Hard guarantees section. |

### 02-02 (schema + tools)

| File | Action | Notes |
|---|---|---|
| `docs/migrations/YYYYMMDD_docwiki_schema.sql` | **Create** | Additive only. Adds: `embedding vector(1536)` + HNSW; `origin_thread_id text`; `synthesis_job_id text`; `recall_count int default 0`; `last_recalled_at timestamptz`; `promotion_state text default 'default'` to `ose_knowledge_pages`. Creates `ose_page_links` table + RLS + unique index. Comments `pinecone_vector_id` as deprecated. Does NOT break existing reads. |
| `src/config/doc_wiki_schema.json` (or extend `wiki_schema.json`) | **Create/extend** | `page_kind_vocabulary` array + `kind_to_category` mapping + `kind_to_page_type` bridge map. Extensible config, not DB. |
| `python-backend/services/agent_capabilities.py` | **Modify** | Add `per_user_document_wiki` to `_fallback_capabilities()` + DB insert. Tools: `docwiki_get_page`, `docwiki_search`, `docwiki_list`. Source kinds: `wiki_page`, `wiki_page_link`. Surfaces: `virtual_cso`, `os_engine`, `domain_agent`. |
| `python-backend/services/sub_agent_orchestrator.py` | **Modify** | Add `per_user_document_wiki` dispatch branch returning `not_implemented` `agent_result_v1` stub. |
| (run after migration) | **Run** | `generate_typescript_types` to regenerate `src/types/supabase.ts`. |

---

## Success criteria (combined 02-01 + 02-02)

From `02-01-PLAN.md`:
1. `02-01-CONTRACT.md` versioned `doc-wiki-1.0`; every field on the page object specified.
2. `page_kind` vocabulary defined in config (extensible; not a DB CHECK).
3. Provenance + manifest + links contracts specified.
4. Read/write tool surface + actor scope specified.
5. Layer-1 bridge + memory hooks (reserve fields) specified.

From `02-02-PLAN.md`:
6. Migration applies; `embedding` col + HNSW exist; new memory/provenance fields added; existing reads unaffected.
7. `ose_page_links` table exists with RLS + unique constraint.
8. `page_kind` vocabulary lives in one canonical config location.
9. `pinecone_vector_id` deprecated (commented in migration; no new code references it).
10. `per_user_document_wiki` registers in `agent_capabilities` + lists via `list_capabilities()`.
11. Orchestrator dispatches to stub returning valid `not_implemented` `agent_result_v1`.
12. `generate_typescript_types` re-run; `src/types/supabase.ts` reflects new columns + table.

---

## Handoff

When `02-01-CONTRACT.md` is frozen and the migration is live + stubs register, the contract is stable.
The strategy thread reads `02-01-CONTRACT.md`, then opens **sub-phase 03 (synthesis engine framework)**
with its own RESEARCH extraction pass.

*Context written: 2026-06-30 — Layer 2 orchestration thread, post-01-delta.*
