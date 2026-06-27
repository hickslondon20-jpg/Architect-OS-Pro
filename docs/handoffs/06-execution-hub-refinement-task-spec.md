# Handoff Task Spec — #06: Execution Hub refinement (complement the Planning landing)

> **Status:** Ready for execution
> **Companion docs (read first):** `docs/execution-hub-spec.md` (vision + reasoning), `docs/execution-hub-audit-inventory.md` (ledger). Reference `pages/ProSuite/` Planning landing (`PlanningLanding`) as the visual/structural model.
> **Role boundary:** Executing agent. Design + framing only. Flag, don't improvise. Do not expand scope.

---

## Objective

Refine the **Execution Hub landing** (`pages/ProSuite/ExecutionLanding.tsx`) so it reads as a clean, static **orientation page** that is **complementary to the Planning landing** — same skeleton and surface language, not pixel-identical. This is **design + framing only**: no routes, no structural changes, no edits to the tool pages, and the removed lifecycle/health logic is **preserved and logged**, not deleted.

The Execution Hub answers only: *what is this hub, what elements/resources live inside, and what you'll find when you dive in* — exactly like the Planning landing.

---

## Model to match (Planning landing)

The Planning landing skeleton to echo:
- Eyebrow + large title + one-line subtitle, with a **top-right CTA**.
- A parchment "sequence" container holding: a section heading ("PLANNING SEQUENCE / Three steps…"), a **"How to use this"** callout, the **three element cards**, and a row of **numbered step mini-callouts** (1. Sequence / 2. Commit / 3. Activate).
- Consistent parchment surfaces throughout; no lone white cards, no white boxes nested on parchment.

---

## In scope

1. **Strip the hub to static orientation.** Remove from the hub UI:
   - the **sprint identity block** (Mock Sprint title/goal/dates/rename/kickoff),
   - the **completion/health strip** (Overall Completion / Initiatives / Blockers / Last Updated),
   - the **state-aware branching** and the **"Current Phase / Active"** highlight — the hub renders **one static orientation view** regardless of sprint state (no PRE_LAUNCH/ACTIVE/WIND_DOWN/CLOSED branches, no per-state banners or completion/celebration blocks).

2. **Preserve & log the removed logic — do NOT delete.** The lifecycle/health UI + data-fetch (the `useSprintState` consumption, the Supabase `sp_sprint_*` stats fetch, and the parked blocks: `SprintIdentityBlock`, `HealthBarStrip`, `CompletionSummaryBlock`, `PreLaunchBanner`, `WindDownBanner`, `RetrospectiveBanner`, `CelebrationBlock`, `SprintSummaryStrip`, `ForwardCTABlock`) are **destined for the home Strategic Overview dashboard (V-08)**. Preserve them — either behind a clearly-commented `/* PARKED for home dashboard — V-08 */` block in the file, or extracted to a parked module (e.g. `pages/ProSuite/_parked/ExecutionStatsBlocks.tsx`). Then **append a note to `docs/execution-hub-audit-inventory.md`** recording where this logic now lives and that it's parked for V-08. (`useSprintState` is a shared hook — leave the hook itself in place.)

3. **Surface consistency (AOS, match Planning).** All section/card surfaces parchment-consistent. Remove the lone white card and any white boxes nested on parchment. Match the Planning landing's card treatment (parchment card, number + icon, title, description) and the numbered step-callout row.

4. **Element-led card labels (not tool names).** The three cards are titled by element — **Orient · Operate · Reflect** — with framing descriptions, NOT by the specific tool name. Suggested copy:
   - **Orient** — "Re-anchor on the locked sprint — goal, 3P plan, owners, and team alignment." → links to `/pro/execution/orient`
   - **Operate** — "Run the work — milestone updates, blockers, ownership, and standup rhythm." → `/pro/execution/operate`
   - **Reflect** — "Close the sprint, decide what carries forward, and capture what the organization learned." → `/pro/execution/reflect`
   - **Do not headline** "Sprint Charter & Summary / Status Tracker / Wind-Down" etc. — those names are pinned/deferred.

5. **Add the "how to use / sequence" framing** (mirroring Planning):
   - Keep/adapt the section heading "EXECUTION SEQUENCE / Three elements to run the sprint."
   - Add a **"How to use this"** callout (e.g., "Move left to right when a sprint kicks off. Return to any element anytime to update or review.").
   - Add a row of **numbered step mini-callouts**: **1. Orient / 2. Operate / 3. Reflect**, one line each (echo the card framing).

6. **Header + CTA parity.**
   - Eyebrow + title + subtitle in the Planning landing's voice (e.g., eyebrow "EXECUTION"; title like "Run the sprint you committed to." or "Turn the plan into momentum."; one-line subtitle). Refine copy to match Planning's tone.
   - **Top-right CTA: "Open current sprint →"** routing to `/pro/execution/orient`.

---

## Out of scope (do not do)

- **No route / structural changes** — the #05 structure (orient/operate/reflect routes, redirects, `/synthesis`) stays exactly as-is.
- **No edits to the tool pages** (`SprintLaunch`, `StatusTracker`, the Reflect sub-pages).
- **No deletion** of the lifecycle/health logic — preserve + log (see #2).
- **No sidebar / left-nav changes** (last step).
- **No data wiring / persistence** — hub framing copy is static/placeholder.

---

## Constraints

- **AOS tokens throughout.** Reuse the Planning landing's card/callout components/patterns where they're shared or trivially reusable (check `PlanningLanding`); otherwise match their treatment.
- TypeScript compiles with no new errors.

---

## Acceptance criteria

1. The Execution Hub reads as a **static orientation page complementary to the Planning landing**: eyebrow + title + subtitle + top-right "Open current sprint →" (→ `/orient`); a parchment sequence container with a "How to use this" callout; three element cards; and a numbered step mini-callout row (1 Orient / 2 Operate / 3 Reflect).
2. **No** mock sprint identity block, **no** completion/health strip, **no** "Current Phase / Active" state highlighting or per-state branching on the hub.
3. Surfaces are consistent parchment — **no lone white card, no white boxes nested on parchment.**
4. Cards are titled by element (Orient/Operate/Reflect), **not** by tool name, and link to `/orient`, `/operate`, `/reflect`.
5. The removed lifecycle/health logic + blocks are **preserved (not deleted)** and their new location is logged in `execution-hub-audit-inventory.md` as parked for V-08.
6. Routes, redirects, `/synthesis`, the tool pages, and the sidebar are all **unchanged**.
7. AOS tokens; build clean; no new TS errors.

---

## Verification (before reporting done)

1. Build / typecheck — no new errors.
2. Screenshot the Execution Hub and eyeball it against the Planning landing for complementary look/feel.
3. Confirm no mock/health/state content remains on the hub; confirm the three cards link to `/orient`, `/operate`, `/reflect`.
4. Confirm `/orient`, `/operate`, `/reflect` + sub-tabs, the old-route redirects, and `/synthesis` still work (unchanged).
5. Confirm the parked logic is present in the repo and logged in the ledger.
6. Diff summary of files changed.

---

## Report-back format

Files changed (one-line intent each); where/how you preserved the parked lifecycle/health logic and the ledger note you added; confirmation of each acceptance criterion; the Execution Hub screenshot; final header/CTA copy used; anything flagged rather than decided.
