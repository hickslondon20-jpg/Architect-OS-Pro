# Phase 4 Completion - Sandbox Bridge / Code Mode (exec-channel)

**Completed:** 2026-07-03
**Scope:** 04-01 exec-channel bridge core + 04-02 integration into the sandbox execution path.
**Mechanism:** Option B (exec-channel) only, per CONTEXT.md. Option A (HTTP bridge) was not built.

## What Changed

- Added `python-backend/services/sandbox_bridge.py`:
  - `BridgeFulfiller` - host-side dispatcher. Only tools in the caller-supplied `allowed_tool_names` (minus a hard-coded `execute_code` denylist, enforced regardless of what the caller passes) may be dispatched; everything else returns a structured `{"ok": false, "error": ...}` instead of raising.
  - `generate_bridge_module_source(...)` - builds stdlib-only Python source (no network, no credentials) defining `tool_client` plus one typed stub function per tool in the scoped catalog, generated from the registry's neutral JSON schema (required params positional, optional params default `None`, `repr()`-escaped docstring from the tool description).
  - `BridgeToolCall` / `BridgeRunOutput` dataclasses for the host-side call trace and cell result.
- Extended `KubernetesInteractiveSandboxSession` in `python-backend/services/sandbox_service.py`:
  - `.bridge/requests` and `.bridge/responses` directories created alongside the existing `.interactive/commands`/`.interactive/results` at session bootstrap.
  - `run_with_bridge(code, fulfiller, timeout, poll_interval, max_tool_calls)` - prepends the generated stub source to the submitted code, writes the command via the existing `_write_remote_command`, then polls: check the existing result file (same completion signal `run()` already uses), list `.bridge/requests/`, fulfil any new request host-side via `fulfiller.fulfill(...)`, write the response back via a new `_write_remote_json` (atomic tmp-file + rename, matching the runner script's own write pattern), delete the request file, repeat until done or timeout. Raises `SandboxServiceError` if a cell exceeds `max_tool_calls`; raises the existing `SandboxTimeoutError` on timeout - both interrupt the runner first, mirroring `run()`'s existing timeout handling.
  - No inbound/outbound pod networking, no session tokens - the host->pod trust is the same authenticated K8s exec channel Ep4 already uses.
- Added `SandboxService.execute_code_with_bridge(...)` and `SandboxBridgeExecutionResult` alongside (not replacing) `execute_code`/`SandboxExecutionResult`.
- Wired `tool_registry.py`'s `_execute_code` executor to check `context.metadata.get("bridge_fulfiller")`: present -> route through `execute_code_with_bridge`; absent -> unchanged plain `execute_code` path. Bridge tool-call outcomes (tool name, ok/error only - never raw payloads) attach to `envelope.provenance["bridge_tool_calls"]`, a host-side-only channel that is never serialized back to Claude (only `envelope.content` is).
- Live-applied migration `016_sandbox_execution_agent_code_mode_catalog.sql`, widening the `sandbox_execution_agent` `agent_capabilities` row's `allowed_tools` to add the 8 KB/wiki read tools (`kb_ls`, `kb_tree`, `kb_grep`, `kb_glob`, `kb_read`, `wiki_search`, `wiki_get_page`, `wiki_list`) alongside the existing `execute_code`/`read_skill_file`. Mirrored in the `agent_capabilities.py` offline fallback.
- **Decoupled** the top-level Claude-facing tool list from that DB row: `run_execution` now passes the fixed `SANDBOX_EXECUTION_TOOLS` module constant (`RegistryNativeScopeSource`-built, unaffected by `agent_capabilities` content) instead of a live `agent_capabilities`-scoped query, so widening the row for Code Mode does not also expose those 8 tools to Claude's own top-level tool-use loop. Confirmed by asserting the exact `tools=` payload of the first Anthropic call in the new integration test.
- `sandbox_execution_service.py`:
  - `run_execution(...)` gained a `surface: str = "virtual_cso"` parameter (default preserves existing callers).
  - `_resolve_code_mode_tool_names(surface)` queries `self.tool_registry.get_tools(surface=surface, capability="sandbox_execution_agent", format="definition")` (the Phase 2 `AgentCapabilityScopeSource` resolver already used for the top-level list pre-decoupling) and excludes `{"execute_code", "read_skill_file"}`; degrades to `[]` on `AgentCapabilityError` (surface not authorized) instead of raising, so Code Mode is additive, not a hard dependency.
  - `_build_code_mode_fulfiller(...)` builds a `BridgeFulfiller` reusing the existing `_VectorStoreProxy(self._supabase, self._settings)` as `context.store` - no new plumbing needed since `KbNavigationService`/`DocWikiReadService` only ever touch `store.client`.
  - `_dispatch_tool`/`_execute_tool` thread an optional `bridge_fulfiller` through `ToolExecutionContext.metadata`.
  - `_bridge_call_steps(...)` turns `envelope.provenance["bridge_tool_calls"]` into additional curated `tool_steps` entries (tool name + ok/error, no arguments, no code) alongside the existing `execute_code` step.
  - `_build_system_prompt(...)` appends a short Code Mode note (only when tools are available) naming the callable functions, so Claude knows it can call them as plain Python functions inside `execute_code`.
- `sub_agent_orchestrator.py`'s `_handle_sandbox_execution` now passes `surface=context.parent_surface` (from the existing `AgentContextBundle`) into `run_execution`, so the scoped catalog derives from the invoking surface rather than a hardcoded `"virtual_cso"` - the Domain Agents inheritance path (BRIDGE-06) requires no VCSO-specific or Domain-Agent-specific code, only their own future wiring reaching this same call.
- Added `python-backend/infra/gke/sandbox-network-policy.yaml`: a deny-all egress `NetworkPolicy` selecting `app: sandbox` (the label `llm_sandbox`'s Kubernetes backend already applies to every pod it creates), with apply/verify steps documented in the file. DNS is deliberately not allowed, matching the exec-channel design (the pod never resolves a hostname or opens an outbound socket).
- Added `python-backend/tests/test_sandbox_bridge_phase4.py`:
  - Pure unit tests for `generate_bridge_module_source` (valid Python, correct stub signatures, stdlib-only) and `BridgeFulfiller` (in-catalog resolves, out-of-catalog rejected, `execute_code` denylisted even when explicitly passed as allowed, exceptions turned into structured errors).
  - A standalone harness (`_HarnessSandboxSession`, a `KubernetesInteractiveSandboxSession` subclass that skips the real K8s-backed `__init__` and duck-types `execute_command` against a local temp directory via Git Bash) plus a background thread standing in for the persistent in-pod IPython runner (executing submitted cells the same way `_INTERACTIVE_RUNNER_SCRIPT`'s own loop body does). This exercises the *real* `run_with_bridge`/`_poll_bridge_requests`/`_write_remote_json` code, not a re-implementation, and proves: an in-catalog tool resolves end to end (with the citation envelope visible in-pod); an out-of-catalog call is rejected inside the cell; `execute_code` is rejected from inside code even when explicitly allowed; a no-tool cell behaves exactly like a plain `run()` call; exceeding `max_tool_calls` raises and interrupts the runner.
- Added `python-backend/tests/test_sandbox_execution_service_phase4.py`: proves `execute_code` routes through the bridge with the widened Code Mode catalog and that the top-level tool list stays exactly `execute_code`/`read_skill_file`; proves the fallback to the plain path when the invoking surface isn't authorized for `sandbox_execution_agent`.

## Verification

- Live Supabase pre-check confirmed `sandbox_execution_agent.allowed_tools = ["execute_code", "read_skill_file"]` before the change.
- Live migration `sandbox_execution_agent_code_mode_catalog` applied to project `pwacpjqkntnovndhspxt`.
- Live Supabase post-check confirmed `sandbox_execution_agent.allowed_tools` now contains all 10 tools (the original 2 plus the 8 KB/wiki read tools).
- `python -m pytest python-backend\tests\test_sandbox_bridge_phase4.py python-backend\tests\test_sandbox_execution_service_phase4.py python-backend\tests\test_tool_registry_phase2.py python-backend\tests\test_vcso_chat_service_phase3.py python-backend\tests\test_skills_phase4.py` passed: 20 passed. One harness test (`test_run_with_bridge_enforces_max_tool_calls`) was initially flaky under variable subprocess/bash round-trip latency because it raced a second tool call against a wall-clock deadline; redesigned to use a zero-call budget so it resolves as soon as the host sees the first request file, with no timing race - reran 4x clean afterward.
- `python -m compileall python-backend` passed clean (no `.pytest_cache` warning surfaced this run).
- Changed-module syntax checks passed individually: `sandbox_bridge.py`, `sandbox_service.py`, `tool_registry.py`, `agent_capabilities.py`, `sandbox_execution_service.py`, `sub_agent_orchestrator.py`.

### Explicitly flagged as not done (no GCP/Anthropic credentials in this checkout)

- **Live GKE end-to-end smoke.** No live pod was opened; the standalone harness proves the protocol logic (host poll loop, request/response file handshake, generated stub correctness, authorization boundary) against a local filesystem stand-in, not the real cluster. `ANTHROPIC_API_KEY`, `ARCHITECTOS_GKE_SERVICE_ACCOUNT_KEY`, `ARCHITECTOS_GCP_PROJECT_ID`, and Supabase service-role credentials were all confirmed unset in this environment before starting.
- **Live NetworkPolicy enforcement.** `python-backend/infra/gke/sandbox-network-policy.yaml` was written and documented but not `kubectl apply`'d or confirmed against a real Autopilot cluster. The file documents the exact verification steps (apply, open a session, attempt an outbound request from inside the pod, confirm it fails) for whoever next has cluster access.
- **A live Virtual CSO turn actually triggering a Code Mode run against real founder data.** The wiring is proven with fakes (`test_sandbox_execution_service_phase4.py`) and with the real bridge protocol against a local stand-in pod (`test_sandbox_bridge_phase4.py`), but not against the live `delegate_to_sub_agent` -> `sandbox_execution_agent` -> GKE path end to end.

## Acceptance Criteria Mapping

- **BRIDGE-01:** Met in code + harness. In-pod `tool_client` + typed stubs call registry tools over the file protocol; the host fulfiller executes them host-side and returns results in one execution with no per-tool inference round trip (proven by the harness's `custom_add` call inside a single submitted cell).
- **BRIDGE-02:** Met. The scoped catalog is enforced host-side in `BridgeFulfiller.fulfill` (out-of-catalog rejected) with a hard `execute_code` denylist independent of whatever the caller passes; no KB-write tool exists in the registry to expose in the first place (one-writer holds by construction, not by this phase's filtering alone).
- **BRIDGE-03 / BRIDGE-04:** Met by construction. The in-pod stub module is stdlib file I/O only (`json`, `os`, `time`, `uuid` - no `requests`, no `socket`, confirmed by test assertion); credentials live only in the host-side `BridgeFulfiller`'s `ToolExecutionContext`. The deny-all egress NetworkPolicy manifest is written and documented; live cluster enforcement is the flagged gap above.
- **BRIDGE-05:** Met. `BridgeFulfiller.fulfill` returns `envelope.to_dict()`, which includes the Phase 2 citation envelope's `sources` (source_kind/source_id/verbatim where applicable) - proven in-pod by the harness reading `result['content']` back from a real registry-executed tool call.
- **BRIDGE-06:** Met. The scoped catalog derives from `_resolve_code_mode_tool_names(surface)`, and `surface` now threads from the invoking `AgentContextBundle.parent_surface` rather than being hardcoded - no VCSO-specific or Domain-Agent-specific bridge code exists; Domain Agents inherit this path unchanged once their own wiring calls `run_execution` with their surface.
- **Zero-overhead / additive:** Met. Plain `execute_code` with no tool calls is unchanged when `context.metadata.get("bridge_fulfiller")` is `None` (falls straight to the original `execute_code` call); when a fulfiller *is* present but the cell calls no tools, `run_with_bridge`'s only added cost versus `run()` is one extra (near-instant) directory listing per poll tick, proven equivalent in the harness's no-tool-cell test.
- **D1 stays open:** Met. `_resolve_code_mode_tool_names` uses `self.tool_registry`, which is constructed with the default `AgentCapabilityScopeSource` (Phase 2's swappable resolver) - no fusion or hardcoding of D1's outcome.
- **Curated trace only (L11):** Met. `_bridge_call_steps` emits only `{tool_name, summary, error}` - no arguments, no code, no raw payloads - as additional `agent_delegation_steps`-shaped entries alongside the existing `execute_code` step.

## Explicit Non-Scope Preserved

- No HTTP bridge (Option A) was built.
- No MCP tools were made bridge-callable (Phase 5).
- No degradation UI or interleaved-history rendering was built (Phases 6/7).
- D1 (one registry vs. two layers) was not resolved.
- No changes to Ep4 sandbox session persistence, artifact production, or the plain `execute_code` behavior when Code Mode is unused.

## Remaining Gaps / Next Phase Notes

- Whoever next has live GCP/Kubernetes access should: (1) `kubectl apply -f python-backend/infra/gke/sandbox-network-policy.yaml`, (2) confirm a sandbox pod cannot reach the network, (3) run a real Virtual CSO turn that triggers `delegate_to_sub_agent` -> `sandbox_execution_agent` with a task that needs a KB lookup, and confirm the Code Mode path executes against the real cluster. This is a verification pass on already-complete code, not new feature work.
- Phase 5 (MCP Client Scaffold) will register MCP tools as registry citizens; once that lands, MCP read/compute tools become automatically bridge-callable through the same `_resolve_code_mode_tool_names`/`BridgeFulfiller` path with no bridge-specific MCP code needed, per this phase's design.
