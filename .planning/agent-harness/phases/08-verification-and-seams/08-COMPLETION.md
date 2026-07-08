# Phase 8 Completion - Verification & Seams

**Run date:** 2026-07-06
**Scope:** Code-level verification only. No live Anthropic, GKE, browser, or OS Engine credential smoke was run per L18 and the episode-map section 8 sequencing gate.
**Verdict:** Ep6 build is **code-complete at the local/fake/code-level gate**. Live-credential smokes remain deferred to section 8.

## Executive Verdict

Phase 8 produced the required code-level assertion report and the consolidated section 8 deferred-smoke checklist. The only Ep6-gating issue found by the first verification pass was the normal VCSO OFF-path regression:

- **Found by Phase 8:** Phase 7's pre-loop `@Agent` seam initially evaluated the Domain Agent lookup on ordinary VCSO turns, so `python-backend/tests/test_vcso_chat_service_phase3.py::test_vcso_chat_stream_runs_tool_loop_and_streams_tokens` failed and the DEEP-01/L14 "OFF unchanged" assertion did its job.
- **Resolved before final closeout:** the normal path now returns before any `domain_agents` query on non-`@Agent` turns, while `@Agent` turns are unchanged.
- **Evidence:** `python -m pytest python-backend/tests/test_vcso_chat_service_phase3.py` passed `1 passed`; the focused Ep6 suite passed `27 passed`.

The earlier sandbox bridge finding is reclassified:

- **Not an Ep6 blocker:** `python-backend/services/sandbox_bridge.py` and `python-backend/services/sandbox_service.py` are Ep4/Ep5 sandbox files. `git log --all --oneline -- python-backend/services/sandbox_bridge.py python-backend/services/sandbox_service.py` in this checkout shows last visible touch at `c6a3185` (`Release v0.4 skills and sandbox buildout`) and no Ep6 phase modified `run_with_bridge(...)`.
- **Disposition:** pre-existing local Windows/filesystem sandbox-test issue, folded into the section 8 live GKE/sandbox smoke. It remains tracked, but does not gate Ep6 code-complete per L18.

Compile/build status:

- PASS: `python -m compileall python-backend` exited 0. It still reports the known unreadable `.pytest_cache` listing warning.
- PASS: `npm.cmd run build` exited 0. Vite still reports the existing large chunk warning.

## A. Code-Level End-to-End

| Check | Result | Evidence |
|---|---|---|
| Profile entry point creates the same task object | PASS (code-level) | `pages/ProSuite/domain-agents/DomainAgentProfile.tsx` calls `createTask(...)`; `lib/tasksApi.ts` posts to `/api/tasks` with `origin: 'profile'`; `python-backend/routers/tasks.py` routes to `HarnessEngine.create_task(...)`. |
| Kanban/workspace entry point resumes the same task object | PASS (code-level) | `DomainAgentTasks.tsx` describes board/workspace as the same task object; `DomainAgentWorkspace.tsx` loads `getTask(taskId)`, runs `runTask(taskId)`, uploads/replies against the same `/api/tasks/{id}` routes. |
| VCSO `@Agent` creates one Domain Agent task handle, not a takeover | PASS | `vcso_chat_service.py:868-887` calls `HarnessEngine.create_task(origin='vcso', origin_thread_id=thread_id)` only after the explicit `@Agent` guard and returns `_agent_task_payload(...)`; `test_vcso_chat_service_phase6.py:192-200` asserts `origin='vcso'`, `origin_thread_id`, freeform linkage, and persisted handle. |
| Anchor P&L reaches Review and writes `artifact.html` | PASS | `test_harness_engine_phase2.py:310-357` proves no-P&L blocked upload, upload resume, clarify, final `task_review`, `artifact.html`, source refs, artifact registration, and idempotent revision review. |
| Review gate: no Running -> Done skip | PASS | `harness_engine.py:155-227` explicitly returns when already `done`, returns when `review`, blocks when needed, runs steps, then sets `status='review'` and emits `task_review`; no direct Running -> Done path appears. |
| Resumability from Blocked and partial batch state | PASS | `test_harness_engine_phase2.py:80-100` proves blocked human reply resume; `test_harness_engine_phase2.py:119-142` proves `llm_batch_agents` resumes from partial output with `resumed_from_partial is True`. |
| Graduation at Review registers artifact, promotion deliberate | PASS | `harness_engine.py:225-227` registers on Review; `artifact_service.py:66-107` registers `source_kind='domain_agent_task'` with lineage/provenance; `routers/tasks.py:199-233` requires explicit `POST /promote`, calls `synthesize_from_task`, then sets `promoted_to_kb=true`. |
| Deep Mode ON grants tools, OFF unchanged | PASS | `test_vcso_chat_service_phase6.py:35-44` proves Deep-only tool visibility; `vcso_chat_service.py:730-732` selects `virtual_cso_deep` only when `deep_mode`; `test_vcso_chat_service_phase3.py` now passes, confirming ordinary turns do not evaluate the Domain Agent path. |

## B. Locked-Decision Assertions

| Decision | Result | Evidence |
|---|---|---|
| L14 - Deep Mode lives in VCSO only; `@Agent` is a handle, not takeover | PASS | Domain Agents leakage grep for `Deep Mode`, `deepMode`, `agent_todos`, `PlanPanel`, `WorkspacePanel`, `virtual_cso_deep`, and `ask_user` returned no matches in Domain Agent surfaces/routers/API. `vcso_chat_service.py:928-960` persists an `agent_task` handle with `reasoning_visibility='summary_only'`. The ordinary-turn argument-evaluation regression was caught and resolved; `test_vcso_chat_service_phase3.py` now passes. |
| L11 - curated trace only | PASS | Grep found only the explicit guard `Never expose hidden reasoning` in `vcso_chat_service.py` and `_curated_trace` usage in `harness_engine.py`; no raw chain-of-thought/raw payload fields appeared in the checked Ep6 services/surfaces. |
| L12/C1 - Claude orchestration; no OpenAI `response_format` or OpenRouter primary path | PASS for Ep6, repo debt noted | Ep6 harness/VCSO services use Anthropic/Claude (`harness_engine.py:315-346`, `vcso_chat_service.py` model resolution). Grep found no `response_format`/OpenRouter in Ep6 harness/VCSO routes/services. Repo-wide OpenAI references still exist in older ingestion/wiki code and `package.json`; removal is outside this verification pass. |
| L13 - one tagged usage stream with `surface`, `role`, `task_id` where applicable | PASS | `usage_events.py:21-52` defines one best-effort insert shape. `harness_engine.py:334-346`, `384-393`, and `478-487` log Domain Agent main/sub-agent usage with `surface='domain_agents'`, role, and `task_id`; VCSO logs `surface='virtual_cso'` for main/utility paths. Tests assert task usage rows at `test_harness_engine_phase2.py:59-61`. |
| L20 - Domain Agent artifacts use Ep4 sandbox/artifact scope, not N8N/Google Docs | PASS with deferred richer export | `CLAUDE.md` scopes N8N/Google Docs to fixed platform reports only. Domain Agent Review registration goes through `ArtifactService.register_domain_artifact(...)`, not N8N. DOCX/GKE richer export remains in the deferred section 8 checklist. |
| L21 - one owner-flexible `workspace_files` substrate | PASS | `docs/migrations/019_domain_agents_object_model.sql:107-124` defines one `workspace_files` table with `owner_type in ('task','thread')` and unique `(owner_type, owner_id, file_path)`. VCSO Deep Mode writes thread files through the same table/tool surface. |
| C2/C4 - tasks first-class, editable todos Deep-Mode-only | PASS | `tasks` has `origin` and optional `origin_thread_id` but is not thread-coupled (`019` lines 88-103). `agent_todos`/PlanPanel are VCSO-only; Domain Agents leakage grep returned no matches. |

## C. Ep7 Forward Seams

| Seam | Result | Evidence |
|---|---|---|
| `tasks.step_results` -> `artifacts.provenance` carries `source_refs` | PASS | `test_harness_engine_phase2.py:342-351` asserts source refs on steps 3-5 and registered artifact provenance; `artifact_service.py:331-364` collects `source_refs` from step results into `domain_agent_artifact_provenance_v1`. |
| L17 promotion payload is well-formed | PASS | `doc_wiki_agent_artifact_adapter.py:67-115` builds a task-sourced `SourcePayload` with `source_kind='agent_artifact'`, provenance, `source_refs`, forced page kind/key/title, and OS Engine sole-writer directive. `test_harness_engine_phase2.py:401-408` asserts the fake synthesis payload metadata includes `task_id` and `source_refs`. |

## Verification Commands

- PASS: `python -m pytest python-backend/tests/test_vcso_chat_service_phase3.py`
  - `1 passed`.
- PASS: `python -m pytest python-backend/tests/test_harness_engine_phase2.py python-backend/tests/test_tool_registry_phase2.py python-backend/tests/test_vcso_chat_service_phase3.py python-backend/tests/test_vcso_chat_service_phase6.py python-backend/tests/test_sandbox_execution_service_phase4.py python-backend/tests/test_mcp_scaffold_phase5.py`
  - `27 passed`.
  - Excludes `python-backend/tests/test_sandbox_bridge_phase4.py` because that standalone local filesystem bridge harness is pre-existing Ep4/Ep5 sandbox-test friction and is deferred to the section 8 live GKE/sandbox smoke.
- PASS: `python -m compileall python-backend`
- PASS: `npm.cmd run build`

## Section 8 Deferred-Smoke Checklist

Do **not** run these in Phase 8. They are the next-gate input after the front-end/UX audit and before go-live:

- Live Anthropic Domain Agent task execution from Profile, Kanban resume, and VCSO `@Agent`.
- Live Anthropic VCSO Deep Mode turn, including `ask_user` pause/resume and thread workspace/todo reload.
- Live GKE/sandbox: apply and verify deny-all egress NetworkPolicy.
- Live sandbox bridge end-to-end, including the pre-existing local `run_with_bridge(...)` timeout behavior from the standalone bridge harness.
- Deferred DOCX/richer export through the L20 sandbox artifact path.
- Authenticated browser click-through of Domain Agents Gallery, Profile, Kanban, Workspace, Library, VCSO Deep Mode, and VCSO `@Agent` handle card against live Supabase.
- Live OS Engine promotion from a Domain Agent artifact to wiki page + vector asset via the L17 trigger.
- Ep5 verification debt: egress policy, live sandbox/tool-loop smokes, and Python-stream flag flip.
- Section 8.1 front-end/UX design audit + real-wiring pass.
- Section 8.2 consolidated cross-episode smoke after the front-end audit, then go-live/usability flip.

## Process Note

The OFF-unchanged assertion (L14 / DEEP-01) did exactly what it was supposed to do. The regression was subtle: an argument-evaluation side effect, not an obvious branch or UI leak. The Phase 8 code-level check caught it before closeout, the seam was restored, and the rerun evidence is now green.
