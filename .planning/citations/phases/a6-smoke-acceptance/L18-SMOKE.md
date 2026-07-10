# Ep7A A6 L18 Credential-Debt Smoke

Date: 2026-07-06
Status: runnable local parts exercised; live-credential parts remain pending-live.

## Items Gathered

L18 rolls forward the outstanding Ep5/Ep6 live-credential checks:

- Sandbox execution / GKE credential smoke for `SandboxService.from_env()` and live `/api/sandbox/verify`.
- Tool-loop credential path for sandbox bridge / Code Mode, including host-side tool fulfillment without exposing service-role keys inside sandbox code.
- MCP scaffold credential path: Vault-backed MCP secrets, zero-public-secret storage, configured-server discovery, and read-only connector registration.
- Full live Anthropic/OS Engine/GKE smoke for Domain Agent / VCSO paths that require deployed credentials.

## Ran Locally

- MCP credential storage contract is covered by `python-backend/tests/test_mcp_scaffold_phase5.py`: secrets go through Supabase Vault helpers, decrypted reads use the `vault.decrypted_secrets` path, and no public metadata table stores credential material.
- MCP zero-server and fake-server paths are covered locally: zero configured servers registers nothing; fake read-only server discovery/call produces `source="mcp"` tool refs.
- A6 citation acceptance harness uses local fixtures and fake utility-model verdicts, so no shared Supabase, Anthropic, or GKE credential is required.

## Pending-Live

- Real GKE sandbox session creation and `/api/sandbox/verify` require `ARCHITECTOS_GKE_SERVICE_ACCOUNT_KEY`, GCP project/cluster access, and the deployed sandbox image.
- Live sandbox bridge / tool-loop credential smoke requires the same GKE runtime plus deployed host-side service credentials.
- Live MCP connector checks remain pending until at least one real `mcp_connections` row exists with a Vault secret and approved OAuth/API credentials.
- Live Anthropic and shared Supabase smoke for citation verifier persistence remains pending until the A6 Track 2 runbook is applied with London.

## Boundary Confirmation

No shared Supabase writes, migration applies, or live credential mutations were performed by this A6 execution pass.
