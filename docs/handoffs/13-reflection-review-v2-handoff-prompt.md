# Handoff Prompt — #13: Reflection & Review v2 (checkpoint re-scoring cockpit)

Paste the following to the executing agent. **This revises/replaces the Reflection & Review built in handoff #10.**

---

You are working in the ArchitectOS Pro codebase (`C:\Users\Hicks\ArchitectOS Pro_beta`) as the implementing agent. **You are revising and replacing the existing Reflection & Review (`pages/ProSuite/ReflectionReview.tsx`, built in #10).** Layout + re-rating-granularity revision, **shape/placeholder, no wiring.** Stay within scope; flag ambiguity rather than improvising.

**Read first, in order:**
1. `docs/execution-hub-spec.md` — **§13 Sub-tab 3 (Reflection & Review v2)**, **ED-15**, and the working-score model.
2. `DESIGN-GUIDE-QUICK.md` — Surface Hierarchy (especially the **parchment-as-signal** rule) + **Width & density**.
3. `docs/handoffs/13-reflection-review-v2-task-spec.md` — the exact task, structure, scope, and acceptance criteria.
Match the Wind-Down/Retro container width.

**The shift in one sentence:** turn the recalibration into a **scroll-limited cockpit** — vitals (starting vs updated maturity/readiness + stage bar) on top, a ¾ checkpoint re-rating table on the left, ¼ live evolution cards on the right, then notes and the next-sprint handoff.

**The one functional change from #10:** re-rating moves from **per-capability** to **checkpoint-level** — each capability expands to its **5 checkpoints**, each with a previous response + a re-rate, **default = previous** (scan and bump only what changed). 9 worked capabilities × 5 = 45 checkpoints. The working maturity/readiness recompute from these and drive the live evolution cards + updated vitals (local state only).

**Hard guardrails:**
- **Not a dashboard.** Vitals show **only maturity / readiness / stage** — no revenue/ops metrics.
- **Shape/placeholder, no wiring** — re-rates update local state to show live movement; nothing persists (working-score table is downstream).
- **Apply the parchment-as-signal rule:** white is the default nested surface (subtle shadow for lift); parchment only for subsection header bars + open-text/input zones; **obsidian for the hero-metric vitals.** No parchment as generic nested fill.
- **Touch nothing outside `ReflectionReview.tsx`** (the broader parchment cleanup of the other surfaces is a separate logged item, V-12). **Do not change the design guide.**
- AOS tokens; Width & density; Geist Mono numbers; readable measure. TypeScript clean.

**Before coding:** review the current `ReflectionReview.tsx` (the #10 recalibration shape + the `CAPABILITY_DELTAS` movement view), the Wind-Down/Retro container width, the parchment-as-signal rule, and the dashboard's stage-progression bar as the reference for the stage element. Verify before changing.

**When done:** verify every acceptance criterion (wider cockpit; vitals two-section + stage bar, maturity/readiness/stage only, obsidian hero; ¾ checkpoint re-rating table default-carried; ¼ live evolution cards; checkpoint-level not per-capability; notes + Current/Historic + map-next-sprint retained; parchment-as-signal followed; no wiring; nothing else changed; build clean), include a screenshot with a checkpoint re-rated so movement shows, and report back in the format the task spec specifies.
