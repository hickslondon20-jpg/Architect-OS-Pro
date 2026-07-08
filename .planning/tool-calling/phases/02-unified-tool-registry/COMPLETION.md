# Phase 2 Completion - Unified Tool Registry & `tool_search`

**Completed:** 2026-07-03
**Scope:** 02-01 registry core/sources/adapters/`tool_search` + 02-02 D1-neutral scoping, citation envelopes, and behavior-preserving service fold-in.

## What Changed

- Added `python-backend/services/tool_registry.py`.
- Defined `ToolDefinition`, `ToolExecutionContext`, `ToolResultEnvelope`, and `ToolSourceRef`.
- Stored tools in a neutral JSON Schema core with `source` discriminator (`native` / `skill` / `mcp`) and executor kind (`native` callable, `skill` load-by-body, `mcp` placeholder).
- Added thin `to_anthropic()` and `to_openai()` adapters. Anthropic remains the hot path.
- Registered the existing KB Explorer tools (`kb_ls`, `kb_tree`, `kb_grep`, `kb_glob`, `kb_read`, `wiki_search`, `wiki_get_page`, `wiki_list`) and sandbox tools (`execute_code`, `read_skill_file`) as native registry entries.
- Added deferred `skill_packs` registration with existing global-or-owner visibility and load-by-body execution. No parallel skills catalog/table was created.
- Added a pure retrieval `tool_search` meta-tool and compact catalog support. It performs no model call and emits no usage event.
- Added D1-neutral scoping via injectable `ToolScopeSource` implementations:
  - `AgentCapabilityScopeSource` reads `agent_capabilities.allowed_tools` / `allowed_surfaces` and is the conservative default when a store is available.
  - `RegistryNativeScopeSource` reads registry-native `surface_tags` / `capability_hints`.
  - Swapping sources is a constructor-line change; D1 remains open.
- Rewired `kb_explorer_service.py` and `sandbox_execution_service.py` to source their Anthropic schemas and dispatch through the registry while preserving the content sent back to Claude.
- Added citation-ready result envelopes:
  - `kb_read` includes `raw_document` source id, label, line metadata, and verbatim content.
  - `wiki_search`, `wiki_get_page`, and `wiki_list` include `wiki_page` source ids/keys, labels, excerpts or verbatim content where available.
  - `execute_code` includes `computation` provenance with code/stdout/stderr metadata.
  - `read_skill_file` includes `skill_file` provenance.
- Added migration `docs/migrations/015_tool_registry_kb_explorer_allowed_tools.sql` and live-applied migration `tool_registry_kb_explorer_allowed_tools` to align `kb_explorer_agent.allowed_tools` with the eight-tool behavior already present in code.
- Updated `agent_capabilities.py` fallback so offline/default authorization also includes the KB Explorer wiki tools.
- Adjusted backend test setup so pure unit tests do not require live Supabase acceptance-user setup.
- Added `python-backend/tests/test_tool_registry_phase2.py`.

## Verification

- Live Supabase pre-check confirmed `kb_explorer_agent.allowed_tools` still contained only the five raw-KB tools.
- Live migration applied to project `pwacpjqkntnovndhspxt` as `tool_registry_kb_explorer_allowed_tools`.
- Live Supabase post-check confirmed `kb_explorer_agent.allowed_tools` now contains all eight current KB Explorer tools.
- Live migration history includes `tool_registry_kb_explorer_allowed_tools`.
- `python -m pytest python-backend\tests\test_tool_registry_phase2.py` passed: 5 passed.
- Changed-module syntax check passed:
  - `tool_registry.py`
  - `kb_explorer_service.py`
  - `sandbox_execution_service.py`
  - `agent_capabilities.py`
  - `tests/conftest.py`
  - `tests/test_tool_registry_phase2.py`
- `python -m compileall python-backend` passed. The known unreadable `.pytest_cache` warning appeared and was non-fatal.

## Acceptance Criteria Mapping

- **REG-01:** Met. Registry definitions use neutral JSON Schema, `source`, and executor abstraction.
- **REG-02:** Met. `skill_packs` register as deferred load-by-body entries with global-or-owner visibility; no new skills table.
- **REG-03:** Met. `tool_search` is pure retrieval over scoped catalog entries and returns definitions via adapters.
- **REG-04:** Met. `get_tools(surface=..., capability=...)` scopes through an injected resolver and never requires a flat global list.
- **REG-05:** Met. Registry executors return citation-ready envelopes with `sources`; model-facing content remains behavior-preserving in current sub-agent loops.
- **REG-06:** Met. Tests prove both `agent_capabilities`-backed and registry-native scoping sources work; code docstring documents the D1 seam.

## Explicit Non-Scope Preserved

- No Phase 3 Virtual CSO in-thread tool loop was built.
- No changes were made to `api/vcso/chat.ts` generation flow for Phase 2.
- No sandbox HTTP bridge was built.
- No MCP discovery, credentials, or live connector lifecycle was built; only the `mcp` source type placeholder exists.
- No citation UI was built.
- No new tool catalog table was created.
- No new LLM-powered work was added; `tool_search` makes no model call and emits no usage event.

## Remaining Gaps / Next Phase Notes

- Phase 3 must explicitly authorize whichever Virtual CSO tool-loop capability should receive `tool_search`; Phase 2 preserves existing sub-agent behavior and does not add `tool_search` to the current KB Explorer/sandbox tool lists.
- Full live KB Explorer / sandbox model-turn smoke still depends on the existing local runtime credentials and Anthropic/GKE availability. The registry fold-in was verified by schema equality, focused unit tests, live authorization alignment, and Python compile gates.
