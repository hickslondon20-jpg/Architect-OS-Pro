# State: Advanced Tool Calling & the Shared Capability Layer - ArchitectOS Pro

**Last updated:** 2026-07-03

## Current Focus

**Phase 7 complete.** Advanced Tool Calling is closed: Virtual CSO traces now carry citation-ready source refs through persistence and live SSE, reload reconstruction keeps the rich typed fields, and the shared trace panel renders ordered tool/sub-agent/code-execution panels as curated summaries only.

- `REQUIREMENTS.md` - adaptation notes vs. reference Ep5, 25 v1 requirements across 7 capability groups, v2/deferred, out-of-scope, traceability table.
- `CONTEXT.md` - why the build exists, every adopt/adapt/skip decision with rationale, the locked corrections, the 11 decisions execution agents must not override, and the deferred registry.
- `ROADMAP.md` - 7 phases, per-phase goal/depends-on/requirements/success criteria, progress tracker.
- `STATE.md` - this file.

## Current Phase

**Phase 7 complete; Advanced Tool Calling build complete (7 of 7).**

Phase 1 completed:

- Live migrations `013_capability_model_routing_usage_events` and `014_ai_usage_log_surface_tags` applied to Supabase project `pwacpjqkntnovndhspxt`.
- `vcso_chat`, all seven active experimental capabilities, and utility synthesis settings now resolve through `platform_ai_settings`.
- Primary chat remains Claude-locked and resolves `vcso_chat` with a non-Claude fallback guard.
- `ai_usage_log` is the single tagged stream with `role='main'|'sub_agent'|'utility'`, provider, capability/run linkage, and nullable `cost_usd`.
- Python sub-agent and utility model calls emit best-effort tagged events through one shared helper.
- Rollback-only live SQL proved row-edit model routing, degradation reconstruction, ledger-style reconstruction, and rollback cleanup.
- `python -m compileall python-backend` and `npm.cmd run build` passed, with only known/non-blocking warnings.

See `phases/01-foundations-model-routing-usage-events/COMPLETION.md` for the evidence summary.

Phase 2 completed:

- Added `services/tool_registry.py` with neutral JSON Schema tool definitions, `native` / `skill` / `mcp` source discriminator, executor abstraction, Anthropic and OpenAI adapters, compact catalog, pure-retrieval `tool_search`, and D1-swappable scoping sources.
- Registered the existing KB Explorer and sandbox native tools in the registry and rewired both services to source Anthropic tool schemas and dispatch through registry executors while preserving the model-facing result payloads.
- Added citation-ready result envelopes: `kb_read` and wiki reads/search/list produce `source_kind` / `source_id` / `verbatim` or label metadata; `execute_code` produces computation provenance; skill packs load by body with `skill_pack` provenance.
- Added skill-pack deferred registration from `skill_packs` with global-or-owner visibility; no parallel skills table was created.
- Live-applied migration `tool_registry_kb_explorer_allowed_tools` to align the `kb_explorer_agent.allowed_tools` authorization row with the eight-tool behavior already present in code.
- Added focused Phase 2 registry tests proving adapter parity, both scoping sources, skill visibility, pure retrieval search, and computation envelopes.
- Verification passed: live Supabase row/migration check, `python -m pytest python-backend\tests\test_tool_registry_phase2.py`, changed-module `py_compile`, and `python -m compileall python-backend` (only the known unreadable `.pytest_cache` warning).

See `phases/02-unified-tool-registry/COMPLETION.md` for the evidence summary.

Phase 3 completed:

- Added `python-backend/services/vcso_chat_service.py`, porting the Virtual CSO thread/message lifecycle, context assembly, skill routing, selected skill body loading through the registry, founder wiki context, prior tool-result context, `vcso_chat` model resolution, and `role='main'` usage logging into Python.
- Added a bounded Claude tool-use loop that sources tools from the Phase 2 registry with registry-native surface scoping, includes `tool_search`, and supports both direct registry execution and bounded sub-agent delegation through a registry `delegate_to_sub_agent` tool.
- Added the first browser-facing Python SSE endpoint: `POST /api/vcso/chat`, streaming `ready`, curated `step`/`tool_call`/`tool_result`, answer `token`, `done`, and `error` events with the same `event:`/`data:` framing as the existing frontend parser.
- Reused `agent_delegation_runs` and `agent_delegation_steps` for the main loop's trace, linking the run to the saved assistant message so the existing reload reconstruction path can read it.
- Updated the frontend chat client to target the Python endpoint via `VITE_INGESTION_API_URL` when `VITE_VCSO_PYTHON_STREAM=true`, preserving the Vercel `/api/vcso/chat` path as rollback.
- Streamed live curated trace entries into the existing `AgentStepsPanel` pattern and generalized the label from KB-only to CSO trace.
- Updated `CLAUDE.md` Rule #1 so VCSO streaming is recorded as part of the Python direct-Anthropic lane.
- Verification passed: `python -m pytest python-backend\tests\test_vcso_chat_service_phase3.py`, `python -m compileall python-backend` (only the known unreadable `.pytest_cache` warning), and `npm.cmd run build` (existing large chunk warning). Live end-to-end smoke remains blocked in this local checkout by missing live runtime credentials/API keys.

See `phases/03-vcso-tool-loop/COMPLETION.md` for the evidence summary.

Phase 4 completed:

- Added `python-backend/services/sandbox_bridge.py`: stdlib-only in-pod `tool_client` + a generator producing one typed stub function per scoped-catalog tool from the registry's neutral JSON schema, and a host-side `BridgeFulfiller` with a hard `execute_code` denylist enforced regardless of caller input.
- Extended `KubernetesInteractiveSandboxSession` (`sandbox_service.py`) with `run_with_bridge`, reusing the existing command/result exec-channel protocol and adding a `.bridge/requests`/`.bridge/responses` poll loop - no pod networking, no session tokens, same authenticated K8s exec channel Ep4 already relies on. `SandboxService.execute_code_with_bridge` added alongside plain `execute_code`.
- `tool_registry.py`'s `_execute_code` routes through the bridge only when `context.metadata["bridge_fulfiller"]` is set; the no-tool-calls path is byte-for-byte unchanged.
- Live-applied migration `016_sandbox_execution_agent_code_mode_catalog`, widening `sandbox_execution_agent.allowed_tools` to add the 8 KB/wiki read tools for Code Mode's catalog only. Deliberately decoupled the top-level Claude-facing tool list (`SANDBOX_EXECUTION_TOOLS`, a fixed module constant) from that DB row so widening it for Code Mode does not change what Claude's own tool-use loop sees.
- `sandbox_execution_service.py` computes the scoped catalog via the Phase 2 `AgentCapabilityScopeSource` resolver keyed off `surface` (now threaded from `AgentContextBundle.parent_surface`, so Domain Agents inherit this with zero VCSO-specific code), degrades to no Code Mode tools on an unauthorized surface instead of raising, and surfaces bridge tool calls as additional curated trace steps (tool name + ok/error only).
- Added `python-backend/infra/gke/sandbox-network-policy.yaml`: deny-all egress NetworkPolicy targeting `app: sandbox` pods, with apply/verify steps documented - not yet applied to a live cluster.
- Added a standalone harness (`tests/test_sandbox_bridge_phase4.py`) that runs the real `run_with_bridge` method against a local temp directory + a fake in-pod runner thread, proving in-catalog resolution, out-of-catalog rejection, `execute_code` self-recursion rejection, an unchanged no-tool cell, and max-tool-call enforcement - all without a live GKE cluster. `tests/test_sandbox_execution_service_phase4.py` proves the service-level wiring with fakes.
- Verification passed: live Supabase row check before/after migration 016, 20/20 relevant pytest (`test_sandbox_bridge_phase4`, `test_sandbox_execution_service_phase4`, plus the pre-existing Phase 2/3/skills suites, run twice for flake-checking), `python -m compileall python-backend` clean. Live GKE end-to-end smoke and live NetworkPolicy enforcement remain flagged gaps - no GCP/Anthropic credentials were available in this checkout.

See `phases/04-sandbox-bridge/COMPLETION.md` for the full evidence summary.

Phase 5 completed:

- Added `python-backend/services/mcp_client.py` with `MCPClientManager`, fake-adapter-testable discovery, lazy SDK import, and an explicit OAuth lifecycle stub. `mcp==1.13.1` is pinned in `python-backend/requirements.txt`, but zero-server beta startup does not import it.
- Updated `tool_registry.py` with `register_mcp_tools()`, MCP metadata on `ToolDefinition`, and citation-enveloped MCP execution through the manager. Fake-server tests prove discovery, conversion, registry registration, `tool_search`, scoping, and call execution.
- Added `docs/migrations/017_mcp_connections.sql` and live-applied migration `mcp_connections_scaffold` to Supabase project `pwacpjqkntnovndhspxt`.
- `mcp_connections` is metadata-only: no secret columns, RLS enabled, authenticated users can only select own rows, authenticated insert/update/delete are not granted, anon select is not granted, and a check constraint rejects common secret keys in `config`.
- Added `MCPCredentialStore` for service-role Vault writes and `vault.decrypted_secrets` reads. Live Vault smoke created a temp secret, verified decrypted readback, and deleted the temp row.
- Live production state confirmed `connected_count = 0`, so no MCP tools are configured or discoverable in beta.
- Added read-only connector candidates (QuickBooks, GoHighLevel, Notion) through `GET /api/skills/connectors` and rendered them in the existing `/pro/intelligence/skills` workspace with no connect button and no credential UI.
- Verification passed: Phase 5 fake-server/Vault/unit tests; Phase 2/3/4 service-level/skills regression subset; `python -m compileall python-backend`; `npm.cmd run build`. The pre-existing Phase 4 standalone filesystem harness still has local Windows temp/path friction when run under this workspace path; see Phase 5 `COMPLETION.md` for details.

See `phases/05-mcp-scaffold/COMPLETION.md` for the full evidence summary.

Phase 6 completed:

- Added migration `018_degradation_compaction`: `ai_models.context_window`, seeded `claude-sonnet-4-6` at 200000, seeded `vcso_context_compaction`, and added minimal `vcso_chat_threads` compaction columns.
- `VectorStore.resolve_platform_model` / `resolve_platform_setting` now read `ai_models.context_window` with a 200000 runtime fallback.
- `VcsoChatService` computes the per-turn peak main `input_tokens` from main-loop and final-stream calls, converts it to a founder-safe percentage remaining plus band, and streams it as a dedicated `context` SSE event with no raw tokens or cost.
- Added founder-initiated thread compaction via `POST /api/vcso/compact`; it summarizes older thread messages and prior tool results on the Python direct-Anthropic lane, logs `role='utility'`, stores the compacted summary on `vcso_chat_threads`, and never writes to the knowledge base.
- `_build_context` consumes the compacted thread summary and keeps newer messages/tool results full-fidelity.
- Frontend SSE handling now accepts the `context` event and renders a slim per-thread footer bar with green/amber/red bands plus an icon-only compaction affordance in amber/red.
- Verification passed: focused Phase 6/Phase 3 pytest, `python -m compileall python-backend`, and `npm.cmd run build`. `npx.cmd tsc --noEmit` still reports unrelated pre-existing type errors across older app surfaces. Live Supabase migration apply and live deployed chat/compaction smoke were not run from this checkout.

See `phases/06-degradation-compaction/COMPLETION.md` for the full evidence summary.

Phase 7 completed:

- Verified Phase 3 already writes `agent_delegation_steps.source_refs` from Phase 2 citation envelopes for successful tool results; Phase 7 kept that persistence path and added focused test coverage.
- VCSO live SSE `step`/`tool_call`/`tool_result` payloads now carry `stepIndex`, `stepType`, `title`, `summary`, and `sourceRefs`; `delegate_to_sub_agent` is typed as `sub_agent` or `code_execution` when it invokes `sandbox_execution_agent`.
- lib/virtualCsoApi.ts reconstructs step_type, 	itle, summary, and source_refs from gent_delegation_steps, filters lifecycle-only context_build/esult steps out of the founder trace, and feeds live and reload through the same AgentStep shape.
- AgentStepsPanel renders ordered typed panels for tool steps, sub-agent runs, and Code Mode execution with ArchitectOS tokens. It keeps sourceRefs in data only; no citation chips/sidecar/UI were built.
- Verification passed: python -m pytest python-backend\tests\test_vcso_chat_service_phase3.py, python -m compileall python-backend, and 
pm.cmd run build. Live deployed chat/reload smoke remains pending in this local checkout because live runtime credentials are unavailable.

See `.planning/tool-calling/phases/07-interleaved-history/COMPLETION.md` for the full evidence summary.

## Open Design Forks Carried Into Build-Planning

- **D1 - M8 `agent_capabilities` registry vs. Ep5 tool registry: one registry or two layers.** Lean: two layers. Held open through Phase 4; design so either stays reachable in Phase 5.
- **Retrieval-router pre-step fate.** Resolved in Phase 3: absorbed into in-loop `tool_search`; no separate preflight router was kept.
- **GKE bridge networking.** Resolved in Phase 4 by choosing the exec-channel mechanism (Option B) - there is no pod-to-service networking, no session-token auth to design. The remaining open item is live confirmation that GKE Autopilot honors the deny-all egress NetworkPolicy (flagged gap, not a design fork).
- **MCP scaffold depth.** Resolved in Phase 5: registry/client machinery and Vault-backed credential path are real; OAuth refresh/rotation/revocation stays stubbed; zero live connectors.
- **Account-level metering %.** Deferred to the ledger. Phase 1 events are ledger-ready; Phase 6 ships per-thread % only.

## Progress Tracker

| Phase | Status |
|---|---|
| 1. Foundations - Model Routing & Tagged Usage Events | Done - completed 2026-07-03 |
| 2. Unified Tool Registry & `tool_search` | Done - completed 2026-07-03 |
| 3. Virtual CSO In-Thread Tool Loop | Done - completed 2026-07-03 |
| 4. Sandbox Bridge (Code Mode, exec-channel) | Done - completed 2026-07-03 |
| 5. MCP Client Scaffold | Done - completed 2026-07-03 |
| 6. Degradation Signal & Compaction | Done - completed 2026-07-03 |
| 7. Interleaved History Rendering | Done - completed 2026-07-03 |

## Session Continuity Note

This build was scoped across a Discuss-and-Plan session on 2026-07-02. The conversation resolved the model-routing correction: primary conversation/orchestration remains Claude-locked; per-capability and utility routing uses the existing model-settings registry. It also resolved degradation vs. metering as two systems over one tagged event stream. Account-level % remains deferred to the metering ledger.

Canonical docs remain `INTELLIGENCE-LAYER-ARCHITECTURE.md` and `INTELLIGENCE-LAYER-EPISODE-MAP.md` where present; in this checkout the local canonical architecture reference is `.planning/INTELLIGENCE-VISION.md`. The Advanced Tool Calling build is complete as of 2026-07-03. Future work should treat full citation UI, account-level metering/ledger/quotas, and live MCP connectors as separate deferred passes, not Phase 7 spillover.
