# Handoff Task Spec — #01: Relocate 3P into Sprint Planning (structure only)

> **Status:** Ready for execution
> **Companion docs:** Read `docs/sprint-planning-flow-spec.md` (full canonical flow) first. This spec scopes ONE incremental task against it.
> **Role boundary:** You are the executing agent with codebase access. Implement exactly this task. Do not expand scope. When uncertain, flag and ask — do not improvise structural decisions.

---

## Objective

Add the existing, Supabase-wired 3P prioritization exercise into the Sprint Planning sub-section as a sequenced step **between Sprint Goal and Sprint Board**, and re-order the Sprint Planning flow to match the canonical sequence. This is a **non-destructive, structural** change: the goal is a walkable flow the founder can review visually before any deletion/retirement decisions are made.

Canonical sequence being established (Steps 5–9 of the full spec):
**Sprint Goal → 3P Prioritization → Sprint Board → (Review & Lock) → (Synthesis).**

---

## In scope

1. **New route + page** for 3P under Sprint Planning at `/pro/planning/sprint-planning/prioritization`.
   - Reuse the existing wired 3P exercise. The data layer (Supabase reads of `gm_assessments`, `gm_assessment_capability_scores`, `gm_capability_rankings`; read/write of `quarter_map_selections`) must remain intact and unduplicated.
   - **Preferred approach:** extract the 3P exercise body from `pages/pro-suite/quarter-map/CurrentQuarterFocusTab.tsx` into a shared component (e.g. `components/pro-suite/quarter-map/ThreePExercise.tsx`) that BOTH the existing Quarter Map route and the new Sprint Planning route render. If extraction proves risky, fall back to rendering the existing component within the new route — but do NOT copy-paste the Supabase logic into a second file (no divergent duplicate of the data layer).
   - **Adapt for Sprint Planning context:** the page heading/eyebrow should read as a Sprint Planning step (not "Current Quarter Focus"). Reconcile the component's own sticky header / `top-[60px]` offset / `min-h-screen` so it sits correctly inside `SprintPlanningLayout` (a `SectionLayout` with tabs) without double headers or broken offsets.

2. **Forward affordance after 3P lock.** The Quarter Map version shows an inline posture block on lock and stops (`CurrentQuarterFocusTab.handleLock`, ~lines 215–250 — no navigation). In Sprint Planning, after the user locks 3P they must be able to continue to the board. Add a "Continue to Sprint Board" action that routes to `/pro/planning/sprint-planning/board`. Keep the lock/save behavior otherwise unchanged.

3. **Re-order the sub-tab nav.** In `pages/SprintPlanning/SprintPlanningLayout.tsx` (tabs array, ~lines 14–17), set the tab order to:
   - Sprint Goal → `/pro/planning/sprint-planning/sprint-goal`
   - 3P Prioritization → `/pro/planning/sprint-planning/prioritization`
   - Sprint Board → `/pro/planning/sprint-planning/board`

4. **Fix the index redirect.** In `App.tsx` (~line 186), the Sprint Planning index currently redirects to `board`. Change it to redirect to `sprint-goal` so entry lands at the start of the flow.

5. **Wire the forward chain** to match the new order:
   - `pages/SprintPlanning/SprintGoalFlow/SprintGoalFlowPage.tsx` line 23 — `handleLock` navigates to dead `/pro/planning/sprint-board`. Change target to `/pro/planning/sprint-planning/prioritization`.
   - `pages/SprintPlanning/SprintReviewLock/SprintReviewLockPage.tsx` line 23 — navigates to dead `/pro/planning/sprint-synthesis`. Change target to `/pro/planning/sprint-planning/synthesis`.
   - Add the new route entry in `App.tsx` Sprint Planning block (~lines 185–194), mounting the new 3P page at `path="prioritization"`.

---

## Explicitly OUT of scope (do not touch)

- **Do NOT demote, alter, or remove** Quarter Map's `current-quarter` route or `CurrentQuarterFocusTab` behavior. The 3P exercise must remain functional in BOTH places after this task. (The demote decision is deferred pending visual review.)
- **Do NOT rewire the Sprint Board's data.** `SprintBoardPage` keeps its mock 3P arrays for now. Connecting the board to real `quarter_map_selections` is a separate future task.
- **Do NOT consolidate or redesign** the 5-step Sprint Goal wizard. Sequencing only.
- **Do NOT resolve** InitiativeLibrary, MilestoneBuilder, ProgressPage, or the dual-synthesis question.
- **Do NOT touch** the left sidebar, Strategic Roadmap, or Quarter Sequence.
- No new AI/content wiring; synthesis layers stay mocked.

---

## Design / code constraints

- Honor the AOS design system per `CLAUDE.md` and `DESIGN-GUIDE-QUICK.md` (AOS tokens, Geist, no Inter, no pure black, no neon/glow, no text gradients, asymmetric layouts). Note the existing 3P component already uses AOS CSS variables — preserve them; do not regress to Tailwind default grays.
- TypeScript must compile clean (no new errors).
- React Router uses `HashRouter`; keep route paths relative/consistent with the existing nesting.

---

## Acceptance criteria

1. From `/pro/planning/sprint-planning` the user lands on **Sprint Goal**.
2. Sub-tabs read, in order: **Sprint Goal · 3P Prioritization · Sprint Board**.
3. `/pro/planning/sprint-planning/prioritization` renders the fully-wired 3P exercise (capabilities load, buckets enforce 3, save/draft/lock all work against `quarter_map_selections`).
4. Locking 3P presents a working "Continue to Sprint Board" path to `/pro/planning/sprint-planning/board`.
5. The forward chain is walkable end to end with no dead routes: goal → 3P → board → review → synthesis → board.
6. Quarter Map's `current-quarter` 3P page still works exactly as before (no regression).
7. No new TypeScript/build errors.

---

## Verification steps (perform before reporting done)

1. Typecheck / build the project; confirm no new errors.
2. Manually click the full chain in the browser and confirm every transition resolves (no blank/404 routes).
3. Confirm the 3P exercise on the new route reads real data and persists a lock to `quarter_map_selections`.
4. Confirm the Quarter Map 3P route is unchanged.
5. Produce a short diff summary of files changed.

---

## Report-back format

When done, report: files changed (with one-line intent each), the approach taken for reuse (extracted shared component vs. direct render) and why, any layout reconciliation you had to do, anything you had to flag rather than decide, and confirmation of each acceptance criterion. Do not retire or delete anything.
