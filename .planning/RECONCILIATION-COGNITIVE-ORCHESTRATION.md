# Reconciliation — Live Build vs. Cognitive Orchestration North Star

> Authored: 2026-07-13
> Measures: the live ArchitectOS build against the five open questions in
> `COGNITIVE-ORCHESTRATION-ARCHITECTURE.md` §10.
> Method: live code + Supabase (`pwacpjqkntnovndhspxt`) inspection, paired with usage-data evidence.
> Companion to: `COGNITIVE-ORCHESTRATION-ARCHITECTURE.md` (yardstick) and
> `OPENCLAW-ANALYSIS-ORCHESTRATION-REPURPOSE.md` (patterns to repurpose).

---

## Summary verdicts

| # | Open question | Verdict | One-line |
|---|---|---|---|
| Q1 | Real tier-escalating retrieval **router**? | **Mostly missing** | No cost-aware 0→1→2→3 escalation; Tier-1 preloaded by keyword, Tier-2/3 via a flat model-chosen tool bag. |
| Q2 | Tier-1 wiki **feeder loop** running? | **Partial** | Wiki pages exist and are consumed; ingestion→wiki feeder appears live; conversation→wiki feeder unconfirmed; two wiki representations coexist. |
| Q3 | Worker **roster** state? | **Wired (narrow)** | 7 real handlers incl. sandbox compute; 4 disabled placeholders. Solid substrate. |
| Q4 | Where does the **harness** live? | **Clarified + drift** | Live VCSO is the **Python** agentic loop (`/api/vcso/chat`); the Vercel `chat.ts` is dead legacy; CLAUDE.md Rule #1 is stale. |
| Q5 | **MCP** live + freshness policy? | **Scaffolded, not live** | MCP client + connector catalog (QuickBooks) + table exist; **0 live connections**; no freshness/authority policy anywhere. |

**Headline:** the *substrate* is more built than §10 feared — a real, reasonably broad worker roster
(including a sandbox compute worker), a consumed Tier-1 wiki, and scaffolded MCP. But the **spine of
the North Star — a tier-escalating router and a decompose→delegate→compose planner — genuinely does
not exist.** Two cleanup/drift items (a dead second VCSO, and two wiki representations) should be
resolved as part of, or before, the harness build.

---

## Q1 — Retrieval router: mostly missing

**What's there.** The live VCSO (Python `vcso_chat_service._build_context`) assembles a turn by:
preloading a **keyword-selected slice of the Tier-1 founder wiki** (`ose_knowledge_pages`, top ~8 by
lexical score with a +10 boost for the seven core Layer-1 page keys) into the prompt, then handing
the Sonnet loop a **flat Anthropic tool bag** (`registry.get_tools(surface="virtual_cso")`) of
KB/wiki/retrieval tools it may call at will. A `_classify()` step exists — but it is **keyword skill
routing** (which skill pack to load), not tier routing. `RetrievalService.hybrid_search` (Tier-2
RRF + optional rerank) is exposed as a tool the model chooses.

**What's missing vs. North Star.** There is **no deterministic, cost-aware tier escalation**
(Tier 0 → 1 → 2 → 3 → live) that stops at the cheapest sufficient source. Tier-1 is preloaded by
lexical match (not by intent), Tier-2/3 are reached only if the model decides to call a tool, and
there is no notion of "answer from a component vs. escalate." This is exactly the "flat model-driven
tool selection" §10 suspected. The **router is the single biggest missing piece of the spine.**

**Implication.** The planner/router is net-new. The good news: the retrieval primitives it would
orchestrate (hybrid search, KB tools, wiki reads) already exist as callable tools — the router
composes existing parts rather than building retrieval from scratch.

## Q2 — Tier-1 wiki feeder loop: partial

**What's there.** Wiki content exists and **is consumed** on every turn: the test founder has 12
`ose_knowledge_pages` (latest 2026-07-11, aligned to their document uploads), and the VCSO loads them
into context. So the **ingestion → wiki** feeder (uploads produce/refresh pages) appears to be
running. A second, richer representation also exists — a `wiki_*` family (`wiki_pages`,
`wiki_claims`, `wiki_evidence`, `wiki_digest`, `wiki_insight_records`, `wiki_contradictions`) behind
the `per_user_wiki` capability — i.e., a claims/evidence/digest wiki distinct from the flat
`ose_knowledge_pages` the VCSO prompt reads.

**What's unconfirmed / drifting.** (a) The **conversation → synthesis → OS-Engine → wiki** feeder
(the compounding Layer-2 loop that grows understanding from *chat*, per the canonical architecture)
was **not confirmed running** in this pass — pages track uploads, not threads. (b) **Two wiki models
coexist** (`ose_knowledge_pages` consumed by the VCSO vs. the `wiki_*` claim/evidence system reached
via a sub-agent), and which is authoritative for query-time composition is ambiguous.

**Implication.** The North Star's "wiki as pre-reasoned components composed at query time" depends on
(1) the conversation feeder actually accreting Layer-2, and (2) resolving which wiki representation
the composer reads. Both are reconciliation items to settle before leaning the cost model on the wiki.

## Q3 — Worker roster: wired, narrow

**What's there.** `sub_agent_orchestrator` dispatches **seven real handlers**:
`document_analysis_agent`, `structured_data_agent`, `kb_explorer_agent`, `sandbox_execution_agent`,
`per_user_wiki`, `per_user_document_wiki`, `global_ip` — all `status=experimental` (active). Notably,
a **sandbox compute worker already exists** (the quantitative-analysis worker the North Star wants),
and all sub-agents now honor MA-06 tier routing via `effective_model_setting_key`.

**What's missing.** Four capabilities are **disabled placeholders with no handler**
(`metadata_review_agent`, `retrieval_evidence_agent`, `strategy_synthesis_agent`,
`sprint_planning_helper`). Delegation is currently **model-discretionary** (the parent decides to call
`delegate_to_sub_agent`) and, per the MA-06 proof, the parent often just answers directly.

**Implication.** The worker substrate is a genuine strength — the harness has real bounded specialists
to dispatch to, including compute. What's missing is the *orchestration that reliably uses them* and a
couple of strategic workers (a retrieval-evidence and a strategy-synthesis worker) worth enabling.

## Q4 — Harness location: clarified, with drift to fix

**What's there.** The **live** VCSO turn runs in the **Python backend**:
`main.py` → `@app.post("/api/vcso/chat")` → `StreamingResponse` over `VcsoChatService` (the agentic
tool loop, MA-05 transparency, MA-06 routing). Usage evidence is decisive: over the last 10 days,
`ai_usage_log` shows **76 `virtual_cso` rows (Python) and zero `ws5-chat` rows.**

**The drift.** A **second, legacy VCSO exists** — the Vercel serverless `api/vcso/chat.ts`
(`surface=ws5-chat`): a **single-shot** implementation (one Claude call, everything crammed into one
assembled prompt, an optional keyword-gated single `kb_explorer` pre-call, no tool loop). It is
**not in use** (0 recent usage) but still in the tree. Meanwhile **CLAUDE.md Rule #1 still declares
the VCSO a "Vercel serverless streaming exception"** — which no longer reflects reality.

**Implication.** This is actually clarifying for the harness: it belongs **in the Python backend**,
where the agentic loop, orchestrator, tool registry, and tier routing already live — no Vercel/Python
split to reconcile. Two housekeeping actions fall out: **(1) retire or explicitly quarantine the dead
Vercel `chat.ts`** so no one revives divergent logic, and **(2) correct CLAUDE.md Rule #1** to state
the live VCSO is Python-served. (Frontend `src` could not be grepped here — those files read as
cloud-only/unmaterialized — so the exact frontend call URL is inferred from usage + the route; worth a
1-line confirm when convenient.)

## Q5 — MCP + freshness policy: scaffolded, not live

**What's there.** The MCP substrate exists: `MCPClientManager` / `DiscoveredMCPTool` in the tool
registry (runtime-discovered MCP tools flow through the same registry), `mcp_connectors.py` with a
**connector candidate catalog including QuickBooks**, `mcp_credentials.py`, and an `mcp_connections`
table.

**What's missing.** **Zero live MCP connections** for any founder (`mcp_connections` = 0), so the
North Star's "pull last month's P&L live from QuickBooks" is **not currently possible** — only
catalogued as a candidate. And there is **no freshness/authority policy** anywhere in the code (no
notion of "is the wiki component fresh enough, or go to source"). Both are net-new.

**Implication.** The plumbing to make live pulls possible exists; the missing pieces are (a) an actual
connected source and (b) the freshness/authority decision that chooses wiki-vs-live. The router (Q1)
is the natural home for that decision.

---

## Cross-cutting reconciliation actions (before/within the harness pass)

1. **Retire the dead Vercel VCSO + fix CLAUDE.md Rule #1.** One live VCSO (Python). Remove the
   confusion of a second, divergent single-shot implementation.
2. **Resolve the two wiki representations.** Decide the authoritative query-time wiki
   (`ose_knowledge_pages` vs. the `wiki_*` claim/evidence system) and how the composer reads it.
3. **Confirm the conversation→wiki feeder.** The compounding Layer-2 loop is the cost lever; verify it
   runs (or scope it), separately from the upload→wiki feeder which appears to.

## What this means for the harness build (feeds the GSD plans)

- **Build net-new:** the tier-escalating **router** and the decompose→delegate→compose **planner**
  (the spine). This is the core of the pass.
- **Leverage as-is:** the 7-worker roster incl. sandbox compute, the MA-05 transparency streams, the
  MA-06 tier routing + tool registry, the Python `/api/vcso/chat` streaming host, and the existing
  retrieval/KB/wiki tools the router will orchestrate.
- **Make possible, then use:** a first live MCP connection (QuickBooks is the obvious pilot) + the
  freshness/authority policy the router consults.
- **Enable selectively:** the disabled strategic workers (retrieval-evidence, strategy-synthesis) as
  the decompose→delegate breadth grows.

Against the OpenClaw shortlist: the **context-engine seam** (working-state assembly), **lane
contracts** (worker/handoff contracts), and the **active-memory pre-pass** pattern map directly onto
building the router + planner here; **runtime-enforced tool policy** applies when the sandbox/MCP
workers gain reach. Revisit `OPENCLAW-ANALYSIS-ORCHESTRATION-REPURPOSE.md` §10 when scoping.

---

## Evidence log (live)

- Live VCSO route: `python-backend/main.py` `@app.post("/api/vcso/chat")` → `StreamingResponse`
  (`VcsoChatService`). Usage last 10d: `virtual_cso`=76, `ws5-chat`=0.
- Router: `vcso_chat_service._build_context` preloads `ose_knowledge_pages` (keyword `selectFounderPages`
  / core-key boost) + flat `registry.get_tools(surface=...)` tool bag; `_classify` = skill keyword routing.
- Workers: orchestrator dispatch (lines ~108–121) — 7 handlers; `agent_capabilities` — same 7
  `experimental`, 4 `disabled` (no handler).
- Wiki: `ose_knowledge_pages` 12 pages for founder `cd490873…` (latest 2026-07-11); `wiki_*` family present.
- MCP: `mcp_connections`=0; `mcp_connectors.py` candidate catalog incl. `quickbooks`; no freshness policy in code.
