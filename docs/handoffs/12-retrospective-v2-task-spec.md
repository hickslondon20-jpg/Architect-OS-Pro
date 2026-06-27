# Handoff Task Spec — #12: Retrospective v2 (memo, not questionnaire)

> **Status:** Ready for execution — **this REVISES / REPLACES the Retrospective built in #10.**
> **Companion docs (read first):** `docs/execution-hub-spec.md` §13 (Sub-tab 2 — Retrospective v2) + **ED-14**; `DESIGN-GUIDE-QUICK.md` Surface Hierarchy + **Width & density** (the codified wider/cockpit standard); the Wind-Down v2 (`SprintWindDown.tsx`) for the layout/proportion to match. Current file: `pages/ProSuite/Retrospective.tsx`.
> **Role boundary:** Executing agent. **Layout + content revision, shape/placeholder, no wiring.** Flag, don't improvise.

---

## Why

The Retrospective is currently a fill-in questionnaire. Reframe it into a **generated memo + sprint-at-a-glance**, on the wider/cockpit layout, where **the only required input is Start/Stop/Continue + an optional "what else did we learn."** Everything else is a quick toggle or AI-synthesized (placeholder now). The goal is to slash cognitive load so it actually gets done.

**Boundary to respect:** capability re-scoring is NOT here — it lives in Reflection & Review. **Retro *shows* the story; Reflection *makes* the change.** Retro also runs *before* Reflection, so it must not show score deltas (they don't exist yet).

---

## Target structure (top → bottom), wider/cockpit layout

Match Wind-Down's container width — top banner full width + workspace the same width.

1. **Goals** (primary + 2 supporting) across the top — each goal card has a **subtle inline Yes / Partially / We-Learned** toggle. **Remove** the separate "Did we accomplish our goal?" callout box.
2. **Sprint by the numbers** — full width.
3. **Two-column band:**
   - **Left (~¾) — Accomplishment recap** (read-only, **pre-scoring**): maturity/readiness **baseline we started at** → **capability areas + initiatives we focused on** → **qualitative outcomes**. NOT a re-score (that's Reflection); NOT the milestone/initiative-outcomes table (seen in Wind-Down).
   - **Right — Team by-the-numbers:** per person — milestones/initiatives tagged + completed + a 2–3 sentence **AI-synthesis placeholder** of their contribution. **Remove the open recognition text boxes.**
4. **Start / Stop / Continue** — full width, **three columns**, intro on top, open text in each.
5. **Additional notes — "what else did we learn"** (optional) — sits with S/S/C. **Place the relocated Wind-Down "Looking Ahead" forward-seeding questions here** (they're parked as a comment block in `SprintWindDown.tsx` — move them in, remove the parked comment there, and update the ledger to mark the relocation complete).
6. **Lock / Approve retrospective** — **above** the generated summary; locking **generates the memo** (placeholder generation).
7. **The Story** — the generated memo (placeholder; the earned navy moment).
8. **What's Next** — compact into **one insightful container** (synthesized forward guidance — NOT a re-staging of carry-forward items; Wind-Down owns those).
9. **Historical archive** — Current/Historic pill (reuse Orient's Alignment pattern) to browse/download past retro memos (shell/empty state for now).

---

## Out of scope (do not do)

- **No wiring / AI generation** — the team synthesis and the Story memo are placeholders; lock triggers a placeholder generation, nothing persists.
- **No capability re-scoring here** — that's Reflection & Review.
- **No changes to Wind-Down / Reflection / Orient / Operate** — except moving the parked "Looking Ahead" content out of `SprintWindDown.tsx` into Retro (and clearing the parked comment there). Log it.
- **Do not change the design guide.**

---

## Constraints

- AOS + Surface Hierarchy + the **Width & density** standard (wider, grid-first, less scroll; reading measure comfortable inside cards).
- **Navy sparingly** — The Story memo is the earned navy moment; don't over-use elsewhere.
- **Reduce open text to S/S/C + the optional "what else did we learn"** — no other free-text chores (team recognition becomes synthesized, "what we learned" folds into notes).
- Semantic toggles/pills; Geist Mono numbers. TypeScript clean.

---

## Acceptance criteria

1. Retro is on the **wider/cockpit layout** (full-width top bar + workspace), matching Wind-Down.
2. **Goals** top with a subtle inline **Yes/Partially/We-Learned** per goal; **no separate accomplishment callout**.
3. **Sprint by the numbers** full width.
4. **Two-column:** left = **read-only accomplishment recap** (baseline → focus → qualitative outcomes; **not** a re-score, **not** the table); right = **team by-the-numbers + AI-synthesis placeholder**, **no open recognition text**.
5. **Start/Stop/Continue** = three columns full width; the **optional "what else did we learn"** sits with it; the **relocated Looking-Ahead questions now live here** (removed from Wind-Down + ledger updated).
6. **Lock/Approve is above** the generated summary; lock triggers a **placeholder memo** → **The Story**.
7. **What's Next** compacted to one container (forward guidance, not item re-staging).
8. **Historical archive** Current/Historic pill (shell).
9. Required input is only **S/S/C + optional note**; everything else is toggle / synthesized / at-a-glance.
10. No wiring; no capability re-scoring; nothing else redesigned; design guide untouched; build clean; ledger updated.

---

## Verification (before reporting done)

1. Build / typecheck — no new errors.
2. Walk it: confirm the required input is just S/S/C + the optional note; confirm the accomplishment recap is read-only and is NOT the outcomes table; confirm S/S/C is 3 columns; confirm the Looking-Ahead questions now appear in Retro and are gone from Wind-Down; lock → placeholder memo appears in The Story; historical pill toggles to an empty archive.
3. Confirm Wind-Down / Reflection / Orient / Operate otherwise unchanged.
4. Screenshot the full Retro + the Historic state.
5. Diff summary; confirm the ledger note (Looking-Ahead relocation complete).

---

## Report-back format

Files changed (one-line intent each); how you completed the Looking-Ahead relocation (+ ledger); the placeholder approach for the team synthesis + the memo; where you used navy; confirmation of each acceptance criterion; screenshots; anything flagged rather than decided.
