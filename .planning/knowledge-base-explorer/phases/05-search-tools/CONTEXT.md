# Phase 5 Alignment Context — Search Tools

> Decisions locked in Phase 4→5 alignment checkpoint, 2026-06-28.
> Phase 5 execution agent must read this before touching any file.

---

## What Phase 5 Builds

Two agent-callable search tools: `grep` (content search) and `glob` (filename pattern matching). Both extend the existing `KbNavigationService` in `folder_navigation.py`. Two new FastAPI endpoints in `main.py`. Pure Python backend — no frontend changes, no new migrations.

---

## grep Semantics

Searches the `full_markdown` column of `ose_raw_document_registry` for documents whose extracted text matches a regex pattern.

**Returns:** A list of matching documents (file identifiers + metadata) — NOT line numbers or content excerpts. The agent receives document IDs to pass to the `read` tool (Phase 6) for deep inspection.

**Input:**
```json
{ "user_id": "uuid", "pattern": "revenue.*Q[34]", "folder_id": "uuid-or-null" }
```

**Output:**
```json
{
  "pattern": "revenue.*Q[34]",
  "scope_folder_id": null,
  "match_count": 2,
  "matches": [
    { "id": "uuid", "name": "Q3 Report.pdf", "file_type": "pdf", "status": "ingested", "folder_id": null }
  ]
}
```

**PostgreSQL operator:** `~*` (case-insensitive regex match). Supabase call:
```python
.filter("full_markdown", "~*", pattern)
```

**Pattern validation:** Call `re.compile(pattern)` before the Supabase query. If the pattern is invalid Python regex, raise `KbNavigationError("Invalid regex pattern: ...")`. Python regex and PostgreSQL regex are not 100% identical but are close enough for agent use.

**Docs with `full_markdown = NULL`** (not yet processed) do not match — this is correct. Only `status = 'ingested'` docs are meaningful targets, but the filter does not hard-restrict to ingested only. If a doc has `full_markdown` populated but `status != 'deleted'`, it may match.

**Limit:** Max 50 results (`limit: int = 50`, max 100).

---

## glob Semantics

Matches document filenames against a glob pattern. No database-level matching — fetch eligible docs, filter with Python `fnmatch`.

**Returns:** A list of matching documents.

**Input:**
```json
{ "user_id": "uuid", "pattern": "*.pdf", "folder_id": null }
```

**Output:**
```json
{
  "pattern": "*.pdf",
  "scope_folder_id": null,
  "match_count": 4,
  "matches": [
    { "id": "uuid", "name": "proposal.pdf", "file_type": "pdf", "status": "ingested", "folder_id": "uuid" }
  ]
}
```

**Pattern matching:** `fnmatch.fnmatchcase(file_name.lower(), pattern.lower())` — case-insensitive. Supports `*`, `?`, `[seq]` wildcards. Does NOT support `**` path traversal (file names only, no folder path component in v1).

**Limit:** Max 200 results.

---

## Folder Scoping (Both Tools)

- **`folder_id = None`**: Search all user docs. No folder constraint.
- **`folder_id = uuid`**: Search docs in that folder AND all descendant folders (recursive subtree).

**No `recursive` parameter is exposed.** Always recursive when folder_id is specified.

**Helper function** `_collect_folder_subtree_ids(all_folder_rows, root_folder_id) -> set[str]` builds the set of all folder IDs in the subtree from a pre-fetched flat list. This avoids N+1 queries — same pattern as `execute_tree`.

When scoping by folder subtree, the Supabase query uses `.in_("folder_id", list(subtree_ids))`. Files at the root of the subtree folder also need to be included (`.eq("folder_id", root_folder_id)` is covered because `root_folder_id` is in `subtree_ids`).

---

## New Files

None. Both methods are added to `python-backend/services/folder_navigation.py`.

## Modified Files

```
python-backend/services/folder_navigation.py   — add KbGrepResult, KbGlobResult dataclasses,
                                                  _collect_folder_subtree_ids helper,
                                                  execute_grep, execute_glob methods,
                                                  grep_result_to_dict, glob_result_to_dict serializers

python-backend/main.py                         — KbGrepRequest, KbGrepResponse, KbGlobRequest,
                                                  KbGlobResponse models; two new tool endpoints
```

---

## What Phase 5 Does NOT Build

- No content excerpts or line numbers in grep results (that's the read tool's job — Phase 6)
- No `**` folder-path glob traversal (filename-only matching in v1)
- No frontend changes
- No new Supabase tables or migrations
- No agent orchestration wiring (Phase 7)
