# Handoff Task Spec — #05: Execution Hub structure (Orient / Operate / Reflect)

> **Status:** Ready for execution
> **Companion docs (read first, in order):** `docs/execution-hub-spec.md` (canonical vision + §10 reasoning), `docs/execution-hub-audit-inventory.md` (the page ledger), `docs/sprint-planning-flow-spec.md` (the Planning Hub pattern this mirrors).
> **Role boundary:** Executing agent. Implement exactly this. Flag, don't improvise. Do not expand scope.

---

## Objective

Stand up the **Execution Hub as a launchpad** with three elements — **Orient · Operate · Reflect** — and nest the existing Execution pages under them, mirroring the Planning Hub (Roadmap Review · Quarter Map · Sprint Planning). This is a **non-destructive structural pass**: reuse existing components, preserve every page, redirect old routes. The goal is a **walkable Orient/Operate/Reflect hub** to react to — not page polish, not wiring, not the dashboard split.

---

## Target structure

```
/pro/execution            → Execution Hub landing (launchpad; lists the 3 elements, no tools on it)
  /orient                 → Sprint Charter & Summary   (mount existing SprintLaunch)
  /operate                → Status Tracker             (mount existing StatusTracker)
  /reflect                → Reflect layout w/ 3 sub-tabs:
      index → redirect to wind-down
      /reflect/wind-down         (mount existing SprintWindDown)
      /reflect/retrospective     (mount existing Retrospective)
      /reflect/reflection-review (mount existing ReflectionReview)
  /synthesis              → MomentumSynthesis — LEAVE AS-IS (pending relocation to Intelligence; do not surface in the 3 elements, do not delete)
```

---

## In scope

1. **New grouped routes** in `App.tsx` under `/pro/execution`, mounting the **existing** components unchanged:
   - `orient` → `SprintLaunch`
   - `operate` → `StatusTracker`
   - `reflect` → a new **Reflect layout** (see #2) with child routes `wind-down` → `SprintWindDown`, `retrospective` → `Retrospective`, `reflection-review` → `ReflectionReview`, and `index` → redirect to `wind-down`.

2. **New Reflect layout component** — a tabbed shell modeled on `SprintPlanningLayout` / `QuarterMapSectionLayout` (SectionLayout + tab nav + `Outlet`), with three sub-tabs in close order: **Wind-Down · Retrospective · Reflection & Review.** Use AOS tokens.

3. **Reframe the Execution Hub landing** (`ExecutionLanding.tsx`) into the **three-element launchpad**: present **Orient / Operate / Reflect** as the primary navigation (three cards/links → the new routes), replacing the current four-tool NavCard sets (Sprint Launch / Status Tracker / Momentum Synthesis / Retrospective).
   - **Preserve** the existing lifecycle-state logic (`useSprintState`) and **gate/label the three elements by state where practical** (e.g., Reflect muted until close) — but don't over-engineer; the core requirement is the 3-element launchpad.
   - **Preserve** the existing health/stats blocks and sprint-identity content — **do not delete them.** They are flagged to relocate to the home dashboard later (V-08); leave them in place for now. Add a brief code comment noting the pending move.
   - Point the landing's internal links/banners (e.g., WindDownBanner, RetrospectiveBanner) to the new element routes.

4. **Redirect old flat routes → new** so nothing breaks (the sidebar's dynamic Execution links and any internal links keep working; sidebar itself is untouched — nav cleanup is last):
   - `launch` → `orient`
   - `status-tracker` → `operate`
   - `wind-down` → `reflect/wind-down`
   - `retrospective` → `reflect/retrospective`
   - `reflection-review` → `reflect/reflection-review`
   - `synthesis` → **unchanged** (stays live).

5. **Log the executed route moves** by appending a short note to `docs/execution-hub-audit-inventory.md` (route table: old → new), per the standing traceability rule.

---

## Out of scope (do not do)

- **No sidebar / left-nav changes** — that is the LAST step. (Redirects keep the existing dynamic links working.)
- **No dashboard split** — do not remove the health/stats content from the hub; the home Strategic Overview dashboard is downstream (V-08).
- **No Momentum Synthesis relocation** — leave `/synthesis` live; Intelligence Hub doesn't exist yet.
- **No page polish / AOS redesign of the existing tool pages** — Orient/Operate/Reflect mount the current `SprintLaunch` / `StatusTracker` / `SprintWindDown` / `Retrospective` / `ReflectionReview` **as-is**. (Reshaping them — Sprint Charter mini-dashboard, standup tracker, etc. — is the next refinement pass.)
- **No wiring / persistence / content changes.**
- **No deletion of any page.**

---

## Constraints

- **New shell + launchpad use AOS tokens** (match the Planning landing / Quarter Map layout look). Existing tool pages are mounted unchanged (still pre-AOS — that's fine for this pass).
- Reuse existing components by mounting; do not duplicate them.
- TypeScript compiles with no new errors. `HashRouter` nesting consistent with existing routes.

---

## Acceptance criteria

1. `/pro/execution` renders a **launchpad with three elements — Orient, Operate, Reflect** — and no tools directly on the hub page.
2. **Orient** → Sprint Charter & Summary (SprintLaunch content). **Operate** → Status Tracker. **Reflect** → tabbed shell with **Wind-Down · Retrospective · Reflection & Review**; `/reflect` lands on Wind-Down; all three sub-tabs reachable.
3. Old flat routes (`launch`, `status-tracker`, `wind-down`, `retrospective`, `reflection-review`) **redirect** to their new homes — no dead links; the sidebar's Execution links still resolve.
4. `/synthesis` (Momentum Synthesis) still loads, unchanged, and is **not** surfaced in the three elements.
5. No page deleted; health/stats + lifecycle content **preserved** on the hub (with a comment noting the pending home-dashboard move).
6. New shell/launchpad on AOS tokens; existing tool pages mounted as-is.
7. Build clean; no new TS errors.
8. `execution-hub-audit-inventory.md` updated with the executed old→new route map.

---

## Verification (before reporting done)

1. Build / typecheck — no new errors.
2. Walk it: hub → Orient, hub → Operate, hub → Reflect → each sub-tab. Confirm Reflect index lands on Wind-Down.
3. Hit each old flat route and confirm it redirects to the new home; confirm `/synthesis` still loads.
4. Screenshot the hub landing and the Reflect tabbed view.
5. Diff summary of files changed.

---

## Report-back format

Files changed (one-line intent each); how you handled the hub landing (what was preserved vs. re-pointed); confirmation of each acceptance criterion; the two screenshots; the old→new route map you logged to the ledger; anything flagged rather than decided.
