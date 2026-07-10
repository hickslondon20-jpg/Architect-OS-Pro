# Skills & Sandbox Build — Phase 7 (Sandbox Tool Integration) Execution Agent Prompt

> Copy everything below this line into a new Claude Code / Cowork session opened at
> `C:\Users\Hicks\ArchitectOS Pro_beta`.

---

You are the **execution agent** for Phase 7 (Sandbox Tool Integration) of the ArchitectOS Agent
Skills & Document Generation Engine build — the final phase. Two plans, in order: **07-01
(backend)** → **07-02 (frontend)**. You make implementation choices, never design choices. If
something needs a design decision beyond the inputs below, **stop and flag it** — the same
discipline every prior phase in this build has followed.

This phase wires everything Phases 1–6 built into one real, end-to-end path on the Virtual CSO. No
new cloud infrastructure, no new credentials — pure application-layer wiring against systems that
already exist and are already proven live.

## Orient first (read these, in order)

1. `.planning/skills-sandbox/phases/07-sandbox-tool-integration/07-RESEARCH.md` — the architectural
   fork this phase resolved: mirror `KbExplorerService`'s proven bounded native-tool-use loop
   pattern, entirely server-side, rather than adding tool-calling to the outer streaming chat call.
   Confirmed and chosen by London (2026-07-02) over two alternatives — do not revisit that decision.
2. `.planning/skills-sandbox/phases/07-sandbox-tool-integration/CONTEXT.md` — every decision this
   phase implements, including two load-bearing findings you must not re-derive from scratch:
   (a) `AgentContextBundle` does not carry `parent_thread_id` — the sandbox thread id must travel
   via `context_scope: {thread_id: ...}` in the POST body, read back via
   `context.context_scope.get("thread_id")`; (b) `skill_packs` has no existing column encoding
   "needs code execution" — this phase adds `requires_sandbox boolean`, checked on
   `loadSelectedSkillBodies`'s `select('*')` result (`requires_sandbox` needs zero query changes
   there), not on the earlier lightweight routing index.
3. `07-01-PLAN.md`, `07-02-PLAN.md` (same folder) — the two build specs, in order.
4. `python-backend/services/kb_explorer_service.py` — read in full before writing
   `sandbox_execution_service.py`. This is a structural mirror, not a reinvention: same
   `SYSTEM_PROMPT`/`TOOLS` constant shape, same `run_*` round-capped loop, same
   `_dispatch_tool`/`_execute_tool` split.
5. `python-backend/services/sub_agent_orchestrator.py` lines 59-99 (`start_run` dispatch) and
   318+ (`_handle_kb_explorer`) — the dispatch-by-`capability_key` pattern and handler shape to
   mirror for `_handle_sandbox_execution`.
6. `python-backend/services/agent_capabilities.py` lines 140-156 (`kb_explorer_agent` fallback
   entry) — the shape to mirror for the new `sandbox_execution_agent` entry.
7. `api/vcso/chat.ts` — read lines 300-417 (`shouldCallKbExplorer`/`callKbExplorer`) and 595-730
   (full turn sequencing, including the KB Explorer write-back to `agent_delegation_runs` at
   ~727-731) directly before editing. `07-RESEARCH.md`/`CONTEXT.md` describe this accurately as of
   2026-07-02, but confirm current state yourself before relying on line numbers.
8. `lib/virtualCsoApi.ts` lines 125-132 (`toMessage`) and 195-229 (thread-history loader,
   including the existing `stepsByMessageId` construction at lines 207-227) — the exact pattern
   `07-02-PLAN.md` Part C tells you to mirror for artifact-to-message linkage. Also confirm
   `MessageBubble.tsx` lines 42-44 still render `message.artifactDeliveries` as described — Phase 6
   built this render path but nothing populates it yet; that gap is this phase's job to close.

## What you build

### 07-01 — Backend (do first)
`docs/migrations/012_sandbox_execution_agent.sql` (`skill_packs.requires_sandbox` column +
`agent_capabilities` row for `sandbox_execution_agent`). New
`services/sandbox_execution_service.py` mirroring `kb_explorer_service.py`'s shape, exposing
`execute_code` and `read_skill_file` as real Anthropic tool schemas to its own bounded internal
loop only. `_handle_sandbox_execution` added to `SubAgentOrchestrator`, dispatched exactly like the
other five existing handlers. A produced-file convention (the model reports a file path in a
parseable way — your call on the exact format, per `07-01-PLAN.md` Part B's note) that triggers
`ArtifactService.deliver_from_sandbox` before the handler returns, folding the resulting artifact
id into the handler's result dict.

### 07-02 — Frontend
`requires_sandbox`-flag trigger in `chat.ts` (`callSandboxExecution`, mirroring `callKbExplorer`
exactly, plus the required `context_scope: {thread_id}`). Result threaded into `assemblePrompt`.
Artifact-to-message linkage via `agent_delegation_runs.structured_result` (already exists, already
selected in places, currently unused for this purpose) for both the live SSE turn and thread
reload — this is the concrete piece that makes `ArtifactDeliveryCard` show up on real messages for
the first time. Remove or resolve the Phase 6 dev-trigger scaffold in
`VirtualCSOWorkspace.tsx` lines 386-388 once real data flows.

## Hard constraints

- **The outer streaming Claude call in `chat.ts` gets zero tool-calling changes.** `execute_code`
  and `read_skill_file` exist only inside `SandboxExecutionService`'s own internal loop. If you find
  yourself adding `tools:`/`tool_choice` to the main `anthropic.messages.stream(...)` call that
  produces the founder-facing response, stop — that re-opens a decision London already made against.
- **No new FastAPI route for triggering the sandbox sub-agent.** `POST /api/agent-runs` already
  dispatches generically by `capability_key` — reuse it.
- **`execute_code` must reuse the live session for the calling thread**
  (`SandboxService.get_active_session(thread_id)`, creating one if none is active yet) — never open
  a second, unrelated session. State persistence across rounds of the *same* task (a fixed-and-
  rerun cycle) depends on this.
- **Do not invent a new schema/table for linking an artifact to a specific chat message.**
  `agent_delegation_runs.structured_result` already exists and is the right place — confirm it's
  genuinely unused for this today before writing to it, but don't add a new column/table as a
  first resort.
- **`allowed_surfaces` for the new capability stays `["virtual_cso"]`.** Do not widen it to
  `os_engine`/`domain_agent` — that's explicitly deferred (project `CONTEXT.md` §10).
- **Keep the outer `AbortController` timeout at 10 seconds**, matching `callKbExplorer`'s existing
  precedent, even though the inner capability's own `timeout_seconds` budget (proposed 90s in
  07-01-PLAN.md) is larger. This mismatch is a deliberate, inherited, already-shipped tradeoff
  (KB Explorer has the same shape) — graceful degrade on abort, not a bug to fix.
- **Never consider a claim confirmed until independently re-verified against the live system** —
  same standing discipline as every prior phase. Run a fresh `py_compile` pass on
  `python-backend/main.py` and every new/changed Python file before reporting anything done — Phase
  5's mid-build truncated-file incident is exactly the class of failure this guards against.

## Done when

All success criteria across both plan files are met, independently re-verified by you. Specifically:
a real chat turn with a `requires_sandbox`-flagged skill runs code in a live Phase 5 sandbox session
and the result reaches the founder in that turn's streamed response; a file-producing task results
in a real `ArtifactDeliveryCard` on the correct message, both live and after a thread reload; a
follow-up question in the same thread reuses the persisted result via `loadPriorToolResults`
without re-executing; a skill without the flag never triggers the sandbox path.

Report back: a one-paragraph summary; confirmation of each plan's success criteria; the exact
produced-file-path convention you chose for the model to report a generated file (07-01-PLAN.md
left this as an implementation choice); the final `max_rounds`/`timeout_seconds` values used for
`sandbox_execution_agent` and whether you changed them from the proposed 6/90 based on real timing;
and confirmation that `python-backend/main.py`/`requirements.txt` and the frontend build both pass
clean before you call anything done.

This closes out the entire Agent Skills & Document Generation Engine build (all 7 phases). After
you report back, the orchestration thread does final closeout — update
`.planning/skills-sandbox/STATE.md`, `ROADMAP.md`, and `Pro-Suite-Progress.md` from there, not from
this session.
