# Execution Agent Brief — Phase 5: MCP Client Scaffold

You are the Execution Agent for **Phase 5** of the Advanced Tool Calling build in ArchitectOS Pro. You implement this phase's code. You do not re-plan it and you do not start other phases.

## Read these before writing any code (in order)

1. `.planning/tool-calling/CONTEXT.md` — the build's rationale and the 11 decisions you must not override.
2. `.planning/tool-calling/ROADMAP.md` — Phase 5 goal, dependencies, success criteria.
3. `phases/01-.../COMPLETION.md` … `phases/04-.../COMPLETION.md` — the live substrate you **inherit**: routing + tagged usage; the registry + `tool_search` + swappable scope + citation envelopes (Phase 2); the VCSO loop (Phase 3); the exec-channel bridge that makes read/compute registry tools callable from Code Mode (Phase 4). Do not rebuild these.
4. `phases/05-mcp-scaffold/05-RESEARCH.md` — the live-verified state (registry mcp-readiness, Vault availability, net-new pieces). **Trust it, but re-verify anything you're about to change.**
5. This phase's `CONTEXT.md`, then `05-01-PLAN.md` (registry source + client) and `05-02-PLAN.md` (credential model + surface).
6. Canonical: `INTELLIGENCE-LAYER-EPISODE-MAP.md` §3.1 (MCP + credentials) and §5 L7. Wins over the reference PRD.

## What you are building

MCP as a **backend scaffold** — the shape of "plugins with teeth," with the lifecycle stubbed and **zero live connectors**:

- **05-01** — `MCPClientManager` + discovery machinery + a `register_mcp_tools()` path that registers discovered MCP tools into the *existing* registry as deferred `source="mcp"` citizens; the `mcp` executor filled in; tested against a fake server; shipped with zero servers configured.
- **05-02** — a per-user, Vault-backed credential model (`mcp_connections` metadata + Supabase Vault secrets, RLS owner-only + service-role), OAuth lifecycle **stubbed**, and a read-only "coming soon" connectors section in the existing Skills & Plugins workspace.

## Hard constraints (do not violate)

- **Zero live connectors (L7).** No GHL/Notion/QuickBooks/CRM connected or connectable. Ship the machinery with **zero configured servers**; the no-MCP path must be identical to Phases 2–4.
- **Secrets in Vault, service-role only.** No secret in `mcp_connections`, no secret in any public/authenticated (non-service-role) API response, no secret in the browser. Decrypt via `vault.decrypted_secrets` service-side only.
- **OAuth lifecycle is stubbed.** Fields present; refresh/rotation/revocation not implemented; **no token-refresh scheduler.** Document it as intentional. This restraint is the reason MCP is scaffold-only — honor it.
- **Registry citizen, not a parallel system.** Register MCP tools through the existing registry (`mcp` discriminator exists); same catalog, `tool_search`, swappable scope, citation envelopes. No second discovery path, no parallel catalog. Read/compute MCP tools are bridge-callable for free (Phase 4); do NOT expose write-capable MCP tools to the bridge.
- **Reuse.** Vault is available — use it (no app-level crypto, no external secrets manager). The "coming soon" surface lives in the existing `/pro/intelligence/skills` workspace — no new top-level area.
- **D1 stays open.** MCP tool scoping uses the swappable resolver; don't hardcode.
- **Don't balloon.** If a task starts to need a live connector, an OAuth refresh loop, or per-connector live-vs-ingested data-model work, stop — that's v2 (`MCP-LIVE-01`), not this phase.

## Confirm with London at checkpoint (do not silently decide)

- **Add the `mcp` SDK now vs. stub the client interface.** Lean: add `mcp`, build real discovery tested against a fake server, ship zero servers configured — confirm no Railway build impact; fall back to a stubbed client if it destabilizes the build.
- **Credential model depth** — full Vault write/read path now (lean) vs. table-only with Vault deferred.
- **"Coming soon" surface depth** — minimal read-only connectors section (lean) vs. backend-only readiness flag.
- **Candidate connector list** — which integrations to show (QuickBooks/GHL/Notion/CRM). Product call; lean: a short config-driven list.

## Done when

1. All Phase 5 success criteria in `ROADMAP.md` are met and independently verified.
2. `MCPClientManager` discovers + converts + registers MCP tools as deferred `source="mcp"` registry citizens; the `mcp` executor routes through the manager and returns citation-enveloped results; a fake-server test proves discovery + call + `tool_search` + scoping.
3. Zero servers configured in production; the no-MCP path is byte-for-byte unchanged from Phase 4; read/compute MCP tools are bridge-callable with no extra wiring.
4. `mcp_connections` exists (per-user RLS owner-only + service-role, **no secrets in it**); secrets stored/decrypted via Vault service-role only; verified with rollback-only data that no secret is exposed to any non-service-role path.
5. OAuth lifecycle stubbed and documented; no refresh scheduler.
6. Read-only "coming soon" connectors section in Skills & Plugins with zero connect/credential UI; candidate list config-driven.
7. `python -m compileall python-backend` clean; `npm run build`/focused TS check clean; live migration + Vault round-trip verified or gaps flagged honestly.
8. `Pro-Suite-Progress.md`, `.planning/tool-calling/ROADMAP.md`, `.planning/tool-calling/STATE.md` updated and a `phases/05-mcp-scaffold/COMPLETION.md` evidence summary written.

## Explicitly out of scope for you

Live MCP connectors + full OAuth lifecycle + per-connector live-vs-ingested data model (v2 `MCP-LIVE-01`), the degradation % UI + compaction (Phase 6), interleaved-history rendering (Phase 7). Resolving D1 is out of scope — keep it open. Exposing write-capable MCP tools to the sandbox bridge is out of scope.
