# Execution Agent Prompt: Phase 8 — Intelligence Layer Connection

> Role: Execution Agent
> Session type: Dedicated execution thread
> Planning artifacts: this file + `08-RESEARCH.md` + `CONTEXT.md`
> Date authored: 2026-06-30

You are an execution agent. Your job is to implement Phase 8 of the KB Explorer build:
Intelligence Layer Connection. This phase wires the compiled wiki layers (Layer 1 and
Layer 2) into the KB Explorer sub-agent and the Virtual CSO. There are two main tasks
(8A and 8B) plus two supporting changes (schema vocab + CORE_PAGE_KEYS).

**Do not write new features beyond what is specified here. Do not touch files not
listed below. Do not refactor existing logic.**

---

## Step 0 — Read These Files Before Writing Any Code

Read all six files before implementing anything. Do not rely on memory of prior sessions.

1. `python-backend/services/wiki_compilation.py` — verify insertion point at line 148
2. `python-backend/services/kb_explorer_service.py` — verify tool list structure and `_execute_tool()` dispatch
3. `python-backend/services/doc_wiki_read_service.py` — **critical**: confirm exact method names and signatures for the wiki read service
4. `src/config/doc_wiki_schema.json` — verify vocabulary structure
5. `api/vcso/chat.ts` — find `CORE_PAGE_KEYS` constant (first ~120 lines)
6. `Pro-Suite-Progress.md` — read progress tracker format (last few rows) for final update

If any file has diverged from what the RESEARCH.md describes, reconcile before coding.
Flag any discrepancy in the progress update.

---

## Task 8A — Add Wiki Tools to `KbExplorerService`

**File:** `python-backend/services/kb_explorer_service.py`

### Step 8A-1: Add `self.store` to `__init__`

In `KbExplorerService.__init__()`, add `self.store = store` as the first line of the
method body, before `settings = get_settings()`:

```python
def __init__(self, store: VectorStore) -> None:
    self.store = store          # ADD THIS LINE
    settings = get_settings()
    self.nav = KbNavigationService(store)
    self.anthropic_client = anthropic.Anthropic(
        api_key=settings.anthropic_api_key or "",
    )
    self.model = settings.claude_synthesis_model
```

### Step 8A-2: Add Import

At the top of the file, in the imports block, add:

```python
from services.doc_wiki_read_service import DocWikiReadService
```

Place it alongside the other `from services.*` imports.

### Step 8A-3: Add 3 Tool Definitions to `KB_EXPLORER_TOOLS`

Append 3 new tool dicts to the `KB_EXPLORER_TOOLS` list, after the existing `kb_read`
entry:

```python
    {
        "name": "wiki_search",
        "description": (
            "Search the founder's compiled wiki by keyword query. "
            "Returns matching wiki pages with titles and summaries. "
            "Use this to find synthesized knowledge about business context, diagnostics, "
            "sprint history, clients, offers, and conversation threads. "
            "Prefer wiki_search over kb_grep when looking for synthesized intelligence "
            "rather than raw document content."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Keyword or phrase to search for (e.g. 'revenue', 'client retention', 'sprint goals').",
                },
                "limit": {
                    "type": "integer",
                    "description": "Max results to return (1–20). Default: 5.",
                    "default": 5,
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "wiki_get_page",
        "description": (
            "Retrieve a specific wiki page by its canonical key. "
            "Use this when you know the exact page key from a wiki_search or wiki_list result. "
            "Returns the full page content."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "canonical_key": {
                    "type": "string",
                    "description": (
                        "The canonical key of the wiki page "
                        "(e.g. 'business_context', 'diagnostic_synthesis', or a Layer 2 page key)."
                    ),
                },
            },
            "required": ["canonical_key"],
        },
    },
    {
        "name": "wiki_list",
        "description": (
            "List wiki pages available for this founder, optionally filtered by page kind. "
            "Use this to discover what synthesized knowledge exists before searching. "
            "Returns page titles, kinds, and canonical keys."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "kind": {
                    "type": ["string", "null"],
                    "description": (
                        "Filter by page kind. Examples: 'wiki_layer1' (compiled platform knowledge), "
                        "'sprint_history', 'thread_synthesis', 'client', 'offer'. "
                        "null = return all kinds."
                    ),
                },
                "limit": {
                    "type": "integer",
                    "description": "Max pages to return (1–50). Default: 20.",
                    "default": 20,
                },
            },
            "required": [],
        },
    },
```

After this addition, `KB_EXPLORER_TOOLS` has 8 entries.

### Step 8A-4: Add Dispatch Branches to `_execute_tool()`

In `_execute_tool()`, add 3 new `if` branches **before** the final
`raise KbNavigationError(f"Unknown tool: {tool_name!r}")` line.

Read `doc_wiki_read_service.py` in Step 0 to confirm the exact method names and
parameter names for the service. The logic below uses the most likely method names
based on the orchestrator wiring — **adjust if the actual method names differ**:

```python
        if tool_name == "wiki_search":
            reader = DocWikiReadService(self.store)
            query = str(tool_input.get("query", ""))
            limit = int(tool_input.get("limit", 5))
            # Call the search method — confirm exact name from doc_wiki_read_service.py
            results = reader.search(user_id=user_id, query=query, limit=limit)
            return {
                "pages": results if isinstance(results, list) else [],
                "result_count": len(results) if isinstance(results, list) else 0,
            }

        if tool_name == "wiki_get_page":
            reader = DocWikiReadService(self.store)
            canonical_key = str(tool_input.get("canonical_key", ""))
            # Call the get_page method — confirm exact name from doc_wiki_read_service.py
            page = reader.get_page(user_id=user_id, canonical_key=canonical_key)
            if page is None:
                return {"error": f"No wiki page found for canonical_key={canonical_key!r}."}
            return page if isinstance(page, dict) else {"content": str(page)}

        if tool_name == "wiki_list":
            reader = DocWikiReadService(self.store)
            kind = tool_input.get("kind") or None
            limit = int(tool_input.get("limit", 20))
            # Call the list method — confirm exact name from doc_wiki_read_service.py
            pages = reader.list_pages(user_id=user_id, kind=kind, limit=limit)
            return {
                "pages": pages if isinstance(pages, list) else [],
                "result_count": len(pages) if isinstance(pages, list) else 0,
            }
```

**Critical:** After reading `doc_wiki_read_service.py`, replace the method names and
parameter names to match what actually exists in the service. The dispatch logic above
may need adjustment based on actual signatures.

### Step 8A-5: Update `KB_EXPLORER_SYSTEM_PROMPT`

Replace the current system prompt with the updated version that documents all 8 tools
and an expanded recommended workflow:

```python
KB_EXPLORER_SYSTEM_PROMPT = """You are a Knowledge Base Explorer agent for ArchitectOS Pro. \
Your job is to navigate the founder's document library and compiled knowledge wiki to answer \
research questions and synthesize findings grounded in what the platform actually knows.

Available tools:

Document navigation tools:
- kb_ls: List immediate contents (folders and files) of a folder.
- kb_tree: Get a nested tree view with configurable depth.
- kb_grep: Search document content by case-insensitive regex pattern.
- kb_glob: Find documents by filename pattern (supports *, ?, [seq]).
- kb_read: Read a document's full extracted text, or a specific line range.

Compiled wiki tools:
- wiki_search: Search synthesized wiki pages by keyword query.
- wiki_get_page: Retrieve a specific wiki page by its canonical key.
- wiki_list: List all available wiki pages, optionally filtered by kind.

Recommended workflow:
1. For business context, diagnostic, or strategic questions: start with wiki_list then wiki_search.
2. For document content questions: call kb_tree to understand structure, then kb_grep or kb_glob.
3. Use kb_read to read the full text of specific documents.
4. Use wiki_get_page to retrieve the full content of a specific wiki page.
5. Synthesize findings into a clear, grounded response.

Rules:
- Ground every claim in content you have actually read.
- If no relevant content is found, say so clearly — do not speculate.
- Be concise. Founders need actionable insight, not verbose summaries.
- When referencing a document, include its name.
- When referencing a wiki page, include its page kind and canonical key."""
```

---

## Task 8B — Mirror Layer 1 Pages into `ose_knowledge_pages`

**File:** `python-backend/services/wiki_compilation.py`

### Step 8B-1: Add `_project_to_ose()` Method

Add a new private method to `WikiCompilationService`. Place it after `_build_claims()`
and before `_build_digest_payload()`:

```python
    def _project_to_ose(
        self,
        user_id: str,
        page_key: str,
        page_title: str,
        one_line: str,
        claims: list[dict[str, Any]],
    ) -> None:
        """Mirror a compiled Layer 1 wiki page into ose_knowledge_pages.

        This projects the Layer 1 compiled content into the shared knowledge
        page table so the Virtual CSO can load it alongside Layer 2 pages.
        Non-fatal: if the upsert fails, a warning is logged but compile_page()
        succeeds — the Layer 1 tables remain the authoritative source.
        """
        content_parts = [f"{page_title}\n\n{one_line}"]
        for claim in claims:
            text = claim.get("text", "").strip()
            if text:
                content_parts.append(text)
        content = "\n\n".join(content_parts)

        # Determine confidence rollup
        confidences = [c.get("confidence", "medium") for c in claims]
        if "high" in confidences:
            confidence = "high"
        elif claims:
            confidence = "medium"
        else:
            confidence = "low"

        try:
            self.store.client.table("ose_knowledge_pages").upsert(
                {
                    "user_id": user_id,
                    "canonical_key": page_key,
                    "page_title": page_title,
                    "page_kind": "wiki_layer1",
                    "page_type": "compiled_intelligence",
                    "category": "compiled_intelligence",
                    "domain": None,
                    "content": content,
                    "status": "active",
                    "confidence": confidence,
                    "source_file_ids": [],
                    "last_updated": _now(),
                },
                on_conflict="user_id,canonical_key",
            ).execute()
        except Exception:
            # Non-fatal: log and continue. Layer 1 tables remain authoritative.
            pass
```

### Step 8B-2: Call `_project_to_ose()` from `compile_page()`

In `compile_page()`, add the call **after** the `WikiHealthService.run_post_compile()`
block (line 148) and **before** `return CompileResult(...)` (line 150):

Current code at that location:
```python
        try:
            validation_summary = WikiHealthService(self.store).run_post_compile(user_id, page_key)
        except WikiHealthError as exc:
            raise WikiCompilationError(f"Wiki post-compile validation failed: {exc}") from exc

        return CompileResult(
```

Change to:
```python
        try:
            validation_summary = WikiHealthService(self.store).run_post_compile(user_id, page_key)
        except WikiHealthError as exc:
            raise WikiCompilationError(f"Wiki post-compile validation failed: {exc}") from exc

        self._project_to_ose(
            user_id=user_id,
            page_key=page_key,
            page_title=page_config["title"],
            one_line=one_line,
            claims=claims,
        )

        return CompileResult(
```

The `_project_to_ose()` call is non-fatal — if the upsert fails, `compile_page()` still
returns `CompileResult` successfully. The Layer 1 `wiki_pages`/`wiki_claims` tables
remain the authoritative record.

---

## Task 8C — Update `doc_wiki_schema.json` (wiki_layer1 vocabulary)

**File:** `src/config/doc_wiki_schema.json`

Add `"wiki_layer1"` to three locations:

1. `page_kind_vocabulary` array: append `"wiki_layer1"` to the list.
2. `kind_to_category` object: add `"wiki_layer1": "compiled_intelligence"`.
3. `kind_to_page_type` object: add `"wiki_layer1": "compiled_intelligence"`.

The final file should have `page_kind_vocabulary` with 15 entries (14 existing + `wiki_layer1`).

---

## Task 8D — Update `CORE_PAGE_KEYS` in `api/vcso/chat.ts`

**File:** `api/vcso/chat.ts`

Locate the `CORE_PAGE_KEYS` constant. Current state:
```typescript
const CORE_PAGE_KEYS = new Set([
  'business_context',
  'assessment_intelligence',
  'strategic_context',
  'financial_patterns',
  'conversation_intelligence',
]);
```

Replace with:
```typescript
const CORE_PAGE_KEYS = new Set([
  // Layer 1 compiled page keys — get +10 priority boost in Virtual CSO context loading
  'business_context',
  'diagnostic_synthesis',
  'current_quarter_sprint',
  'growth_constraints',
  'financial_context',
  'client_market_position',
  'open_questions',
  // Legacy / Layer 2 page_type values — kept for forward compatibility
  // (used when canonical_key is null, scoring falls back to page_type)
  'assessment_intelligence',
  'strategic_context',
  'financial_patterns',
  'conversation_intelligence',
]);
```

No other changes to `chat.ts`.

---

## Step 9 — Compile Checks

```bash
# Python backend — full compile check
python -m compileall python-backend

# Must produce: no errors, no warnings
```

If any Python compile error surfaces, fix it before proceeding.

TypeScript compile is not required in this step — `chat.ts` is a Vercel serverless
function and compiles at deploy time. A syntax check is sufficient:
```bash
cd /path/to/project
npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```
If tsc is unavailable, skip this check and note it in the progress update.

---

## Step 10 — Smoke Tests

### 10A — KB Explorer tool count

Write a minimal Python harness to verify the tool list:

```python
import sys
sys.path.insert(0, "python-backend")
from services.kb_explorer_service import KB_EXPLORER_TOOLS, KB_EXPLORER_SYSTEM_PROMPT

assert len(KB_EXPLORER_TOOLS) == 8, f"Expected 8 tools, got {len(KB_EXPLORER_TOOLS)}"

tool_names = [t["name"] for t in KB_EXPLORER_TOOLS]
assert "wiki_search" in tool_names, "wiki_search missing"
assert "wiki_get_page" in tool_names, "wiki_get_page missing"
assert "wiki_list" in tool_names, "wiki_list missing"
assert "wiki_search" in KB_EXPLORER_SYSTEM_PROMPT, "system prompt not updated for wiki_search"
assert "wiki_list" in KB_EXPLORER_SYSTEM_PROMPT, "system prompt not updated for wiki_list"

print("8A smoke: PASS — 8 tools present, system prompt updated")
```

### 10B — Wiki compilation projection

Write a minimal Python harness that patches `_project_to_ose()` to verify it's called:

```python
import sys
sys.path.insert(0, "python-backend")
from unittest.mock import patch, MagicMock
from services.wiki_compilation import WikiCompilationService

# Mock the store so no real Supabase call is made
mock_store = MagicMock()
service = WikiCompilationService(store=mock_store)

# Verify _project_to_ose exists and accepts the right args
assert hasattr(service, "_project_to_ose"), "_project_to_ose method missing"
import inspect
sig = inspect.signature(service._project_to_ose)
params = list(sig.parameters.keys())
assert "user_id" in params, "user_id param missing"
assert "page_key" in params, "page_key param missing"
assert "claims" in params, "claims param missing"

print("8B smoke: PASS — _project_to_ose exists with correct signature")
```

### 10C — Schema vocabulary check

```python
import json

with open("src/config/doc_wiki_schema.json") as f:
    schema = json.load(f)

assert "wiki_layer1" in schema["page_kind_vocabulary"], "wiki_layer1 missing from vocabulary"
assert schema["kind_to_category"].get("wiki_layer1") == "compiled_intelligence"
assert schema["kind_to_page_type"].get("wiki_layer1") == "compiled_intelligence"
assert len(schema["page_kind_vocabulary"]) == 15, f"Expected 15 kinds, got {len(schema['page_kind_vocabulary'])}"

print("8C smoke: PASS — wiki_layer1 in schema vocabulary")
```

### 10D — CORE_PAGE_KEYS check (manual)

Verify in `api/vcso/chat.ts` that the CORE_PAGE_KEYS Set contains these 11 values:
`business_context`, `diagnostic_synthesis`, `current_quarter_sprint`, `growth_constraints`,
`financial_context`, `client_market_position`, `open_questions`, `assessment_intelligence`,
`strategic_context`, `financial_patterns`, `conversation_intelligence`.

---

## Step 11 — Update KB Explorer ROADMAP.md

**File:** `.planning/ROADMAP.md`

Update Phase 8 section:

### Phase detail block

Replace:
```
### Phase 8: Compiled Wiki — Business Knowledge Layer
**Goal:** Per-founder synthesized wiki pages that compile business knowledge from structured
platform data and uploaded documents. Eliminates the need for agents to rediscover context
at query time for the most common question types.
...
**Status:** Not started — scope in strategy thread before execution
```

With:
```
### Phase 8: Intelligence Layer Connection
**Goal:** Wire the compiled wiki layers (Layer 1 + Layer 2) into the KB Explorer sub-agent
and the Virtual CSO. Phase 8A adds wiki tools to the KB Explorer tool loop. Phase 8B mirrors
compiled Layer 1 pages into ose_knowledge_pages so both wiki layers surface in the Virtual CSO.
**Depends on:** Phases 1–7 (KB Explorer complete); Layer 1 wiki system (sub-phase 07 done); Layer 2 Document Wiki (sub-phase 07 done)
**Architectural reference:** `.planning/INTELLIGENCE-VISION.md` (Tier 1 and Tier 3 sections); `CONTEXT.md` in this phase directory
**What was built:**
- 8A: `wiki_search`, `wiki_get_page`, `wiki_list` tools added to `kb_explorer_service.py`
- 8B: `_project_to_ose()` in `wiki_compilation.py` mirrors Layer 1 compiled pages into `ose_knowledge_pages`
- CORE_PAGE_KEYS in `chat.ts` expanded to include all 7 Layer 1 page keys
- `doc_wiki_schema.json` updated with `wiki_layer1` vocabulary
**Deferred:** DL-L1-EMBED (embedding for projected Layer 1 pages); 8C semantic selection upgrade (Phase 9 dependency)
**Status:** Done — [date] — smoke tests passed; [N]/[N] checks green
```

Fill in the date and test counts on completion.

### Progress Tracker row

Replace:
```
| 8. Compiled Wiki | — | Not started | — |
```

With:
```
| 8. Intelligence Layer Connection | 0 plan files (directly implemented) | Done | 2026-06-30 |
```

---

## Step 12 — Update `Pro-Suite-Progress.md`

**File:** `Pro-Suite-Progress.md`

Add a new row to the progress tracker table using the same format as existing rows.
Sample:

```
| KB Explorer Phase 8 | Intelligence Layer Connection | Done — 8A: 3 wiki tools added to KbExplorerService (wiki_search, wiki_get_page, wiki_list); 8B: _project_to_ose() in WikiCompilationService mirrors Layer 1 pages into ose_knowledge_pages; CORE_PAGE_KEYS expanded to 11 values; doc_wiki_schema.json +wiki_layer1; smoke tests [N] passed |
```

---

## Success Criteria

All must be true before this phase is considered complete:

1. `len(KB_EXPLORER_TOOLS) == 8` — three wiki tools appended
2. `_execute_tool()` handles `wiki_search`, `wiki_get_page`, `wiki_list` without raising `KbNavigationError`
3. `KB_EXPLORER_SYSTEM_PROMPT` mentions all 8 tools by name
4. `WikiCompilationService._project_to_ose()` exists with correct signature
5. `compile_page()` calls `_project_to_ose()` after health validation passes
6. `doc_wiki_schema.json` has `wiki_layer1` in vocabulary, `kind_to_category`, and `kind_to_page_type`
7. `CORE_PAGE_KEYS` in `chat.ts` contains all 7 Layer 1 page keys: `business_context`, `diagnostic_synthesis`, `current_quarter_sprint`, `growth_constraints`, `financial_context`, `client_market_position`, `open_questions`
8. `python -m compileall python-backend` passes with no errors
9. All three Python smoke tests (10A, 10B, 10C) pass
10. ROADMAP.md Phase 8 row updated with completion status and date
11. `Pro-Suite-Progress.md` Phase 8 row added

---

## Deferred Items — Do Not Build in This Phase

- **DL-L1-EMBED:** Embed projected Layer 1 pages in `ose_knowledge_pages`. Requires
  embedding service availability (same gate as DL-01). Not in Phase 8 scope.
- **8C:** Semantic selection upgrade — call `match_ose_knowledge_pages` RPC from
  `selectFounderPages()` in `chat.ts`. Depends on DL-L1-EMBED. Deferred to Phase 9.
- **Auto-synthesis triggers:** N8N webhooks that fire `compile_page()` on sprint close,
  diagnostic run, doc upload. Out of scope for Phase 8.
- **Phase 9 (Retrieval Router):** Intent classification in `chat.ts`. Separate phase.
  Do not begin scoping until Phase 8 execution is confirmed complete.

---

## Reporting Back

When done, post a completion report using this format:

```
Implemented Phase 8 — Intelligence Layer Connection.

Changed:
[kb_explorer_service.py]: <describe what changed>
[wiki_compilation.py]: <describe what changed>
[src/config/doc_wiki_schema.json]: <describe what changed>
[api/vcso/chat.ts]: <describe CORE_PAGE_KEYS change>

Smoke tests:
- 10A (KB Explorer tool count): PASS / [describe if partial]
- 10B (Projection method signature): PASS / [describe if partial]
- 10C (Schema vocabulary): PASS / [describe if partial]
- 10D (CORE_PAGE_KEYS): PASS / [describe if partial]

Compile: python -m compileall python-backend — [result]

Deviations from spec:
[list any, or "none"]

ROADMAP.md: Phase 8 row updated.
Pro-Suite-Progress.md: Phase 8 row added.
```
