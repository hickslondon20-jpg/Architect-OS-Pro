# Phase E Plan — Sessions + Deep Mode Reconciliation

> Read `../../CONTEXT.md` + `../../ROADMAP.md` and this folder's `CONTEXT.md` + `ROADMAP.md` first.
> Covers **SDK-E1..E4**. **Gated on the Phase D checkpoint.** Reconcile the hand-rolled Deep Mode
> resume-state with SDK sessions — a single source of truth, no double bookkeeping.

## Deliverable
SDK **sessions** (resume/fork) mapped onto Deep Mode: the `ask_user` pause/resume, the `agent_todos`
editable plan, and workspace files all resume with full context via the SDK session, with the
hand-rolled deep-resume-state either subsumed or cleanly demarcated so there is **one** resume authority.

## Steps

### A. Map sessions to Deep Mode (SDK-E1/E2)
1. Adopt SDK sessions for Deep Mode threads (resume/fork). Route the `ask_user` pause/resume through the
   session layer: a paused thread resumes with full context on the next founder message.
2. Reconcile against the existing `_persist_deep_resume` / `_deep_resume_state` path — subsume it into
   sessions where the SDK covers it; keep only what the SDK does not.

### B. Plan + workspace persistence (SDK-E3/E4)
1. Keep `agent_todos` (the visible plan) and `workspace_files` as the persisted surfaces; ensure they
   rehydrate on session resume. Emit `todos_updated` / `workspace_updated` SSE events as today.
2. Verify **no double bookkeeping** — resume state lives in one place, not in both SDK sessions and the
   hand-rolled deep-resume rows.

## Acceptance criteria
1. A Deep Mode thread pauses on `ask_user` and resumes with full context via the SDK session; plan +
   workspace intact.
2. One resume authority — the hand-rolled deep-resume path is subsumed or explicitly scoped; no
   conflicting state.
3. `agent_todos` + `workspace_files` rehydrate on resume; SSE `todos_updated`/`workspace_updated`
   unchanged for the frontend.
4. Founder isolation intact; traces paired to `ai_usage_log`.
5. `compileall` clean; `ROADMAP.md`/`STATE.md` + `04B-E-COMPLETION.md` updated. Read-back to London.

## Out of scope
Live MCP (F); generalization + cutover (G). This phase reconciles session/resume mechanics only.
