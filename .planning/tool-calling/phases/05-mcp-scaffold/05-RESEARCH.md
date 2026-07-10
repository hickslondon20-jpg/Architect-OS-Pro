# Phase 5 Research — MCP Client Scaffold

**Verified:** 2026-07-03, against the live repo and Supabase project `pwacpjqkntnovndhspxt`.
**Locked (L7):** MCP is **backend scaffold for MVP/beta**, surfaced "coming soon," with **zero public external connectors** shipped or connectable at beta. Build the shape; stub the OAuth lifecycle. This phase does not connect GHL/Notion/QuickBooks/CRM.

---

## What exists today (the scaffold surface)

### The registry is already MCP-ready (Phase 2 left the seam)
`services/tool_registry.py`:
- `ToolSource = Literal["native", "skill", "mcp"]` and `ExecutorKind = Literal["native", "skill", "mcp"]` — the `mcp` discriminator is already defined.
- `ToolDefinition` carries everything an MCP tool needs: `name`, `description`, `json_schema`, `source`, `executor_kind`, `executor`, `loading` (`always`/`deferred`), `citation`, `surface_tags`, `capability_hints`, `keywords`.
- Registration pattern exists: `register(definition)`, `_register_native_tools()`, `register_skill_pack_tools(user_id)` (deferred, reads from `skill_packs`). Phase 5 adds a parallel `register_mcp_tools(...)` producing `source="mcp"`, `executor_kind="mcp"`, `loading="deferred"` entries.
- There is already an `mcp` branch in the executor/scope handling (a placeholder). Phase 5 fills the executor with real routing to the MCP client — but **gated on a configured, connected server, of which there are none at beta.**
- **Scope stays D1-neutral:** MCP tools are scoped like any registry tool — via `surface_tags`/`capability_hints` (RegistryNativeScopeSource) or capability `allowed_tools` (AgentCapabilityScopeSource). The resolver is swappable (Phase 2); don't fuse.

### Supabase Vault is available (credential model is feasible for real)
Live check: the **`vault` schema exists** on the project. So the credential model can use real Vault-backed encryption:
- Store secrets via `vault.create_secret(secret, name, description)`; read via the `vault.decrypted_secrets` view — **service-role only**.
- This satisfies MCP-02 (Supabase Vault-backed, per-user RLS, service-role-only, secrets never in the browser) without app-level crypto or an external secrets manager.

### Net-new pieces (do not exist yet)
- **No `mcp` Python SDK dependency** — `requirements.txt` has no `mcp` package. Adding it is cheap; decision on whether to add now (real discovery machinery) vs. stub the client entirely is a build-planning call (lean below).
- **No credential/connection table** — grep found no existing third-party credential or connection storage. `mcp_connections` (metadata) + Vault (secrets) is net-new.
- **No `MCP_SERVERS` config.** The reference uses a global `MCP_SERVERS` env var. For us, connections are **per-user rows** in `mcp_connections` (multi-user-shaped even though beta is single founder), not a global env var — consistent with the platform's per-user model and the future admin panel.

### Where the "coming soon" surface belongs
Ep4 shipped the **Skills & Plugins** workspace at `/pro/intelligence/skills` (the fourth intelligence peer). The MCP/connectors "coming soon" surface naturally lives there — a connectors section listing candidate integrations as "coming soon" with no connect action wired. Reuse that surface; do not build a new top-level area.

---

## Design shape for the scaffold

### Registry MCP source (MCP-01)
- `MCPClientManager` — on startup, reads configured servers (none at beta) and, for each, would spawn/connect (stdio or http via the `mcp` SDK), call `list_tools()`, and register each discovered tool into the registry as a deferred `source="mcp"` citizen (JSON Schema `inputSchema` → the registry's neutral `json_schema`, a near-1:1 map).
- The `mcp` executor routes a call through `mcp_client.call_tool(server, tool, args)`. **At beta this path is never exercised live** (zero servers); it is exercised only by tests against a fake/local MCP server.
- **Forward-compat (free):** because Phase 4 made read/compute registry tools bridge-callable, a future live MCP read tool registered here is bridge-callable from Code Mode automatically — no extra wiring. (Write-capable MCP tools would need the one-writer/authorization treatment; out of scope at beta.)

### Credential model (MCP-02, MCP-03)
- **`mcp_connections`** table (metadata only, no secrets): `id`, `user_id`, `server_name`, `transport`, `config` jsonb (non-secret), `auth_type` (`api_key`/`oauth2`), `vault_secret_id` (reference into Vault), `status` (`coming_soon`/`disabled`/`connected`), timestamps. **Per-user RLS, owner-only; service-role for backend.** No secret material in this table.
- **Vault** holds the actual API key / OAuth tokens; decrypted only via the service-role-side `vault.decrypted_secrets` view when the backend makes a call. Never exposed via the public API, even encrypted.
- **OAuth lifecycle stubbed (MCP-03):** the fields/columns for refresh token + expiry exist, but the refresh/rotation/revocation loop is a documented stub, not implemented — this is *why* MCP is scaffold-only (OAuth lifecycle is real work and a beta blocker if fully built now).

### "Coming soon" surface (MCP-04)
- A connectors section in the existing Skills & Plugins workspace, listing candidate connectors as "coming soon," **no connect action** wired. Backend exposes the candidate list + status; frontend renders read-only.

---

## Landmines / things to get right

- **Zero live connectors at beta.** No GHL/Notion/QuickBooks/CRM connected or connectable. Ship the machinery with zero configured servers.
- **Don't let OAuth lifecycle balloon.** Stub refresh/rotation/revocation; do not build a token-refresh scheduler. That restraint is the whole reason MCP is scaffold-only.
- **Secrets never leave the service-role boundary.** No secret in `mcp_connections`, no secret in any public API response, no secret in the browser. Vault decryption is service-role only.
- **MCP tools are registry citizens, not a parallel system** — same catalog, `tool_search`, scoping, and (for read/compute tools) bridge-callability. Register them through the existing registry, don't build a second discovery path.
- **Add the `mcp` dependency deliberately.** If added, pin it and confirm it doesn't destabilize the Railway build (Phase 5 has no live server to need it at runtime — it's for the discovery machinery + tests).
- **D1 stays open.** MCP tool scoping uses the swappable resolver; don't hardcode.
- **Inherit Phases 1–4.** Any MCP model calls (none expected in the scaffold) would use the model-settings routing + tagged usage; the credential principle mirrors the Phase 4 bridge (host-side secrets, agent sees only results).

## Open items to resolve at this phase's build-planning (flag, don't silently pick)

1. **Add the `mcp` SDK now vs. stub the client interface.** Lean: **add `mcp`** and build real discovery machinery tested against a fake/local server (so the shape is real, not faked) — but ship with zero servers configured. Confirm no Railway build impact.
2. **Scaffold depth of the credential model** — full `mcp_connections` + Vault wiring now (lean, since Vault is available) vs. table-only with Vault wiring deferred. Lean: build the Vault write/read path for real (it's small), keep OAuth lifecycle stubbed.
3. **"Coming soon" surface depth** — a real connectors list in Skills & Plugins (lean) vs. a backend-only readiness flag. Lean: a minimal read-only connectors section reusing the existing workspace.
4. **Candidate connector list** — which integrations to show as "coming soon" (QuickBooks/GHL/Notion/CRM). Product/marketing call; lean: a short config-driven list, easy to edit.

## Verification method (for the record)

- Read: `services/tool_registry.py` (mcp discriminator, registration/scope patterns, ToolDefinition), `requirements.txt` (no `mcp` dep).
- Live Supabase: confirmed the `vault` schema exists (Vault available); grep confirmed no existing credential/MCP tables or code.
