# Sub-phase 05 Context — Write-Back

**Date:** 2026-06-30
**Outcome:** Ready to execute. The mutations are frozen by the contract, the schema is live, compile +
read are working (04). This sub-phase builds the **write surface** and the domain-agent write-back path.

---

## What this sub-phase is

Where insights *enter* the wiki — always quarantined, always reasoning-only, never touching the
compiled base, with founder-confirmation as the only promotion path. It implements the six frozen
mutations, the D11 qualification gates, the session-end flush entry point, and reversible promotion.
There is **no freeform page rewrite** anywhere in this surface.

---

## Inputs the agent must read first

1. `05-RESEARCH.md` (this folder) — build-ready extraction + the recall-gate boundary.
2. `05-01-PLAN.md` (this folder) — task spec + success criteria.
3. `../02-interface-contract/02-01-CONTRACT.md` "Write Operations" — the frozen signatures + actor scope.
4. `../03-schema-foundation/` — `wiki_claims` (class/status), `wiki_insight_records`, `wiki_action_log`.
5. `../04-compilation/` — reuse the dedup/`wiki_search` path for the novelty gate; do not re-implement.
6. `../../CONTEXT.md` §4.3/L9/§8 — the write surface, confidence bar, D9 reasoning-only.
7. `api/vcso/writeback.ts` — the existing chat→N8N writeback bridge this path extends.

---

## Decisions already made (do not re-open)

- The six mutations + their actor scope are **frozen by the contract**. Implement as written.
- D11 gates: about_business / novelty / confidence ≥ medium (L9).
- Promotion is founder-confirmation only; the only quarantined→trusted path; reversible via action-log.
- Quarantined insight is reasoning-only (D9) — never set `trusted` from the proposal path.
- **No recall incrementing, no auto-promotion** here (07 / connection-phase).
- **No `class='compiled'` writes** — there is no marker-setting path in this surface.

---

## What this sub-phase does NOT do

- No compiled writes (04 only). No compilation/digest logic.
- No validation/health (06), no consolidation/dreaming (07).
- No recall-stat incrementing, no machine auto-promotion (post-beta / connection-phase).
- No UI — the override/promotion **surfaces** map to `ose_page_corrections`/`NotesComposer` at the UI
  layer, which is connection-phase. Here: mutation logic + storage only.
- No live chat invocation of the flush — build the entry point; the session-lifecycle hook is connection-phase.

---

## Files to be created or modified

| File | Action | Notes |
|---|---|---|
| `python-backend/services/wiki_writeback.py` (or similar) | **Create** | The six mutations + D11 gates + actor-scope guards + action-log writes. |
| flush entry point (function/endpoint) | **Create** | Calls `propose_insight_claim` per session candidate; producer only. |
| `api/vcso/writeback.ts` | **Modify (bridge)** | Extend the existing write-back bridge to the new proposal path. |

---

## Success criteria (from `05-01-PLAN.md`)

1. All mutations enforce actor-scope; unauthorized actor/class is rejected.
2. `propose_insight_claim` runs all three D11 gates and only quarantines on pass; rejects on `compiled_base_only` pages.
3. Promotion is founder-only, the sole quarantined→trusted path, and reversible via the action-log.
4. Every mutation appends a `wiki_action_log` row with before/after payload.
5. Session-end flush entry point exists and calls `propose_insight_claim` (no promotion).
6. Compiled base is unreachable by every endpoint here (no marker-setting path).

---

## Handoff

When the write surface is working (propose → quarantined + reasoning-only; promote → trusted +
reversible; compiled base untouched), the strategy thread opens **sub-phase 06 (validation-health)** —
the A7 checks + B8 dashboards (lighter extraction; REFERENCES already pins the exact lists).

*Context written: 2026-06-30 — Discuss/Plan thread.*
