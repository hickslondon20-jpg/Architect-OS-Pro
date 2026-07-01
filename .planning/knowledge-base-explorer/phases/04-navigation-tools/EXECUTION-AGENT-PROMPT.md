# KB Explorer — Phase 4 Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at `C:\Users\Hicks\ArchitectOS Pro_beta`.

---

You are the execution agent for Phase 4 of the ArchitectOS Knowledge Base Explorer build. Your job is to implement exactly what the plan files specify — no more, no less. If you encounter something that requires a decision outside the plans, stop and flag it rather than improvising.

## Read These Files First — In This Order

1. `.planning/PROJECT.md` — what we're building and why
2. `.planning/phases/04-navigation-tools/CONTEXT.md` — all decisions governing Phase 4
3. `.planning/phases/04-navigation-tools/04-01-PLAN.md` — the service implementation
4. `.planning/phases/04-navigation-tools/04-02-PLAN.md` — the FastAPI endpoints
5. `python-backend/main.py` — understand the existing endpoint pattern before adding new ones
6. `python-backend/services/vector_store.py` — understand VectorStore and how other services use it
7. `python-backend/routers/kb_folders.py` — understand the Supabase client pattern for KB tables

Do not begin implementation until you have read all seven.

## What Phase 4 Builds

Two things, in this order:

**Plan 04-01 (first):** `python-backend/services/folder_navigation.py` — `KbNavigationService` class with `execute_ls`, `execute_tree`, `_resolve_folder_name` methods; internal dataclasses; serialization helpers.

**Plan 04-02 (after 04-01):** Two new endpoints in `python-backend/main.py`:
- `POST /api/tools/kb-ls` → `KbLsRequest` / `KbLsResponse`
- `POST /api/tools/kb-tree` → `KbTreeRequest` / `KbTreeResponse`

Both protected by `Depends(require_ingest_secret)`. Both follow the exact same pattern as `POST /api/tools/web-search`.

## What Phase 4 Does NOT Build

- No grep or glob (Phase 5)
- No read tool (Phase 6)
- No agent orchestration or sub-agent wiring (Phase 7)
- No frontend changes of any kind
- No new Supabase migrations (tables `kb_folders` and `ose_raw_document_registry` already exist)
- No changes to existing endpoints

## Critical Context

**Pattern to follow:** `POST /api/tools/web-search` in `main.py` is the canonical template. Match its error handling, dependency injection, and response model pattern exactly.

**Path references use `folder_id: str | None`** — never string path names. `None` = root of the user's Knowledge Base.

**User isolation:** Every Supabase query must include `.eq("user_id", user_id)`. The service role key gives full DB access — user scoping is the responsibility of the service code, not the DB policy (RLS is belt-and-suspenders, not the primary guard in this path).

**`execute_tree` must use bulk queries** — fetch all folders in 1 query and all files in 1 query, then build the tree in Python. Do not query per folder. The plan's implementation does this correctly — follow it exactly.

**The `folder_navigation.py` service does not import from `main.py`** — it only imports `VectorStore` from `services.vector_store`. The reverse direction (main imports from folder_navigation) is correct.

## Verification Environment

Python 3.14 on this machine cannot install the full `requirements.txt` (docling/tiktoken require C++ compilation). Use the same minimal venv approach as Phase 1:

```bash
python -m venv .venv-kb-nav
.venv-kb-nav/Scripts/Activate.ps1  # or source .venv-kb-nav/bin/activate
pip install fastapi "uvicorn[standard]" supabase pydantic-settings
```

Temporarily comment out non-KB imports in `main.py` for local server startup verification. Restore immediately after.

`python -m compileall python-backend` (full Python 3.14 available) works for syntax checking without the venv.

## When You're Done

Update `.planning/STATE.md`:
- Mark both Phase 4 plans complete in a new Phase 4 checklist
- Log execution decisions not explicitly in the plans
- Set "Current focus" to: "Phase 4 complete — awaiting Phase 4→5 alignment checkpoint"

Update `.planning/ROADMAP.md`:
- Mark both Phase 4 plan files complete (`[x]`)
- Update Phase 4 progress row: `2/2` plans complete, status `Complete`, add today's date

Then stop. Do not begin Phase 5. The strategy thread will review Phase 4 and scope Phase 5 before execution begins.

## If You Hit a Blocker

Stop and describe:
- What you expected per the plan
- What you found instead
- What decision is needed to proceed

Do not improvise past a blocker.
