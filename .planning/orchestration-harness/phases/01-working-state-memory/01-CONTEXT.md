# Phase 1 Context — Working-State Memory + Bounded Assembly

**Phase:** 01 of the Orchestration Harness workstream.
**Read first:** the workstream `../../CONTEXT.md` (esp. Principle #10 two-grain memory, Principle #1
cheap compact inputs), `../../ROADMAP.md` (Phase 1), `../../REQUIREMENTS.md` (CTX-1..5), and Phase 0's
`../00-reconciliation-cleanups/00-COMPLETION.md` (the clean single-path surface this builds on). North
Star `../../../COGNITIVE-ORCHESTRATION-ARCHITECTURE.md` §6 (working-state memory) wins over any reference.

---

## Why this phase, and what it is

The live VCSO assembles every turn by cramming a large context into one prompt: founder-wiki slice
(`_load_founder_context`) + recent messages + prior tool results + a `compacted_summary`, all joined
in `_build_context` → `_assemble_prompt`, then re-sent to Sonnet each round. That "reload everything"
assembly is the dominant cost driver and the thing compaction only band-aids.

Phase 1 introduces the **foundation the whole harness reasons over**: a compact, per-thread
**working-state artifact** (decisions, open questions, gathered findings, known-unknowns) and a
discrete **assembly seam** (`assemble()`-style) that returns a windowed, token-budgeted context =
working state + selected wiki components + the current move — instead of raw history + full dumps.
It also adds the **durable annotation grain** (Context Hub pattern): notes agents attach to reusable
resources that persist across threads and re-inject (untrusted, opt-in).

This is a **code + schema phase**, but a contained one. It does **not** build the router, the planner,
or the intent read — it builds the memory + assembly substrate those later phases plug into. The VCSO
turn keeps working; what changes is *what context it assembles from*.

## What this phase is NOT

- **Not the router (Phase 3), planner (Phase 4), or intent read (Phase 2).** No decomposition, no
  delegation changes, no tier-escalation. If you're writing routing logic, you've left Phase 1.
- **Not a wiki change.** Consume the existing wiki per the O2 decision (see below); do not author pages
  or alter which system OS Engine writes.
- **Not a full compaction/assembly overhaul.** Working-state memory is the bounded scope; the deeper
  redesign stays deferred. Compaction is retained as a *fallback*, not removed.
- **Not a behavior "free" change.** Working-state assembly changes *what the model sees*, so it must be
  proven not to degrade answer quality (co-equal with the cost win) before it becomes the default.

## Decisions that shape this phase (grounded in live code; confirm the checkpoint items below)

1. **Working-state persists as a JSONB column on `vcso_chat_threads`** (e.g. `working_state jsonb`),
   consistent with the existing `compacted_summary` and `deep_resume_state` JSONB columns — not a new
   table. Thread-scoped, versioned by a `schema_version` key.
2. **Assembly becomes a discrete seam.** Refactor the `_build_context` assembly into an
   `assemble(working_state, current_move, budget) -> {messages, systemPromptAddition, estimatedTokens}`
   interface (Context Hub shape), so the future router/planner reuse it. **Fail-open**: on assembly
   error, fall back to today's `_build_context` path (quarantine-and-downgrade).
3. **Working-state is updated after each turn** (an `afterTurn`-style step) from the turn's
   decisions/findings/open-questions — cheap, worker-tier, bounded. It is **conversational scaffolding,
   never a knowledge-base write** (one-writer).
4. **Compaction demoted to fallback.** `compacted_summary` remains for pathological length; working
   state is the default anti-bloat path.
5. **Two-source wiki read (from O2, resolved Phase 0).** When assembly selects Tier-1 components, read
   the seven fixed pages from `wiki_*` (`WikiReadService`) and emergent Layer-2 from `ose_knowledge_pages`
   (`DocWikiReadService`); do **not** depend on the unverified OSE-Layer-1 projection.
6. **Durable annotation grain (CTX-5) is cross-thread, per-resource, untrusted, opt-in.** A new
   `agent_annotations` table keyed by `(user_id, resource_kind, resource_ref)`; re-injection is off by
   default and flagged untrusted when on. (Grain scope is a checkpoint item.)
7. **Flagged rollout.** Introduce working-state assembly behind a platform setting
   (`vcso_working_state_assembly`, default off) so it can be proven on live before becoming default —
   mirroring the MA-06 discipline of proving on live before flipping.

## The mechanism, concretely

```
turn:
  assemble(working_state, move, budget):            # the seam (CTX-2)
     ├─ working_state (decisions / open Qs / findings / known-unknowns)   # CTX-1, JSONB on thread
     ├─ selected wiki components (two-source per O2)  # wiki_* fixed-7 + ose Layer-2
     ├─ + durable annotations (opt-in, untrusted)     # CTX-5
     └─ current move (+ minimal recent tail)
     → windowed, token-budgeted context   (fallback → legacy _build_context on error)
  ... model turn (unchanged loop for now) ...
  afterTurn: update working_state (cheap, worker-tier)   # CTX-3
compaction: fallback only (CTX-4)
```

## Success criteria (from ROADMAP Phase 1 — CTX-1..5)

1. **CTX-1:** `working_state` JSONB exists per thread and holds decisions / open questions / gathered
   findings / known-unknowns; populated + updated across turns; RLS scoped to the founder.
2. **CTX-2:** A discrete `assemble()` seam returns a windowed, token-budgeted context (working state +
   components + move), fail-open to the legacy path.
3. **CTX-3:** Working-state updates after each turn (worker-tier, bounded); never writes the KB.
4. **CTX-4:** Compaction runs only as fallback; working-state is the default assembly input (behind the
   rollout flag until proven).
5. **CTX-5:** `agent_annotations` (cross-thread, per-resource) with opt-in untrusted re-injection wired
   into the seam.
6. **Cost + quality proof (co-equal):** on live, a multi-turn thread with working-state assembly shows
   a **materially smaller assembled context** than the legacy baseline **and** answer quality holds
   (cited, on-voice, no regression on a small fixed question set). Paired LangSmith trace + DB/output.
7. Workstream `ROADMAP.md` + `STATE.md` updated; `01-COMPLETION.md` written.

## Locked decisions (founder-confirmed 2026-07-13)

- **Annotation grain scope (CTX-5): cross-thread, per-resource store.** Resource kinds covered in v1:
  **wiki components + tools + skills**. (Not thread-local-only.)
- **Working-state field set (CTX-1): the four families** — `decisions` / `open_questions` /
  `findings` / `known_unknowns` — locked as the migration shape.
- **Rollout posture: default-off flag, prove-then-flip.** Ship behind `vcso_working_state_assembly`
  (default off), prove cost + quality on live, then flipping the default is a separate founder call.
