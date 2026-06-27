# Handoff Prompt — #14: Full-width + parchment cleanup — Orient & Operate (one page at a time)

Paste the following to the executing agent.

---

You are working in the ArchitectOS Pro codebase (`C:\Users\Hicks\ArchitectOS Pro_beta`) as the implementing agent. This is a **strictly visual** pass — **full-width layout + the parchment-as-signal rule — and nothing else.** No logic, content, data, route, or structural changes.

**Work ONE page at a time. After each page: build it, screenshot it, report back, and STOP — do not begin the next page until you're told to proceed.**

**Read first:**
1. `DESIGN-GUIDE-QUICK.md` — the **Width & density** section and the **parchment-as-signal** rule.
2. `docs/handoffs/14-orient-operate-fullwidth-parchment-task-spec.md` — the exact rules, page sequence, scope, and per-page acceptance criteria.
Use the finished **Wind-Down / Retrospective / Reflection & Review** as your reference for the target width and surface treatment.

**The two rules to apply on each page:**
- **Full width** — top bar + workspace match Wind-Down/Retro/Reflection; keep prose at a comfortable measure inside cards.
- **Parchment-as-signal** — white is the default nested surface (subtle shadow for lift); parchment only for subsection header bars + open-text/input zones; obsidian for hero metrics; **remove parchment-as-generic-nesting**.

**The page sequence (stop + report after each):**
1. **Orient · Overview** (`OrientOverviewPage.tsx` + widen `OrientLayout` top bar if needed)
2. **Orient · Alignment Tools & Resources** (`OrientAlignmentPage.tsx`)
3. **Operate · Timeline** (`OperateTimelinePage.tsx` + widen `OperateLayout` top bar if needed)
4. **Operate · Status Tracker** (`StatusTracker.tsx`)

**Hard guardrails:**
- **Visual only.** Routes, functionality, content, copy, and behavior must stay **identical** — nothing moved, removed, renamed, or rewired. Only layout width + surface tokens change.
- **If anything looks like it needs a structural or logic change, FLAG it — do not fix it** in this pass.
- **Do not touch** Wind-Down, Retrospective, Reflection, the hub landing, the sidebar, or Planning. **Do not change the design guide.**
- AOS tokens; TypeScript clean; no new errors.
- **One page at a time. Build, screenshot, report, PAUSE.**

**Per page, when done:** verify full width vs the reference sections, confirm parchment is used only as a signal, click through to confirm zero behavior change, build clean, screenshot, and report (page name, files changed, surfaces moved parchment→white, confirmation of no functional change, screenshot, anything flagged). **Then wait for go-ahead before the next page.**
