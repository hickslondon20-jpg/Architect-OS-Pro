# Phase 4 Alignment Context — Navigation Tools

> Decisions locked in Phase 3→4 alignment checkpoint, 2026-06-28.
> Phase 4 execution agent must read this before touching any file.

---

## What Phase 4 Builds

Two agent-callable navigation tools: `ls` and `tree`. Pure Python backend — no frontend changes. These are the first KB exploration tools available to the Virtual CSO, Domain Agents, and OS Engine once Phase 7 wires them into the agent loop.

---

## Architecture Decision: Tool Exposure Pattern

**Tools are exposed as FastAPI endpoints** in `main.py`, following the identical pattern to the existing tool endpoints:

```
POST /api/tools/web-search         ← exists
POST /api/tools/structured-query   ← exists
POST /api/tools/kb-ls              ← Phase 4 adds this
POST /api/tools/kb-tree            ← Phase 4 adds this
```

All four are protected by `Depends(require_ingest_secret)` — the `X-Ingest-Secret` header. This is consistent. Do NOT use JWT auth for these endpoints.

---

## Architecture Decision: Path Representation

**`folder_id: str | None`** is the primary reference. `None` = root of the user's KB (docs with `folder_id IS NULL`).

Agents will receive folder IDs in `ls` and `tree` output and use them to chain subsequent calls. Human-readable `path` strings are included in the response as a read-only label — never as input.

This avoids path-resolution complexity, handles renames gracefully, and is unambiguous.

---

## Architecture Decision: User Isolation

**Same pattern as all other tool endpoints** — `user_id` is passed in the request body. The service uses the Supabase **service role key** and filters every query with `.eq("user_id", user_id)`. RLS is enforced at the DB level as well. No JWT in this path.

---

## `ls` Semantics

Returns the immediate children of a folder — one level only.

**Input:**
```json
{ "user_id": "uuid", "folder_id": "uuid-or-null" }
```

**Output:**
```json
{
  "folder_id": null,
  "folder_name": "Knowledge Base",
  "item_count": 5,
  "items": [
    { "type": "folder", "id": "uuid", "name": "Client Docs" },
    { "type": "folder", "id": "uuid", "name": "Internal" },
    { "type": "file",   "id": "uuid", "name": "brief.docx", "file_type": "docx", "status": "ingested" }
  ]
}
```

Items are sorted: folders first (alphabetical), then files (alphabetical).

---

## `tree` Semantics

Returns a nested tree from a root folder down to `depth` levels.

**Input:**
```json
{ "user_id": "uuid", "folder_id": "uuid-or-null", "depth": 3, "limit": 200 }
```

Defaults: `depth=3`, `limit=200`. Max: `depth=10`, `limit=500`.

**Output:**
```json
{
  "folder_id": null,
  "folder_name": "Knowledge Base",
  "depth_requested": 3,
  "total_items": 12,
  "truncated": false,
  "tree": [
    {
      "type": "folder", "id": "uuid", "name": "Client Docs",
      "children": [
        { "type": "folder", "id": "uuid", "name": "Q1 Decks", "children": [] },
        { "type": "file",   "id": "uuid", "name": "proposal.pdf", "file_type": "pdf", "status": "ingested" }
      ]
    },
    { "type": "file", "id": "uuid", "name": "brief.docx", "file_type": "docx", "status": "ingested" }
  ]
}
```

`truncated: true` when the `limit` would be exceeded — the tree is cut at that point with the flag set.

---

## New Files

```
python-backend/services/folder_navigation.py   — KbNavigationService with execute_ls, execute_tree
```

## Modified Files

```
python-backend/main.py   — KbLsRequest, KbLsResponse, KbTreeRequest, KbTreeResponse models
                           POST /api/tools/kb-ls endpoint
                           POST /api/tools/kb-tree endpoint
```

---

## What Phase 4 Does NOT Build

- No grep or glob (Phase 5)
- No read tool (Phase 6)
- No agent orchestration (Phase 7)
- No frontend changes
- No new Supabase tables or migrations (uses `kb_folders` + `ose_raw_document_registry` from Phases 1 and 2)
