# KB Explorer — Phase 2 Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at `C:\Users\Hicks\ArchitectOS Pro_beta`.

---

You are the execution agent for Phase 2 of the ArchitectOS Knowledge Base Explorer build. Your job is to implement exactly what the plan files specify — no more, no less. If you encounter something that requires a decision outside the plans, stop and flag it rather than improvising.

## Read These Files First — In This Order

1. `.planning/PROJECT.md` — what we're building and why
2. `.planning/phases/02-document-folder-integration/CONTEXT.md` — all decisions governing Phase 2
3. `.planning/phases/02-document-folder-integration/02-01-PLAN.md` — DB migration
4. `.planning/phases/02-document-folder-integration/02-02-PLAN.md` — frontend upload flow
5. `.planning/phases/02-document-folder-integration/02-03-PLAN.md` — ingestion service (full_markdown)
6. `.planning/phases/02-document-folder-integration/02-04-PLAN.md` — move endpoints
7. `lib/osEngineApi.ts` — understand the full upload function before modifying it
8. `python-backend/services/vector_store.py` — understand existing VectorStore methods
9. `python-backend/main.py` — understand _process_ingestion and router mounting
10. `python-backend/routers/kb_folders.py` — understand auth helpers you will reuse

Do not begin implementation until you have read all ten.

## What Phase 2 Builds

Four things, in this order:

**Plan 02-01 (first):** DB migration — `folder_id` and `full_markdown` columns on `ose_raw_document_registry`, updated `documents` view, folder_id index.

**Plan 02-02 (after 02-01):** Frontend — `folder_id` parameter added to `uploadRawDocument` in `lib/osEngineApi.ts`, passed into both registry inserts (main and duplicate path).

**Plan 02-03 (after 02-01, can run alongside 02-02):** Backend — `store_full_markdown()` method added to `VectorStore`, called in `_process_ingestion` after `mark_parser_complete`.

**Plan 02-04 (after 02-01):** Move endpoints — `PATCH /kb/documents/{id}/folder` in new `routers/kb_documents.py`; `PATCH /kb/folders/{id}/parent` with cycle prevention added to `routers/kb_folders.py`; new router mounted in `main.py`.

## What Phase 2 Does NOT Build

- No wiki content, no `ose_knowledge_pages`, no `kb-files` bucket changes
- No frontend UI for folder browsing or selection (Phase 3)
- No ls/tree/grep/glob/read tools (Phases 4–6)
- No changes to `/api/ingest` request or response shape
- No changes to `document_chunks` table

## Critical Context

**Document registry table is `ose_raw_document_registry`** — not `documents` (that's a view). All column additions and FK constraints go on the base table.

**Frontend creates the registry row directly.** The `uploadRawDocument` function in `lib/osEngineApi.ts` inserts into `ose_raw_document_registry` via Supabase client, then calls `/api/ingest`. `folder_id` goes into that frontend insert. The `/api/ingest` backend endpoint body does NOT change.

**Reuse auth helpers from `kb_folders.py`.** The `get_current_user_id`, `_get_supabase_client`, and `_find_owned_folder` functions are already there. Import and reuse them in `kb_documents.py` — do not create new auth patterns.

**Cycle prevention is in Python, not SQL.** The move-folder endpoint walks the ancestor chain of the new `parent_id` in Python to detect cycles. See 02-04-PLAN.md for the exact implementation.

**`full_markdown` is stored from `processed.text`.** In `_process_ingestion`, after `process_document_bytes()` returns, `processed.text` is the full extracted text. Store it immediately after `mark_parser_complete`. Do not modify `doc_processor.py`.

## Execution Order

Run plans in this order — do not start the next until the prior plan's verification steps pass:

1. **02-01** — DB migration (unblocks everything else)
2. **02-02** — Frontend change (TypeScript, verify build)
3. **02-03** — Backend ingestion change (compile check + ingest a test doc)
4. **02-04** — Move endpoints (compile check + all 9 verification steps)

02-02 and 02-03 can run in parallel if you prefer, but both depend on 02-01 being complete first.

## When You're Done

Update `.planning/STATE.md`:
- Mark all four Phase 2 plans complete in a new Phase 2 checklist
- Log any execution decisions not explicitly in the plans
- Set "Current focus" to: "Phase 2 complete — awaiting Phase 2→3 alignment checkpoint"

Update `.planning/ROADMAP.md`:
- Mark all four Phase 2 plan files complete (`[x]`)
- Update Phase 2 progress row: `4/4` plans complete, status `Complete`, add today's date

Then stop. Do not begin Phase 3. Phase 3 requires a co-creation alignment checkpoint — the existing `UploadsView.tsx` must be reviewed and preserved, and the UI spec must be approved before execution begins.

## If You Hit a Blocker

Stop and describe:
- What you expected per the plan
- What you found instead
- What decision is needed to proceed

Do not improvise past a blocker.
