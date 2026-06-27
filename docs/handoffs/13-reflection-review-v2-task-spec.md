# Handoff Task Spec — #13: Reflection & Review v2 (checkpoint re-scoring cockpit)

> **Status:** Ready for execution — **this REVISES / REPLACES the Reflection & Review built in #10.**
> **Companion docs (read first):** `docs/execution-hub-spec.md` §13 (Sub-tab 3 — Reflection & Review v2) + **ED-15** + the working-score model; `DESIGN-GUIDE-QUICK.md` Surface Hierarchy (esp. the **parchment-as-signal** rule) + **Width & density**. Match the Wind-Down/Retro container width. Current file: `pages/ProSuite/ReflectionReview.tsx`.
> **Role boundary:** Executing agent. Layout + re-rating-granularity revision, **shape/placeholder, no wiring.** Flag, don't improvise.

---

## Why

Reflection & Review is the capability recalibration — re-score → live working-score movement. Reshape it into a **scroll-limited cockpit** on the wider layout, and change the re-rating from #10's per-capability rating to **checkpoint-level** (honest — the score *is* the checkpoint responses). It must NOT become a dashboard.

---

## Target structure (top → bottom), wider/cockpit layout

1. **Vitals — two-section + stage:**
   - **Starting-state** maturity + readiness beside the **updated-state** maturity + readiness (after save) — the full maturity progression at a glance.
   - A **stage-progression** element — the 5-stage bar (Surviving → Rising → Driving → Thriving → Compounding) with the position marker — showing how far they've moved and how close to the next stage.
   - Hero-metric numbers → **obsidian** (per the parchment rule). **Only maturity / readiness / stage** — **no revenue/ops metrics** (this is not a dashboard).
2. **Two-column band:**
   - **Left (¾) — Re-rating table:** the **9 capability-area accordion cards**. Each: title + short description → expands to **what good looks like** + previous score + the **5 checkpoints**, each showing the **previous response** + a **re-rate** control. **Default = the previous response**; the founder bumps only what changed. Saving updates the working score (local state).
   - **Right (¼) — Evolution cards:** the 9 capability areas, each a **compact line visual** — starting point → ending point, distance traveled, % change — **updating live** as you re-rate on the left.
3. **Notes & key learnings** — reflection layer (Virtual CSO *referenced*, not embedded).
4. **Sprint closed → Map your next sprint** — closing handoff. (Retain the existing Current/Historic archive shell from #10.)

---

## Key change from #10

Re-rating moves from **per-capability (No/Somewhat/Yes)** to **checkpoint-level** — each of a capability's **5 checkpoints** has a previous response + a re-rate, default-carried. 9 worked capabilities × 5 = 45 checkpoints, but default-carry makes it scan-and-bump. The working maturity/readiness recompute from the updated checkpoint responses, driving the live evolution cards + the updated-state vitals.

---

## In scope

- Wider/cockpit layout matching Wind-Down/Retro (full-width top bar + workspace).
- The vitals two-section + stage-progression element (obsidian hero metrics; maturity/readiness/stage only).
- The ¾ re-rating table (9 accordions, checkpoint-level, default-carried, what-good-looks-like + previous score + 5 checkpoints).
- The ¼ live evolution cards (line visual: start → end, distance, % change), recomputing live from local re-rate state.
- Notes & key learnings (keep). Retain Current/Historic shell. Keep the Map-your-next-sprint handoff.
- **Apply the parchment-as-signal rule** (white default nested surface w/ subtle shadow; parchment only for subsection header bars + open-text/input zones; obsidian for hero metrics). Reflection follows it from the start.

---

## Out of scope (do not do)

- **No wiring / persistence** — re-rates update local state to drive the live evolution cards + updated vitals; nothing saves (the working-score table is downstream, V-11).
- **No revenue/ops metrics** in the vitals — maturity/readiness/stage only.
- **No changes outside `ReflectionReview.tsx`** — Orient/Wind-Down/Retro/Operate/hub untouched (the broader parchment cleanup of those is a separate logged sweep, V-12 — not this task).
- **Do not change the design guide.**

---

## Constraints

- AOS + Surface Hierarchy + **parchment-as-signal rule** + **Width & density**. Obsidian for the hero-metric vitals (earned). Semantic re-rate controls; Geist Mono numbers; readable measure. TypeScript clean.

---

## Acceptance criteria

1. Reflection & Review is on the **wider/cockpit layout** — the **top banner runs full width and the workspace below matches that width** (identical to Wind-Down/Retro), **not** the old narrow container.
2. **Vitals:** starting + updated maturity/readiness (two-section) + a **stage-progression bar**; numbers in obsidian hero treatment; **only maturity/readiness/stage** (no revenue/ops).
3. **Left (¾) re-rating table:** 9 capability accordions; each expands to what-good-looks-like + previous score + **5 checkpoints** with **previous response + re-rate, default-carried**.
4. **Right (¼) evolution cards:** 9 line visuals (start → end, distance, % change) **updating live** as checkpoints are re-rated.
5. Re-rating is **checkpoint-level** (not per-capability), default = previous.
6. Notes & key learnings retained; Current/Historic shell retained; Map-your-next-sprint retained.
7. **Parchment-as-signal rule followed** — no parchment as generic nested fill; white default nesting w/ shadow; parchment only for header bars/input zones; obsidian hero metrics.
8. No wiring; nothing else changed; design guide untouched; build clean.

---

## Verification (before reporting done)

1. Build / typecheck — no new errors.
2. Walk it: expand a capability → re-rate a checkpoint → confirm the matching **evolution card** and the **updated-state vitals** move live; confirm default-carry (untouched checkpoints keep the previous response); confirm the stage bar; confirm vitals show only maturity/readiness/stage.
3. Confirm parchment appears only on header bars / input zones (no generic nested parchment).
4. Confirm Orient/Wind-Down/Retro/Operate/hub unchanged.
5. Screenshot the full Reflection & Review (with a checkpoint re-rated so movement shows).
6. Diff summary.

---

## Report-back format

Files changed (one-line intent each); how checkpoint-level re-rating + live evolution/vitals recompute were built (local state); how you applied the parchment-as-signal rule; where you used obsidian (hero metrics); confirmation of each acceptance criterion; the screenshot; anything flagged rather than decided.
