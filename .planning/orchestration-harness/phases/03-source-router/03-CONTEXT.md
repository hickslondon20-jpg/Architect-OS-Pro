# Phase 3 Context — Tier-Escalating Source Router

**Phase:** 03 of the Orchestration Harness workstream.
**Read first:** the workstream `../../CONTEXT.md` (Principle #3 build-time-over-query-time, #1 cheap
compact inputs; Conflict Register O2/O3; Named dependencies), `../../ROADMAP.md` (Phase 3),
`../../REQUIREMENTS.md` (ROUT-1..5), and Phases 1–2 (`../01-working-state-memory/01-CONTEXT.md` — the
`assemble()` seam; `../02-intent-read/02-CONTEXT.md` — the intent classification this consumes). North
Star `../../../COGNITIVE-ORCHESTRATION-ARCHITECTURE.md` §5 (source selection) + `../../../INTELLIGENCE-LAYER-ARCHITECTURE.md`
(Tiers 0–3) win over any reference.

---

## Why this phase, and what it is

The reconciliation named the router **the single biggest missing piece of the spine.** Today the VCSO
preloads a keyword-selected wiki slice and hands the model a flat tool bag it calls at will — there is
no cost-aware, cheapest-first escalation. Phase 3 builds the **retrieval half of the spine**: a
deterministic **source router** that escalates only as far as the moment requires —
**Tier-0 records → Tier-1 wiki components → Tier-2 semantic → Tier-3 raw docs** — stopping at the
cheapest sufficient source, composing the existing retrieval primitives rather than rebuilding them.
(The **live-external / MCP tier + freshness policy is Phase 5**; Phase 3 builds the escalation
framework over the four internal tiers with a clean hook for the live tier.)

It composes with Phases 1–2: the router consumes the Phase 2 **intent + depth** to choose where to
start and how far to escalate, and it feeds selected sources into the Phase 1 **`assemble()` seam**.
It is the first phase that changes retrieval *behavior* materially, so quality is the co-equal gate,
and it ships behind its own flag, fail-open to today's flat tool bag.

## What this phase is NOT

- **Not the planner (P4).** The router selects *sources* for a turn; it does **not** decompose a
  strategic ask into sub-questions or delegate to workers. Decompose→delegate→compose is Phase 4.
- **Not live MCP / freshness (P5).** Tiers 0–3 only; leave a documented hook for the live tier.
- **Not new retrieval primitives.** Tier-2 hybrid search (`retrieval.py`), Tier-3 KB tools, Tier-1
  wiki reads (`WikiReadService`/`DocWikiReadService`), Tier-0 structured records already exist — the
  router **orchestrates** them.
- **Not a self-judged quality-score loop.** Escalation is **rule-based / deterministic** (MA-06
  posture) — driven by intent, rules, and component availability — not a fuzzy "is this good enough."
- **Not OS-Engine work.** The wiki-page expansion and the `wiki_*`→OSE projection remain OS-Engine
  dependencies; Phase 3 *consumes* what exists and degrades gracefully.

## The mechanism (build to this; confirm the checkpoint items)

```
turn (flag on):
  intent (P2) ─▶ ROUTER: pick starting tier + escalation plan (rule-based)
     Tier-0 structured records (MRA / AE Ladder / sprints / Quarter Map)   ← cheapest
     Tier-1 wiki components (TWO-SOURCE per O2: wiki_* fixed-7 + ose Layer-2)
     Tier-2 semantic (hybrid RRF + optional rerank)
     Tier-3 raw docs (kb_ls/tree/grep/glob/read)                            ← costliest
   → escalate only until sufficient → feed selected sources into assemble() (P1 seam)
   → the existing tool loop remains as the model's mid-turn escalation fallback
   → record the routing decision per turn; render sanitized through MA-05
```

**Rule-based escalation (deterministic, MA-06 posture).** Start tier + escalation are driven by the
intent/depth and deterministic signals, e.g.: a Tier-0 factual record question answers from records;
a strategic synthesis composes Tier-1 components; escalate to Tier-2/3 when the needed component is
**absent** or the intent demands **raw evidence** (e.g., "what does document X say"). No quality-score
self-judgment.

**Hybrid governance (recommended — checkpoint).** The router deterministically pre-fetches the
cheapest sufficient tier into assembly (the cost win + the common path), **and** the existing
model-driven tool loop stays available so the model can escalate mid-turn if the router under-fetched
(quality fail-safe). Flag off ⇒ today's flat tool bag, unchanged.

## Decisions that shape this phase (grounded; confirm the checkpoint items)

1. **Two-source Tier-1 read (O2, resolved Phase 0).** Compose the seven fixed pages from `wiki_*`
   (`WikiReadService`); emergent Layer-2 from `ose_knowledge_pages` (`DocWikiReadService`). **Do not**
   depend on the unverified `wiki_*`→OSE-Layer-1 projection.
2. **Modular, extensible founder-context (ROUT-5).** Tier-1 consumption treats founder context as
   composable components — business *and* founder-operating pages — grabbed as needed, **never the
   fixed 7**; a missing page degrades gracefully (absent component ≠ failure). New founder-operating
   pages are an OS-Engine authoring dependency.
3. **Consumes intent when present, degrades when absent.** With Phase 2's flag off, the router uses a
   conservative default (treat as strategic/full tier coverage); when intent is on, it routes on it.
4. **Rule-based escalation only** (deterministic); quality-score loops deferred.
5. **Records the routing decision per turn** (start tier, escalations, sources) for observability +
   P4, rendered sanitized through MA-05 (no raw reasoning).
6. **Founder isolation + tool permissions unchanged** (ROUT-4).
7. **Own flag, prove-then-flip, flips after Phases 1–2.** Behind `vcso_source_router` (default off),
   fail-open to the flat tool bag; proven on live before any default flip.

## Success criteria (from ROADMAP Phase 3 — ROUT-1..5)

1. **ROUT-1:** cheapest-first escalation over Tiers 0–3, stopping at the cheapest sufficient source,
   composing existing primitives; a live-tier hook is documented (Phase 5 fills it).
2. **ROUT-2:** wiki-component composition (two-source per O2), not raw re-crawl.
3. **ROUT-3:** routing decisions recorded per turn and rendered through MA-05.
4. **ROUT-4:** founder isolation + existing tool permissions unchanged.
5. **ROUT-5:** modular, extensible founder-context consumption (never the fixed 7; graceful degradation).
6. **Cost + quality proof (co-equal):** on live (canary), simple/record questions escalate *less*
   (cheaper) and strategic questions compose from components without a full raw re-crawl, with **no
   quality regression** on a mixed set (records answered from Tier-0; strategic cited from components;
   "what does doc X say" still reaches Tier-3). Paired trace + DB/output.
7. Workstream `ROADMAP.md` + `STATE.md` updated; `03-COMPLETION.md` written.

## Locked decisions (founder-confirmed 2026-07-13)

- **Router governance model: hybrid.** The router deterministically pre-fetches the cheapest sufficient
  tier into assembly (cost win + common path), **and** the existing model-driven tool loop stays
  available for mid-turn escalation when the router under-fetches (quality fail-safe). Flag off ⇒
  today's flat tool bag, unchanged.
- **Escalation triggers: rule-based / deterministic.** Driven by intent/depth (when present) +
  component availability + "raw-evidence" intents ("what does document X say" → Tier-3). **Quality-score
  self-judgment is explicitly deferred** (MA-06 posture).
- **Flag + dependency posture:** separate `vcso_source_router` (default off), fail-open; its production
  flip lands **after** Phases 1–2. The router consumes intent **when present** and degrades
  conservatively when Phase 2 is off; its live proof needs the canary on Phase 1 (and ideally Phase 2),
  sequenced with the batched proofs.
- **Tiers 0–3 only in Phase 3; live-external tier + freshness are Phase 5** — Phase 3 leaves a
  documented no-op hook for the live tier.
