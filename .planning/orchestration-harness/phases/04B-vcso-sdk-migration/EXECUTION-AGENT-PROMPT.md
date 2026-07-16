# Execution Agent Brief — 04B: VCSO SDK Migration

You are the Execution Agent for **sub-phase 04B** of the Orchestration Harness workstream in
ArchitectOS Pro. You migrate the Virtual CSO turn engine from its hand-rolled agentic loop onto the
**Claude Agent SDK** — **strangler-fig**: behind a feature flag, parallel to the live hand-rolled path,
proven at canary parity, cut over surface by surface. You **consolidate and upgrade** capabilities that
already exist; you do **not** rewrite retrieval, the registry, the workers, or transparency.

> **APPROVAL GATE — read first.** This workstream is **PROPOSED and founder-gated.** Do **not** begin
> Phase A until London has approved the 04B proposal. Do **not** edit the harness root `ROADMAP.md`
> until the migration reaches Phase G with approval. If you were started before approval, stop and
> confirm.

This is a re-approach to the harness **Phase 4 Planner**, which **failed restart 2 on 2026-07-15**
(decomposition omitted the mandatory sandbox child — the canonical hand-rolled-orchestration failure).
The SDK's native subagent delegation is the proposed fix. You proceed **one phase at a time; do not
batch.** Each phase opens with a live code/schema check and ships behind its flag, parallel and
fail-safe, with the live VCSO working throughout.

## Read these before writing any code (in order)
1. `README.md` (this folder) — status, the proposal in brief, how it relates to the harness.
2. `CONTEXT.md` (this folder) — **the load-bearing record:** the core decision, the verified
   current-state findings (2026-07-15), the keep/replace/rework ledger, the context-assembly split, the
   registry reconciliation, the data-lifecycle principle, the **locks reconciliation** (incl. the
   founder-approved transparency reframe), the decisions you must not override, and the Open Questions.
3. `ROADMAP.md` (this folder) — the strangler-fig phase sequence A–G, gates, registry-extension sub-plan,
   and the mapping onto harness Phases 4–7.
4. `REFERENCES.md` (this folder) — the four Anthropic articles (with URLs), the gbrain patterns, and the
   exact code files + Supabase tables you touch, each with a disposition.
5. The plan for the phase you are on: `04B-A-PLAN.md` … `04B-G-PLAN.md` (one per phase, incl.
   `04B-C2-PLAN.md`, the UI/UX phase after C).
6. Harness spine: `../../CONTEXT.md` (reuse map, governing principles, locks), `../../ROADMAP.md`
   (Phases 0–7 + status), `../../REFERENCES.md`, `../../STATE.md`.
7. Canonical (win over anything): `../../../COGNITIVE-ORCHESTRATION-ARCHITECTURE.md` and
   `../../../INTELLIGENCE-LAYER-ARCHITECTURE.md`.
8. Live grounding you migrate (verify before changing — Supabase `pwacpjqkntnovndhspxt`; live
   `api.architectospro.com`): `python-backend/services/vcso_chat_service.py` (the loop, streaming,
   planner path, Deep Mode), `vcso_source_router.py`, `sub_agent_orchestrator.py`, `tool_registry.py`,
   `mcp_client.py`, `main.py`; tables `tool_registry`, `mcp_connections`, `agent_capabilities`,
   `ai_models`, `feature_registry`, `agent_todos`, `agent_context_sources`, `ai_usage_log`.

## The plans you execute (in order, one at a time)
- **`04B-A-PLAN.md` — Streaming spike + SDK proof-of-loop.** Resolves Q1 (token streaming). **Go/no-go
  checkpoint.**
- **`04B-B-PLAN.md` — SDK loop for standard VCSO (parallel).** Delete the 160-char fake; normalize the
  SDK stream into the existing SSE schema; canary parity.
- **`04B-C-PLAN.md` — Registry → SDK-config compiler + extensions.** `persistence_semantics`; connector
  catalog (Q2 resolved — pilot via `feature_registry`); tier→model resolver; per-founder
  `ClaudeAgentOptions`.
- **`04B-C2-PLAN.md` — Streaming surface redesign (UI/UX).** The migration's first `src/` phase; the
  native, Claude-like streaming/transparency surface against the stable SSE schema. Visual-only + one
  normalizer tweak.
- **`04B-D-PLAN.md` — Native subagents (the P4 re-approach).** The actual P4 fix. **STOP-and-review
  founder checkpoint.**
- **`04B-E-PLAN.md` — Sessions + Deep Mode reconciliation.** One resume authority.
- **`04B-F-PLAN.md` — First live MCP (QuickBooks).** Read-only, ephemeral, cited. Harness Phase 5's
  live-source objective.
- **`04B-G-PLAN.md` — Generalize, verify, cut over.** Co-equal gates on live; retire the hand-rolled
  loop on parity; thread 04B into the root roadmap (founder-gated).

## Hard constraints (do not violate)
- **Strangler-fig, never dark-swap.** New SDK path behind a flag, parallel to the hand-rolled path,
  canary-first, cut over surface by surface. Retire the old path **only** on parallel-run parity. Flag
  off ⇒ live VCSO byte-for-byte unchanged.
- **Keep the SSE event schema as the UI contract;** normalize the SDK message stream into it. The
  frontend does not learn the SDK.
- **Keep context *selection* IP; reposition only packing + lifecycle** onto the SDK. Never let the SDK
  own selection.
- **Registry is extend-not-build;** `ai_usage_log` stays a separate metering ledger.
- **Preserve every lock** (`CONTEXT.md` reconciliation): founder isolation; one-writer (feed OS Engine,
  never write the wiki); bounded, non-recursive, depth-capped sub-agents; per-turn budget/depth caps;
  traceability (every insight cites a source); Claude-lock (Sonnet judgment / Haiku workers via the
  MA-06 tier map; no non-Claude model); **no founder-facing model selector**; tier authority at the
  capability grain.
- **Transparency reframe (founder-approved):** stream real answer tokens + curated step chips
  (Claude-like drill-down); **never** surface raw JSON payloads or raw chain-of-thought in the UI. The
  160-char fake stream is deleted.
- **Observability rides hooks:** LangSmith traces + `ai_usage_log` on SDK hooks; the standing bar holds
  — traces **paired** with DB/output checks, necessary but not sufficient.
- **Work from live; version-tagged commits (per CLAUDE.md); one phase at a time; founder-gated flips.**
- **The North Star wins** on any conflict; this changes the engine, not the target shape
  (intent → plan → gather → compose/steer).

## Checkpoints — return to London at these; otherwise proceed within the plan
1. **Before Phase A** — the workstream is founder-gated; confirm approval to begin.
2. **End of Phase A** — the Q1 streaming **go/no-go**. If no-go, present the message-level-streaming
   fallback + UX revision before Phase B.
3. **End of Phase D** — the P4 thin-slice **STOP-and-review**: the proof (plan, workers, tiers, cost,
   quality, paired traces) before any broadening.
4. **Phase G** — the **cutover** (retire the hand-rolled loop) and the **root-roadmap update** are
   founder-gated.
Only pause mid-phase for a **genuine new conflict** with the workstream CONTEXT — add a Conflict
Register row in `../../CONTEXT.md` and stop; never resolve silently.

## Done when
Each phase is done per its plan's acceptance criteria (with `compileall` clean, frontend green if `src`
touched, `../../ROADMAP.md`/`../../STATE.md` + the phase `04B-*-COMPLETION.md` + `Pro-Suite-Progress.md`
updated, and a read-back to London). **The migration is done** when the SDK path is generalized and
proven on the co-equal gates, the hand-rolled loop is retired on parity, and the harness root
`ROADMAP.md` reflects 04B — all founder-gated.

## Explicitly out of scope for you
The MCP-snapshot-into-wiki ingestion path (pinned in `CONTEXT.md`); connectors beyond the QuickBooks
pilot (Asana/Monday/GHL — later); OS-Engine wiki-page authoring/vectorization (one-writer dependency);
account-level metering/quotas (`ai_usage_log` is separate); flipping any flag default or editing the
root roadmap without London; and anything `CONTEXT.md` or `ROADMAP.md` marks as a later phase or deferred.
