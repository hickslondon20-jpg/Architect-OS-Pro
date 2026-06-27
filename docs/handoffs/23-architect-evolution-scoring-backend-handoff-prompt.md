# Handoff Prompt — #23: Architect Evolution Scoring Engine (Backend)

You are the building agent for a **backend-only** unit on ArchitectOS Pro. Deterministic scoring for the Architect Evolution (`founder_evolution`) assessment. **No frontend, no n8n, no Edge Functions — Postgres functions + migrations only.**

## Read first (in order)
1. `docs/architect-evolution-scoring-spec.md` — **the source of truth.** The full per-option weight map (§3), function contract (§4), tie-breaks (§1), canonical keys (§5), and verification (§9) live here. If this prompt and the spec disagree, the spec wins.
2. `docs/handoffs/23-architect-evolution-scoring-backend-task-spec.md` — scope, acceptance criteria, report-back format.
3. `CLAUDE.md` — architecture rules.

## Project
Supabase `pwacpjqkntnovndhspxt` ("Architect OS"). All DDL/data via migrations (`apply_migration`), matching `docs/migrations/`. **Verify the existing `founder_evolution_*` tables and the sibling `compute_ae_assessment_scores` / `gm_score_assessment` functions before writing anything** — match their security/RLS/`search_path` pattern.

## What to build
1. **Data fix:** `founder_evolution_questions.section = 'role'` for `q6` and `q7` (mislabeled `style`).
2. **Weights:** add a `scores` map to every option in all 13 questions' `options` jsonb, **exactly** per spec §3. Don't touch `label`/`value`.
3. **`score_founder_evolution(p_response_id uuid)`** per spec §4 — sum identity(5)/type(3) buckets from the option weights; resolve primary/secondary with the tie-breaks (Identity = **earlier stage primary**: Practitioner<Manager<CEO<Advisor<Investor; Type = **Builder > Strategist > Visionary**); `cross_section_key = identity_primary||'_'||type_primary`; write `raw_scores`; upsert `founder_evolution_results`; set `responses.is_scored=true`. Leave `*_confidence`, `centrality_signal`, `architect_posture`, `interpretation_text`, `call_prep_text` **NULL — do not drop them.**
4. **`submit_founder_evolution(p_answers jsonb)`** — insert response (`user_id=auth.uid()`), score it, return the result row.
5. **`founder_evolution_profiles`** table — schema only (columns per spec §6), `cross_section_key` UNIQUE, nullable `tagline`/`pdf_url`. **Do NOT author or import the 15 content rows — London uploads those separately.**

## Guardrails
- Non-destructive: don't drop/rename any table or column; don't change question text or counts.
- Deterministic only; bucket names canonical TitleCase (`CEO` is all-caps); key format per spec §5.
- Backend only — no app/UI code edits.

## Verify before reporting done (written, SQL — no screenshots)
Run `score_founder_evolution` on crafted answers and assert: a clean Identity winner, a clean Type winner, an **Identity tie → earlier-stage primary**, and a **Type tie → Builder beats Strategist beats Visionary**. Re-score the existing seeded response and report output under the new rubric (note differences; don't "fix" the seed). Confirm `is_scored` flips, a `results` row upserts with a valid `cross_section_key`, and `submit_founder_evolution` round-trips under RLS.

## Report back
Per the task-spec's report-back format: migrations added, section fix, the `scores` written per question, function signatures + security model, profiles DDL, and the full SQL verification output (the four cases + the seeded re-score). Flag anything ambiguous rather than guessing.
