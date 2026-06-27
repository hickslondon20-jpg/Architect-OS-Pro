# Handoff Task Spec — #09: Operate layer (Timeline + Status Tracker)

> **Status:** Ready for execution
> **Companion docs (read first):** `docs/execution-hub-spec.md` §12 (Operate detail) + ED-11; `DESIGN-GUIDE-QUICK.md` **Surface Hierarchy** (governing visual rule). Mirror the tab pattern in `OrientLayout` / `ExecutionReflectLayout`.
> **Role boundary:** Executing agent. Build the **container + shape** (Timeline) and a **visual reshape** (Status Tracker). Flag, don't improvise. Do not expand scope.

---

## Objective

Turn the Operate element into a **sub-tabbed layer** with a **top sub-tab nav** and two sub-tabs — **Timeline** (a new Gantt-*style* horizon, placeholder) and **Status Tracker** (the existing tool, moved under Operate and visually reshaped). Functionality stays as drafted; **no wiring**. The design spec / Surface Hierarchy is the guiding principle for all UI/UX.

Today `/pro/execution/operate` mounts `StatusTracker` directly (from #05). This replaces that with the tab shell + two sub-pages.

---

## Target structure

```
/pro/execution/operate   (tab shell — top nav: Timeline · Status Tracker)
  index            → redirect to timeline
  /timeline        → OperateTimelinePage   (Gantt-style horizon, NEW placeholder)
  /status-tracker  → StatusTracker         (existing tool, moved here + reshaped)
```

---

## In scope

1. **New Operate tab layout** (e.g., `pages/ProSuite/OperateLayout.tsx`) — SectionLayout + top tab nav (**Timeline · Status Tracker**) + `Outlet`, AOS-tokened, modeled on `OrientLayout`.

2. **Routes** in `App.tsx`: convert `operate` from a leaf (→ `StatusTracker`) into a parent mounting `OperateLayout`, with children `index` → redirect to `timeline`, `timeline` → `OperateTimelinePage`, `status-tracker` → `StatusTracker`. Update the existing old-route redirect so `/pro/execution/status-tracker` lands on `/pro/execution/operate/status-tracker`. **Append the route change to `docs/execution-hub-audit-inventory.md`** (per the standing log-before-move rule).

3. **Timeline page** (`OperateTimelinePage`) — NEW **Gantt-style** horizon, placeholder data:
   - Lay initiatives/milestones across the sprint dates using **start + projected-completion** as a duration *proxy*. **No dependency graph, no exact durations, no drag-resize date editing.**
   - **Resilient to partial/unknown data:** show what's known, mark undated/unknown items clearly, and never break or look empty/broken when dates are missing. (See ED-11 — incomplete data must not render the view obsolete.)
   - Purpose: a low-maintenance "what's on the horizon / next few weeks / what did we say we'd start when" read.
   - AOS + Surface Hierarchy (white cards on parchment; navy only if it genuinely earns it — likely a header/axis treatment at most; Geist Mono for dates/numbers).

4. **Status Tracker reshape** (sub-tab 2):
   - **Move** `StatusTracker` under `operate/status-tracker`. **Keep its functionality exactly as drafted** — filter by milestone/initiative, flat/grouped views, standup mode, bulk + systematic updates. No functional rework, no wiring.
   - **Visual only:** apply the Surface Hierarchy (it's already close on the white backdrop); **swap the blue accents → brass / parchment** where they're accents; **keep the progress bar obsidian** (not the other blue); use **semantic status pills** and **Geist Mono** numbers.

5. **Top sub-tab nav** added; Status Tracker "comes down" to sub-tab 2.

---

## Out of scope (do not do)

- **No data wiring / persistence** — Timeline is placeholder; Status Tracker keeps its mock data.
- **No functional changes** to Status Tracker beyond moving it + the visual reshape.
- **No true-Gantt complexity** — no dependency lines, no duration math, no draggable/resizable date editing.
- **No other pages** — Orient, Reflect, the hub landing, the sidebar, `_parked`, and other routes stay as-is.

---

## Constraints

- **`DESIGN-GUIDE-QUICK.md` Surface Hierarchy is the governing rule.** White cards on parchment; sunken only for nested sub-blocks; **navy used sparingly, only when it earns it** (do NOT force a navy box onto either page); brass = one primary action per screen; semantic pills; Geist Mono numbers. No Tailwind grays / hardcoded hex / Inter / glows / gradient text.
- Mirror the existing tab-layout pattern (`OrientLayout`). TypeScript clean.

---

## Acceptance criteria

1. `/pro/execution/operate` is a **two-sub-tab shell** with a top nav (**Timeline · Status Tracker**); `index` redirects to `timeline`; the old `/status-tracker` route redirects to `/operate/status-tracker`.
2. **Timeline** renders a Gantt-*style* horizon placeholder using start/projected-completion as a duration proxy, and **handles missing/partial dates gracefully** (no broken/empty layout).
3. **Status Tracker** functionality is unchanged (filter, flat/grouped, standup, bulk) but **reshaped**: white-on-parchment hierarchy, **blue accents → brass/parchment**, **progress bar stays obsidian**, semantic status pills, Geist Mono numbers.
4. Navy is used **sparingly / only where earned** — not forced onto either page.
5. No wiring; no true-Gantt complexity; Orient/Reflect/hub/sidebar/other routes unchanged.
6. AOS tokens; build clean; no new TS errors; route change logged in the ledger.

---

## Verification (before reporting done)

1. Build / typecheck — no new errors.
2. Walk it: `/operate` → Timeline; switch to Status Tracker; confirm the old `/status-tracker` redirect lands on the tracker. Confirm Timeline still reads sensibly with some items missing dates.
3. Confirm Orient / Reflect / hub / `/synthesis` unchanged.
4. Screenshot Timeline and the reshaped Status Tracker.
5. Diff summary; confirm the ledger route note was added.

---

## Report-back format

Files changed (one-line intent each); how the Timeline degrades on missing dates; where (if anywhere) you used a navy accent and why it earned it; confirmation of each acceptance criterion; the screenshots; anything flagged rather than decided.
