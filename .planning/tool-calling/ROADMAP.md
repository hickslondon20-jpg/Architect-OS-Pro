# Roadmap: Advanced Tool Calling & the Shared Capability Layer — ArchitectOS Pro

## Overview

Turns the platform's tools from a small, hardcoded, pre-flight-only set into a **shared, discoverable capability layer** beneath all three intelligence surfaces. Starts with the foundational substrate (model-settings routing + a single tagged usage-event stream), builds the unified tool registry (native + skills + MCP source types, `tool_search`, surface-aware subsetting, citation-ready results), converts the Virtual CSO into a genuine in-thread tool loop, extends the GKE sandbox with a shared exec-channel bridge for programmatic tool calling (Code Mode), scaffolds the MCP client + credential model ("coming soon," no live connectors), then delivers the per-thread degradation % signal + compaction and reload-durable interleaved history. Everything foundational is built surface-generic and wired to Virtual CSO first; Domain Agents inherit it when their live wiring lands in Ep6.

## Process Rules

- **One phase at a time.** Each phase completes fully before the next begins.
- **Alignment checkpoint between phases.** Discuss phase specs and cross-cutting concerns before an execution agent spins up.
- **Verify before building.** Each phase's first move is a live-codebase / live-schema check — most of this platform is already built; verify before rewriting.
- **Reuse before creating.** Before adding a table, bucket, or capability, check whether existing infrastructure (skills, sandbox, KB Explorer, wiki layers, `ai_usage_log`, `agent_capabilities`, `agent_delegation_runs`) already covers it.
- **Keep D1 open.** In Phases 2–4, "the M8 capability registry vs. Ep5 tool registry reconciliation stays reachable both ways" is an acceptance criterion, not an afterthought.
- **Execution agents are separate threads**, each pointed at its phase's plan files, per the GSD framework this build is scoped under.

---

## Phases

- [x] **Phase 1: Foundations — Model Routing & Tagged Usage Events** — Confirm/extend per-capability & utility model routing (Claude-locked primary); establish the single tagged usage-event stream feeding both degradation and metering
- [x] **Phase 2: Unified Tool Registry & `tool_search`** — Neutral-schema registry with native/skill/MCP source types, on-demand discovery, surface-aware subsetting, citation-ready results, D1-neutral
- [x] **Phase 3: Virtual CSO In-Thread Tool Loop** — Convert the single-shot synthesizer into a genuine Claude tool-use loop consuming the registry, streaming preserved, one-writer honored
- [x] **Phase 4: Sandbox Bridge — Code Mode (exec-channel)** — Programmatic tool calling from the GKE sandbox via a shared **exec-channel** bridge (not HTTP — decided 2026-07-03) that is the founder-data security boundary; scoped to already-authorized tools; pod runs with zero network egress
- [x] **Phase 5: MCP Client Scaffold** — MCP as a first-class registry source type + Supabase Vault credential model; OAuth lifecycle stubbed; "coming soon," zero live connectors
- [x] **Phase 6: Degradation Signal & Compaction** — Per-thread "% remaining before degradation" from the main window; context compaction for long threads
- [x] **Phase 7: Interleaved History Rendering** - Reload-durable interleaved tool/sub-agent/code-execution panels; curated trace only; citation-ready persistence

---

## Phase Details

### Phase 1: Foundations — Model Routing & Tagged Usage Events
**Goal:** A stable substrate every later phase builds on — confirmed per-capability/utility model routing (with the primary conversation model Claude-locked) and one tagged usage-event stream that feeds both degradation and the future metering ledger.
**Depends on:** Nothing (extends existing `ai_models`/`platform_ai_settings`/`model_setting_key` and `ai_usage_log`).
**Requirements:** ROUTE-01, ROUTE-02, ROUTE-03, METER-01
**Success Criteria:**
  1. Per-capability/utility model selection resolves through the model-settings registry; the primary conversation model in Virtual CSO and Domain Agents is Claude with no per-thread switching path
  2. A sub-agent, an LLM-powered tool, and a utility job can each be pointed at a different (cheaper/specialized) model via config, without touching the chat model
  3. Every model call emits one usage event tagged `user`, `thread`, `surface`, `model`, `role` (`main`|`sub_agent`|`utility`) — a single stream extending `ai_usage_log`, not a parallel table
  4. The event shape is ledger-ready: account-level metering and quotas can be computed later from these events with no re-plumbing
  5. The tool-calling *loop* is confirmed to run on Claude (cheap models never make the call/interpret decision) — verified against the Phase 3 design intent
**Guardrail:** do not reintroduce "model-agnostic / OpenRouter primary chat." Primary chat is Claude-locked (CONTEXT §1 / L12).

### Phase 2: Unified Tool Registry & `tool_search`
**Goal:** One registry that is the shared capability layer beneath all three surfaces — native, skill, and MCP source types under one neutral schema, with on-demand discovery and surface/context-aware subsetting.
**Depends on:** Phase 1 (model routing for any LLM-powered tools; usage-event tags for tool calls).
**Requirements:** REG-01, REG-02, REG-03, REG-04, REG-05, REG-06
**Success Criteria:**
  1. Tool definitions are stored in a neutral OpenAI-compatible schema with a `source` discriminator (`native`|`skill`|`mcp`) and an executor callable
  2. Ep4 skill packs register as a deferred-loaded source (no parallel skills-only catalog)
  3. A `tool_search` meta-tool returns matching tool definitions on demand; non-discovered deferred tools stay out of context
  4. A consumer can request a subset scoped by surface (and, in shape, by phase — for the Ep6 harness); the registry never returns one flat global list
  5. Tool results carry source identity + verbatim text where applicable (citation-ready), never opaque strings
  6. The design is demonstrably D1-neutral — it can wrap or sit beside `agent_capabilities`; neither "one registry" nor "two layers" is foreclosed (documented, not just asserted)
**Note:** verify how `kb_explorer_service.py` and `agent_capabilities.py` define/dispatch tools today before designing the neutral schema — do not assume the reference's `build_rag_tools()` shape.

### Phase 3: Virtual CSO In-Thread Tool Loop
**Goal:** The Virtual CSO reasons, discovers tools, calls them mid-thread, and continues — a genuine Claude tool-use loop consuming the registry — instead of today's single-shot prompt-assembly with pre-flight sub-agent calls.
**Depends on:** Phase 2 (registry + `tool_search` to consume).
**Requirements:** LOOP-01, LOOP-02, LOOP-03, LOOP-04
**Success Criteria:**
  1. A Virtual CSO turn can call a registry tool mid-generation, feed the result back, and continue reasoning within the same turn
  2. Token-by-token streaming to the browser is preserved via a new FastAPI SSE endpoint — VCSO orchestration moves off the Vercel streaming function onto the Python backend (decided 2026-07-03); curated `step`/`tool` trace events stream live alongside the answer
  3. The Virtual CSO's tool subset is read/compute only — no tool writes to the knowledge base (one-writer honored)
  4. The loop supports both a direct tool call and delegation to a bounded capability sub-agent, built so the D1 boundary is not hard-coded either way
  5. Sub-agent returns fed into the main thread are compact/synthesized (protecting the main window that Phase 6 measures)
**Note:** decide at build-planning whether the existing `shouldCallKbExplorer` heuristic survives as a cheap retrieval-router pre-step or is absorbed into in-loop `tool_search`. This is the phase where the interleaved-history structure (Phase 7) is effectively defined — treat the persisted shape as an output of this phase.
**Architecture (decided 2026-07-03, London sign-off):** VCSO orchestration **moves off the Vercel streaming function onto the Python/FastAPI backend** and streams from there — this phase is full-stack (a port of `chat.ts` + a new FastAPI SSE endpoint + a frontend re-point), split into `03-01` (backend) and `03-02` (frontend). Streamed "thinking" is **curated trace, never raw chain-of-thought (L11)**. The SSE event vocabulary defined here becomes Phase 7's persistence contract. `CLAUDE.md` Rule #1 is updated to record that VCSO streaming now lives in the Python direct-Anthropic lane. See `phases/03-vcso-tool-loop/`.

### Phase 4: Sandbox Bridge — Code Mode (exec-channel)
**Goal:** LLM-generated code in the GKE sandbox can call registry tools programmatically through a shared **exec-channel** bridge — one execution instead of N round-trips — with the bridge as the founder-data security boundary. **Mechanism decided 2026-07-03: exec-channel (Option B), not the reference's HTTP bridge** — the in-pod stub writes a tool-call request file and blocks; the host (already driving the pod over the K8s exec channel) executes the registry tool host-side with credentials and writes the result back. See `phases/04-sandbox-bridge/`.
**Depends on:** Phase 2 (scoped catalog) + Phase 3 (the loop invokes it) + Ep4 sandbox (exists).
**Requirements:** BRIDGE-01, BRIDGE-02, BRIDGE-03, BRIDGE-04, BRIDGE-05, BRIDGE-06
**Success Criteria:**
  1. Code running in a sandbox session can call a registry tool via the bridge and receive its result
  2. The bridge's per-session catalog contains only tools the invoking surface/session is already authorized for — no broader reach
  3. Credentials never enter the sandbox; sandbox code sees only tool results; the pod has **zero network egress** (deny-all NetworkPolicy — no bridge networking needed under the exec-channel mechanism)
  4. Tool results returned through the bridge preserve source identity + verbatim text (citation-ready)
  5. The bridge is exercised by both a Virtual CSO code-to-answer flow and a Domain Agents live-data-into-artifact flow (built shared, even if only VCSO is wired live at beta)
**Note (updated 2026-07-03):** the "GKE bridge networking" fork is **resolved by choosing the exec-channel mechanism** — there is no pod→host networking, no in-cluster bridge service, and no session-token auth to design (the host↔pod trust is the existing authenticated K8s exec channel). The remaining infra item to verify at build-planning is that GKE Autopilot honors a **deny-all egress NetworkPolicy** on sandbox pods. Inherit Ep4's sandbox findings (state lost on Railway restart; in-pod-exec file-copy workaround — the same channel the bridge reuses).

### Phase 5: MCP Client Scaffold
**Goal:** MCP is a first-class registry source type with a real per-user credential model, surfaced "coming soon," so live connectors become an additive later flip — not a re-architecture.
**Depends on:** Phase 2 (source type) + Phase 4 (bridge-callable + shared host-side credential principle).
**Requirements:** MCP-01, MCP-02, MCP-03, MCP-04
**Success Criteria:**
  1. MCP is registered as a first-class registry source type (same catalog, `tool_search`, bridge-callability as native/skill tools)
  2. A per-user credential store exists — Supabase Vault-backed, per-user RLS, service-role-only access; secrets never reach the browser
  3. OAuth lifecycle (refresh/rotation/revocation) is stubbed, not fully implemented, and this is documented as intentional
  4. MCP surfaces as "coming soon"; zero public external connectors are shipped or connectable at beta
**Note:** exact scaffold depth (how much Vault/OAuth machinery is real vs. stubbed) is locked at this phase's build-planning; guard against lifecycle work ballooning into a beta blocker.

### Phase 6: Degradation Signal & Compaction
**Goal:** The founder sees how full *this thread* is before quality degrades, and long threads can be compacted to keep going — the near-term, per-thread half of the §3.4 usage story.
**Depends on:** Phase 1 (tagged event stream) + Phase 3 (the loop defines the main-window contents).
**Requirements:** DEGRADE-01, DEGRADE-02
**Success Criteria:**
  1. A per-thread "% remaining before degradation" signal is computed from the main orchestration window only (filtering tagged events to `role = main` + current context vs. Claude's known window)
  2. Sub-agent internal usage is excluded from the degradation signal (visible to metering, invisible to degradation) — confirming the L13 split by construction
  3. Users see a percentage, not raw tokens or cost
  4. Context compaction condenses a long thread so it can continue before degradation; compaction reclaims context and does not refund cost
  5. Account-level % is confirmed deferred (not built here), with the Phase 1 events already ledger-ready for it
**Guardrail:** do not build the metering ledger, quotas, or tier economics here — deferred (CONTEXT deferred registry).

### Phase 7: Interleaved History Rendering
**Goal:** Reloading or revisiting a thread faithfully reconstructs the rich, interleaved conversation — tool calls, sub-agent panels, and code-execution panels in correct order — as curated trace, not raw reasoning.
**Depends on:** Phase 3 (loop shape settled — **locked ordering**) + Ep4 persistence (`agent_delegation_runs`/`steps`; verify shape) + Phase 4 (code-execution panels exist to render).
**Requirements:** HIST-01, HIST-02, HIST-03
**Success Criteria:**
  1. On reload, tool calls, sub-agent panels, and code-execution panels reconstruct in correct interleaved order (not grouped-then-text)
  2. Rendered trace is curated summary only (steps, tool/source usage, sub-agent progress, evidence) — no raw chain-of-thought (L11)
  3. Persisted records carry source refs so Ep7 citation grounding layers on without a retrofit
  4. Live streaming behavior is unchanged; the improvement is on reload / thread re-entry
**Note:** verify the actual current shape of `agent_delegation_runs`/`agent_delegation_steps` and how Ep4 Phase 2 persisted tool memory before extending — do not assume a no-migration JSONB path carries over.

---

## Progress Tracker

| Phase | Status | Completed |
|---|---|---|
| 1. Foundations — Model Routing & Tagged Usage Events | Done | 2026-07-03 |
| 2. Unified Tool Registry & `tool_search` | Done | 2026-07-03 |
| 3. Virtual CSO In-Thread Tool Loop | Done | 2026-07-03 |
| 4. Sandbox Bridge (Code Mode, exec-channel) | Done | 2026-07-03 |
| 5. MCP Client Scaffold | Done | 2026-07-03 |
| 6. Degradation Signal & Compaction | Done | 2026-07-03 |
| 7. Interleaved History Rendering | Done | 2026-07-03 |

---
*Roadmap created: 2026-07-02 (Ep5 Discuss Phase).*
*7 phases, 25 v1 requirements traced (see REQUIREMENTS.md).*
*Dependency spine: Phase 1 → Phase 2 → {Phase 3 → (Phase 6, Phase 7); Phase 4 → Phase 5}; Phase 7 also depends on Phase 4. Phase 6 depends on Phases 1 + 3.*
*Domain Agents' inheritance of the registry/bridge/event-stream is a forward-looking Ep6 integration note, not a phase here — see CONTEXT.md §8.*
