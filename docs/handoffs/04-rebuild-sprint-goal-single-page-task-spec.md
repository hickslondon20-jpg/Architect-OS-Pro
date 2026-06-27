# Handoff Task Spec — #04: Rebuild Sprint Goal as a single-page experience

> **Status:** Ready for execution
> **Companion docs:** `docs/sprint-planning-flow-spec.md` (full flow, v2 — see Step 5). Read first.
> **Role boundary:** Executing agent. Implement exactly this. Flag, don't improvise. Do not expand scope.

---

## Context

The Sprint Goal is currently a **five-step full-screen wizard**: `SprintGoalFlowPage.tsx` manages a `currentStep` state and renders `Step1_ContextReAnchor`, `Step2_FourSprintArc`, `Step3_DirectionalFocus`, `Step4_GoalDrafting`, `Step5_RealityCheckLock` in sequence. It is all mock; on lock it navigates to `/pro/planning/sprint-planning/prioritization`.

This is too heavy. Now that **Current Quarter Focus** already anchors the founder in the vision→quarter readback immediately upstream, the re-anchoring steps are redundant as full screens. Rebuild the Sprint Goal as **one page** that grounds lightly, teaches the goal shape, offers seeded starter goals, and captures one primary goal plus optional supporting outcomes.

---

## Objective

Replace the multi-step wizard with a single Sprint Goal page per the wireframe below. Placeholder content only; no persistence/wiring.

---

## Wireframe (top → bottom)

```
Sprint Planning ▸ Sprint Goal  (Q1 2026)

CONTEXT  — collapsed by default (available, not forced)
  ▸ Where you are            (reuse Step1 Context Re-Anchor content)
  ▸ Your four-sprint arc      (reuse Step2 Four-Sprint Arc content)
  ▸ This sprint's focus       (reuse Step3 Directional Focus content, as context)

WHAT A GOOD GOAL SOUNDS LIKE
  static universal example goal(s) + guardrails (from Step4 copy)

STARTER GOALS FOR YOU
  2–3 personalized (placeholder) goals → clicking one SEEDS the editor below

YOUR SPRINT GOAL  (primary, required)
  "At the end of these 12 weeks, it will be true that…"
  [ editable textarea — prefilled if a starter was chosen ]

SUPPORTING OUTCOMES  (optional, max 2)
  [ + Add supporting outcome ]  → short editable outcome line(s)

inline pre-lock gut-check (reuse Step5 reality-check prompts as a checklist)
[ Lock Goal → 3P Prioritization ]
```

---

## In scope

1. **Rebuild `pages/SprintPlanning/SprintGoalFlow/SprintGoalFlowPage.tsx`** as a single page — remove the `currentStep` paging.
   - **CONTEXT:** three **collapsed-by-default** collapsible sections reusing the content of `Step1_ContextReAnchor`, `Step2_FourSprintArc`, `Step3_DirectionalFocus`. Convert from full-screen steps into panels. **Directional Focus is shown as derived context** (it may visually indicate the system's directional read) — NOT a required radio gate. *(This default is flagged for London to revisit; implement as derived-context for now.)*
   - **GUIDANCE:** a "What a good goal sounds like" block — 1–2 static, universal example goals + the guardrails copy from `Step4_GoalDrafting` (outcome not activity · changed operating reality · verifiable). Illustrative only; not selectable.
   - **STARTERS:** a "Starter goals for you" block with 2–3 personalized **placeholder** starter goals. Clicking one **seeds** (prefills) the primary goal editor — it must NOT auto-commit/lock.
   - **PRIMARY GOAL:** editable textarea, the existing Step 4 drafting field, prefilled when a starter is chosen. Required to lock.
   - **SUPPORTING OUTCOMES:** an optional "Add supporting outcome" affordance, **max 2**, each a short editable outcome line. Fully optional — the founder can lock with zero.
   - **LOCK:** fold `Step5_RealityCheckLock`'s reality-check prompts into a compact **inline pre-lock checklist** (not a separate screen), then a "Lock Goal" action that navigates to `/pro/planning/sprint-planning/prioritization`.
2. All content remains placeholder/mock.
3. The `Step1–5` components may be refactored into panels/subcomponents or inlined. If any become unused, you may remove them — note which in your report.

---

## Out of scope (do not touch)

- **No persistence / DB save, no n8n/AI wiring.** The goal is not saved and is not yet fed to 3P / the board / AI tone — that is a separate later task. Structure only.
- Do **not** touch the 3P Prioritization page, `ThreePExercise`, the Sprint Board, or Quarter Map.
- **Routes/nav unchanged** — the `sprint-goal` route and tab stay; the Sprint Planning index already lands on `sprint-goal`.

---

## Constraints

- AOS design system (tokens, Geist; no Inter / pure black / neon / glow / text gradients / Tailwind default grays). The current Step components use Tailwind slate/blue utilities — bring them onto AOS tokens as you rebuild (this page should match the AOS look of the 3P and Current Quarter Focus surfaces, not the old blue wizard).
- TypeScript compiles with no new errors.
- Single page; no step paging.

---

## Acceptance criteria

1. `/pro/planning/sprint-planning/sprint-goal` is a **single page** (no step-by-step paging) containing: collapsed context (3 sections), goal-shape guidance + example(s), personalized starter goals, an editable primary goal field, optional supporting outcomes (max 2), an inline pre-lock checklist, and a Lock action.
2. Context sections are **collapsed by default**.
3. Selecting a starter **prefills** the primary goal editor and does **not** auto-commit.
4. Primary goal is required to lock; supporting outcomes are optional (0–2, capped at 2).
5. "Lock Goal" routes to `/pro/planning/sprint-planning/prioritization`.
6. Nothing persisted/wired; 3P, board, and Quarter Map untouched.
7. AOS tokens; no new TypeScript errors.

---

## Verification (before reporting done)

1. Build / typecheck — no new errors.
2. Walk the page: expand/collapse context, click a starter and confirm it seeds (not commits) the editor, add/remove supporting outcomes (confirm the 2 cap), run the pre-lock checklist, lock and confirm it routes to the 3P page. Screenshot the page.
3. Confirm 3P / board / Quarter Map are unaffected.
4. Diff summary; note any now-unused Step components.

---

## Report-back format

Files changed (one-line intent each); how you handled the Step1–5 components (refactored/inlined/removed); confirmation of each acceptance criterion; the screenshot; the placeholder starter/example copy used; anything flagged rather than decided (including the Directional-Focus-as-context default).
