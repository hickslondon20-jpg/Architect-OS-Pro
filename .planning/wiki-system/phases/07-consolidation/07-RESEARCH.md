# Sub-phase 07 — Reference Extraction (build-ready)

**Purpose:** turns the `REFERENCES.md` pointers for sub-phase 07 into decided design for `07-01-PLAN.md`:
the internal consolidation ("dreaming") cycle — built and run **internally, unlaunched** (L7/D2),
write-scoped to the insight layer + Open Questions, never the compiled base, never auto-promote.

**Sources (verified 2026-06-29 / 2026-06-30):** theafh `auto_shaper_wiki` agent + `<lint_and_audit>`
(A5 assess→fix→verify loop); OpenClaw `concepts/dreaming` (B3 gates, phase separation), memory overview
(B4 staging/reversibility). **Our L7 guardrails OVERRIDE both repos' write models.**

**Execution gate:** 07 runs `run_consolidation`, whose assess step calls the 06 `wiki_health` /
`wiki_validation_findings`. **07 execution is gated on 06 being green live** (migration applied —
done; functional smoke — pending the agent). Planning/authoring is not gated.

---

## 0. Primary role + the beta-dormant gate (read first)

Per spec §3, dreaming's **primary and safest job is consolidation, not invention** — it tends the
insight layer. The **promotion-candidate gate is secondary and recall-data-dependent.** In beta the
recall signals (`recall_count`, `query_diversity`) are **unincremented** (05 deliberately did not build
recall incrementing; live recall is connection-phase). So:
- **Consolidation runs and does its main job in beta** (dedup / reconcile / flag / retire / surface gaps).
- **The promotion-candidate gate is BUILT but DORMANT** until recall data flows (post-beta / once
  connection-phase recall tracking runs). Build the gate; expect it to surface nothing yet. Don't
  fake recall data.

---

## 1. A5 — `auto_shaper_wiki` assess→fix→verify loop → `run_consolidation(user_id)`

**Extracted (theafh):** "a complete assess → fix → verify loop in an isolated context: runs `lint.py`,
audits the prose, fixes every blocking/warn finding, splits/relocates pages, re-lints until clean,
appends the audit entry to `log.md`, and reports a per-file change list."

**Our build:** `run_consolidation(user_id)` runs **assess → fix → verify**:
- **Assess:** call the 06 validation set + `wiki_health`; scan the insight layer for overlap /
  contradiction / staleness.
- **Fix** (see §2 — write-scoped).
- **Verify:** re-run the 06 checks until clean (or no further safe action); append a `consolidate`
  row to `wiki_action_log` with a per-claim change list.

**Our guardrail OVERRIDES theirs:** their loop edits pages **in place**; ours may write **only** the
insight layer + the Open Questions page. Reject in-place edits to compiled base or override.

---

## 2. Fix steps — write-scoped (insight layer + Open Questions ONLY)

| Step | Operation (schema) |
|---|---|
| **Deduplicate** overlapping insight claims | merge into one `class='insight'` claim; union evidence; log; retire the merged-away ids |
| **Reconcile** insight vs latest compiled base | where an insight is now contradicted by / absorbed into a compiled claim → mark superseded / retire candidate (never edit the compiled claim) |
| **Flag contradictions** | write `wiki_contradictions`; **never resolve** (A3 record-both-positions) |
| **Retire stale candidates** | `wiki_claims.status='retired'` (+ `wiki_insight_records`); action-log; reversible |
| **Surface gaps as Open Questions** | append **questions** to the `open_questions` page; **never answers** |

Nothing here writes `class='compiled'` or sets `trust_state='trusted'`.

---

## 3. B3 — promotion-candidate gate (built, dormant in beta)

**Extracted (OpenClaw dreaming "Deep phase"):** the only durable-writing phase; ranks candidates with
weighted scoring and **threshold gates** — `minScore`, `minRecallCount`, `minUniqueQueries` must pass.
Six weighted signals (Frequency .24, Relevance .30, Query diversity .15, Recency .15, Consolidation .10,
Conceptual richness .06).

**Our build:** where an insight passes the threshold gates (our `recall_score` ≥ min, `recall_count` ≥
min, `query_diversity` ≥ min), set `wiki_insight_records.trust_state='promotion_candidate'` — **surfacing
it for founder confirmation** (`promote_insight`, 05). **Consolidation NEVER calls `promote_insight`;
never auto-promotes** (D10 beta = founder confirmation). Adopt the **threshold-gate concept**; the full
6-signal weighting is a **post-beta enrichment** (logged, not built for beta — beta gate stays simple
and dormant per §0).

---

## 4. B4 — reversibility

Every consolidation change (merge / retire / flag / candidate-flag) lands in `wiki_action_log`
(`action='consolidate'` or `'retire'`) with before/after `payload`, so it is auditable and reversible —
the same log `demote_insight` (05) reads. Nothing is hard-deleted; retire is a status, not a delete.

---

## 5. Hard guardrails (L7 — assert in code + tests)

- **No write path touches `class='compiled'`.** (Test: compiled-claim checksums unchanged across a run.)
- **No path sets `trust_state='trusted'`** (only founder `promote_insight` can).
- **Write-scope = insight layer + Open Questions only.**
- All writes in `wiki_action_log`, reversible.
- OpenClaw's phase lesson reinforces this: of its three phases, only the gated "deep" step writes
  durably — and **we cap even that below `trusted`** (we stop at `promotion_candidate`).

---

## 6. Scheduling (D15: FastAPI executes, n8n triggers)

`run_consolidation` is a **FastAPI** service (holds the service-role connection; if it ever needs to mark
a retire on a compiled-adjacent record it still cannot write `class='compiled'`). **n8n cron** triggers
it (OpenClaw default `0 3 * * *` is a reasonable cadence reference). **Unlaunched / internal:** no
founder-facing entry point, no slash command, no Dreams UI. It runs quietly so the insight layer stays
coherent from day one.

---

## 7. Extract / skip summary

| Adopt (loop + gate + reversibility) | Reject (substrate) |
|---|---|
| assess→fix→verify loop (A5); threshold-gate concept → `promotion_candidate` (B3); reversible action-log (B4); "only gated step writes durably" discipline | in-place page edits; `DREAMS.md` / Dream Diary / `memory/.dreams/` files; the 3-phase naming; the full 6-signal weighting (post-beta); CLI / Dreams UI / slash commands |

**Pending-input note (spec §3):** the founder may extend the maintenance/dreaming material. Build the
cycle to be extensible; flag any spot where additional founder material is expected.

*Extraction complete for sub-phase 07. The agent builds `run_consolidation` (assess→fix→verify,
write-scoped to insight + Open Questions), the dormant promotion-candidate gate, full reversibility, and
the n8n-cron→FastAPI scheduling — never writing compiled base, never auto-promoting.*
