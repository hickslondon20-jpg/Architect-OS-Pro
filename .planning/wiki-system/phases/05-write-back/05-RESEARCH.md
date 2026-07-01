# Sub-phase 05 — Reference Extraction (build-ready)

**Purpose:** turns the `REFERENCES.md` pointers for sub-phase 05 into decided design for `05-01-PLAN.md`:
the narrow write surface, the domain-agent write-back path, the D11 gates, the session-end flush, and
reversible promotion. Builds against the frozen contract (`wiki-1.0`) and the live schema.

**The mutations are already frozen by the contract** (`02-01-CONTRACT.md` "Write Operations"). This file
adds the *behavior* the contract didn't pin: the D11 gate logic, the flush firing point, reversibility,
and the recall-gate boundary.

**Sources (verified 2026-06-29):** OpenClaw memory-wiki ("Agent tools" → `wiki_apply`), memory overview
("Automatic memory flush", "Grounded backfill and live promotion", "Dreaming" gates).

---

## 1. B6 — Narrow mutations (`wiki_apply`) → the six contract endpoints

**Extracted:** `wiki_apply` = "narrow synthesis/metadata mutations without freeform page surgery."

**Our build (implement the contract's six, as FastAPI service methods + the existing
`api/vcso/writeback.ts` bridge):**
```
propose_insight_claim(user_id, page_key, text, evidence[], confidence)  -> {insight_id, status:'quarantined'}
set_claim_confidence(user_id, claim_id, confidence)
flag_contradiction(user_id, claim_id, against_claim_id|page_ref, note)
add_override(user_id, page_key, claim_id?, text)
promote_insight(user_id, insight_id)
demote_insight(user_id, insight_id)
```
**No freeform page rewrite anywhere.** Every mutation appends a `wiki_action_log` row. **No** mutation
writes `class='compiled'` (the 03 trigger + 04 marker own that — there is no marker-setting path here).

---

## 2. D11 gates on `propose_insight_claim` (the only insertion of new insight)

Run all three before quarantining (CONTEXT L9, spec §4):
- **about_business_ok** — about the founder's business, not a generic framework restatement.
- **novelty_ok** — not already covered by an existing claim/insight (dedup check vs `wiki_claims` +
  `wiki_insight_records`; reuse the vector/`wiki_search` path from 04).
- **confidence_bar_ok** — proposed `confidence >= medium` (the beta bar, L9; tunable).

Page must be `insight_accreting` (reject on `compiled_base_only` pages). On pass: insert
`class='insight', status='quarantined'` `wiki_claims` row + a `wiki_insight_records` row
(`origin='domain_agent_writeback', trust_state='quarantined'`, gate flags recorded). On fail: write a
rejection to `wiki_action_log` and **nothing** to `wiki_claims`.

---

## 3. B5 — Write-back trigger = session-end / pre-compaction flush

**Extracted (OpenClaw "Automatic memory flush"):** before compaction, a silent turn reminds the agent
to save important context so insights aren't lost.

**Our build:** a **flush entry point** (callable function/endpoint) that, given a session's candidate
insights, calls `propose_insight_claim` for each — **producer of proposals only; it never promotes.**
The actual invocation from the live Virtual CSO session lifecycle is **connection-phase**; here build the
entry point + the proposal path so it is testable in isolation.

---

## 4. B4 — Staging + reversibility (promote / demote)

**Extracted:** nothing writes trusted directly; staging→promotion is the only path; promotions are
auditable and reversible.

**Our build:**
- `promote_insight` (**founder only**, D10/2a) — the **only** quarantined→trusted path:
  `wiki_insight_records.trust_state='trusted'`, linked `wiki_claims.status='trusted'`; append a
  `promote` action-log row with before/after `payload`.
- `demote_insight` (founder) — reverses using the action-log `payload` (trust_state→quarantined,
  status→quarantined); append a `demote` row.
- Reversibility is real because `wiki_action_log.payload` carries before/after state (B4/A4).

---

## 5. D9 — Reasoning-only enforcement

Quarantined insight is returned by reads (04) with `trust:quarantined` and is **non-assertable**: it may
shape the agent's line of inquiry but is never stated as a finding until promoted. Two-gate hallucination
defense: (a) cannot be asserted (reasoning-only), (b) cannot reach trusted without founder sign-off
(promotion). 05 must keep the proposal path from ever setting `trusted` directly.

---

## 6. B3 — Recall gates: boundary for 05 (avoid scope creep)

The fields exist (`recall_score` on claims; `recall_count` / `query_diversity` on insight records).
**Beta promotion = founder confirmation** (`promote_insight`) and does **not** require the recall gates.
The recall gates are a **candidate-surfacing aid**:
- **07 (consolidation)** sets `trust_state='promotion_candidate'` from recall signal.
- Incrementing recall stats on *genuine* retrieval happens during live recall — a **connection-phase**
  concern (real sessions). **05 does not build recall incrementing.** Note the seam; don't fill it.

---

## 7. Actor-scope matrix (enforce hard)

| Mutation | Allowed actor |
|---|---|
| `propose_insight_claim`, `flag_contradiction` | domain agent (+ founder) |
| `set_claim_confidence` | compilation service (compiled, via compile only) / founder (override + reviewed insight) |
| `add_override` | founder only |
| `promote_insight`, `demote_insight` | founder only |
| *(write `class='compiled'`)* | **none here** — compile path only |

Reject unauthorized actor/class at the API, in addition to the 03 RLS + write-lock trigger.

---

## 8. Extract / skip summary

| Adopt (semantics) | Reject (substrate) |
|---|---|
| narrow mutations (B6); flush firing point (B5); staging→promotion-only + reversibility (B4); reasoning-only (D9) | `wiki_apply` CLI verb/shape; markdown surgery; building recall-increment or auto-promotion (post-beta / connection-phase) |

*Extraction complete for sub-phase 05. The agent implements the six frozen mutations + D11 gates + the
flush entry point + reversible promotion against the live schema; no compiled writes, no recall
incrementing, no auto-promotion, no UI.*
