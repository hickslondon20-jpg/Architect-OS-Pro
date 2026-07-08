# Context: Advanced Tool Calling & the Shared Capability Layer — ArchitectOS Pro

**Written:** 2026-07-02, end of Ep5 Discuss phase
**Audience:** The Orchestration Agent and every Execution Agent that touches this build. This document has no dependency on the conversation that produced it — everything load-bearing is written down here.

> **Canonical sources this build sits under.** Read these before anything here:
> `INTELLIGENCE-LAYER-ARCHITECTURE.md` (the three surfaces, four-tier knowledge layer, one-writer rule)
> and `INTELLIGENCE-LAYER-EPISODE-MAP.md` (§4 Episode 5, §3.1 capability layer + MCP, §3.4 metering,
> §5 locked, §6 deferred). Where the reference PRD (`PRD-Tool-Calls-v2.md`) conflicts with those docs,
> **the canonical docs win.** This build was mapped to our use case, not reverse-engineered from the
> reference series.

---

## Why This Build Exists

ArchitectOS Pro's intelligence layer already lets founders talk to the Virtual CSO, ingest and synthesize documents in the OS Engine, and (soon) produce artifacts through Domain Agents. What it can't do yet is treat **tools as a shared, growing, discoverable capability** rather than a tiny hardcoded set wired into one surface at a time.

Two facts about the *current* state drove the reframe of Episode 5:

1. **The Virtual CSO's main loop injects no tools at all.** `api/vcso/chat.ts` is a single-shot synthesizer: it guesses *before* generating whether to call KB Explorer (`shouldCallKbExplorer`, a keyword heuristic), pre-runs the sandbox only if a `requires_sandbox` skill matched, injects both as text, then streams one completion with no `tools` array. It structurally cannot reason partway, look something up, run a calculation across several documents, and continue — the actual job of a CSO.
2. **Tools that do exist are small, fixed, per-sub-agent lists.** `kb_explorer_service.py` hardcodes 8 tools; the sandbox agent has its own. `agent_capabilities.py` (the M8 registry) governs which *sub-agent* a surface may delegate to, each with an `allowed_tools` list. There is no bloated "14 tools on every call" to eliminate — so the reference's stated problem is largely moot for us today.

Episode 5 is therefore **the episode where the capability layer becomes the shared, discoverable substrate beneath all three surfaces** — the thing that makes the skills-and-plugins area a real, extensible layer instead of a static list, and the thing that lets the Virtual CSO run a genuine tool loop, lets Domain Agents pull live data into artifacts, and lets external services (MCP) eventually plug in through one mechanism.

This is the third intelligence-layer build in the Pro Suite initiative, following the Knowledge Base Explorer (Ep2) and the completed Agent Skills & Document Generation Engine (Ep4, all 7 phases done 2026-07-02). Several Ep5 capabilities extend Ep4 directly.

---

## What This Build Is Not

- **Not a chat-only feature.** The registry is the shared capability layer beneath *all three* surfaces; each pulls a scoped subset. Treating Ep5 as a Virtual-CSO/chat feature is the primary drift to avoid.
- **Not a model-agnostic *primary chat*.** The conversation/orchestration model is **Claude, locked** (`CLAUDE.md`), in both Virtual CSO and Domain Agents. There is no per-thread model switching and no user-facing model dropdown. "Different models for different jobs" is real, but it lives in the per-capability/utility routing that already exists — not in a swappable primary chat.
- **Not a use of Anthropic's native advanced-tool-use primitives.** `tool_search_tool_regex`, `allowed_callers` programmatic tool calling, and `input_examples` are Claude-API-only and incompatible with the cheaper/specialized utility-model layer. We adopt their *design lessons* and implement portably.
- **Not general-purpose sandbox reach.** Code Mode changes *how* an agent invokes the tools it is already authorized for (code loop vs. N round-trips), not *which* tools it can reach. The Ep4 sandbox boundary is preserved.
- **Not a KB writer.** No Virtual CSO or Domain Agent tool writes to the knowledge base. OS Engine is the sole writer (architecture doc §5). Surfaces feed OS Engine via workflows.
- **Not live MCP connectors.** Beta ships the MCP *scaffold* and credential model, surfaced "coming soon," with zero public connections (L7).
- **Not the metering ledger.** Ep5 ships the per-thread degradation % and the tagged usage-event stream that *feeds* a future ledger. The account-level ledger, quotas, tier economics, and admin panel are all deferred.

---

## Every Scope Decision, With Rationale

### 1. Model routing — Claude-locked primary, per-capability/utility routing kept (retire "model-agnostic / OpenRouter")

**Adopt (corrected mid-discussion; codified in map §3.5 / L12).** An earlier framing in this session ("model-agnostic / OpenRouter + per-job routing as first-class Ep5 scope") was **retired** because it overstates the real decision and re-imports reference-series framing that conflicts with the locked stack constraint.

- The **conversation/orchestration model is Claude, locked** — Virtual CSO and Domain Agents. Stack constraint, not an Ep5 decision. No per-thread switching, no dropdown.
- **Per-job routing is legitimate and already exists** — via the Ep4 `ai_models` / `platform_ai_settings` registry plus the M8 capability `model_setting_key`. Sub-agents and LLM-powered helpers may run on cheaper models per capability; utility jobs (embeddings, metadata extraction, title generation, the future Ep7 verifier) run on cheaper/specialized models with no bearing on the chat model. Keep it; name it **"utility/per-capability model routing via the model-settings registry,"** not "model-agnostic OpenRouter."
- **Tool calling is not a cheap-model job.** The decision to call a tool and the interpretation of its result are the orchestration model (Claude). The tool's *execution* is code (often no model). Cheap models live inside specific LLM-powered tools/sub-agents/utility functions — not the tool-calling loop.
- The **retrieval-router pre-step** (intent classification before Claude) may use a cheap classifier or non-LLM heuristics — distinct from in-loop tool calling.
- **Consequence for the degradation signal:** because chat is always Claude, its context window is known and stable — the reference's "static window breaks when the model varies" concern is largely moot for the chat window. Read the window from the model registry as hygiene; do not let it justify a model-agnostic-chat architecture.
- The **neutral OpenAI-compatible tool schema** (§Decision 2) stays useful for utility-model interop, but it is **not** a mandate to make the primary model swappable.

### 2. Unified tool registry — neutral schema, three sources, surface-aware, D1-neutral

**Adapt.** One registry is the shared home for callable capabilities; each surface pulls its relevant subset. It unifies three sources into one layer: **native tools**, **skill packs** (the Ep4 open standard, folded in as deferred-loaded citizens), and **MCP servers** (scaffold). That union *is* the plugins layer.

- **Neutral (OpenAI-compatible) tool schema** as the wire format — today `kb_explorer_service.py` speaks Anthropic's dialect (`input_schema`, `tool_use` blocks); the registry standardizes on the neutral shape and the LLM client adapts per provider, so utility models and future sources interop cleanly.
- **Surface-aware and context-aware subsetting from day one** — not a flat global list. Ep6's harness pulls curated per-phase subsets; each surface pulls its own subset. This is a locked seam (map §4 Ep5 seam 1).
- **Citation-ready result contract** — tools carry source identity + verbatim text, never opaque strings, so Ep7 grounds without a retrofit (map §4 Ep5 seam 3).
- **D1-neutral construction** — the registry can either wrap or sit beside the M8 `agent_capabilities` registry. `agent_capabilities` already carries `allowed_surfaces` + `allowed_tools`, a natural surface-subset hook. Whether the two become one registry or stay two layers is **deferred (D1)**; nothing in this build forecloses either.

### 3. Virtual CSO in-thread tool loop — the architectural centerpiece

**Adapt.** The architecture doc (§4) explicitly wants the Virtual CSO to "spin up sub-agents and invoke tools and skills mid-thread as the conversation requires." Today it doesn't — it's single-shot. This build converts it to a genuine Claude tool-use loop consuming the registry: catalog + `tool_search` in context, tools invoked mid-thread, results fed back and interleaved, **streaming preserved** on the Vercel path.

- The current `shouldCallKbExplorer` heuristic may survive as a cheap **retrieval-router pre-step** that seeds the loop (allowed — distinct from in-loop calling), or be absorbed into in-loop `tool_search`. Which one is a build-planning decision, not settled here.
- **One-writer honored** — the Virtual CSO's tool subset is read/compute only; no KB writes. Any KB change routes through the OS Engine feeder workflow.
- **D1 bites hardest here.** The line between "call a tool directly" and "delegate to a bounded capability sub-agent" must be built to support **both**, so build-planning does not accidentally lock D1 by hard-coding one path. Keeping sub-agent returns synthesized/compact is what protects the main window (see Decision 6).

### 4. Sandbox HTTP bridge (Code Mode) — shared, and the founder-data security boundary

**Adapt.** Extends the Ep4 GKE sandbox so LLM-generated code can call registry tools programmatically via a bridge — one execution instead of N inference round-trips (the "12 P&Ls in a for-loop" case). This is the sharpest scope decision, so the boundary is stated precisely:

- **Code Mode does not expand *which* tools an agent may reach — it changes *how* it reaches the tools it is already authorized for.** The bridge's per-session catalog = exactly the tools that session's surface/capability is already authorized for. This preserves the Ep4 "not general-purpose compute" boundary as a precise amendment, not a reversal.
- **The bridge is the founder-data security boundary** — credentials (service-role Supabase client, API keys, MCP connections) live host-side; sandbox code sees only results; network egress limited to the bridge. Same principle the MCP credential model reuses — one pattern, not two.
- **Shared from the start** — Virtual CSO (code-to-answer mid-chat) and Domain Agents (live data into artifacts). Built shared, wired to Virtual CSO first.
- **Results returned through the bridge are citation-ready** so artifacts/answers built from them stay groundable.
- **The enforcement wiring for "authorized tools" rides on D1** — whether authorization derives from `agent_capabilities.allowed_tools` or a registry-native scope is held open. The *principle* (no new reach, credentials never cross) is firm; the exact wiring is not.
- **GKE networking is deferred to build-planning.** The reference's `host.docker.internal` doesn't exist on Autopilot; the bridge is pod → in-cluster service (or back to Railway) with network policy + session-token auth. Same category as Ep4's Docker→GKE departure. Ep5 also inherits two Ep4 sandbox findings: session state does not survive a Railway restart, and the default K8s file-copy path needed an in-pod-exec workaround (see Ep4 Phase 5/6 notes).

### 5. MCP client — build the shape, stub the lifecycle (scaffold-only, locked)

**Adapt (L7 locked).** MCP is the mechanism to connect the founder's real business tools (QuickBooks/GHL/Notion/CRM) into the intelligence layer — plugins with teeth. At **beta**:

- **Register MCP as a first-class registry source type** — same catalog, `tool_search`, and bridge-callability as native + skill tools.
- **Stand up the credential model** — Supabase Vault-backed encrypted storage, per-user RLS, service-role-only access, secrets never in the browser (the same host-side principle as the bridge).
- **Stub the OAuth lifecycle** (refresh/rotation/revocation) — no live connectors ship, so the lifecycle is scaffolded, not completed. This is *why* MCP is scaffold-only: OAuth lifecycle is real work and a beta blocker if fully built now.
- **Surface "coming soon," zero public connections at beta.**
- **Per-connector live-vs-ingested** (live query-time pull vs. ingest into Tiers 2/3) is a per-connector data-model choice, deferred with the live connectors.
- **Scaffold depth** (how much Vault/OAuth machinery is real vs. stubbed) is locked at build-planning; guard against lifecycle work ballooning into a beta blocker.

### 6. Degradation vs. metering — two systems, one tagged event stream

**Adapt (codified in map §3.4 / L13).** These are related but separate and must not be conflated:

- **Degradation (context fullness)** — per-thread, real-time, the **main orchestration window only** (messages + whatever tool/sub-agent results are fed back into it). Sub-agents run in isolated windows; only their compact returns count. Keeping sub-agent returns synthesized/compact is what protects the main window. Drives the per-thread "% remaining before degradation" signal + compaction.
- **Metering (cost)** — per-user, cumulative, windowed (5-hour / weekly). Sums cost across the **entire tree**: main model + every sub-agent's full internal usage + every LLM-powered tool call + utility jobs. A sub-agent's internal work is invisible to degradation but fully visible to metering.
- **One tagged usage-event stream feeds both.** Every model call emits an event tagged `user`, `thread`, `surface`, `model`, `role` (`main` | `sub_agent` | `utility`). Degradation filters to the main-thread context; metering sums all events in the window. Build **one** event stream — not two plumbing systems. Today's `ai_usage_log` in `chat.ts` is the seed to extend.
- **Compaction reclaims context (helps degradation) but does not refund cost.**
- **Account-level %** is deferred to the ledger; Ep5 ships **per-thread %** and emits the ledger-ready tagged events so account-level adds without re-plumbing.

### 7. Interleaved history — reload-durable, curated trace, sequenced after the loop

**Adopt (adapted).** Continues Ep4's persistent tool memory into reload-durable interleaved rendering of tool calls, sub-agent panels, and code-execution panels. Part of the traceability layer (map §3.2).

- **Curated trace summaries only — never raw chain-of-thought** (L11).
- **Persisted records carry source refs** so Ep7 grounds them.
- **Sequenced after the VCSO tool-loop shape settles** — what gets interleaved depends on the loop; building history rendering first would persist a structure that changes underneath us. Builds on the existing `agent_delegation_runs`/`agent_delegation_steps` shape — **verify that shape before assuming**, per Ep4's own standing note.

### 8. Build for all three surfaces; Virtual CSO first

**Decision (architecture doc Principle 7).** Everything foundational (routing + events, registry, bridge) is built **surface-generic** even though it lands on **Virtual CSO first** (the live surface). Domain Agents *inherit* the same registry + bridge + event stream when their live wiring happens in Ep6 — an adoption, not a rebuild, exactly as Ep4 sequenced skills/sandbox/artifacts. OS Engine gets a lighter touch: its wiki-synthesis ops become registerable/reusable registry entries, and it remains the sole KB writer.

---

## The Governing Principles for Everything in This Build

1. **The registry is the shared capability layer, not a chat feature.** Build every piece to serve all three surfaces (architecture doc Principle 7), even when wired to Virtual CSO first.
2. **Reuse before creating.** Before a new table, bucket, or capability definition, check whether existing infrastructure (skills, sandbox, KB Explorer, wiki layers, `ai_usage_log`, `agent_capabilities`, `agent_delegation_runs`) already covers the need. Ep4's closing instruction applies here too.
3. **Shift work to build time where possible** (architecture doc Principle 2) — but the tool loop is inherently query-time; keep its returns compact to protect the main window.
4. **Everything is traceable** (architecture doc Principle 4) — the citation-ready result contract and curated-trace persistence exist so Ep7 grounds without a retrofit.
5. **Verify before assuming.** Every phase's first move is a live-codebase / live-schema check, per this build's standing verification discipline (see Ep4's STATE.md for how seriously this is taken).

---

## Architectural Decisions Execution Agents Must Not Override

1. **Primary conversation/orchestration model is Claude, locked** — Virtual CSO and Domain Agents. No per-thread model switching, no user-facing model dropdown. Per-capability/utility routing is the only place non-Claude models appear, and never in the tool-calling loop.
2. **Native Anthropic advanced-tool-use primitives are not the mechanism.** Hand-rolled/portable implementation only.
3. **The registry is surface-aware and context-aware** — never a flat global list.
4. **Registry/tool results are citation-ready** (source identity + verbatim text) — never opaque strings.
5. **The bridge is the founder-data security boundary** — credentials host-side, sandbox sees only results, egress limited to the bridge.
6. **Code Mode does not expand tool reach** — the bridge exposes only tools the invoking surface/capability is already authorized for.
7. **One writer** — no Virtual CSO or Domain Agent tool writes to the knowledge base; OS Engine is the sole writer.
8. **MCP is scaffold-only at beta** — source type + credential model + "coming soon"; OAuth lifecycle stubbed; zero live connectors.
9. **One tagged usage-event stream** feeds both degradation and metering — not two systems. Account-level metering is deferred; the tagged events are not.
10. **Interleaved history sequences after the VCSO tool-loop shape settles** — do not persist a structure that will change.
11. **D1 stays open.** Design so "one unified registry" and "two distinct layers" both remain reachable. Do not resolve D1 to ship a phase; treat "keep both reachable" as an acceptance criterion in Phases 2–4.

---

## Deferred Item Registry

See REQUIREMENTS.md v2 table for the authoritative list. In prose:

- **Account-level % metering + the usage ledger + quotas** — deferred to the metering-ledger pass; Ep5 emits the ledger-ready tagged events so it adds without re-plumbing.
- **Tier economics / pricing** — business modeling, not an Ep5 build item.
- **Admin panel** (platform-wide usage, settings, bulk ops) — a separate later pass.
- **Live MCP connectors + full OAuth lifecycle + per-connector live-vs-ingested** — L7; beta is scaffold-only.
- **D1 registry reconciliation** — decide at per-phase build-planning; design for either outcome.
- **GKE bridge networking specifics** — resolved at Phase 4 build-planning (infra detail, not a surfaces question).
- **MCP scaffold depth** — resolved at Phase 5 build-planning.
- **Whether the retrieval-router pre-step survives or is absorbed into in-loop `tool_search`** — resolved at Phase 3 build-planning.

---

## Stack Constraints Recap (unchanged by this build)

- Frontend: React 19 / Vite 6 / TypeScript — no rewrite.
- Primary AI synthesis: **Claude, locked** (Virtual CSO Vercel streaming function; Python-backend direct-Anthropic services per `CLAUDE.md` Rule #1). Per-capability/utility models via the model-settings registry. Never a swappable primary chat.
- Backend for agents/tools: Python/FastAPI on Railway, calling out to the GKE Autopilot sandbox (Ep4). Railway is not replaced.
- Supabase remains the system of record for schema, Storage, RLS, and (new for MCP) Vault-encrypted credentials.
- Beta is founder-only; execution hierarchy stops at Milestone; no team accounts.
