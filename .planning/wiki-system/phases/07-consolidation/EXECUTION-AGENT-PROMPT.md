# Wiki System — Sub-phase 07 (Consolidation / Dreaming) Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at `C:\Users\Hicks\ArchitectOS Pro_beta`.
>
> **Prerequisite:** Sub-phase 06 must be green **live** (migration applied + functional smoke passed) —
> `run_consolidation`'s assess step calls `wiki_health` / `wiki_validation_findings`. Confirm 06 live
> before running an end-to-end consolidation test.

---

You are the **execution agent** for Sub-phase 07 (Consolidation / Dreaming) of the ArchitectOS Wiki
System build. You build the internal consolidation cycle against **decided design**. Implementation
choices only, never design choices. If something needs a design decision beyond the inputs, **stop and
flag it**.

## Orient first (read these, in order)

1. `.planning/wiki-system/phases/07-consolidation/07-RESEARCH.md` — the loop, fix steps, the **dormant
   gate** note (§0), guardrails, scheduling.
2. `.planning/wiki-system/phases/07-consolidation/07-01-PLAN.md` — task spec + success criteria.
3. `.planning/wiki-system/phases/07-consolidation/CONTEXT.md` — scope + file targets + the 06 gate.
4. `.planning/wiki-system/phases/06-validation-health/` — `wiki_health` / `wiki_validation_findings`.
5. `.planning/wiki-system/phases/05-write-back/` — `wiki_insight_records`, `promote/demote`, action-log.
6. `.planning/wiki-system/phases/04-compilation/` — the compiled base you must never touch.
7. `.planning/wiki-system/CONTEXT.md` — L7 guardrails, §3 framing, §8 (D15: FastAPI executes / n8n triggers).

## What you build

`run_consolidation(user_id)` (FastAPI), **assess → fix → verify**:
- **Assess:** call the 06 validation set + `wiki_health`; scan the insight layer for overlap /
  contradiction / staleness.
- **Fix — write-scoped to the insight layer + Open Questions ONLY:**
  - dedup overlapping insight claims (merge, union evidence, retire merged-away ids);
  - reconcile insight vs latest compiled base (mark superseded / retire candidate — never edit the
    compiled claim);
  - flag contradictions (`wiki_contradictions`; never resolve);
  - retire stale candidates (`status='retired'`; reversible);
  - surface gaps as **questions** on the `open_questions` page (never answers).
- **Verify:** re-run the 06 checks until clean (or no safe action remains); append a `consolidate`
  action-log row with a per-claim change list.

Plus the **promotion-candidate gate (build it; it is dormant in beta):** where an insight passes the
threshold gates (`recall_score` / `recall_count` / `query_diversity` ≥ mins), set
`trust_state='promotion_candidate'`. **Never call `promote_insight`; never set `trusted`; never
auto-promote.** Expect it to surface nothing in beta (recall signals unincremented — that is correct).

Scheduling: an endpoint n8n cron calls (D15). **Unlaunched/internal** — no founder-facing surface, no
DREAMS.md / Dream Diary / CLI / UI.

## Hard constraints (assert in code + tests)

- **No write path touches `class='compiled'`** — test: compiled-claim checksums unchanged across a run.
- **No path sets `trust_state='trusted'`** — founder `promote_insight` only.
- **Write-scope = insight layer + Open Questions only.**
- Every change in `wiki_action_log`, reversible; retire is a status, not a delete.
- **Beta:** build the gate but do not fabricate recall data; do not build recall incrementing
  (connection-phase) or the full 6-signal weighting (post-beta).
- No new validation checks (consume 06's). No reference-repo substrate.
- Flag extensibility points for the founder's forthcoming maintenance/dreaming material (spec §3).

## Done when

All six success criteria in `CONTEXT.md` are met: the cycle dedups/reconciles/flags/retires/surfaces-gaps
touching only insight + Open Questions; compiled base provably untouched; no auto-promotion (only
dormant `promotion_candidate`); every change action-logged + reversible; runs on schedule with no
founder-facing surface. Verify `python -m compileall python-backend` and — **once 06 is green live** — a
live `run_consolidation` on a seeded user with duplicate + stale + contradictory insights, asserting the
compiled base is byte-identical before/after. Report back: a one-paragraph summary, the new module/
endpoint, and confirmation the compiled-base-untouched + no-auto-promote guarantees held. Then stop —
sub-phase 08 is opened from the strategy thread.
