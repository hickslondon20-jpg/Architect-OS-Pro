# Handoff Prompt — #24: FE Backend Cleanup + Rename + Key-Case Fix

You are the building agent for a **backend-only** unit on ArchitectOS Pro (Architect Evolution / legacy `founder_evolution`). Postgres migrations only — **no frontend, no n8n, no Edge Functions.**

## Read first (in order)
1. `docs/architect-evolution-scoring-spec.md` — **especially the "Amendments (2026-06-23)" block**, which governs this pass (lowercase key, column drops, `fe_` rename).
2. `docs/handoffs/24-fe-backend-cleanup-rename-task-spec.md` — scope, acceptance criteria, report-back.
3. `CLAUDE.md`.

## Project
Supabase `pwacpjqkntnovndhspxt`. DDL via `apply_migration`, matching `docs/migrations/`. **Verify current state first** — four `founder_evolution_*` tables and the `score_founder_evolution` / `submit_founder_evolution` functions from #23.

## What to do
1. **Drop 6 unused columns** from the results table: `identity_confidence`, `type_confidence`, `centrality_signal`, `architect_posture`, `interpretation_text`, `call_prep_text`.
2. **Key-case fix:** scorer writes `cross_section_key = lower(identity_primary || '_' || type_primary)` (e.g. `ceo_builder`) so it matches `fe_profiles`. `raw_scores` and the primary/secondary fields stay TitleCase — only the join key is lowercased.
3. **Rename tables** (carry data, constraints, indexes, RLS, grants): `founder_evolution_questions→fe_questions`, `…responses→fe_responses`, `…results→fe_results`, `…profiles→fe_profiles`.
4. **Rename + repoint functions:** `score_founder_evolution→fe_score_assessment(p_response_id uuid)`, `submit_founder_evolution→fe_submit_assessment(p_answers jsonb)`; bodies reference `fe_*`; keep SECURITY INVOKER + EXECUTE→authenticated; drop the old function names.

## Guardrails
- Backend only — **no app/UI edits**, **no route/gate/component renames** (that's a separate pass).
- Don't drop anything beyond the 6 listed columns; don't touch question content, weights, or profile rows.
- Lowercase canonical key; renames must keep constraints/indexes/RLS/grants intact.

## Verify before reporting done (written SQL — no screenshots)
Insert a crafted `fe_responses` row, run `fe_score_assessment`, confirm a `fe_results` row whose **lowercase** `cross_section_key` **joins** to a real `fe_profiles` row (return its `archetype_name` as proof); test `fe_submit_assessment` round-trips under RLS; show the `fe_results` columns (6 gone, rest intact); confirm legacy table/function names no longer resolve and RLS is present on all four `fe_*` tables. Clean up all test rows.

## Report back
Per the task-spec's report-back format: migrations added, dropped-columns before/after, the key-case change + join-proof output, the rename confirmations (old gone / new present / RLS+grants intact), and the round-trip test. Flag anything ambiguous rather than guessing.
