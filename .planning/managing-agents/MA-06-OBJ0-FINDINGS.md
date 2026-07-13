# MA-06 / Objective 0 — Research + Reconciliation Audit (Stage Gate)

> Findings + extend-vs-new recommendation. **Report before any schema/routing design.**
> Baseline v0.6.0. Live substrate audited on `pwacpjqkntnovndhspxt` (Architect OS) + `python-backend/services`.

---

## TL;DR

The model-routing substrate is **already ~70% built and mislabeled as "settings," not "routing."** Migration
`013_capability_model_routing_usage_events.sql` is literally the v0 of this pass. Per-capability model resolution,
tagged usage logging, and parent/child run linkage all exist and are wired. What is **missing** is the three things
MA-06 actually cares about: (1) a **tier** abstraction (worker/synthesis → concrete model), (2) **rule-based
escalation/fallback** with a recorded reason, and (3) **cost in dollars** (the column exists, is never populated).

**Recommendation: extend, do not parallel.** Keep `platform_ai_settings` + `ai_models` as the model authority and add
a tier layer to them; add **one** thin new governance/catalog table keyed by tool `name`/slug **only** for the
per-tool enable/tier-pointer/MCP-catalog/drift-sync surface that genuinely does not exist today. Do **not** create a
`tool_registry` table that re-implements model config — that would duplicate `platform_ai_settings`.

---

## What exists (wired)

| Piece | State | Evidence |
|---|---|---|
| Code registry seam | **Wired** | `tool_registry.py`: `ToolDefinition(+executor)`, `ToolScopeSource` protocol, `AgentCapabilityScopeSource` (default) vs `RegistryNativeScopeSource` (one-line fork), native/skill/MCP sources, `MCPClientManager`/`DiscoveredMCPTool`. |
| Per-capability model resolution | **Wired** | `store.resolve_platform_model(setting_key=…)` joins `platform_ai_settings → ai_models`. Called by `sub_agent_orchestrator` (per `capability.model_setting_key`), `vcso_chat_service._resolve_model()` (`vcso_chat`), KB Explorer, sandbox, compaction. |
| Model authority table | **Wired** | `platform_ai_settings` (PK `setting_key`, `model_id→ai_models`, `is_enabled`, JSONB `settings`) — this **is** a runtime-editable "how it runs" governance table already. 17 rows, one per LLM-calling surface. |
| Model catalog | **Wired** | `ai_models` has `provider, model_name, model_family, cost_tier (low/standard), context_window, is_active`. Rows exist for `claude-sonnet-4-6`, `claude-sonnet-4-5`, **`claude-3-5-haiku-latest` (cost_tier=low)**, gpt-4o-mini, embeddings, cohere. |
| Usage logging | **Wired** | `ai_usage_log` has `role (main/sub_agent/utility), provider, capability_key, run_id, cost_usd, task_id, model, tokens`. `log_ai_usage_event` called at 14 sites incl. VCSO main loop (`role="main"`, 359/629) and sub-agent (`role="sub_agent"`, 517). |
| Parent/child run linkage | **Wired** | `agent_delegation_runs.parent_run_id` = parent VCSO `run_id`; child sub-agent logs `ai_usage_log.run_id = delegation.id`. Independent attribution is **already queryable**: join `ai_usage_log.run_id → agent_delegation_runs.id` and read `parent_run_id`. |
| Provider guardrail | **Wired** | Both VCSO + orchestrator hard-guard `provider=="anthropic" and "claude" in model`, else fall back to `claude_synthesis_model`. Claude lock is enforced in code. |

## What is partial / missing

| Gap | State | Detail |
|---|---|---|
| **Tier abstraction** | **Missing** | Routing is per-`setting_key`, not per-tier. No worker/reasoning/synthesis concept. `ai_models.cost_tier` (low/standard) is descriptive metadata, not a routing key. Everything resolves to `claude-sonnet-4-6` today — **nothing routes to Haiku** except `citation_verifier`'s fallback string. |
| **Cost in dollars** | **Missing** | `ai_usage_log.cost_usd` populated in **0 of 100 rows**. No per-model price table. "Cost control" today = token counts only, no $ rollup. |
| **Rule-based escalation / fallback** | **Missing** | Zero matches for `escalat*`/`routing_tier`/`model_tier` anywhere in `services/`. No empty/invalid/schema-fail/timeout/round-limit → higher-tier logic. Only a static provider fallback exists. |
| **Per-run routing persistence** | **Partial** | `ai_usage_log.model` records the model per run (good), but there is **no tier or escalation-reason** recorded. Can't answer "why did this run use Sonnet." |
| **Per-tool governance + drift sync** | **Missing** | No table lists individual code-registry tools or MCP tools with an enabled flag / tier pointer. `agent_capabilities.allowed_tools` is an array (authorization), not a per-tool governance row. No boot/migration reconciliation that upserts code-defined tools and flags orphans. |
| **Bounded context for workers** | **Missing** | Narrow sub-agent tasks still assemble full founder context (the Obj-8 cost finding). No per-capability context-budget field consulted. |

---

## Extend vs. new — recommendation

**Hybrid: extend the two model tables, add exactly one thin catalog/governance table. Do not build a parallel `tool_registry`.**

The scope's "governance table for *how* a tool runs, editable at runtime, joined by slug" **already exists** as
`platform_ai_settings`. Re-creating it would be the exact "table-instead-of-code parallel" the scope warns against.
Concretely:

1. **Model routing / tier / budgets / escalation → EXTEND `platform_ai_settings` + `ai_models`.**
   - Add a **tier** layer: worker/reasoning/synthesis → concrete Claude model. Cleanest as a small `model_tiers`
     lookup (or a `routing_tier` column on `platform_ai_settings` + a `tier` tag on `ai_models`), so "make all
     workers Haiku" is one row edit. Haiku already exists in `ai_models` — routing to it is a data change, not a model add.
   - Add governance fields (context_budget, output_budget, timeout_s, round_limit, fallback_setting_key,
     escalation_policy) as typed columns or inside the existing `settings` JSONB.
   - Add **price** columns to `ai_models` (input/output $/Mtok) so `cost_usd` can finally be computed.

2. **Per-tool + MCP catalog + drift reconciliation → ONE new thin table** (name TBD, e.g. `tool_governance`),
   keyed by tool `name`/slug. It carries `enabled`, a **tier pointer** (not a duplicated model config), optional
   per-tool budget overrides, and — critically — is the durable **catalog for runtime-discovered MCP tools** (which
   have no code handler). A boot/migration sync upserts every code-defined `ToolDefinition.name` and **flags drift**
   (orphan governance rows / enabled-but-unregistered). This is the only genuinely-absent surface.
   - Most **native** tools are deterministic executors that make **no** LLM call, so they need only enable/catalog
     governance, not routing. Model routing stays at the capability/surface grain where the LLM calls actually happen.

3. **Per-run persistence → EXTEND `ai_usage_log`** with `routing_tier` + `escalation_reason`, and populate `cost_usd`.
   Parent/child attribution needs **no new linkage** — it already works through `run_id ↔ agent_delegation_runs.parent_run_id`.

**Net:** 2 extends + 1 small new table. This honors "extend the shared registry, not a parallel one," puts tiering
where the model calls actually are, and isolates the one true gap (per-tool/MCP catalog + drift) in a purpose-built,
slug-joined governance row instead of overloading `platform_ai_settings`' model-setting semantics.

---

## Verification-gate readiness (pre-implementation baseline)

| # | Gate | Today |
|---|---|---|
| 1 | Registry-driven selection (≥1 tool + ≥1 sub-agent) | Partial — resolution wired, but all → Sonnet; no tier |
| 2 | Model + reason recorded per run | Partial — model yes, reason/tier no |
| 3 | Independent parent/child cost | Partial — **token** attribution queryable now; **$** cost never populated |
| 4 | Haiku worker passes bounded task | Not yet — nothing routes to Haiku |
| 5 | Rule-based escalation to Sonnet | Missing |
| 6 | Failure/fallback visible via MA-05 layer | N/A yet — escalation surface not built |
| 7 | Founder isolation + tool permissions unchanged | Intact — `agent_capabilities` scoping untouched |
| 8 | No model selector in VCSO | Intact — routing is platform-governed; no UI selector exists |

---

## Recommended Objective 1 shape (for approval — not yet built)

Extend `ai_models` (tier tag + price) and `platform_ai_settings` (tier/budget/escalation) via migration; add the thin
`tool_governance` catalog + drift-sync; extend `ai_usage_log` (routing_tier, escalation_reason) and start populating
`cost_usd`. Prove on the thin vertical slice (one retrieval tool + the document-analysis sub-agent) per Objective 6.

---

## Scope correction (founder, 2026-07-13) — supersedes cost/usage framing above

The founder corrected two conflations in the audit above:

1. **`ai_usage_log` is the metering / credit ledger, not part of the tool registry.** It exists to track per-user
   token + cost consumption against 5-hour and 7-day windows across VCSO / OS Engine / domain agents (budget
   enforcement). Its unpopulated `cost_usd` is a gap in *that* system and is **out of scope for MA-06.** The registry
   does **not** track tool invocations or cost.
2. **The tool registry is a catalog, not a router-with-accounting.** Its job: a canonical inventory of every tool an
   agent can reach — slug, type (native/skill/mcp), source / MCP ref, description, enabled — that agents can
   query/search, **plus** a tier → model mapping. That is the whole job this pass.

**Confirmed pass depth (founder choice):** *Catalog + tier→model, wired.* Build the registry table + the
worker/synthesis tier→Claude-model mapping, **and** wire agents to resolve their model through it (so a worker task
genuinely runs on Haiku). **Rule-based escalation/fallback (old Obj 3) and cost attribution (old Obj 5) are deferred /
out of scope** for this pass.

### Revised extend-vs-new (matches corrected scope)
- **NEW thin `tool_registry` catalog table** keyed by tool `name`/slug — the one genuinely-absent surface. Persists the
  catalog the code already builds in memory (`ToolDefinition.source/executor_kind/mcp_metadata/skill_metadata`; a
  `tool_search` tool already searches it) + a `routing_tier` pointer + `enabled`. Boot/migration sync mirrors code +
  discovered MCP tools and flags drift.
- **REUSE `platform_ai_settings` + `ai_models` for tier→model.** Add tier rows (`tier_worker`→Haiku,
  `tier_synthesis`→Sonnet) so the existing `resolve_platform_model(setting_key=…)` resolver works unchanged; the
  registry's `routing_tier` selects which tier setting to resolve. Haiku already exists in `ai_models`.
- **`ai_usage_log` untouched** — it keeps metering. No new escalation/cost columns this pass.

**STOP — proceeding to propose the Objective 1 table schema for approval before writing the migration.**
