# KB Explorer — Phase 6 Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at `C:\Users\Hicks\ArchitectOS Pro_beta`.

---

You are the execution agent for Phase 6 of the ArchitectOS Knowledge Base Explorer build. Your job is to implement exactly what the plan files specify — no more, no less. If you encounter something that requires a decision outside the plans, stop and flag it rather than improvising.

## Read These Files First — In This Order

1. `.planning/phases/06-read-tool/CONTEXT.md` — all decisions governing Phase 6
2. `.planning/phases/06-read-tool/06-01-PLAN.md` — service addition (folder_navigation.py)
3. `.planning/phases/06-read-tool/06-02-PLAN.md` — FastAPI endpoint (main.py)
4. `python-backend/services/folder_navigation.py` — understand the existing service before extending it
5. `python-backend/main.py` lines 1–20 (imports), last KB model block, last tool endpoint — the exact pattern to follow

Do not begin implementation until you have read all five.

## What Phase 6 Builds

Two things, in this order:

**Plan 06-01 (first):** Extend `python-backend/services/folder_navigation.py`:
- Add `_FULL_READ_MAX_LINES = 2000` and `_RANGE_READ_MAX_LINES = 500` class constants to `KbNavigationService`
- Add `KbReadResult` dataclass
- Add `execute_read()` method to `KbNavigationService`
- Add `read_result_to_dict()` serializer

**Plan 06-02 (after 06-01):** Extend `python-backend/main.py`:
- Add `read_result_to_dict` to the folder_navigation import line
- Add `model_validator` to the pydantic import (if not already present)
- Add `KbReadRequest` (with `@model_validator`) and `KbReadResponse` Pydantic models
- Add `POST /api/tools/kb-read` endpoint

## What Phase 6 Does NOT Build

- No streaming reads
- No format conversion or syntax highlighting
- No chunk-based retrieval
- No frontend changes
- No new Supabase migrations
- No agent orchestration wiring (Phase 7)

## Critical Context

**Two distinct 404 cases in `execute_read`:**
1. No row found for `document_id + user_id` → `KbNavigationError("Document ... not found for this user.")`
2. Row found but `full_markdown IS NULL` → `KbNavigationError("Document content not yet available. Ingestion may still be in progress.")`

Both map to 404. The service raises `KbNavigationError` for both. The endpoint converts to `HTTP_404_NOT_FOUND`.

**`KbNavigationError` → 404 for this endpoint** — same as ls/tree, NOT 400 like grep.

**The service does NOT enforce the 500-line range cap.** That is the Pydantic `@model_validator`'s job. The service only enforces the 2000-line full-read cap.

**`@model_validator(mode="after")` accesses fields as `self.start_line`, not `values["start_line"]`.**

**Partial line range (only start OR only end provided) → 422.** The validator must reject these, not default them.

**`end_line` out-of-range is silently capped** by `min(end_line, total_lines)` in the service — no error raised.

## Verification Environment

Same constraints as Phases 1–5: Python 3.14 cannot install `docling`/`tiktoken`. Reuse `.venv-kb-nav` if present, or create a fresh one with `fastapi uvicorn[standard] supabase pydantic-settings`. Use `python -m compileall python-backend` for syntax checking.

## When You're Done

Update `.planning/STATE.md`:
- Mark both Phase 6 plans complete in the Phase 6 checklist (add checklist if not present)
- Log execution decisions under "Execution Log (Phase 6)"
- Set "Current focus" to: "Phase 6 complete — awaiting Phase 6→7 alignment checkpoint"
- Update Phase: 6 of 7

Update `.planning/ROADMAP.md`:
- Mark both Phase 6 plan files complete (`[x]`)
- Update Phase 6 progress row: `2/2` plans complete, status `Complete`, add today's date

Then stop. Do not begin Phase 7. The strategy thread will review Phase 6 and scope Phase 7 before execution begins.

## If You Hit a Blocker

Stop and describe:
- What you expected per the plan
- What you found instead
- What decision is needed to proceed

Do not improvise past a blocker.
