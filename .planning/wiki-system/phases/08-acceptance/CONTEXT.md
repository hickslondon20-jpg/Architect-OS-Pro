# Sub-phase 08 Context — Acceptance

**Date:** 2026-06-30
**Outcome:** Ready to execute (once 05/06/07 live runs are clear — see prerequisites). This sub-phase
adopts **no new reference patterns** — it **asserts** the frozen contract's guarantees end-to-end and
**clears the deferred live items** the prior sub-phases parked for environmental reasons.

---

## What this sub-phase is

The done-gate for the wiki build. It proves the wiki works as a **self-contained capability with no
chat/router/UI wiring** (CONTEXT §1) and clears the live-verification debt. Output: an automated harness
+ `08-01-ACCEPTANCE.md` declaring the contract (`wiki-1.0`) stable and ready for the connection phase.

---

## Inputs the agent must read first

1. `08-01-PLAN.md` (this folder) — the end-to-end scenario (steps 1–8) + the guarantee assertions.
2. `../02-interface-contract/02-01-CONTRACT.md` — the hard guarantees become the harness assertions.
3. `../../CONTEXT.md` §8 — the **deferred live items** this sub-phase must clear (listed below).
4. All prior sub-phase CONTEXTs (01–07) — the surfaces under test.
5. The live services: `wiki_compilation.py`, `wiki_read.py`, `global_ip_read.py`, `wiki_writeback.py`,
   `wiki_health.py`, `wiki_consolidation.py`.

---

## Deferred live items to CLEAR here (from CONTEXT §8)

These were parked for environmental reasons (OpenAI quota, Supabase access/usage limits). 08 runs them
against live Supabase:
1. **06 functional smoke** — seed a broken-provenance claim + an off-taxonomy tag → flagged-not-dropped;
   `wiki_health` live returns the five dashboards; counts land in `wiki_digest.digest.counts`; post-compile
   hook fires. *(If the 06 agent already cleared this, 08 re-confirms.)*
2. **05 live write-surface smoke** — `propose → promote → demote` against live RLS + the write-lock
   trigger + actor-scope (unauthorized promotion rejected; compiled-base proposal rejected).
3. **07 live consolidation run** — on a seeded user with duplicate + stale + contradictory insights;
   compiled base **byte-identical** before/after; no auto-promotion.
4. **Real-embedding check** — `compile_page` + `wiki_search` with real `text-embedding-3-small`
   embeddings, confirming semantically relevant ranking. **Gated on OpenAI quota** — if still unavailable,
   record it as the single open item and proceed (do not fake it).

---

## What this sub-phase does NOT do

- No chat / retrieval-router / intent-classifier / stage-primer-injection wiring — that is the connection phase.
- No UI. No new features, schema, or mutations.
- No new reference-repo extraction.

---

## Files to be created or modified

| File | Action | Notes |
|---|---|---|
| harness (`python-backend` pytest + `vitest` for TS surfaces) | **Create** | Exercises the full loop; asserts the guarantees. |
| `08-01-ACCEPTANCE.md` (this folder) | **Create** | Results + explicit statement the contract `wiki-1.0` is stable + ready for connection-phase handoff. |

---

## Success criteria (from `08-01-PLAN.md`)

1. The full scenario runs green (event→compile→read+precedence→search→digest→write-back→promotion→health→consolidation).
2. All guarantee assertions pass (write-lock single-writer; founder cannot read `global_ip_pages`;
   quarantined never reaches trusted without `promote_insight`; every mutation action-logged + reversible;
   no forbidden-layer crossing).
3. Harness runs against an isolated test DB/branch (or clearly-scoped temp test user), not production data.
4. `08-01-ACCEPTANCE.md` records results and states `wiki-1.0` is stable for Phase 9 handoff.
5. The four deferred live items are cleared (or the embedding check is explicitly flagged open if quota is down).

---

## Prerequisites

- **Supabase write access** (service-role / the path that applied 03/04/06) and MCP usage limit clear.
- **OpenAI quota** for the real-embedding check (item 4) — otherwise that one item stays flagged open.
- 05/06/07 code complete (done); 06 migration applied live (done).

---

## Handoff

When 08 passes and `08-01-ACCEPTANCE.md` declares `wiki-1.0` stable, the wiki build is **done in
isolation.** The connection phase (retrieval router, cross-tier assembly, stage-primer, wiring into
Virtual CSO / OS Engine / Domain Agents, CSO persona layer) goes back to the KB Explorer planner as the
next, separate phase — consuming this frozen contract.

*Context written: 2026-06-30 — Discuss/Plan thread.*
