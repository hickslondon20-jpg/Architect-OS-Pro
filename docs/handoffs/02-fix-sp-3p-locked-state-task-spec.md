# Handoff Task Spec — #02: Sprint Planning 3P page must show the active exercise, not the locked posture

> **Status:** Ready for execution
> **Companion docs:** `docs/sprint-planning-flow-spec.md` (full flow) and `docs/handoffs/01-relocate-3p-task-spec.md` (the relocation this corrects). Read both first.
> **Role boundary:** Executing agent. Implement exactly this. Flag, don't improvise. Do not expand scope.

---

## Problem

After handoff #01, `/pro/planning/sprint-planning/prioritization` renders the **locked "Your Quarter Posture" synthesis** instead of the **3P selection/organize exercise**.

**Root cause (verified):** `components/pro-suite/quarter-map/ThreePExercise.tsx` renders `<QuarterPostureBlock />` when `isLocked` is true (~line 291) and the selection/organize exercise only when `!isLocked` (~line 309). `isLocked` derives from the shared `quarter_map_selections` row (`status === 'locked'`). That row (user + "Q1 2026") is already locked from prior Quarter Map use, and BOTH the Quarter Map page and the new Sprint Planning page read the same row — so the Sprint Planning page opens into the synthesis and hides the exercise.

The exercise UI is NOT missing — it already exists in modern AOS form in the `!isLocked` branch. It is simply hidden by the shared lock. **Do not rebuild the selection UI.**

Secondary defect: in the locked view, `QuarterPostureBlock` renders a legacy "Proceed to Sprint Planning" button (`QuarterPostureBlock.tsx:55`, navigates to `/pro/planning/sprint-planning` — a circular loop) alongside the new "Continue to Sprint Board." The legacy CTA must not appear on the Sprint Planning surface.

---

## Objective

Make the same `ThreePExercise` component present correctly per context by introducing a **`surface` prop**, without duplicating the Supabase data layer and without changing Quarter Map's behavior.

- **Sprint Planning surface** = the active exercise (selection + organize + forward to board).
- **Quarter Map surface** = unchanged (posture-when-locked).

---

## In scope

1. **Add a `surface` prop** to `ThreePExercise`, e.g. `surface?: 'quarter-map' | 'sprint-planning'`, default `'quarter-map'`.

2. **Sprint Planning surface behavior** (`surface === 'sprint-planning'`):
   - **Always render the selection + organize exercise** (capability grid, Prioritize / Plant / Iterate / Parking Lot columns, selection counter footer) as the primary view — **even when the underlying row is locked**.
   - **Pre-load existing selections** from `quarter_map_selections` so the user reviews/adjusts rather than starting empty.
   - **Do NOT render `QuarterPostureBlock`** on this surface (no "Your Quarter Posture" synthesis card, and therefore no legacy "Proceed to Sprint Planning" CTA).
   - **Forward path:** if not yet locked, the footer's lock action saves/locks then calls `onPostLock` (→ board). If the row is already locked, present a "Continue to Sprint Board" action (`onPostLock`) plus an "Edit selections" affordance that lets the user adjust and re-lock. Exact affordance styling is your call within AOS tokens; the requirement is that the user can both proceed AND edit.

3. **Quarter Map surface behavior** (`surface === 'quarter-map'`, the default): **unchanged** — posture-when-locked exactly as today.

4. **Pass the prop:** `pages/SprintPlanning/ThreePPrioritizationPage.tsx` renders `<ThreePExercise surface="sprint-planning" headingLabel="3P Prioritization" onPostLock={...} />`. `CurrentQuarterFocusTab` keeps the default (no surface or `surface="quarter-map"`).

---

## Out of scope (do not touch)

- **Do NOT change the data model.** The shared `quarter_map_selections` row stays. Do not create a new table/row or per-sprint key yet — that lifecycle decision rides with the demote work (logged in spec §7).
- **Do NOT** rewire the Sprint Board's mock data.
- **Do NOT** demote or alter the Quarter Map `current-quarter` page's content or behavior.
- **Do NOT** rebuild the 3P selection UI — reuse the existing `!isLocked` branch.
- **Do NOT** touch sidebar, Strategic Roadmap, or Quarter Sequence.

---

## Constraints

- AOS design system (tokens, Geist; no Inter / pure black / neon / glow / text gradients / Tailwind default grays). The component already uses AOS variables — preserve them.
- TypeScript compiles with no new errors.
- Single data layer — no duplicated Supabase logic.
- *(Optional, low-risk, your discretion):* the pre-existing `SectionLayout` `children` TS error flagged in handoff #01 may be fixed here in one line (`children?: React.ReactNode` on `SectionLayoutProps` in `Layouts.tsx`). If you fix it, note it; if not, leave it.

---

## Acceptance criteria

1. `/pro/planning/sprint-planning/prioritization` shows the **capability selection grid + Prioritize/Plant/Iterate/Parking Lot organize columns + counter footer** — even though the Q1 2026 row is currently locked.
2. **No "Your Quarter Posture" synthesis card** and **no "Proceed to Sprint Planning" button** on the Sprint Planning surface.
3. Existing selections are **pre-loaded and editable**; the user can re-lock.
4. Locking (or continuing, if already locked) routes to `/pro/planning/sprint-planning/board`.
5. Quarter Map `current-quarter` is **unchanged** — still shows the posture synthesis when locked.
6. No duplicated data layer; no new TypeScript errors.

---

## Verification (perform before reporting done)

1. Build / typecheck — no new errors.
2. With the Q1 2026 row locked, load the Sprint Planning prioritization page and confirm the **exercise** renders (not the posture). Screenshot it.
3. Load Quarter Map `current-quarter` and confirm the **posture** still renders when locked. Screenshot it.
4. Edit a selection on the Sprint Planning surface, re-lock, confirm it persists and routes to the board.
5. Diff summary of files changed.

---

## Report-back format

Files changed (one-line intent each); how you implemented the surface divergence; confirmation of each acceptance criterion; the two screenshots (SP exercise + QM posture); whether you folded in the optional `SectionLayout` fix; anything flagged rather than decided.
