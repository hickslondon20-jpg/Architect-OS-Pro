# Handoff Task Spec — #24: FE Backend Cleanup + Rename + Key-Case Fix

> **Status:** Ready for execution. **Backend only** — no frontend (that's #26); no route/gate/component renames (that's #25, V-13).
> **Source of truth:** `docs/architect-evolution-scoring-spec.md` — see the **Amendments (2026-06-23)** block, which governs this pass.
> **Builds on:** Handoff #23 (scoring engine, verified). **Companions:** `CLAUDE.md`.
> **Project:** Supabase `pwacpjqkntnovndhspxt` ("Architect OS"). All DDL via migrations (`apply_migration`), matching `docs/migrations/`.
> **Role boundary:** Executing agent. **Verify before changing.** Non-destructive except the explicitly-authorized column drops below. Deterministic only — no n8n, no Edge Functions. Flag, don't improvise.

---

## Objective

Finalize the Architect Evolution backend before frontend wiring: drop the unused result columns, fix the key casing so `results ⋈ profiles` joins, and rename the tables + functions to the `fe_` prefix. After this pass the backend is clean and final-named, so the frontend can be wired once.

---

## Context (verify first)

- Four tables (legacy names): `founder_evolution_questions` (13 rows), `founder_evolution_responses` (now empty), `founder_evolution_results` (now empty), `founder_evolution_profiles` (15 rows, lowercase keys, taglines set).
- Two functions from #23: `score_founder_evolution(p_response_id)`, `submit_founder_evolution(p_answers)` (SECURITY INVOKER). They reference the legacy table names and currently write a **TitleCase** `cross_section_key`.
- The mismatch this fixes: profiles keys are lowercase (`ceo_builder`); the scorer writes TitleCase (`CEO_Builder`) → case-sensitive join fails.

---

## In scope

1. **Drop 6 unused columns** from the results table: `identity_confidence`, `type_confidence`, `centrality_signal`, `architect_posture`, `interpretation_text`, `call_prep_text`.
2. **Key-case fix.** In the scorer, write `cross_section_key` **lowercased** — `lower(identity_primary || '_' || type_primary)` → e.g. `ceo_builder`. `raw_scores` bucket names stay TitleCase; `identity_primary`/`type_primary`/`*_secondary` stay TitleCase. Only the join key is lowercased.
3. **Rename tables** (preserve data, PK, unique constraints, indexes, RLS policies, grants): `founder_evolution_questions → fe_questions`, `founder_evolution_responses → fe_responses`, `founder_evolution_results → fe_results`, `founder_evolution_profiles → fe_profiles`.
4. **Rename + repoint functions:** `score_founder_evolution → fe_score_assessment(p_response_id uuid)`, `submit_founder_evolution → fe_submit_assessment(p_answers jsonb)`. Update their bodies to reference the `fe_*` tables. Keep SECURITY INVOKER + EXECUTE→authenticated. Drop the old function names (nothing references them yet).
5. Regenerate TypeScript types if the project tracks them — **but no application/UI code edits** in this pass.

---

## Out of scope (do not do)

- **No frontend/app code changes** (assessment/results wiring is #26).
- **No route, feature-gate, or component/file renames** (`/founder-evolution`, `founder_evolution` gate, `FounderEvolution*`) — that's #25 (V-13).
- No changes to question content, weights, the 5/3 bucket model, or the profiles rows.
- Do not drop anything beyond the 6 columns listed.

---

## Constraints

- Migrations idempotent where practical; renames must carry constraints/indexes/RLS/grants intact.
- Deterministic; consistent with sibling functions' security model.
- Lowercase canonical key per the spec Amendments.

---

## Acceptance criteria

1. The 6 columns are gone from `fe_results`; no other column lost.
2. `fe_score_assessment` writes a **lowercase** `cross_section_key` that matches `fe_profiles.cross_section_key`.
3. Tables exist as `fe_questions/responses/results/profiles` with data, constraints, RLS, and grants intact; legacy names no longer exist.
4. `fe_score_assessment` / `fe_submit_assessment` exist (INVOKER, EXECUTE→authenticated), reference `fe_*`; the old function names are gone.
5. No frontend changes; no V-13 renames; build/types clean.

---

## Verification (before reporting done — SQL, written; no screenshots)

1. Insert a crafted `fe_responses` row, run `fe_score_assessment`, and confirm a `fe_results` row with a **lowercase** key that **joins** to a real `fe_profiles` row (return the archetype_name proving the join). Clean up the test rows.
2. Confirm `fe_submit_assessment(answers)` round-trips under a normal user's RLS (insert → score → return), then clean up.
3. Show the `fe_results` column list (6 dropped, rest intact).
4. Confirm legacy table + function names no longer resolve; new names do; RLS policies present on all four `fe_*` tables.

---

## Report-back format

Migrations added (one-line intent each); the dropped-columns confirmation (before/after column list); the key-case change + the join-proof query output; the table + function rename confirmation (old gone, new present, RLS/grants intact); the round-trip test; anything flagged rather than decided.
