# Document Wiki (Layer 2) — Sub-phase 02 Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at
> `C:\Users\Hicks\ArchitectOS Pro_beta`. This session runs sub-phase 02 only (page contract + schema).
> Do not start sub-phase 03.

---

You are the **execution agent** for Sub-phase 02 (Page Contract + Schema) of the ArchitectOS
Document Wiki (Layer 2) build. You build against **decided design** — you make implementation
choices (naming, file placement, SQL column order, test specifics) but **never design choices**.
The reference extraction is done; you do not re-interpret theafh repos or other sources. If
something would require a design decision beyond what the inputs specify, **stop and flag it**
rather than improvising.

You are running inside the `ArchitectOS Pro_beta` repo. The canonical app path is
`C:\Users\Hicks\ArchitectOS Pro_beta`. All file paths below are relative to that root.

---

## Orient first — read these in order, then build

1. `.planning/document-wiki/phases/02-page-contract-schema/02-RESEARCH.md` — **your primary build
   source.** Taxonomy (§1), provenance (§2), links model (§3), index/log semantics (§4), page
   object field-by-field (§5), read tools (§6), write surface (§7), Layer-1 bridge (§8), memory
   hooks (§9), hard rules (§10). Build from this — do not re-derive from theafh.
2. `.planning/document-wiki/phases/02-page-contract-schema/02-01-PLAN.md` — 02-01 task + success
   criteria.
3. `.planning/document-wiki/phases/02-page-contract-schema/02-02-PLAN.md` — 02-02 task + success
   criteria.
4. `.planning/document-wiki/phases/02-page-contract-schema/CONTEXT.md` — scope, decided decisions,
   file list, success criteria.
5. `.planning/document-wiki/CONTEXT.md` — locked decisions ledger (CONTEXT wins over all other docs
   when they conflict).
6. `.planning/document-wiki/phases/01-verify-delta/01-01-DELTA.md` §A (live columns), §F (related
   tables), §H (Layer-1 bridge).
7. `.planning/wiki-system/phases/02-interface-contract/02-01-CONTRACT.md` — Layer 1 contract (style
   reference; adopt the operation-specification format: signature / args / return / actor-scope /
   invariant for every op).
8. `python-backend/services/agent_capabilities.py` — read the existing registration pattern
   (`_fallback_capabilities`, `document_analysis_agent`, `kb_explorer_agent`). Mirror exactly.
9. `python-backend/services/sub_agent_orchestrator.py` — read the existing dispatch pattern.
   Mirror the stub structure.
10. `config/wiki_schema.json` — verify the `ose_page_type` / `page_key` bridge values before
    writing the contract's Layer-1 bridge section.

Read all ten before writing a single line of output.

---

## What you build

Sub-phase 02 has two sequential steps. Complete 02-01 before starting 02-02.

---

### Step 1 — `02-01-CONTRACT.md` (the page contract)

**File:** `.planning/document-wiki/phases/02-page-contract-schema/02-01-CONTRACT.md`
**Version:** `doc-wiki-1.0`

This is the authoritative contract for "what a Layer 2 page is." Every downstream sub-phase (03
synthesis engine, 04 adapters, 05 embeddings, 06 corrections/health, connection phase) builds
against it. Write it completely — do not leave TBDs in the contract.

The contract must specify:

#### A. The page object (full field-by-field specification)
For every field on `ose_knowledge_pages` (existing + new from the migration): type, semantics,
who writes it, when it's set, and what blank/null means. Use `02-RESEARCH.md §5` as your source.
Fields to add in the migration are marked — include their spec now so the contract is complete
ahead of the migration.

Mark clearly: which fields are written by the synthesis engine, which by the founder correction
path, which are reserved for the connection phase (recall/promotion fields).

#### B. `page_kind` vocabulary
The full vocabulary table from `02-RESEARCH.md §1`. State explicitly: extensible config (NOT DB
CHECK); location (`src/config/doc_wiki_schema.json`); new kinds added by editing config, not
running a migration.

#### C. `page_type` bridge rule
How `page_type` (existing Layer-1 bridge field) relates to `page_kind` (emergent). The engine
sets `page_type` from a `kind_to_page_type` mapping in config; fully emergent pages default to
`custom`. Never collapse `page_type` and `page_kind`.

#### D. Provenance contract
`source_file_ids[]` ↔ `connected_pages[]` manifest spec; inline citation format in `content`;
non-document source provenance (`origin_thread_id`, `synthesis_job_id`, dates). Use
`02-RESEARCH.md §2` as source. Include the manifest coherence rule and what violating it means
(lint finding).

#### E. Links contract (`ose_page_links`)
Table spec: columns, relation vocabulary, RLS, uniqueness constraint. The ≥2-links target and the
orphan lint rule. Use `02-RESEARCH.md §3`.

#### F. Read tool surface
For each tool (`docwiki_get_page`, `docwiki_search`, `docwiki_list`): exact signature with arg
types and defaults, return shape (`agent_result_v1` with citations), error modes, actor scope
(which surface/agent class may call it), and the invariant it upholds. Use `02-RESEARCH.md §6`.

#### G. Write surface
Engine synthesis write path (service-role only; sole writer of `content`) and founder correction
path (`ose_page_corrections` → overlay). State the actor scope guards explicitly: no agent may
call a `docwiki_write_page` tool — it does not exist. Use `02-RESEARCH.md §7`.

#### H. Layer-1 bridge contract
The `page_type` → Layer-1 `page_key` mapping (from `config/wiki_schema.json`). The read-only
rule: Layer 2 enriches Layer 1 contexts; it never writes `wiki_claims` or `wiki_evidence`. Use
`02-RESEARCH.md §8`.

#### I. Memory substrate hooks
The three reserved fields (`recall_count`, `last_recalled_at`, `promotion_state`): what they
track, who increments them (connection phase), what the engine sets on page creation. The note
that these are dormant in beta but must be in the schema. Use `02-RESEARCH.md §9`.

#### J. Hard guarantees (conformance clauses for 03–06)
A numbered list of invariants the contract enforces. Sub-phases 03–06 cite these clauses. Include:
1. The synthesis engine is the **sole writer** of `content`. No other actor writes page prose.
2. Founder corrections (`ose_page_corrections`) are **preserved overrides** — they survive every
   re-synthesis and are never clobbered.
3. Every page has a `canonical_key` set by the engine. Dedup is enforced at write time via the
   `(user_id, canonical_key)` unique partial index.
4. `source_file_ids[]` and `ose_raw_document_registry.connected_pages[]` are **always kept
   coherent** by the synthesis engine (no DB FK array; app-level invariant).
5. Contradictions are **flagged, never resolved**. The engine writes the flag; the founder resolves.
6. `pinecone_vector_id` is **never written or read** by any new code path. pgvector is the page-
   embedding substrate.
7. `page_kind` is **never DB-CHECK constrained**. It is extensible config; the engine validates
   against the vocabulary at synthesis time.
8. Layer 2 pages **never duplicate** Layer 1's claim store. The bridge is read-only from Layer 1's
   perspective.

---

### Step 2 — Schema migration + tool registration (02-02)

Only start after `02-01-CONTRACT.md` is written and complete.

#### A. Migration `docs/migrations/YYYYMMDD_docwiki_schema.sql`

Use today's date in the filename. The migration is **additive only** — no drops, no alters to
existing constraints. All existing reads of `ose_knowledge_pages` must continue unaffected.

Required changes:

```sql
-- 1. New columns on ose_knowledge_pages
alter table public.ose_knowledge_pages
  add column if not exists embedding           vector(1536),
  add column if not exists origin_thread_id    text,
  add column if not exists synthesis_job_id    text,
  add column if not exists recall_count        integer not null default 0,
  add column if not exists last_recalled_at    timestamptz,
  add column if not exists promotion_state     text    not null default 'default';

-- 2. Comment the deprecated Pinecone column (do not drop)
comment on column public.ose_knowledge_pages.pinecone_vector_id
  is 'DEPRECATED 2026-06-30: Pinecone is no longer used. pgvector (embedding col) is the page-embedding path. Do not write or read this column in new code.';

-- 3. HNSW index on embedding (mirror document_chunks pattern)
create index if not exists ose_knowledge_pages_embedding_idx
  on public.ose_knowledge_pages
  using hnsw (embedding vector_cosine_ops);

-- 4. ose_page_links table (the page-to-page graph)
create table if not exists public.ose_page_links (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id),
  from_page_id  uuid        not null references public.ose_knowledge_pages(id) on delete cascade,
  to_page_id    uuid        not null references public.ose_knowledge_pages(id) on delete cascade,
  relation      text,
  created_at    timestamptz not null default now()
);

-- unique: no duplicate directional links per user
create unique index if not exists ose_page_links_unique_idx
  on public.ose_page_links (user_id, from_page_id, to_page_id);

-- RLS on ose_page_links (mirror ose_knowledge_pages pattern)
alter table public.ose_page_links enable row level security;

create policy "Users can manage own page links"
  on public.ose_page_links
  for all
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Verify the migration applies cleanly. Check that existing `ose_knowledge_pages` reads in
`lib/osEngineApi.ts` still work after the new columns are added (they should — additive).

#### B. `page_kind` vocabulary config

Create `src/config/doc_wiki_schema.json` with:
- `page_kind_vocabulary`: the full array of kind strings from `02-RESEARCH.md §1`.
- `kind_to_category`: mapping from each `page_kind` to a `category` value.
- `kind_to_page_type`: mapping from each `page_kind` to a `page_type` value (for the Layer-1
  bridge; fully emergent kinds map to `custom`).
- `link_relation_vocabulary`: the relation string list from `02-RESEARCH.md §3`.

This config is runtime-read by the synthesis engine (03). The TypeScript frontend can also import
it for taxonomy-aware UI filtering.

#### C. Tool registration — `agent_capabilities.py`

Add `per_user_document_wiki` to `_fallback_capabilities()` using this shape (mirror the existing
`kb_explorer_agent` or `per_user_wiki` pattern exactly):

```python
{
    "capability_key": "per_user_document_wiki",
    "description": "Layer 2 document wiki: emergent per-user pages synthesized from uploaded documents, CSO threads, sprint history, and domain-agent artifacts.",
    "allowed_tools": ["docwiki_get_page", "docwiki_search", "docwiki_list"],
    "allowed_source_kinds": ["wiki_page", "wiki_page_link"],
    "allowed_surfaces": ["virtual_cso", "os_engine", "domain_agent", "sprint_planning"],
    "output_schema": {"version": "agent_result_v1"},
    "version": "1.0"
}
```

Also insert the DB row (service-role) if the orchestrator persists capabilities to Supabase (check
the existing pattern — some capabilities are DB-only, some fallback-only, some both).

#### D. Stub handler — `sub_agent_orchestrator.py`

Add a `per_user_document_wiki` dispatch branch in `start_run()` (or equivalent dispatch method)
that returns a structured `not_implemented` `agent_result_v1`:

```python
elif capability_key == "per_user_document_wiki":
    return {
        "result_version": "agent_result_v1",
        "status": "not_implemented",
        "capability": "per_user_document_wiki",
        "message": "Document wiki synthesis engine not yet built (sub-phase 03).",
        "citations": [],
        "data": {}
    }
```

Verify that `list_capabilities()` (or equivalent) includes `per_user_document_wiki` after this
change. Run `python -m compileall python-backend` to confirm no syntax errors.

#### E. TypeScript types

After applying the migration to the live Supabase project, run `generate_typescript_types` via the
Supabase MCP to regenerate `src/types/supabase.ts`. Confirm `ose_knowledge_pages` shows the new
columns and `ose_page_links` appears as a new table.

---

## Hard constraints

- **No engine logic.** Stubs + contract + schema only.
- **Additive migration only.** No drops, no alters to existing constraints, no changes to the
  `page_type` or `category` CHECK constraints.
- **Do not touch `wiki_*` tables.** Layer 1 is complete; this build is Layer 2 only.
- **Do not touch the CSO streaming endpoint** (`api/vcso/chat.ts`). That is the connection phase.
- **No new markdown vault files, no JSON-file caches, no CLI scripts.** Substrate is Supabase only.
- **Tool names are fixed.** `docwiki_get_page`, `docwiki_search`, `docwiki_list`. The connection
  phase binds to these exact names; do not rename them.
- **`page_kind` has no DB CHECK.** Validate against the config vocabulary in application code, not
  in the database.
- **No Pinecone.** Never write or call `pinecone_vector_id` in any new code path.
- **Contract is build-source, not aspirational.** If a field spec in the contract differs from what
  the migration adds, they must match. Resolve any discrepancy before calling done.

---

## Done when

All 12 success criteria in `CONTEXT.md` are met:
1. `02-01-CONTRACT.md` is versioned `doc-wiki-1.0` and complete (all fields, all tools, all
   actor-scope guards, Layer-1 bridge, memory hooks, hard guarantees §J).
2. `page_kind` vocabulary is in `src/config/doc_wiki_schema.json` (extensible; not DB CHECK).
3. Provenance contract + links contract specified in `02-01-CONTRACT.md`.
4. Read/write tool surface with actor scope in `02-01-CONTRACT.md`.
5. Layer-1 bridge + memory field reservations in `02-01-CONTRACT.md`.
6. Migration applied; `embedding`, `origin_thread_id`, `synthesis_job_id`, `recall_count`,
   `last_recalled_at`, `promotion_state` columns exist on `ose_knowledge_pages`; HNSW index exists.
7. `ose_page_links` table exists with RLS + unique constraint.
8. `pinecone_vector_id` has deprecation comment; no new code references it.
9. `per_user_document_wiki` registers in `agent_capabilities` + returns from `list_capabilities()`.
10. Orchestrator dispatches `per_user_document_wiki` to a stub returning valid `agent_result_v1`.
11. `python -m compileall python-backend` passes.
12. `generate_typescript_types` run; `src/types/supabase.ts` reflects new schema.

**Report back:**
- One paragraph summarizing what was built.
- Contract version and a list of the §J hard guarantees (confirm they're in the contract).
- Confirmation that the migration is live and TypeScript types are regenerated.
- Any implementation choice you made that deviates from or extends the specified design (so the
  strategy thread can reconcile it into CONTEXT.md).
- Any flag you hit that required a judgment call or that should be surfaced for London's decision.

Then stop. Sub-phase 03 is opened from the strategy thread.
