# Sub-phase 07 Context — Consolidation (Dreaming, Internal)

**Date:** 2026-06-30
**Outcome:** Ready to author/execute. Deep extraction done (`07-RESEARCH.md`). **Execution gated on 06
green live** — `run_consolidation`'s assess step calls the 06 `wiki_health`/validation functions (06
migration is applied; functional smoke pending the agent). Authoring is not gated.

---

## What this sub-phase is

The consolidation ("dreaming") cycle that keeps the insight layer coherent as write-back accretes.
**Primary role = consolidation, not invention.** Built and run **internally / unlaunched** (L7/D2).
Write-scoped to the **insight layer + Open Questions only** — never the compiled base, never auto-promote.

---

## Inputs the agent must read first

1. `07-RESEARCH.md` (this folder) — the loop, the fix steps, the dormant gate, the guardrails, scheduling.
2. `07-01-PLAN.md` (this folder) — task spec + success criteria.
3. `../06-validation-health/` — `wiki_health` / `wiki_validation_findings` (the assess step consumes them).
4. `../05-write-back/` — `wiki_insight_records`, `promote_insight`/`demote_insight`, the action-log pattern.
5. `../04-compilation/` — the compiled base it must never touch; the FastAPI/service-role pattern.
6. `../../CONTEXT.md` — L7 guardrails, §3 dreaming framing, §8 (D15 = FastAPI executes / n8n triggers).

---

## Decisions already made (do not re-open)

- Consolidation is **internal / unlaunched**; no founder-facing surface, no Dreams UI/CLI.
- Write-scope = **insight layer + Open Questions only**; never `class='compiled'`, never `trust_state='trusted'`.
- The **promotion-candidate gate is built but dormant in beta** (recall signals unincremented until
  connection-phase recall tracking); consolidation's main job runs regardless.
- Full 6-signal weighting = post-beta; beta gate stays simple.
- FastAPI executes `run_consolidation`; n8n cron triggers it (D15).
- Everything reversible via `wiki_action_log`; retire is a status, not a delete.

---

## What this sub-phase does NOT do

- No compiled-base writes; no `trusted` transitions; no auto-promotion.
- No founder-facing launch (no UI, no slash command, no DREAMS.md / Dream Diary).
- No new validation checks (07 consumes 06's).
- No recall incrementing (connection-phase); no full 6-signal scoring (post-beta).
- No reference-repo substrate (no `.dreams/` store, no markdown vault).

---

## Files to be created or modified

| File | Action | Notes |
|---|---|---|
| `python-backend/services/wiki_consolidation.py` (or similar) | **Create** | `run_consolidation(user_id)`: assess→fix→verify; the dormant gate; reversibility. |
| `python-backend/main.py` (+ router) | **Modify** | The `run_consolidation` endpoint n8n cron calls. |
| n8n | **Trigger only** | Cron → call the endpoint. (Documented; no wiki-table writes.) |

---

## Success criteria (from `07-01-PLAN.md`)

1. Cycle dedups, reconciles, flags, retires, and surfaces gaps — touching only insight + Open Questions.
2. Compiled base is provably untouched (compiled-claim checksums unchanged across a run).
3. No auto-promotion occurs; only `promotion_candidate` flags are set (and dormant in beta).
4. Every change is in the action-log and reversible.
5. Runs on schedule internally with no founder-facing surface.
6. Extensibility points for the founder's forthcoming maintenance material are flagged.

---

## Handoff

When consolidation runs internally and the guardrails hold under test, the strategy thread opens
**sub-phase 08 (acceptance)** — the end-to-end isolation harness, where the tracked live items
(06 functional, 05 live write-surface, real embeddings) are cleared and the full loop is asserted.

*Context written: 2026-06-30 — Discuss/Plan thread.*
