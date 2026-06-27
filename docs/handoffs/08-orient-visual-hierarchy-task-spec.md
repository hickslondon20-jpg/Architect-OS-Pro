# Handoff Task Spec — #08: Orient visual-hierarchy refinement (exemplar)

> **Status:** Ready for execution
> **Companion docs (read first):** `DESIGN-GUIDE-QUICK.md` — the new **Surface Hierarchy** section (this task's governing rule) + the existing Composition Rules / KPI card / Hero strip patterns. Also `docs/execution-hub-spec.md` §11 (Orient content).
> **Role boundary:** Executing agent. **Visual/design pass only** — CSS/markup styling, no logic/route/content changes. Flag, don't improvise.

---

## Why

The Orient pages (and the execution pages generally) read flat: they default to **parchment-on-parchment**, so there's no figure/ground and every block carries equal weight. This pass makes Orient the **exemplar** for the new Surface Hierarchy — white cards on a parchment canvas, parchment-deep only for nested sub-blocks, **navy as a single accent per page**, brass/obsidian buttons, and semantic-colored status pills. Once approved, the same treatment rolls out to the other execution pages (separate pass).

---

## Scope: the two Orient sub-pages

`OrientOverviewPage.tsx` and `OrientAlignmentPage.tsx` (and, if needed, light touches to `OrientLayout.tsx` tab shell for consistency).

---

## In scope

**Apply the Surface Hierarchy (per the design guide):**

1. **Default containers to white (`var(--bg-surface)`) on the parchment canvas** — stop using parchment as the card surface. Parchment-deep (`var(--bg-sunken)`) is only for nested sub-blocks *inside* white cards.

2. **Overview / Synthesis page:**
   - Sprint identity + goal in a **white card**; the goal's supporting-outcome boxes and the goal statement as **sunken** sub-blocks inside it.
   - **Progress signal** as its own **white card** with the stat tiles (Completion / Initiatives / Milestones / Blockers) as sunken tiles; numbers in **Geist Mono**.
   - **3P at-a-glance** as **white cards** (asymmetric or evenly — but white), each with its P / Plant / Iterate semantic accent.
   - **One navy (`var(--bg-inverse)`) accent per page** — e.g., a slim sprint-identity header strip *or* a single insight/CTA panel (your call; one, not many). `fg-on-dark` text on it.
   - **"Open tracker"** as a **brass primary** button.
   - **"Active Sprint" / status** as a **semantic pill** (not a flat gray tag).

3. **Alignment Tools & Resources page:**
   - The one-pager rendered as a clean **white "document" card** on parchment (this also previews the eventual PDF).
   - **Current / Historic** pill — keep the brass-active treatment (already good).
   - **Download** as a **brass or obsidian** button (shape only; no wiring).
   - Historic empty-state inside a white card; table header row may use sunken.
   - **Remove the "NOT BUILT IN THIS PASS" tag** from the Future Alignment Tools section. Keep the section, reframed as a forward teaser (e.g., "Coming: comms planning, team buy-in, launch-readiness") — not a build-status flag.

4. **Navy usage:** accent only — at most one navy feature/strip per page. Do not turn large fields navy.

---

## Out of scope (do not do)

- **No logic / route / data / content changes** — same placeholder content, same routes, same components' behavior. Styling/markup only.
- **No other pages** — Orient only this pass (Operate/Reflect/hub rollout is a later pass).
- No wiring, no PDF library, no new data.
- Do not touch the sidebar, `_parked` file, or `SprintLaunch.tsx`.

---

## Constraints

- Follow `DESIGN-GUIDE-QUICK.md` **Surface Hierarchy** + existing patterns exactly. AOS tokens only (no Tailwind grays, no hardcoded hex, no Inter, no glows/gradient-text).
- Brass = one primary action per screen. Navy = one accent per page. Every chip has a semantic reason.
- TypeScript compiles with no new errors.

---

## Acceptance criteria

1. Orient Overview and Alignment use **white cards on the parchment canvas** — no parchment-on-parchment card surfaces; sunken used only for nested sub-blocks.
2. Each Orient page has **exactly one navy accent** (strip or panel), a **brass primary** action, and **semantic-colored** status pills where status is shown.
3. Numbers (completion %, counts) render in **Geist Mono**.
4. The "NOT BUILT IN THIS PASS" tag is **removed**; the Future Alignment Tools section remains as a forward teaser.
5. No logic/route/content changes; Operate/Reflect/hub/sidebar untouched; behavior identical to #07.
6. Clear visual distinction/hierarchy — the page no longer "runs together" as one tone.
7. AOS tokens; build clean; no new TS errors.

---

## Verification (before reporting done)

1. Build / typecheck — no new errors.
2. Screenshot Overview and both Alignment states (Current + Historic); eyeball against the Strategic Overview dashboard reference for figure/ground (white cards, one navy accent, brass action, semantic pills).
3. Confirm routes/behavior unchanged from #07.
4. Diff summary of files changed.

---

## Report-back format

Files changed (one-line intent each); where you placed the single navy accent on each page; confirmation of each acceptance criterion; the screenshots; anything flagged rather than decided.
