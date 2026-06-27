# Handoff Task Spec — #20 (Pass A): In-area sub-navigation consistency — Foundations + Diagnostics

> **Status:** Ready for execution. **One pass** across all necessary pages (not page-by-page).
> **This is the in-area top sub-nav ONLY** — not container widening, not icon/color components (those are the next combined B+C page-by-page pass).
> **Companion docs:** `DESIGN-GUIDE-QUICK.md`. **The Pro Suite is the reference** for the target spec — its sub-tabbed layouts (`SprintPlanningLayout`, `ExecutionReflectLayout`, `OrientLayout`, `OperateLayout`, `QuarterMapSectionLayout`) and how their top sub-nav looks/sits.
> **Role boundary:** Executing agent. Sub-nav styling + position only. **Verify before changing**; if a shared component is involved, confirm no regressions before/after. Flag, don't improvise.

---

## Objective

Make the **in-area top sub-navigation** (the tool/section tab bar) **consistent across Foundations + Diagnostics**, matching the **Pro Suite's treatment and position** — same styling spec, same placement (below the breadcrumb, above the content). So once a founder is inside any tool, the in-area tab navigation feels identical everywhere.

---

## Context

- **Pro Suite** sub-nav (the reference): an eyebrow + section title + a styled tab bar (the numbered/icon tab pills, brass-active), sitting below the breadcrumb. This is the look/position to match.
- **Foundations + Diagnostics** multi-tab tools render their top sub-nav via the shared **`SectionLayout`** (the `tabs` prop). That tab treatment/position currently differs from the Pro Suite (e.g., the AE Ladder tabs render in a plainer underline style). **That gap is what this pass closes.**

Affected (multi-tab) tools:
- **Foundations:** Agency Snapshot, Clarity Compass, GV Simulator, Architect Evolution (`/foundations/founder-evolution`).
- **Diagnostics:** AE Ladder, M&R Audit.
- (The Foundations/Diagnostics *landing* pages are launchpads with no sub-nav — not in scope.)

---

## In scope

1. **Investigate first.** Identify exactly where the Foundations/Diagnostics in-area sub-nav renders (likely the shared `SectionLayout`) and precisely how it differs from the Pro Suite sub-nav (styling + position). Confirm what component the Pro Suite sub-tabbed layouts use for their tab bar.
2. **Align Foundations + Diagnostics to the Pro Suite spec** — same tab styling (eyebrow + title + the Pro-Suite tab treatment, brass-active) and same **position** (below the breadcrumb, above content).
3. **If the fix is in the shared `SectionLayout`:** update it to the Pro Suite spec, but **verify every consumer of `SectionLayout` still renders correctly** (Settings and any others) — no regressions. If standardizing `SectionLayout` would regress non-target pages, **flag it and scope carefully** (e.g., align per-section instead) rather than breaking other areas.
4. **Pro Suite is the reference — do not change it.**

---

## Out of scope (do not do)

- **Container widening** (Pass B) and **icons/coloring/components** (Pass C) — the next page-by-page pass.
- **No route / content / functional changes** — sub-nav styling + position only.
- **No Pro Suite changes** (reference only). **No design-guide changes.**

---

## Constraints

- AOS + parchment-as-signal; match the Pro Suite sub-nav spec exactly (styling + position). TypeScript clean. Non-destructive; verify no regressions across all `SectionLayout` consumers.

---

## Acceptance criteria

1. Foundations + Diagnostics multi-tab tools show the in-area top sub-nav in the **same style and same position as the Pro Suite** (eyebrow + title + the Pro-Suite tab treatment, brass-active, below the breadcrumb).
2. The **Pro Suite is unchanged.**
3. **All `SectionLayout` consumers render without regression** (Settings + any others verified).
4. No route/content/functional changes; build clean.

---

## Verification (before reporting done)

1. Build / typecheck — no new errors.
2. Visually compare, side by side: a Foundations tool (e.g., Clarity Compass), a Diagnostics tool (AE Ladder + M&R Audit), and a Pro Suite tool (e.g., Sprint Planning) — the sub-nav should look and sit identically.
3. Spot-check every other `SectionLayout` consumer (Settings, etc.) for no regression.
4. Screenshots of a Foundations tool, a Diagnostics tool, and (for comparison) a Pro Suite tool.
5. Diff summary.

---

## Report-back format

Files changed (one-line intent each); where the sub-nav was standardized (shared `SectionLayout` vs per-section) and why; the before/after diff in styling/position; the regression check across all `SectionLayout` consumers; confirmation the Pro Suite is unchanged; screenshots; anything flagged rather than decided.
