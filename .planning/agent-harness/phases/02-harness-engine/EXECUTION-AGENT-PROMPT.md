# Execution Agent Brief — Phase 2: Generic Harness Engine

You are the Execution Agent for **Phase 2** of the Agent Harness (Episode 6) build in ArchitectOS
Pro. You implement the harness engine + its execution endpoints. You do not re-plan it and you do
not start other phases.

## Read these before writing any code (in order)
1. `.planning/agent-harness/CONTEXT.md` — build rationale + the decisions you must not override.
2. `.planning/agent-harness/ROADMAP.md` — Phase 2 goal, dependencies, success criteria.
3. `phases/01-object-model-and-lineage/01-01-PLAN.md` + its `01-COMPLETION.md` — the object model
   you drive (must be applied/green first). Do not re-migrate it.
4. `phases/02-harness-engine/02-RESEARCH.md` — the live-verified reuse surfaces. **Trust it, but
   re-verify anything you're about to change.**
5. `phases/02-harness-engine/02-CONTEXT.md` (especially "The engine design, concretely" + the SSE
   vocabulary), then `02-01-PLAN.md`.
6. Canonical: `../../INTELLIGENCE-LAYER-EPISODE-MAP.md` §4 Ep6 + §5 (L1–L21). Wins over the reference PRD.

## What you are building
A generic backend state machine (`services/harness_engine.py`) that advances a Task through its
Workflow's ordered steps — five step executors, workspace-based context passing, per-step tool
scoping (D1), a prereq check, durable state with resume-on-reconnect — plus the task execution
endpoints, migration `020` (`ai_usage_log.task_id`), and a trivial test workflow proving all five
step modes. Backend only.

## Hard constraints (do not violate)
- **Build generic.** Zero P&L-specific code — the engine is proven with a *trivial* test workflow;
  the P&L recipe is Phase 3. If you're writing P&L logic, you've left Phase 2.
- **The system advances steps, not the LLM.** Deterministic phase control; the LLM executes only
  *within* a step. No LLM-chosen step order/skip.
- **Claude orchestration + Claude structured output (L12/C1).** No OpenAI `response_format`, no
  OpenRouter. Cheap models only inside utility/sub-agent steps via the model registry.
- **Execution model = request-held stream + durable state + resume (locked fork 1).** Persist
  `tasks` (`status`/`current_step`/`step_results`) and `workspace_files` **before** advancing each
  step; a disconnect or `GET /api/tasks/{id}` return must reconstruct and resume from `current_step`.
  **No separate background worker daemon.**
- **`programmatic` steps run in-process (locked fork 2).** Use Docling/`structured_data` in the
  backend; reserve the GKE sandbox for artifact render/export (L20/L4) and LLM-generated code only.
- **Metering (locked fork 3, L13).** Apply migration `020`; pass `task_id` to
  `log_ai_usage_event(surface='domain_agents', role=…, model=…, task_id=…)` on every model call.
- **Reuse, don't rebuild.** `SubAgentOrchestrator.start_run`, `tool_registry` scope sources +
  `ToolExecutionContext`, `sandbox_service`/`sandbox_bridge`, the `_sse`+`StreamingResponse`
  pattern, `usage_events`, Phase-1 tables. Do not fork any of these.
- **Per-step tool scope (D1).** Registry `tools[]` subset + `capability_key` — never a flat global
  list. A test must prove the scoping.
- **Review gate always on.** No `running→done` transition. Curated trace only (L11) — never raw
  chain-of-thought.
- **Freeze the SSE event names** in `02-CONTEXT.md` — Phase 4 and Phase 7 render them.

## Confirm with London at checkpoint (do not silently decide)
- `start_run` sync vs. async, and the concurrency wrapper for `llm_batch_agents` (lean
  `asyncio.to_thread` + `gather`); confirm no shared-state hazard.
- Engine module boundary (lean `services/harness_engine.py` + thin endpoints) and the `create_task`
  signature (`agent_id`, `workflow_id?`, `origin`, `origin_thread_id?`).
- Structured-output enforcement shape (lean Claude tool-schema over JSON-in-prompt).
- Cancellation affordance shape (checked between steps) that Phase 4 will call.

## Done when
1. All Phase 2 success criteria in `ROADMAP.md` (HARN-01…HARN-07) are met and each independently
   verified (not just reported).
2. The trivial 2-step workflow runs end to end through the engine; all 5 step modes work;
   `llm_human_input` blocks/resumes; `llm_batch_agents` is concurrent and resumes from partial output.
3. Reconnect/`GET /api/tasks/{id}` reconstructs and resumes from `current_step`.
4. Per-step D1 scoping proven by test; migration `020` applied; tagged usage rows carry
   `surface='domain_agents'` + `role` + `task_id`.
5. `python -m compileall python-backend` + focused tests pass; live-smoke gaps (missing GKE/Anthropic
   creds) flagged honestly.
6. `Pro-Suite-Progress.md`, `.planning/agent-harness/ROADMAP.md`, `.planning/agent-harness/STATE.md`
   updated; `phases/02-harness-engine/02-COMPLETION.md` written with the evidence summary.

## Explicitly out of scope for you
The P&L workflow content (Phase 3), any surface/UI + browse/list endpoints (Phase 4), the OS Engine
promotion trigger (Phase 5), Deep Mode (Phase 6), and true background/async workers (deferred). Do
not resolve anything `02-CONTEXT.md` marks as a later phase.
