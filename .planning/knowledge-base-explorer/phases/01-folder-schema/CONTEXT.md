# Phase 1 Context — Folder Schema & Core APIs

## Discuss Phase Summary

**Date:** 2026-06-28
**Outcome:** All decisions required for Phase 1 execution are resolved. Plans are ready.

---

## Decisions Relevant to This Phase

### Folder Visibility Model: Per-User Only
**Decision:** No global folder tier in the schema. The `kb_folders` table is per-user only.
**Why:** ArchitectOS beta is founder-only (no team accounts). Global IP content (IP lenses, skill packs) has separate architecture in Supabase storage and wiki files — it does not share the `kb_folders` table.
**How to apply:** Do NOT add an `is_global` column or visibility enum. Every folder row has a `user_id` and belongs to exactly one founder. RLS enforces this at the database level.

### Backend: Extend Python/FastAPI
**Decision:** All folder CRUD routes go into `python-backend/main.py` (or a new router file mounted there).
**Why:** Phases 4–7 will add KB tool functions (ls, tree, grep, glob, read) to the same Python backend. Building CRUD there now keeps the folder logic co-located with the tools that will use it.
**How to apply:** Add a `kb_folders` router in `python-backend/routers/kb_folders.py` (or inline in `main.py` if simpler). Mount at `/kb/folders`.

### Naming: `kb_` Prefix
**Decision:** Table is `kb_folders`. Routes are `/kb/folders`. Consistent with existing KB naming in codebase.
**How to apply:** All new DB objects and API routes use the `kb_` prefix.

### Authentication: Supabase JWT
**Decision:** All endpoints extract user identity from the Supabase JWT bearer token — same pattern as existing Python backend endpoints.
**How to apply:** Use the existing `get_current_user` dependency pattern in the Python backend. Never accept `user_id` as a request body parameter.

### Cascade Deletes
**Decision:** Deleting a folder cascades to all child folders and all documents in those folders.
**Why:** Founders expect filesystem-like behavior. Orphaned documents in deleted folders would be invisible and unrecoverable.
**How to apply:** `parent_id` FK uses `ON DELETE CASCADE`. Documents table `folder_id` FK uses `ON DELETE SET NULL` or `ON DELETE CASCADE` — resolve in Phase 2 when docs table is modified. For Phase 1 (folders only), folder→folder cascade is sufficient.

---

## What Phase 1 Does NOT Do

- Does not add `folder_id` to the documents table (Phase 2)
- Does not implement file upload to specific folders (Phase 2)
- Does not build any frontend UI (Phase 3)
- Does not implement ls/tree/grep/glob/read tools (Phases 4–6)
- Does not touch IP content, global content, or wiki documents

---

## Files to Be Created or Modified

| File | Action | Notes |
|---|---|---|
| `docs/migrations/YYYYMMDD_kb_folders.sql` | **Create** | Migration: table + indexes + RLS |
| `python-backend/routers/kb_folders.py` | **Create** | FastAPI router with CRUD endpoints |
| `python-backend/main.py` | **Modify** | Mount the new router |

---

## Success Criteria (from ROADMAP.md)

1. `kb_folders` table exists with adjacency list structure (parent_id)
2. User can create a folder at any nesting depth via API
3. User can rename an existing folder via API
4. User can delete a folder — cascades to all child folders
5. RLS policies enforce per-user isolation (users see only their own folders)
6. All endpoints authenticated via Supabase JWT

---
*Context written: 2026-06-28 — Discuss Phase*
