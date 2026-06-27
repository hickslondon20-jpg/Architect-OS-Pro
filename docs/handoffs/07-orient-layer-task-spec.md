# Handoff Task Spec — #07: Orient layer (Overview/Synthesis + Alignment Tools & Resources)

> **Status:** Ready for execution
> **Companion docs (read first):** `docs/execution-hub-spec.md` (esp. §11 Orient detail + ED-10), `docs/execution-hub-audit-inventory.md` (ledger). Mirror the tab pattern in `SprintPlanningLayout` / `ExecutionReflectLayout`.
> **Role boundary:** Executing agent. Build the **container + shape** only. Flag, don't improvise. Do not expand scope.

---

## Objective

Turn the Orient element into a **sub-tabbed layer** with two sub-tabs — **Overview / Synthesis** and **Alignment Tools & Resources** — reshaping the existing `SprintLaunch` content across them. **Container + shape only:** placeholder data, no wiring, no PDF export logic (button shape only), history is an empty-state shell. AOS tokens. Mirrors the established hub → element → sub-tabs pattern.

Today `/pro/execution/orient` mounts `SprintLaunch` directly (from #05). This replaces that with the tabbed shell + two sub-pages.

---

## Target structure

```
/pro/execution/orient   (tab shell — sub-tabs: Overview · Alignment Tools & Resources)
  index       → redirect to overview
  /overview   → OrientOverviewPage      (interactive sprint mini-dashboard)
  /alignment  → OrientAlignmentPage      (one-pager artifact + Current/Historic + archive)
```

---

## In scope

1. **New Orient tab layout** (e.g., `pages/ProSuite/OrientLayout.tsx`) — SectionLayout + tab nav with two tabs (**Overview** · **Alignment Tools & Resources**) + `Outlet`, AOS-tokened, modeled on `ExecutionReflectLayout`.

2. **Routes** in `App.tsx` under `orient`: convert `orient` from a leaf (currently → `SprintLaunch`) into a parent mounting `OrientLayout`, with children: `index` → redirect to `overview`, `overview` → `OrientOverviewPage`, `alignment` → `OrientAlignmentPage`. Keep the old `launch` → `orient` redirect working (it should land on `orient` → `overview`).

3. **Overview / Synthesis page** (`OrientOverviewPage`) — interactive sprint mini-dashboard, placeholder data. Components (per spec §11):
   - Sprint identity: name · quarter · status · dates / days-remaining
   - Sprint goal (primary + up to 2 supporting outcomes)
   - Sprint theme / framing line
   - 3P at-a-glance: Prioritize / Plant / Iterate capability areas + initiative counts (compact board snapshot)
   - Owners / accountability summary
   - Progress strip (placeholder): completion %, initiatives/milestones, blockers
   - Quick links into Operate (the tracker/board)
   - **Reuse material** from `SprintLaunch` (identity/at-a-glance) and the **sprint-scoped** versions of the parked components in `pages/ProSuite/_parked/ExecutionHubLifecycleBlocks.tsx` (copy/adapt for sprint scope — do not repurpose the parked file itself; it stays parked for the home dashboard / V-08).

4. **Alignment Tools & Resources page** (`OrientAlignmentPage`) — the exportable one-pager + archive:
   - **Current / Historic** pill toggle.
   - **Current** → rendered one-page charter (reshape `SprintLaunch`'s executive-summary narrative + 3P execution plan), export-friendly single-column layout: header (name · quarter · dates · lock date) · sprint goal (+ supporting) · theme · executive summary · 3P execution plan (P/Plant/Iterate → initiatives + owners) · a **Download** button (**shape only** — no handler/PDF lib).
   - **Historic** → a table/list shell of past sprints with an **empty state** ("Available after you've run multiple sprints"); the clickable-row → render + download behavior is structural shape only (no data).
   - A reserved, clearly-labeled placeholder for **future alignment tools** (comms planning, buy-in) — not built.

5. **Preserve `SprintLaunch.tsx`** — do not delete. Its content is reshaped into the two new pages; once unused, leave it on disk and **log it in `execution-hub-audit-inventory.md`** (note it's the source material, now superseded by Orient's two sub-pages).

---

## Out of scope (do not do)

- **No PDF export wiring** — the Download button is shape only. (Per CLAUDE.md, the export will use N8N + Google Docs merge fields → Supabase Storage, NOT a frontend PDF library. Do not add jspdf/react-to-pdf.)
- **No data wiring / persistence** — all content placeholder; no `sp_sprint_*` reads.
- **No historical-artifacts data or Supabase table** — empty-state shell only (the table is downstream, V-10).
- **No changes** to Operate, Reflect, the hub landing, the sidebar, or any routes outside `orient`.
- **Do not delete** `SprintLaunch.tsx` or disturb the parked `_parked/ExecutionHubLifecycleBlocks.tsx`.

---

## Constraints

- **AOS tokens** throughout; match the look of the refined hub / Planning surfaces.
- Mirror the existing tab-layout pattern (`ExecutionReflectLayout` / `SprintPlanningLayout`).
- TypeScript compiles with no new errors.

---

## Acceptance criteria

1. `/pro/execution/orient` is a **two-sub-tab shell** (Overview · Alignment Tools & Resources); `index` redirects to `overview`; the old `launch` redirect lands on Overview.
2. **Overview** renders the sprint mini-dashboard components (placeholder data) per §11.
3. **Alignment Tools & Resources** renders the **Current/Historic** pill; Current shows the one-pager (reshaped SprintLaunch content) with a shape-only Download button; Historic shows the empty-state table shell.
4. Content is split per spec: identity/at-a-glance → Overview; exec-summary + 3P plan → the one-pager.
5. `SprintLaunch.tsx` preserved (not deleted) and logged; `_parked` file untouched.
6. No wiring, no PDF lib, no historical data; Operate/Reflect/hub/sidebar/other routes unchanged.
7. AOS tokens; build clean; no new TS errors.

---

## Verification (before reporting done)

1. Build / typecheck — no new errors.
2. Walk it: `/orient` → Overview; switch to Alignment Tools; flip the Current/Historic pill; confirm the empty-state on Historic. Confirm `/launch` still redirects into Orient.
3. Confirm Operate/Reflect/hub/`/synthesis` unchanged.
4. Screenshot Overview and Alignment (Current + Historic states).
5. Diff summary; confirm `SprintLaunch.tsx` preserved + ledger note added.

---

## Report-back format

Files changed (one-line intent each); how you split the SprintLaunch content; how you handled `SprintLaunch.tsx` (preserved + logged); confirmation of each acceptance criterion; the screenshots; anything flagged rather than decided.
