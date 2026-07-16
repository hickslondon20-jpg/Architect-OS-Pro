# Phase F Plan — First Live MCP (QuickBooks)

> Read `../../CONTEXT.md` + `../../ROADMAP.md` and this folder's `CONTEXT.md` + `ROADMAP.md` first.
> Covers **SDK-F1..F6**. Delivers the harness **Phase 5** live-source objective on the SDK path. **One
> pilot connector only** (QuickBooks). Read-only, ephemeral, cited, founder-scoped.

## Deliverable
The first live MCP connector end-to-end: per-user OAuth via `mcp_connections` + Vault, the SDK
`mcp_servers` config compiled from the registry (Phase C), and a **read-only, ephemeral, cited**
QuickBooks P&L pull through a bounded worker — chosen by the freshness/authority policy — with the
data-lifecycle principle enforced (no raw persistence; snapshots only on deliberate ingestion) and
write/privileged actions blocked at the runtime.

## Steps

### A. Connector auth + config (SDK-F1/F2)
1. Register the QuickBooks connector (availability via the Phase C catalog). Per-user OAuth stored as a
   **`vault_secret_id` reference** in `mcp_connections` — never the token in the row.
2. Compile the connector into the founder's SDK `mcp_servers` from the registry (Phase C compiler),
   filtered to founders with an active connection.

### B. Read-only cited pull through a bounded worker (SDK-F3/F4)
1. A bounded worker pulls the live P&L via the MCP tool and returns a **compact, cited** finding
   (provenance: source + as-of timestamp). The **freshness/authority policy** decides live-vs-wiki.
2. Curate the QuickBooks MCP tool descriptions to the ACI standard (Phase C).

### C. Data lifecycle + guardrails (SDK-F5/F6)
1. Enforce **ephemeral**: the raw pull lives in the turn/sandbox scratch; **no** raw copy into Supabase.
   Persistence only via a deliberate `persist_artifact` action (snapshot-into-wiki is out of scope here;
   pinned in `CONTEXT.md`).
2. `persistence_semantics` = `read_only`; **write/privileged blocked at the runtime**. Never move money —
   any financial action is founder-executed.

## Acceptance criteria
1. Live QuickBooks P&L pull succeeds, **read-only**, founder-scoped, cited (source + as-of).
2. Secret stored as a vault reference; never in a row or trace.
3. Freshness policy chose the live source; the pull flowed through a bounded worker with a compact cited
   finding.
4. Raw data ephemeral (no Supabase copy); write/privileged blocked (forced-write proof).
5. Traces paired to `ai_usage_log`; founder isolation intact.
6. `compileall` clean; `ROADMAP.md`/`STATE.md` + `04B-F-COMPLETION.md` updated. Read-back to London.

## Out of scope
The MCP-snapshot-into-wiki ingestion path (pinned in `CONTEXT.md`, later); additional connectors
(Asana/Monday/GHL — post-pilot); generalization + cutover (G).
