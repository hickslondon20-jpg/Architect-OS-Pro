# Handoff Prompt — #10: Reflect layer (Wind-Down · Retrospective · Reflection & Review)

Paste the following to the executing agent.

---

You are working in the ArchitectOS Pro codebase (`C:\Users\Hicks\ArchitectOS Pro_beta`) as the implementing agent. Reshape one scoped layer — content + visual, **shape/placeholder, no wiring.** Stay within scope; flag ambiguity rather than improvising.

**Read first, in order:**
1. `docs/execution-hub-spec.md` — especially **§13 (Reflect detail)**, **ED-12**, and the working-score model.
2. `DESIGN-GUIDE-QUICK.md` — the **Surface Hierarchy** section governs the visuals.
3. `docs/handoffs/10-reflect-layer-task-spec.md` — the exact task, per-sub-tab content, scope, and acceptance criteria.

**Your task in one sentence:** Reshape the three Reflect sub-pages — **Wind-Down** (soften into a natural conclusion + AOS), **Retrospective** (add Start/Stop/Continue, **remove the capability "Development" act and relocate it** to Reflection & Review, + AOS), and **Reflection & Review** (build the stub into the capability **recalibration interface** — 9 worked capabilities, *what good looks like* + re-rate No/Somewhat/Yes, the relocated deltas view, notes, Current/Historic shell, closing handoff to Planning).

**Hard guardrails:**
- **Frictionless, not a chore.** Low cognitive weight, natural flow, soft structure — NOT rigid templates — and never dumb down the concepts. (Value out = effort in; if it feels like admin, founders skip it.)
- **Navy sparingly / only where earned — do NOT over-use the obsidian background** (≤ one earned panel per sub-page).
- **Shape/placeholder, no wiring** — re-ratings, decisions, and notes don't persist (the working-score table is downstream).
- **Preserve, don't delete:** the capability-score code removed from the Retrospective must be **moved into Reflection & Review** and the move **logged** in `docs/execution-hub-audit-inventory.md`.
- **Virtual CSO referenced, not embedded.**
- **Touch nothing outside the Reflect sub-pages** (Orient, Operate, hub, sidebar, `_parked`, other routes stay as-is).
- AOS tokens; Surface Hierarchy; semantic pills; Geist Mono numbers. TypeScript clean.

**Before coding:** review the current `SprintWindDown.tsx`, `Retrospective.tsx` (note its "Act 2: The Development" capability section to relocate), and `ReflectionReview.tsx` (the stub), plus the Surface Hierarchy and how Orient handled Current/Historic. Verify before changing.

**When done:** verify every acceptance criterion (three sub-tabs on AOS + hierarchy with navy sparing; Wind-Down softened with functionality intact; Retro has Start/Stop/Continue and no longer shows capability development; Reflection & Review is the recalibration interface; nothing persists; nothing outside Reflect changed; build clean; relocation logged), include screenshots of all three sub-tabs, and report back in the format the task spec specifies.
