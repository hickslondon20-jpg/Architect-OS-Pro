# Handoff Prompt — #26: Architect Evolution Frontend Wiring

You are the building agent for the **frontend wiring** unit that brings Architect Evolution online. Connect the (already renamed) components to the live `fe_*` backend. **No backend changes, no UI redesign.**

## Read first (in order)
1. `docs/architect-evolution-scoring-spec.md` — **§7 (frontend wiring) + the Amendments block.**
2. `docs/handoffs/26-architect-evolution-frontend-wiring-task-spec.md` — scope, acceptance, report-back.
3. `docs/content-provenance-manifest.md` (Architect Evolution — Results/Assessment maps), `CLAUDE.md`.

## Backend is live (verify, don't change)
`fe_questions` (13 active rows; `options` jsonb has a hidden `scores` field — ignore in UI), `fe_submit_assessment(p_answers jsonb)` (insert→score→return, INVOKER), `fe_results` (own-row RLS), `fe_profiles` (15 rows, **lowercase** `cross_section_key`, plus a `cross_section_profile_display` column). The dot (`CrossSectionMatrix`) wants **lowercase** ids. Use the app's existing Supabase client.

## What to wire (in `pages/ArchitectEvolutionPages.tsx`)
1. **Assessment — questions:** load from `fe_questions` (`is_active`, by `sort_order`); group by `section` (`role`→"Your Founder Role", `style`→"Your Operating Style"); render options from the table; remove the hardcoded `questions[]`.
2. **Assessment — submit:** "Complete Assessment" → `fe_submit_assessment({q1:value,…})` → on success route to `/foundations/architect-evolution/results`; handle loading + error (don't navigate on error).
3. **Results — render live:** latest `fe_results` for the current user (`order by created_at desc limit 1`) → fetch `fe_profiles` by `cross_section_key` → render archetype, the two pills (`identity_primary`/`type_primary`), tagline, summary, How This Shows Up (4), leverage (3), tensions (3), thought starters (4). Drop `MOCK_PROFILE`/`MOCK_RESULT`.
4. **Results — dot:** map TitleCase `identity_primary`/`type_primary` → lowercase ids for `CrossSectionMatrix`.
5. **Results — empty state:** no result → gentle CTA to take the assessment (link to the assessment route), not an error/blank.
6. **Cleanup:** delete the orphaned stub `pages/FounderEvolutionPages.tsx` (confirm no importers).

## Do NOT
- **Wire the "Download Guide" or "Book Your Discovery Call" buttons** — leave them present but **inert** (no working link/handler) with a `// TODO` referencing the Go-Live gap. Both get wired later together once PDFs + URLs are ready.
- Change backend (`fe_*`, scoring, weights, profiles), gating, routes, or the UI design (the wizard redesign is a separate pass).
- Rename framework vocabulary ("Founder Identity/Type/Role", role/type labels).

## Verify before reporting done (written — no screenshots)
Typecheck/build clean; **end-to-end**: complete the assessment as a test user → a `fe_results` row is created and Results renders the matching profile (cite user → `cross_section_key` → archetype) — this confirms the `fe_submit_assessment` round-trip; clean up test rows. Confirm the empty-state path renders the CTA; the two buttons are inert + TODO'd; grep shows no `MOCK_PROFILE`/`MOCK_RESULT`/hardcoded `questions[]` and the stub file is gone with no dangling imports.

## Report back
Per the task-spec's report-back format: files changed, question loading, submit/score + routing, results read+join+dot+empty-state, the inert-buttons confirmation, stub deletion, the end-to-end test (user→key→archetype + cleanup), build status. Flag anything ambiguous rather than guessing.
