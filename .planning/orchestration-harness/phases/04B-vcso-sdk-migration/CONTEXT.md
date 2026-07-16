# Context: 04B — Proposed VCSO SDK Migration — ArchitectOS Pro

**Written:** 2026-07-15 (day of the Phase 4 restart-2 rollback)
**Status:** PROPOSED — founder-gated. No code, no schema, no flag flips, no root-roadmap edit yet.
**Audience:** The Orchestration Agent and every Execution Agent that would touch this migration. This
document has **no dependency on the conversation that produced it** — everything load-bearing is
written here.

> **Canonical sources this proposal sits under.** Read before anything here:
> `../../../COGNITIVE-ORCHESTRATION-ARCHITECTURE.md` (the North Star — turn lifecycle, three terminal
> modes, bounds), nested under `../../../INTELLIGENCE-LAYER-ARCHITECTURE.md` (three surfaces, four-tier
> knowledge layer, one-writer/feeder rule). Harness spine: `../../CONTEXT.md` (reuse map + governing
> principles + locks), `../../ROADMAP.md` (Phases 0–7 + status), `../../REFERENCES.md`. Platform rule:
> the repo-root `CLAUDE.md`. **Where any of these and this proposal conflict, they win — this proposal
> changes the engine, not the target shape.**

---

## Why this proposal exists

The harness ROADMAP's **Phase 4 (Planner) failed restart 2 on 2026-07-15 and was rolled back**: the
Sonnet decomposition created only one structured-data child and omitted the mandatory sandbox-compute
child. This is the second coordination failure of the hand-rolled decompose→delegate→compose loop
(restart 1 also halted on planner behavior). It is the canonical failure mode Anthropic's multi-agent
research writeup names — a bespoke lead agent misjudging delegation, duplicating or dropping subtasks —
and the one their production system solved by moving to a governed subagent architecture with explicit
delegation contracts.

The strategic goal is unchanged and still correct: make the Virtual CSO a **thought partner**, not a
chatbot or a bare retrieval thread — something that reads the intent and depth of a move, plans,
delegates the token-heavy gathering to cheap bounded workers, and keeps strong judgment on small
pre-chewed inputs, or surfaces the gap and steers. What we now propose to change is the **engine that
runs that shape**: instead of restarting the hand-rolled loop a third time, adopt the Claude Agent SDK
as the loop engine and graduate the existing (flag-gated) planner onto it.

This is validated by four Anthropic sources (see `REFERENCES.md`): *Building Effective Agents*
(agent = LLM + tools in a loop; the loop is the router, not a hard classifier), *Multi-agent research
system* (orchestrator-worker with subagents as context compression; Opus/Sonnet lead + Sonnet/Haiku
workers), *A harness for every task* (dynamic workflows; the exact P4 failure modes — agentic laziness,
self-preferential bias, goal drift — are why single-context loops break), and the *Agent SDK overview*
(the same loop, tools, subagents, sessions, hooks, and MCP that power Claude Code, as a Python library
that runs in-process — consistent with CLAUDE.md Rule #1).

---

## The core decision

**Adopt the Claude Agent SDK (Python) as the Virtual CSO loop engine, migrated strangler-fig: behind a
new feature flag, running in parallel with the hand-rolled path, cut over surface by surface (standard
VCSO → Deep Mode → domain agents), preserving every harness lock.**

Rationale: the SDK is the same loop/tools/subagents/sessions/context-management that power Claude Code,
runs in-process in the existing Python backend (where the key already lives server-side per Rule #1),
and gives — for free and maintained — the subagent delegation, session management, and real streaming
that the harness has been hand-building and that P4 keeps failing to coordinate. The migration is a
**consolidation and upgrade of capabilities already largely built**, not a greenfield rewrite.

---

## Verified current-state findings (live code + Supabase, 2026-07-15)

The registry and loop are **far more built than the MA-06 shorthand implied**. What exists today:

| Surface | Finding |
|---|---|
| VCSO loop | `python-backend/services/vcso_chat_service.py` — **3,155 lines**, incident-hardened, flag-gated. `stream_chat` → `_stream_chat_impl` is an SSE generator (`ready`/`step`/`tool_call`/`tool_result`/`heartbeat`/`sub_agent_step`/`ask_user`/`token`/`context`/`done`). |
| The loop mechanics | Main loop is `for _round_num in range(round_cap)` calling **blocking** `anthropic_client.messages.create(...)` per round (not `.stream`), then marshals `tool_use`/`tool_result` by hand. Step/tool/heartbeat events **are** streamed live; the model's **final prose is not** — it is produced whole then chopped into 160-char pseudo-tokens (`for chunk_start in range(0, len(text), 160)`). |
| Planner | A **flag-gated** `_run_planner_or_none` path already implements orchestrator-worker: spawns workers, collects findings + `worker_run_ids`, composes a cited answer. Gated on Phase-2 `strategic_synthesis + deep` at a confidence threshold. This is the pattern P4 keeps failing to coordinate reliably. |
| Source router | `vcso_source_router.py` (637 lines) — **deterministic, rule-based** cheapest-first tier ladder (Tier 0 records → 1 wiki components → 2 hybrid search → 3 raw docs → 4 live-external **no-op**), chosen by keyword/record-signal patterns. Tier 4 is the deliberate MCP placeholder. |
| Workers | `sub_agent_orchestrator.py` (1,169 lines) — 7 bounded capability handlers (`document_analysis`, `structured_data`, `kb_explorer`, `sandbox_execution`, `per_user_wiki`, `per_user_document_wiki`, `global_ip`) with compact worker contracts + dedup + progress emit → `agent_delegation_runs/steps`. |
| Registry (code) | `tool_registry.py` — full in-process `ToolRegistry`/`ToolDefinition`, three sources (`native`/`skill`/`mcp`), MCP discovery + `read_only` flag, two scope sources (`AgentCapabilityScopeSource` off `agent_capabilities.allowed_tools`, `RegistryNativeScopeSource` off `surface_tags`), `to_anthropic`/`to_openai` emitters. Deep Mode tools already present (`read_todos`/`write_todos`, workspace `list/read/write/edit_file`, `task`, `ask_user`). |
| Registry (DB) | `tool_registry` table (slug, label, description, tool_type, source_ref, enabled, routing_tier, **is_code_registered**, **last_synced_at**) — the code-as-source-of-truth sync mechanism already exists. |
| Connections | `mcp_connections` table (user_id, server_name, transport, config, auth_type, **vault_secret_id**, status, oauth_expires_at, last_error) — per-user auth with the **secret-reference-not-value** pattern already correct (Supabase Vault). `mcp_connections` currently holds 0 live rows. |
| Model routing | `agent_capabilities` (allowed_tools[], routing_tier, model_setting_key, can_spawn_agents) + `ai_models` (cost_tier). Tier authority is at the capability grain (MA-06). |
| Observability | LangSmith via `trace_scope(...)` wrapping the manual call; `log_ai_usage_event` → `ai_usage_log` (separate metering ledger — not this build's concern). |
| Plan surface | `agent_todos` table = the editable Deep Mode plan (the visible right-hand scratchpad data already produced). |

**Net reading:** the SDK's genuine net-new value concentrates in (1) **real token + curated step
streaming** replacing the 160-char fake, (2) **native subagents** with `parent_tool_use_id` + per-agent
model/tools (the P4 fix), (3) **sessions** (resume/fork) overlapping Deep Mode resume-state, and (4) a
**maintained loop** offloading ReAct maintenance. Everything else is already hand-built and hardened —
hence strangler-fig, not rewrite.

---

## The keep / replace / rework ledger

| Current component | Verdict | Note |
|---|---|---|
| Context **selection** IP (working-state memory, tiered router, founder-context portfolio, wiki-component composition, IP layer) | **Keep** | Your differentiator; the SDK has no equivalent (it does not do RAG or know founder tiers). Phase-1 proved it cuts first-call assembled input ~54%. |
| `tool_registry.py` + all executors | **Keep → become SDK-config compiler** | Already emits Anthropic tool specs; extend to emit `ClaudeAgentOptions`. |
| Bounded worker *handlers* (the 7 capabilities) | **Keep** | Become SDK subagent implementations / tools. The work is good; the coordination is what changes. |
| Citations / provenance (`ToolSourceRef`, `agent_context_sources`) | **Keep** | Maps to the CitationAgent pattern; already first-class. |
| Deep Mode plan (`agent_todos`), workspace files | **Keep** | The visible scratchpad; plan tool stays. |
| SSE event schema (`ready`/`step`/`tool_call`/`tool_result`/`token`/`heartbeat`/`ask_user`/`done`) | **Keep as the UI contract** | Normalize the SDK message stream *into* this schema. Producer changes; frontend contract stays. |
| Hand-rolled `for _round_num` loop + `tool_use`/`tool_result` marshalling | **Replace** | This is exactly the SDK loop. |
| 160-char pseudo-token chunking of final prose | **Replace** | SDK real token streaming. The headline UX upgrade. |
| Bespoke sub-agent plumbing (planner futures/heartbeats, generic run/step orchestration) | **Replace** | SDK-native subagents with `parent_tool_use_id`; keep the capability *handlers*. |
| Prompt-packing (`_assemble_prompt` single-string build) + multi-round message lifecycle + Deep Mode resume-state | **Rework** | Onto SDK system-prompt/inputs + sessions + compaction (better + maintained). See context-assembly split below. |
| LangSmith `trace_scope` + `log_ai_usage_event` wrapping the manual call | **Rework** | Move into SDK hooks (`PostToolUse` / lifecycle). The LangSmith standing bar must still be met (traces paired with DB/output checks). |
| `vcso_source_router.py` deterministic ladder | **Rework** | Tiers become tools the agent reasons over; keep a lean deterministic pre-fetch as the cheap first-call fast-path. Rules become hints; effort-scaling decides. |
| Single `self.model` in the main loop | **Rework** | Per-agent/tier model via `routing_tier`→`ai_models`, which the SDK supports per subagent. Tier authority stays at the capability grain (no second selector). |

---

## Context assembly — the split (founder-confirmed)

"Keep context assembly" is a refinement, not a flat keep. The line falls between **deciding** context
and **managing** context:

- **Keep as IP — context *selection* intelligence.** Working-state memory, tiered source router,
  modular founder-context portfolio, wiki-component composition, IP layer. The SDK is *not* better at
  choosing what founder knowledge to put in front of the model — that is the platform's differentiator
  and a proven cost lever.
- **Reposition onto the SDK — context *packing + lifecycle*.** `_assemble_prompt`'s single-string
  build, the manual multi-round message marshalling, `compact_thread`, and the hand-rolled Deep Mode
  resume-state → the SDK's system-prompt + structured inputs + sessions + compaction. The SDK is better
  at *managing* the window and conversation lifecycle across the loop.
- **Bonus shift:** some heavy pre-assembly moves *into* the loop — the agent pulls deeper context via
  the router-as-tools when it needs it — with a lean deterministic pre-fetch kept only as the cheap
  first-call fast-path.

Rule of thumb: **the SDK manages the context window; the platform chooses the founder context.**

---

## Tools & the registry — extend, not build (founder-confirmed)

The five-entity model proposed in design is ~80% already in the ground. Verdicts:

- **Keep:** `tool_registry` (catalog + code-sync), `mcp_connections` (per-user auth + vault ref),
  `agent_capabilities.allowed_tools` (per-agent scoping), `ai_models`/`routing_tier` (tier→model).
- **Extend (three moves):**
  1. **`persistence_semantics`** as a first-class attribute on `tool_registry` (+ `ToolDefinition`):
     `read_only` | `persist_artifact` | `write_external` | `privileged`. Drives guardrails — read-only
     auto-approves; write/privileged require confirmation + the quarantine pattern. Today read-vs-write
     only exists as `read_only` inside code `mcp_metadata`.
  2. **Connector catalog decision.** `mcp_connections` is per-user only; there is no skimmable
     "connectors ArchitectOS supports + which beta week unlocks each." Lean: reuse `feature_registry`
     (already has `beta_unlock_week`) for availability/gating; keep `mcp_connections` as the per-user
     instance. (Alternative: a small `connectors` table. Founder fork — see Open Questions.)
  3. **Tier→model resolver** — confirm how `routing_tier` resolves to an `ai_models` row (explicit map
     vs. code convention) so the registry compiles into per-agent model choice.
- **MCP tools from day one.** External systems (QuickBooks, Asana, Monday, GHL) enter via MCP; internal
  OS-engine data stays in-process. The registry catalogs both uniformly (provenance = `mcp` vs.
  `native`); the agent sees one surface. Curate/normalize third-party MCP tool descriptions to the ACI
  standard in the registry — never expose raw vendor descriptions.
- **The registry compiles the SDK config.** At session start for founder X: `agent_capabilities` grants
  → join `tool_registry` → filter MCP tools to those with an active `mcp_connections` row → resolve
  models via tier map → emit `ClaudeAgentOptions` (`allowed_tools`, `agents`, `mcp_servers`). The
  registry *is* the per-founder SDK-config compiler. `ai_usage_log` stays separate (metering).

---

## Data lifecycle for MCP + sandbox (founder-confirmed)

Default is **ephemeral**; persistence is a **deliberate, explicit** act. Three tiers:

1. **Raw pulled data** (a QuickBooks P&L, a Notion spend report) → ephemeral. Lives in the context
   window / sandbox scratch for the turn; re-fetch via MCP next time. Do not copy a system of record —
   a live copy goes stale.
2. **Sandbox scaffolding** (a text-to-SQL scratch table) → disposable, torn down, **never** in the
   production Supabase schema.
3. **Synthesis / conclusions / deliverables** (the finding, the memo, the recommendation) → the only
   tier persisted, and persisted as a **citeable wiki/artifact with a source pointer**, not a
   normalized copy of the raw payload.

Two deliberate exceptions: **point-in-time snapshots** (immutable, marked as-of-date) tied to a
decision — these are *how trend analysis becomes possible at all*, since live MCP is now-only; and a
**short-TTL cache** for a hot expensive pull. Normalization is **semantic, not storage** — map
"Sales"/"Total Income"/"Revenue" to a canonical concept at reasoning time; do not build a universal
financial warehouse schema. Persistence is a **separate explicit tool** (`persist_artifact` semantics),
never an automatic byproduct of a pull.

**Pinned for later (roadmap/concerns):** MCP as a *second job* beyond live retrieval — an **ingestion
source** that deliberately pushes a snapshot into the OS-engine wiki through the *same source-agnostic
ingestion pipeline* manual uploads use (with a mandatory provenance field). This is the trend spine;
the compiled-truth-over-timeline page shape (adopted from gbrain) carries it. Product prompting (when
to offer/auto-snapshot) is a later conversation. Not in initial scope.

---

## Locks reconciliation (founder-confirmed 2026-07-15)

The harness Governing Principles / Process Rules **hold**, with one clause reframed:

- **Reframed — Principle 7 "Curated transparency; thinking mode stays disabled."** Its real intent was
  *do not surface raw JSON tool payloads / backend plumbing in the UI accordions* — noise that adds no
  insight. It was **not** meant to forbid the streamed, Claude-like step narration we now want. The
  target UX **is** streaming: real answer tokens + drill-down step chips ("searching the P&L…",
  incremental "now I'll…") — but **never** down to the raw JSON sent/received or raw chain-of-thought.
  So: **retire the "thinking off / no visible stream" framing; keep "no raw payloads / no raw CoT in
  the UI."** The 160-char fake stream is deleted; real token streaming replaces it; the transparency
  surface is redesigned to feel native (Claude-like) in the explicit **Phase C2** (streaming surface
  redesign — the migration's first `src/` phase). *Curated, drill-down-but-not-to-raw-code.*
- **Preserved unchanged:** founder isolation; one-writer (orchestrator feeds OS Engine, never writes
  the wiki); bounded, non-recursive, depth-capped sub-agents; per-turn budget/depth caps; everything
  traceable (every insight cites a source); Claude-lock (Sonnet judgment / Haiku workers via the MA-06
  tier map; no non-Claude model for cost); **no founder-facing model selector**; tier authority stays
  at the capability grain (the router selects sources, the tier map selects models — no second
  authority).

Note the tension the SDK migration must respect: the SDK supports interleaved-thinking streaming, but
the "no raw CoT in the UI" lock means we stream the **answer** and **curated steps**, not raw thinking.

---

## Decisions execution agents must not override

1. **Strangler-fig, behind a flag, parallel to the hand-rolled path, cut over surface by surface.**
   Never dark-swap a hardened path. (The harness already gates intent + planner + router this way.)
2. **Keep the SSE event schema as the UI contract;** normalize the SDK message stream into it.
3. **Keep the context-*selection* IP; reposition only packing + lifecycle** onto the SDK.
4. **Registry is extend-not-build;** `ai_usage_log` stays a separate metering ledger.
5. **Preserve every lock** in the reconciliation above; the reframed transparency clause is the only
   change, and it is founder-approved.
6. **Tier authority stays at the capability grain;** no second model-selection authority; no
   founder-facing selector.
7. **Work from live, version-tagged commits, one phase at a time, founder-gated flips** (harness rules).
8. **The North Star wins** on any conflict; this proposal changes the engine, not the target shape.

---

## Open questions / forks to resolve before execution

- **Q1 — Streaming granularity (decisive).** Does the SDK's streaming give true token-level assistant
  text through our SSE transport, or coarser message chunks? A spike must answer this *first*; the whole
  native-feel UX depends on it. If token streaming is clean → easy; if not → design around message-level
  + plan-panel masking.
- **Q2 — Connector catalog shape. RESOLVED 2026-07-15 (London).** For the pilot, gate connector
  availability via `feature_registry` (`beta_unlock_week`) and keep minimal connector config in code +
  `mcp_connections`; **defer a dedicated `connectors` table until connector #2.**
- **Q3 — Sessions vs. Deep Mode resume-state.** How much of the hand-rolled resume-state the SDK session
  layer subsumes vs. must coexist with (the `ask_user` pause/resume already persists to `agent_todos` +
  deep-resume state).
- **Q4 — Hooks ↔ LangSmith parity.** Confirm SDK hooks emit trace granularity that satisfies the
  standing bar (traces paired with DB/output checks), before depending on the abstraction.
- **Q5 — Planner graduation.** Whether the existing flag-gated `_run_planner_or_none` is refactored onto
  SDK subagents or retired in favor of SDK-native decomposition. (It is the P4 mechanism; the SDK is the
  proposed fix for its coordination defect.)

---

## Named dependencies (consumed/fed, not built here)

- **OS Engine ingestion pipeline** (source-agnostic) for the MCP-snapshot-into-wiki path; one-writer
  preserved — this build *feeds*, never writes the wiki.
- **Founder-operating wiki pages** (Personal Context Portfolio taxonomy) — authored by OS Engine; the
  context-selection layer consumes them.
- **MA-06 tier map** authority (`routing_tier`→`ai_models`) — reused, not duplicated.
