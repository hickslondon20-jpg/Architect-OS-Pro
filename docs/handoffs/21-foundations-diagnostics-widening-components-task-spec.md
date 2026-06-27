# Handoff Task Spec — #21 (Pass B + C): Foundations + Diagnostics — widening + components (page by page)

> **Status:** Ready for execution. **Page by page (one tool at a time).** Do one tool unit, build, **report (NO screenshots), and PAUSE** — do not start the next until told.
> **B and C are done in tandem on each page:** container widening (B) + bring components (icons/coloring/surfaces) fully onto the current design spec (C), at the same time.
> **Companion docs:** `DESIGN-GUIDE-QUICK.md` — **Width & density**, **Surface Hierarchy**, **parchment-as-signal**. The Pro Suite is the working-style reference.
> **Context:** these tools were AOS-tokenized in earlier Phase-5B passes, but the design spec has **evolved since** (parchment-as-signal, surface hierarchy, navy-sparingly) — bring them up to **current** spec.
> **Role boundary:** Executing agent. Width + components only. **No screenshots in the report.** Flag, don't improvise.

---

## Objective

For each Foundations + Diagnostics tool, apply — **in tandem on each page:**
- **(B) Sensible container widening**, addressing **BOTH the workspace state (the form/exercise) AND the dashboard/results state** that renders after submission.
- **(C) Bring all components (icons, coloring, surfaces) fully onto the current design spec.**

---

## (B) Widening — judicious, NOT blanket full-width

- **Dashboards / data-display pages that sit in the content area** (e.g., the Agency Snapshot dashboard) → **stretch wider, toward the edges**, using the layout so it doesn't read as a single-column scroll.
- **Interactive forms / workspaces / the simulator** (e.g., GV Simulator calculator + scenario planner, the Agency Snapshot entry forms, the Clarity Compass vision-state form) → **keep contained / centered in the middle** — do NOT stretch a form edge-to-edge.
- **Headers match their content's width** — a contained page has a contained header; an edge-to-edge page has a wider header (e.g., Architect Evolution headers start at the appropriate section).
- **Reading prose** → comfortable measure inside cards.
- Use grids/structure where it makes sense. **Do NOT restructure dashboards or add new cards** — this is width + layout sense only.

## (C) Components — bring fully onto the current spec

- **Parchment-as-signal:** white = default nested surface (subtle shadow for lift); parchment only for subsection header bars + open-text/input zones; obsidian for hero metrics. Remove parchment-as-generic-nesting.
- **Surface hierarchy** + AOS tokens throughout; **semantic colors** (success/warning/insight/risk); **Geist Mono** for numbers.
- Replace any remaining pre-current-spec styling (stray slate/blue/purple/emerald/amber/indigo/cyan, generic parchment nesting, etc.).

---

## Page-by-page sequence (one tool, build, report, PAUSE, await go-ahead)

**Foundations**
1. **Agency Snapshot** — entry forms (the sub-tabs) + the populated dashboard.
2. **Clarity Compass** — vision-state form + dashboard + history.
3. **GV Simulator** — calculator + scenario planner (workspace — keep contained) + results.
4. **Architect Evolution** — landing + assessment + results.

**Diagnostics**
5. **AE Ladder** — intro + assessment + results-dashboard + stage-profile.
6. **M&R Audit** — overview + assessment + results.

Do not batch. One tool unit (covering its workspace + dashboard states), then stop for review.

---

## Out of scope (do not do)

- **Sticky nav** — held per London; leave the sub-nav non-sticky.
- **Dashboard restructuring / new cards** — width + token alignment only.
- The **sub-nav** (done in Pass A) and the **landings** (done in #18/#19).
- **No functional / route / content changes.** **No design-guide changes.**

---

## Constraints

- AOS + Width & density + parchment-as-signal; judicious widening (contained vs. edge per content type; headers match content width). No new cards / no restructuring. TypeScript clean; non-destructive.

---

## Acceptance criteria (per tool unit)

1. **Both the workspace and the dashboard/results states** are widened sensibly — edge-to-edge for content-area dashboards, contained/centered for forms and the simulator workspace; the header width matches its content.
2. **Components fully on the current spec** — parchment-as-signal, surface hierarchy, AOS tokens, semantic colors, Geist Mono numbers; no leftover pre-current-spec styling.
3. **No dashboard restructuring / no new cards; no functional/route changes.**
4. Build clean; no new TS errors.

---

## Verification (per unit, before reporting)

1. Build / typecheck — no new errors.
2. Walk **both** the workspace state and the dashboard/results state; confirm the widening is sensible (contained vs edge per content type), components are on the current spec, and nothing regressed functionally.
3. Report (see format) and **PAUSE** for go-ahead before the next tool.

---

## Report-back format (per tool — NO screenshots)

Tool name; files changed (one-line intent each); the **contained-vs-edge widening decisions** you made for its workspace vs dashboard states; the **components** brought onto the current spec (surfaces/icons/colors); confirmation that **no dashboards were restructured and no functional/route changes** were made; anything flagged. **No screenshots** — written report only. Then **stop and wait** for go-ahead.
