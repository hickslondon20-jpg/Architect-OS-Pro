# Handoff Task Spec — #26: Architect Evolution — Frontend Wiring (feature online)

> **Status:** Ready for execution. **Frontend wiring** — connect the (already renamed) components to the live `fe_*` backend. Backend is done (#23/#24) and named (#25).
> **Source of truth:** `docs/architect-evolution-scoring-spec.md` — §7 (frontend wiring contract) + the **Amendments (2026-06-23)** block. `docs/content-provenance-manifest.md` (Results/Assessment page maps).
> **Companions:** `CLAUDE.md`, `DESIGN-GUIDE-QUICK.md`.
> **Role boundary:** Executing agent. **Verify before changing.** Wire to the existing Supabase client; don't change the backend or the UI design. Flag, don't improvise.

---

## Objective

Bring Architect Evolution online: the assessment reads its questions from `fe_questions` and persists+scores via `fe_submit_assessment`; the results page renders the user's real `fe_results` joined to `fe_profiles`. Replace all mock data. **Do not wire the two external-link buttons** (deferred — see below).

---

## Context (verify first)

- Component file: `pages/ArchitectEvolutionPages.tsx` (`ArchitectEvolutionLanding/Assessment/Results`). It currently uses a **hardcoded `questions[]`** and `MOCK_PROFILE` / `MOCK_RESULT` (the component already carries TODO comments describing the intended live queries).
- Backend (live): `fe_questions` (13 rows, `options` jsonb incl. hidden `scores`), `fe_submit_assessment(p_answers jsonb)` (insert→score→return, SECURITY INVOKER), `fe_results` (own-row RLS), `fe_profiles` (15 rows, authenticated read; key is **lowercase** `identity_type`; has an extra `cross_section_profile_display` column).
- Dot already built: `CrossSectionMatrix` expects **lowercase** option ids (`ceo`, `manager`, `strategist`).
- Use the app's existing Supabase client pattern (find it; don't introduce a new one).

---

## In scope

1. **Assessment — read questions live.** Load from `fe_questions` where `is_active`, ordered by `sort_order`; render section groups by `section` (`role` → "Your Founder Role", `style` → "Your Operating Style"). Render each option from the table; **ignore the `scores` field in the UI.** Remove the hardcoded `questions[]`.
2. **Assessment — persist + score.** On "Complete Assessment," call `fe_submit_assessment({ q1: value, … })` via the Supabase client; on success route to `/foundations/architect-evolution/results`. Handle loading + error states (don't navigate on error).
3. **Results — render live.** Read the latest `fe_results` for the current user (`order by created_at desc limit 1`); fetch the matching `fe_profiles` row by `cross_section_key` (lowercase). Render the dynamic content per the manifest: archetype name, the two pills (`identity_primary` / `type_primary`), tagline, profile summary, How This Shows Up (4), leverage (3), tensions (3), thought starters (4). Drop `MOCK_PROFILE` / `MOCK_RESULT`.
4. **Results — dot.** Map `identity_primary` / `type_primary` (TitleCase) to the lowercase ids `CrossSectionMatrix` expects (e.g. `CEO`→`ceo`).
5. **Results — empty state.** If the user has no `fe_results` row, show a gentle empty state with a CTA to take the assessment (link to `/foundations/architect-evolution/assessment`) — do not error or render a blank profile.
6. **Cleanup.** Delete the orphaned stub `pages/FounderEvolutionPages.tsx` (confirm no importers first).

---

## Out of scope (do not do)

- **Do NOT wire the "Download Guide" or "Book Your Discovery Call" buttons.** Leave them present but **inert** (no working link/handler), with a clear `// TODO` referencing the Go-Live gap — both get wired together later once the PDFs are uploaded and URLs supplied.
- **No backend changes** (`fe_*` tables/functions, scoring, weights, profile rows).
- **No UI redesign** — the multi-screen/progressive wizard is a separate future pass; wire the current single-page UI as-is.
- **Do not rename framework vocabulary** ("Founder Identity/Type/Role", role/type labels) or change gating/routes.
- Don't author profile content or `pdf_url`.

---

## Constraints

- Use the existing Supabase client + auth context; respect RLS (`fe_submit_assessment` runs as the user; `fe_results` is own-row).
- TypeScript + build clean; AOS/visual unchanged (wiring only).
- Graceful loading / error / empty states; no console errors.

---

## Acceptance criteria

1. Assessment renders all 13 questions from `fe_questions` (no hardcoded array), grouped correctly into the two sections.
2. Completing the assessment writes a `fe_responses` + `fe_results` row (via `fe_submit_assessment`) and lands on Results showing **that user's** real profile.
3. Results renders entirely from `fe_results ⋈ fe_profiles` (no mock), dot positioned from the real primary labels, with a working empty state when no result exists.
4. Download Guide + Discovery Call remain inert placeholders (not wired), flagged with TODOs.
5. The stub `FounderEvolutionPages.tsx` is removed; no broken imports.
6. No backend/UI-design/route/gate changes; build + typecheck clean.

---

## Verification (before reporting done — written; no screenshots)

1. Typecheck/build clean.
2. End-to-end: complete the assessment as a test user → confirm a `fe_results` row is created and Results renders the matching profile (cite the user, the resulting `cross_section_key`, and the archetype shown). **Confirms the `fe_submit_assessment` round-trip that couldn't be tested in SQL (#24).** Clean up any test rows created.
3. Confirm the empty-state path (no result) renders the CTA, not an error/blank.
4. Confirm the two buttons are inert (no navigation/handler) and TODO-flagged.
5. `grep` confirms no remaining `MOCK_PROFILE` / `MOCK_RESULT` / hardcoded `questions[]`; stub file gone with no dangling imports.

---

## Report-back format

Files changed (one-line intent each); how questions are loaded; the submit/score call + routing; the results read + join + dot mapping + empty-state handling; confirmation the two buttons are inert + TODO'd; the stub deletion; the end-to-end test result (user → key → archetype, then cleanup); build/typecheck status; anything flagged.
