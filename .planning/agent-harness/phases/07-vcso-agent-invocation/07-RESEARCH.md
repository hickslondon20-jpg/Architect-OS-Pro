# Phase 7 Research — VCSO @Agent Invocation Reuse Surfaces (verified 2026-07-05)

Verified in `python-backend/`. Phase 7 is **small**: the hand-off seam already exists. **No new
migration.** Trust this; re-verify before changing.

## The seam is already built (Phase 2)
- `HarnessEngine.create_task(*, user_id, agent_id, workflow_id=None, origin, origin_thread_id=None,
  title=None)` — `origin` already accepts **`'vcso'`** and there's an `origin_thread_id` param.
  Phase 2 built this exact seam for Phase 7. **Reuse it directly** — do not add a new task-creation
  path. `tasks.origin` CHECK includes `vcso` (migration 019).
- All three entry points (Profile launch, Kanban card, VCSO `@Agent`) resolve to **one** task object
  (the wireframe §4 requirement).

## VCSO detection seam (`services/vcso_chat_service.py`)
- Pre-loop routing already exists: `_detect_explicit_skill_invocation(text, skills)` +
  `_classify(text, skills)` (lines ~666-667). **`@Agent` detection slots in here** — add a
  `_detect_agent_invocation(text)` that parses `@FinancialAgent …`, resolves the `domain_agents`
  row (by key/name), and maps the remainder to a workflow (reuse the Phase‑4 free-form matcher /
  `classify`) or a free-form task. Deterministic, cheap — an explicit founder intent.

## Reuse (do not rebuild)
- `create_task(origin='vcso', origin_thread_id=<thread>)` for the hand-off.
- Phase‑4 free-form→workflow matcher (`domain_agents.py` / VCSO `classify`) for mapping the request.
- `freeform_requests` capture (if the mapped request is free-form, log it, L16).
- **Frontend:** `components/pro-suite/domain-agents/DomainAgentPrimitives.tsx` (task chip/card) reused
  in the VCSO thread; `lib/domainAgentsApi.ts` / `lib/tasksApi.ts` for status; the Domain Agent
  Workspace route (`/pro/intelligence/domain-agents`) for "Open in Workspace".

## Locked forks (2026-07-05)
1. **Detection = pre-loop @mention parse** (mirror `_detect_explicit_skill_invocation`).
2. **Run model = create + handle card + open in Workspace** — VCSO calls `create_task(origin='vcso')`,
   posts an inline handle card (agent/workflow/status/links); the task **runs/streams in the Domain
   Agent Workspace** (or Kanban), **not inline** in the VCSO thread. Status = the task's Kanban
   state. **Preserves L14** (no workspace takeover).
3. **Card = reuse `DomainAgentPrimitives`** in the VCSO thread.

## Guardrails
VCSO gets a **handle, not a workspace takeover** (L14). The spawned task is indistinguishable in
Kanban/Library from a Profile-launched one except `origin='vcso'`. Curated trace (L11); no new
schema.
