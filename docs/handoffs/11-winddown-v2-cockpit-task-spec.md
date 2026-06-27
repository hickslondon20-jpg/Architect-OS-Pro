# Handoff Task Spec — #11: Wind-Down v2 (two-panel cockpit + wider-grid exemplar)

> **Status:** Ready for execution — **this REVISES / REPLACES the Wind-Down built in #10.**
> **Companion docs (read first):** `docs/execution-hub-spec.md` §13 (Sub-tab 1 — Wind-Down v2) + **ED-13**; `DESIGN-GUIDE-QUICK.md` Surface Hierarchy. The current file is `pages/ProSuite/SprintWindDown.tsx` (from #10).
> **Role boundary:** Executing agent. This is a **layout + interaction redesign** (shape/placeholder, **no wiring**). It also **tests a wider/grid layout that intentionally bends** the guide's 1440-max-width / single-column rules — that's expected; **do NOT change the design guide.** Flag, don't improvise.

---

## Context

You built Wind-Down in #10 as a single-column scroll (sprint goal → completion decisions → carrying forward → looking ahead → finalize). **Replace it** with a two-panel **cockpit** and test a wider/grid layout. Same data/placeholder content, reshaped.

---

## Objective

Wind-Down becomes a **"close + pre-stage" cockpit**: dispose of this sprint's work on the left while it pre-stages into next sprint on the right — in fewer screens (less scroll), using more screen width.

---

## In scope

1. **Wider layout (the exemplar test):**
   - **Widen the top nav banner** (the "Execution Hub / Reflect" title + sub-tab nav) to run wider across the screen; reduce the side gutters / use more usable width. If that top bar is a shared layout component, apply consistently across the execution element shells (Orient/Operate/Reflect); if per-element, apply at least to the Reflect shell and keep it consistent.
   - Lay Wind-Down content in a **two-column grid**; reduce scroll.
   - **Keep body/reading text in a comfortable measure inside cards** — wide is for structure/grids/nav, not for stretching prose edge-to-edge.
   - This deliberately bends the guide's max-width/single-column rules — that's the test. **Do not edit the design guide.**

2. **Top — Sprint goal + supporting goals:** primary goal, then up to 2 supporting-outcome cards. If none, the container stays and shows **N/A**.

3. **Left panel — Completion Decisions** (Pressure-Map-style rows, in **Prioritize → Plant → Iterate** order):
   - Each initiative is a row that **expands** to quick-update milestone statuses + set the initiative's **Complete / Roll Over / Release**.
   - A **"View full grid"** button opens a **pop-up of the Operate bulk-update workspace** (reuse the Status Tracker table in a modal) — bulk-edit milestones without leaving Wind-Down.

4. **Right panel — Carry-Forward** (mini **Prioritize / Plant / Iterate** grid):
   - Tagging an initiative **Roll Over** (left panel) **populates a card** in this grid.
   - **Drag-and-drop** cards into the bucket the founder thinks they'll land next sprint. **Initiative-level** moves. **Directional reference only** — helper text makes clear it's a starting point for next sprint planning, not binding; **rules NOT enforced** (no 3-per-bucket / one-column limits).
   - Click a card → add an optional note + open the **single-initiative record pop-up** (reuse the Planning workspace modal — milestones/notes/comments).

5. **Bottom — Finalize** (navy card, CSO-insight style):
   - **Keep the live counts** (completing / rolling-over / releasing) and **update them in real time** as decisions change.
   - Two actions: **Save** (partial — keep work, return later) and **Lock & Complete** (does NOT close the sprint).

6. **Remove "Looking ahead"** (forward-seeding questions) from Wind-Down. **Preserve the content** — it relocates to the Retrospective in a later pass; **park + log it, don't delete.** Update the wind-down progress checklist to drop the forward-seeding item.

7. **Drag-and-drop** built as a **real interaction** (draggable cards into columns), shape/placeholder, **no persistence.**

---

## Out of scope (do not do)

- **No wiring / persistence** — DnD positions, decisions, notes, counts are local state only.
- **No redesign of Retro / Reflection / Orient / Operate content** (only the *shared top-bar widening* may touch them if it's a shared component — apply consistently, don't redesign those pages).
- **Do not change the design guide** (the wider layout is under evaluation here).
- **Do not delete** the looking-ahead content (park + log).

---

## Constraints

- AOS + Surface Hierarchy. **Navy = the finalize card (earned); sparing elsewhere.** Reuse existing modals (Operate bulk-update table; Planning workspace pop-up). Semantic pills; Geist Mono numbers. Keep reading measure comfortable. TypeScript clean.

---

## Acceptance criteria

1. Wind-Down is a **two-panel cockpit**: goal + supporting (N/A fallback) on top; **Completion Decisions** left (pressure-map rows, P→Plant→Iterate, expand → milestone quick-update + Complete/Roll Over/Release, **"View full grid" pop-up** of the Operate bulk-update workspace); **Carry-Forward** right (mini-3P, **DnD initiative cards**, directional/unenforced with helper text, card → note + record pop-up); **navy finalize** bottom with **live real-time counts** + **Save** + **Lock & Complete**.
2. Top bar runs **wider**; content uses a **grid / more width**; **less scroll**; prose stays a readable measure.
3. **"Looking ahead" removed** from Wind-Down; content **preserved + logged** for the Retro pass.
4. **Drag-and-drop works** (shape); nothing persists; reuses the two existing modals.
5. AOS; navy only where earned (finalize); design guide unchanged; nothing else redesigned (beyond shared top-bar widening, applied consistently).
6. Build clean; no new TS errors; ledger note for the looking-ahead relocation (+ the top-bar change if shared).

---

## Verification (before reporting done)

1. Build / typecheck — no new errors.
2. Walk it: expand a decision row → update milestones + set Roll Over → confirm a card appears in Carry-Forward → drag it into a bucket → click it → record pop-up; click "View full grid" → bulk-update pop-up; watch the finalize counts update live; try Save and Lock & Complete.
3. Confirm reading measure stays comfortable and the page reads in fewer screens.
4. Confirm Retro / Reflection / Orient / Operate content unchanged.
5. Screenshot the full Wind-Down + the two pop-ups.
6. Diff summary; confirm ledger notes.

---

## Report-back format

Files changed (one-line intent each); how you built the DnD + reused the two modals; how/where you applied the wider top bar (and whether it's a shared component); where the looking-ahead content was parked (+ ledger); confirmation of each acceptance criterion; screenshots; anything flagged rather than decided.
