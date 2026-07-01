# KB Explorer — Phase 7 Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at `C:\Users\Hicks\ArchitectOS Pro_beta`.

---

You are the execution agent for Phase 7 of the ArchitectOS Knowledge Base Explorer build — the final phase. Your job is to implement exactly what the plan files specify — no more, no less. If you encounter something that requires a decision outside the plans, stop and flag it rather than improvising.

## Read These Files First — In This Order

1. `.planning/phases/07-explorer-agent/CONTEXT.md` — all decisions governing Phase 7
2. `.planning/phases/07-explorer-agent/07-01-PLAN.md` — KbExplorerService new file
3. `.planning/phases/07-explorer-agent/07-02-PLAN.md` — sub_agent_orchestrator.py extension
4. `.planning/phases/07-explorer-agent/07-03-PLAN.md` — requirements, config, capability registration
5. `python-backend/services/sub_agent_orchestrator.py` — understand the existing handler pattern
6. `python-backend/services/agent_capabilities.py` — understand the fallback capability structure
7. `python-backend/core/config.py` — understand the existing settings pattern
8. `python-backend/requirements.txt` — understand the existing deps before adding anthropic

Do not begin implementation until you have read all eight.

## What Phase 7 Builds

Three things, in this order:

**Plan 07-01 (first):** Create `python-backend/services/kb_explorer_service.py`:
- `KB_EXPLORER_SYSTEM_PROMPT` string constant
- `KB_EXPLORER_TOOLS` list of 5 tool definitions
- `KbExplorerResult` frozen dataclass
- `KbExplorerService` class with `run_exploration()` and `_dispatch_tool()` / `_execute_tool()`
- Module-level helpers: `_safe_input_summary`, `_safe_output_summary`, `_item_count`

**Plan 07-02 (after 07-01):** Extend `python-backend/services/sub_agent_orchestrator.py`:
- Add `from services.kb_explorer_service import KbExplorerService` import
- Ensure `AgentSourceRef` is in the `agent_context` import line
- Add `elif capability.capability_key == "kb_explorer_agent"` dispatch branch in `start_run()`
- Add `_handle_kb_explorer(context)` method

**Plan 07-03 (after 07-02):** Multiple small changes:
- Add `anthropic>=0.40.0` to `python-backend/requirements.txt`
- Add `anthropic_api_key` and `claude_synthesis_model` to `core/config.py` Settings
- Add `kb_explorer_agent` to `_fallback_capabilities()` in `agent_capabilities.py`
- Write `docs/migrations/20260628_kb_explorer_capability.sql`
- Apply the migration via Supabase MCP to project `pwacpjqkntnovndhspxt`

## What Phase 7 Does NOT Build

- No streaming events from KB Explorer to frontend
- No sub-agent delegation to document_analysis_agent (AGENT-02 deferred)
- No new FastAPI endpoints (KB Explorer runs through existing `/api/agent-runs`)
- No frontend changes of any kind

## Critical Context

**This is the ONLY place in the Python backend that calls Claude.** The `anthropic_api_key` must be set as a Railway env variable for the live endpoint to work. The local verification approach (see below) does not require a live Anthropic key.

**Tool dispatch is direct Python calls** — NOT HTTP calls to `/api/tools/kb-*` endpoints. `KbExplorerService` creates a `KbNavigationService(store)` and calls its methods directly.

**`can_spawn_agents=False` on `kb_explorer_agent`.** Do not change this. The `get_for_surface()` check blocks capabilities with `can_spawn_agents=True`.

**`allowed_source_kinds=[]` on `kb_explorer_agent`.** This is intentional. The agent discovers documents via tools — no pre-seeded IDs needed.

**`AgentSourceRef` import:** Check whether `AgentSourceRef` is already in the `from services.agent_context import ...` line in `sub_agent_orchestrator.py`. If yes, just add `KbExplorerService` to the imports. If no, add `AgentSourceRef` to that line.

**`_handler_result()` is a module-level function** in `sub_agent_orchestrator.py` — available to `_handle_kb_explorer()` without any changes.

**Migration SQL double-quotes:** The founder's name in the description uses `''` (two single quotes) to escape a single quote in SQL. Confirm the file is written correctly — `founder''s`, not `founder's`.

## Verification Environment

Same constraints as all previous phases: Python 3.14 cannot install `docling`/`tiktoken`. Use `python -m compileall python-backend` for syntax checking. For import smoke, use `.venv-kb-nav` (existing minimal venv) — you may need to `pip install anthropic` into it for the import to resolve.

**The tool-use loop requires a live Anthropic API key to run.** The verification for 07-01 and 07-02 focuses on:
- Compile checks (no Anthropic key needed)
- In-memory `_execute_tool()` smoke (mock the `KbNavigationService`)
- Import resolution in the minimal venv (requires `anthropic` installed in venv)
- `_handle_kb_explorer` handler structural checks (dispatch branch reached, result shape correct)

Do NOT attempt a live end-to-end run against Anthropic unless the `ANTHROPIC_API_KEY` is available in the local environment.

## When You're Done

Update `.planning/STATE.md`:
- Mark all three Phase 7 plans complete in the Phase 7 checklist (add checklist)
- Log execution decisions under "Execution Log (Phase 7)"
- Set "Current focus" to: "Phase 7 complete — KB Explorer build done ✓"
- Update Phase: 7 of 7

Update `.planning/ROADMAP.md`:
- Mark all three Phase 7 plan files complete (`[x]`)
- Update Phase 7 progress row: `3/3` plans complete, status `Complete`, add today's date

This is the final phase. When complete, the full KB Explorer build is done:
- Phases 1–2: Schema and data model
- Phase 3: Ingestion UI
- Phases 4–6: Agent tools (ls, tree, grep, glob, read)
- Phase 7: Explorer Sub-Agent orchestration

## If You Hit a Blocker

Stop and describe:
- What you expected per the plan
- What you found instead
- What decision is needed to proceed

Do not improvise past a blocker. Pay particular attention to the `agent_capabilities` table structure when applying the migration — if the table columns differ from the INSERT statement, flag it before applying.
