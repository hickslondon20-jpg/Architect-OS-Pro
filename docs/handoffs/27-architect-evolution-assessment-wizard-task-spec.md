# Handoff Task Spec — #27: Architect Evolution — One-Question-at-a-Time Assessment

> **Status:** Ready for execution. **Frontend presentation refactor only** — the data wiring from #26 stays untouched.
> **Reference pattern:** `components/tools/ae-ladder/AssessmentWizard.tsx` (+ `QuestionCard`, `NavigationControls`, `ProgressIndicator`). Mirror its take-the-assessment feel for cross-tool consistency.
> **Companions:** `docs/content-provenance-manifest.md` (Architect Evolution), `CLAUDE.md`, `DESIGN-GUIDE-QUICK.md`.
> **Role boundary:** Executing agent. **Verify before changing.** Presentation only — do not touch fetch/answers/RPC/scoring. Flag, don't improvise.

---

## Objective

Convert `ArchitectEvolutionAssessment` from an all-questions-on-one-page layout to a **single-question wizard** (one of 13 at a time) that feels like the AE Ladder assessment. **No role/style distinction shown** — every question is presented identically so the user experiences one uniform quiz. All existing data wiring stays exactly as-is.

---

## Context (verify first)

- `pages/ArchitectEvolutionPages.tsx › ArchitectEvolutionAssessment` (wired in #26): fetches `fe_questions` (`is_active`, by `sort_order`), holds `answers` keyed by `question_key`, submits via `supabase.rpc('fe_submit_assessment', { p_answers })`, routes to `/foundations/architect-evolution/results`.
- Current UI renders all 13 questions in two labeled sections ("Your Founder Role" / "Your Operating Style"). **Those section headers are the distinction we're removing** (see below).
- Reference: the AE Ladder wizard's `QuestionCard` / `NavigationControls` / `ProgressIndicator` + auto-advance behavior. Reuse those presentational sub-components **if** they're prop-driven and not coupled to AE Ladder's data model; otherwise build Architect-Evolution-local equivalents that mirror them. **Do not regress the AE Ladder assessment.**

---

## In scope

1. **Single-question wizard.** Render **one question at a time** in `sort_order` (q1→q13). A progress indicator ("Question X of 13" + bar) — **no section segmentation** in it.
2. **No section distinction.** Remove the "Your Founder Role" / "Your Operating Style" section headers and the two-group layout from the assessment flow. Every question looks and feels the same. *(This is intentional per the product decision — it is NOT a framework-vocabulary rename; the "Founder Identity/Type" terms on the Results page stay untouched.)*
3. **Navigation behavior (mirror AE Ladder):**
   - Selecting an answer **auto-advances** to the next question.
   - **Back** revisits prior questions; the previously chosen answer is shown selected; changing it is allowed.
   - Answer state **persists** across back/forward navigation.
   - **Cannot advance** past a question until it's answered (forward/Next gated on a selection; auto-advance only fires on a selection).
   - On the **last** question, answering enables **Complete/Submit**. Because forward movement requires an answer at each step, **submission with any unanswered question is impossible.**
4. **Submit unchanged.** Complete → the existing `fe_submit_assessment` call → route to results. Keep a **lightweight "Submitting…" state** (disabled button) — **do not** import the AE Ladder "Generating Report" `LoadingOverlay` (scoring here is instant/deterministic).
5. **Keep the data wiring identical** — `fe_questions` fetch, `answers` keyed by `question_key`, the RPC call, error handling, and routing all unchanged.

---

## Out of scope (do not do)

- **No backend/data/wiring changes** (fetch, `answers`, `fe_submit_assessment`, scoring, `fe_*`).
- **No section labels / role-style distinction** anywhere in the assessment UI.
- **No review screen; no resume/cross-session persistence** (answers stay local until submit, as today).
- No changes to Results, Overview, gates, routes, or the AE Ladder assessment.
- Don't reorder/shuffle questions (keep `sort_order`); don't rename framework vocabulary (Results labels stay).

---

## Constraints

- TypeScript + build clean; AOS-compliant; responsive; mirror the AE Ladder feel for consistency.
- Reuse over duplication where the AE Ladder sub-components are cleanly generic; otherwise mirror locally without touching AE Ladder.

---

## Acceptance criteria

1. Assessment presents one question at a time (1 of 13) in `sort_order`, with a progress indicator and **no section labels**.
2. Selecting auto-advances; Back works; answers persist both directions; you cannot advance a question until it's answered; you cannot submit with any unanswered question.
3. Submit still calls `fe_submit_assessment` and routes to results; lightweight submit state (no heavy overlay).
4. No backend/wiring/Results/Overview/gate/route/AE-Ladder changes; the data path is byte-for-byte the same logic.
5. Build + typecheck clean; AOS + responsive.

---

## Verification (before reporting done — written; no screenshots)

1. Typecheck/build clean.
2. Walk the state logic and confirm: forward blocked until answered; auto-advance on select; Back restores prior selection; changing a prior answer persists; "Complete" only reachable/enabled after all 13 answered.
3. Show that the data path is unchanged — the `fe_questions` fetch, `answers` shape (`{q1..q13}`), the `fe_submit_assessment` call, and routing are the same as #26 (diff scoped to presentation/navigation).
4. `grep`/read confirms no "Your Founder Role" / "Your Operating Style" section headers remain in the assessment flow, and the Results framework terms are untouched.

---

## Report-back format

Files changed (one-line intent each); whether AE Ladder sub-components were reused or mirrored (and why); the navigation/auto-advance/Back/gating implementation; confirmation the data path is unchanged from #26; the section-header removal; build/typecheck status; anything flagged.
