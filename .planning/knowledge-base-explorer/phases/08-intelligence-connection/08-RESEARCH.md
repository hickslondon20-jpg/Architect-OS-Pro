# Phase 8 Research: Intelligence Layer Connection

> Produced by: Discuss & Plan Orchestration Agent
> Date: 2026-06-30
> Purpose: All verified facts from the connection-point verify pass. Read before implementing anything.

---

## What This Phase Closes

The verify pass (2026-06-30) confirmed two structural gaps that leave the compiled wiki
invisible to the surfaces that need it:

1. **Layer 1 is invisible to the Virtual CSO.** `api/vcso/chat.ts` reads exclusively from
   `ose_knowledge_pages`. Layer 1 (`WikiCompilationService`) writes exclusively to `wiki_pages`
   and `wiki_claims`. There is no path from a compiled Layer 1 page to the Virtual CSO context.

2. **KB Explorer has no wiki tools.** `kb_explorer_service.py` has 5 navigation tools
   (`kb_ls`, `kb_tree`, `kb_grep`, `kb_glob`, `kb_read`) and no access to synthesized wiki
   knowledge. An explorer agent can navigate raw documents but cannot query any of the
   compiled wiki content built across Layer 1 and Layer 2.

Phase 8 closes both gaps. Phase 8C (semantic selection upgrade in `chat.ts`) is deferred —
see §7 below.

---

## §1 — Virtual CSO Connection Point (`api/vcso/chat.ts`)

### Current read pattern

```typescript
const indexResult = await supabase
  .from('ose_knowledge_pages')
  .select('id,page_title,page_type,canonical_key,page_kind,domain,category,status,confidence,last_updated')
  .eq('user_id', userId)
  .neq('status', 'deleted')
  .order('last_updated', { ascending: false });
```

This returns ALL non-deleted rows from `ose_knowledge_pages` ordered by recency. No embedding
filter. No page_kind filter. Every row in that table is a candidate for context loading.

### Page scoring: `selectFounderPages()`

```typescript
const CORE_PAGE_KEYS = new Set([
  'business_context',
  'assessment_intelligence',
  'strategic_context',
  'financial_patterns',
  'conversation_intelligence',
]);
```

Scoring per page:
```typescript
let score = CORE_PAGE_KEYS.has(page.canonical_key ?? page.page_type) ? 10 : 0;
```

- If `canonical_key` is non-null, uses `canonical_key` for the lookup.
- Falls back to `page_type` only if `canonical_key` is null.
- Pages cap at 8 total.

**Gap:** The actual Layer 1 page keys are `diagnostic_synthesis`, `current_quarter_sprint`,
`business_context`, `growth_constraints`, `financial_context`, `client_market_position`,
`open_questions`. Of these, only `business_context` is in the current `CORE_PAGE_KEYS` set.
The other 6 Layer 1 keys will get score = 0 and may be crowded out by Layer 2 pages.

**Fix (part of 8B):** Add all 7 Layer 1 page keys to `CORE_PAGE_KEYS`. Keep the existing
5 values for forward compatibility (they match Layer 2 `page_type` values when `canonical_key`
is null).

**No other changes to `chat.ts` are needed.** Once Layer 1 pages are projected into
`ose_knowledge_pages`, they surface automatically through the existing `loadFounderContext()`
query. Option B (mirror into shared table) means `chat.ts` requires no structural changes —
just the `CORE_PAGE_KEYS` expansion.

### `assemblePrompt()` already handles projected Layer 1 pages

The function assembles a `FOUNDER WIKI COMPACT INDEX` (one line per page) and
`LOADED FOUNDER WIKI PAGES` (full content for selected pages). It reads these from
`ose_knowledge_pages` rows. A projected Layer 1 page is structurally identical to a
Layer 2 page from this function's perspective — it just has `page_kind = "wiki_layer1"`.

---

## §2 — Layer 1 Compilation Service (`wiki_compilation.py`)

### File path
`python-backend/services/wiki_compilation.py`

### All Layer 1 page keys (from `SOURCE_TABLES_BY_PAGE`, lines 34–99)

| page_key | Source tables (count) | Notes |
|---|---|---|
| `diagnostic_synthesis` | 16 | AE + MRA assessment tables |
| `current_quarter_sprint` | 4 | Quarter map + sprint tables |
| `business_context` | 5 | Clarity Compass tables |
| `growth_constraints` | 8 | MRA + GVS + CC tables |
| `financial_context` | 9 | Agency snapshots + founder datasets + docs |
| `client_market_position` | 9 | Agency snapshots + GVS scenarios |
| `open_questions` | 0 | Empty source list — always produces thin page |

### `compile_page()` flow (lines 116–159)

```
line 116  def compile_page(self, user_id, page_key) -> CompileResult:
line 117    validate page_key
line 119    page_config = get_wiki_schema()["pages"][page_key]
line 120    source_rows = self._load_sources(user_id, page_key)
line 121    claims = self._build_claims(user_id, page_key, source_rows)
line 122    one_line = _one_line(page_config["title"], source_rows, claims)
line 123    page_embedding = ...embed(title + one_line)
lines 124-127  embed claim texts
line 129    digest = self._build_digest_payload(...)
lines 130-143  rpc_payload → replace_compiled_wiki_page RPC call
lines 145-148  WikiHealthService.run_post_compile() → validation_summary
lines 150-159  return CompileResult(...)
```

### Insertion point for 8B mirror step

Between lines 148 and 150:

```python
        except WikiHealthError as exc:
            raise WikiCompilationError(f"Wiki post-compile validation failed: {exc}") from exc

        # ← INSERT _project_to_ose() CALL HERE (line 150 is next)

        return CompileResult(
```

At this point the following local variables are available:
- `user_id` — string
- `page_key` — string (e.g., `"business_context"`)
- `page_config` — dict with `"title"` key (e.g., `"Business Context"`)
- `claims` — list of claim dicts; each has `"text"`, `"confidence"`, `"class"`, `"status"`
- `one_line` — string summary sentence
- `validation_summary` — `WikiHealthResult` (not needed for projection)

### `_build_claims()` confidence values

```python
multi_source = len({source["table"] for source in sources}) > 1
confidence = "high" if multi_source else "medium"
```

So each claim has `confidence = "high"` or `"medium"`. Use the same logic for the
projected page's confidence field.

### `_now()` helper

Available at module level: `def _now() -> str` → returns `datetime.now(timezone.utc).isoformat()`

---

## §3 — KB Explorer Service (`kb_explorer_service.py`)

### File path
`python-backend/services/kb_explorer_service.py`

### Current tools (5)

```python
KB_EXPLORER_TOOLS: list[dict[str, Any]] = [
    # kb_ls, kb_tree, kb_grep, kb_glob, kb_read
]
```

`KB_EXPLORER_TOOLS` has exactly 5 entries. `_execute_tool()` has 5 `if` branches ending
with `raise KbNavigationError(f"Unknown tool: {tool_name!r}")`.

### `_execute_tool()` dispatch pattern (lines 355–408)

```python
def _execute_tool(self, user_id, tool_name, tool_input, referenced_doc_ids, referenced_doc_names):
    if tool_name == "kb_ls":
        ...
    if tool_name == "kb_tree":
        ...
    if tool_name == "kb_grep":
        ...
    if tool_name == "kb_glob":
        ...
    if tool_name == "kb_read":
        ...
    raise KbNavigationError(f"Unknown tool: {tool_name!r}")
```

Uses `if` (not `elif`) for each branch. **Add 3 new `if` branches before the final `raise`.**

### `KbExplorerService.__init__` (lines 225–229)

```python
def __init__(self, store: VectorStore) -> None:
    settings = get_settings()
    self.nav = KbNavigationService(store)
    self.anthropic_client = anthropic.Anthropic(api_key=settings.anthropic_api_key or "")
    self.model = settings.claude_synthesis_model
```

`self.store` is NOT set on `__init__`. You'll need to either:
- Set `self.store = store` in `__init__` (add one line), then use `self.store` in wiki tool branches, OR
- Instantiate `DocWikiReadService(store)` by passing `store` as a parameter in `__init__`

**Recommended:** Set `self.store = store` in `__init__` (add `self.store = store` as the first line
of `__init__`). This is consistent with `WikiCompilationService` and other services. Then use
`DocWikiReadService(self.store)` in the new tool branches.

---

## §4 — DocWikiReadService

### File path
`python-backend/services/doc_wiki_read_service.py`

**The execution agent MUST read this file before implementing 8A** to confirm the
exact method names, signatures, and return shapes. The orchestrator dispatches:
- `docwiki_search` → search method
- `docwiki_get_page` → get_page method
- `docwiki_list` → list method

Based on the orchestrator wiring, the service has at minimum:
- A search method (takes `user_id`, `query`, likely `limit`)
- A get_page method (takes `user_id`, `canonical_key` or page identifier)
- A list method (takes `user_id`, optionally `kind`, `limit`)

Confirm exact signatures from the file before writing tool dispatch code.

---

## §5 — `doc_wiki_schema.json`

### File path
`src/config/doc_wiki_schema.json`

### Current vocabulary (14 page_kinds)

```
client, competitor, vendor_partner, offer, method, market_trend,
comparison, query_answer, sprint_history, capability_evolution,
thread_synthesis, agent_artifact, entity, concept
```

### Addition needed for 8B

Add `"wiki_layer1"` to all three locations:

1. `page_kind_vocabulary` list: append `"wiki_layer1"`
2. `kind_to_category`: `"wiki_layer1"` → `"compiled_intelligence"`
3. `kind_to_page_type`: `"wiki_layer1"` → `"compiled_intelligence"`

No Supabase migration required — `ose_knowledge_pages.page_type` has no DB-level check
constraint. The new `page_type = "compiled_intelligence"` value is application-enforced only.

---

## §6 — `ose_knowledge_pages` Upsert Key

Layer 2 upserts use `on_conflict="user_id,canonical_key"`. Use the same constraint for
Layer 1 projected pages. This means:

- Re-running `compile_page()` on the same `page_key` for the same `user_id` will UPDATE
  the existing projected row rather than creating a duplicate.
- Layer 2 pages cannot collide because their `canonical_key` values are document-sourced
  identifiers (e.g., `"dw07_accept_sprint_01"`), not Layer 1 page keys
  (e.g., `"business_context"`).

### Fields to write

| Field | Value |
|---|---|
| `user_id` | from `compile_page()` parameter |
| `canonical_key` | `page_key` (e.g., `"business_context"`) |
| `page_title` | `page_config["title"]` (e.g., `"Business Context"`) |
| `page_kind` | `"wiki_layer1"` |
| `page_type` | `"compiled_intelligence"` |
| `category` | `"compiled_intelligence"` |
| `domain` | `None` |
| `content` | assembled from title + one_line + claim texts (see §8 below) |
| `status` | `"active"` |
| `confidence` | `"high"` if any claim is high, else `"medium"` if any claims, else `"low"` |
| `source_file_ids` | `[]` (Layer 1 pages are compiled from Tier 0 tables, not document files) |
| `last_updated` | `_now()` |
| `embedding` | NOT SET — null (deferred; see §7) |

### Content assembly

```python
content_parts = [f"{page_config['title']}\n\n{one_line}"]
for claim in claims:
    content_parts.append(claim["text"])
content = "\n\n".join(content_parts)
```

This produces a readable block: title/summary at the top, then one paragraph per claim.
The Virtual CSO's `assemblePrompt()` will include this under `LOADED FOUNDER WIKI PAGES`.

---

## §7 — Deferred Items from Phase 8

These are explicitly out of scope. Document as deferred in the ROADMAP.md update.

**DL-L1-EMBED:** Projected Layer 1 pages in `ose_knowledge_pages` do not have embeddings.
The `match_ose_knowledge_pages` RPC (cosine similarity) will not return them. They ARE
visible to the Virtual CSO keyword-score path (`selectFounderPages()`) immediately.
Embedding is required for 8C (semantic selection). Prerequisite: embedding service
availability (same gate as DL-01).

**8C — Semantic selection upgrade:** `selectFounderPages()` in `chat.ts` currently
uses keyword scoring only. The `match_ose_knowledge_pages` RPC exists and could be called
for vector similarity. Deferred: requires embeddings on all pages (DL-L1-EMBED + DL-01),
and TypeScript changes to `chat.ts`. Scope in Phase 9 strategy.

**Auto-synthesis triggers:** N8N webhooks that call `compile_page()` on sprint close,
diagnostic completion, doc upload, etc. Not in Phase 8. Deferred to maintenance roadmap.

**Phase 9 — Retrieval Router:** Depends on Phase 8 completion. Intent classification +
tier selection logic in `chat.ts`. Do not scope in this phase.

---

## §8 — Sub-Agent Orchestrator: No Changes Needed

`sub_agent_orchestrator.py` is fully wired:
- `_handle_per_user_document_wiki()` → `DocWikiReadService` (dispatches docwiki_search/get_page/list)
- `_handle_kb_explorer()` → `KbExplorerService` (dispatches the 5 nav tools)
- `_handle_per_user_wiki()` → `WikiReadService` (Layer 1 read path)

Phase 8 adds wiki tools INSIDE `KbExplorerService` (so Claude can call them during
an exploration loop) — not a new orchestrator handler. The orchestrator doesn't change.

---

## §9 — `wiki_read.py` and `wiki_writeback.py`: No Changes Needed

`wiki_read.py` reads from `wiki_pages`/`wiki_claims` — unchanged.
`wiki_writeback.py` writes to `wiki_pages`/`wiki_claims` — unchanged.

Phase 8 does NOT touch these files. The 8B mirror is an additional output path in
`wiki_compilation.py`, not a replacement of the existing wiki tables.

---

## Files the Execution Agent Must Read Before Starting

1. `python-backend/services/wiki_compilation.py` — insertion point verification
2. `python-backend/services/kb_explorer_service.py` — tool list + dispatch pattern
3. `python-backend/services/doc_wiki_read_service.py` — method signatures (critical for 8A)
4. `src/config/doc_wiki_schema.json` — vocabulary structure
5. `api/vcso/chat.ts` (lines 1–120 sufficient) — `CORE_PAGE_KEYS` + `selectFounderPages()`
6. `Pro-Suite-Progress.md` — progress tracker (for final update step)
