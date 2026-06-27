# Handoff Prompt — #21 (Pass B + C): Foundations + Diagnostics — widening + components

Paste the following to the executing agent.

---

You are working in the ArchitectOS Pro codebase (`C:\Users\Hicks\ArchitectOS Pro_beta`) as the implementing agent. **Page by page (one tool at a time):** apply container widening **and** bring components onto the current design spec, **in tandem**, on each tool. **Do one tool, build, report (NO screenshots), and STOP** — don't start the next until told. Stay within scope; flag ambiguity rather than improvising.

**Read first:**
1. `DESIGN-GUIDE-QUICK.md` — **Width & density**, **Surface Hierarchy**, **parchment-as-signal**.
2. `docs/handoffs/21-foundations-diagnostics-widening-components-task-spec.md` — the exact rules, the tool sequence, and acceptance criteria.
The Pro Suite is the working-style reference. These tools were AOS-tokenized earlier, but the spec has evolved since — bring them to **current**.

**On each tool, do both — and address BOTH the workspace (form/exercise) state AND the dashboard/results state:**
- **Widen judiciously (not blanket full-width):** dashboards/data pages in the content area → **edge-to-edge**; forms / workspaces / the simulator → **contained, centered**; headers match their content's width; prose stays a comfortable measure. Use grids where sensible. **Do NOT restructure dashboards or add new cards.**
- **Components → current spec:** parchment-as-signal (white default nested surfaces w/ shadow; parchment only for header bars/input zones; obsidian for hero metrics), surface hierarchy, AOS tokens, semantic colors, Geist Mono numbers. Replace any leftover slate/blue/purple/emerald/amber/indigo/cyan or generic-parchment nesting.

**Tool sequence (one, then stop):** Foundations — 1) Agency Snapshot, 2) Clarity Compass, 3) GV Simulator (keep the workspace contained), 4) Architect Evolution; Diagnostics — 5) AE Ladder, 6) M&R Audit.

**Hard guardrails:**
- **No sticky nav** (leave the sub-nav non-sticky). **No dashboard restructuring / no new cards.** **No functional/route/content changes.** **No design-guide changes.** Sub-nav (Pass A) and the landings are already done — don't redo them.
- AOS tokens; TypeScript clean; non-destructive.
- **No screenshots in your report** — written report only, going forward.

**Per tool, when done:** verify (build clean; both workspace + dashboard states widened sensibly; components on current spec; no functional regressions), then report — tool name, files changed, your contained-vs-edge widening decisions, the components aligned, confirmation no dashboards were restructured and no functional changes — **and STOP for go-ahead.** No screenshots.
