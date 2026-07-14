# Execution Agent Brief — Phase 3: Tier-Escalating Source Router

You are the Execution Agent for **Phase 3** of the Orchestration Harness workstream in ArchitectOS
Pro. You build the **retrieval half of the spine**: a deterministic, cheapest-first source router over
Tiers 0–3. You do not re-plan the phase, and you do not start any later phase (no planner/
decomposition, no live MCP tier, no freshness policy).

Phase 3 orchestrates existing retrieval primitives; it does **not** rebuild them. It consumes the
Phase 2 intent (when present) and feeds selected sources into the Phase 1 `assemble()` seam. It is the
first phase that changes retrieval *behavior*, so quality is co-equal with cost — it ships behind its
own default-off flag, fail-open to today's flat tool bag, and the live VCSO keeps working throughout.

## Read these before writing any code (in order)
1. `.planning/orchestration-harness/CONTEXT.md` — workstream rationale, Principle #3 (build-time over
   query-time), the Conflict Register (**O2 resolved** two-source read; **O3 deferred** feeder) and
   **Named dependencies** (the `wiki_*`→OSE projection; founder-operating pages).
2. `.planning/orchestration-harness/ROADMAP.md` — Phase 3 goal + success criteria (ROUT-1..5).
3. `phases/03-source-router/03-CONTEXT.md` — phase rationale, the tier mechanism, and the **Locked
   decisions** (founder-confirmed) you build to.
4. `phases/03-source-router/03-01-PLAN.md` (ROUT-1/3/4, router core) and `03-02-PLAN.md` (ROUT-2/5,
   Tier-1 composition) — the two plans you execute.
5. Phases 1–2: `../01-working-state-memory/01-CONTEXT.md` (the `assemble()` seam) and
   `../02-intent-read/02-CONTEXT.md` (the intent classification you consume).
6. Canonical (win over anything): `.planning/COGNITIVE-ORCHESTRATION-ARCHITECTURE.md` §5 and
   `.planning/INTELLIGENCE-LAYER-ARCHITECTURE.md` (Tiers 0–3).
7. Live grounding you orchestrate: `python-backend/services/retrieval.py` (`RetrievalService.hybrid_search`,
   Tier-2), the KB tools (Tier-3), `WikiReadService`/`DocWikiReadService` (Tier-1, two-source), the
   Tier-0 structured-record read path (verify), the Phase 1 seam, the Phase 2 intent. **Verify live
   before changing** (Supabase `pwacpjqkntnovndhspxt`; live `api.architectospro.com`).

## What you are building

**Plan 03-01 — router core (ROUT-1/3/4):**
- Flag `vcso_source_router` (default **off**, Phase-1-flag shape). The tier model + cost order:
  **Tier-0** records (MRA/AE Ladder/sprints/Quarter Map) → **Tier-1** wiki components → **Tier-2**
  hybrid search → **Tier-3** raw docs, with a **no-op live-tier hook** (Phase 5).
- **Rule-based escalation:** from intent/depth (conservative default when Phase 2 off) + deterministic
  signals + component availability, pick a starting tier + escalation plan; stop at the cheapest
  sufficient tier; feed sources into `assemble()`. **No quality-score self-judgment.**
- **Hybrid governance:** deterministic pre-fetch **plus** the existing tool loop stays available for
  mid-turn model escalation. **Fail-open** to the flat tool bag on error; flag off ⇒ unchanged.
- Record the routing decision per turn; render sanitized via MA-05; founder isolation intact.

**Plan 03-02 — Tier-1 composition (ROUT-2/5):**
- Compose the **seven fixed pages from `wiki_*`** (`WikiReadService` — cited claim/evidence components)
  and **Layer-2 from `ose_knowledge_pages`** (`DocWikiReadService`). **Do not** depend on the
  `wiki_*`→OSE-Layer-1 projection — read `wiki_*` directly for the seven.
- Consume founder context as a **modular, extensible** component set (business + founder-operating
  pages when present), **never the fixed 7**; missing pages **degrade gracefully**. Compose compact,
  provenance-carrying components (selective/incremental), never a whole-wiki dump.

## Hard constraints (do not violate)
- **Default-off flag; prove-then-flip; flips after Phases 1–2.** Flag off ⇒ retrieval byte-for-byte
  unchanged. Do **not** flip the default (a separate founder call, after the Phase 1/2 flips).
- **Fail-open + quality fail-safe.** Router error ⇒ flat tool bag; and even on the router path, the
  model can still escalate mid-turn via the tool loop. The router never breaks the turn or narrows what
  the model can reach.
- **Rule-based escalation only.** No self-judged quality-score loop (deferred, MA-06 posture).
- **Two-source read (O2).** `wiki_*` for the fixed seven, `ose` for Layer-2; never depend on the
  unverified projection.
- **Scope wall.** Selects *sources* only. **No** decomposition/delegation (P4), **no** live MCP tier or
  freshness policy (P5) — a documented hook only. If you're decomposing a question or pulling live
  external data, you've left Phase 3.
- **One-writer** (read-only composition, no wiki writes); **founder isolation + existing tool
  permissions unchanged**; **curated transparency** (sanitized routing step, no raw CoT); **Claude-lock**
  (any model call on the worker tier per MA-06); **work from live; commit version-tagged**.

## Checkpoint — proceed straight through; return only for the flag-flip
The three design decisions are **locked** (see `03-CONTEXT.md` Locked decisions) — implement on them,
no further checkpoint. **Bring the cost + quality proof back to London** for the default-flip decision
(which sequences after the Phase 1/2 flips); do not flip it yourself. Only pause mid-phase for a genuine
new conflict with the workstream CONTEXT — add a Conflict Register row and stop.

## Done when
1. **ROUT-1:** cheapest-first escalation over Tiers 0–3 stops at the cheapest sufficient source,
   composing existing primitives; live-tier hook documented (no-op). Verified: a record question answers
   from Tier-0 without a raw crawl; a strategic question starts at Tier-1 components; "what does document
   X say" reaches Tier-3.
2. **ROUT-2:** wiki-component composition (two-source, `wiki_*` for the seven), not raw re-crawl;
   components are compact + provenance-carrying (citations resolve).
3. **ROUT-3:** routing decision recorded per turn + rendered sanitized via MA-05.
4. **ROUT-4:** founder isolation + existing tool permissions unchanged.
5. **ROUT-5:** modular/extensible founder-context consumption (never the fixed 7); a deliberately-absent
   founder-operating page degrades gracefully.
6. **Fail-open proven:** forced router error → flat tool bag; a router under-fetch still lets the model
   reach what it needs mid-turn; flag off ⇒ retrieval unchanged.
7. **Cost + quality proof (co-equal):** with `vcso_source_router` on for the canary (Phase 1 [+ Phase 2]
   flags on for the proof), simple/record questions escalate less (cheaper) and strategic questions
   compose from components without a full raw re-crawl, with **no quality regression** on a mixed set —
   paired LangSmith trace + `ai_usage_log`/output.
8. `python -m compileall python-backend` clean; frontend build green if any `src` touched (none
   expected); `.planning/orchestration-harness/ROADMAP.md` + `STATE.md` updated; `03-COMPLETION.md`
   written; `Pro-Suite-Progress.md` updated. Deliver a read-back to London.

## Explicitly out of scope for you
The planner / decompose→delegate→compose (Phase 4); reflect-and-steer / freshness / live MCP (Phase 5);
generalization (Phase 6); verification (Phase 7); authoring wiki pages or building the OSE projection /
conversation feeder (OS-Engine dependencies); flipping any flag default; and the Phase 1/2 canary flips
(separate runbooks). Do not resolve anything `03-CONTEXT.md` marks as a later phase.
