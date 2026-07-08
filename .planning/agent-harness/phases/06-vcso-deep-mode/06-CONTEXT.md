# Phase 6 Context — Virtual CSO Deep Mode (Soft Harness)

**Phase:** 06 of the Agent Harness (Episode 6) build.
**Read first:** build-level `CONTEXT.md` + `ROADMAP.md`; this phase's `06-RESEARCH.md`; Phase 2's
`02-COMPLETION.md` (the substrate) + the Ep5 VCSO loop; canonical
`../../INTELLIGENCE-LAYER-EPISODE-MAP.md` §5 (**L14, L21**, L11, L12, L13, C4). Domain Agents docs win.

---

## Why this phase, and what it is

Give a Virtual CSO thread an open-ended, **LLM-driven** autonomous mode — plan, workspace,
sub-agents, ask-user — the **soft harness**. It reuses the same substrate the Domain Agent hard
harness uses (workspace, sub-agents, ask-user, trace, persistence), presented the LLM-drives-the-flow
way. **Virtual CSO only (L14).** May run in parallel with Phases 4/5 since it only needs the Phase‑1
substrate.

Backend branch on the existing `stream_chat` loop + one migration (`022`) + net-new frontend panels.

## What this phase is NOT
- **Not in Domain Agents (L14).** No Deep Mode surface, no editable plan panel, no open-chat mode in
  Domain Agents — that stays the scoped hard harness.
- **Not a new loop.** Branch the existing VCSO `stream_chat`; OFF = byte-for-byte current behavior.
- **Not a new files table.** Reuse `workspace_files` (`owner_type='thread'`, L21).
- **Not background/async.** Request-scoped stream + resume (like the Domain Agent engine); true
  background workers stay deferred.

## Decisions that shape this phase (locked 2026-07-05)
1. **Migration `022`:** `agent_todos` (thread-scoped editable) + `vcso_chat_messages.deep_mode`.
2. **Deep-mode tools = registry natives, deep-scoped:** `write_todos`/`read_todos` (→`agent_todos`),
   `write_file`/`read_file`/`edit_file`/`list_files` (→`workspace_files` thread), `task`
   (→`SubAgentOrchestrator`), `ask_user`; surfaced only when `deep_mode=true`; raised
   `MAX_DEEP_ROUNDS`; OFF unchanged.
3. **`ask_user` = resume-as-tool-result** (emit event + persist + end stream; reply resumes as the
   tool result).

## The design, concretely
- **Toggle:** per-message `deep_mode` flag (persisted on `vcso_chat_messages`); reconstructs panel
  visibility on reload.
- **Branch in `stream_chat`:** if `deep_mode` → cap `MAX_DEEP_ROUNDS`, add deep-mode tools, extend
  the system prompt (deterministic/KV-cache-friendly — todo state flows through tools, not the
  prompt). Else current behavior.
- **Tools:** todos (full-replacement + recitation), workspace file tools (thread-owned), `task`
  (clean-context sub-agent, shares the thread workspace, no recursion/todos), `ask_user`
  (pause/resume).
- **Persistence:** messages/tool-calls, todos, workspace files persisted as work progresses;
  reconnect loads from DB; follow-up resumes (agent reads its todos + workspace).
- **Trace + metering:** curated trace only (L11); usage tagged `surface='virtual_cso'`, role markers
  (L13). Sub-agent internal cost → metering, not the main-window degradation signal.
- **Frontend:** Deep Mode toggle in `Composer`; **Plan Panel** (editable `agent_todos`, real-time via
  `todos_updated`); **Workspace Panel** (thread files, visible when files exist — decoupled from the
  toggle so the harness can use it too); inline `ask_user`; `agent_status`
  (`working`/`waiting_for_user`/`complete`/`error`).

## Ep7 seam
Deep-mode trace already carries `source_refs` (reuse the VCSO trace) — no extra work.

## Success criteria (ROADMAP Phase 6 — DEEP-01…DEEP-04)
1. Toggle ON grants planning/workspace/sub-agent/ask-user; **OFF is byte-for-byte current behavior**.
2. Todos (`agent_todos`, editable panel) + workspace (`workspace_files`, `owner_type='thread'`) work;
   both persist and survive reload; a thread resumes after reconnect.
3. Deep Mode is Virtual CSO only (no leakage into Domain Agents); Claude orchestration; usage tagged
   `virtual_cso`.
4. `ask_user` pauses and resumes via the tool-result path.

## Open items to resolve at build-planning (flag, don't silently pick)
- **`MAX_DEEP_ROUNDS` value** (lean ~50) + loop-exhaustion behavior (force summarize-and-deliver).
- **Deep-mode tool registration seam** — how the registry surfaces deep-scoped natives only when
  `deep_mode=true` (a scope flag vs. a separate scope source); keep OFF path untouched.
- **`ask_user` resume plumbing** — where loop state is persisted so a new request rehydrates and
  injects the reply as the tool result; confirm idempotency.
- **Panel decoupling** — Workspace Panel visible whenever the thread has files (so the harness path
  can reuse it); Plan Panel is Deep-Mode-only (C4).
- **Frontend reuse depth** — extend `virtualCsoApi.ts` + `Composer`/panels vs. new components; lean
  extend.
