# Handoff Prompt — #09: Operate layer (Timeline + Status Tracker)

Paste the following to the executing agent.

---

You are working in the ArchitectOS Pro codebase (`C:\Users\Hicks\ArchitectOS Pro_beta`) as the implementing agent. Build one scoped feature. Stay within scope; flag ambiguity rather than improvising.

**Read first, in order:**
1. `docs/execution-hub-spec.md` — especially **§12 (Operate detail)** and **ED-11** (Gantt-*style*, not true Gantt).
2. `DESIGN-GUIDE-QUICK.md` — the **Surface Hierarchy** section is the governing visual rule.
3. `docs/handoffs/09-operate-layer-task-spec.md` — the exact task, structure, scope, and acceptance criteria.
Model the tab shell on `OrientLayout` / `ExecutionReflectLayout`.

**Your task in one sentence:** Turn `/pro/execution/operate` into a two-sub-tab layer with a top nav — **Timeline** (a new Gantt-*style* horizon placeholder) and **Status Tracker** (the existing tool moved under Operate and visually reshaped) — functionality as drafted, no wiring.

**Hard guardrails:**
- **Timeline is Gantt-*style*, NOT a true Gantt.** Use start + projected-completion as a duration proxy; **no dependency graph, no exact durations, no drag-resize editing.** It MUST **degrade gracefully on missing/partial dates** — never break or look empty. (ED-11.)
- **Status Tracker: keep functionality exactly as drafted** (filter, flat/grouped, standup, bulk). Visual reshape only — apply the Surface Hierarchy, **swap blue accents → brass/parchment**, **keep the progress bar obsidian**, semantic pills, Geist Mono numbers.
- **Navy sparingly — only where it earns it.** Do NOT force a navy box onto either page (the one-per-page rule was removed).
- **Shape only / no wiring** — Timeline is placeholder; Status Tracker keeps mock data.
- **Touch nothing outside `operate`** — Orient, Reflect, the hub, the sidebar, `_parked`, and other routes stay as-is.
- AOS tokens; mirror `OrientLayout`. TypeScript clean. **Log the route change** in `docs/execution-hub-audit-inventory.md`.

**Before coding:** review `StatusTracker.tsx` (the tool to move + reshape), `OrientLayout` (the tab pattern), the current `operate` route in `App.tsx`, and the Surface Hierarchy section. Verify before changing.

**When done:** verify every acceptance criterion (two-sub-tab shell + top nav; Timeline Gantt-style placeholder resilient to missing dates; Status Tracker reshaped with functionality intact, blue→brass/parchment, obsidian progress bar; navy only where earned; nothing else changed; build clean; ledger updated), include screenshots of Timeline and the reshaped Status Tracker, and report back in the format the task spec specifies.
