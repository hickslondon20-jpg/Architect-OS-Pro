# Phase 5 Completion - MCP Client Scaffold

**Completed:** 2026-07-03
**Scope:** 05-01 MCP registry source/client scaffold + 05-02 Vault-backed credential model and read-only connectors surface.

## What Changed

- Added `python-backend/services/mcp_client.py`.
  - `MCPClientManager` discovers configured `mcp_connections` rows with `status='connected'`.
  - Converts MCP `list_tools()` payloads into registry-ready `DiscoveredMCPTool` objects.
  - Calls tools through an injectable adapter, with lazy SDK loading so zero-server beta startup is unchanged.
  - Keeps OAuth refresh/rotation/revocation explicitly stubbed via `oauth_refresh_not_implemented()`.
- Pinned `mcp==1.13.1` in `python-backend/requirements.txt`.
  - The SDK is lazy-imported only for real transport handling. Local tests use the fake adapter because this checkout has no installed MCP package and no live connector server.
- Updated `python-backend/services/tool_registry.py`.
  - Added `ToolDefinition.mcp_metadata`.
  - Added `register_mcp_tools(manager, user_id=...)`.
  - Filled the `executor_kind='mcp'` branch so MCP calls route through the manager and return citation-ready envelopes with `source_kind='mcp'`, server/tool identity, and verbatim text when present.
  - D1 remains open: MCP tools use the same `ToolRegistry` and scoping sources as native/skill tools.
- Added `python-backend/services/mcp_credentials.py`.
  - `MCPCredentialStore` stores secrets through Supabase Vault and reads via `vault.decrypted_secrets`.
  - No app-level crypto and no external secrets manager.
- Added `docs/migrations/017_mcp_connections.sql`.
  - `public.mcp_connections` stores metadata only: user, server, transport, non-secret config, auth type, Vault reference, status, OAuth expiry metadata, and timestamps.
  - RLS enabled; authenticated users can only select their own rows; authenticated insert/update/delete and anon select are not granted.
  - A check constraint blocks common secret keys in `config`.
- Added a config-driven connector catalog in `python-backend/services/mcp_connectors.py`.
  - Candidates: QuickBooks, GoHighLevel, Notion.
  - All return `status='coming_soon'`.
- Added `GET /api/skills/connectors` in the existing Skills router.
  - Authenticated read-only metadata endpoint.
  - No connection management, credential entry, or connect action.
- Updated the Skills & Plugins workspace.
  - `lib/skillsApi.ts` loads connector candidates.
  - `pages/ProSuite/SkillsWorkspace.tsx` renders an asymmetric, read-only Connectors section with no connect buttons and no credential UI.
- Added `python-backend/tests/test_mcp_scaffold_phase5.py`.

## Live Supabase Verification

- Applied migration `mcp_connections_scaffold` to project `pwacpjqkntnovndhspxt`.
- Migration history includes `mcp_connections_scaffold`.
- Verified `public.mcp_connections`:
  - RLS enabled: `true`.
  - `authenticated` can `SELECT`: `true`.
  - `authenticated` can `INSERT`: `false`.
  - `authenticated` can `UPDATE`: `false`.
  - `authenticated` can `DELETE`: `false`.
  - `anon` can `SELECT`: `false`.
- Rollback/cleanup-only metadata smoke:
  - Inserted a safe disabled temp row.
  - Verified secret-like `config.api_key` is rejected by the check constraint.
  - Deleted the temp row; remaining `phase5_temp_%` rows: `0`.
- Supabase Vault smoke:
  - Created temporary secret `phase5_temp_mcp_secret_2`.
  - Read it through `vault.decrypted_secrets`; decrypted value matched.
  - Deleted the temp `vault.secrets` row; remaining temp secret rows: `0`.
- Production beta state confirmed:
  - `public.mcp_connections where status='connected'` count is `0`.
  - Therefore the production MCP discovery path registers zero live tools.

## Verification

- `python -m pytest python-backend\tests\test_mcp_scaffold_phase5.py` passed: 5 passed.
- Regression subset passed: 15 passed.
  - `test_mcp_scaffold_phase5.py`
  - `test_tool_registry_phase2.py`
  - `test_sandbox_execution_service_phase4.py`
  - `test_vcso_chat_service_phase3.py`
  - `test_skills_phase4.py`
- Full combined regression attempt including `test_sandbox_bridge_phase4.py`:
  - First run: 20 passed, 5 setup errors because pytest could not access `C:\Users\Hicks\AppData\Local\Temp\pytest-of-Hicks`.
  - Second run with workspace temp root: 20 passed, 5 Phase 4 harness failures from `run_with_bridge` timeouts under the workspace path with a space in `ArchitectOS Pro_beta`.
  - This is a local harness/temp-path issue in the pre-existing Phase 4 standalone filesystem harness; Phase 5 tests and service-level Phase 4 regression passed.
- `python -m compileall python-backend` passed. The known unreadable `.pytest_cache` listing warning appeared and was non-fatal.
- `npm.cmd run build` passed. Vite emitted the existing large chunk warning.

## Acceptance Criteria Mapping

- **MCP-01:** Met. MCP tools register through the existing registry via `register_mcp_tools()` as deferred `source='mcp'` citizens; fake-server test proves discovery, registry registration, `tool_search`, scoping, execution, and citation envelope output.
- **MCP-02:** Met. `mcp_connections` exists live with owner-read RLS and no secret columns; Vault create/decrypt/delete smoke passed service-side.
- **MCP-03:** Met. OAuth lifecycle fields exist (`auth_type`, `oauth_expires_at`, Vault reference) and refresh/rotation/revocation remain intentionally stubbed. No scheduler was built.
- **MCP-04:** Met. Skills & Plugins now has a read-only "coming soon" connectors section with QuickBooks, GoHighLevel, and Notion. There is no connect button and no credential UI.
- **Zero live connectors:** Met. Live `connected_count` is 0; production discovery registers no MCP tools.
- **Bridge inheritance:** Met by construction. Future read/compute MCP tools are registry citizens and therefore inherit the Phase 4 bridge path. No write-capable MCP bridge exposure was added.
- **D1:** Preserved. MCP scoping goes through the same swappable registry scope sources; no registry/capability reconciliation decision was made.

## Explicit Non-Scope Preserved

- No live MCP connector was configured.
- No GoHighLevel, Notion, QuickBooks, or other external system is connectable.
- No OAuth refresh, rotation, revocation, callback, or token scheduler was implemented.
- No per-connector live-vs-ingested data model was introduced.
- No Phase 6 degradation/compaction work was started.
- No Phase 7 interleaved-history rendering work was started.

## Remaining Gaps / Next Phase Notes

- Railway/build-install impact of `mcp==1.13.1` was not verified in a deployed Railway build from this checkout. The local code path is protected by lazy imports and fake-adapter tests; if Railway rejects the pin, the manager already has a thin adapter seam to fall back to a stubbed client.
- Phase 4 live GKE/NetworkPolicy verification remains as previously documented and was not expanded by Phase 5.
