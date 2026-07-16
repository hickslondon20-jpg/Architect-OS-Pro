# 04B Phase C Completion — Registry to SDK-Config Compiler

**Completed:** 2026-07-15  
**Decision:** **PASS — registry compiler, persistence guardrail, tier resolution, and connector gating verified.**  
**Checkpoint:** Phase C complete; stop for London. Phase C2 and Phase D have not started.  
**Production state:** `vcso_sdk_loop` disabled, `enabled_for_all=false`, zero enrolled founders; zero connected MCP rows.

## Shipped behind the existing flag

- Commits `dac50021` (`v0.6.33`), `3f9d5ac0` (`v0.6.34`), and `8287df57`
  (`v0.6.35`) extend the existing tool/capability registries rather than creating a parallel
  authority. `102e63db` (`v0.6.36`) records the applied additive migration.
- `ToolDefinition.persistence_semantics` and `tool_registry.persistence_semantics` use the frozen
  four-value contract: `read_only`, `persist_artifact`, `write_external`, `privileged`.
- The SDK-only execution guardrail auto-allows reads; every artifact/write/privileged tool requires
  an exact tool-name confirmation. A read from an external MCP source quarantines the shared turn;
  a later write also requires a separate exact quarantine release. Money-moving tools are always
  blocked, including outside the SDK flag seam.
- The compiler emits one founder's `ClaudeAgentOptions`: top-level `allowed_tools`, programmatic
  bounded `agents`, and curated in-process `mcp_servers`. It intersects capability grants with
  enabled/code-registered tools and excludes every unavailable grant rather than widening access.
- MCP config requires all three authorities: the code-owned pilot catalog, the active
  `feature_registry` beta-week gate, and a `connected` `mcp_connections` row owned by that founder.
  Zero live connections therefore compile to zero third-party MCP servers today.
- Third-party MCP tools are proxied through registry-owned SDK servers. Vendor descriptions never
  enter SDK options; ArchitectOS ACI copy, schemas, persistence semantics, and the runtime guardrail
  remain authoritative.
- Capability model resolution reuses `AgentCapability.effective_model_setting_key`: an explicit
  `routing_tier` resolves through `tier_<tier>`; a null tier preserves the existing capability
  setting. A Claude-only guard falls back to the main Claude model for any non-Anthropic result.
  No second selector and no founder-facing model control were added.

## Live schema and registry proof

Migration `orchestration_harness_sdk_registry_compiler` applied successfully to Supabase project
`pwacpjqkntnovndhspxt`.

| Check | Before | After |
|---|---:|---:|
| `tool_registry` rows | 21 | 21 |
| `persistence_semantics` | absent | non-null + checked |
| Semantics distribution | — | 14 read-only / 4 persist-artifact / 3 privileged |
| QuickBooks feature row | 0 | 1 (`beta_unlock_week=12`, active) |
| Connected MCP rows | 0 | 0 |
| `ai_usage_log` rows | 285 | 285 |
| `ai_usage_log` columns | 15 | 15 |

`tool_registry` and `feature_registry` retain RLS. No table, policy, function, view, index, model
selector, usage column, or connector table was added. The Supabase advisor pass surfaced only the
project's pre-existing broad advisory backlog; this additive column/row migration introduced no new
advisor class on the touched tables.

The live capability/model reconciliation confirms capability-grain authority. The one currently
tiered live capability, `document_analysis_agent`, resolves `tier_worker` to Anthropic Haiku. Other
active capabilities preserve their existing Anthropic capability settings (Sonnet) until their own
`routing_tier` is deliberately set; Phase C does not mutate those rows because that would change the
flag-off hand-rolled worker path.

## Forced guardrail and founder-scope proof

The focused compiler/guardrail proof passed three explicit tests:

1. A week-12 founder with a connected QuickBooks row receives the curated connector server/tool; a
   week-1 founder and a different week-12 founder do not. Capability grants remain exact, including
   the sandbox capability receiving only its registered grant intersection.
2. A forced external write fails without exact confirmation. After an MCP read, confirmation alone
   still fails under quarantine; only a separate exact release permits the test write. A marked
   payment tool remains blocked even after both grants.
3. A raw vendor payment description is discarded, replaced with ArchitectOS ACI copy, classified
   `privileged`, and marked as money-moving.

The flag-off control is explicit in the same proof: a legacy non-money test write retains its prior
behavior when `enforce_persistence_guardrail` is absent. Production only adds that marker inside the
founder-gated SDK loop.

## Verification

- Focused compiler/guardrail proof: `3 passed`.
- Complete SDK unit set: `7 passed`.
- Broader VCSO regression set: `48 passed, 12 skipped`.
- Backend `compileall`: clean.
- `git diff --check`: clean for Phase C files.
- Frontend `src/` was not changed; no frontend build was required.
- Production migration read-back: pass.
- Production API health: 200 / `ok=true`.
- Production boot-sync read-back: pass — the deployed process reconciled the 21 native definitions
  after commit `102e63db`.
- Flag read-back after deploy: disabled, global/default off, zero enrollment.

## Observability and metering

Phase C does not execute a model call or a live connector, so it creates no synthetic LangSmith or
usage proof turn. The SDK path continues to emit turn/tool lifecycle traces through the Phase B hooks
and one exact `ai_usage_log` row per SDK turn. Phase C adds only sanitized compiler counts to hook
metadata. `ai_usage_log` remained structurally and numerically unchanged by the migration.

## Acceptance read-back

1. **Registry extension:** pass — one additive column, existing code-sync authority retained.
2. **Persistence guardrail:** pass — reads auto-approve; writes/privileged require confirmation and
   quarantine release; money movement is always blocked.
3. **Per-founder compiler:** pass — founder connection + beta gate + registry state determine MCP;
   no cross-founder connector leak.
4. **Per-agent grants and models:** pass — grants are intersections, recursion remains disabled,
   and tier/capability model resolution remains Claude-only at capability grain.
5. **ACI descriptions:** pass — raw vendor prose is not exposed to the SDK.
6. **Metering/observability:** pass — hook path retained; `ai_usage_log` untouched.
7. **Strangler posture:** pass — flag remains dark and unenrolled; hand-rolled production VCSO is
   unchanged while the compiler is available only behind the existing SDK path.
8. **Scope:** pass — no `src/`, C2, D, dedicated connector table, flag flip, or harness-root roadmap edit.

## Stop condition

Phase C is complete. Stop at this gate and return to London. Do not begin Phase C2 or Phase D without
new direction.
