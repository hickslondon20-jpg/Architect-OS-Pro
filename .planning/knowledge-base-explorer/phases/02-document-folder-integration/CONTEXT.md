# Phase 2 Context — Document-Folder Integration

## Alignment Checkpoint Summary

**Date:** 2026-06-28
**Outcome:** All decisions required for Phase 2 execution are resolved. Wiki system is out of scope — Phase 2 is tightly scoped to raw uploaded documents only.

---

## Key Decisions Governing Phase 2

### Wiki system is out of scope
Wiki-synthesized documents do NOT share the folder tree or the `ose_raw_document_registry` table. They are a separate workstream, separate storage, separate subsection of the OS Engine. Phase 2 does not touch or plan for wiki content in any way.

### Documents table is `ose_raw_document_registry`
This is the canonical registry for all user-uploaded documents. `folder_id` and `full_markdown` go on this table. The `document_chunks` table is not touched in Phase 2.

### The `documents` view must be updated
`public.documents` is a security-invoker view over `ose_raw_document_registry`. It must be recreated to include `folder_id`. It does NOT include `full_markdown` — that column is large and only needed by agent tools (Phases 5–6), not the general UI view.

### `folder_id` is set at upload time by the frontend
The frontend (`lib/osEngineApi.ts`) inserts the `ose_raw_document_registry` row directly via Supabase client before calling `/api/ingest`. `folder_id` is added to that insert — the `/api/ingest` backend endpoint itself does not need to change.

### `full_markdown` is stored during background ingestion
`_process_ingestion` in `main.py` already produces `processed.text` (the full extracted text from Docling). After `mark_parser_complete`, a new `store.store_full_markdown()` call saves this to `ose_raw_document_registry`. The chunks are unchanged.

### Move endpoints go in a new router file
`python-backend/routers/kb_documents.py` handles document moves. Folder parent moves extend `kb_folders.py` with a new PATCH endpoint. Cycle prevention is handled in Python code (recursive ancestor check), not a DB trigger.

### Cascade behavior on folder delete
`folder_id` FK uses `ON DELETE SET NULL` — deleting a folder orphans its documents to `folder_id = NULL` (root level). Documents are not deleted when a folder is deleted. This is the expected behavior: user deletes a folder, documents remain accessible at the root.

---

## Files to Be Created or Modified

| File | Action | Plan |
|---|---|---|
| `docs/migrations/20260628_kb_document_folder_integration.sql` | **Create** | 02-01 |
| `lib/osEngineApi.ts` | **Modify** | 02-02 |
| `python-backend/services/vector_store.py` | **Modify** | 02-03 |
| `python-backend/main.py` | **Modify** | 02-03 |
| `python-backend/routers/kb_documents.py` | **Create** | 02-04 |
| `python-backend/routers/kb_folders.py` | **Modify** | 02-04 |
| `python-backend/main.py` | **Modify** | 02-04 (mount new router) |

---

## What Phase 2 Does NOT Do

- Does not modify `document_chunks`
- Does not touch wiki content, `kb-files` bucket, or `ose_knowledge_pages`
- Does not build any UI (Phase 3)
- Does not implement ls/tree/grep/glob/read tools (Phases 4–6)
- Does not change `/api/ingest` request/response shape
- Does not add `full_markdown` to the `documents` view (too large; agent tools access it directly)

---

## Success Criteria (from ROADMAP.md)

1. Upload endpoint (frontend) accepts `folder_id` and writes it to registry
2. User can move a document from one folder to another via API
3. User can move a folder (with all contents) to a different parent via API — cycle prevention enforced
4. Full extracted markdown is stored alongside chunks for each document

---
*Context written: 2026-06-28 — Phase 1→2 Alignment Checkpoint*
