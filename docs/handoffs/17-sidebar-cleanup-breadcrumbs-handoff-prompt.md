# Handoff Prompt — #17: Pro Suite sidebar cleanup + breadcrumbs (two phases)

Paste the following to the executing agent.

---

You are working in the ArchitectOS Pro codebase (`C:\Users\Hicks\ArchitectOS Pro_beta`) as the implementing agent. This is a **two-phase structural pass** — sidebar cleanup + routing (Phase 1), then breadcrumbs (Phase 2). **Do Phase 1, build, verify, screenshot, and STOP for review before Phase 2.** This is the most structural change we've done, so be careful and **non-destructive**. Stay within scope; flag ambiguity rather than improvising.

**Read first:**
1. `DESIGN-GUIDE-QUICK.md` — Surface Hierarchy, Width & density.
2. `docs/handoffs/17-sidebar-cleanup-breadcrumbs-task-spec.md` — the exact scope, both phases, and acceptance criteria.
Key files: `components/Sidebar.tsx`, `App.tsx` (the `pro` route group), `ProMainPage.tsx`, `IntelligenceLanding.tsx`, the hub landings.

**Phase 1 — sidebar cleanup + Intelligence re-nesting:**
- Pro Suite sidebar → the **"ArchitectOS Pro Suite" parent + caret is expand-only** (not a link), with **four children: Overview → `/pro`, Planning → `/pro/planning`, Execution → `/pro/execution`, Intelligence → `/pro/intelligence`.**
- **Remove all other Pro Suite nav entries** (Sprint Launch, Status Tracker, Synthesis, Virtual CSO, OS Engine, old duplicates) **and the dynamic `getExecutionLinks` logic** — **nav entries only; do NOT delete pages/components/routes.**
- **Re-nest** `Virtual CSO` → `/pro/intelligence/virtual-cso` and `OS Engine` → `/pro/intelligence/os-engine`, **add redirects** from the old paths, and **update the internal links** (Intelligence landing cards + "Talk to your Virtual CSO" CTA; overview Intelligence cards). **Log the moves** in `docs/execution-hub-audit-inventory.md`.
- Touch nothing else (other sidebar sections, page content). The execution `/launch` + `/status-tracker` redirects and `/synthesis` stay as-is.
- **Verify** (build clean; sidebar = the 4 children, caret expand-only; all routes resolve; old CSO/OS-Engine paths redirect; no dead links anywhere), screenshot the sidebar, **report, and STOP for go-ahead.**

**Phase 2 — breadcrumbs (only after Phase 1 is approved):**
- A clickable **upper-left breadcrumb** on every Pro Suite page, route-derived: `Overview › Hub › Sub-page › Sub-tab` (Overview → `/pro`). Quiet AOS styling (light wayfinding text, not a parchment block). Reuse an existing breadcrumb component if suitable, else build a small one. Pro-Suite-scoped this pass.
- **Verify** (breadcrumbs on a hub, a sub-page, and a sub-tab; segments navigate; Overview → `/pro`), screenshot, report.

**Hard guardrails:**
- **Non-destructive** — redirects for moved routes, no deletions, log moves. Removing a sidebar item must not delete its page.
- **Phase 1 first, then PAUSE.** Don't start breadcrumbs until told.
- AOS + parchment-as-signal; TypeScript clean; no dead links.
- If anything needs a change beyond this scope, **flag it — don't do it.**

**Before coding:** review `Sidebar.tsx` (the Pro Suite section + `getExecutionLinks`), the `pro` route group in `App.tsx`, and the internal links to Virtual CSO / OS Engine. Verify before changing.

**When done with each phase:** verify the phase's acceptance criteria, include screenshots, and report in the format the task spec specifies. **After Phase 1, stop and wait.**
