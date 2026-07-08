# Phase 2 Research — Reuse Surfaces (verified 2026-07-05)

Verified in `python-backend/`. **Trust this, but re-verify anything you're about to change.** This
phase writes a new service; it does not migrate the object model (Phase 1 / migration `019` does).

## Execution + streaming patterns that already exist (both are usable)
- **Synchronous SSE stream:** `@app.post("/api/vcso/chat")` returns `StreamingResponse` over a
  generator; `VcsoChatService.stream_chat()` **yields `{"event","data"}` items** wrapped by
  `_sse(event, data)` → `event: <name>\ndata: <json>\n\n`. Browser-authed via
  `Depends(get_current_user_id)` (JWT), headers `Cache-Control:no-cache`, `X-Accel-Buffering:no`.
  **Reuse this transport + `_sse` framing verbatim** for the task run stream.
- **Background + status-poll:** doc-wiki `synthesize-*` endpoints run under `BackgroundTasks` and a
  `GET /api/doc-wiki/job/{id}` polls markers in `ose_activity_log`. Precedent for durable/async work
  if ever needed — **not** the chosen model for beta (see locked fork 1).

## Sub-agent delegation (reuse for `llm_agent` / `llm_batch_agents`)
- `SubAgentOrchestrator.from_env().start_run(SubAgentServiceRunRequest(...))` — fields:
  `user_id`, `parent_surface`, `capability_key`, `task_summary`, `context_scope`, `task_title`,
  `parent_thread_id`, `parent_message_id`. Persists `agent_delegation_runs` / `agent_delegation_steps`
  and tags usage with `run_id`.
- `agent_capabilities.can_spawn_agents = false` (hard CHECK) — sub-agents cannot recurse. Batch
  fan-out is the **engine** spawning N `start_run` calls concurrently, not capability recursion.
- **Verify at build:** whether `start_run` is sync-only (wrap in `asyncio.to_thread` + `gather` for
  batches) or has an async variant.

## Tool registry (D1 — per-step scoping)
- `tool_registry.py`: `build_registry(...)`, `ToolDefinition`, `ToolExecutionContext` (carries
  `metadata`, incl. `bridge_fulfiller`), scope sources `AgentCapabilityScopeSource` (reads
  `agent_capabilities.allowed_tools`/`allowed_surfaces` — layer B) + `RegistryNativeScopeSource`
  (layer A). `to_anthropic()` is the hot-path adapter. A step's tool set = registry filtered by its
  `tools[]` subset (layer A) + `capability_key` (layer B). Never a flat global list.

## Sandbox (reserved for render/export + LLM-generated code, NOT trusted programmatic steps)
- `SandboxService` (GKE interactive sessions): `execute_code`, `execute_code_with_bridge`;
  `sandbox_bridge.py` `BridgeFulfiller` executes registry tools host-side (`_execute_code` routes
  through the bridge only when `context.metadata["bridge_fulfiller"]` is set).
- Trusted platform parsing (`structured_data.py`, `structured_query.py`, Docling `doc_processor`)
  runs **in-process** in the backend — this is where `programmatic` steps run (locked fork 2).

## Metering (L13)
- `log_ai_usage_event(client, *, user_id, surface, model, role, provider, input_tokens,
  output_tokens, thread_id, skill_id, capability_key, run_id, cost_usd)` — **no `task_id`.**
  Phase 2 adds a small migration `020_ai_usage_log_task_id.sql` (nullable `task_id`) + the param
  (locked fork 3). `role ∈ {main, sub_agent, utility}`; `surface` will be `'domain_agents'`.

## Model routing / lane (locked, not a fork)
- Orchestration/narration/step-decision = Claude (L12); structured output via Claude tool/JSON
  schema (**not** OpenAI `response_format`, C1). Cheap models only inside utility/sub-agent steps via
  `platform_ai_settings` / capability `model_setting_key`. The engine lives in the Python/FastAPI
  backend (CLAUDE.md Rule #1 — synthesis colocated with a Python service calls Anthropic directly).

## Migration numbering
- `019` (Phase 1 object model) is in flight. Phase 2 adds **`020_ai_usage_log_task_id.sql`** only.

## Auth convention
- Founder-facing endpoints use `Depends(get_current_user_id)` (JWT); internal/service endpoints use
  `require_ingest_secret`. Task run/stream/reconstruct endpoints are founder-facing → `get_current_user_id`.
