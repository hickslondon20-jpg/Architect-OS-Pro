# Phase D2 · SDK-M2 Build + Visibility Probe Checklist

**Goal of M2:** make the SDK **lead** reason a decomposition and delegate via `Task`, with the
`run_<agent>` worker tools **invisible to the lead** (external MCP server, per-agent). Everything stays
behind `vcso_sdk_loop` (dark, founder-only) plus a **new dark sub-flag** `native_model_driven_enabled`;
**Path A stays the default fallback and is not pruned.** Mechanism + rationale: `04B-D2-FINDINGS.md`.

**Build/validate this in the environment that can run the venv, deploy, and spend the one-worker canary**
(the sandbox cannot). Each step is independently verifiable. Do **not** proceed to the next on a red step.

**Landed already (sandbox, `compile()`-clean; dark — no live path changed):**
- `services/vcso_worker_mcp.py` — transport-agnostic core: `TurnScope`, `TurnRegistry` (process-global
  `TURN_REGISTRY`), `mint`/`get`/`unregister` + stale eviction, and
  `run_worker_capability(token, capability_key, args)` reusing `SubAgentOrchestrator.start_run` (depth 1,
  worker tier, compact contract, citations). Delegation-first + founder isolation enforced here.
- `services/vcso_worker_mcp_server.py` — FastMCP loopback transport over the core (Step 1): three worker
  tools, per-turn token lifted from `?t=` into a `ContextVar` by an ASGI wrapper, `worker_server_url()`.
- `main.py` — mounts the worker ASGI app at `/internal/mcp/workers` (inert until a turn registers a scope).
- `services/vcso_sdk_config.py` — `compile_founder_sdk_options(..., model_driven_worker_server_url=...)`:
  when set, each worker agent scopes the **external** server inline and no `run_<agent>` reaches the lead;
  **byte-identical when `None`** (Path A / Fix-C unchanged). New constant `MODEL_DRIVEN_WORKER_SERVER`.
- Tests: `unit_tests/test_vcso_worker_mcp.py` (registry + executor + no-drift vs `P4_THIN_SLICE_REQUIRED_AGENTS`)
  and a new `unit_tests/test_vcso_sdk_config.py::test_model_driven_scopes_workers_to_external_server_and_hides_them_from_lead`
  (lead sees Task only; worker server absent top-level; each worker agent inline-scopes the external server;
  the inline config JSON-serializes). **Run these in the venv before deploy.**

**Also landed in `vcso_sdk_loop.py` (additive + fully gated; prefix `compile()`-clean; helper logic self-checked):**
- `native_model_driven: bool = False` threaded through `stream_vcso_sdk_turn` → `_run_sdk_turn`, and
  `model_driven = bool(native_model_driven) and native_mode` computed by `native_mode` (default off ⇒ Path A
  byte-identical).
- `model_driven_completed_children(client, parent_run_id, required_agents)` — the DB completion bridge
  (reads parent-linked `agent_delegation_runs`), and `build_model_driven_manifest(compiled, required_agents,
  worker_server_name)` — the inverted manifest. Both unit-tested in `test_vcso_worker_mcp.py`.

**Step 3 IMPLEMENTED (2026-07-16) — the model-driven branch is now in `vcso_sdk_loop.py`, fully gated
behind `native_model_driven` (the whole 1683-line prefix `compile()`-clean; Path A byte-identical when
off).** Landed insertions: `import os` + `SimpleNamespace` + worker-module imports; `native_subagent_tools`
built for model-driven; `pre_tool_probe` observe-only hook; `TURN_REGISTRY.mint(TurnScope(...))` + `worker_server_url`
(base = `VCSO_WORKER_MCP_BASE_URL` or `http://127.0.0.1:${PORT}`); `PreToolUse` = Task→`pre_task_use` +
`^mcp__.*$`→probe; Path-A worker-run and lead-surface-strip both guarded `if native_mode and not model_driven`;
compile with `enable_native_subagents=model_driven` + `model_driven_worker_server_url`; the completion bridge
in `post_tool_use`'s Task branch (DB lookup → synthesize completed marker); `build_model_driven_manifest`
gate that **aborts before `query_impl`** on any violation; token `unregister` after the query. The flag is
read + founder-scoped (via `diagnostic_user_ids`) in `vcso_chat_service.py` and threaded through.

**Correctness fix found while designing the integration test (already applied):** `post_tool_use`'s
completion bridge + subagent-step trace live in its `Task` branch, but the PostToolUse matcher was
`^mcp__.*$`, which never matches `Task`. Model-driven now registers
`PostToolUse = HookMatcher(matcher=r"^(Task|mcp__.*)$", hooks=[post_tool_use])` so Task completion actually
records. (Path A unchanged.)

**Remaining before the probe (venv only):**
- Add a `_run_sdk_turn` **model-driven** test (model it on `test_app_owned_workers_run_before_synthesis…`
  in `test_vcso_sdk_loop.py`). Single worker `structured_data_agent`. The `fake_query(options)` should:
  (1) assert `options.allowed_tools == ["Task"]`, the worker agent's `tools == ["mcp__vcso_workers__run_structured_data_agent"]`
  and its `mcpServers` is the inline external config, no `run_` in `allowed_tools`, `"PreToolUse" in options.hooks`;
  (2) drive the PreToolUse `Task` hook (`options.hooks["PreToolUse"][0].hooks[0]`) with
  `{"tool_input": {"subagent_type": "structured_data_agent", "prompt": <valid contract from _parse_task_contract's format>}, "agent_id": None}`, `tool_use_id="task-1"`;
  (3) drive the PreToolUse `^mcp__.*$` probe with `agent_id="sub-1"` to record `agent_id_present=true`;
  (4) drive the PostToolUse hook with `tool_name="Task", tool_use_id="task-1"` — this hits the DB completion
  bridge, so the test **store's client** must return `[{"capability_key":"structured_data_agent","status":"completed"}]`
  for `agent_delegation_runs`; (5) call the `Stop` hook and assert `{}` (not blocked); (6) yield answer + ResultMessage.
  Assert: a `runtime_manifest` lifecycle event with `decision == "model_driven"`, a `task_pre_tool_use` event,
  a `pre_tool_probe` event with `agent_id_present`, and a completed turn. Keep Path-A `_run_sdk_turn` tests green.
  *(This test needs `_parse_task_contract`'s exact contract format — read it in the venv where the full file is available.)*
- Run the full focused suite in the venv (`test_vcso_worker_mcp.py`, `test_vcso_sdk_config.py`,
  `test_vcso_sdk_loop.py`); confirm the FastMCP mount serves locally (Step 1 validation, incl. the
  lifespan note); confirm the Railway `PORT`/base URL the CLI subprocess reaches (`VCSO_WORKER_MCP_BASE_URL`
  overrides if the default `http://127.0.0.1:${PORT}` is wrong).

*(Historical: the gated insertions below were the spec before Step 3 landed; retained for review.)*

---

## Step 1 — FastMCP worker endpoint on the FastAPI app (transport over the core)

Add a loopback **Streamable-HTTP** MCP server exposing one tool per P4 capability, backed by the core.

- Use `mcp.server.fastmcp.FastMCP` (pkg `mcp` 1.28.1 is installed). Register three tools —
  `run_structured_data_agent`, `run_sandbox_execution_agent`, `run_per_user_wiki` — each with the same
  input schema the in-process handler uses (`objective`, `output_format`, `tools_sources`, `boundaries`,
  `context_scope`; `readOnlyHint=True`).
- **Per-turn scope via the URL, not a header** (avoids per-tool header plumbing inside FastMCP): mount the
  MCP app so the per-turn token is a path segment, e.g. serve at `…/mcp/workers` and pass the token as the
  trailing path/query the agent's inline config carries; a thin ASGI wrapper reads the token and stashes it
  in a `contextvar` before delegating to the FastMCP ASGI app. Each tool body reads the contextvar token and
  calls `await run_worker_capability(token, "<capability>", args)`; map `WorkerScopeError` → MCP `is_error`.
- Mount on the existing `app` in `main.py` (single FastAPI app; loopback keeps it same-process as the
  `claude` CLI subprocess so `TURN_REGISTRY` is shared). Bind URL = `http://127.0.0.1:${PORT}/…`.
- **Validate (local, no canary):** start the backend; `initialize` + `tools/list` against the endpoint
  returns exactly the three tools; a `tools/call` with a registered probe token creates one
  `agent_delegation_runs` child row; an unknown/expired token → clean `is_error`, no row.

## Step 2 — `vcso_sdk_config.py`: external-per-agent worker scoping (the actual fix)

Add a compile path (selected only when model-driven is on) that inverts today's in-process trap
(`:119,132,160–177`):

- Do **not** register `run_<agent>` handlers on the in-process `SDK_INTERNAL_SERVER`, and do **not** put
  them in top-level `mcp_servers` or `main_allowed_tools`.
- Give each worker `AgentDefinition` an **inline external** `mcpServers` entry (the loopback worker server,
  `type:"http"`, url carrying the per-turn token), with `tools=["mcp__<worker_server>__run_<key>"]`.
- Lead `options.allowed_tools = ["Task", *non-worker registry tools]`; top-level `mcp_servers` carries
  **only** any real registry connectors (no worker server). `strict_mcp_config=True` stays.
- The per-turn token is a compile input (minted in the loop, Step 3) so the inline URL is turn-specific.

## Step 3 — `vcso_sdk_loop.py`: model-driven branch behind `native_model_driven_enabled`

Exact structure confirmed against the live file (native branch at `_run_sdk_turn` ~1167–1230):

- **Flag:** add `settings.native_model_driven_enabled` (+ reuse `diagnostic_user_ids` for founder scoping)
  read where `native_subagent_requirements` is evaluated; a new local `model_driven` selects the branch;
  default off ⇒ the existing `if native_mode:` Path-A block (1168–1230) is **untouched**. `vcso_planner`
  stays retired.
- **Mint + register the turn scope** (before compile): `token = TURN_REGISTRY.mint(TurnScope(user_id=…,
  parent_surface=…, thread_id=…, parent_run_id=…, allowed_capabilities=set(required_agents), store=…,
  progress_bridge=<bridge or None>))`; `url = worker_server_url(loopback_base, token)`. Add
  `finally: TURN_REGISTRY.unregister(token)` around the query.
- **Compile model-driven**, in place of the Path-A block: `enable_native_subagents=True`,
  `model_driven_worker_server_url=url`, and do **NOT** run `run_app_owned_workers()` and do **NOT** strip
  `options.agents`/`options.allowed_tools` (that stripping at 1217–1223 is Path-A-only — guard it with
  `if native_mode and not model_driven:`). Pass `enable_native_subagents=False` only for Path A.
- **Hooks:** register `PreToolUse Task → pre_task_use` (contract/order/single-run/cap + the subagent-start
  UI chip) and keep the observe-only `^mcp__.*$` PreToolUse probe (logs `agent_id_present`) + `stop_hook`
  as the safety-net + the existing PostToolUse/PostToolUseFailure/PreCompact hooks. `make_native_handler_tool`
  is **not** used here (workers are external).
- **⚠ Newly-found bridge requirement (the crux of Step 3):** with model-driven delegation the workers run
  **out-of-process** (in the endpoint request), so — unlike Path A's `run_app_owned_workers`, which marks
  `completed_agents` and emits the nested-UI events in-process — nothing in the turn coroutine observes a
  worker completion. Two consequences must be handled or `stop_hook` blocks forever → `max_turns`:
  1. **Completion signal for `stop_hook`.** Either (a) wire `TurnScope.progress_bridge` so the endpoint,
     on worker completion, calls back into the loop to `completed_agents.add(capability)` and emit the
     `sub_agent_step`/`sources_updated` events (same-process, so the closure is reachable — mind that the
     callback runs in the endpoint's task, so keep the mutation a simple `set.add` + `events.put`), **or**
     (b) make `stop_hook` (and `missing_after_query`) query `agent_delegation_runs` by `parent_run_id` for
     completed children instead of the in-memory set. **(b) is the cleaner separation and is recommended
     for the probe;** (a) is the fuller C2 surface path and is the natural **M4** work.
  2. **prior_findings chaining** (structured → sandbox) crosses the hop: populate `TurnScope.prior_findings`
     as children complete (only needed once the multi-worker anchor runs; the single-worker probe skips it).
  For the **one-worker visibility probe**, take path (b) with a DB-backed completion check and
  `progress_bridge=None` — minimal surface, settles the §4 residual without the full C2 re-plumb (deferred
  to M4).
- **Parallel inverted manifest:** call the landed `build_model_driven_manifest(compiled,
  required_agents=required_agents, worker_server_name=MODEL_DRIVEN_WORKER_SERVER)` and **abort before
  `query_impl`** if `violations` is non-empty (record a lifecycle event). Do **not** edit Path A's
  `build_native_runtime_manifest`.

### The remaining gated insertions (each guarded by `if model_driven:` / `if native_mode and not model_driven:`)
1. **Loopback base URL:** resolve `http://127.0.0.1:${PORT}` (the port the FastAPI app binds on Railway;
   confirm the env var name in `core/config`/startup). `url = worker_server_url(base, token)`.
2. **Token + scope:** before compile — `token = TURN_REGISTRY.mint(TurnScope(user_id=tool_context.user_id,
   parent_surface=tool_context.metadata.get("surface","virtual_cso"), thread_id=tool_context.thread_id,
   parent_message_id=tool_context.metadata.get("parent_message_id"),
   parent_run_id=tool_context.metadata.get("parent_run_id"), allowed_capabilities=frozenset(required_agents),
   store=tool_context.store, progress_bridge=None))`. Wrap the query in `try/finally:
   TURN_REGISTRY.unregister(token)`.
3. **Skip Path A:** guard the `native_findings = await run_app_owned_workers()` block with
   `if native_mode and not model_driven:`.
4. **Compile:** when `model_driven`, pass `enable_native_subagents=True`,
   `model_driven_worker_server_url=url`, `native_subagent_tools={k: {"name": f"run_{k}"} for k in required_agents}`,
   and use `_native_lead_prompt(required_agents)` (delegation instructions) instead of
   `_native_synthesis_prompt` (findings injection). Path A stays `enable_native_subagents=False`.
5. **Don't strip the lead surface:** guard the `options.agents = {}; options.allowed_tools = []` block
   (~1217–1223) with `if native_mode and not model_driven:`.
6. **Hooks:** when `model_driven`, add `"PreToolUse": [HookMatcher(matcher="Task", hooks=[pre_task_use]),
   HookMatcher(matcher=r"^mcp__.*$", hooks=[<observe-only probe logging agent_id_present>])]` to the hooks
   dict (Path A registers no PreToolUse).
7. **Completion bridge in `post_tool_use`'s `Task` branch:** when `model_driven` and
   `worker_results.get(capability_key) is None`, call `model_driven_completed_children(tool_context.store.client,
   parent_run_id=tool_context.metadata.get("parent_run_id"), required_agents=required_agents)`; if the
   capability is in the returned set, synthesize a minimal completed result (status/run_id/summary) into
   `worker_results`/`completed_agents` so `stop_hook` clears. (`stop_hook` itself is unchanged.)
8. **Manifest gate + lifecycle:** build + assert the inverted manifest (above); record
   `runtime_manifest decision=model_driven`.

**Test additions before deploy:** a `model_driven` compile-and-run of `_run_sdk_turn` with a fake
`query_impl` that (a) has the lead emit a `Task`, (b) the subagent call the external tool, asserting the
inverted manifest passes, the lead options expose no `run_<agent>`, and a completed child (faked in the DB
stub) clears `stop_hook`. Keep the existing Path-A `_run_sdk_turn` tests green (they run with
`native_model_driven=False`).

## Step 4 — Tests (focused, run in venv before deploy)

`run_worker_capability`: refuses unknown/foreign token and unpermitted capability; permitted call invokes
`start_run` with depth 1 / worker tier / compact contract (mock orchestrator) and returns the compact cited
result; `TurnRegistry` mint/get/unregister + stale eviction. Config: model-driven compile puts **no**
`run_<agent>` in lead `allowed_tools`/top-level, and each worker agent carries the inline external server.
Manifest: a leaked worker tool in the lead schema raises. Path A path unchanged (existing tests stay green).

## Step 5 — The cheap one-worker visibility probe (settles the §4 residual) — London's env

1. Commit the M2 diff version-tagged; deploy; **confirm deployed Railway head == the M2 SHA and
   `GET /api/health ok=true`** (mandatory — a stale deploy already cost a run).
2. Enroll **founder only**; `native_model_driven_enabled=true`; single worker
   `structured_data_agent` (deterministic ⇒ creates a child row with no worker-LLM cost, so any failure
   isolates to the new visibility/transport mechanism). Caps `max_turns=6`, `max_budget_usd=0.25`.
   `vcso_planner` off.
3. Send exactly one retained anchor turn.
4. **Pass = the mechanism works:** the lead's schema shows **no** `run_structured_data_agent`; the lead
   **emits `Task`**; the observe-only probe fires the worker call with **`agent_id_present=true`**; one
   `agent_delegation_runs` child row (`parent_run_id` set, `tier_worker → claude-haiku-4-5` attribution
   where applicable); a composed cited answer from the Task return. **Fail signature** (the §16 trap
   persisting) = lead direct-calls with `agent_id_present=false` or never emits `Task`.
5. **Re-darken immediately** (`native_model_driven_enabled=false`, `is_enabled=false`, empty allowlists);
   read back `vcso_sdk_loop` + `vcso_planner` dark.
6. **STOP for London.** Only on a clean probe proceed to **SDK-M3** (effort-scaling + explicit per-worker
   delegation contracts) and the full `structured → sandbox → wiki` anchor with the `progress_bridge` wired
   (M4 surface hold). Sandbox real compute stays deferred to Phase F.

---

**Locks preserved throughout:** founder isolation (token scope), one-writer, Claude-lock (Sonnet compose /
Haiku workers via MA-06 tier map), no model selector, tier authority at the capability grain, curated
transparency. Path A retained dark; native scaffolding not pruned; harness-root `ROADMAP.md` untouched.
