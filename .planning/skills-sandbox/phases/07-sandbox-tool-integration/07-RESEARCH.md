# Phase 7 Research — Sandbox Tool Integration (Virtual CSO)

**Requirements:** SANDBOX-03, FILE-02
**Depends on:** Phases 1, 3, 4, 5, 6 (all done)

## The question this research had to answer

SANDBOX-03 and FILE-02 both use "tool available to the LLM, on demand" language. Nothing in
this codebase currently does native Claude tool-calling inside the Virtual CSO's user-facing
streaming chat endpoint (`api/vcso/chat.ts`) — confirmed by grep for
`tools:|anthropic\.messages|tool_choice|input_schema` across that file: zero matches. So the
naive reading of SANDBOX-03/FILE-02 ("give the outer streaming Claude call tool-calling") would
be architecturally novel in the riskiest possible place — a live SSE stream, with no precedent
anywhere in the repo for interleaving `tool_use`/`tool_result` turns inside token streaming.

The alternative — a keyword pre-classification heuristic like KB Explorer's
`shouldCallKbExplorer` — is proven and cheap, but is a poor semantic fit for `execute_code`.
Code execution is often iterative (write code, see an error, fix it, rerun) in a way a single
keyword-triggered fetch is not built for.

Research resolved this by finding a third option that was already sitting in the codebase,
fully proven, solving exactly this shape of problem.

## Finding: KB Explorer already does native tool-calling — just not in chat.ts

`python-backend/services/kb_explorer_service.py` (`KbExplorerService.run_exploration`) runs a
genuine, bounded, native Anthropic tool-use loop entirely server-side in Python:

- Calls `anthropic_client.messages.create(model=..., tools=KB_EXPLORER_TOOLS, messages=messages)`
  in a `for round_num in range(max_rounds)` loop.
- On `stop_reason == "tool_use"`, dispatches each `tool_use` block to a real Python handler
  (`kb_ls`, `kb_tree`, `kb_grep`, `kb_glob`, `kb_read`, `wiki_search`, `wiki_get_page`,
  `wiki_list`), appends `tool_result` blocks, and loops again.
- On `stop_reason == "end_turn"`, returns a `KbExplorerResult` (summary, tool_steps,
  referenced_doc_ids, rounds_used, truncated flag).

This loop is invoked by `SubAgentOrchestrator.start_run()`
(`python-backend/services/sub_agent_orchestrator.py`), which dispatches on
`capability.capability_key` to a handler method — `_handle_kb_explorer` for
`kb_explorer_agent`, mirrored by `_handle_document_analysis`, `_handle_structured_data`,
`_handle_per_user_wiki`, `_handle_per_user_document_wiki`, `_handle_global_ip`. Every run
persists through the Phase 2 infrastructure (`agent_delegation_runs`, `agent_delegation_steps`,
`agent_context_sources`) regardless of which handler ran.

The capability itself is configured in `agent_capabilities`
(`python-backend/services/agent_capabilities.py`, `_fallback_capabilities()`):

```
kb_explorer_agent: allowed_tools=[kb_ls, kb_tree, kb_grep, kb_glob, kb_read],
                    default_config={"max_rounds": 5, "timeout_seconds": 60}
```

Outer trigger, from `api/vcso/chat.ts`: `shouldCallKbExplorer(text)` (keyword heuristic) runs
before skill routing; if true, `callKbExplorer()` POSTs to `/api/agent-runs` with a **hard
10-second `AbortController`** and folds the result into `assemblePrompt`'s `kbFindings` field.
On timeout or any failure, `callKbExplorer` catches and returns `null` — the chat turn proceeds
without KB findings, no error surfaced to the founder.

**Pre-existing tension, not introduced by Phase 7:** the capability's own budget
(`timeout_seconds: 60`, 5 rounds) is six times longer than the outer caller's abort window (10s).
In practice, any KB Explorer run approaching its real budget is already being abandoned
mid-flight from the chat.ts caller's perspective today, and the system treats that as a normal,
silent degrade rather than an error. This is existing, shipped, accepted behavior — Phase 7
should inherit the same shape deliberately, not treat it as something to fix.

## Recommended design (resolving the architectural fork)

Mirror `KbExplorerService` exactly, don't extend `chat.ts`'s outer Claude call:

1. **New `SandboxExecutionService`** (`python-backend/services/sandbox_execution_service.py`),
   structurally identical to `KbExplorerService.run_exploration` — its own bounded
   `anthropic.messages.create(..., tools=[...])` loop, running entirely inside the Python
   backend. Two tools exposed to *this inner loop only*:
   - `execute_code` — input: code string (+ optional description); dispatches to
     `SandboxService.get_active_session(thread_id)` / creates a session if none active, runs the
     code, returns stdout/stderr/exit_code (SANDBOX-01/02 already built in Phase 5).
   - `read_skill_file` (FILE-02) — input: skill file id/path; reads attached skill file content
     on demand via the Phase 1 `skill-files` storage/metadata pair, returns text content to the
     loop.
   If the loop's code execution produces a file, it hands off to Phase 6's
   `ArtifactService.deliver_from_sandbox` (already built) for delivery.

2. **New capability_key `sandbox_execution_agent`** added to `agent_capabilities` (one migration
   row + fallback registry entry, same shape as `kb_explorer_agent`), dispatched via a new
   `_handle_sandbox_execution` branch in `SubAgentOrchestrator.start_run()`. This gets Phase 2
   persistence (`agent_delegation_runs`/`steps`/`agent_context_sources`) automatically —
   directly satisfies Success Criterion 5 ("a follow-up question in the same thread can
   reference the result without re-execution") with zero new persistence code, since
   `loadPriorToolResults` in `chat.ts` already reads prior runs by `assistant_message_id`
   regardless of which capability produced them.

3. **Outer trigger in `chat.ts`**: NOT a new keyword list. `skill_packs` has no existing column
   that flags "this skill needs code execution" (confirmed by querying the live schema — columns
   are `id, slug, name, description, skill_kind, domain, trigger_tags, body, status, version,
   last_updated, created_at, required_platform_context, output_contract, writeback_rules,
   user_id, scope`; `skill_kind` today only holds `diagnostic`, `preparation`, `prioritization`
   across the 6 live rows — no execution-flavored kind exists). Since skill routing
   (`detectExplicitSkillInvocation`/`classify()`) already runs before prompt assembly and
   already determines which skill's body gets loaded, the precise, low-cost trigger is a new
   boolean column (e.g. `requires_sandbox`) on `skill_packs`, set by whoever authors a
   code-execution skill. `chat.ts` checks the selected skill's flag (not raw message text) and,
   if true, calls a new `callSandboxExecution()` mirroring `callKbExplorer()`'s exact shape
   (synchronous POST, `AbortController`, graceful `null`-on-failure degrade). This is more
   precise than a keyword heuristic (skills opt in explicitly rather than the platform guessing
   from message text) and reuses the routing step that already exists rather than adding a
   second, parallel classification path.

4. **Latency budget**: reuse the existing accepted shape — outer `AbortController` timeout
   (10s, matching precedent) with silent graceful degrade on abort; inner capability
   `timeout_seconds` set generously (Phase 5 GKE cold-start risk is real for a session's *first*
   call in a thread; `get_active_session()`, built in Phase 6, means only that first call per
   thread pays the cold-start cost — subsequent calls in the same thread reuse the warm pod).
   SANDBOX-06 (session pooling to reduce cold-start latency) is explicitly deferred per
   REQUIREMENTS.md — this phase does not need to solve cold-start, only degrade gracefully
   around it, consistent with how KB Explorer already behaves.

## Net effect

- Zero changes to the SSE streaming shape of `chat.ts`'s outer Claude call — no novel
  streaming/tool-use interaction risk introduced anywhere.
- `execute_code`/`read_skill_file` are genuine native Anthropic tool-calling, satisfying the
  literal SANDBOX-03/FILE-02 wording — just scoped to a bounded inner sub-agent loop, exactly
  matching the one proven precedent that already exists in this codebase (KB Explorer).
  Everything reused: `SubAgentOrchestrator` dispatch, `AgentCapabilityRegistry` config shape,
  Phase 2 persistence, Phase 5 `SandboxService`/`get_active_session`, Phase 6
  `ArtifactService.deliver_from_sandbox`, the `assemblePrompt`/graceful-degrade trigger pattern.
- One genuinely new piece: a `requires_sandbox` boolean on `skill_packs` and the
  `callSandboxExecution` trigger function — both small, justified, and shaped exactly like
  existing precedent rather than inventing a new pattern.

## Open item for London (checkpoint, not yet resolved)

Whether to accept this design as the resolution to the SANDBOX-03/FILE-02 "on demand" wording,
versus insisting on true tool-calling inside the outer streaming call. Framed for
`AskUserQuestion` next.
