# Phase 6 Research — VCSO Deep Mode Reuse Surfaces (verified 2026-07-05)

Verified in `python-backend/` + live Supabase. Deep Mode is **additive** to the existing VCSO tool
loop and **Virtual CSO only** (L14). Trust this; re-verify before changing.

## The VCSO loop to branch (`services/vcso_chat_service.py`)
- `stream_chat(user_id, payload, max_rounds=5)` — the tool loop. Round loop at
  `for _round_num in range(max_rounds)`; calls Claude with `system=VCSO_TOOL_LOOP_SYSTEM_PROMPT`,
  `tools=context["tools"]` (built from the registry via `RegistryNativeScopeSource`).
- **Deep-mode branch:** when the message's `deep_mode=true` → raise the cap to a
  `MAX_DEEP_ROUNDS` (~50), **add** deep-mode tools to `context["tools"]`, and **extend** the system
  prompt with planning/workspace/delegation/ask-user instructions. **OFF = byte-for-byte current
  behavior** (no extra tools, no prompt overhead, cap stays 5).
- Streams `event/data` via `_sse`; usage tagged `surface='virtual_cso'` (L13).

## Net-new (migration `022_deep_mode_todos.sql`)
- **`agent_todos`** (does NOT exist) — thread-scoped, **editable** plan list: `id`, `thread_id`,
  `user_id`, `content`, `status` CHECK `('pending','in_progress','completed')`, `position`,
  timestamps; RLS `auth.uid()=user_id`. Full-replacement on `write_todos`. **This is the one
  editable-plan surface (C4)** — Domain Agents does not get it.
- **`vcso_chat_messages.deep_mode boolean default false`** (table confirmed = `vcso_chat_messages`)
  — per-message flag so history reconstructs panel visibility.

## Reuse (do not rebuild)
- **Workspace files:** `workspace_files` is thread-capable (`owner_type` present, L21) — deep-mode
  `write_file`/`read_file`/`edit_file`/`list_files` use `owner_type='thread'`, `owner_id=thread_id`.
  **No new files table.**
- **Sub-agent `task` tool:** reuse `SubAgentOrchestrator` (general-purpose delegation; minus
  recursion + minus todos in the sub-agent).
- **Tool registry:** register the deep-mode tools as **native** registry tools, surfaced only under
  a deep-mode scope.
- **Trace:** reuse `AgentStepsPanel` + the curated-trace path (L11); source_refs already carried (Ep7).

## ask_user — resume-as-tool-result (locked)
The loop emits an `ask_user` SSE event, persists loop state, sets `agent_status=waiting_for_user`,
and ends the request stream. The user's reply arrives as a **new request** that resumes the loop
with the reply delivered as the `ask_user` **tool result** (not a new top-level message). Mirrors
the durable-state/resume pattern used by the Domain Agent engine.

## Frontend surfaces (repo root)
- `components/pro-suite/virtual-cso/Composer.tsx` — add the per-message **Deep Mode toggle** next to
  Send. `ChatThread`/`AgentStepsPanel` render the loop. `lib/virtualCsoApi.ts` — extend to send
  `deep_mode` + parse `todos_updated` / `ask_user` / workspace events.
- Net-new panels: **Plan Panel** (editable `agent_todos`, real-time) + **Workspace Panel** (thread
  workspace files, visible whenever the thread has files — decoupled from the toggle).

## Locked forks (2026-07-05)
1. Migration `022` = `agent_todos` + `vcso_chat_messages.deep_mode`.
2. Deep-mode tools = registry natives, deep-scoped, OFF unchanged; raised `MAX_DEEP_ROUNDS`.
3. `ask_user` = resume-as-tool-result.

## Guardrails
Deep Mode is **VCSO only (L14)** — must not appear in Domain Agents. Editable plan panel is
Deep-Mode-only (C4). Claude orchestration (L12/C1). Usage `surface='virtual_cso'` (L13).
