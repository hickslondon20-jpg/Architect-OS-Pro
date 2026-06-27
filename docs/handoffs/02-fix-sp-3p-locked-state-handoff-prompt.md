# Handoff Prompt — #02: Fix Sprint Planning 3P locked-state display

Paste the following to the executing agent.

---

You are working in the ArchitectOS Pro codebase (`C:\Users\Hicks\ArchitectOS Pro_beta`) as the implementing agent. Execute one scoped correction. Stay within scope; flag ambiguity rather than improvising.

**Read first, in order:**
1. `docs/sprint-planning-flow-spec.md` — canonical flow (the "why").
2. `docs/handoffs/01-relocate-3p-task-spec.md` — the relocation this corrects.
3. `docs/handoffs/02-fix-sp-3p-locked-state-task-spec.md` — the exact task, root cause, scope, and acceptance criteria (the "what").

**The problem in one sentence:** The relocated Sprint Planning 3P page (`/sprint-planning/prioritization`) is showing the locked "Your Quarter Posture" synthesis instead of the 3P selection/organize exercise, because it shares a locked `quarter_map_selections` row with the Quarter Map page and `ThreePExercise` hides the exercise whenever that row is locked.

**Your task in one sentence:** Add a `surface` prop to `ThreePExercise` so the Sprint Planning surface always presents the active selection/organize exercise (pre-loaded, editable, forward-to-board) with no posture card and no legacy "Proceed to Sprint Planning" CTA — while the Quarter Map surface keeps its current posture-when-locked behavior.

**Hard guardrails:**
- The selection UI already exists in the component's `!isLocked` branch in modern AOS design — **do not rebuild it**, just stop hiding it on the Sprint Planning surface.
- Keep ONE data layer. Do not duplicate Supabase logic and do not change the data model (the shared row stays; the per-sprint lifecycle decision is deferred).
- Do not alter the Quarter Map page, the Sprint Board data, the sidebar, or the upstream Roadmap/Quarter Sequence.
- AOS tokens only. TypeScript clean.

**Before coding:** confirm the root cause yourself in `ThreePExercise.tsx` (the `isLocked` branch ~line 291 vs the exercise branch ~line 309) and `QuarterPostureBlock.tsx` (the legacy CTA ~line 55). Verify before changing.

**When done:** verify against every acceptance criterion in the task spec, including the two screenshots (Sprint Planning showing the exercise while the row is locked; Quarter Map still showing the posture). Report back in the format the task spec specifies. Do not mark complete if the Sprint Planning page still shows the posture, or if Quarter Map's behavior changed.
