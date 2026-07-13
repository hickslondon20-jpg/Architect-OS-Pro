# MA-06 / Tool & Capability Registry — Governed Model Routing + Cost Control — SCOPE

> Governing scope for the tool/capability registry return pass: a hybrid code-plus-governance-table model,
> tier-based model routing, and per-capability cost control.
> Pairs with `MA-06-TOOL-REGISTRY-ROUTING-KICKOFF.md` (the thread-initiating prompt).
> **Baseline: v0.6.0** (MINOR bump from v0.5.71 marking entry into MA-06 — founder's call, made).
> Follows MA-05 (VCSO Agentic Transparency, soft-locked through Objective 8 at v0.5.71).

---

## Why this exists (the pivot)

MA-05 proved the agentic transparency layer end to end, including the bounded document-analysis sub-agent. The
Objective 8 capability test surfaced the next priority directly: the **bounded sub-agent used relatively little
context, while the parent VCSO made multiple Sonnet calls on substantially larger assembled-context inputs.**
Continuing to broaden sub-agent, sandbox, and tool-chain testing before governing model selection and context
would rack up avoidable API cost. So MA-06 is a **research-first return pass on the tool/capability registry with
model routing and cost control as the central concern** — deliberately ahead of more feature testing.

This is **not** a rewrite of tool calling. `tool_registry.py` already works and is already designed for this: its
docstring calls it "the D1-neutral seam between the Ep1/M8 capability registry and the Ep5 callable-tool registry,"
with authorization sourced from `agent_capabilities` **or** "registry-native tags by swapping the scope source."
There is already a `ToolScopeSource` protocol and it already ingests native, skill, and MCP tools. **Assume the
substrate exists; research it before designing schema; extend the shared registry rather than building a parallel one.**

---

## The architectural decision this pass implements — hybrid, not table-instead-of-code

The registry does **not** move out of code into a table. It becomes a **hybrid**:

- **Code stays the source of truth for what a tool *does*.** A `ToolDefinition` carries an `executor` (a Python
  callable) plus its JSON schema and logic. Behavior cannot live in a Postgres row — the handler ships in a deploy.
- **A governance table becomes the source of truth for how a tool is *run*.** Per-tool/-capability: enabled flag,
  routing tier / model policy, context + output budgets, timeout + round limits, fallback + escalation policy,
  cost-attribution tags, and persistence of the selected model + escalation reason per run. Editable at runtime
  without a deploy — which is the entire point of the cost-control goal.
- **Joined by a stable `name`/slug, and kept honest by reconciliation.** The code registry is authoritative for
  *existence*; the table is authoritative for *behavior/config*. A boot-time (or migration-time) sync upserts every
  code-defined tool into the table and **flags drift** — no orphan rows governing a tool with no handler, no tool
  enabled in the table that the code doesn't register.
- **MCP tools are the strongest case for the table.** MCP tools are discovered dynamically at runtime — there is no
  hand-written handler to point at. For those, the table is the durable **catalog + governance** (available / enabled /
  which tier / what cost), which is exactly how this should grow as the MCP surface expands.

---

## Confirmed design decisions (folded in — do not relitigate, refine only from research)

1. **Route by tier, not raw model ID.** Named tiers — *worker* / *reasoning* / *synthesis* — each map to a concrete
   model; tools/capabilities point at a tier. Swapping the model for all "worker" tasks is one edit.
2. **Cheaper = Claude-family only.** Worker tier = Claude Haiku; synthesis tier = Claude Sonnet. Provider stays Claude
   per `CLAUDE.md` — never an OpenAI-compatible / non-Claude model for cost reasons.
3. **Escalation is rule-based for v1.** Worker → higher tier triggers on deterministic signals (empty / invalid /
   schema-failing output, timeout, or round-limit hit) — **not** a fuzzy self-judged quality score. Quality-scoring
   loops are a later pass.
4. **Context optimization is in-scope but bounded.** Stop reloading full founder context for narrow worker tasks;
   optimize context selection and model selection together. The deeper compaction/assembly redesign is a documented
   later pass, not MA-06.
5. **Config is SQL/migration-managed in v1.** No admin UI this pass; and **no founder-facing model selector** in the
   VCSO — routing is platform-governed, not user-chosen.
6. **Prove a thin vertical slice before broadening.** Route exactly one retrieval tool + one sub-agent capability
   through the table, with independent parent/child cost attribution, and checkpoint with the founder before routing
   anything else.

**Left undecided on purpose (first research task):** whether to **extend** an existing table (`agent_capabilities`,
`platform_ai_settings`, `ai_models`) or **create** a new `tool_registry` table. Decide from findings, not before.

---

## Method — research-first, one objective at a time

For each objective: (1) **research** the live code + DB substrate and write a short findings note (wired / partial /
missing); (2) decide **extend vs. build** (prefer extend); (3) implement + **commit version-tagged** (PATCH++ from
v0.6.0); (4) prove the objective's acceptance criteria on live. Do not batch. **Report Objective 0 findings before any
schema or routing design.**

---

## Grounded starting pointers (verify, don't trust blindly)

**Code — `python-backend/services/`:** `tool_registry.py` (~1547 lines — `ToolDefinition` + `executor`,
`ToolScopeSource` / `AgentCapabilityScopeSource`, native/skill/MCP sources, `MCPClientManager` / `DiscoveredMCPTool`),
`agent_capabilities.py`, `sub_agent_orchestrator.py`, `vcso_chat_service.py`, `mcp_client.py`. Confirm existing
capability-specific model resolution and usage logging.

**Tables (confirm via Supabase MCP + `docs/migrations`):** `agent_capabilities`, `platform_ai_settings`, `ai_models`,
`ai_usage_log`. Confirm existing context routing / compaction / founder-context assembly.

**Observability:** LangSmith project `ArchitectOS-pro` — routing decisions, selected model, and escalations should be
traceable; pair traces with DB/output checks (necessary, not sufficient).

---

## Objectives

### 0. Research + reconciliation audit (stage gate — report before design)
Map what already exists: the `ToolScopeSource` seam and how tools are registered/scoped today; any current model
resolution + usage logging; the four candidate tables and whether one should be extended vs. a new `tool_registry`
table created; how parent/child run IDs already thread through `ai_usage_log` (MA-05 produced main + child run IDs).
**→ Stage gate: findings + extend-vs-new recommendation to founder before Objective 1.**

### 1. Governance table (hybrid overlay + reconciliation)
Design/extend the governance layer keyed to the code registry by `name`/slug. Fields: enabled, routing tier,
allowed models, context budget, output budget, timeout, round limit, fallback policy, escalation policy, cost-attribution
tags, and per-run persistence of selected model + escalation reason. Add the boot/migration-time **sync + drift flag**.
**→ gate.**

### 2. Tier-based model routing
Implement *worker* / *reasoning* / *synthesis* tiers → concrete Claude models (Haiku worker, Sonnet synthesis). Tools
and sub-agent capabilities resolve their model via the table by tier. **→ gate.**

### 3. Rule-based escalation + fallback
Deterministic escalation triggers (empty/invalid/schema-fail/timeout/round-limit) and fallback behavior; every
escalation records its reason and surfaces through the MA-05 transparency layer (failure/fallback visible, not silent).
**→ gate.**

### 4. Bounded context optimization
Narrow/worker tasks skip full founder-context reload; context selection resolved alongside model selection per
capability. Heavy compaction redesign explicitly deferred. **→ gate.**

### 5. Cost attribution (parent vs child, independent)
Token usage + estimated cost attributable to the parent VCSO and each child sub-agent **independently**, via
`ai_usage_log` joined on run IDs. **→ gate.**

### 6. Thin vertical proof slice (then checkpoint)
One retrieval tool + one sub-agent capability fully routed through the table end to end, with independent parent/child
cost attribution. **→ Stop-and-review checkpoint with founder before broadening.**

---

## Required verification (prove before broadening feature testing)

1. Registry-driven model selection works for at least one retrieval tool and one sub-agent.
2. The chosen model and routing reason are recorded per run.
3. Token usage and estimated cost remain attributable to parent and child **independently**.
4. A lower-cost worker (Haiku) produces acceptable output on a bounded task.
5. Escalation to Sonnet works when a task exceeds the worker's capability (rule-based trigger).
6. Failure and fallback behavior remains visible through the MA-05 transparency layer.
7. Founder isolation and existing tool permissions remain unchanged.
8. No model selector is exposed in the VCSO interface.

---

## Deliverables (then STOP at the cost-routing checkpoint)

- Objective 0 research findings + extend-vs-new table recommendation.
- Migration(s) for the governance layer + reconciliation/sync; version-tagged fix-in-place diffs per objective.
- Routing + escalation + cost-attribution proven on the thin vertical slice; the 8 verification gates results table.
- `Pro-Suite-Progress.md` updated; checkpoint report back to founder.
- **Do not** broaden sub-agent, sandbox, or tool-chain testing until the cost-routing checkpoint is reviewed with the
  founder.

---

## Preserve these (from MA-05 + platform locks)

- **Research first; assume the routing substrate already exists;** extend the shared registry, don't build a parallel one.
- Keep the main VCSO conversational voice intact; keep sub-agents **bounded and non-recursive**.
- Preserve curated transparency — never expose raw chain-of-thought; keep tool inputs/results sanitized.
- **Thinking mode stays disabled** (MA-05 decision).
- **Work from live** (`architectospro.com`, `api.architectospro.com`, `main` → auto-deploy); verify production behavior
  after each versioned change; commit version-tagged (PATCH++ from v0.6.0).
- Provider stays Claude (`CLAUDE.md` Rule #1 lanes; no client-side Anthropic; no Edge Functions for AI). Design-system
  non-negotiables apply to any surface touched. Never echo secrets/PII.
