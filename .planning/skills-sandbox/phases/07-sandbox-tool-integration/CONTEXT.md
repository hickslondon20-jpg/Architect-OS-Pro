# Phase 7 Context — Sandbox Tool Integration (Virtual CSO)

**Written:** 2026-07-02, by the Orchestration Agent, after `07-RESEARCH.md`'s live-verification pass
and London's checkpoint decision.

---

## 1. Domain

Everything built in Phases 1–6 connects end to end on the Virtual CSO: a skill's instructions can
trigger code execution, and the result reaches the founder through the right Phase 6 delivery path.
Traces SANDBOX-03, FILE-02.

## 2. Decisions

**Locked (carried from project `CONTEXT.md` and prior phases — not reopened):**
- N8N is never in this path (CLAUDE.md Rule #1) — this is Python-backend-colocated synthesis, the
  default lane, not the exception.
- The outer Virtual CSO streaming chat call (`api/vcso/chat.ts`) keeps its existing shape — no native
  tool-calling gets added to the SSE stream itself.

**Resolved by this research pass and checkpointed with London (2026-07-02):**
- **Mirror `KbExplorerService`, do not extend `chat.ts`'s outer Claude call.** London confirmed this
  as the resolution to SANDBOX-03/FILE-02's "on demand" wording over the two alternatives (native
  tool-calling inside the streaming call; a pure keyword-heuristic, non-agentic call). See
  `07-RESEARCH.md` for the full tradeoff writeup presented at checkpoint.
- **New `SandboxExecutionService`** runs its own bounded native Anthropic tool-use loop
  (`anthropic.messages.create(..., tools=[...])`, capped rounds, same shape as
  `KbExplorerService.run_exploration`), entirely inside the Python backend. Two tools exposed to
  *this inner loop only*: `execute_code` and `read_skill_file`. The outer Claude call in `chat.ts`
  never sees these tools directly.
- **New capability_key `sandbox_execution_agent`** in `agent_capabilities`, dispatched via a new
  `_handle_sandbox_execution` branch in `SubAgentOrchestrator.start_run()` — no new FastAPI route
  needed; `POST /api/agent-runs` already dispatches generically by `capability_key`.
- **Trigger mechanism: a new `requires_sandbox boolean not null default false` column on
  `skill_packs`**, not a keyword heuristic. Confirmed live against the schema: no existing column
  (`skill_kind`, `trigger_tags`, etc.) already encodes "this skill needs code execution" —
  `skill_kind` today only holds `diagnostic`/`preparation`/`prioritization` across the 6 live rows.
  Skill routing (`detectExplicitSkillInvocation`/`classify()`) already runs before prompt assembly in
  `chat.ts` and already determines the selected skill; the new column is checked on whichever skill
  routing selects, rather than re-deriving intent from raw message text a second time.
- **Outer call shape mirrors `callKbExplorer()` exactly**: new `callSandboxExecution()` in
  `chat.ts`, synchronous POST to `/api/agent-runs` with `capability_key: "sandbox_execution_agent"`,
  hard `AbortController` timeout (10s, matching existing precedent), catch-and-return-`null` on any
  failure or abort — the chat turn proceeds without the sandbox result, no error surfaced to the
  founder. This is a deliberate inherited tradeoff, not a gap to close in this phase (see
  `07-RESEARCH.md`'s "pre-existing tension" note: the capability's own `timeout_seconds` budget can
  exceed the outer abort window, and that is already shipped, accepted behavior for KB Explorer).
- **Cold start is not solved here.** `SandboxService.get_active_session()` (built in Phase 6) means
  only a thread's *first* sandbox call pays GKE pod cold-start cost; subsequent calls in the same
  thread reuse the warm pod. SANDBOX-06 (session pooling) is explicitly out of v1 scope per
  REQUIREMENTS.md. This phase's job is graceful degrade around cold start, not eliminating it.
- **File output handoff reuses Phase 6 as-is.** If the inner loop's `execute_code` calls produce a
  file the founder should receive, the handler calls `ArtifactService.deliver_from_sandbox` (already
  built, already tested) — no new delivery mechanism.
- **`read_skill_file` reads from the existing Phase 1 `skill_files` table/bucket** (`skill_id`,
  `filename`, `category`, `mime_type`, `size`, `storage_path`) — no new storage, no new metadata
  shape.

## 3. Canonical Refs

- `.planning/skills-sandbox/REQUIREMENTS.md` — SANDBOX-03, FILE-02; SANDBOX-06 explicitly deferred
  (rationale table).
- `.planning/skills-sandbox/ROADMAP.md` — Phase 7 section, all 5 success criteria.
- `07-RESEARCH.md` (this folder) — full architectural-fork writeup and the checkpoint framing
  presented to London.
- `python-backend/services/kb_explorer_service.py` — the structural precedent this phase mirrors in
  full: `KB_EXPLORER_SYSTEM_PROMPT`, `KB_EXPLORER_TOOLS` (Anthropic tool schema shape),
  `run_exploration()`'s round-capped loop, `_dispatch_tool`/`_execute_tool` pattern,
  `KbExplorerResult` dataclass shape (summary, tool_steps, rounds_used, truncated).
- `python-backend/services/sub_agent_orchestrator.py` lines 59–99 (`start_run` dispatch),
  318–327+ (`_handle_kb_explorer`) — the dispatch-by-`capability_key` pattern and handler shape to
  mirror for `_handle_sandbox_execution`.
- `python-backend/services/agent_capabilities.py` lines 140–156 (`kb_explorer_agent` fallback
  entry) — the `AgentCapability` shape (`allowed_surfaces`, `allowed_tools`, `default_config` with
  `max_rounds`/`timeout_seconds`) to mirror for `sandbox_execution_agent`.
- `python-backend/main.py` line 898 (`POST /api/agent-runs`) — the existing generic dispatch route;
  confirms no new FastAPI route is needed for the new capability.
- `api/vcso/chat.ts` lines ~300–417 (`shouldCallKbExplorer`, `callKbExplorer`) and ~595–670
  (sequencing: user message inserted → KB Explorer pre-check → parallel context loads →
  `loadPriorToolResults` → skill routing → `assemblePrompt`) — the exact shape `callSandboxExecution`
  and its trigger check must mirror, and the exact point in the pipeline (after skill routing
  resolves the selected skill, before `assemblePrompt`) where the `requires_sandbox` check belongs.
- `python-backend/services/sandbox_service.py` (Phase 5) — `get_active_session(thread_id)`,
  `execute_code()` — what the inner loop's `execute_code` tool handler calls into.
  `KubernetesInteractiveSandboxSession._upload_runner_script` override — the in-pod-exec fallback
  pattern already proven for file operations against this cluster.
  `python-backend/services/artifact_service.py` (Phase 6) — `deliver_from_sandbox()` — what a
  file-producing `execute_code` call hands off to.
- `docs/migrations/20260701_skill_files_storage.sql` — `skill_files` table shape
  (`id, skill_id, filename, category, mime_type, size, storage_path, created_at, updated_at`) and its
  RLS — what `read_skill_file` reads against.
- Live schema query (this session, 2026-07-02) confirming `skill_packs` columns
  (`id, slug, name, description, skill_kind, domain, trigger_tags, body, status, version,
  last_updated, created_at, required_platform_context, output_contract, writeback_rules, user_id,
  scope`) and current `skill_kind` values (`diagnostic`, `preparation`, `prioritization`; 6 rows
  total) — the basis for the `requires_sandbox` new-column decision above.

## 4. Code Context

- `python-backend/services/kb_explorer_service.py` — copy the file's overall shape for the new
  `sandbox_execution_service.py`: a `SANDBOX_EXECUTION_SYSTEM_PROMPT` constant, a
  `SANDBOX_EXECUTION_TOOLS` list (two entries: `execute_code`, `read_skill_file`), a frozen result
  dataclass, a service class with `run_execution(user_id, thread_id, task_summary, max_rounds=...)`
  running the same `for round_num in range(max_rounds)` / `stop_reason` loop, and
  `_dispatch_tool`/`_execute_tool` methods. `execute_code`'s handler calls
  `SandboxService.get_active_session(thread_id)` (create-if-absent per Phase 5's session semantics)
  then `.execute_command(...)`; `read_skill_file`'s handler queries `skill_files` by id (RLS/service
  role per the existing pattern) and downloads via Supabase Storage.
- `python-backend/services/sub_agent_orchestrator.py` — add `elif capability.capability_key ==
  "sandbox_execution_agent": result = self._handle_sandbox_execution(context)` to `start_run`
  (mirrors line 89-90's `kb_explorer_agent` branch exactly), and a new `_handle_sandbox_execution`
  method mirroring `_handle_kb_explorer` (lines 318+) — with one real difference: **`execute_code`
  needs the sandbox `thread_id` (to call `SandboxService.get_active_session(thread_id)`), and
  `AgentContextBundle` (`python-backend/services/agent_context.py` lines 28-40) does not carry
  `parent_thread_id`.** Checked directly: `SubAgentRunRequest.parent_thread_id` exists and is
  persisted onto the `agent_delegation_runs` row (line 180), but `AgentContextBuilder.build()` is
  called with only `user_id`, `parent_surface`, `task_summary`, `context_scope`, `capability` —
  `parent_thread_id` is never passed in, so it never reaches `AgentContextBundle`. The only field
  handlers can read it from is `context.context_scope` (a free-form dict already used this way
  elsewhere, e.g. `context.context_scope.get("wiki_query")`). **Decision: `callSandboxExecution` in
  `chat.ts` must include `context_scope: {"thread_id": threadId}` in its POST body**, and
  `_handle_sandbox_execution` reads `context.context_scope.get("thread_id")` to know which sandbox
  session to reuse. Get this wrong and `execute_code` silently can't find the right pod.
- `python-backend/services/agent_capabilities.py` — add a `sandbox_execution_agent` entry to
  `_fallback_capabilities()` mirroring the `kb_explorer_agent` entry's shape
  (`allowed_surfaces=["virtual_cso"]` — do not widen to `os_engine`/`domain_agent` yet, this phase is
  Virtual-CSO-scoped per the Roadmap's own phase title; `allowed_tools=["execute_code",
  "read_skill_file"]`; `default_config={"max_rounds": <TBD by execution agent, KB Explorer uses 5>,
  "timeout_seconds": <TBD, KB Explorer uses 60>}`). Needs a matching DB row via migration (next
  sequential number after `011_artifacts.sql` → `012_sandbox_execution_agent.sql`), not just the
  fallback — the fallback path is a backup, not the primary path, per how `AgentCapabilityRegistry`
  is structured (checked in `07-RESEARCH.md`'s upstream reading, not re-derived here).
- `docs/migrations/` — new migration adds (a) the `agent_capabilities` row for
  `sandbox_execution_agent`, (b) `ALTER TABLE public.skill_packs ADD COLUMN requires_sandbox boolean
  not null default false`.
- `api/vcso/chat.ts` — precise insertion point, confirmed by direct read: line 644-645 runs
  `detectExplicitSkillInvocation`/`classify()` to get `route`; lines 646-650 call
  `loadSelectedSkillBodies(service, route.selected.map(s => s.id), allowDraftIp)`, which queries
  `skill_packs` with `select('*')` (line 249) — this already returns `requires_sandbox` with **zero
  query changes needed**, unlike the earlier, lighter `ipLayer.skills` index (line 233's explicit
  column list, used only for routing/classification, does not need the new column). The trigger
  check belongs right after `loadSelectedSkillBodies` resolves (`selectedBodies.packs.some(pack =>
  pack.requires_sandbox)`), before `assemblePrompt` is called. If true, call new
  `callSandboxExecution(userId, taskSummary, threadId, userMessageId)` mirroring `callKbExplorer`'s
  exact shape (same `ARCHITECTOS_PYTHON_BACKEND_URL`/`ARCHITECTOS_INGEST_SECRET` env vars, same
  `AbortController` timeout pattern, same catch-and-null) — **with `context_scope: {thread_id:
  threadId}` in the POST body**, per the `AgentContextBundle` finding above. Thread the result into
  `assemblePrompt` similarly to how `kbFindings` is threaded today (new field, e.g.
  `sandboxResult: sandboxResult?.resultSummary`), plus an `artifactId` if one was produced (07-01's
  handler folds this into its result dict) so the frontend can trigger Phase 6's delivery UI in the
  same turn.
- `python-backend/services/artifact_service.py` — `deliver_from_sandbox()` is the existing call the
  new service's `execute_code` handler (or `_handle_sandbox_execution`, after the loop completes)
  invokes when the loop's result includes a produced file path, to hand off through Phase 6's
  delivery path (Reader panel / `ArtifactDeliveryCard`) exactly as already wired.

## 5. Specifics

This phase splits into two plans, matching the backend/frontend split used in Phases 5 and 6:

**07-01 — Backend: `SandboxExecutionService`, capability registration, orchestrator wiring.**
`012_sandbox_execution_agent.sql` (agent_capabilities row + `skill_packs.requires_sandbox` column).
New `services/sandbox_execution_service.py` (tool-use loop, `execute_code`/`read_skill_file`
handlers). `_handle_sandbox_execution` added to `SubAgentOrchestrator`. `sandbox_execution_agent`
entry added to `agent_capabilities.py`'s fallback registry. No new FastAPI route required — reuses
`POST /api/agent-runs`. A verification path (mirroring `POST /api/artifacts/verify`'s and
`POST /api/sandbox/verify`'s shape) proving a real round trip: task summary in → code executed
against a live Phase 5 sandbox session → result out, persisted through Phase 2's
`agent_delegation_runs`/`steps`/`agent_context_sources`.

**07-02 — Frontend: skill-flag trigger + result threading in `chat.ts`.** Confirm/extend the
selected-skill fetch to expose `requires_sandbox`. Add `callSandboxExecution()` mirroring
`callKbExplorer()`. Wire its result into `assemblePrompt`'s context. Confirm the full round trip:
founder message → skill loaded (flagged `requires_sandbox`) → `callSandboxExecution` → sandbox result
folded into the prompt → outer Claude call presents/references it in its streamed response → if a
file was produced, the existing Phase 6 delivery path (Reader panel or `ArtifactDeliveryCard`) shows
it in the same turn. Confirm a follow-up question in the same thread can reference the result via
`loadPriorToolResults` without re-executing (Success Criterion 5) — this should work automatically
via Phase 2 persistence with no new code, but must be verified, not assumed.

## 6. Deferred (explicitly not this phase's job)

- SANDBOX-05 (staging GKE cluster) and SANDBOX-06 (session pooling for cold-start latency) — both
  explicitly out of v1 scope per REQUIREMENTS.md's deferred table.
- Widening `sandbox_execution_agent`'s `allowed_surfaces` beyond `virtual_cso` (Pro Suite/OS Engine/
  Domain Agents wiring is a forward-looking integration note per project `CONTEXT.md` §10, not this
  phase).
- A UI affordance for founders to browse/re-run past sandbox executions — Success Criterion 5 only
  requires that a follow-up *question* can reference the prior result, not a dedicated history UI.
- Multi-language sandbox support (SKILL-11, deferred) — `execute_code`'s tool schema is Python-only,
  matching Phase 5's container image.

---
*Context written: 2026-07-02 — Orchestration Agent, post-research, post-checkpoint.*
