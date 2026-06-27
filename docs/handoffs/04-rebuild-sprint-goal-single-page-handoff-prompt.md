# Handoff Prompt — #04: Rebuild Sprint Goal as a single-page experience

Paste the following to the executing agent.

---

You are working in the ArchitectOS Pro codebase (`C:\Users\Hicks\ArchitectOS Pro_beta`) as the implementing agent. Execute one scoped task. Stay within scope; flag ambiguity rather than improvising.

**Read first, in order:**
1. `docs/sprint-planning-flow-spec.md` — canonical flow, v2 (see Step 5 for the agreed Sprint Goal design).
2. `docs/handoffs/04-rebuild-sprint-goal-single-page-task-spec.md` — the exact task, wireframe, scope, and acceptance criteria.

**The problem in one sentence:** The Sprint Goal is a heavy five-step full-screen wizard (`SprintGoalFlowPage` + `Step1–5`), and now that Current Quarter Focus already anchors the founder upstream, it should become a single, lighter page.

**Your task in one sentence:** Rebuild `SprintGoalFlowPage` as one page — collapsed-by-default context (reusing Step1–3 content), a "what a good goal sounds like" guidance block (static example + the Step4 guardrails), personalized placeholder starter goals that *seed* an editable primary goal field, an optional "supporting outcomes" add (max 2), and an inline pre-lock checklist that locks forward to the 3P page.

**Hard guardrails:**
- **Placeholder only** — no persistence, no n8n/AI wiring, no feeding the goal to 3P/board. Structure only.
- Do **not** touch the 3P page, `ThreePExercise`, the Sprint Board, or Quarter Map. Routes/nav stay the same.
- **Cardinality:** exactly one **primary** goal (required) + up to **2 optional** supporting outcomes. Don't allow more than 2 supporting.
- Starters **seed** the editor (prefill) — never one-click commit/lock.
- **Directional Focus** is derived context shown in the collapsed section, not a required radio input (this is a flagged default — implement it this way and note it).
- Bring the page onto **AOS tokens** (match the 3P and Current Quarter Focus surfaces; retire the old blue/slate wizard styling). TypeScript clean.

**Before coding:** review `SprintGoalFlowPage.tsx` and `Step1–5` to see what content to reuse, and the 3P page / Current Quarter Focus for the AOS look to match. Verify before changing.

**When done:** verify every acceptance criterion (single page, collapsed context, starter seeds-not-commits, primary required + supporting optional capped at 2, lock → `/pro/planning/sprint-planning/prioritization`, nothing else touched), include a screenshot, and report back in the format the task spec specifies.
