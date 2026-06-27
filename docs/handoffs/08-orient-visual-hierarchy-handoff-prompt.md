# Handoff Prompt — #08: Orient visual-hierarchy refinement (exemplar)

Paste the following to the executing agent.

---

You are working in the ArchitectOS Pro codebase (`C:\Users\Hicks\ArchitectOS Pro_beta`) as the implementing agent. Execute one scoped **visual/design** pass — styling/markup only, no logic. Stay within scope; flag ambiguity rather than improvising.

**Read first, in order:**
1. `DESIGN-GUIDE-QUICK.md` — especially the new **Surface Hierarchy** section (the governing rule), plus the Composition Rules, KPI card, and Hero strip patterns.
2. `docs/execution-hub-spec.md` §11 — Orient content.
3. `docs/handoffs/08-orient-visual-hierarchy-task-spec.md` — the exact task, per-page application, and acceptance criteria.

**The problem in one sentence:** The Orient pages read flat because they default to parchment-on-parchment — no figure/ground, no focal point.

**Your task in one sentence:** Make Orient the exemplar for the Surface Hierarchy — white cards on the parchment canvas, parchment-deep only for nested sub-blocks, **one navy accent per page**, brass/obsidian buttons, and semantic-colored status pills — and remove the "NOT BUILT IN THIS PASS" tag (keep the Future Alignment Tools section as a forward teaser).

**Hard guardrails:**
- **Styling/markup only** — no logic, route, data, or content changes; behavior identical to #07.
- **Orient only** — do not touch Operate, Reflect, the hub, the sidebar, `_parked`, or `SprintLaunch.tsx`.
- **Navy = one accent per page** (a header strip or a single insight/CTA panel) — not large fields. **Brass = one primary action per screen.** Every chip has a semantic reason.
- AOS tokens only (no Tailwind grays, hardcoded hex, Inter, glows, or gradient text). Numbers in Geist Mono. TypeScript clean.

**Before coding:** study the Surface Hierarchy table + the Strategic Overview reference (`ui_kits/app/index.html`) for the target figure/ground, and the current `OrientOverviewPage` / `OrientAlignmentPage`. Verify before changing.

**When done:** verify every acceptance criterion (white-on-parchment hierarchy, exactly one navy accent per page, brass primary, semantic pills, Geist Mono numbers, the not-built tag removed, no logic/route changes, build clean), include screenshots of Overview and both Alignment states, and report back in the format the task spec specifies.
