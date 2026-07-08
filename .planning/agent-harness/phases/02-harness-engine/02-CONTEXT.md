# Phase 2 Context — Generic Harness Engine

**Phase:** 02 of the Agent Harness (Episode 6) build.
**Read first:** build-level `CONTEXT.md` + `ROADMAP.md`; this phase's `02-RESEARCH.md`; Phase 1's
`01-01-PLAN.md` (the object model this engine drives); canonical
`../../INTELLIGENCE-LAYER-EPISODE-MAP.md` §4 Ep6 (+ Refinement 2) + §5 (L1–L21). Canonical +
Domain Agents docs win over the reference PRD.

---

## Why this phase, and what it is

This is the engine that turns the Phase-1 object model into behavior: a **generic backend state
machine** that advances a Task through its Workflow's ordered `workflow_steps`. **The system
advances steps; the LLM executes within a step.** That inversion — deterministic phase control
with flexible in-step execution — is the whole point (the "hard harness"). It is built **generic**
so one engine serves every workflow (and, directionally, OS Engine synthesis — D2), proven in
Phase 3 by the Monthly P&L Assessment.

It is a **backend-only** phase: a new service (`harness_engine.py`), the task run/stream endpoints,
one small migration (`020` for `ai_usage_log.task_id`), and the **SSE event vocabulary** that
Phase 4's Kanban/Workspace will render. No UI here.

## What this phase is NOT

- **Not the surfaces.** No Gallery/Profile/Kanban/Library UI, no browse/list endpoints — Phase 4.
  Phase 2 ships only the **execution** endpoints (create/run/stream/reconstruct/reply/upload) and
  the SSE contract those surfaces consume.
- **Not the P&L workflow content.** The engine is generic and proven with a **trivial test
  workflow**; the real P&L steps are Phase 3.
- **Not Deep Mode.** The soft harness (LLM-driven flow, editable todos) is Phase 6. This engine is
  the hard harness only.
- **Not the OS Engine promotion.** Graduation + the L17 trigger are Phase 5.
- **Not object-model migrations.** Phase 1 owns `019`; Phase 2 adds only `020` (task_id on the
  usage log).

## Decisions that shape this phase (locked — do not override)

**From the build (`CONTEXT.md`):** generic engine (not P&L-specific); Claude orchestration +
Claude structured output, no OpenAI `response_format` (L12/C1); Task is first-class, not
thread-coupled (C2); curated trace only (L11); no Running→Done skip (review gate always on); tasks
first-class in `tasks` with run-state columns (Phase-1 fork 1).

**Locked this phase (2026-07-05):**
1. **Execution = request-held stream + durable state + resume-on-reconnect.** The run executes
   while the Workspace holds an SSE connection (reusing the `/api/vcso/chat` transport + `_sse`
   framing), but **every step transition persists to `tasks` (`status`/`current_step`/
   `step_results`) and `workspace_files` before proceeding**, so a disconnect or a later return
   reconstructs from DB and resumes from the last completed step. **No separate worker daemon at
   beta.** (True background workers are deferred — reference post-MVP.)
2. **`programmatic` steps run in-process** in the Python backend (trusted platform code:
   Docling/`structured_data`/`structured_query`). The **GKE sandbox is reserved** for artifact
   render/export (L20/L4) and any LLM-generated code (Code Mode). No sandbox round-trip for our own
   trusted parsing.
3. **Metering gets a task handle.** Migration `020` adds nullable `ai_usage_log.task_id`; the engine
   passes it so L13 metering/degradation filter cleanly by task. `surface='domain_agents'`, `role ∈
   {main, sub_agent, utility}`.

## The engine design, concretely (the load-bearing part)

- **Step dispatch** by `step_type`:
  - `programmatic` — in-process Python (parse/extract/render-prep). Sandbox only when the step's
    contract is artifact render/export or LLM-generated code.
  - `llm_single` — one Claude call, **structured output via Claude tool/JSON schema**, validated
    against the step's `output_schema` before advancing.
  - `llm_agent` — bounded agent loop via `SubAgentOrchestrator.start_run` with the step's
    `capability_key` (routing) + curated `tools[]` (registry subset).
  - `llm_batch_agents` — parse items from a workspace file, chunk by `batch_size`, run N
    `start_run` calls concurrently (`asyncio.gather` / `to_thread`), stream per-item progress,
    accumulate into `workspace_output`. **Resumable** from partial output.
  - `llm_human_input` — generate a context-informed question, set `status='blocked'`, persist,
    **stop**; resumes when the founder replies (→ Blocked surface, Phase 4).
- **Workspace-based context passing (thin orchestrator).** Steps read/write `workspace_files`
  (`owner_type='task'`); the engine passes **paths, not content**, keeping the main window small
  (protects degradation, L13).
- **Per-step tool scope (D1).** Build from the Ep5 registry: `tools[]` subset (layer A) +
  `capability_key` via `AgentCapabilityScopeSource` (layer B). Never a flat list.
- **Prereq check (gatekeeper).** Before step 1, read OS Engine (`agent_context`/`wiki_read`) for the
  workflow's `prereqs`; missing → a **Blocked** resource prompt (not a separate conversational
  agent).
- **State transitions** written to `tasks`, each persisted before the next step:
  `ready→running→blocked→review→done`; `blocked→running` on reply; `review→running` on revision;
  **no `running→done` skip**.
- **Durability + resume.** On (re)attach to `POST /api/tasks/{id}/run` or `GET /api/tasks/{id}`,
  reconstruct from `tasks`/`workspace_files` and continue from `current_step`; interrupted
  `llm_batch_agents` resumes from partial `workspace_output`.
- **Curated trace (L11) + metering (L13).** Emit step/sub-agent/tool progress **summaries** only;
  every model call logs a tagged `usage_events` row (`surface='domain_agents'`, `role`, `model`,
  `task_id`).

## SSE event vocabulary (the contract Phase 4 renders — freeze the names here)

`task_ready`, `task_step_start` (index,name,type), `task_step_complete` (index,summary),
`task_step_error` (index,error), `task_blocked` (question/resource prompt), `task_batch_progress`
(done/total), `task_sub_agent_start`/`task_sub_agent_complete` (ref,summary), `task_review`
(artifact ref), `task_done`, `task_error`. All carry `task_id`. Same `event:/data:` framing as
`_sse`. Phase 4 and Phase 7 depend on these names — treat them as a stable contract.

## Success criteria (from ROADMAP Phase 2 — HARN-01…HARN-07)

1. A trivial 2-step test workflow (one `programmatic`, one `llm_single`) runs end to end via the
   engine, advancing state, writing workspace files, emitting the SSE events, honoring the review
   gate.
2. All five step modes work; `llm_human_input` blocks + resumes; `llm_batch_agents` runs
   concurrently and resumes from partial output after interruption.
3. Per-step tool scope built from registry subset + `capability_key` (D1); never a flat list.
4. Orchestrator main-window overhead stays small (paths, not content) — asserted.
5. Migration `020` applied; every model call emits a tagged `usage_events` row incl. `task_id`;
   trace is curated only.
6. Reconnect/return reconstructs task state from DB and resumes from `current_step`.

## Open items to resolve at build-planning (flag, don't silently pick)

- **`start_run` concurrency** — confirm sync vs. async; if sync, wrap in `asyncio.to_thread` +
  `gather` for `llm_batch_agents`. Verify no shared-state hazard across concurrent runs.
- **Engine module boundary** — lean: `services/harness_engine.py` (dispatch + state) + a thin
  `routers`/`main.py` endpoint set; keep step executors as small strategy functions, one per type.
- **Structured-output enforcement shape** — Claude tool-schema vs. a JSON-schema-in-prompt +
  validate; lean tool-schema for reliability. Confirm against the model in `platform_ai_settings`.
- **Create-task seam location** — `create_task(...)` lives here (shared by Phase 4 Profile/Kanban
  and Phase 7 `@Agent`); confirm signature (`agent_id`, `workflow_id?`, `origin`, `origin_thread_id?`).
- **Cancellation** — a cancel event checked between steps/rounds; confirm the stop affordance shape
  Phase 4 will call.
