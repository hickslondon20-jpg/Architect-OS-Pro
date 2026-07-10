# Phase 3 Completion - Virtual CSO In-Thread Tool Loop

**Completed:** 2026-07-03  
**Scope:** 03-01 backend Python VCSO tool loop + FastAPI SSE endpoint, and 03-02 frontend re-point + live curated trace rendering.

## What Changed

- Added `python-backend/services/vcso_chat_service.py`.
- Moved the Virtual CSO orchestration path into Python: thread/message lifecycle, context assembly, founder wiki loading, recent/prior tool-result context, project context, skill routing, selected skill loading through registry executors, `vcso_chat` model resolution, and `role='main'` usage logging.
- Added a bounded Claude tool-use loop that sources tools from the Phase 2 registry with `RegistryNativeScopeSource`, includes `tool_search`, executes direct registry tools, and supports bounded sub-agent delegation through the registry-native `delegate_to_sub_agent` tool.
- Added `POST /api/vcso/chat` in FastAPI using `StreamingResponse` and the Phase 7 event vocabulary: `ready`, `step`, `tool_call`, `tool_result`, `token`, `done`, `error`.
- Persisted the main loop's trace in `agent_delegation_runs` / `agent_delegation_steps`, linked to the saved assistant message for the existing reload reconstruction path.
- Kept the old Vercel `api/vcso/chat.ts` path intact as rollback.
- Added `VITE_VCSO_PYTHON_STREAM=true` frontend flagging. With the flag on, `lib/virtualCsoApi.ts` posts to `${VITE_INGESTION_API_URL}/api/vcso/chat`; with the flag off, it continues to use `/api/vcso/chat`.
- Added live trace handling for `step` / `tool_call` / `tool_result`, appending curated entries into the in-flight assistant message and rendering them through the existing `AgentStepsPanel`.
- Generalized the trace panel label from KB-only to CSO trace.
- Updated `CLAUDE.md` Rule #1 to record VCSO streaming as part of the Python direct-Anthropic lane.
- Added `python-backend/tests/test_vcso_chat_service_phase3.py` with a mocked Anthropic tool loop.

## Verification

- `python -m pytest python-backend\tests\test_vcso_chat_service_phase3.py` passed: 1 passed.
- `python -m compileall python-backend` passed. The known unreadable `.pytest_cache` warning appeared and was non-fatal.
- `npm.cmd run build` passed. Vite emitted the existing large chunk warning.

## Acceptance Criteria Mapping

- **LOOP-01:** Met in code. The Python loop can call a registry tool mid-turn, feed the result back, and continue before streaming the final answer.
- **LOOP-02:** Met in code. FastAPI streams the same POST-body/auth pattern via SSE and emits curated trace events plus token events.
- **LOOP-03:** Met. The VCSO subset is sourced from registry surface scoping and no KB-write tool was added; writeback remains separate.
- **LOOP-04:** Met. Direct registry execution and sub-agent delegation are both available through registry executors, preserving D1.
- **Curated trace / Phase 7 contract:** Met in code. Only safe summaries are streamed and persisted; raw chain-of-thought, raw tool payloads, and raw code are not sent as trace.
- **Usage events:** Met in code. Main-loop Anthropic calls emit `role='main'`, `surface='virtual_cso'`, `provider='anthropic'`, `capability_key='vcso_chat'`, and `run_id`.

## Remaining Gaps / Next Phase Notes

- Full live end-to-end smoke was not run from this local checkout because live hosted backend credentials, `ANTHROPIC_API_KEY`, and any GKE sandbox credentials were not available here. The code path is ready for a deployed smoke with `VITE_VCSO_PYTHON_STREAM=true`.
- Phase 7 still owns formal reload-durable interleaved-history rendering. Phase 3 persisted the trace in the existing reconstructable shape and renders it live.
- Phase 4 should build the sandbox HTTP bridge without changing the VCSO endpoint contract created here.

## Explicit Non-Scope Preserved

- No sandbox HTTP bridge was built.
- No MCP live connector or OAuth lifecycle was built.
- No degradation percentage UI or compaction was built.
- No new trace table was added.
- `api/vcso/chat.ts` was not deleted.
