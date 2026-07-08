# Phase 2 Completion - Generic Harness Engine

**Completed:** 2026-07-05
**Migration:** `020_ai_usage_log_task_id.sql`
**Live project:** Supabase `pwacpjqkntnovndhspxt`

## What shipped
- `python-backend/services/harness_engine.py`: generic hard-harness state machine for `tasks` and
  ordered `workflow_steps`.
- `python-backend/routers/tasks.py`: founder-authenticated execution endpoints:
  `POST /api/tasks`, `POST /api/tasks/{id}/run`, `GET /api/tasks/{id}`,
  `POST /api/tasks/{id}/messages`, `POST /api/tasks/{id}/files`, and the Phase-4 cancellation
  affordance `POST /api/tasks/{id}/cancel`.
- `python-backend/main.py`: includes the tasks router at `/api/tasks`.
- `python-backend/services/usage_events.py`: `log_ai_usage_event(..., task_id=...)` now persists
  task handles while preserving existing callers.
- `docs/migrations/020_ai_usage_log_task_id.sql`: nullable `ai_usage_log.task_id` plus
  `ai_usage_log_task_id_idx`.
- `python-backend/tests/test_harness_engine_phase2.py`: focused engine tests with fake Supabase,
  Claude, sub-agent, and registry seams.

## Design checkpoints confirmed
- `SubAgentOrchestrator.start_run` is synchronous; `llm_batch_agents` uses `asyncio.to_thread` plus
  `asyncio.gather`, with no shared mutable orchestrator state required by the engine.
- Engine boundary is `services/harness_engine.py` plus thin `routers/tasks.py` endpoints.
- `create_task` signature is `user_id, agent_id, workflow_id?, origin, origin_thread_id?, title?`.
- Structured output uses a Claude tool schema (`record_step_output`) and validates required fields.
- Cancellation is a durable `step_results._control.cancel_requested` flag checked between steps;
  because the Phase-1 status CHECK does not include `canceled`, beta behavior is a clean pause into
  `blocked` with a curated "Task paused by request" prompt.

## Verification evidence
- Focused tests: `python -m pytest python-backend/tests/test_harness_engine_phase2.py` passed
  `5 passed`.
- Compile: `python -m compileall python-backend` passed; only the known `.pytest_cache` listing
  warning appeared.
- Live migration: MCP `apply_migration` returned `{"success":true}` for
  `020_ai_usage_log_task_id`.
- Live schema check: `ai_usage_log.task_id` exists and `ai_usage_log_task_id_idx` exists.
- Advisor checks: Supabase performance/security advisors returned the existing project backlog and
  expected Phase-1 public-table visibility notices; no new RLS/policy surface was added by `020`.

## Success criteria mapping
- HARN-01: Trivial 2-step workflow (`programmatic` -> `llm_single`) advances to Review, emits SSE,
  writes workspace files, and never skips Review.
- HARN-02: All 5 step modes are covered. `llm_human_input` blocks and resumes; `llm_batch_agents`
  runs concurrently and resumes from partial workspace output.
- HARN-03: D1 scoping is proven by test: step `tools[]` is intersected with capability-scoped
  registry output; no flat global tool list is exposed.
- HARN-04: Reconstruct/resume is proven by `GET`-shape service state returning next-step metadata
  and workspace metadata only, not large file content.
- HARN-05: `log_ai_usage_event` accepts `task_id`; tests prove `surface='domain_agents'`, `role`,
  and `task_id` are written.
- HARN-06: Curated trace only. Sub-agent trace persistence strips raw input/output payloads down to
  public step/status/tool/title/summary/source/error fields.
- HARN-07: Compile and focused tests pass; live `020` is applied and verified.

## Honest gaps / deferred live smokes
- No full live Anthropic `llm_single` smoke was run from the local backend in this pass; the focused
  test uses a fake Claude tool-output response to prove the structured-output path.
- No live GKE/sandbox artifact render/export smoke was run; sandbox/export belongs to Phase 5 and
  Ep5 verification debt remains non-gating per L18.
- The real Monthly P&L workflow remains Phase 3. Phase 2 intentionally uses a trivial generic test
  workflow and contains no P&L-specific logic.

## Unblocks
Phase 3 can now build the Monthly P&L Assessment POC on the generic engine, using the Phase-2 task
execution endpoints and review-gated state machine.
