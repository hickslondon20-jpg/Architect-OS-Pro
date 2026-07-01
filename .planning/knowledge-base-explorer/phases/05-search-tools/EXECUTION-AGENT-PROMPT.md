# KB Explorer — Phase 5 Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at `C:\Users\Hicks\ArchitectOS Pro_beta`.

---

You are the execution agent for Phase 5 of the ArchitectOS Knowledge Base Explorer build. Your job is to implement exactly what the plan files specify — no more, no less. If you encounter something that requires a decision outside the plans, stop and flag it rather than improvising.

## Read These Files First — In This Order

1. `.planning/phases/05-search-tools/CONTEXT.md` — all decisions governing Phase 5
2. `.planning/phases/05-search-tools/05-01-PLAN.md` — service additions (folder_navigation.py)
3. `.planning/phases/05-search-tools/05-02-PLAN.md` — FastAPI endpoints (main.py)
4. `python-backend/services/folder_navigation.py` — understand the existing service before extending it
5. `python-backend/main.py` lines 1–20 (imports), 174–200 (KB models), 356–384 (kb-ls and kb-tree) — the exact pattern to follow

Do not begin implementation until you have read all five.

## What Phase 5 Builds

Two things, in this order:

**Plan 05-01 (first):** Extend `python-backend/services/folder_navigation.py`:
- Add `import fnmatch` and `import re` at the top
- Add `KbSearchMatch`, `KbGrepResult`, `KbGlobResult` dataclasses
- Add `_collect_folder_subtree_ids()` as a module-level function
- Add `execute_grep()` and `execute_glob()` methods to `KbNavigationService`
- Add `_match_to_dict()`, `grep_result_to_dict()`, `glob_result_to_dict()` serializers

**Plan 05-02 (after 05-01):** Extend `python-backend/main.py`:
- Add `grep_result_to_dict, glob_result_to_dict` to the folder_navigation import line
- Add `KbGrepRequest`, `KbGrepResponse`, `KbGlobRequest`, `KbGlobResponse` Pydantic models
- Add `POST /api/tools/kb-grep` and `POST /api/tools/kb-glob` endpoints

## What Phase 5 Does NOT Build

- No grep/glob results with content excerpts or line numbers (Phase 6 read tool)
- No `**` folder-path glob traversal (filename-only in v1)
- No frontend changes
- No new Supabase migrations
- No agent orchestration wiring (Phase 7)
- No changes to existing endpoints

## Critical Context

**Error code difference from Phase 4:**  
- Phase 4 `KbNavigationError` → 404 (folder not found)  
- Phase 5 grep `KbNavigationError` → **400 Bad Request** (invalid regex pattern)  
This is intentional. Do not use 404 for grep errors.

**Folder scoping is always recursive.** When `folder_id` is specified, both grep and glob search that folder's entire subtree. There is no `recursive` parameter.

**`execute_grep` must validate the pattern before the Supabase call.** Use `re.compile(pattern)` and raise `KbNavigationError("Invalid regex pattern: ...")` on `re.error`.

**PostgreSQL regex operator:** `.filter("full_markdown", "~*", pattern)` — case-insensitive. Docs with `full_markdown = NULL` will not match (PostgreSQL NULL semantics), which is correct.

**`execute_glob` does NOT filter in Postgres** — it fetches all eligible docs and filters with `fnmatch.fnmatchcase(name.lower(), pattern.lower())` in Python.

**`_collect_folder_subtree_ids` is a module-level function**, not a method on `KbNavigationService`. It is a pure data transformation with no Supabase dependency — place it near the existing serializers.

## Verification Environment

Same constraints as Phases 1–4: Python 3.14 on this machine cannot install `docling` / `tiktoken`. Use the existing minimal venv (or create `.venv-kb-nav` with `fastapi uvicorn[standard] supabase pydantic-settings`) for server-startup and TestClient checks. Use `python -m compileall python-backend` (base Python 3.14) for syntax checking without the venv.

## When You're Done

Update `.planning/STATE.md`:
- Check off both Phase 5 plans in the Phase 5 checklist (add a Phase 5 checklist if not already there)
- Log execution decisions not explicitly in the plans under a "Execution Log (Phase 5)" section
- Set "Current focus" to: "Phase 5 complete — awaiting Phase 5→6 alignment checkpoint"
- Update Phase: 5 of 7

Update `.planning/ROADMAP.md`:
- Mark both Phase 5 plan files complete (`[x]`)
- Update Phase 5 progress row: `2/2` plans complete, status `Complete`, add today's date

Then stop. Do not begin Phase 6. The strategy thread will review Phase 5 and scope Phase 6 before execution begins.

## If You Hit a Blocker

Stop and describe:
- What you expected per the plan
- What you found instead
- What decision is needed to proceed

Do not improvise past a blocker.
