# Handoff Prompt — #03: Restore Current Quarter Focus (remove 3P from Quarter Map)

Paste the following to the executing agent.

---

You are working in the ArchitectOS Pro codebase (`C:\Users\Hicks\ArchitectOS Pro_beta`) as the implementing agent. Execute one scoped task. Stay within scope; flag ambiguity rather than improvising.

**Read first, in order:**
1. `docs/sprint-planning-flow-spec.md` — canonical flow, v2 (the "why").
2. `docs/handoffs/03-restore-current-quarter-focus-task-spec.md` — the exact task, wireframe, scope, and acceptance criteria (the "what").

**The problem in one sentence:** Quarter Map's "Current Quarter Focus" tab is still rendering the full 3P exercise (it's a thin wrapper around `ThreePExercise`), but 3P now belongs only in Sprint Planning — so this tab must be restored to a read-only quarter-level synthesis/checkpoint.

**Your task in one sentence:** Rewrite `CurrentQuarterFocusTab` so it renders a read-only quarter synthesis — keep the header (title + quarter selector + History) and the "Reference: Your 12-Month Trajectory" strip, and replace everything below with the `QuarterPostureBlock` synthesis card (placeholder copy framed around the quarter/horizon breakdown, no 3P) plus its "Proceed to Sprint Planning" CTA.

**Hard guardrails:**
- **Do not touch** the Sprint Planning `prioritization` page, `ThreePExercise`, or the Sprint Board. This task only removes the *misplaced* 3P from Quarter Map.
- Reuse `QuarterPostureBlock` and `ReferenceStrip` by composition (props only) — do not modify those shared components. If a prop is genuinely missing, flag it.
- The synthesis is **placeholder** — no n8n/Anthropic wiring. The copy must be framed around the vision → 36/24/12-month → four-quarter → current-quarter drill-down, with **no** 3P / Prioritize / Plant / Iterate language.
- Route and nav are unchanged — only the tab's content changes.
- AOS tokens only. TypeScript clean.

**Before coding:** open `CurrentQuarterFocusTab.tsx` (the wrapper), `ThreePExercise.tsx` (lift the header markup ~lines 250–279), `QuarterPostureBlock.tsx`, and `ReferenceStrip.tsx`, and confirm the current structure matches the task spec. Verify before changing.

**When done:** verify every acceptance criterion (build clean; current-quarter shows the synthesis wireframe with zero 3P; Sprint Planning 3P + board untouched; `ThreePExercise` imported only by the Sprint Planning page), include the current-quarter screenshot, and report back in the format the task spec specifies. Do not mark complete if any 3P remains on the tab or if anything on the Sprint Planning side changed.
