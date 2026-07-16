# Phase C Plan — Registry → SDK-Config Compiler + Extensions

> Read `../../CONTEXT.md` + `../../ROADMAP.md` and this folder's `CONTEXT.md` + `ROADMAP.md` first.
> Covers **SDK-C1..C6**. **Extend, not build** — the registry is ~80% present. **Verify the live
> `tool_registry` / `mcp_connections` / `agent_capabilities` / `ai_models` schema before changing.**

## Deliverable
The registry compiled into per-founder SDK config: `persistence_semantics` as a first-class,
guardrail-enforcing attribute; the connector-catalog fork (Q2) resolved; the tier→model resolver
confirmed/formalized; and a compiler that emits `ClaudeAgentOptions` (`allowed_tools`, `agents`,
`mcp_servers`) from `agent_capabilities` × `tool_registry` × active `mcp_connections`, with third-party
MCP descriptions curated to the ACI standard. `ai_usage_log` stays a separate metering ledger.

## Steps

### A. persistence_semantics + guardrail (SDK-C1)
1. Add `persistence_semantics` (`read_only`/`persist_artifact`/`write_external`/`privileged`) to the
   `tool_registry` table and `ToolDefinition` (backfill from code `mcp_metadata.read_only`).
2. Enforce: `read_only` auto-approves; `write_external`/`privileged` require confirmation + the
   quarantine pattern (a tool that read untrusted external content cannot hold a write privilege in the
   same step). Never move money — financial writes are always founder-executed.

### B. Connector catalog decision (SDK-C2, resolves Q2)
1. Implement connector availability/gating. **Lean:** reuse `feature_registry` (`beta_unlock_week`) for
   "which connectors exist + which beta week unlocks each," keeping `mcp_connections` as the per-user
   instance. If London chooses a dedicated `connectors` table instead, implement that. Record the choice.

### C. Tier→model resolver (SDK-C3)
1. Confirm/formalize how `routing_tier` (on `tool_registry` + `agent_capabilities`) resolves to an
   `ai_models` row. Tier authority stays at the **capability grain** (MA-06) — no second selector.

### D. The SDK-config compiler (SDK-C4/C5/C6)
1. At session start for founder X: `agent_capabilities` grants → join `tool_registry` → **filter MCP
   tools to those with an active `mcp_connections` row for X** → resolve models via the tier map → emit
   `ClaudeAgentOptions` (`allowed_tools`, `agents`, `mcp_servers`).
2. Curate/normalize any third-party MCP tool descriptions to the ACI standard **in the registry** —
   never expose raw vendor descriptions to the planner.
3. Verify **per-agent tool scoping** holds (the main loop sees its handful; a P&L subagent gets only its
   set) via the existing scope sources.

## Acceptance criteria
1. `persistence_semantics` present + backfilled; read-only auto-approves, write/privileged gated
   (forced-write proof requires confirmation; quarantine holds).
2. Connector-catalog choice implemented + recorded; availability gates by beta week.
3. Tier→model resolution formalized; no second model-selection authority introduced.
4. Compiler emits correct per-founder `ClaudeAgentOptions`; MCP tools filtered to active connections;
   per-agent scoping verified; third-party descriptions curated.
5. `ai_usage_log` untouched (separate ledger).
6. `compileall` clean; migration applied on `pwacpjqkntnovndhspxt`; `ROADMAP.md`/`STATE.md` +
   `04B-C-COMPLETION.md` updated. Read-back to London.

## Out of scope
The subagent runtime (D); sessions (E); standing up a live connector's OAuth/data pull (F — this phase
builds the *catalog + compiler*, not the QuickBooks pull); metering.
