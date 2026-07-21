# Phase D2 Findings (SDK-M1) — Worker-Scoping Mechanism

**Checked:** 2026-07-16 against the vendored Claude Agent SDK `0.2.118`
(`python-backend/venv/Lib/site-packages/claude_agent_sdk`) and the live native-compilation code
(`services/vcso_sdk_config.py`, `services/vcso_sdk_loop.py`). Static source inspection only — no
code changed, no flag touched, no canary run. `vcso_sdk_loop` / `vcso_planner` remain dark.

> **Bottom line:** the source **confirms** that worker-scoping requires an **external MCP server**
> (`http` / `sse` / `stdio`) referenced **inline, per-agent** in `AgentDefinition.mcpServers` and kept
> **out** of top-level `options.mcp_servers`. It also **confirms** the in-process path (`SDK_INTERNAL_SERVER`)
> can never be hidden from the lead. The one thing the source **cannot** prove — because it lives in the
> compiled CLI binary — is whether the CLI actually *honors* an inline per-agent external config and
> hides its tools from the lead. That single residual is settled by a **cheap probe before any full
> canary**, not by another blind build. **STOP for London after this note.**

---

## 1. Objective

Confirm, from the SDK source, the minimal mechanism that makes the `run_<agent>` worker handler tools
**invisible to the lead** yet **callable inside a Task-spawned subagent** — so the lead *must* reason a
decomposition and delegate via `Task` (the D2 goal), instead of direct-calling the handler (the §16
failure). Validate the external/scoped-MCP-server path named in handoff §17.

## 2. What the source definitively proves

**(A) The lead sees every tool of a *top-level* MCP server; three scoping levers cannot remove it.**
- Top-level `options.mcp_servers` is serialized once for the whole session (`--mcp-config`,
  `transport/subprocess_cli.py:368–393`). In-process (`type=="sdk"`) instances are routed back over the
  control protocol (`_internal/client.py:140–146` extracts `sdk_mcp_servers` **only** from top-level).
- `allowed_tools` is permission-only, not visibility (`types.py:1740`). `disallowed_tools` is **global** —
  "removed from the model's context … even if otherwise allowed" (`types.py:1813–1818`) — so it also hides
  the tool from subagents; it cannot hide from the lead alone. `AgentDefinition` has **no** `allowed_tools`
  field (only `tools`, `disallowedTools`, `model`, `mcpServers`, `permissionMode`, …; `types.py:84–103`),
  and `AgentDefinition.tools` scopes the **subagent's** view, not the lead's.
- The SDK's own MCP bridge returns **all** of a server's tools on `tools/list` with no agent scoping
  (`_internal/query.py:602–631`). So the lead-vs-subagent visibility decision is made entirely inside the
  **compiled CLI**, not in the Python SDK.

**(B) The in-process server can never be agent-scoped.** `McpSdkServerConfig.instance: McpServer` is not
JSON-serializable (`types.py:628–633`; matches the §15 `TypeError`), and `sdk_mcp_servers` is extracted
**only** from top-level `options.mcp_servers` (`_internal/client.py:140–146`). An in-process server
referenced only inside an agent would therefore (i) fail to serialize and (ii) never be routed. **This is
exactly the live trap:** `vcso_sdk_config.py` puts every `run_<agent>` handler on the in-process
`SDK_INTERNAL_SERVER` (`:160–164`), registers it in top-level `mcp_servers` (`:177`), and each worker
`AgentDefinition` declares `mcpServers=[SDK_INTERNAL_SERVER]` (`:132`) — a **by-name reference to a
lead-visible top-level server**, which hides nothing. That is why §16's lead direct-called
`run_structured_data_agent` with `agent_id_present=false` and never spawned a `Task`.

**(C) External server configs are plain dicts and are delivered per-agent.** `McpStdioServerConfig` /
`McpSSEServerConfig` / `McpHttpServerConfig` are plain JSON `TypedDict`s (`types.py:603–625`).
`AgentDefinition.mcpServers` is typed `list[str | dict[str, Any]]` — "each entry is a server name **or an
inline `{name: config}` dict**" (`types.py:96–97`). The Python client sends agents verbatim via `asdict`
in the initialize request (`_internal/client.py:157–163` → `_internal/query.py:207–208`), so an inline
external config on a worker agent **is delivered to the CLI**, and — critically — need **not** appear in
top-level `mcp_servers`. That is the only construction that keeps the worker tools out of the lead's
schema while remaining reachable inside the subagent.

## 3. Chosen mechanism (minimal viable)

**Re-expose the worker handlers as an external MCP server, referenced inline per-agent, kept out of
top-level `mcp_servers`.** Concretely, the minimal-viable form that avoids a second process and reuses the
running backend:

- **Transport:** an **MCP-over-HTTP endpoint on the existing FastAPI backend** (loopback), described to
  each worker agent as an inline `McpHttpServerConfig`
  (`{"vcso_workers": {"type": "http", "url": "http://127.0.0.1:<port>/mcp/workers",
  "headers": {"X-VCSO-Turn": "<signed per-turn token>"}}}`). Loopback HTTP satisfies the SDK's
  "external, serializable, not-in-top-level" requirement **while the handler code still runs in-process**,
  so it calls the existing `SubAgentOrchestrator.start_run` directly — **reuse, no rewrite** (handoff §17
  Path-N substrate, minus a separate process).
- **Scoping:** the server appears **only** in each worker's `AgentDefinition.mcpServers`; top-level
  `options.mcp_servers` carries **no** `run_<agent>` tool. The lead's schema is then `Task` + any selectable
  registry tools only. `strict_mcp_config=True` stays (already set, `:178`).
- **Per-turn authority:** the `X-VCSO-Turn` header carries a short-lived signed token binding
  founder_id / thread_id / parent_run_id / allowed capability set, so the endpoint enforces founder
  isolation and cannot be replayed cross-turn. (Preserves the founder-isolation lock without an SDK
  permission channel.)
- **Delegation-first guarantee** stays in code we control: the handler still refuses unless invoked inside
  an approved `Task` contract (the existing `task_contracts` gate), so a stray lead call can never execute
  a worker — independent of whatever the CLI does.

Why not stdio: a stdio subprocess is the textbook external option but adds a process lifecycle, a second
copy of founder/orchestrator state, and cold-start latency per turn. Loopback HTTP on the app we already
run is strictly smaller. Both are equally valid to the SDK (both are plain-dict external configs); HTTP is
the minimal one for our stack.

## 4. The one residual the source cannot settle (and why we gate on it)

Whether the **compiled CLI** (`_bundled/claude.exe`, 251 MB binary) actually (a) honors an inline
per-agent external `mcpServers` entry, (b) connects that server only within the subagent context, and
(c) omits its tools from the lead's tool schema — is **not verifiable from the Python source**. The Python
side only proves *delivery* (§2C), not *consumption*. Handoff §17.2 flagged the same limit. Every one of
the six burned versions died by assuming CLI behavior that source couldn't confirm; this note does not
repeat that. Instead it names the residual explicitly and settles it with a **cheap probe before the full
build/canary** (§6).

## 5. Self-diagnosing instrumentation (so the next canary is unambiguous)

Building on the §10.5 / §14 observe-only probe (already **proven to fire**, reporting `agent_id_present`):

1. **Pre-query manifest assertion (no credits).** Extend the existing runtime manifest to assert the
   **lead schema is Task-only**: `worker_tools_in_top_level == []`, `lead_allowed_tools == ["Task", …non-worker
   registry…]`, and `worker_server_scope == "per_agent_external"`. Abort before `query_impl` if any
   `run_<agent>` tool leaks into top-level — a statically-invalid surface never spends a canary.
2. **Observe-only PreToolUse probe** on the proven `^mcp__.*$` matcher (returns `{}`, no permission
   decision): log `tool_name`, `agent_id_present`, `tool_use_id`. Distinguishes a lead direct-call
   (`agent_id_present=false` — the failure signature) from a subagent call (`true` — success).
3. **Lifecycle snapshots** on the parent `agent_delegation_runs.metadata` (bounded, no prompts/payloads):
   `lead_emitted_task`, `worker_tool_fired`, `worker_agent_id_present`, `handler_delegated`,
   `child_run_id`, `child_status`. One canary then reads as a clean truth table:
   lead reasons → `Task` → subagent worker call (`agent_id_present=true`) → handler fires → child row.

## 6. Recommendation + de-risking sequence (gated on London)

1. **STOP here for London review** of this note and the chosen mechanism. (This gate is the whole point;
   do not implement on the unproven CLI-consumption assumption in §4.)
2. **If approved — build order (SDK-M2..M4), all behind `vcso_sdk_loop` (dark, founder-only):**
   a. Stand up the loopback HTTP worker MCP endpoint; wire the handlers to the existing
      `SubAgentOrchestrator` (reuse). Add the manifest assertion + probe + lifecycle snapshots (§5).
   b. **Cheapest live probe first:** a single founder-only one-worker canary whose *only* job is to settle
      §4 — confirm the lead does **not** see/call `run_<agent>` and **does** emit `Task`, and the subagent
      worker call fires with `agent_id_present=true`. Confirm deployed head == SHA + `/api/health ok=true`
      first; re-darken immediately.
   c. Only on a clean probe: the full `structured → sandbox → wiki` anchor, with Path A's stop-hook kept as
      the **safety-net** (catches a clearly-missing mandatory child), effort-scaling, and explicit
      per-worker delegation contracts.
3. **Path A stays the dark fallback**; the native-delegation scaffolding is **not** pruned. Sandbox real
   computation stays deferred to Phase F (financial-series storage + MCP).

## 7. Status

SDK-M1 research complete; mechanism chosen and its single residual named. **STOPPED for London.** No code
changed, no flag touched, no canary run. Pre-fix (b) (`harness_engine.py:110` → `VectorStore.from_env()`)
is applied on disk and parse-verified, pending London's version-tagged commit from the host (the sandbox
mount is an OneDrive placeholder; committing from it would corrupt the file — see the confirmation runbook).

---

## 8. Addendum (post-approval, 2026-07-16) — two implementation discoveries + M2 core landed

London approved the mechanism and "proceed." Building SDK-M2 surfaced two things this note under-specified;
both are resolved **within** the approved mechanism (no lock touched, no new conflict), and are recorded
here so the build is honest about them.

**Discovery 1 — the external worker server runs in a *separate request context*, not the turn coroutine.**
§3 said "the handler code still runs in-process, reuse." Precise correction: the *orchestrator call* is
reused, but a loopback endpoint is a **fresh request context** with no reference to the live
`_run_sdk_turn` locals (the SSE `events` queue, `task_contracts`, `worker_results`). So the in-process
shared-state coupling the current handler relies on (and that C2 nested-UI/citations + the delegation-first
guard depend on) does **not** exist across the hop. Resolution — a **per-turn token + a process-global
`TurnRegistry`** (loopback ⇒ same process ⇒ a locked dict suffices): the turn mints a token, registers its
founder scope (user/thread/parent-run + permitted capabilities + store + an optional progress bridge), and
the worker endpoint recovers that scope by token. Delegation-first + founder isolation are enforced in this
code (valid token + permitted capability), **not** via an SDK permission channel. The C2 nested-UI/citations
surface is preserved by the optional `progress_bridge` (wired in **M4**, the surface hold); the bare
**visibility probe does not need it** (child rows are DB-side; the lead composes from the Task return value).
This core landed as `python-backend/services/vcso_worker_mcp.py` (`TurnScope` / `TurnRegistry` /
`run_worker_capability`), transport-agnostic and `py_compile`-clean; **imported by nothing** until the M2
wiring lands behind the dark sub-flag.

**Discovery 2 — the runtime-manifest invariants INVERT for model-driven.** `build_native_runtime_manifest`
today encodes the Fix-C in-process model: it *expects* each `run_<agent>` handler to be in the lead's
`allowed_tools` and the worker server to be `SDK_INTERNAL_SERVER` scoped in the agent (`vcso_sdk_loop.py:256–266`).
For D2 those become **violations**: the worker handler tools must be **absent** from the lead's schema, and
the worker server must be an **external config referenced only per-agent** (never top-level). M2 adds a
**parallel model-driven manifest** (does not edit Path A's) that asserts: lead `allowed_tools == ["Task", …non-worker
registry…]`; **no** `run_<agent>` in top-level `mcp_servers`/lead schema; each worker agent's `mcpServers`
carries the external worker config. It aborts before `query_impl` on any violation — so a statically-invalid
surface never spends a canary.

**Why the transport + wiring were not blind-written here.** The remaining M2 pieces (FastMCP HTTP mount on
`main.py`, per-turn token-in-path plumbing, whether the compiled CLI actually reaches a loopback server
*and* hides its tools from the lead — the §4 residual) are **live-only unknowns**. Writing them blind, with
no ability to run the venv/deploy/canary from the sandbox, is precisely the six-versions-burned pattern.
They are specified for step-by-step build + validation in `04B-D2-M2-BUILD.md`, gated by the cheap
one-worker probe.

---

## 9. Defect 6 (2026-07-20) — silent `dontAsk` deny of the subagent worker tool (fixed in v0.6.75) — **RESOLVED & VERIFIED LIVE by Canary 5**

> **Status: RESOLVED & VERIFIED LIVE by Canary 5 (2026-07-20, deployed `56c8d604`/v0.6.76; parent run
> `28d1b9ce-954e-4a21-9e76-77700b1886a1`, child `3f5554f0-686e-4e9e-aeac-0609ba992276`).** The `CallToolRequest`
> now dispatches: the subagent worker call fired, produced a completed child row, and drove a founder-visible
> cited answer. See `04B-D2-M2-FINISH-LOG.md` → "Canary 5".


**Symptom.** The 2026-07-20 model-driven canary (parent run `40e39ee8-4262-4d7f-a0fc-19a676798a26`) had the
lead correctly emit `Task` and the subagent correctly attach the external worker server — the worker's
`tools/list` (ListTools) returned **200** — yet **zero** `CallToolRequest` ever reached the worker server:
no child `agent_delegation_runs` row, no worker spend. The subagent's handler call was **silently denied**.

**Root cause.** Under `permission_mode="dontAsk"`, a subagent MCP tool call is denied unless the tool name is
pre-approved on the **parent's** `allowed_tools`. `AgentDefinition` has no `allowedTools` field in
claude-agent-sdk `0.2.118` (§2A), so the subagent inherits the lead's permission surface. In model-driven mode
the lead's `allowed_tools` was `["Task"]` only — the `mcp__vcso_workers__run_<agent>` handler names were never
pre-approved anywhere — so every subagent worker call was refused before it left the CLI.

**Why the manifest missed it (and made it worse).** Discovery 2 (§8) asserted the invariant *inverted* — it
guarded **pre-approval**, flagging `model_driven_worker_tool_on_lead` whenever a `__run_` handler appeared in
the lead's `allowed_tools`. That is the wrong surface: pre-approval is exactly what `dontAsk` **requires**, so
the old gate actively forbade the fix. The real isolation surface is **availability/attachment**, not
permission — a handler leaks to the lead only if the worker server is attached top-level or the handler name
is in the lead's `tools` availability list, neither of which pre-approval touches.

**Fix (v0.6.75).** (a) `vcso_sdk_config.py` now pre-approves every provisioned `mcp__vcso_workers__run_<agent>`
handler on the lead's `allowed_tools`, derived from the same list that builds the per-agent
`AgentDefinition.tools` (no drift). (b) `build_model_driven_manifest` is inverted: it flags
`worker_handler_not_preapproved:<tool>` when a provisioned handler is **absent** from `allowed_tools`, and
moves the leak-check onto the real exposure surface (worker server attached in top-level `mcp_servers`, or a
handler name in the lead's `tools` availability list). Isolation is unchanged — the worker server stays
per-agent-only and the handlers stay out of the lead's availability list; only the permission surface opened.

## 10. Worker tool-call timeout (2026-07-20) — per-agent `timeout` config key REJECTED by the deployed CLI; delivered via `MCP_TOOL_TIMEOUT` env var instead

The slow `sandbox_execution_agent` worker (~113s in-band, canary 8) exceeds the CLI's default MCP tool-call
timeout (~60s), which caused canaries 6/7 to lose the worker return in-band. The first attempt at a fix
(**v0.6.80**) set a per-agent http `timeout` config key on the inline worker `McpHttpServerConfig`. **The
deployed Linux CLI rejected it**: canary 7 ran the lead but produced **zero delegations and zero worker
calls** — the malformed/unknown key broke delegation entirely. **Reverted in v0.6.82.**

The working delivery is the **Railway env var `MCP_TOOL_TIMEOUT=240000`** (ms). The SDK forwards the
backend process environment to the CLI subprocess, so the 240s worker tool-call timeout reaches the CLI
without any per-agent config key. This is **not in code** — it lives only in the Railway service env.
Canary 8 confirmed it live: the 113s sandbox worker returned in-band under the 240s window.

**Do not re-add the per-agent `timeout` key** — it is rejected by the deployed CLI and breaks delegation.
See the CRITICAL INFRA NOTE in `04B-D2-TIER2-CLOSE-HANDOFF.md`.

---

## 11. Defect 7 (2026-07-21) — **worker subagents can call each other's tools** (per-turn token is not per-capability) — OPEN, M3

**Severity: this is an isolation defect, not a cosmetic one.** It has now broken one canary outright
(Canary 10a) and silently distorted the evidence of another (Canary 9-retry).

### Mechanism

The per-turn token scopes a worker call to one **founder/thread/parent-run** — but **not to one
capability**. Three things compose badly:

1. `TURN_REGISTRY` mints **one token per turn** (`vcso_sdk_loop.py`, model-driven branch), and every
   worker `AgentDefinition.mcpServers` entry points at that **same** URL (`?t=<turn-token>`).
2. The external FastMCP server exposes **all three** `run_<capability>` tools on that one endpoint
   (`vcso_worker_mcp_server.py` — one server, three `@server.tool` registrations).
3. `run_worker_capability` authorises against `scope.allowed_capabilities`, which is
   `frozenset(required_agents)` — **all three** for the turn.

So the scope check asks *"is this capability permitted for this turn?"* when it needs to ask *"is this
capability permitted for **the subagent making the call**?"*. Any worker subagent can invoke any sibling
worker's tool and it is authorised. Nothing in the manifest catches it: `build_model_driven_manifest`
verifies the surface is correctly *scoped and pre-approved*, which it is — the leak is at call time.

### Observed — Canary 10a (2026-07-21, `e2cacc08`/v0.6.90) — the canary it broke

```
seq 7   Task allow  → sandbox_execution_agent      delegation approved
seq 8   probe       → run_structured_data_agent    the sandbox subagent called the WRONG tool
seq 9   Task deny   → structured_data_agent        "may run only once per turn"
seq 10  Task deny   → sandbox_execution_agent      "may run only once per turn"
seq 11  Task deny   → sandbox_execution_agent      "may run only once per turn"
```

The sandbox subagent called `run_structured_data_agent`; the v0.6.84 dedupe returned the **cached
structured result**; the subagent accepted that as its answer and returned **without ever calling its own
tool**. `sandbox_execution_agent` therefore has **no child row at all** — so the `after_completion` fault
injection had nothing to fire on, and Item 2(a) went untested. The lead then tried three times to
re-delegate, hit the once-per-turn guard each time, and ground out at `max_turns`. **$0.2196, no answer.**

### Correction to the Canary 9-retry record (§ "Canary 9-retry" in `04B-D2-M2-FINISH-LOG.md`)

Canary 9-retry showed the **identical** pattern — sandbox's subagent called `run_structured_data_agent`
(seq 7) and only then called its own tool (seq 8). That run's "duplicate" was recorded as proof the dedupe
had caught **a re-sent CLI `tools/call` (defect #4)**. That attribution is **wrong**: it was a
cross-worker call, i.e. this defect.

**What still stands:** the dedupe worked, coalesced the duplicate onto the first child, and prevented a
second `start_run` — Item 1's acceptance ("a re-sent `tools/call` does not start a second `start_run`;
one dispatch per `(token, capability_key)`") is met by observed behaviour. **Item 1 stays closed.**

**What does not stand:** that canary is *not* evidence that defect #4's CLI-re-send scenario occurs live.
It has still never been observed. The dedupe is also now **masking** defect 7 — without it, a cross-worker
call would surface as a visible duplicate child row.

### Fix direction (M3)

Mint the token **per `(turn, capability)`** instead of per turn: each `AgentDefinition.mcpServers` entry
carries its own token whose `TurnScope.allowed_capabilities` is **its own capability only**. The existing
refusal in `run_worker_capability` ("Capability X is not permitted for this turn") then rejects
cross-worker calls with **no new authorisation logic** — the registry, the scope object, and the check are
all already in place. `TurnScope` gains nothing; `TURN_REGISTRY` holds N scopes per turn instead of 1, and
the loop unregisters all of them.

Natural home is **SDK-M3** (explicit per-worker delegation contracts). Do not land it as a hotfix inside
the D2 polish batch.

### Secondary finding — failed turns lose their diagnostics

The `worker_hop` drain (`vcso_sdk_loop.py`, after the query loop) and the child usage-attribution loop both
run **after** the SDK query completes. A turn that raises — `max_turns`, a required-worker block, a client
disconnect — skips both. Canary 10a's lifecycle therefore carries **zero** `worker_hop` entries and **zero**
child usage rows, i.e. we lose the worker-level evidence precisely on the turns that most need explaining.
Wrap the drain in `try/finally` so diagnostics survive the failure path.
