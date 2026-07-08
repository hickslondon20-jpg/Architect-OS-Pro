# Phase 7 Completion - VCSO -> Domain Agent Invocation (`@Agent`)

**Completed:** 2026-07-06
**Status:** Code-complete and locally verified. Live Anthropic/browser smoke deferred per L18.

## What Shipped

- Added pre-loop `_detect_agent_invocation` handling in `python-backend/services/vcso_chat_service.py`.
- Resolves leading/standalone `@Agent` mentions by case-insensitive key/name aliases, including `@FinancialAgent`.
- Reuses the existing Phase-2 seam:
  `HarnessEngine.create_task(origin='vcso', origin_thread_id=...)`.
- Maps the request remainder to an existing agent workflow when possible.
- Captures every invocation in `freeform_requests`; unmapped requests still create a free-form task with `workflow_id=None`.
- Emits an `agent_task` SSE event and persists the handle payload through `agent_delegation_runs.structured_result.agent_task`, so VCSO history reconstructs after reload without schema changes.
- Added a VCSO thread card using `DomainAgentPrimitives` (`AgentMark`, `StatusChip`) with:
  - task status chip,
  - Open in Workspace,
  - View artifact when one exists,
  - refresh-on-open plus light polling.

## Guardrails Verified

- **L14 preserved:** the VCSO path creates a task handle and returns; it does not run or stream Domain Agent task execution inside the VCSO loop.
- **No new migration:** reused `tasks.origin='vcso'`, `origin_thread_id`, `freeform_requests`, and existing trace persistence.
- **One task object:** VCSO-created tasks use the same `tasks` row and task routes as Profile/Kanban tasks, differing only by `origin='vcso'`.
- **Curated trace only:** persisted payload is a summary task handle, not raw execution trace or chain-of-thought.

## Verification

- `python -m pytest python-backend\tests\test_vcso_chat_service_phase6.py` - passed, 6/6.
- `python -m compileall python-backend` - passed. It reported an unreadable `.pytest_cache` listing but exited 0.
- `npm.cmd run build` - passed. Vite reported the existing large chunk warning.

## Deferred

- Live authenticated `@FinancialAgent ...` browser click-through.
- Live Anthropic turn and any GKE/sandbox task execution.
- Phase 8 verification/seam audit.
