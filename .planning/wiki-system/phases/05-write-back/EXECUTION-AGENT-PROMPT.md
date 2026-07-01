# Wiki System — Sub-phase 05 (Write-Back) Execution Agent Prompt

> Copy everything below this line into a new Claude Code session opened at `C:\Users\Hicks\ArchitectOS Pro_beta`.

---

You are the **execution agent** for Sub-phase 05 (Write-Back) of the ArchitectOS Wiki System build. You
build the narrow write surface and the domain-agent write-back path against **decided design**. You make
implementation choices (module layout, gate implementation), never design choices. If something needs a
design decision beyond the inputs, **stop and flag it**.

## Orient first (read these, in order)

1. `.planning/wiki-system/phases/05-write-back/05-RESEARCH.md` — build-ready extraction + the recall-gate boundary.
2. `.planning/wiki-system/phases/05-write-back/05-01-PLAN.md` — task spec + success criteria.
3. `.planning/wiki-system/phases/05-write-back/CONTEXT.md` — scope + file targets.
4. `.planning/wiki-system/phases/02-interface-contract/02-01-CONTRACT.md` "Write Operations" — the frozen
   signatures + actor scope you implement exactly.
5. `.planning/wiki-system/phases/03-schema-foundation/` — `wiki_claims`, `wiki_insight_records`, `wiki_action_log`.
6. `.planning/wiki-system/phases/04-compilation/` — reuse the `wiki_search`/dedup path for the novelty gate.
7. `api/vcso/writeback.ts` — the existing write-back bridge you extend.

## What you build

The six frozen mutations as FastAPI service methods (+ the write-back bridge):
- `propose_insight_claim(user_id, page_key, text, evidence[], confidence)` → run **all three D11 gates**
  (about_business / novelty via dedup vs existing claims+insights / confidence ≥ medium); page must be
  `insight_accreting`. On pass: insert `class='insight', status='quarantined'` claim + `wiki_insight_records`
  (`origin='domain_agent_writeback', trust_state='quarantined'`, gate flags). On fail: log rejection, write
  **nothing** to `wiki_claims`.
- `set_claim_confidence`, `flag_contradiction` (records both positions; never deletes a claim).
- `add_override` (**founder only**; `class='override'`; may set `superseded_by` on a compiled claim).
- `promote_insight` (**founder only**) — the only quarantined→trusted path; `trust_state='trusted'` +
  `wiki_claims.status='trusted'`; append a `promote` action-log row with before/after `payload`.
- `demote_insight` (founder) — reverses via the action-log `payload`; append a `demote` row.

Plus a **session-end flush entry point** (function/endpoint) that calls `propose_insight_claim` per
candidate insight — **producer of proposals only; never promotes.** (Live session-lifecycle invocation
is connection-phase.)

## Hard constraints

- **No `class='compiled'` writes.** There is no write-lock-marker-setting path in this surface; the 03
  trigger + 04 marker own compiled. Verify an attempt is rejected.
- **Actor-scope enforced at the API** (per 05-RESEARCH §7) on top of RLS.
- **Reasoning-only (D9):** the proposal path never sets `trusted`. Promotion is the only path, founder-only.
- **Every mutation** appends a `wiki_action_log` row with before/after `payload` (reversibility).
- **No recall incrementing, no auto-promotion, no consolidation, no validation/health, no UI.**
- **No freeform page rewrite** — only the narrow mutations.
- Reuse the 04 retrieval/dedup path for novelty; do not re-implement.

## Done when

All six success criteria in `CONTEXT.md` are met: actor-scope rejects unauthorized callers; the three
D11 gates run and only-quarantine-on-pass (and reject on `compiled_base_only` pages); promotion is
founder-only, sole path to trusted, reversible; every mutation is action-logged; the flush entry point
proposes (never promotes); compiled base is unreachable. Verify `python -m compileall python-backend` and
a propose→promote→demote round-trip on a seeded test user, plus a rejected out-of-band compiled write.
Report back: a one-paragraph summary, the new module name(s), and confirmation that the proposal path
cannot reach `trusted` and cannot write compiled. Then stop — sub-phase 06 is opened from the strategy thread.
