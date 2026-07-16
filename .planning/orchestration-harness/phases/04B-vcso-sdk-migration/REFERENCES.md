# References: 04B — Proposed VCSO SDK Migration — ArchitectOS Pro

The source-material → **extract / adapt / skip** map for the SDK migration. External references are
mined for patterns; they are **not** a blueprint. Build to the North Star
(`../../../COGNITIVE-ORCHESTRATION-ARCHITECTURE.md`) and the harness spine. Where any reference and the
North Star conflict, the North Star wins.

## Canonical sources (win over any reference)

- `../../../COGNITIVE-ORCHESTRATION-ARCHITECTURE.md` — North Star: turn lifecycle, three terminal modes,
  delegation targets, source selection + freshness, working-state memory, bounds.
- `../../../INTELLIGENCE-LAYER-ARCHITECTURE.md` — three surfaces, four-tier knowledge layer, one-writer.
- `../../CONTEXT.md` / `../../ROADMAP.md` / `../../REFERENCES.md` — the harness spine: reuse map,
  governing principles, locks, Phases 0–7 + live status, reference-pattern dispositions.
- Repo-root `CLAUDE.md` — platform rules (esp. Rule #1: Python-backend/in-process Anthropic calls for
  VCSO streaming; Claude-lock; version-tagged commits; design-system + section locks).

## External references (mined for patterns only — Anthropic engineering)

| Reference | URL | What we take |
|---|---|---|
| **Building Effective Agents** | `anthropic.com/engineering/building-effective-agents` | The workflow-vs-agent distinction (VCSO = agent; domain agents lean workflow); the augmented-LLM base unit; the named patterns (prompt chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer); the ACI/tool-design discipline ("give tool defs as much prompt engineering as prompts"); "optimize single LLM calls with retrieval first — add agents only when they demonstrably help." |
| **How we built our multi-agent research system** | `anthropic.com/engineering/multi-agent-research-system` | Orchestrator-worker with subagents as **context compression**; lead plans → spawns parallel subagents → synthesizes → CitationAgent; **scale effort to query complexity** (the cost governor); "teach the orchestrator how to delegate" (the exact P4 defect); plan-to-Memory; dynamic multi-step search > static RAG; cost reality (agents ~4× chat, multi-agent ~15×); Opus-lead+Sonnet-worker beat single-Opus 90.2%. |
| **A harness for every task: dynamic workflows** | `claude.com/blog/a-harness-for-every-task-dynamic-workflows-in-claude-code` | The single-context failure modes that name P4's problem — **agentic laziness, self-preferential bias, goal drift**; composable patterns (classify-and-act, fan-out-and-synthesize, adversarial verification, generate-and-filter, tournament, loop-until-done); model/intelligence routing; "does it really need more compute?" restraint. |
| **Agent SDK overview** | `code.claude.com/docs/en/agent-sdk/overview` | The build substrate: same loop/tools/context-management as Claude Code, as a Python/TS library **in-process** (matches Rule #1); built-in tools; **Hooks** (`PreToolUse`/`PostToolUse`/lifecycle) for LangSmith + usage; **Subagents** (per-agent tools + model, `parent_tool_use_id`); **MCP** server config; **Permissions** (`allowed_tools`); **Sessions** (resume/fork); Agent SDK vs Managed Agents (we run our own infra → in-process SDK, not Managed). |

## Internal reference — gbrain-inspiration (patterns mined, not product)

`../../../gbrain-inspiration/` — the knowledge-brain reference we studied first. Mine the *mechanisms*:

- **compiled-truth + timeline** page shape → the compiled-wiki + snapshot-timeline model for founder
  financials/trends (`compiled-truth.md`).
- **hybrid + graph retrieval** (vector + BM25 + RRF + graph traversal + rerank + source-aware ranking)
  → validates "don't jump to vector"; informs the tiered router's quality ceiling (`RETRIEVAL.md`).
- **brain-first lookup** + **brain vs memory vs session** → check compiled context before external
  calls; three-layer routing (world knowledge / operational state / session).
- **sub-agent model routing** (cheapest model that can do the job) → corroborates MA-06 tier map.
- **two-surface / brains-and-sources** → the connector/source federation mental model.
- **Skip:** single-user/local/Git-storage packaging, the `gbrain` CLI product framing. We are
  multi-tenant Supabase cloud.

## Code surfaces this migration touches (verified 2026-07-15)

| File | Lines | Role | Disposition |
|---|---|---|---|
| `python-backend/services/vcso_chat_service.py` | 3,155 | The hand-rolled loop, streaming, planner path, Deep Mode, trace-step emission, context orchestration | **Replace** loop + fake stream; **rework** packing/lifecycle; **keep** SSE schema + selection orchestration |
| `python-backend/services/vcso_source_router.py` | 637 | Deterministic cheapest-first Tier 0–4 ladder | **Rework** → tiers-as-tools + cheap pre-fetch fast-path |
| `python-backend/services/sub_agent_orchestrator.py` | 1,169 | 7 bounded capability handlers + delegation runs | **Keep** handlers; **replace** generic orchestration plumbing with SDK subagents |
| `python-backend/services/tool_registry.py` | ~1,610 | In-process registry, 3 tool sources, MCP discovery, scope sources, Anthropic/OpenAI emitters, Deep Mode tools | **Keep**; **extend** → SDK-config compiler + `persistence_semantics` |
| `python-backend/services/mcp_client.py` | 258 | `MCPClientManager`, discovery, call | **Keep**; wire to SDK `mcp_servers` |
| `python-backend/services/sandbox_execution_service.py` | — | GKE sandbox for compute workers | **Keep** |
| `python-backend/main.py` | — | `/api/vcso/chat` StreamingResponse host | **Keep**; new SDK path behind flag |

## Supabase tables this migration touches (project `Architect OS` / `pwacpjqkntnovndhspxt`)

| Table | Role | Disposition |
|---|---|---|
| `tool_registry` | Catalog mirror (slug, tool_type, source_ref, enabled, routing_tier, is_code_registered, last_synced_at) | **Keep**; **extend** `persistence_semantics` |
| `mcp_connections` | Per-user auth (server_name, transport, config, auth_type, **vault_secret_id**, status, oauth_expires_at) — 0 live rows | **Keep** (secrets pattern already correct) |
| `agent_capabilities` | Agent defs + `allowed_tools[]` scoping + `routing_tier` + `model_setting_key` + `can_spawn_agents` | **Keep** → source of SDK `allowed_tools`/`agents` |
| `ai_models` | Model catalog (provider, model_name, cost_tier, capabilities, context_window) | **Keep** → tier→model resolution |
| `feature_registry` / `tier_features` / `subscription_tiers` | Beta gating (`beta_unlock_week`) + entitlements | **Keep**; candidate home for connector availability (Q2) |
| `agent_todos` | Editable Deep Mode plan (the visible scratchpad) | **Keep** |
| `agent_context_sources` | Per-run citation/provenance (`citation_payload`) | **Keep** → CitationAgent pattern |
| `agent_delegation_runs` / `_steps` | Sub-agent run tracking | **Keep**; reconcile with SDK subagent traces |
| `domain_agents` | Domain-agent catalog (5-domain surface) | **Keep**; later surface for SDK cutover |
| `ai_usage_log` | Metering ledger (role/surface/run_id/capability_key) | **Keep**; **separate** — not this build's concern |
| `ose_raw_document_registry` | OS-engine raw-doc registry (ingestion) | Consume (ingestion pipeline dependency) |

## Prior scopes this proposal inherits (do not rebuild)

- **MA-05** — curated transparency (Context/Tool/Delegation/Response steps), SSE streams.
- **MA-06** — `tool_registry` + tier→model routing + `effective_model_setting_key`.
- **Ep6 (`../../../agent-harness/`)** — `sub_agent_orchestrator` + `agent_capabilities`/`agent_delegation_*`,
  Deep Mode todos/workspace, `ask_user`, structured worker contracts.
- **Harness Phases 0–3** — reconciliation, working-state memory (CTX-1..5, ~54% first-call reduction),
  intent read (INT-1..3), tier-escalating source router (ROUT-1..5). All live-dark / canary.
