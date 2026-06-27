# Handoff Prompt — #05: Execution Hub structure (Orient / Operate / Reflect)

Paste the following to the executing agent.

---

You are working in the ArchitectOS Pro codebase (`C:\Users\Hicks\ArchitectOS Pro_beta`) as the implementing agent. Execute one scoped, **non-destructive structural** task. Stay within scope; flag ambiguity rather than improvising.

**Read first, in order:**
1. `docs/execution-hub-spec.md` — the canonical Execution vision (Orient/Operate/Reflect, surfaces, dispositions, §10 reasoning).
2. `docs/execution-hub-audit-inventory.md` — the page ledger (every Execution page, its file, and its disposition).
3. `docs/handoffs/05-execution-hub-structure-task-spec.md` — the exact task, target structure, scope, and acceptance criteria.

**Your task in one sentence:** Stand up the Execution Hub as a launchpad with three elements — **Orient · Operate · Reflect** — nesting the existing pages under them (Orient→SprintLaunch, Operate→StatusTracker, Reflect→a tabbed shell over Wind-Down/Retrospective/Reflection&Review), and redirect the old flat routes — mirroring the Planning Hub, non-destructively.

**Hard guardrails:**
- **Reuse existing components by mounting them as-is.** Do NOT polish, restyle, or rewrite the tool pages — that's the next pass. Only the new hub launchpad + Reflect tab shell are newly built (on AOS tokens).
- **Non-destructive:** delete nothing. Old flat routes become **redirects** to the new homes so the sidebar's dynamic links keep working.
- **Do NOT touch the sidebar / left-nav** (that's the last step), do NOT remove the hub's health/stats content (the home dashboard is downstream — just leave it and comment the pending move), and **leave `/synthesis` (Momentum Synthesis) live and untouched** (it relocates to Intelligence later).
- AOS tokens for anything new. TypeScript clean.
- **Log the executed route moves** (old → new) by appending to `docs/execution-hub-audit-inventory.md` — per the standing "log before move/remove" rule.

**Before coding:** confirm the current Execution routes in `App.tsx`, the `ExecutionLanding` lifecycle/NavCard structure, and the `SprintPlanningLayout`/`QuarterMapSectionLayout` tab pattern you'll mirror for Reflect. Verify before changing.

**When done:** verify every acceptance criterion (walkable hub → Orient/Operate/Reflect → Reflect sub-tabs; old routes redirect; `/synthesis` still loads; nothing deleted; build clean), include screenshots of the hub landing and the Reflect tabbed view, log the old→new route map to the ledger, and report back in the format the task spec specifies.
