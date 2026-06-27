# Handoff Task Spec — #03: Restore Current Quarter Focus as a read-only quarter synthesis (remove 3P from Quarter Map)

> **Status:** Ready for execution
> **Companion docs:** `docs/sprint-planning-flow-spec.md` (full flow, v2) and handoffs #01/#02 (the relocation that this completes). Read first.
> **Role boundary:** Executing agent. Implement exactly this. Flag, don't improvise. Do not expand scope.

---

## Context / problem

Quarter Map's "Current Quarter Focus" tab currently renders the full 3P exercise — it is a thin wrapper: `CurrentQuarterFocusTab.tsx` returns `<ThreePExercise headingLabel="Current Quarter Focus" />`. 3P now lives correctly in Sprint Planning (`/sprint-planning/prioritization`). This tab must be restored to its intended purpose: a **read-only quarter-level synthesis / checkpoint** — distinct from 3P, and distinct from the sprint-level posture on the Sprint Planning side.

The tab is a "review / confirm / align" surface. The founder fills out nothing. It is a high-level readback of what the current (next) quarter should look like, derived from the upstream drill-down: ultimate vision → 36 → 24 → 12-month → the four-quarter breakdown → the immediate next steps and focus areas for this quarter. Real synthesis content will be generated later via an n8n workflow + Anthropic API (downstream task — NOT in scope). For now, placeholder copy.

The structural pieces already exist in the codebase: `QuarterPostureBlock` (the "Executive Synthesis / Your Quarter Posture" card) and `ReferenceStrip` (the "Reference: Your 12-Month Trajectory" dropdown). Reuse them.

---

## Objective

Rewrite the content of `CurrentQuarterFocusTab` so it renders a read-only quarter synthesis composed of existing components, with **zero 3P**. Do not touch the Sprint Planning 3P page, `ThreePExercise`, or the Sprint Board.

---

## Wireframe (top → bottom)

1. **KEEP** — Header: "Current Quarter Focus" title + "Planning for: [quarter ▾]" selector + "History" button.
2. **KEEP** — "Reference: Your 12-Month Trajectory" reference strip (`ReferenceStrip`, collapsible).
3. **REPLACE** everything below (capability grid + "Organize Your Focus" 3P columns + selection counter footer + parking lot) **with the synthesis block:**
   - `QuarterPostureBlock` — "Executive Synthesis / Your Quarter Posture" read-only summary card with placeholder copy framed around the **quarter/horizon breakdown** (NOT 3P).
   - Its existing "Proceed to Sprint Planning" CTA stays (correct for this context).

---

## In scope

1. **Rewrite `pages/pro-suite/quarter-map/CurrentQuarterFocusTab.tsx`** so it NO LONGER imports or renders `ThreePExercise`. Instead compose:
   - **The header** (title + "Planning for" quarter selector + "History" button). Lift this markup from `ThreePExercise`'s header (~lines 250–279) into this component — copy the JSX, preserve AOS tokens. Do NOT modify `ThreePExercise`.
   - **`ReferenceStrip`** — the "Reference: Your 12-Month Trajectory" dropdown (reuse by composition, props only).
   - **`QuarterPostureBlock`** — pass a placeholder `synthesisText` written as a quarter-breakdown readback (vision → 36/24/12-mo → four quarters → this quarter's immediate next steps / focus areas). **No 3P terminology** (no "Prioritize / Plant / Iterate", no capability buckets). `isGenerating={false}`. Reuse by composition; do NOT modify the component.
2. The quarter selector and History button remain as controls; placeholder behavior is acceptable (the selector may switch placeholder text or be inert for now).
3. After this change, Current Quarter Focus performs **no** `gm_assessments` / `quarter_map_selections` reads or writes, has no capability grid, no 3P buckets, no selection counter, no lock.
4. Confirm `ThreePExercise` is now imported only by `pages/SprintPlanning/ThreePPrioritizationPage.tsx`.

---

## Out of scope (do not touch)

- **Sprint Planning** `prioritization` page, **`ThreePExercise`**, the **Sprint Board**, or any 3P logic — leave entirely as-is. This task only removes the *misplaced* 3P from Quarter Map.
- The Quarter Map **route and nav are unchanged** — `/pro/planning/quarter-map/current-quarter` stays, and "Current Quarter Focus" remains step 2 in `QuarterMapSectionLayout`. Only the tab's *content* changes.
- **Quarter Sequence** tab, Strategic Roadmap, sidebar.
- **Real synthesis wiring** (n8n / Anthropic) — placeholder copy only.
- Do **not modify** the shared `QuarterPostureBlock` or `ReferenceStrip` components — compose with props. If a needed prop is genuinely missing, flag it rather than editing the shared component.

---

## Constraints

- AOS design system (tokens, Geist; no Inter / pure black / neon / glow / text gradients / Tailwind default grays). Existing components already use AOS variables — preserve them.
- TypeScript compiles with no new errors.
- No duplicated data/business logic.

---

## Acceptance criteria

1. `/pro/planning/quarter-map/current-quarter` shows, top to bottom: the header (title + quarter selector + History) → "Reference: Your 12-Month Trajectory" → the "Your Quarter Posture" synthesis card with a "Proceed to Sprint Planning" CTA.
2. **Zero 3P** on this tab: no capability grid, no Prioritize/Plant/Iterate buckets, no parking lot, no selection counter, no lock/save.
3. The synthesis placeholder copy is framed around the quarter/horizon breakdown with **no 3P terminology**.
4. "Proceed to Sprint Planning" routes to `/pro/planning/sprint-planning`.
5. The Sprint Planning 3P page (`/sprint-planning/prioritization`) and the Sprint Board are **unchanged and still work**.
6. `ThreePExercise` is no longer imported by the Quarter Map side.
7. No new TypeScript errors.

---

## Verification (before reporting done)

1. Build / typecheck — no new errors.
2. Load `current-quarter`; confirm the wireframe and that no 3P remains. Screenshot it.
3. Load `/sprint-planning/prioritization` and `/sprint-planning/board`; confirm both are unaffected.
4. Grep for `ThreePExercise` imports; confirm only the Sprint Planning page references it.
5. Diff summary of files changed.

---

## Report-back format

Files changed (one-line intent each); confirmation of each acceptance criterion; the current-quarter screenshot; the placeholder synthesis copy you used; confirmation that Sprint Planning/3P/board were untouched; anything flagged rather than decided.
