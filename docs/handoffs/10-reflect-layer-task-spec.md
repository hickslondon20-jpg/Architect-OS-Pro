# Handoff Task Spec — #10: Reflect layer (Wind-Down · Retrospective · Reflection & Review)

> **Status:** Ready for execution
> **Companion docs (read first):** `docs/execution-hub-spec.md` §13 (Reflect detail) + ED-12 + the working-score model; `DESIGN-GUIDE-QUICK.md` **Surface Hierarchy** (governing visual rule).
> **Role boundary:** Executing agent. Reshape the three Reflect sub-pages — content + AOS + the relocations/build-out below. **Shape/placeholder, no wiring.** Flag, don't improvise. Do not expand scope.

---

## Objective

Reshape the three Reflect sub-pages to spec. Reflect is the **last 2–3 weeks — closing this sprint while seeding the next** — and each sub-tab rolls a distinct currency forward: **Wind-Down = work, Retrospective = behaviors, Reflection & Review = capabilities.** The tab shell (`ExecutionReflectLayout`, sub-tabs wind-down / retrospective / reflection-review) already exists from #05; this pass reshapes the pages mounted under it.

**Governing design principle: frictionless, not a chore.** Value out = effort in — if it reads as administrative/non-insight work, the founder skips it. Keep it intuitive, naturally flowing, **low cognitive weight; soft structure, not rigid templates; never dumb down the concepts.** Per the Surface Hierarchy, **navy used sparingly/earned — do NOT over-use the obsidian background** (at most one earned navy panel per sub-page).

---

## In scope

### Sub-tab 1 — Wind-Down (`SprintWindDown.tsx`)
- AOS + Surface Hierarchy; **soften the rigid 3-step feel** into a natural conclusion.
- Keep: sprint landing snapshot; **completion decisions** per initiative/milestone (Complete / Roll Over / Release — where disposition is *decided*); light rollover reflection; forward-seeding prompts; finalize (locks decisions + rollover, does NOT close the sprint).
- Functionality as drafted; **no wiring.** Swap blue accents → brass/parchment; the finalize panel may be the one earned navy moment if it fits.

### Sub-tab 2 — Retrospective (`Retrospective.tsx`)
- AOS + Surface Hierarchy.
- **Remove the capability-score "Act 2: The Development" section** — it **relocates** to Reflection & Review. Do **not** silently delete the logic; move it (and log the move in the ledger).
- Add a **Start / Stop / Continue** section (forward-lens behavioral reflection — the new core).
- Keep: The Account (goal self-assessment, sprint-by-the-numbers, initiative outcomes — a *read-only review* of what Wind-Down decided); The Team (shoutouts); The Story (narrative + forward guidance — the existing navy panel, the one earned navy here); What's Next (pre-seeds next sprint).
- Functionality as drafted otherwise; no wiring.

### Sub-tab 3 — Reflection & Review (`ReflectionReview.tsx`)
Build the stub into the **capability recalibration interface** (placeholder):
- **Capability re-scoring:** the **9 worked capabilities** (the sprint's 3P), each with **what good looks like** (reuse capability/checkpoint content; placeholder copy OK) + the current working answer → re-rate **No / Somewhat / Yes** (control shape only — **does not persist**).
- **Capability movement / deltas** view — the relocated "Development" content from the Retrospective.
- **Notes / key-learnings** space — Virtual CSO *referenced* (a labeled placeholder), **not embedded**.
- **Current / Historic** toggle — shell; Historic shows an empty state (same pattern as Orient's Alignment archive).
- A **closing handoff to Planning** ("→ map your next sprint").
- Placeholder data; **no wiring** (re-ratings don't save — the working-score table is downstream, V-11).

### Preserve relocated logic
The capability-score code removed from the Retrospective must be **moved into Reflection & Review**, not deleted. **Log the relocation** in `docs/execution-hub-audit-inventory.md`.

---

## Out of scope (do not do)

- **No wiring / persistence** — re-ratings, decisions, notes don't save; the working-score table is downstream.
- **No Virtual CSO embed** — reference/placeholder only.
- **No changes outside the Reflect sub-pages** (and, if strictly needed, light touches to `ExecutionReflectLayout`). Do not touch Orient, Operate, the hub, the sidebar, `_parked`, or other routes.

---

## Constraints

- **`DESIGN-GUIDE-QUICK.md` Surface Hierarchy governs.** White cards on parchment; sunken only for nested sub-blocks; **navy sparingly/earned (don't over-use obsidian)**; brass = one primary per screen; semantic pills; Geist Mono numbers. No Tailwind grays / hardcoded hex / Inter / glows / gradient text.
- **Frictionless / low cognitive weight** — soft structure, natural flow, not rigid; don't dumb down concepts.
- TypeScript clean.

---

## Acceptance criteria

1. All three Reflect sub-tabs on AOS + Surface Hierarchy; **navy used sparingly** (≤ one earned panel per sub-page; obsidian not over-used).
2. **Wind-Down** reads as a natural conclusion (softened), functionality intact (Complete/Roll Over/Release, rollover, forward-seeding, finalize).
3. **Retrospective** has **Start / Stop / Continue**; the capability "Development" act is **removed from retro and relocated to Reflection & Review** (logic preserved + logged); Account / Team / Story / What's-Next intact.
4. **Reflection & Review** is the capability recalibration interface: 9 worked capabilities with *what good looks like* + re-rate No/Somewhat/Yes (shape), the movement/deltas view, notes/learnings (CSO referenced not embedded), Current/Historic shell, and a closing handoff to Planning.
5. No wiring; re-ratings/decisions/notes don't persist; nothing outside Reflect changed.
6. AOS tokens; build clean; no new TS errors; ledger note added for the relocated capability logic.

---

## Verification (before reporting done)

1. Build / typecheck — no new errors.
2. Walk all three sub-tabs; confirm the retro no longer shows capability development and Reflection & Review now does; confirm Wind-Down reads softer; confirm navy isn't over-used on any sub-page.
3. Confirm Orient / Operate / hub / `/synthesis` unchanged.
4. Screenshot all three Reflect sub-tabs.
5. Diff summary; confirm the relocation ledger note.

---

## Report-back format

Files changed (one-line intent each); where the capability-score logic was relocated (+ ledger note); where (if anywhere) you used navy and why it earned it; confirmation of each acceptance criterion; the three screenshots; anything flagged rather than decided.
