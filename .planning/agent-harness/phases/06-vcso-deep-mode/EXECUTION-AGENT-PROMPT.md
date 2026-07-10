# Execution Agent Brief — Phase 6: Virtual CSO Deep Mode (Soft Harness)

You are the Execution Agent for **Phase 6** of the Agent Harness (Episode 6) build. You add the
LLM-driven Deep Mode to Virtual CSO. **Virtual CSO only.** You do not re-plan and you do not start
other phases.

## Read these before writing any code (in order)
1. `.planning/agent-harness/CONTEXT.md` — build rationale + decisions you must not override.
2. `.planning/agent-harness/ROADMAP.md` — Phase 6 goal, dependencies, success criteria.
3. `phases/06-vcso-deep-mode/06-RESEARCH.md` — the loop to branch, net-new schema, reuse points.
   **Trust it, but re-verify anything you change.**
4. `06-CONTEXT.md` (the 3 locked forks + design), then `06-01-PLAN.md`.
5. Canonical: `../../INTELLIGENCE-LAYER-EPISODE-MAP.md` §5 (L14, L21, L11, L12, L13, C4).

## What you are building
Migration `022` (`agent_todos` + `vcso_chat_messages.deep_mode`); deep-mode tools
(`write_todos`/`read_todos`, `write_file`/`read_file`/`edit_file`/`list_files`, `task`, `ask_user`)
as deep-scoped registry natives; a deep-mode branch on `stream_chat`; and the frontend Deep Mode
toggle + Plan Panel + Workspace Panel + inline ask_user.

## Hard constraints (do not violate)
- **Virtual CSO only (L14).** Deep Mode must NOT appear in Domain Agents; no editable plan panel, no
  open-chat mode there. If you're touching Domain Agents surfaces, you've left Phase 6.
- **Additive branch, OFF unchanged.** Branch the existing `stream_chat`; when `deep_mode` is OFF the
  behavior, tools, prompt, and round cap are **byte-for-byte** as today. Assert this.
- **Reuse the substrate (L21).** Deep-mode file tools use `workspace_files` with
  `owner_type='thread'` — **no new files table**. `task` reuses `SubAgentOrchestrator` (no recursion,
  no todos in the sub-agent). Register deep-mode tools as **native registry** tools, deep-scoped.
- **Editable plan panel is Deep-Mode-only (C4).** `agent_todos` is the one editable-plan surface;
  Domain Agents uses fixed-step progress.
- **`ask_user` = resume-as-tool-result (locked).** Emit the event, persist loop state, set
  `waiting_for_user`, end the stream; on the next request, rehydrate and inject the reply as the
  `ask_user` tool result — not a new top-level message. Idempotent.
- **Claude orchestration (L12/C1); curated trace only (L11); usage tagged `surface='virtual_cso'`
  (L13).** No OpenAI `response_format`.

## Confirm with London at checkpoint (do not silently decide)
- `MAX_DEEP_ROUNDS` value (lean ~50) + loop-exhaustion (force summarize-and-deliver).
- The deep-scoped tool-registration seam (scope flag vs. separate scope source) that keeps the OFF
  path untouched.
- `ask_user` resume plumbing (where loop state persists so a new request rehydrates + injects the
  reply as the tool result).
- Frontend reuse depth (extend `virtualCsoApi`/`Composer`/panels vs. new components; lean extend).

## Done when
1. Phase 6 success criteria (DEEP-01…DEEP-04) met and each independently verified.
2. Toggle ON grants planning/workspace/sub-agent/ask-user; OFF is byte-for-byte unchanged (proven).
3. Todos + workspace persist + survive reload; thread resumes after reconnect; `ask_user`
   pauses/resumes via tool-result; `workspace_files` shared via `owner_type` (L21).
4. No Deep Mode leakage into Domain Agents (L14); `022` applied live; usage tagged `virtual_cso`.
5. `python -m compileall python-backend` + focused tests + `npm.cmd run build` pass; live Anthropic
   smoke flagged deferred (L18).
6. `Pro-Suite-Progress.md`, `.planning/agent-harness/ROADMAP.md`, `.planning/agent-harness/STATE.md`
   updated; `phases/06-vcso-deep-mode/06-COMPLETION.md` written.

## Explicitly out of scope for you
Domain Agents behavior/surfaces; VCSO `@Agent` invocation (Phase 7); context auto-compaction for
deep sessions + background/async runs (deferred); visual redesign (§8). Do not resolve anything
`06-CONTEXT.md` marks as a later phase.
