# Handoff Task Spec — #23: Architect Evolution — Scoring Engine + Backend Wiring

> **Status:** Ready for execution. **Backend only** — no frontend changes (those are #24).
> **Source of truth:** `docs/architect-evolution-scoring-spec.md` (approved v1). This task spec executes it; if anything here and the spec disagree, the spec wins — flag it.
> **Companions:** `CLAUDE.md` (architecture rules), `docs/content-provenance-manifest.md` (page content map).
> **Project:** Supabase `pwacpjqkntnovndhspxt` ("Architect OS"). Use migrations for all DDL/data (`apply_migration`), matching the existing `docs/migrations/` pattern.
> **Role boundary:** Executing agent. **Verify before changing.** Deterministic scoring only — **no n8n, no Edge Functions, no client-side scoring.** Non-destructive. Flag, don't improvise.

---

## Objective

Stand up the deterministic scoring engine and its data for the Architect Evolution (`founder_evolution`) assessment: correct the question data, embed scoring weights, build the scoring + submission Postgres functions, and create the cross-section profiles table — all verifiable in the database before any UI work.

---

## Context (verify first)

- Three tables already exist: `founder_evolution_questions` (13 active rows), `founder_evolution_responses` (`answers` jsonb, `is_scored` bool), `founder_evolution_results` (rich column set already in place). Confirm shapes before editing.
- Sibling assessments score via Postgres functions (`compute_ae_assessment_scores`, `gm_score_assessment`). **Follow that pattern** (security/RLS/invocation).
- The full per-option weight map, tie-break rules, function contract, and canonical keys are in the spec — read it in full before starting.

---

## In scope

1. **Data fix — question sections.** Set `founder_evolution_questions.section = 'role'` for **`q6`** and **`q7`** (they are Advisor/Investor Identity questions currently mislabeled `style`). Result: 7 `role` + 6 `style`.
2. **Add scoring weights to `options`.** Update all 13 questions' `options` jsonb so each option carries a `scores` map `{ Bucket: points }` exactly per spec §3. Do not change `label`/`value`. Bucket names are canonical TitleCase (`Practitioner, Manager, CEO, Advisor, Investor, Visionary, Strategist, Builder`).
3. **Scoring function** — `score_founder_evolution(p_response_id uuid)` per spec §4: read answers, accumulate `identity_scores`(5)/`type_scores`(3) from option weights, resolve primary/secondary with the §1 tie-breaks (Identity = earlier-stage-primary; Type = Builder > Strategist > Visionary), build `cross_section_key = identity_primary || '_' || type_primary`, write `raw_scores`, **upsert** `founder_evolution_results`, set `responses.is_scored = true`. Leave `*_confidence`, `centrality_signal`, `architect_posture`, `interpretation_text`, `call_prep_text` **NULL** (do not drop the columns).
4. **Submission wrapper** — `submit_founder_evolution(p_answers jsonb)`: insert the response (`user_id = auth.uid()`, `answers`, `is_scored=false`), call the scorer, return the result row. RLS/security per siblings.
5. **Profiles table** — create `founder_evolution_profiles`: `id uuid pk`, `cross_section_key text UNIQUE NOT NULL`, `archetype_name`, `identity`, `type`, `tagline` (nullable), `profile_summary`, `shows_up_1..4`, `leverage_1..3`, `tension_1..3`, `thought_starter_1..4`, `pdf_url` (nullable), `created_at`. Key format must match spec §5 exactly. **Schema only — the 15 content rows are uploaded separately by London; the agent does NOT own the profile content.** Ensure the table is import-ready (unique key, nullable tagline/pdf_url).

---

## Out of scope (do not do)

- **No frontend changes** (assessment/results wiring is #24).
- **No n8n, no Edge Functions** — DB functions only.
- **Do not drop or rename** the unused result columns, or any existing table/column.
- **Do not author/import the 15 profile rows** (London's upload) — create the table only.
- No changes to the question `label`/`value` text or the question count.

---

## Constraints

- Deterministic only; consistent with sibling scoring functions (security, `search_path`, RLS).
- Non-destructive and idempotent migrations where practical; canonical TitleCase bucket names and key format per spec.
- TypeScript/build unaffected (backend-only). Generated types may be regenerated but no app code edits.

---

## Acceptance criteria

1. `q6`, `q7` are `section='role'`; 7 `role` / 6 `style` confirmed.
2. All 13 questions' options carry correct `scores` per spec §3 (spot-checkable).
3. `score_founder_evolution` and `submit_founder_evolution` exist, run under RLS, and produce results matching the rubric, with tie-breaks behaving per spec §1.
4. `founder_evolution_profiles` exists with the spec §6 columns and a UNIQUE `cross_section_key`; nullable `tagline`/`pdf_url`.
5. Unused result columns remain present and NULL on new results.
6. No frontend changes; no destructive schema changes.

---

## Verification (before reporting done — SQL, written)

1. Run `score_founder_evolution` on crafted answer sets and assert: a clean Identity winner, a clean Type winner, an **Identity tie** → earlier-stage primary, a **Type tie** → Builder beats Strategist beats Visionary.
2. Re-score the existing seeded response; report the output under the new rubric (the seeded `raw_scores` predate this rubric — the spec is authoritative; note any difference, don't "fix" the seed).
3. Confirm `is_scored` flips and a `results` row is upserted with a valid `cross_section_key` in the §5 set.
4. Confirm a sample `submit_founder_evolution(answers)` call round-trips (insert → score → return) under a normal user's RLS.
5. List the exact `scores` written per question for spot-check.

---

## Report-back format

Migrations added (one-line intent each); the section fix confirmation; the per-question `scores` written (table); the two functions' signatures + security model; the profiles table DDL; the SQL verification output (including the four tie-break/winner cases and the seeded re-score); confirmation that unused columns are untouched/NULL and nothing was dropped; anything flagged rather than decided.
