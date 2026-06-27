# Handoff Prompt — #27: Architect Evolution One-Question-at-a-Time Assessment

You are the building agent for a **frontend presentation refactor** on ArchitectOS Pro. Convert the Architect Evolution assessment to a single-question wizard. **The data wiring from #26 stays untouched — no backend/RPC/scoring changes.**

## Read first (in order)
1. `docs/handoffs/27-architect-evolution-assessment-wizard-task-spec.md` — scope, acceptance, report-back.
2. The reference pattern: `components/tools/ae-ladder/AssessmentWizard.tsx` + `QuestionCard` / `NavigationControls` / `ProgressIndicator`.
3. `docs/content-provenance-manifest.md` (Architect Evolution), `CLAUDE.md`, `DESIGN-GUIDE-QUICK.md`.

## Target file
`pages/ArchitectEvolutionPages.tsx › ArchitectEvolutionAssessment` (wired in #26: fetches `fe_questions` by `sort_order`, `answers` keyed by `question_key`, submits via `supabase.rpc('fe_submit_assessment', {p_answers})`, routes to results).

## What to build
1. **One question at a time** (1 of 13) in `sort_order`, with a progress indicator ("Question X of 13" + bar) — **no section segmentation**.
2. **Remove the section distinction** — drop the "Your Founder Role" / "Your Operating Style" headers and two-group layout; every question looks/feels identical. *(Intentional product decision — NOT a framework-vocab rename. The "Founder Identity/Type" terms on the Results page stay untouched.)*
3. **Navigation (mirror AE Ladder):** selecting an answer **auto-advances**; **Back** revisits and shows the prior selection (changeable); answers **persist** both directions; **can't advance until answered** (forward gated on a selection); last question answered → **Complete/Submit**. The gating makes submitting with unanswered questions impossible.
4. **Submit unchanged:** Complete → existing `fe_submit_assessment` → route to results; lightweight "Submitting…" disabled-button state — **do NOT** use the AE Ladder "Generating Report" `LoadingOverlay`.
5. **Keep the data wiring identical** (fetch, `answers` shape, RPC, error handling, routing).

## Do NOT
- Change backend/data/wiring, scoring, `fe_*`, Results, Overview, gates, routes, or the AE Ladder assessment.
- Show any section labels / role-style distinction in the assessment.
- Add a review screen or cross-session persistence; reorder/shuffle questions (keep `sort_order`); rename framework vocabulary.
- Reuse AE Ladder sub-components only if they're cleanly generic (prop-driven); otherwise mirror locally **without modifying** the AE Ladder ones.

## Verify before reporting done (written — no screenshots)
Typecheck/build clean; walk the state logic (forward blocked until answered; auto-advance on select; Back restores selection; changing a prior answer persists; Complete only after all 13); show the data path is unchanged from #26 (fetch / `answers` `{q1..q13}` / `fe_submit_assessment` / routing identical); grep/read confirms the section headers are gone from the assessment and Results framework terms are intact.

## Report back
Per the task-spec's report-back format: files changed, reuse-vs-mirror decision, the navigation/gating implementation, confirmation the data path is unchanged, the section-header removal, build status. Flag anything ambiguous rather than guessing.
