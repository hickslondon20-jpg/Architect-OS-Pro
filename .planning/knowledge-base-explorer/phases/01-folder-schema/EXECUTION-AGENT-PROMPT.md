# KB Explorer — Phase 1 Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at `C:\Users\Hicks\ArchitectOS Pro_beta`.

---

You are the execution agent for Phase 1 of the ArchitectOS Knowledge Base Explorer build. Your job is to implement exactly what the plan files specify — no more, no less. You do not discuss, redesign, or deviate from the plans. If you encounter something that would require a decision outside the plan, stop and flag it rather than improvising.

## Read These Files First — In This Order

Before writing a single line of code, read all of the following:

1. `.planning/PROJECT.md` — what we're building and why
2. `.planning/REQUIREMENTS.md` — adapted requirement set (note what was removed vs. reference)
3. `.planning/phases/01-folder-schema/CONTEXT.md` — decisions governing Phase 1
4. `.planning/phases/01-folder-schema/01-01-PLAN.md` — DB schema plan
5. `.planning/phases/01-folder-schema/01-02-PLAN.md` — FastAPI CRUD plan
6. `python-backend/main.py` — understand current router mounting pattern before touching it
7. `python-backend/core/config.py` — understand environment variable names
8. `docs/migrations/` — check existing migration file naming to match the convention

Do not begin implementation until you have read all eight.

## What Phase 1 Builds

Two things only:

**Plan 01-01:** The `kb_folders` Postgres table — adjacency list, per-user, RLS policies, indexes, updated_at trigger — delivered as a migration file in `docs/migrations/`.

**Plan 01-02:** FastAPI CRUD endpoints mounted in `python-backend/` — create folder, rename folder, delete folder, list folders. New file at `python-backend/routers/kb_folders.py`, mounted in `python-backend/main.py`.

## What Phase 1 Does NOT Build

- No changes to the documents/chunks table (Phase 2)
- No frontend UI (Phase 3)
- No ls/tree/grep/glob/read tools (Phases 4–6)
- No Explorer sub-agent (Phase 7)
- No global folders, no shared content, no IP content

## Stack Context

- **Python backend:** FastAPI, deployed on Railway. Entry point is `python-backend/main.py`.
- **Database:** Supabase Postgres with pgvector. RLS is already in use across the app — match existing policy patterns.
- **Auth:** All endpoints extract user identity from the Supabase JWT bearer token. Do not accept `user_id` as a request body field. Use the existing auth dependency pattern in the Python backend — do not invent a new one.
- **Migration files:** Live in `docs/migrations/`. Apply via Supabase MCP (`apply_migration`) or confirm application via the Supabase SQL editor.
- **Naming:** `kb_` prefix on all new DB objects and routes. This is already in use in the codebase.

## Execution Order

Run the plans in sequence. Do not start Plan 01-02 until Plan 01-01's verification steps all pass.

**Plan 01-01 first:**
1. Check for any existing `kb_` tables that would conflict
2. Write the migration SQL file
3. Apply the migration
4. Run all 5 verification steps from the plan
5. Confirm done before proceeding

**Plan 01-02 second:**
1. Read `python-backend/main.py` and any existing routers for the auth and mounting pattern
2. Create `python-backend/routers/kb_folders.py`
3. Mount the router in `main.py`
4. Run `python -m compileall python-backend` — must pass with zero errors
5. Run all 9 verification steps from the plan

## When You're Done

Update `.planning/STATE.md`:
- Mark both plans complete in the Phase 1 checklist
- Log the migration filename created
- Log any decisions made during execution that weren't in the plan (anything you had to figure out on your own)
- Set "Current focus" to: "Phase 1 complete — awaiting Phase 1→2 alignment checkpoint"

Also update `.planning/ROADMAP.md`:
- Mark `01-01-PLAN.md` and `01-02-PLAN.md` as complete (change `[ ]` to `[x]`)
- Update Phase 1 progress row: `2/2` plans complete, status `Complete`, add today's date

Then stop. Do not begin Phase 2. Phase 2 requires an alignment checkpoint with London before execution begins.

## If You Hit a Blocker

If something in the plan doesn't match what's actually in the codebase — a missing dependency, a conflicting pattern, an ambiguity the plan didn't anticipate — stop and describe the blocker clearly:
- What you expected (per the plan)
- What you found instead
- What decision is needed to proceed

Do not improvise your way through a blocker. Surface it.
