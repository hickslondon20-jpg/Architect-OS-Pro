# Wiki System — Sub-phase 08 (Acceptance) Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at `C:\Users\Hicks\ArchitectOS Pro_beta`.
>
> **Prerequisites:** Supabase write access (the path that applied migrations 03/04/06) and MCP usage
> limit clear. OpenAI quota for the real-embedding check (otherwise flag that one item open). 05/06/07
> code complete; 06 migration applied live.

---

You are the **execution agent** for Sub-phase 08 (Acceptance) of the ArchitectOS Wiki System build. You
build the end-to-end harness, **run it live**, clear the deferred live items, and write the acceptance
record. You assert decided guarantees — you do not add features or change design. If a guarantee fails,
**report it; do not paper over it.**

## Orient first (read these, in order)

1. `.planning/wiki-system/phases/08-acceptance/08-01-PLAN.md` — the scenario (steps 1–8) + assertions.
2. `.planning/wiki-system/phases/08-acceptance/CONTEXT.md` — scope, the **deferred live items**, prerequisites.
3. `.planning/wiki-system/phases/02-interface-contract/02-01-CONTRACT.md` — the guarantees → assertions.
4. `.planning/wiki-system/CONTEXT.md` §8 — the deferred-live-items list + all amendments.
5. The live services: `wiki_compilation.py`, `wiki_read.py`, `global_ip_read.py`, `wiki_writeback.py`,
   `wiki_health.py`, `wiki_consolidation.py`.

## What you build + run (live, against a scoped temp test user — never production data)

### The acceptance walk (assert each step)
1. **Event → compile.** Fire a diagnostic-run event → Diagnostic Synthesis compiles with ≥1 claim, each
   with ≥1 line-level evidence row.
2. **Read + precedence.** `wiki_get_page` returns claims with visible `class`/`trust`; add a founder
   override → assert override precedence over the compiled claim; `wiki_get_claim` returns full evidence.
3. **Search.** `wiki_search` returns the page across compiled+insight; `wiki_search_insight` scoped.
4. **Digest.** `wiki_read_digest` reflects the compile (one_line, counts, qualifiers current).
5. **Write-back.** `propose_insight_claim` on an insight-accreting page → quarantined + reasoning-only;
   assert NOT assertable + NOT trusted; a compiled-base page rejects it.
6. **Promotion.** `promote_insight` (founder) → trusted; `demote_insight` reverses; both action-logged.
7. **Health.** `wiki_health` surfaces a seeded contradiction + low-confidence + broken-provenance/orphan;
   Open Questions page receives the gap.
8. **Consolidation.** `run_consolidation` dedups a duplicate insight, flags a contradiction, retires a
   stale candidate, surfaces a gap — compiled base **byte-identical**; sets a `promotion_candidate`
   without promoting.

### Clear the deferred live items (CONTEXT §8)
- **06 functional** (if not already cleared by the 06 agent): broken-provenance + off-taxonomy flagged-
  not-dropped; `wiki_health` live; counts → digest; post-compile hook.
- **05 live write-surface**: propose→promote→demote against live RLS + write-lock + actor-scope.
- **07 live consolidation**: the step-8 run, asserting compiled-base byte-identical.
- **Real-embedding check**: `compile_page` + `wiki_search` with real `text-embedding-3-small`; confirm
  semantically relevant ranking. **If OpenAI quota is still down, record it as the single open item and
  proceed — do not fabricate embeddings.**

### Guarantee assertions (all must pass)
- Compiled base written **only** by the compilation path (out-of-band `class='compiled'` insert → rejected).
- Founder JWT **cannot** read `global_ip_pages`; service-role can.
- Quarantined insight **never** reaches trusted without `promote_insight`.
- Every mutation has an action-log row; every promotion is reversible.
- No code path in compilation / write-back / consolidation crosses into a forbidden layer.

## Hard constraints

- **Isolated test data only** — a clearly-scoped temp test user (or a Supabase branch); clean up after.
  Never mutate the existing seeded/production rows.
- **No chat / router / stage-primer / UI wiring** — that is the connection phase.
- **No new features, schema, or mutations.** Assertion + harness only.
- **Do not fake** embeddings or any live result to make a check pass — flag what can't run.

## Done when

The full scenario runs green, all guarantee assertions pass, the deferred live items are cleared (or the
embedding check explicitly flagged open if quota is down), and `08-01-ACCEPTANCE.md` records results and
states the contract `wiki-1.0` is **stable and ready for the connection-phase (Phase 9) handoff**. Verify
`python -m compileall python-backend` and `npm.cmd run build`. Report back: a one-paragraph summary, the
green/flagged status of each step + each deferred item, and the acceptance verdict. Then stop — the wiki
build is complete in isolation; the connection phase is opened from the strategy thread.
