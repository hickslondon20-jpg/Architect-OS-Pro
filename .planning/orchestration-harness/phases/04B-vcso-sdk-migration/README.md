# 04B — Proposed VCSO SDK Migration

**Status: PROPOSED (founder-gated).** This is a proposal workstream, not an approved phase. No
production code changes and **no edit to the harness root `ROADMAP.md`** happen until London approves
this proposal. These four files are a self-contained artifact the Orchestration Agent reads to
understand *what we are proposing to change and why*, relative to the hand-rolled Planner (Phase 4)
that is currently blocked.

---

## What this is

A proposal to migrate the Virtual CSO turn engine from its **hand-rolled agentic tool loop** onto the
**Claude Agent SDK** as the loop engine — adopted incrementally (strangler-fig, behind a feature flag,
surface by surface), preserving the harness's hard locks and reusing the substrate the harness already
built (working-state memory, tiered source router, tool registry, bounded workers, MA-05 transparency).

It is framed as **04B** — a re-approach to Phase 4 (Planner) and a reframing of the back half of the
harness roadmap (Phases 5–7) — rather than a standalone `.planning/` workstream, so it inherits the
harness `CONTEXT.md` / `REFERENCES.md` / `ROADMAP.md` and the Orchestration Agent reads it in context.

## Why now

Phase 4 (the Planner) **failed restart 2 on 2026-07-15** and was rolled back: the Sonnet decomposition
created only one structured-data child and omitted the mandatory sandbox compute child. That is the
exact hand-rolled-orchestration failure mode Anthropic's multi-agent research writeup describes —
coordination defects in a bespoke lead→worker loop — and the Agent SDK's native subagent delegation is
the mechanism built to fix it. Rather than restart the hand-rolled planner a third time, we propose
graduating the loop onto the SDK.

## The proposal in one paragraph

Adopt the Agent SDK as the loop engine. **Keep** the context-*selection* IP (working-state memory,
tiered source router, founder-context portfolio, wiki-component composition), the tool registry and
executors, the bounded worker handlers, citations, the Deep Mode plan, and the SSE event schema as the
UI contract. **Replace** the hand-rolled round loop, the 160-character fake token stream, and the
bespoke sub-agent plumbing. **Rework** prompt-packing + multi-round lifecycle onto the SDK's
system-prompt/inputs + sessions + compaction, wire LangSmith + `ai_usage_log` through SDK hooks, and
turn the registry into the SDK-config compiler. MCP connectors are in scope from day one (the harness
Phase 5 QuickBooks pull). The one true net-new win is **real token streaming** of the assistant answer,
replacing the simulated stream.

## Contents

| File | Purpose |
|---|---|
| `README.md` | This orientation file. Status, why, the proposal in brief, how it relates to the harness. |
| `CONTEXT.md` | The locked decisions, the verified current-state findings (2026-07-15), the keep/replace/rework ledger, the context-assembly split, the registry reconciliation, the data-lifecycle principle, and the locks reconciliation. Read first before any execution. |
| `REFERENCES.md` | Source material → disposition map: the four Anthropic articles, the gbrain-inspiration patterns, the exact code files and Supabase tables this build touches, and what each contributes. |
| `ROADMAP.md` | The strangler-fig phase sequence (A–G) with gates, the registry-extension sub-plan, and the mapping onto the existing harness Phases 4–7. |

## Relationship to the harness

- **North Star still wins.** `../../../COGNITIVE-ORCHESTRATION-ARCHITECTURE.md` and
  `../../../INTELLIGENCE-LAYER-ARCHITECTURE.md` govern; where this proposal and the North Star conflict,
  the North Star wins. This proposal changes the *engine*, not the target shape
  (intent → plan → gather → compose/steer).
- **Reuse-before-create holds.** The harness reuse map (`../../CONTEXT.md`) is intact; the SDK does not
  replace retrieval, the registry, the workers, or transparency — it replaces the loop that coordinates
  them.
- **This reframes Phase 4 and the back half.** It is a proposed re-approach to the Planner and an
  engine change threaded through Phases 5–7. If approved, the harness root `ROADMAP.md` gets updated to
  point at 04B; until then it is untouched.

## Scope boundary (hard)

- This is a **planning artifact only** — no production code, no schema changes, no flag flips.
- The harness root `ROADMAP.md` and `CONTEXT.md` are **not edited** until founder approval.
- The decisions recorded here were confirmed with the founder across the originating design
  conversation; `CONTEXT.md` restates every load-bearing one so this folder stands alone.
