# Handoff Prompt — #20 (Pass A): In-area sub-navigation consistency — Foundations + Diagnostics

Paste the following to the executing agent.

---

You are working in the ArchitectOS Pro codebase (`C:\Users\Hicks\ArchitectOS Pro_beta`) as the implementing agent. **One pass** (not page-by-page): make the **in-area top sub-navigation** consistent across Foundations + Diagnostics, matching the **Pro Suite**. This is the sub-nav **only** — not container widening, not icons/colors (those are a separate next pass). Stay within scope; **verify before changing**; flag ambiguity rather than improvising.

**Read first:**
1. `DESIGN-GUIDE-QUICK.md`.
2. `docs/handoffs/20-subnav-consistency-task-spec.md` — the exact scope, the affected tools, and acceptance criteria.
The **Pro Suite is the reference** — look at how its sub-tabbed layouts (`SprintPlanningLayout`, `ExecutionReflectLayout`, `OrientLayout`, `OperateLayout`, `QuarterMapSectionLayout`) render their top tab bar (eyebrow + title + tab pills, brass-active, below the breadcrumb).

**Your task:** bring the Foundations + Diagnostics multi-tab tools' in-area top sub-nav (rendered via the shared `SectionLayout`) up to the **Pro Suite's styling and position** — so the in-area tab navigation looks and sits identically everywhere.

**Affected tools:** Foundations — Agency Snapshot, Clarity Compass, GV Simulator, Architect Evolution; Diagnostics — AE Ladder, M&R Audit. (Landings have no sub-nav — skip.)

**Hard guardrails:**
- **Investigate first** — confirm where the sub-nav renders (likely shared `SectionLayout`) and how it differs from the Pro Suite before changing anything.
- **If you change the shared `SectionLayout`, verify every consumer still renders correctly** (Settings + any others) — **no regressions.** If standardizing it would break non-target pages, **flag it and scope per-section instead.**
- **Pro Suite is the reference — do NOT change it.**
- **Sub-nav styling + position only** — no route/content/functional changes, no widening, no icon/color work. **No design-guide changes.**
- AOS tokens; TypeScript clean.

**When done:** verify the acceptance criteria (Foundations + Diagnostics sub-nav matches the Pro Suite in style + position; Pro Suite unchanged; all `SectionLayout` consumers regression-free; build clean), include screenshots of a Foundations tool, a Diagnostics tool, and a Pro Suite tool for comparison, and report back in the format the task spec specifies.
