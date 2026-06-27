# Architect Evolution — Scoring & Wiring Spec (v1)

> **Status:** DRAFT for London's approval (Beat A). Once approved, this becomes the source of truth for handoffs #23 (backend) + #24 (frontend). Nothing is built from this until approved.
> **Scope:** The deterministic scoring engine + write-backs + frontend wiring for the Architect Evolution (legacy `founder_evolution`) assessment. Foundations area.
> **Companions:** `docs/content-provenance-manifest.md` (page content map), `CLAUDE.md` (architecture rules), the cross-section profiles sheet, and the Architect Assessment design doc (scoring rubric source).
> **Project:** Supabase `pwacpjqkntnovndhspxt` ("Architect OS").

---

## Amendments (2026-06-23, post-#23)

Decisions made after the approved v1, executed in the **#24 backend cleanup/rename** pass. These override the body where they conflict:

- **Canonical key = lowercase.** `cross_section_key` is **lowercase** `identity_type` (e.g. `ceo_builder`, `practitioner_visionary`) — matches the seeded `fe_profiles` and the component's option ids. The scorer `lower()`s the key it writes. (`raw_scores` bucket names stay TitleCase.)
- **Drop the 6 unused result columns** (no longer "leave NULL"): `identity_confidence`, `type_confidence`, `centrality_signal`, `architect_posture`, `interpretation_text`, `call_prep_text`.
- **Table rename → `fe_` prefix:** `fe_questions`, `fe_responses`, `fe_results`, `fe_profiles`. **Function rename:** `fe_score_assessment(p_response_id)` and `fe_submit_assessment(p_answers)` (sibling-style). All references point to FE going forward; user-facing naming is "Architect Evolution."
- **Profiles seeded** by London (15 rows + MVP taglines); `pdf_url` still empty. Seed `fe_responses`/`fe_results` test rows deleted.
- **Sequence:** #24 backend cleanup/rename → #25 V-13 (route `/founder-evolution`→`/architect-evolution` + redirect, gate key, `FounderEvolution*` files, user-facing copy) → #26 frontend wiring (against final `fe_*` names).

---

## 1. Model (locked — simplified v1)

Two deterministic point-sum models run inside one quiz (13 questions):

- **Founder Identity** — 5 buckets: `Practitioner, Manager, CEO, Advisor, Investor`. Fed by the **7 `role` questions**.
- **Founder Type** — 3 buckets: `Visionary, Strategist, Builder`. Fed by the **6 `style` questions`.

Each answer adds points to one or more buckets. Sum per bucket; **highest = the label**. No confidence, no gaps, no percentages, no user-visible math. The user sees one Identity label + one Type label → a `cross_section_key` → the matching profile.

**Stored, not surfaced:** `identity_secondary`, `type_secondary`, `raw_scores` — kept only for tie-breaks / future synthesis.
**Dropped from v1 (columns left in place, written NULL — non-destructive):** `identity_confidence`, `type_confidence`, `centrality_signal`, `architect_posture`, `interpretation_text`, `call_prep_text`.

### Tie-breaks (deterministic)

- **Identity** — on equal top score, the **earlier stage** is primary, later is secondary (conservative). Order: `Practitioner(1) < Manager(2) < CEO(3) < Advisor(4) < Investor(5)`.
- **Type** — on equal top score, order **`Builder(1) > Strategist(2) > Visionary(3)`** (Builder wins all ties; Strategist beats Visionary; Visionary defaults last).
- General rule: **primary** = top by (score DESC, then tie-break ordinal ASC); **secondary** = next by the same ordering.

---

## 2. Required data fixes (before/with scoring)

1. **Section correction.** `q6` and `q7` are Identity (Advisor / Investor) questions but are stored `section='style'`. Set **`q6.section = 'role'`** and **`q7.section = 'role'`**. Result: 7 `role` + 6 `style`.
2. **Add scoring weights to `founder_evolution_questions.options`.** Each option object gains a `scores` map of `{ Bucket: points }` per §3. Example:
   `{ "label": "Often", "value": "often", "scores": { "Practitioner": 2 } }`
   `{ "label": "Rarely", "value": "rarely", "scores": { "CEO": 1, "Advisor": 1 } }`
   (Weights are the source of truth and self-segregate by bucket name, so scoring does not depend on `section` — but the section fix still matters for UI grouping.)

---

## 3. Per-option weight map (mapped to live `question_key` + option `value`)

### Identity (`role`) — 7 questions

| question_key | option `value` → buckets |
|---|---|
| q1 | `often` → Practitioner +2 · `sometimes` → Manager +1 · `rarely` → CEO +1, Advisor +1 |
| q2 | `yes` → Practitioner +2 · `some` → Manager +1 · `no` → CEO +1, Advisor +1 |
| q3 | `yes` → Manager +2 · `some` → Practitioner +1, CEO +1 · `rarely` → CEO +1, Advisor +1 |
| q4 | `most` → Manager +2 · `occasionally` → CEO +1 · `rarely` → Advisor +1, Investor +1 |
| q5 | `yes` → CEO +2 · `sometimes` → Manager +1 · `no` → Practitioner +1 |
| q6 | `yes` → Advisor +2 · `occasionally` → CEO +1 · `rarely` → Manager +1 |
| q7 | `yes` → Investor +2 · `part` → Advisor +1 · `no` → CEO +1, Manager +1 |

### Type (`style`) — 6 questions

| question_key | option `value` → buckets |
|---|---|
| q8 | `often` → Visionary +2 · `sometimes` → Strategist +1 · `rarely` → Builder +1 |
| q9 | `yes` → Visionary +2 · `some` → Strategist +1 · `no` → Builder +1 |
| q10 | `yes` → Builder +2 · `sometimes` → Strategist +1 · `no` → Visionary +1 |
| q11 | `often` → Builder +2 · `sometimes` → Strategist +1 · `rarely` → Visionary +1 |
| q12 | `yes` → Strategist +2 · `some` → Visionary +1 · `no` → Builder +1 |
| q13 | `often` → Strategist +2 · `sometimes` → Builder +1 · `rarely` → Visionary +1 |

> Bucket names are canonical TitleCase as shown (note `CEO` is all-caps). These exact strings are used in `raw_scores`, the primary/secondary fields, and the `cross_section_key`.

---

## 4. Scoring function contract

A Postgres function (consistent with sibling `compute_ae_assessment_scores` / `gm_score_assessment`).

**`score_founder_evolution(p_response_id uuid)`**
1. Load `founder_evolution_responses` row (`user_id`, `answers` jsonb = `{ "q1":"often", … }`).
2. For each `(question_key, value)` in `answers`: find the question's matching option, read its `scores`, accumulate into `identity_scores` (5) and `type_scores` (3) by bucket name.
3. `identity_primary` / `identity_secondary` via §1 ordering + Identity tie-break; `type_primary` / `type_secondary` via §1 ordering + Type tie-break.
4. `cross_section_key = identity_primary || '_' || type_primary` (e.g. `Manager_Strategist`, `CEO_Visionary`).
5. `raw_scores = { "identity_scores": {…5…}, "type_scores": {…3…} }`.
6. **Upsert** `founder_evolution_results` (`user_id`, `response_id`, `identity_primary`, `identity_secondary`, `type_primary`, `type_secondary`, `cross_section_key`, `raw_scores`; the dropped fields left NULL).
7. Set `founder_evolution_responses.is_scored = true`.

**Submission entry point.** Provide a thin wrapper the client calls in one round-trip — recommend `submit_founder_evolution(p_answers jsonb)`: inserts the response (`user_id = auth.uid()`, `answers`, `is_scored=false`), calls `score_founder_evolution`, returns the result row. (Follow the siblings' invocation/security pattern, incl. RLS.)

---

## 5. Canonical cross-section keys (15)

`profiles.cross_section_key` MUST equal the scoring output exactly:

```
Practitioner_Visionary  Manager_Visionary  CEO_Visionary  Advisor_Visionary  Investor_Visionary
Practitioner_Strategist Manager_Strategist CEO_Strategist Advisor_Strategist Investor_Strategist
Practitioner_Builder    Manager_Builder    CEO_Builder    Advisor_Builder    Investor_Builder
```

---

## 6. Profiles table + import

- Create **`founder_evolution_profiles`** keyed by `cross_section_key` (unique). Columns map to the sheet: `archetype_name`, `identity`, `type`, `tagline`, `profile_summary`, `shows_up_1..4`, `leverage_1..3`, `tension_1..3`, `thought_starter_1..4`, `pdf_url`.
- Import the **15 cleaned rows** from the sheet. **Normalize** the key to §5 format (the sheet has lowercase / trailing-space / `CEO_` inconsistencies — fix on import). Trim `identity`/`type` values.
- `tagline` and `pdf_url` may be **empty at import** — not blocking. `pdf_url` backfills after PDFs are produced + uploaded to Supabase Storage.

---

## 7. Frontend wiring contract

**Assessment (`FounderEvolutionAssessment`)**
- Read questions from `founder_evolution_questions` (`is_active`, ordered by `sort_order`) — stop using the hardcoded array. Render options from the table (hide the `scores` field from the UI).
- "Complete Assessment" → call `submit_founder_evolution(answers)` → on success route to Results. (Removes the local-state-only gap.)

**Results (`FounderEvolutionResults`)**
- Read latest `founder_evolution_results` for the user (`order by created_at desc limit 1`); join `founder_evolution_profiles` on `cross_section_key`.
- Render the dynamic rows per the manifest (archetype, pills, tagline, summary, shows-up, leverage, tensions, thought-starters, Download Guide → `pdf_url`). Static frame unchanged.
- Dot: map `identity_primary` / `type_primary` (TitleCase) to the lowercase `identityOptions` / `typeOptions` ids the existing `CrossSectionMatrix` expects (e.g. `Manager`→`manager`, `CEO`→`ceo`).

**Overview** — optional/low-priority: the hardcoded "13 questions / 3 minutes" could later derive from the active question count. Not required for v1.

---

## 8. Out of scope (logged, not built here)

- **UI redesign to a multi-screen / progressive wizard** — the current single-scroll UI is what we wire now; the wizard is a **future pass handled by a separate agent**.
- Vestigial fields (§1) — not populated in v1.
- AI synthesis / interpretation — none; v1 is fully deterministic. (No n8n, no Edge Functions; DB function only.)
- The companion-guide PDFs themselves (creation/upload) and the final Discovery Call URL — tracked in the manifest Go-Live Gaps.

---

## 9. Verification (required before reporting done)

- **Scoring unit checks (SQL):** run `score_founder_evolution` on crafted answer sets and assert the expected label per bucket, including: a clean Identity winner, a clean Type winner, an **Identity tie** (assert earlier-stage primary), and a **Type tie** (assert Builder > Strategist > Visionary).
- Re-score the existing seeded response and confirm output matches the new rubric (note: the seeded `raw_scores` predate this rubric and may differ — the rubric here is authoritative).
- Confirm `is_scored` flips and a `results` row is written/updated with a valid `cross_section_key` that joins to a `profiles` row.
- TypeScript clean; no functional regressions on the Foundations area.

---

## 10. Proposed handoff split

- **#23 — Backend:** §2 data fixes, §3 weights migration, §6 profiles table + import, §4 functions, §9 SQL verification. Fully verifiable in the database before any UI work.
- **#24 — Frontend:** §7 wiring (assessment read-from-table + persist + RPC; results read `results ⋈ profiles`; dot mapping).

Sequential — #24 depends on #23.
