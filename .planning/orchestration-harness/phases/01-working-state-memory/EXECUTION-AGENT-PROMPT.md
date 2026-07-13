# Execution Agent Brief — Phase 1: Working-State Memory + Bounded Assembly

You are the Execution Agent for **Phase 1** of the Orchestration Harness workstream in ArchitectOS
Pro. You implement this phase's memory + assembly substrate. You do not re-plan it, and you do not
start any later phase (no router, no planner, no intent read, no delegation changes).

Phase 1 gives the harness the foundation everything else reasons over: a compact per-thread
**working-state artifact** and a discrete **assembly seam**, plus a durable **annotation grain** —
all behind a default-off flag, proven on live for **cost *and* quality** before anything flips. The
live VCSO must keep working throughout (the seam is fail-open to the legacy path).

## Read these before writing any code (in order)
1. `.planning/orchestration-harness/CONTEXT.md` — the workstream rationale, reuse map, governing
   principles (esp. #10 two-grain memory, #1 cheap compact inputs), and the resolved Conflict Register
   (O2 wiki authority — you honor the two-source read; O3 feeder deferred).
2. `.planning/orchestration-harness/ROADMAP.md` — Phase 1 goal + success criteria (CTX-1..5).
3. `phases/01-working-state-memory/01-CONTEXT.md` — the phase rationale, grounded decisions, and the
   **Locked decisions** (founder-confirmed) you build to.
4. `phases/01-working-state-memory/01-01-PLAN.md` (CTX-1..4, working-state + assembly seam) and
   `01-02-PLAN.md` (CTX-5, annotation grain) — the two plans you execute.
5. Canonical (win over anything else): `.planning/COGNITIVE-ORCHESTRATION-ARCHITECTURE.md` §6, and
   `.planning/INTELLIGENCE-LAYER-ARCHITECTURE.md`.
6. Live grounding you will extend: `python-backend/services/vcso_chat_service.py` (`_build_context`,
   `_assemble_prompt`, `compact_thread`), `vcso_chat_threads` (JSONB `compacted_summary` /
   `deep_resume_state` precedent). **Verify live schema/code before changing** (Supabase project
   `pwacpjqkntnovndhspxt`; live `api.architectospro.com`).

## What you are building

**Plan 01-01 — working-state + assembly seam (CTX-1..4):**
- Migration: `working_state jsonb` on `vcso_chat_threads` (founder-scoped RLS, mirroring the existing
  JSONB columns); platform flag `vcso_working_state_assembly` (default **off**).
- The working-state artifact with the **locked four families** (`decisions` / `open_questions` /
  `findings` / `known_unknowns`), updated by a cheap **worker-tier `afterTurn`** pass — compact, capped,
  fail-open, **never a KB write**.
- A discrete `assemble(working_state, current_move, budget) -> {messages, systemPromptAddition,
  estimated_tokens}` seam that builds a windowed, token-budgeted context from working state + selected
  wiki components + the current move. **Fail-open** to the legacy `_build_context` path on any error.
- Compaction (`compact_thread`/`compacted_summary`) demoted to **fallback**, not removed.

**Plan 01-02 — annotation grain (CTX-5):**
- Migration: `agent_annotations` (`resource_kind ∈ {wiki_component, tool, skill}`, `resource_ref`,
  `note`, `created_by`, `status`, timestamps), founder-scoped RLS, per-resource cap.
- A bounded `annotate` capability (registered through the MA-06 tool registry, `enabled`, no
  `routing_tier`) that workers/the main agent call to attach/clear notes; **never a KB write**.
- **Opt-in, untrusted re-injection** of a resource's annotations into the `assemble()` seam (off by
  default; wrapped as untrusted context per INT-3).

## Hard constraints (do not violate)
- **Default-off flag; prove-then-flip.** Ship `vcso_working_state_assembly` off. Flag off ⇒ the legacy
  assembly path is byte-for-byte unchanged. **Do not flip the default** — that is a separate founder call.
- **Fail-open everywhere.** A failed assembly, a failed `afterTurn` update, or a failed annotation read
  must never break the live VCSO turn — fall back and log (quarantine-and-downgrade).
- **Two-source wiki read (O2).** When assembly selects Tier-1 components, read the seven fixed pages
  from `wiki_*` (`WikiReadService`) and emergent Layer-2 from `ose_knowledge_pages` (`DocWikiReadService`).
  **Do not depend on the unverified `wiki_*`→OSE-Layer-1 projection.**
- **One-writer.** Working-state and annotations are conversational scaffolding / agent notes —
  **never** a knowledge-base write. The feedback→OS-Engine loop is a named dependency you do NOT build.
- **Founder isolation** on `working_state` and `agent_annotations` (RLS `auth.uid() = user_id`); no
  cross-founder read/write.
- **Scope wall.** No router (P3), planner/decomposition (P4), intent read (P2), delegation changes, wiki
  authoring/feeder work, or MCP. If you're writing tier-escalation or a decompose loop, you've left Phase 1.
- **Work from live; curated transparency** (annotation writes surface as sanitized steps, no raw CoT);
  **Claude-lock** (`afterTurn`/annotation model calls, if any, on the worker tier per MA-06).

## Checkpoint — proceed straight through; return only for the flag-flip
The three design decisions are **locked** (see `01-CONTEXT.md` Locked decisions) — implement on them,
no further checkpoint needed. **Do bring the cost + quality proof back to London** and let the founder
decide the default flip; do not flip it yourself. Only pause mid-phase if you hit a genuine new
conflict with the workstream CONTEXT — in which case add a Conflict Register row and stop.

## Done when
1. **CTX-1:** `working_state` JSONB live (RLS correct), holding the four families, populated + updated
   across turns; verified against live, KB never written.
2. **CTX-2:** the `assemble()` seam returns a windowed, budgeted context; **fail-open to legacy proven**
   (force an assembly error → the turn still completes on the legacy path).
3. **CTX-3:** the worker-tier `afterTurn` update runs bounded + fail-open.
4. **CTX-4:** compaction remains available as fallback; not the default when the flag is on.
5. **CTX-5:** `agent_annotations` live (founder-scoped RLS, capped); `annotate`/clear works from a
   worker; opt-in untrusted re-injection into the seam works and is **off by default**; **cross-thread
   persistence proven** (annotate in thread A → available in thread B for the same founder; invisible to
   another founder).
6. **Cost + quality proof on live (co-equal):** with the flag on for the test founder, a multi-turn
   thread shows a **materially smaller assembled context** vs. the legacy baseline **and** no answer-
   quality regression on a small fixed question set — paired LangSmith trace + `ai_usage_log` /output
   evidence. The default flip is deferred to London.
7. `python -m compileall python-backend` clean; frontend build green if any `src` touched (none
   expected); `.planning/orchestration-harness/ROADMAP.md` + `STATE.md` updated; `01-COMPLETION.md`
   written with evidence; `Pro-Suite-Progress.md` updated. Deliver a read-back to London.

## Explicitly out of scope for you
Intent read (Phase 2), the router (Phase 3), the planner (Phase 4), reflect-and-steer/freshness/MCP
(Phase 5), generalization (Phase 6), verification (Phase 7); the feedback→OS-Engine re-synthesis loop;
authoring wiki pages or touching the wiki feeder; flipping the assembly default. Do not resolve anything
`01-CONTEXT.md` marks as a later phase.
