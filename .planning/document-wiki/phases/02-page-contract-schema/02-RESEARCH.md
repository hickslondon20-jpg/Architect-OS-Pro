# Sub-phase 02 — Reference Extraction (build-ready)

**Purpose:** turns the `REFERENCES.md` pointers for sub-phase 02 into decided, build-ready design.
The execution agent implements the page contract and schema from this file and does **not** re-interpret
the theafh source repos. Adopt the shapes, semantics, and conventions below; reject all substrate
(markdown-on-disk, Obsidian vault, CLI tools, frontmatter-enum mechanism).

**Sources grounded against:**
- `../../REFERENCES.md` (L2-1/L2-4/L2-5/L2-7)
- `../../CONTEXT.md` (all resolved decisions, §7 memory substrate)
- `../01-verify-delta/01-01-DELTA.md` §A–H (live schema + gap table)
- `../../wiki-system/phases/02-interface-contract/02-01-CONTRACT.md` (Layer 1 contract — reuse style)
- `config/wiki_schema.json` (Layer-1/Layer-2 bridge mapping)

**What sub-phase 02 freezes:** the page object contract (02-01), the additive schema migration +
`page_kind` vocabulary + links model + tool registration stubs (02-02). No engine, no embeddings.

---

## 1. L2-1 — Page-kind taxonomy (the emergent axis)

**theafh model (concept only — adopt, not substrate):**
> "Entity, concept, comparison, summary, query, procedure. The type is emergent — it reflects what
> the document is *about*, not a platform-imposed category. The list is never exhaustively pre-defined;
> the engine infers kind from source context and content."

**Our `page_kind` vocabulary (decided — freeze this list; it is extensible config, not a DB CHECK):**

| `page_kind` value | Meaning | Primary source(s) |
|---|---|---|
| `client` | A specific client or prospect | Documents (contracts, proposals, call notes) |
| `competitor` | A named competitor | Documents (research, proposals) |
| `vendor_partner` | Tool, vendor, or strategic partner | Documents |
| `offer` | A productized service or offer | Documents, sprint artifacts |
| `method` | A methodology, framework, or process | Documents, CSO threads |
| `market_trend` | A market pattern or macro signal | Documents |
| `comparison` | A head-to-head or decision matrix | Documents, CSO threads |
| `query_answer` | A filed answer to a specific founder question | CSO threads |
| `sprint_history` | A completed sprint record | Sprint data (longitudinal) |
| `capability_evolution` | AE Ladder / capability arc over time | Sprint + diagnostic data |
| `thread_synthesis` | A substantive CSO conversation distilled into a page | CSO threads |
| `agent_artifact` | A domain-agent output that earned its own page | Domain agent artifacts |
| `entity` | Generic named entity that doesn't fit a more specific kind | Documents |
| `concept` | A named concept, principle, or idea | Documents, CSO threads |

**Canonical location for this vocabulary:** `src/config/wiki_schema.json` (or a new
`src/config/doc_wiki_schema.json`) — a `page_kind_vocabulary` array. NOT a Postgres CHECK constraint.
The engine reads the config, not the DB, when classifying pages. New kinds are added by editing config,
not running a migration.

**The `page_type` field (keep, do not fight):** existing DB CHECK constrains to
`business_context | assessment_intelligence | strategic_context | financial_patterns |
conversation_intelligence | custom`. This is the **Layer-1 bridge / area mapping** (§8 below) —
it is NOT the emergent type. `page_kind` is the emergent type. The two fields serve different purposes;
never collapse them.

**The `category` field (keep, UI grouping):** constrained to `financial | client_market | operational |
conversation_meeting | org_health | founder_identity`. This is the UI sidebar/filter axis — independent
of `page_kind`. The engine sets `category` based on `page_kind` using a mapping table in config:

```
client / competitor / market_trend → client_market
vendor_partner / offer → operational
method / concept / entity → founder_identity (or operational, by content)
comparison / query_answer / thread_synthesis → conversation_meeting
sprint_history / capability_evolution / agent_artifact / capability → operational
```

Override by domain if available. The exact mapping lives in config alongside `page_kind_vocabulary`.

---

## 2. L2-4 — Provenance contract

**theafh model (concept only):**
> "Every claim is pinned to its source. The page carries a validated source inventory. Inline citations
> mark where in the prose a source supports the statement. Orphaned citations (source no longer in KB)
> are a lint finding."

**Our provenance contract (decided):**

### 2a. `source_file_ids[]` — page → documents manifest

- `ose_knowledge_pages.source_file_ids uuid[]` — array of `ose_raw_document_registry.id` values that
  contributed to this page.
- Engine **maintains this array** on every synthesis/update — add IDs for new sources, never remove
  unless the source document is deleted.
- No DB FK array constraint (postgres can't FK arrays cleanly). Engine enforces consistency at
  write time.
- If `source_file_ids` is empty the page is either a pure-synthesis page (thread/sprint/artifact) or
  orphaned — the latter is a lint finding (06).

### 2b. `connected_pages[]` — document → pages reverse manifest

- `ose_raw_document_registry.connected_pages uuid[]` — the reverse: which page IDs were synthesized
  from this document.
- Engine updates this array at the same time it updates `source_file_ids[]` (atomic write or
  compensating update — service-role, not a DB trigger).
- Manifest coherence rule: `page.source_file_ids ∋ doc_id  ⟺  doc.connected_pages ∋ page_id`.
  Any divergence is a lint finding.

### 2c. Inline citations in `content`

- Every prose page should carry **inline citations** linking statements to source documents/chunks.
- Format: `[[Source: {doc_title} §{section}]]` or Markdown-link to the document's KB URL — the exact
  format is an implementation detail for the execution agent, but it must be machine-parseable for
  the lint pass (06).
- No footnote markers, no `sources:` YAML frontmatter.
- Citations reference `ose_raw_document_registry` IDs (for documents) or `document_chunks` IDs
  (for specific excerpts).

### 2d. Non-document sources

For thread/sprint/agent pages, `source_file_ids` is empty or contains related doc IDs. The
provenance is carried instead by:
- `origin_thread_id text` (already scaffolded on `ose_knowledge_pages` — delta §E clue). For CSO
  thread pages. Confirm column exists; add in migration if absent.
- `synthesis_job_id text` (scaffolded in delta §E clues) — the async job that created this page.
- `effective_date / observed_date` — temporal provenance for sprint and longitudinal pages.

---

## 3. L2-5 — Cross-references / the page graph

**theafh model (concept only):**
> "Every page links at least two other pages in the wiki. These are real semantic links, not incidental
> mentions. The graph — not just individual pages — is the knowledge structure. Orphaned pages with
> no links are always a lint finding."

**Our links model (decided — use a dedicated links table):**

`source_file_ids[]` handles doc→page manifest links. `connected_pages[]` handles the reverse.
Neither handles page→page semantic links. Use a separate table:

```sql
create table if not exists public.ose_page_links (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id),
  from_page_id uuid not null references public.ose_knowledge_pages(id) on delete cascade,
  to_page_id   uuid not null references public.ose_knowledge_pages(id) on delete cascade,
  relation    text,        -- e.g. 'related', 'supersedes', 'supports', 'contradicts', 'derived_from'
  created_at  timestamptz not null default now()
);
-- RLS mirrors ose_knowledge_pages (user_id scope)
-- Unique: (user_id, from_page_id, to_page_id) to prevent dup links
```

**`relation` vocabulary** (not DB-CHECK, extensible config): `related`, `supersedes`, `supports`,
`contradicts`, `derived_from`, `summarizes`. Engine sets relation during synthesis.

**Hard rule (theafh adopt):** the engine targets ≥2 links per page on synthesis. Orphaned pages
(0 links in or out) are a 06-lint finding.

**Extract/skip:** we adopt the graph *concept* and the lint rule. We skip Obsidian graph view and
any markdown-file-based link syntax.

---

## 4. L2-7 — Index + Log semantics

**theafh model (concept only — `index.md` catalog + append-only `log.md`):**
> "The index is the top-level catalog — all pages, sortable. The log is append-only history of every
> wiki event (ingest, synthesis, correction, lint run). Both are machine-readable."

**Our implementation (decided — no markdown files; use existing Supabase tables + UI surfaces):**

### 4a. IndexView catalog (`ose_knowledge_pages` → `IndexView`)

The existing `IndexView` reads `ose_knowledge_pages` ordered by `last_updated`. The contract must
specify what fields the index display requires so the engine always populates them:
- `page_title` — required; human-readable display name.
- `page_kind` — required; the emergent type filter.
- `category` — required; the UI sidebar group.
- `word_count` — required; auto-computed by engine on write.
- `status` — required; `active | archived | deleted`.
- `source_file_ids` length → source count (the "N sources" UI metric).
- `last_updated` — sort key.

### 4b. Activity log (`ose_activity_log` → `LogView`)

The existing `ose_activity_log` (`kind in ('activity','decision')`) is our event log. The synthesis
engine writes log events using:
- `kind = 'activity'` — ingestion/synthesis events (page created, page updated, embedding refreshed).
- `kind = 'decision'` — judgment events (contradiction flagged, page-worthiness gate skipped,
  correction applied).

Engine log event shape: `{ user_id, kind, text: "[EventType] {details}", icon: "…" }`.

**Note on the CHECK constraint:** the existing `kind in ('activity','decision')` constraint is
sufficient — no migration needed. Synthesis events fit cleanly into these two kinds. The `text`
field carries event specifics.

---

## 5. The page object — field-by-field decided semantics

This is the canonical reference for `02-01-CONTRACT.md`. Every field on `ose_knowledge_pages`
is specified; the execution agent does not invent new semantics.

```
page object {
  id                  uuid            — primary key; system-assigned
  user_id             uuid            — owner; all RLS scoped here
  page_type           text            — Layer-1 bridge / area (CHECK constrained; engine sets from kind→type map; defaults 'custom' for fully emergent pages)
  page_kind           text            — EMERGENT TYPE (the vocabulary in §1; extensible; NOT DB CHECK)
  page_title          text            — human-readable display name; engine synthesizes or derives
  content             text            — prose markdown with inline citations (§2c); engine is the only writer of synthesized content; founder corrections applied as overlays (§7 write surface)
  category            text            — UI group (CHECK constrained; engine sets from kind→category map in §1)
  domain              text            — optional sub-domain tag (e.g. 'client_services', 'growth'); engine sets if classifiable
  source_file_ids     uuid[]          — page → doc manifest (§2a); engine maintains
  canonical_key       text            — identity/dedup key; unique per user when set; engine sets as slugified topic ('client_acme', 'method_architect_framework'); CSO prefers this for page matching
  confidence          numeric         — synthesis confidence (0.0–1.0); set by executive_summary self-rating primitive (L2-10); displayed in UI
  word_count          integer         — auto-computed by engine on every write; drives IndexView metric
  status              text            — 'active' | 'archived' | 'deleted'; engine defaults 'active'; CSO excludes 'deleted'
  effective_date      date            — when the page content is valid from (for sprint/temporal pages: sprint start)
  observed_date       date            — when the source was observed/uploaded (for doc pages: upload date)
  review_date         date            — staleness signal; engine sets based on source recency / page_kind
  origin_thread_id    text            — CSO thread ID for thread_synthesis pages (add in migration if absent)
  synthesis_job_id    text            — async job that last wrote this page (add in migration if absent)
  pinecone_vector_id  text            — DEPRECATED (keep column, stop writing/reading; pgvector replaces)
  embedding           vector(1536)    — pgvector page embedding (ADD IN MIGRATION — sub-phase 02-02)
  recall_count        integer         — memory substrate: incremented on genuine retrieval (connection phase activates; reserve now) (ADD IN MIGRATION)
  last_recalled_at    timestamptz     — memory substrate: last retrieval timestamp (connection phase activates; reserve now) (ADD IN MIGRATION)
  promotion_state     text            — memory substrate: 'default' | 'promoted' | 'dormant' (ADD IN MIGRATION)
  last_updated        timestamptz     — updated by engine on synthesis; UI sort key
  updated_at          timestamptz     — generic row-level update timestamp
}
```

**Fields to add via migration (02-02):** `embedding vector(1536)`, `origin_thread_id text`,
`synthesis_job_id text`, `recall_count integer not null default 0`, `last_recalled_at timestamptz`,
`promotion_state text not null default 'default'`.

**Fields that exist but are unwritten:** `confidence`, `effective_date`, `observed_date`,
`review_date`, `domain`, `page_kind` — currently scaffolded but the engine never wrote them.
The synthesis engine writes all of them.

---

## 6. Read tool surface

Three tools on the `per_user_document_wiki` capability. The execution agent names them exactly as
specified — the connection phase binds to these names.

| Tool | Signature | Returns | Actor scope |
|---|---|---|---|
| `docwiki_get_page` | `(canonical_key: str \| page_id: uuid)` | `agent_result_v1` with `page_object` + `citations[]` | Virtual CSO, OS Engine, Domain Agents, orchestrator |
| `docwiki_search` | `(query: str, page_kind?: str, category?: str, limit?: int = 5)` | `agent_result_v1` with `pages[]` ranked by semantic similarity (05 fills the real search; stub returns empty list) | Virtual CSO, Domain Agents, orchestrator |
| `docwiki_list` | `(category?: str, page_kind?: str, status?: str = 'active', limit?: int = 20)` | `agent_result_v1` with `index[]` (title, kind, category, word_count, last_updated, canonical_key) | All surfaces |

All return `agent_result_v1` shape (mirror Layer 1's `per_user_wiki` pattern). `citations` in
`docwiki_get_page` carry `source_file_ids` as `AgentSourceRef` entries.

**Extract/skip:** adopt the read-API *concept* from theafh's wiki query operation; skip their
`grep`-based search (we use pgvector in 05), their CLI invocation, and their on-disk index file.

---

## 7. Write surface (actor scope)

Two write paths. The contract must name both and enforce actor scope.

| Path | Actor | What it writes | Guard |
|---|---|---|---|
| **Engine synthesis write** | Synthesis engine (service-role) only | `content`, all metadata fields, `source_file_ids`, `embedding` (05), links | Only the synthesis service may write `content`. No agent, no founder direct write. |
| **Founder correction** | Founder via `NotesComposer` → `ose_page_corrections` | `body` (the override text), `status` | Corrections are a preserved overlay — engine re-applies them on every re-synthesis (CONTEXT §3 corrections lifecycle). `addPageCorrection()` already exists in `lib/osEngineApi.ts`. |

No `docwiki_write_page` tool exists in the agent-facing surface. The synthesis engine is the single
writer of page content (mirrors Layer 1's compiled-base write-lock, L2 decision).

**`ose_page_corrections` contract (existing table, no migration needed):**
```
{ id, user_id, page_id, body (text), status ('pending'|'applied'), created_at }
```
Engine reads pending corrections before re-synthesizing a page, applies them as overlays, marks
status `applied`. Founder edits are never clobbered.

---

## 8. Layer-1 bridge

**Source:** `config/wiki_schema.json` (verified in delta §H).

The seven Layer-1 `page_key`s map to `ose_page_type` values:

| Layer-1 `page_key` | `ose_page_type` |
|---|---|
| `business_context` | `business_context` |
| `diagnostic_synthesis` | `assessment_intelligence` |
| `current_quarter_sprint` | `strategic_context` |
| `growth_constraints` | `strategic_context` |
| `financial_context` | `financial_patterns` |
| `client_market_position` | `business_context` |
| `open_questions` | `conversation_intelligence` |

**Contract rule:** Layer 2 pages with a `page_type` value matching a Layer-1 bridge type
surface into Layer-1 contexts when the agent queries that context — **without duplicating Layer 1's
claim store**. The bridge is read-only from Layer 1's perspective: it reads `ose_knowledge_pages`
for depth; it does not write claims into Layer 1's `wiki_claims` / `wiki_evidence` tables.

**For fully emergent Layer 2 pages** (client/competitor/vendor pages with no Layer-1 counterpart),
`page_type` should be `custom`. The `page_kind` + `canonical_key` identify these pages uniquely.

---

## 9. Memory substrate hooks (CONTEXT §7 — reserve now, activate at connection phase)

Layer 2 is the durable substrate the platform's memory and self-learning loops will build on.
The page is the unit of recall and promotion. Three fields are reserved in the schema now so the
memory loop doesn't require a migration later:

| Field | Type | Semantics |
|---|---|---|
| `recall_count` | `integer not null default 0` | Incremented each time this page is genuinely retrieved in a CSO/agent context. The promotion pre-filter. Connection phase activates the increment. |
| `last_recalled_at` | `timestamptz` | Timestamp of most recent retrieval. Staleness signal for the memory loop. |
| `promotion_state` | `text not null default 'default'` | `default` (standard), `promoted` (founder-marked or recall-threshold-crossed), `dormant` (recall dried up; candidate for archive). |

**Build note:** These fields exist in the schema from sub-phase 02 onward. The synthesis engine
writes `recall_count = 0`, `promotion_state = 'default'` on page creation. The CSO read-hook
(connection phase) will increment `recall_count` / update `last_recalled_at`. Do not add a
CHECK constraint to `promotion_state` — the memory loop will add values as the feature matures.

---

## 10. Hard rule — substrate rejection

Everything above is a model, convention, or semantic contract. The execution agent must not:
- Create markdown files as the page store.
- Create JSON files as the index or log.
- Use Obsidian-style wiki links (`[[Page Name]]`) as the link mechanism.
- Reference theafh's CLI scripts (`wiki_import`, `wiki_fix`, `wiki_wrapup` as executables).
- Add a Pinecone call or revive `pinecone_vector_id` for any new path.

Substrate is Supabase + pgvector + the existing OS Engine tables. Every pattern above maps
onto that substrate.
