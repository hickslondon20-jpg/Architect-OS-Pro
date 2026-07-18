# Roadmap: 04B — Proposed VCSO SDK Migration — ArchitectOS Pro

**Status: PHASE D CHECKPOINT BLOCKED — native worker permission failed live proof; returned to London.**
Phase D implementation is deployed through v0.6.50, but the 2026-07-16 exact-anchor canary created
zero child rows because the SDK session denied all three handler-backed native worker tools. The
parent hit its six-turn cap and persisted a safe failure. `vcso_sdk_loop` and the retired
`vcso_planner` are dark and unenrolled; Phase E has not started. Evidence:
`04B-D-COMPLETION.md`. Read `CONTEXT.md` first. The harness root `ROADMAP.md` is **not** edited until the separately
founder-gated Phase G roadmap update.

## Overview

Migrate the Virtual CSO turn engine from its hand-rolled agentic loop onto the **Claude Agent SDK**,
**strangler-fig**: a new dark feature flag runs the SDK path in parallel with the live hand-rolled
path; each surface is proven at canary parity before cutover; the hand-rolled path is retired only
after parallel-run parity. The migration **consolidates and upgrades** capabilities already built — it
does not rebuild retrieval, the registry, the workers, or transparency. It preserves every harness lock
(with the one founder-approved transparency reframing in `CONTEXT.md`). Cost, quality, and UX stay
co-equal gates throughout.

**Baseline:** post-P4-rollback (harness ~v0.6.26). This workstream produces its own version-tagged
commits per `CLAUDE.md`. **Decisive unknown gated first:** SDK token-streaming granularity (Q1).

## Process rules

1. **Spike the decisive unknown first.** Phase A proves SDK token streaming through the SSE transport
   before any migration commitment. If it fails, the UX plan changes before code does.
2. **Strangler-fig, never dark-swap.** New SDK path behind a flag, parallel to the hand-rolled path,
   canary-first, cut over surface by surface (standard VCSO → Deep Mode → domain agents). Retire the old
   path only on parallel-run parity evidence.
3. **Normalize, don't couple.** The SDK message stream is normalized into the existing SSE event schema
   (the UI contract). The frontend does not learn the SDK.
4. **Research first, per phase.** Each phase opens with a live code/schema check; write a short findings
   note before wiring. Most substrate exists — default action is compose/wire, not rebuild.
5. **Observability rides hooks.** LangSmith traces + `ai_usage_log` move onto SDK hooks; the standing
   bar holds — traces paired with DB/output checks, necessary but not sufficient.
6. **Keep selection IP; reposition packing + lifecycle.** Never let the SDK own context *selection*.
7. **Preserve the locks** (`CONTEXT.md` reconciliation). Founder isolation, one-writer, bounded
   non-recursive sub-agents, budget/depth caps, traceability, Claude-lock, no model selector, tier
   authority at the capability grain. Reframed transparency clause is the only change.
8. **Work from live; one phase at a time; founder-gated flips.** `main` → auto-deploy → verify on
   `architectospro.com` / `api.architectospro.com`; version-tagged commits; do not batch phases.
9. **The North Star wins** on any conflict; this changes the engine, not the target shape.

## Phases

| # | Phase | Gate |
|---|---|---|
| A | Streaming spike + SDK proof-of-loop | Real token stream renders natively through SSE on one trivial VCSO turn (dark flag); a hook emits a LangSmith trace paired to a usage row. **Resolves Q1.** |
| B | SDK loop for standard VCSO (parallel) | One real standard VCSO turn end-to-end on the SDK path (canary founder), SSE contract unchanged, 160-char fake deleted, matched-set cost/quality at parity-or-better, traces paired to usage rows. |
| C | Registry → SDK-config compiler + extensions | Per-founder `ClaudeAgentOptions` compiled from `tool_registry` × `agent_capabilities` × active `mcp_connections`; `persistence_semantics` live and enforcing read-only-vs-write guardrails; tier→model resolver resolved (Q2 resolved — see detail). |
| C2 | Streaming surface redesign (UI/UX) | The transparency/streaming surface matches the target screenshots: token-by-token answer + streamed curated narration, drill-down step chips (not blocky accordions), living right-hand plan panel. Visual-only against the stable SSE schema (one normalizer tweak). The migration's first `src/` phase. |
| D | Native subagents — the P4 re-approach | The P4 thin-slice strategic question decomposes **correctly** (spawns the mandatory structured-data **and** sandbox children), plan + workers visible via MA-05, correct tiers, budget/depth caps enforced. **STOP-and-review checkpoint** — the one P4 never reached. **Delegation plumbing proven via Path A (interim); model-driven delegation moved to D2.** |
| D2 | Model-driven delegation (restore reasoning-driven worker selection) | The **lead** reasons the decomposition and delegates via `Task` (worker tools scoped invisible to the lead), not the app deterministically; workers run, sandbox fires (working smoke), effort-scaling + delegation contracts, coverage safety-net retained. Restores the migration's intent after Path A proved the plumbing. **STOP-and-review checkpoint.** |
| E | Sessions + Deep Mode reconciliation | A Deep Mode thread pauses on `ask_user` and resumes with full context via SDK sessions; `agent_todos` plan + workspace persist with no double-bookkeeping against resume-state. |
| F | First live MCP (QuickBooks) | Live QuickBooks P&L pull through a bounded worker, cited, **read-only**, founder-scoped via vault auth, ephemeral; freshness policy chose the live source; write/privileged blocked at runtime. Ties to harness Phase 5. |
| G | Generalize, verify, cut over | Co-equal gates proven on live (cost ↓ vs. baseline, cited CFO/CSO quality, native legible UX, safety under adversarial prompts); hand-rolled path retired on parity; harness root `ROADMAP.md` updated (founder-gated). |

## Phase detail

### Phase A — Streaming spike + SDK proof-of-loop
De-risk the one thing the whole UX depends on. Stand up a minimal Agent SDK `query()` loop in the
Python backend behind a dark flag; run one trivial VCSO turn; prove **real token-level assistant
streaming** and **curated step events** flow through the existing SSE transport and render natively.
Wire one `PostToolUse`/lifecycle hook to emit a LangSmith trace paired to an `ai_usage_log` row.
**Output:** a go/no-go on token streaming (Q1) and a proven observability seam. If token streaming is
not clean, redesign the UX around message-level streaming + plan-panel masking before Phase B.

### Phase B — SDK loop for standard VCSO (parallel)
Route standard (non-Deep, non-planner) VCSO turns through the SDK loop behind the flag, parallel to the
hand-rolled path. Keep the context-*selection* pre-assembly (working state + tiered router + wiki
components) feeding the SDK **system prompt + inputs**; hand message-list, `tool_result` accumulation,
and compaction to the SDK. Build the **normalizer**: SDK messages → the existing SSE schema
(`ready`/`step`/`tool_call`/`tool_result`/`token`/`heartbeat`/`done`). Delete the 160-char chunker.
Move `trace_scope` + `log_ai_usage_event` onto hooks. **Gate:** canary parity on a matched
authenticated control/canary set (cost + quality), SSE contract byte-stable for the frontend.

### Phase C — Registry → SDK-config compiler + extensions
Make the registry compile the per-founder SDK config. Add `persistence_semantics`
(`read_only`/`persist_artifact`/`write_external`/`privileged`) to `tool_registry` + `ToolDefinition`
and enforce the guardrail (read-only auto-approves; write/privileged confirm + quarantine). Resolve the
tier→model resolver. **Q2 resolved (2026-07-15):** for the pilot, gate connector availability via
`feature_registry` (`beta_unlock_week`) and keep minimal connector config in code + `mcp_connections`;
**defer a dedicated `connectors` table until connector #2.** Emit `ClaudeAgentOptions`
(`allowed_tools`, `agents`, `mcp_servers`) from
`agent_capabilities` × `tool_registry` × active `mcp_connections`. Curate any third-party MCP tool
descriptions to the ACI standard. **Gate:** generated options scope correctly per founder; per-agent
tool grants hold; guardrail enforced; `ai_usage_log` untouched.

### Phase C2 — Streaming Surface Redesign (UI/UX)
The migration's **first `src/` phase** and its first explicit UX phase. Phases A–B upgraded the *data*
(real tokens + curated steps over the stable SSE schema) but reused the old MA-05 transparency
components, so the surface still feels blocky and templated. C2 redesigns the frontend that consumes the
stable event stream to match the approved screenshots: **token-by-token streaming of the answer *and*
the curated interstitial narration** (the "now I'll…" lines — curated, never raw CoT), **drill-down
step chips** instead of heavy accordions, and the **living right-hand plan/scratchpad panel**. One small
backend piece: ensure the normalizer streams interstitial assistant narration as tokens rather than
folding it into blocky step summaries. **Visual-only otherwise** — no change to loop logic, retrieval,
registry, or the SSE contract. Sequenced after C so the config work is settled; extends as D (subagent
steps) and E (Deep Mode plan) enrich the event stream. **Gate:** the surface matches the approved
screenshots on the canary; no backend logic regressed; SSE contract byte-stable; locks intact (no raw
payloads / no raw CoT).

### Phase D — Native subagents (the P4 re-approach)
Replace the planner futures/heartbeats and generic orchestration plumbing with **SDK-native
subagents** (per-agent tools + model, `parent_tool_use_id`); keep the 7 capability *handlers* as the
subagent implementations. Encode **effort-scaling** in the lead prompt (scale to query complexity;
simple turns answer directly; teach the orchestrator how to delegate with explicit task contracts —
the fix for the exact P4 defect). Enforce per-turn budget + depth cap; one controlled level of
sub-delegation, no recursion. **Prove on the P4 thin-slice question end-to-end** — the decomposition
must spawn the mandatory structured-data **and** sandbox children — plan + workers visible via MA-05,
correct tiers. **STOP-and-review checkpoint with the founder before broadening.**

### Phase D2 — Model-Driven Delegation (restore reasoning-driven worker selection)
Path A (Phase D, v0.6.57–59) proved the delegation **plumbing** end-to-end but did it by **removing
model-driven delegation** — the app deterministically runs a fixed worker set and the SDK lead only
composes, which does not generalize and inverts the migration's purpose. D2 restores it: the **lead
reasons** the decomposition and delegates via `Task`, with the worker tools scoped **invisible to the
lead** (the tool-visibility trap from handoff §17 — resolved via an external/scoped MCP server) so the
lead *must* delegate. Reuses the `SubAgentOrchestrator` handlers and every proven Path-A asset (sandbox
wiring, nested UI, tiers, traces). Keeps Path A's deterministic guarantee as a **safety-net** (stop-hook
catches a clearly-missing mandatory child) and adds **effort-scaling + explicit delegation contracts**.
**Research the SDK source before building;** Path A stays the dark fallback until D2 is proven at parity.
Sandbox real computation stays deferred (financial-series storage + MCP, Phase F). **Gate:** the lead
(not the app) reasons and delegates; workers run; sandbox fires (working smoke); nested UI + traces +
tiers intact; **STOP-and-review checkpoint.** Full plan: `04B-D2-PLAN.md`.

### Phase E — Sessions + Deep Mode reconciliation
Map SDK **sessions** (resume/fork) onto Deep Mode: the `ask_user` pause/resume, the `agent_todos`
editable plan, and workspace files. Reconcile so there is a single source of truth for resume state
(not the hand-rolled deep-resume alongside SDK sessions). **Gate:** a Deep Mode thread pauses on
`ask_user`, resumes with full context via the SDK session, plan + workspace intact, no double
bookkeeping.

### Phase F — First live MCP (QuickBooks)
Land the first connector end-to-end (harness Phase 5's live-source objective). Per-user OAuth via
`mcp_connections` + Vault; the SDK `mcp_servers` config from the registry; a **read-only** ephemeral
P&L pull through a bounded worker returning a compact cited finding; the freshness/authority policy
chooses live-vs-wiki. Apply the data-lifecycle principle (ephemeral pull; no raw persistence; snapshot
only on deliberate ingestion). **Gate:** live cited pull, founder-scoped, read-only; write/privileged
blocked at the runtime; secrets never in a row.

### Phase G — Generalize, verify, cut over
Extend the SDK path across question types, then Deep Mode, then domain agents. Prove the co-equal gates
on live: **cost** (smaller synthesis context vs. baseline), **quality** (cited CFO/CSO answers),
**UX** (native legible plan/steps + real streaming + partner-like steer), **safety** (isolation,
budgets, runtime-enforced policy under adversarial prompts) — traces paired with DB/output checks.
Retire the hand-rolled loop **only** on parallel-run parity evidence. Then thread 04B into the harness
root `ROADMAP.md` (founder-gated).

## Registry extensions (Phase C detail)

| Move | Change | Drives |
|---|---|---|
| `persistence_semantics` | New attribute on `tool_registry` + `ToolDefinition`: `read_only`/`persist_artifact`/`write_external`/`privileged` | Guardrails: auto-approve reads; confirm + quarantine writes; never move money |
| Connector catalog (Q2 — resolved) | Pilot: gate via `feature_registry` (`beta_unlock_week`); connector config in code + `mcp_connections`. Defer a `connectors` table until connector #2 | Skimmable availability + gating; SDK `mcp_servers` compile |
| Tier→model resolver | Confirm/formalize `routing_tier`→`ai_models` resolution | Per-agent model in compiled SDK options; tier authority stays at capability grain |

## Relationship to harness Phases 4–7

- **Phases 0–3 (reconciliation, working-state, intent read, source router):** unchanged and reused —
  they are the context-*selection* IP this migration keeps. Their live-dark/canary status is unaffected.
- **Phase 4 (Planner):** **re-approached** by 04B Phases A–D. The hand-rolled planner is the mechanism
  that failed restart 2; SDK-native subagents are the proposed fix. 04B Phase D is the new thin-slice
  proof + stop-and-review that supersedes the P4 restart.
- **Phase 5 (Reflect-and-steer + freshness + first MCP):** 04B Phase F delivers the first live MCP on
  the SDK path; reflect-and-steer is preserved as a first-class terminal mode inside the SDK loop.
- **Phases 6–7 (generalize + verify):** 04B Phase G, on the SDK engine.
- **Native legible UX** — previously folded into Phase G's gate; now **built explicitly in Phase C2**
  (streaming surface redesign) and only *verified* in G.

## Progress tracker

| Phase | Status | Completed |
|---|---|---|
| A. Streaming spike + SDK proof-of-loop | **Done — GO at London checkpoint** | 2026-07-15 |
| B. SDK loop for standard VCSO (parallel) | **Done — matched canary parity proven** | 2026-07-15 |
| C. Registry → SDK-config compiler + extensions | **Done — live-dark; guardrail/compiler gate passed** | 2026-07-15 |
| C2. Streaming surface redesign (UI/UX) | **Done — live canary + reload gate passed; flag dark** | 2026-07-15 |
| D. Native subagents — P4 re-approach (checkpoint) | **Delegation plumbing proven via Path A (interim, v0.6.57–59); flag dark** | 2026-07-16 |
| D2. Model-driven delegation (restore reasoning-driven selection) | **SDK-M1 done + approved. Pre-fix (b) applied (pending host commit v0.6.60); pre-fix (a) runbook ready. SDK-M2 fully implemented + compile-clean across 7 files (core, FastMCP transport, main.py mount, config external-per-agent rewire, loop model-driven branch behind `native_model_driven` incl. token/scope, PreToolUse hooks, DB completion bridge, inverted-manifest abort, unregister; flag read+founder-scoped in vcso_chat_service; unit tests for core/config/helpers). Path A byte-identical when flag off. Remaining (venv only): a `_run_sdk_turn` model-driven test + run focused suite + FastMCP local-serve check + confirm Railway PORT/base URL → then the cheap one-worker probe. Nothing committed/deployed; all dark.** | — |
| E. Sessions + Deep Mode reconciliation | **Proposed — not started** | — |
| F. First live MCP (QuickBooks) | **Proposed — not started** | — |
| G. Generalize, verify, cut over | **Proposed — not started** | — |

**Status key:** Proposed · In analysis · Plan written · In execution · Done · Deferred
**Approval gate:** the entire workstream is founder-gated. Nothing here executes, and the harness root
`ROADMAP.md` is not edited, until London approves this proposal.
