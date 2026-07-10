# Requirements: Advanced Tool Calling & the Shared Capability Layer — ArchitectOS Pro

**Defined:** 2026-07-02 (Ep5 Discuss Phase)
**Core Value:** The platform's tools stop being a small, hardcoded, pre-flight-only set and become a **shared, discoverable capability layer** that all three intelligence surfaces (Virtual CSO, OS Engine, Domain Agents) draw a scoped subset from — with on-demand tool discovery, programmatic (code-mode) execution against founder data through a secure bridge, an MCP on-ramp for external services, and per-thread usage visibility. This is the episode that makes the skills-and-plugins area a real extensible layer rather than a static list.

> Read `INTELLIGENCE-LAYER-ARCHITECTURE.md` and `INTELLIGENCE-LAYER-EPISODE-MAP.md` (§4 Ep5, §3.1, §3.4, §5 locked, §6 deferred) before this file. Where the reference PRD (`PRD-Tool-Calls-v2.md`) and those canonical docs conflict, the canonical docs win. This build is mapped to our use case, not reverse-engineered from the reference series.

---

## Adaptation Notes (vs. Reference Ep5)

| Reference Element | ArchitectOS Decision |
|---|---|
| Episode 5 = "make tool-calling dynamic + add MCP" (a chat/agent feature) | **REFRAMED** — Ep5 is where the **capability layer becomes the shared, discoverable substrate beneath all three surfaces**. The registry is not a chat feature; each surface pulls a scoped subset. |
| Native Anthropic advanced-tool-use primitives (`tool_search_tool_regex`, `allowed_callers` PTC, `input_examples`) | **NOT USED as mechanism** — hand-rolled/portable implementation, mined for design lessons only. The primitives are Claude-API-only; our utility/sub-agent layer runs cheaper/specialized models per capability, so the tool schema is the neutral OpenAI-compatible shape. Primary conversation model stays **Claude-locked** (`CLAUDE.md`) — no model-agnostic *primary chat*. |
| "Static hardcoded tool injection is expensive, sent on every call" (problem statement) | **PARTIALLY MOOT for us** — the Virtual CSO's main loop today injects **no** tools; sub-agents (`kb_explorer_service.py`) carry small fixed lists. The registry's value is future scale (skills + MCP), surface-scoped subsetting, and enabling a real VCSO tool loop — not eliminating a bloated 14-tool call that doesn't exist yet. |
| Skills as a separate skills-only mechanism (Ep4) | **FOLDED IN** — Ep4 skill packs become deferred-loaded **registry citizens** (a source type), resolving the Ep4 "registerable source" seam. Native + skills + MCP union *is* the plugins layer. |
| Code Mode / PTC runs in Anthropic's server-side sandbox | **REPLACED** — programmatic tool calling runs in **our GKE Autopilot sandbox** via a self-hosted HTTP bridge, because founder data must stay ours (credentials host-side, sandbox sees only results) and the GKE sandbox already exists from Ep4. |
| Bridge assumes local Docker `host.docker.internal` networking | **REPLACED** — GKE Autopilot has no Docker host; bridge is pod → in-cluster service (or back to Railway) with network policy + session-token auth. Same category of departure as Ep4's Docker→GKE decision. Exact networking design deferred to build-planning. |
| MCP Client = live external connections (GitHub/Slack/etc.) | **SCAFFOLD-ONLY (locked, L7)** — register MCP as a first-class registry source type + stand up the credential model (Supabase Vault, per-user RLS, service-role-only); **stub** OAuth lifecycle; surface "coming soon"; **zero public connectors at beta**. |
| Context Window Indicator = raw token progress bar, static `LLM_CONTEXT_WINDOW` env var | **REFRAMED to % signal (§3.4)** — per-thread "% remaining before degradation." Chat is Claude-locked so its window is known/stable (read from the model registry as hygiene). Paired with context compaction. Account-level % deferred to the metering ledger. |
| Chat History Interleaved Rendering = independent, any order | **DEPENDENT for us** — reload-durable interleaved history sequences **after** the VCSO tool-loop shape settles, so we don't persist a structure that changes underneath us. Curated trace only, never raw chain-of-thought (L11). |
| Usage captured only for the context bar | **RE-SCOPED as one tagged event stream (§3.4 / L13)** — a single usage-event stream tagged `user/thread/surface/model/role` feeds **both** degradation (filter to `main`) and the future metering ledger (sum all), built once. |

---

## v1 Requirements

### Foundations — Model Routing & Usage Events

- [ ] **ROUTE-01**: Per-capability / utility model routing is confirmed and extended via the existing model-settings registry (`ai_models` / `platform_ai_settings` + capability `model_setting_key`). The **primary conversation/orchestration model is Claude-locked** in Virtual CSO and Domain Agents — no per-thread model switching, no user-facing model dropdown.
- [ ] **ROUTE-02**: Cheaper/specialized models are selectable only *inside* specific LLM-powered tools, sub-agents, and utility jobs (embeddings, metadata extraction, title generation, future Ep7 verifier) — never in the in-loop tool-calling decision, which is the Claude orchestration model.
- [ ] **ROUTE-03**: The retrieval-router pre-step (intent classification before the Claude loop) may use a cheap classifier or non-LLM heuristics — distinct from in-loop tool calling.
- [ ] **METER-01**: A single tagged usage-event stream (extending today's `ai_usage_log`) emits one event per model call, tagged `user`, `thread`, `surface`, `model`, and `role` (`main` | `sub_agent` | `utility`), in a ledger-ready shape so account-level metering adds later without re-plumbing.

### Unified Tool Registry & Discovery

- [ ] **REG-01**: A unified tool registry stores tool definitions in a **neutral OpenAI-compatible schema** with a `source` discriminator (`native` | `skill` | `mcp`) and an executor callable.
- [ ] **REG-02**: Ep4 skill packs register into the registry as a deferred-loaded source (resolves the Ep4 "registerable source" seam — no parallel skills-only catalog).
- [ ] **REG-03**: A `tool_search` meta-tool returns matching tool definitions (name + schema) on demand; only always-on tools + previously-discovered tools are in context otherwise.
- [ ] **REG-04**: The registry is **surface-aware and context-aware** — every consumer pulls a scoped subset (per surface, and per phase for the Ep6 harness). Not a flat global list.
- [ ] **REG-05**: Registry/tool results are **citation-ready** — they carry source identity + verbatim source text where applicable, never opaque strings (Ep7 depends on this).
- [ ] **REG-06**: The registry is built **D1-neutral** — it can either wrap or sit beside the M8 `agent_capabilities` registry; nothing forecloses either resolution of the one-registry-vs-two-layers question.

### Virtual CSO In-Thread Tool Loop

- [ ] **LOOP-01**: The Virtual CSO runs a genuine in-thread Claude tool-use loop — catalog + `tool_search` in context, tools invoked mid-thread, results fed back and interleaved — replacing today's single-shot prompt-assembly + pre-flight sub-agent calls.
- [ ] **LOOP-02**: The Vercel streaming path is preserved (token-by-token streaming to the browser continues to work).
- [ ] **LOOP-03**: **One-writer honored** — the Virtual CSO's tool subset is read/compute only; no tool writes to the knowledge base. Any KB change still routes through the OS Engine feeder workflow.
- [ ] **LOOP-04**: The loop supports **both** direct tool calls and delegation to a bounded capability sub-agent, built so the D1 boundary stays undecided (no hard-coding of one path).

### Sandbox HTTP Bridge (Code Mode)

- [ ] **BRIDGE-01**: LLM-generated code in the GKE sandbox can call registry tools via an HTTP bridge (programmatic tool calling — one execution instead of N inference round-trips).
- [ ] **BRIDGE-02**: The bridge exposes a **per-session scoped catalog = only the tools the invoking surface/session is already authorized for** (no new reach; efficient invocation of already-permitted tools).
- [ ] **BRIDGE-03**: Credentials (Supabase service-role client, API keys, MCP connections) live host-side; sandbox code sees only tool results, never credentials.
- [ ] **BRIDGE-04**: The sandbox's network egress is limited to the bridge endpoint.
- [ ] **BRIDGE-05**: Tool results returned through the bridge are citation-ready (source identity + verbatim text preserved), so answers and artifacts built from them stay groundable (Ep7).
- [ ] **BRIDGE-06**: The bridge is **shared infrastructure** — used by Virtual CSO (code-to-answer mid-chat) and Domain Agents (live data into artifact generation), built shared from the start.

### MCP Client Scaffold

- [ ] **MCP-01**: MCP is registered as a first-class registry **source type** (same catalog, same `tool_search`, same bridge-callability as native + skill tools).
- [ ] **MCP-02**: A per-user credential model is stood up — Supabase Vault-backed encrypted storage, per-user RLS, service-role-only access; secrets never reach the browser.
- [ ] **MCP-03**: OAuth lifecycle (refresh / rotation / revocation) is **stubbed**, not fully implemented — no live connectors ship, so the lifecycle work is scaffolded, not completed.
- [ ] **MCP-04**: MCP is surfaced as **"coming soon"** with **zero public external connections** at beta launch.

### Degradation Signal & Compaction

- [ ] **DEGRADE-01**: A per-thread "% remaining before degradation" signal is derived from the main orchestration window only (messages + compact tool/sub-agent returns fed back into it), reading Claude's known/stable context window from the model registry.
- [ ] **DEGRADE-02**: Context compaction condenses a long thread so it can keep going before degradation — reclaiming context, not refunding cost.

### Interleaved History Rendering

- [ ] **HIST-01**: Chat history reconstructs tool calls, sub-agent panels, and code-execution panels in correct interleaved order across page reload / thread re-entry.
- [ ] **HIST-02**: "Show the thinking" is **curated trace summaries only** (steps, tool/source usage, sub-agent progress, evidence) — never raw chain-of-thought (L11).
- [ ] **HIST-03**: Persisted records carry source refs so Ep7 citation grounding layers on without a retrofit.

---

## v2 Requirements (Deferred)

| Requirement | Description | Deferred reason |
|---|---|---|
| METER-LEDGER-01 | Account-level "% of weekly/rolling-window allotment remaining"; the per-user usage ledger aggregating cost across all intelligence surfaces; rolling-window + weekly cap enforcement with graceful degradation | §3.4 flags the ledger/quotas as later. Ep5 emits the ledger-ready tagged events (METER-01) so this adds without re-plumbing. |
| TIER-ECON-01 | Subscription tier economics / pricing modeling (candidate ladders floated, not locked) | Business modeling, not an Ep5 build item. |
| ADMIN-PANEL-01 | Platform-wide usage visibility, platform-wide settings, bulk operations (e.g. bulk-adding skills/connectors) | Explicitly a separate admin pass (§3.4). |
| MCP-LIVE-01 | Live external MCP connections (GHL / Notion / QuickBooks / CRM) + full OAuth lifecycle (refresh/rotation/revocation) + per-connector live-vs-ingested data model | L7: scaffold-only at beta; live connections are their own lift and a beta blocker if attempted now. |
| REGISTRY-UNIFY-01 | Definitive resolution of D1 (M8 `agent_capabilities` registry and the Ep5 tool registry as one unified registry vs. two distinct layers) | D1: directional (lean: two layers); definitive call deferred to this episode's per-phase build-planning. Design keeps both reachable. |

---

## Out of Scope

| Feature | Reason |
|---|---|
| Model-agnostic / swappable **primary conversation** model; OpenRouter for the chat/orchestration loop | `CLAUDE.md` stack constraint: Claude, never swapped for OpenAI-compatible, for the conversation/orchestration model. Per-capability/utility routing (ROUTE-01/02) is the legitimate, already-existing form of "different models for different jobs" — not a swappable primary chat. |
| Native Anthropic advanced-tool-use primitives as the implementation mechanism | Claude-API-only; incompatible with the cheaper/specialized utility-model layer. Design lessons adopted; the mechanism is hand-rolled/portable. |
| Live external MCP connectors at beta | L7 — scaffold + "coming soon" only. |
| Team / multi-user tool or connector sharing | Beta is founder-only; no team accounts exist. |
| Giving the sandbox general-purpose tool reach | Ep4 boundary preserved — the bridge exposes only tools the invoking capability/surface is already authorized for (BRIDGE-02). Code Mode changes *how* authorized tools are called, not *which* tools are reachable. |
| Any surface other than OS Engine writing to the knowledge base | One-writer rule (architecture doc §5). VCSO/Domain Agent tool subsets are read/compute only (LOOP-03). |

---

## Requirement Traceability

| Requirement | Phase |
|---|---|
| ROUTE-01, ROUTE-02, ROUTE-03, METER-01 | Phase 1 |
| REG-01, REG-02, REG-03, REG-04, REG-05, REG-06 | Phase 2 |
| LOOP-01, LOOP-02, LOOP-03, LOOP-04 | Phase 3 |
| BRIDGE-01, BRIDGE-02, BRIDGE-03, BRIDGE-04, BRIDGE-05, BRIDGE-06 | Phase 4 |
| MCP-01, MCP-02, MCP-03, MCP-04 | Phase 5 |
| DEGRADE-01, DEGRADE-02 | Phase 6 |
| HIST-01, HIST-02, HIST-03 | Phase 7 |

---
*Requirements defined: 2026-07-02 (Ep5 Discuss Phase).*
*Adapted from Episode 5 reference (`PRD-Tool-Calls-v2.md`) and mapped to our use case per `INTELLIGENCE-LAYER-ARCHITECTURE.md` + `INTELLIGENCE-LAYER-EPISODE-MAP.md`: registry reframed as the shared capability layer beneath all three surfaces; native Anthropic primitives dropped as mechanism in favor of a portable hand-rolled implementation; primary conversation model Claude-locked with per-capability/utility routing kept; Code Mode moved onto the GKE sandbox bridge; MCP scaffold-only at beta; context indicator reframed to a per-thread degradation % fed by a single tagged usage-event stream.*
*Held open per D1 (map §6): the M8 capability registry vs. Ep5 tool registry reconciliation — design for either outcome; decide at per-phase build-planning.*
