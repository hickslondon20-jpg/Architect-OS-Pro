# Handoff Prompt — #07: Orient layer (Overview/Synthesis + Alignment Tools & Resources)

Paste the following to the executing agent.

---

You are working in the ArchitectOS Pro codebase (`C:\Users\Hicks\ArchitectOS Pro_beta`) as the implementing agent. Build the **container + shape** for one scoped feature. Stay within scope; flag ambiguity rather than improvising.

**Read first, in order:**
1. `docs/execution-hub-spec.md` — especially **§11 (Orient layer detail)** and ED-10.
2. `docs/execution-hub-audit-inventory.md` — the ledger.
3. `docs/handoffs/07-orient-layer-task-spec.md` — the exact task, structure, scope, and acceptance criteria.
Model the tab shell on `ExecutionReflectLayout` / `SprintPlanningLayout`.

**Your task in one sentence:** Turn `/pro/execution/orient` into a two-sub-tab layer — **Overview / Synthesis** (an interactive sprint mini-dashboard) and **Alignment Tools & Resources** (an exportable one-pager with a Current/Historic pill + archive shell) — reshaping the existing `SprintLaunch` content across them, container + shape only.

**Hard guardrails:**
- **Shape only.** Placeholder data; no data wiring; no `sp_sprint_*` reads; no historical-artifacts data/table (empty-state shell).
- **Download button is shape only.** Do NOT add a frontend PDF library — the export will later use the N8N + Google Docs pipeline (CLAUDE.md).
- **Preserve `SprintLaunch.tsx`** (don't delete; log it as the reshaped source). Do not disturb `_parked/ExecutionHubLifecycleBlocks.tsx` — copy/adapt sprint-scoped pieces for Overview rather than moving the parked file.
- **Touch nothing outside `orient`** — Operate, Reflect, the hub landing, the sidebar, and other routes stay as-is.
- **AOS tokens**; mirror the existing tab-layout pattern. TypeScript clean.

**Content split:** identity + at-a-glance → Overview; executive-summary narrative + 3P execution plan → the one-pager.

**Before coding:** review `SprintLaunch.tsx` (source material), `ExecutionReflectLayout` (the tab pattern), and the current `orient` route in `App.tsx`. Verify before changing.

**When done:** verify every acceptance criterion (two-sub-tab shell; Overview mini-dashboard; Alignment one-pager + Current/Historic pill + empty-state Historic; SprintLaunch preserved + logged; nothing else changed; build clean), include screenshots of Overview and both Alignment states, and report back in the format the task spec specifies.
