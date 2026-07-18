# Context: Orchestration Harness — VCSO Planner + Decompose→Delegate→Compose — ArchitectOS Pro

**Written:** 2026-07-13 (post cost-routing checkpoint; post reconciliation pass)
**Audience:** The Orchestration Agent and every Execution Agent that touches this build. This
document has **no dependency on the conversation that produced it** — everything load-bearing is
written down here.

> **Canonical sources this build sits under.** Read these before anything here:
> `../COGNITIVE-ORCHESTRATION-ARCHITECTURE.md` (the North Star — turn lifecycle, three terminal
> modes, delegation targets, source selection, working-state memory, bounds), which itself nests
> under `../INTELLIGENCE-LAYER-ARCHITECTURE.md` (three surfaces, four-tier knowledge layer, the
> one-writer/feeder rule). Current-state input: `../RECONCILIATION-COGNITIVE-ORCHESTRATION.md`
> (what is wired / partial / missing on live). Patterns-to-repurpose input:
> `../OPENCLAW-ANALYSIS-ORCHESTRATION-REPURPOSE.md`. Prior scopes this inherits:
> `MA-05-CSO-TRANSPARENCY-SCOPE.md` (transparency layer), `MA-06-TOOL-REGISTRY-ROUTING-SCOPE.md`
> (tier routing + tool registry), and the `agent-harness/` workstream (Ep6 Deep Mode + sub-agents).
> Where any reference and the North Star conflict, **the North Star wins.**

---

## Why This Build Exists

The Virtual CSO today is a **single-model agentic tool loop**: one Sonnet call per round,
re-reading a large assembled context (founder wiki slice + accumulated tool results + history) each
round, until it writes an answer. The MA-06 Objective-8 proof showed the cost signature directly —
the parent VCSO fires multiple Sonnet calls at 18k–27k input tokens each, while a bounded worker
uses ~1k. **The expensive context is the parent loop; that is where the money goes, and it is
untouched by tier routing alone.**

More fundamentally, the target use case is not "what does this document say." It is CFO/CSO-grade
**synthesis with judgment** — "client concentration is climbing while margin compresses, what do I
do" — and conversation that is not always a question at all (a brainstorm to move forward, an idea
to pressure-test). A single loop that crams everything into one context and answers is a chatbot.
The platform needs a **thought partner**: something that reads the *intent and depth* of the move,
plans, delegates the token-heavy gathering to cheap bounded workers that return compact cited
findings, and keeps the strong judgment on small, pre-chewed inputs — or, when it lacks enough,
says so and steers.

This build stands up that **planner/harness** over the substrate MA-05, MA-06, and Ep1–Ep6 already
produced. It is **not a rewrite** of tool calling, retrieval, transparency, or routing — it is the
orchestration layer that composes them into the decompose→delegate→compose turn.

This is the seventh intelligence-layer build in the Pro Suite initiative. It sits one step past the
`agent-harness/` (Ep6) workstream: Ep6 gave Domain Agents a *hard* harness and VCSO a *soft* Deep
Mode; this build makes the **VCSO's default turn itself a governed planner**, not a flat loop.

---

## The Target Shape (build to this; see North Star for full detail)

A turn moves through **deterministic phases with model-driven contents**:

```
INTENT ──▶ PLAN ──▶ GATHER ──▶ COMPOSE ─or─ REFLECT-&-STEER
(read)    (decompose)(delegate)  (judge)     (surface gap, ask)
   └──────────── working-state memory threads through all phases ────────────┘
```

- **Intent & depth read (cheap, worker-tier).** First act of a turn — classify the *kind* of move
  (lookup / strategic synthesis / brainstorm / produce / ambient) and its depth. Sets the response
  contract and the adaptive triage: simple turns answer directly and never decompose.
- **Plan / decompose.** For multi-part asks, break into sub-questions, each routed to the cheapest
  sufficient source or worker; budget-bounded; revisable mid-turn.
- **Gather / delegate.** Bounded specialists (retrieval, sandbox compute, wiki components, live MCP,
  domain-agent production) absorb the token-heavy work and return **compact, cited, structured**
  findings.
- **Compose *or* reflect-and-steer.** The synthesis-tier model (Sonnet) reasons over working state +
  compact findings to produce a cited, judgment-bearing answer — *or* chooses to surface the gap and
  bring the human back in.
- **Three terminal modes:** synthesize-and-answer, produce-and-act, **reflect-and-steer** (a
  first-class outcome, not a failure).

**Core cost identity:** `cost ≈ (model price) × (context size) × (# passes)`. Native tools touch
none of these. All cost control comes from keeping the *inputs to strong judgment* small and
pre-synthesized — never from degrading the judgment. **Cost, quality, and UX are co-equal.**

**Build-time over query-time.** The Tier-1 wiki is a **library of pre-reasoned components**, not a
cache of answers; the planner composes a fresh answer from a few compact components rather than
re-crawling raw source each turn.

---

## Reuse-Before-Create Map (verified live, 2026-07-13 — see `../RECONCILIATION-COGNITIVE-ORCHESTRATION.md`)

**Reuse — do not rebuild:**

| Capability | Existing asset (verified) |
|---|---|
| Live VCSO turn host | Python `main.py` → `@app.post("/api/vcso/chat")` → `StreamingResponse(VcsoChatService)` (surface `virtual_cso`, live; 76 rows/10d) |
| Bounded workers (7 live handlers) | `sub_agent_orchestrator.py` — `document_analysis`, `structured_data`, `kb_explorer`, **`sandbox_execution` (compute)**, `per_user_wiki`, `per_user_document_wiki`, `global_ip`; `agent_capabilities` + `agent_delegation_runs/steps` (migration 009) |
| Tier→model routing | MA-06: `platform_ai_settings` tier rows (`tier_worker`→Haiku, `tier_synthesis`/`tier_reasoning`→Sonnet), `resolve_platform_model`, `AgentCapability.effective_model_setting_key` |
| Tool catalog + discovery | MA-06 `tool_registry` table + `tool_registry.py` (`ToolRegistry`, `tool_search`, `delegate_to_sub_agent`, MCP discovery), boot drift sync |
| Retrieval primitives | `retrieval.py` (hybrid RRF + optional rerank), KB tools (`kb_ls/tree/grep/glob/read`), `wiki_*` tools, `structured_query.py` |
| Transparency streams | MA-05 curated Context/Tool/Delegation/Response steps; `messages` relational persistence; SSE `lifecycle`/`tool`/`assistant` streams |
| Tier-1 wiki (consumed) | `ose_knowledge_pages` (preloaded into the VCSO prompt); richer `wiki_*` claim/evidence system behind `per_user_wiki` |
| Sandbox | `sandbox_service.py` (GKE), `sandbox_bridge.py`, `sandbox_execution_service.py` |
| Metering | `ai_usage_log` (tagged `role`/`surface`/`run_id`/`capability_key`) — **separate metering ledger, not this build's concern** |

**Net-new for this build:**

| Net-new | Why it does not exist yet |
|---|---|
| **Tier-escalating source router** | Today: Tier-1 preloaded by keyword + flat model-chosen tool bag. No cost-aware 0→1→2→3→live escalation. |
| **Planner (decompose→delegate→compose)** | Today: model-discretionary single loop; it usually answers directly instead of delegating. |
| **Working-state memory** | Today: raw-history compaction. No compact per-thread state (decisions / open questions / gathered findings). |
| **Reflect-and-steer terminal mode** | Today: the loop always composes an answer; no first-class "surface the gap + ask." |
| **Freshness/authority policy** | Today: none. No wiki-fresh-enough-vs-go-to-source decision. |
| **First live MCP source** | Today: `mcp_connections` = 0. Connector catalog (QuickBooks) + client manager scaffolded only. |
| **Durable annotation/learning grain** | Today: only raw-history compaction. No cross-thread notes agents attach to reusable resources (wiki components / tools / skills) that persist and re-inject (Context Hub pattern). |
| **Modular founder-context consumption** | Today: the VCSO preloads a keyword slice of the 7 business pages. No design to consume an *extensible* founder-context set (business + founder-operating pages) as composable components. |

---

## Governing Principles (from the North Star; do not override)

1. **Cheap, compact inputs into strong, uncheapened judgment.** Workers on the worker tier absorb;
   the synthesis tier only holds working state + distilled findings + wiki components.
2. **Deterministic phases, model-driven contents.** The phase order (intent→plan→gather→compose/steer)
   is fixed and budget-bounded; content within phases is model-driven.
3. **Build-time over query-time.** Prefer pre-reasoned wiki components; escalate to live crawl/pull
   only as far as the question requires.
4. **Bounded specialists only.** Every worker gets scoped context + an approved tool set + a
   structured return contract. No open-ended roaming agents; depth-bounded sub-delegation, never open
   recursion.
5. **One writer (architecture §5).** The orchestrator reads, composes, and *feeds* synthesis back; it
   **never writes the wiki directly.** OS Engine remains sole writer.
6. **Everything traceable; no hallucinated strategy.** Every surfaced insight cites a source (Tier-0
   record, document, or cited wiki page).
7. **Curated transparency (MA-05).** Show the plan, tools, sources, sub-agents; never raw
   chain-of-thought. Thinking mode stays disabled.
8. **Claude-locked (CLAUDE.md Rule #1).** Orchestration/judgment = Sonnet; workers = Haiku via the
   MA-06 tier map. Never a non-Claude model for cost.
9. **Work from live.** Each phase's first move is a live code/schema check; verify on
   `architectospro.com` / `api.architectospro.com` after each versioned change; commit version-tagged.
10. **Two grains of memory (Context Hub pattern).** Within-thread **working state** (decisions,
    open questions, gathered findings) *and* durable **annotations** agents attach to reusable
    resources (wiki components, tools, skills) that persist across threads and re-inject on future
    use. Both are re-injected as **untrusted context** (not instructions). Annotations are
    agent-authored notes/feedback — **never** a knowledge-base write; they *feed* OS Engine.
11. **Consume a modular, extensible founder-context layer (Personal Context Portfolio pattern).**
    The router/assembly must treat founder context as composable, grabbed-as-needed components —
    **never hard-coded to the seven business pages.** The set grows to include founder-operating
    pages (communication style, decision log, goals/priorities, role, constraints). *Authoring*
    those pages is OS Engine's job (one-writer); this build designs to *consume* them.

---

## Decisions Execution Agents Must Not Override

1. **The harness lives in the Python backend** (`vcso_chat_service` path), where the loop, workers,
   registry, tier routing, and MA-05 streams already are. There is **no** Vercel/Python split to
   honor — see Conflict Register O1.
2. **Adaptive, not always-on delegation.** A simple lookup answers directly on one pass; only genuine
   multi-part synthesis pays for a plan + workers. The intent read is the gate.
3. **Reflect-and-steer is a first-class terminal mode**, not an error path.
4. **Tier authority stays at the capability grain** (`agent_capabilities.routing_tier` →
   tier setting), as established in MA-06 — the router selects *sources*, the tier map selects *models*.
   Do not create a second model-selection authority.
5. **Working-state memory replaces compaction as the primary anti-bloat mechanism** — compaction stays
   only as a fallback for pathological length. Working state is conversational scaffolding, never a
   knowledge-base write.
6. **The wiki is composed, not cached.** Compose fresh answers from compact pre-reasoned components;
   do not attempt to pre-store answers to strategic questions.
7. **Per-turn budget + depth cap on the planner** are mandatory guardrails (rounds / delegation depth /
   spend). One controlled level of sub-delegation; never open recursion.
8. **No founder-facing model selector; founder isolation unchanged** (MA-05/MA-06 locks).
9. **Scale replicas, never in-container worker processes** — until the worker MCP registry has a shared
   backing store. Phase 04B-D2's model-driven delegation mints a per-turn token into `TURN_REGISTRY`, a
   **process-global** dict in `services/vcso_worker_mcp.py`, and the worker MCP endpoint is reached over
   loopback (`http://127.0.0.1:$PORT`). Multiple **replicas are safe** — each is its own container,
   `127.0.0.1` stays inside it, and the process that minted the token serves its own loopback call.
   Multiple **processes inside one container are not** — they share the listening socket but not the
   registry, so a loopback call can land on a sibling process that has never seen the token, failing as
   `WorkerScopeError` that reads exactly like a delegation-mechanism failure. This is not a tuning knob:
   do **not** add `--workers` to the uvicorn start command, and do **not** set a `WEB_CONCURRENCY`
   environment variable (pinned `uvicorn==0.35.0` reads it at `config.py:330-331` when `--workers` is
   absent, so it spawns worker processes with no visible change to the start command). If in-container
   throughput is ever genuinely needed, give `TURN_REGISTRY` a shared backing store first.

---

## Resolved Design Forks (carried in from the vision conversation)

- **F1 — ambition dial: RESOLVED = distinct planner/harness, not a matured single loop.** Founder
  chose the real orchestrator (closer to Ep6 harness) over biasing the existing loop.
- **F2 — cost lever: RESOLVED = context compression via delegate + build-time components, not
  compaction.** Compaction is a symptom fix; the harness keeps the expensive model's context small.
- **F3 — wiki role: RESOLVED = library of pre-reasoned components composed at query time.**
- **F4 — M8 bounds consciously relaxed:** sandbox workers allowed; depth-bounded sub-delegation
  allowed; `ask_user`/human-in-loop is legitimate; planning/decomposition is central now. Hard-keeps
  (isolation, traceability, one-writer, curated transparency, structured worker contracts) remain.

---

## Conflict Register (flag new conflicts here; never resolve silently)

| # | Conflict | Resolution |
|---|---|---|
| O1 | Two VCSO implementations existed: live Python agentic loop (`/api/vcso/chat`, surface `virtual_cso`) vs. legacy Vercel single-shot (`api/vcso/chat.ts`, surface `ws5-chat`). CLAUDE.md Rule #1 was stale. | **Resolved 2026-07-13.** Frontend/config and live usage confirm Python. The Vercel route is quarantined with HTTP 410, CLAUDE.md is corrected, a production VCSO turn passed, `virtual_cso` remains active, and `ws5-chat` remains 0. `api/vcso/writeback.ts` was verified live and retained. |
| O2 | Two wiki representations overlap on seven fixed Layer-1 keys: structured `wiki_*` claim/evidence/digest data and rendered copies in `ose_knowledge_pages`; OSE also holds emergent Layer-2 pages. | **Resolved 2026-07-13 (founder-approved, with projection caveat).** Authority by layer: `wiki_*` / `WikiReadService` / `per_user_wiki` is authoritative for the seven fixed Layer-1 pages; `ose_knowledge_pages` / `DocWikiReadService` / `per_user_document_wiki` is authoritative for emergent Layer-2; the seven OSE Layer-1 rows are materialized projections, not a competing authority. **Caveat:** the wiki_*→OSE-Layer-1 projection is *not yet verified live* (both hold exactly 7 for the test founder — consistent with a projection *or* parallel authoring) → recorded as an OS-Engine dependency (see Named dependencies). **Phase 3 build directive:** the composer reads `wiki_*` *directly* for the seven fixed pages (claim/evidence = superior cited component) + `ose` for Layer-2 — a deliberate two-source read that does not depend on the unverified projection. No live read path changed in Phase 0. |
| O3 | Conversation→synthesis→OS-Engine→wiki feeder (compounding Layer-2 from chat) was not confirmed running; wiki pages tracked uploads, not threads. | **Scoped deferred 2026-07-13.** The thread adapter and manual endpoints exist, but all 18 live threads were pending and zero OSE pages had `origin_thread_id`; upload-linked pages do exist. Do not treat conversation compounding as live until operational wiring and live evidence land. |

Any execution agent that hits a **new** conflict stops and adds a row here rather than resolving it
silently.

---

## Deferred / Out of Scope for this build

- **OS Engine wiki-page generation + vectorization internals** — OS Engine's own build; this build
  reads components and *feeds* synthesis, never writes (one-writer rule).
- **Deep compaction/assembly redesign beyond working-state memory** — working-state memory is in
  scope; a larger compaction overhaul is not.
- **Full MCP connector marketplace / many live sources** — one pilot connector (QuickBooks) proves the
  live-source + freshness path; breadth is post-build.
- **Self-judged quality-score escalation loops** — escalation stays rule-based/deterministic (MA-06
  posture); quality-scoring is a later pass.
- **Account-level metering ledger / quotas / admin UI** — `ai_usage_log` metering is a separate system;
  unchanged here.
- **Visual/UX polish of the transparency surface** — functional wiring only; MA-05 surface is reused.
- **Enabling all four disabled strategic workers at once** — enable selectively as decompose breadth
  grows (retrieval-evidence + strategy-synthesis first).

### Named dependencies (not built here; this build consumes / feeds them)

- **Founder-operating wiki pages** (communication-style, decision-log, goals-and-priorities, role,
  preferences-and-constraints, team/relationships — Personal Context Portfolio taxonomy) are
  **authored by OS Engine** (one-writer). This build designs the router/assembly to *consume* a
  modular founder-context set and names the page expansion as an input. First two worth adding:
  `communication-style` (serves compose/voice) and `decision-log` (serves CSO-frame reasoning).
- **Feedback → OS-Engine re-synthesis loop** (Context Hub pattern): agent annotations/feedback on a
  wiki component become a signal OS Engine uses to re-synthesize that component. This build emits the
  signal; OS Engine acts on it (one-writer preserved). Ties to Conflict O3 (the conversation feeder).
- **`wiki_*` → OSE-Layer-1 projection** (from O2 resolution): whether the seven OSE Layer-1 rows are a
  live projection of `wiki_*` or independently authored is **unverified** — an OS-Engine dependency to
  confirm/own. This build does **not** depend on it: Phase 3's composer reads `wiki_*` directly for the
  seven fixed pages. If the projection is confirmed absent, the OSE Layer-1 rows are a legacy read-copy
  the composer bypasses.
- **The `chub` CLI / public docs registry / community-PR model** and the **Portfolio web-app
  interviewer / all ten pages / wiring guides** are **out of scope** — we mine the annotation,
  incremental-fetch, and modular-context *patterns*, not the products.
