# Phase 5 Context — MCP Client Scaffold

**Phase:** 05 of the Advanced Tool Calling build.
**Read first:** the build-level `CONTEXT.md` and `ROADMAP.md`; this phase's `05-RESEARCH.md`; the Phase 1–4 `COMPLETION.md` files (live substrate inherited); canonical `INTELLIGENCE-LAYER-EPISODE-MAP.md` §3.1 (capability layer + MCP + credentials) and §5 L7. Canonical docs win over the reference PRD.

---

## Why this phase, and the hard boundary

MCP is how the founder's real business tools (QuickBooks/GHL/Notion/CRM) eventually plug into the intelligence layer as registry citizens — "plugins with teeth." But **L7 is locked: at beta this is backend scaffold only, surfaced "coming soon," with zero public external connectors shipped or connectable.** The job is to **build the shape and stub the lifecycle**, so live connectors later are an additive flip — not a re-architecture — without turning OAuth lifecycle work into a beta blocker.

## What this phase is

- **MCP as a first-class registry source type (MCP-01):** an `MCPClientManager` + discovery machinery + a `register_mcp_tools()` path that registers discovered MCP tools into the *existing* registry as deferred `source="mcp"` citizens (same catalog, `tool_search`, scoping, and — for read/compute tools — bridge-callability). Shipped with **zero servers configured**.
- **A per-user credential model (MCP-02):** a `mcp_connections` metadata table (no secrets) + **Supabase Vault** for the actual keys/tokens, per-user RLS, service-role-only decryption, secrets never in the browser.
- **OAuth lifecycle stubbed (MCP-03):** fields exist; refresh/rotation/revocation is a documented stub, not implemented.
- **A "coming soon" surface (MCP-04):** a read-only connectors section in the existing Skills & Plugins workspace; no connect action.

## What this phase is NOT

- **Not a live connector.** No GHL/Notion/QuickBooks/CRM connected or connectable. Ship with zero configured servers.
- **Not an OAuth implementation.** Refresh/rotation/revocation is stubbed. No token-refresh scheduler.
- **Not a registry redesign.** MCP is registered through the existing registry (the `mcp` discriminator already exists); no second discovery path or parallel catalog.
- **Not a new secrets system.** Vault is available and is the store; no app-level crypto, no external secrets manager.
- **Not a resolution of D1.** MCP tool scoping uses the Phase 2 swappable resolver; keep it swappable.

## Decisions that shape this phase (do not override)

1. **Scaffold-only, zero live connectors (L7).** Build the machinery; configure no servers; surface "coming soon."
2. **Secrets live in Vault, service-role only.** No secret in `mcp_connections`, no secret in any public API response, no secret in the browser. Decryption via `vault.decrypted_secrets` on the service-role side only.
3. **`mcp_connections` is per-user, RLS owner-only.** Metadata + a `vault_secret_id` reference only. Multi-user-shaped (even though beta is single founder), consistent with the future admin panel.
4. **OAuth lifecycle is stubbed.** Do not build refresh/rotation/revocation. This restraint is the reason MCP is scaffold-only — honor it.
5. **MCP tools are registry citizens.** Registered as deferred `source="mcp"` entries; discoverable via `tool_search`; scoped via the swappable resolver; read/compute MCP tools are automatically bridge-callable (Phase 4) — no extra wiring. (Write-capable MCP tools get one-writer/authorization treatment later; out of scope at beta.)
6. **Inherit Phases 1–4.** The host-side-secrets credential principle mirrors the Phase 4 bridge; any (unexpected) MCP model calls use model routing + tagged usage. Don't rebuild.
7. **Don't balloon.** If a task starts to require a live connector, an OAuth refresh loop, or per-connector data-model work (live-vs-ingested), stop — that is v2 (`MCP-LIVE-01`), not this phase.

## Success criteria (from ROADMAP.md Phase 5)

1. MCP is a first-class registry source type (same catalog, `tool_search`, bridge-callability as native/skill tools) — exercised in tests against a fake/local server, with zero servers configured in production.
2. A per-user credential store exists — Supabase Vault-backed, per-user RLS, service-role-only access; secrets never reach the browser.
3. OAuth lifecycle (refresh/rotation/revocation) is stubbed, not implemented, and documented as intentional.
4. MCP surfaces as "coming soon"; zero public external connectors are shipped or connectable at beta.

## Open items to resolve at this phase's build-planning (flag, don't silently pick)

- **Add the `mcp` SDK now vs. stub the client.** Lean: add `mcp`, build real discovery machinery tested against a fake server, ship zero servers configured; confirm no Railway build impact.
- **Credential model depth** — full Vault write/read path now (lean; Vault is available and it's small) vs. table-only with Vault deferred.
- **"Coming soon" surface depth** — minimal read-only connectors section in Skills & Plugins (lean) vs. backend-only readiness flag.
- **Candidate connector list** — which integrations to show as "coming soon" (QuickBooks/GHL/Notion/CRM). Product call; lean: a short config-driven list.
