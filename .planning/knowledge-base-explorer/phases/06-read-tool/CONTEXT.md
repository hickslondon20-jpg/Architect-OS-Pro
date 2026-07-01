# Phase 6 Alignment Context — Read Tool

> Decisions locked in Phase 5→6 alignment checkpoint, 2026-06-28.
> Phase 6 execution agent must read this before touching any file.

---

## What Phase 6 Builds

One agent-callable tool: `read` — fetches the full extracted markdown content of a document (or a line-range slice). Extends `KbNavigationService` with `execute_read()`. One new FastAPI endpoint in `main.py`. No frontend changes, no new migrations.

This is the lightest phase in the build. One method, one endpoint, one dataclass.

---

## read Semantics

**Input:**
```json
{ "user_id": "uuid", "document_id": "uuid", "start_line": null, "end_line": null }
```
or with a line range:
```json
{ "user_id": "uuid", "document_id": "uuid", "start_line": 50, "end_line": 100 }
```

**Output:**
```json
{
  "document_id": "uuid",
  "name": "Q3 Report.pdf",
  "total_lines": 312,
  "start_line": 1,
  "end_line": 312,
  "truncated": false,
  "content": "# Q3 Report\n\nRevenue was $2.1M in Q3..."
}
```

**Content source:** `full_markdown` column of `ose_raw_document_registry`. This is the extracted plain-text/markdown from Docling processing. Binary files are never returned.

---

## Line Indexing

- **1-indexed, inclusive on both ends.** `start_line=1, end_line=10` returns the first 10 lines.
- Lines are produced by `full_markdown.split("\n")`. A document with 3 lines of text has `total_lines=3`.
- Line index validation: `start_line >= 1`, `end_line >= start_line`.
- Out-of-range end: `end_line` is capped at `total_lines` silently (no error). So requesting `end_line=99999` on a 200-line doc returns lines up to 200.

---

## Full Read vs. Line Range

**Full read** (`start_line=None, end_line=None`):
- Returns the entire document.
- Capped at **2000 lines**. If the document has more than 2000 lines, returns the first 2000 and sets `truncated=True`.
- `start_line` in response = 1, `end_line` in response = min(total_lines, 2000).

**Line range read** (`start_line` and `end_line` both provided):
- Returns `lines[start_line-1 : end_line]`.
- Maximum range: **500 lines** (`end_line - start_line + 1 <= 500`). Enforce this in the endpoint via Pydantic validator — return `422 Unprocessable Entity` if exceeded.
- No truncation needed for ranged reads (range is bounded by validation).
- `truncated` in response is always `False` for ranged reads.

**Partial specification** (only one of `start_line`/`end_line` provided):
- Reject at endpoint validation: return `422` with message "Both start_line and end_line must be provided together, or both omitted."
- Implement this as a Pydantic `@model_validator` on `KbReadRequest`.

---

## Not-Found Handling

Two distinct 404 cases:

1. **Document not found:** No row in `ose_raw_document_registry` where `id = document_id AND user_id = user_id`.
   - Raise `KbNavigationError("Document {document_id!r} not found for this user.")` → 404.

2. **Content not available:** Row exists but `full_markdown IS NULL` (document not yet processed by ingestion pipeline).
   - Raise `KbNavigationError("Document content not yet available. Ingestion may still be in progress.")` → 404.

---

## Error Code

- `KbNavigationError` → **404 Not Found** (resource not found — same behavior as ls/tree, different from grep's 400).
- `VectorStoreError` → **502 Bad Gateway**.
- Pydantic validation failures → **422 Unprocessable Entity** (handled automatically by FastAPI).

---

## New Files

None. Method added to `python-backend/services/folder_navigation.py`.

## Modified Files

```
python-backend/services/folder_navigation.py   — add KbReadResult dataclass, execute_read method,
                                                  read_result_to_dict serializer

python-backend/main.py                         — KbReadRequest (with model_validator), KbReadResponse,
                                                  POST /api/tools/kb-read endpoint
```

---

## What Phase 6 Does NOT Build

- No streaming reads (content is returned in full per call)
- No syntax highlighting or format conversion
- No chunk-based retrieval (that's the existing vector search infrastructure)
- No frontend changes
- No new Supabase tables or migrations
- No agent orchestration wiring (Phase 7)
