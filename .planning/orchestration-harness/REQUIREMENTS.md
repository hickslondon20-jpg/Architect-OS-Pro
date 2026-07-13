# Requirements: Orchestration Harness — VCSO Planner — ArchitectOS Pro

**Written:** 2026-07-13. Traces to `../COGNITIVE-ORCHESTRATION-ARCHITECTURE.md` (North Star) and
`../RECONCILIATION-COGNITIVE-ORCHESTRATION.md` (live gap map). Requirement IDs are referenced by the
ROADMAP phases and the per-phase `phases/NN-*/` plans.

---

## Adaptation Notes (vs. current VCSO and vs. OpenClaw)

| Element | ArchitectOS decision |
|---|---|
| Current single Sonnet loop that crams context + answers | **Replaced by a decompose→delegate→compose planner.** The loop's flat tool bag becomes a router-driven, budget-bounded plan. |
| "Reload full founder context each round" | **Working-state memory** (compact per-thread state) + bounded assembly replace raw-history compaction as the primary anti-bloat mechanism. |
| Model-discretionary delegation (parent usually answers itself) | **Adaptive, intent-gated delegation.** Simple turns answer directly; multi-part synthesis decomposes. |
| OpenClaw context-engine / lanes / active-memory / delegate machinery | **Interfaces + disciplines only.** Adapt to our knowledge substrate, multi-tenant isolation, and Claude-lock; skip product/channel framing. |
| Escalation | **Rule-based / deterministic** (MA-06 posture). No self-judged quality-score loops in v1. |
| Model selection | **Unchanged authority** — tier map at the capability grain (MA-06). The router selects *sources*, not models. |
| Context Hub — annotations, incremental fetch, feedback loop | **Mechanisms adapted**, not the `chub` CLI/registry product. Durable annotation grain (CTX-5), selective fetch (CTX-2/ROUT-2), feedback→OS-Engine (dependency). |
| Personal Context Portfolio — modular founder-operating taxonomy | **Consumption adapted** (ROUT-5), not the web-app/all-ten-pages product. Page *authoring* is an OS Engine dependency; this build designs to consume a modular, extensible set. |

---

## v1 Requirements

### Reconciliation Cleanups (CLEAN) — Phase 0
- **CLEAN-1** Confirm the live VCSO is the Python `/api/vcso/chat` path; **retire or explicitly
  quarantine** the legacy Vercel `api/vcso/chat.ts` (surface `ws5-chat`) so no divergent logic is
  revived. (Conflict O1.)
- **CLEAN-2** Correct **CLAUDE.md Rule #1** to state the live VCSO is Python-served (remove/repoint
  the stale "Vercel serverless streaming exception" language). (Conflict O1.)
- **CLEAN-3** Decide the **authoritative query-time wiki** (`ose_knowledge_pages` vs. the `wiki_*`
  claim/evidence system) and document how the composer reads it. (Conflict O2.)
- **CLEAN-4** Confirm (or scope as deferred) the **conversation→OS-Engine→wiki feeder**; record
  whether Layer-2 accretes from chat today. (Conflict O3.)
- **CLEAN-5** Confirm the frontend's actual VCSO endpoint URL against the Python route (the
  reconciliation inferred it from usage; a 1-line confirm).

### Working-State Memory + Bounded Assembly (CTX) — Phase 1
- **CTX-1** A per-thread **working-state artifact**: decisions reached, open questions, findings
  gathered, and explicitly what we've established we *don't* know. Compact, structured, persisted.
- **CTX-2** A **context-assembly seam** (an `assemble()`-style interface) that returns a windowed,
  token-budgeted context = working state + selected wiki components + current move — **not** raw
  history + full tool dumps. Adopt `isolated`/`fork` context modes for workers.
- **CTX-3** Working-state is **conversational scaffolding only** — never a knowledge-base write;
  feeds OS Engine through the normal synthesis path when worth remembering.
- **CTX-4** Compaction is retained **only as a fallback** for pathological length; working-state is
  the default anti-bloat path. Fail-open (quarantine-and-downgrade on assembly failure).
- **CTX-5** A **durable annotation/learning grain** (Context Hub pattern): agents/sub-agents attach
  notes to reusable resources (wiki components, tools, skills) that **persist across threads** and
  re-inject on future use, **flagged untrusted** (per INT-3). Annotations are agent-authored
  notes/feedback — never a knowledge-base write. Selective re-injection (off by default; opt-in per
  fetch) to protect the token budget.

### Intent & Depth Read + Adaptive Triage (INT) — Phase 2
- **INT-1** A **cheap pre-pass** (worker-tier) that classifies the move: lookup / strategic synthesis
  / brainstorm / produce / ambient, plus a depth signal. Runs before retrieval, on working-state +
  latest message; bounded timeout + circuit breaker; returns compact-or-`NONE`.
- **INT-2** The pre-pass sets the turn's **response contract** and selects the initial terminal mode;
  **simple lookups skip decomposition** and answer in one pass.
- **INT-3** Injection hygiene — any pulled/injected founder data is framed as untrusted context, not
  instructions.

### Tier-Escalating Source Router (ROUT) — Phase 3
- **ROUT-1** A **cheapest-first router** over source classes: Tier-0 records → Tier-1 wiki components
  → Tier-2 semantic → Tier-3 raw docs → live external (MCP). Stops at the cheapest sufficient source.
- **ROUT-2** **Wiki-component composition** — read a handful of compact pre-reasoned components
  rather than re-crawling raw source; composes existing `retrieval.py`/KB/`wiki_*` tools.
- **ROUT-3** Router decisions are **recorded per turn** and rendered through the MA-05 layer (which
  source class was chosen and why), never as raw reasoning.
- **ROUT-4** Router respects founder isolation + existing tool permissions unchanged.
- **ROUT-5** The router/assembly consume a **modular, extensible founder-context set** (Personal
  Context Portfolio pattern) — business pages *and* founder-operating pages
  (communication-style, decision-log, goals/priorities, role, constraints) — grabbed as needed,
  **never hard-coded to the seven business pages**. Missing pages degrade gracefully (absent
  component ≠ failure). Page *authoring* is an OS Engine dependency (see v2/Dependencies).

### Planner — Decompose → Delegate → Compose (PLAN) — Phase 4 (thin-slice checkpoint)
- **PLAN-1** **Decompose** a strategic ask into sub-questions, each bound to a source/worker; the plan
  is explicit, budget-bounded (rounds / delegation depth / spend cap), and revisable mid-turn.
- **PLAN-2** **Delegate** gathering to bounded workers (incl. a **sandbox compute** worker) that
  return **compact, cited, structured** findings — the lane-contract/handoff-summary shape.
- **PLAN-3** **Compose** on the synthesis tier over working state + compact findings only; never raw
  dumps; every claim cited.
- **PLAN-4** **Depth-bounded sub-delegation** (one controlled level; never open recursion); per-turn
  budget enforced by the runtime, not the prompt.
- **PLAN-5** **Thin-slice proof:** one hard strategic question end-to-end (intent → decompose →
  ≥2 workers incl. sandbox compute over a dataset → compose), plan + workers visible via MA-05,
  each worker on the correct tier. **Stop-and-review checkpoint with founder.**

### Reflect-and-Steer + Freshness + First MCP (STEER) — Phase 5
- **STEER-1** **Reflect-and-steer** as a first-class terminal mode: when inputs are insufficient,
  surface what's known, name the gap, and ask/steer — instead of composing a thin answer.
- **STEER-2** A **freshness/authority policy** per data class consulted by the router (e.g.
  financials favor a live pull when a connector exists; slow-changing context trusts the wiki).
- **STEER-3** **One live MCP connector pilot (QuickBooks)** end-to-end: a live pull (e.g. last-month
  P&L) chosen by the freshness policy, flowing through the registry + a bounded worker, cited.
- **STEER-4** **Runtime-enforced tool policy + hard blocks** for the powered workers (sandbox/MCP):
  founder-isolation, one-writer, never-echo-secrets enforced at the runtime regardless of prompt.

### Generalize + Strategic Workers (GEN) — Phase 6
- **GEN-1** Extend the planner across question types/domains beyond the thin-slice anchor.
- **GEN-2** Enable the disabled strategic workers **selectively** (retrieval-evidence + strategy-
  synthesis first) with scoped context + structured contracts + tier routing.
- **GEN-3** (Light) proactive follow-up / "open loops" from working-state, surfaced in-thread or a
  digest (informed by the commitments taxonomy). Optional; may defer.

### Verification & Seams (VERIF) — Phase 7
- **VERIF-1** Cost gate: a decompose→delegate→compose turn shows the synthesis-tier context materially
  smaller than the current single-loop baseline, with workers on the worker tier (paired trace + DB).
- **VERIF-2** Quality gate: cited, judgment-bearing answers to CFO/CSO-grade questions; no unsourced
  strategy.
- **VERIF-3** UX gate: plan + workers render legibly through MA-05; reflect-and-steer reads as a
  partner move, not an error.
- **VERIF-4** Safety gate: founder isolation, per-turn budget/depth caps, runtime-enforced tool
  policy all hold under adversarial prompts; no model selector exposed.
- **VERIF-5** Every gate proven on live, pairing LangSmith traces with DB/output checks (traces
  necessary, not sufficient).

---

## v2 / Deferred

| Item | Deferred reason |
|---|---|
| Deep compaction/assembly overhaul beyond working-state memory | Working-state is the bounded scope; larger overhaul is later. |
| Many live MCP connectors / connector marketplace | One pilot (QuickBooks) proves the path; breadth post-build. |
| Self-judged quality-score escalation loops | Escalation stays rule-based (MA-06); quality-scoring later. |
| Enabling all four disabled strategic workers at once | Selective enablement as decompose breadth grows. |
| OS Engine wiki generation/vectorization internals | OS Engine's build; this build only reads + feeds. |
| **Authoring** the new founder-operating pages (communication-style, decision-log, etc.) | **OS Engine dependency** (one-writer). This build consumes them (ROUT-5); `communication-style` + `decision-log` are the first two worth adding. |
| **Feedback → OS-Engine re-synthesis** of wiki components from agent annotations | **OS Engine dependency.** This build emits the signal (CTX-5); OS Engine re-synthesizes. Ties to Conflict O3. |
| `chub` CLI / docs registry / community-PR model; Portfolio web-app interviewer / all ten pages / wiring guides | Patterns mined, products held; reference back when a phase needs specifics. |
| Account-level metering ledger / quotas / admin UI | `ai_usage_log` metering is a separate system. |
| Visual/UX polish of the transparency surface | Functional wiring only; MA-05 surface reused. |

## Out of Scope

| Feature | Reason |
|---|---|
| The orchestrator writing the wiki directly | One-writer rule (architecture §5); it feeds OS Engine. |
| A founder-facing model selector | Routing is platform-governed (MA-06 lock). |
| Non-Claude models for cost | Claude-lock (CLAUDE.md Rule #1); cheaper = Haiku worker tier. |
| Open-ended recursive agent swarms | Depth-bounded delegation only; bounded specialists. |
| Raw chain-of-thought exposure | Curated transparency only (MA-05); thinking mode disabled. |
