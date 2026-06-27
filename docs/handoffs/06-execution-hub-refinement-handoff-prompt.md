# Handoff Prompt — #06: Execution Hub refinement

Paste the following to the executing agent.

---

You are working in the ArchitectOS Pro codebase (`C:\Users\Hicks\ArchitectOS Pro_beta`) as the implementing agent. Execute one scoped **design + framing** task. Stay within scope; flag ambiguity rather than improvising.

**Read first, in order:**
1. `docs/execution-hub-spec.md` — the Execution vision.
2. `docs/execution-hub-audit-inventory.md` — the page ledger.
3. `docs/handoffs/06-execution-hub-refinement-task-spec.md` — the exact task, scope, and acceptance criteria.
Also open the Planning landing (`PlanningLanding` in `pages/ProSuite/`) — it's the visual/structural model to complement.

**Your task in one sentence:** Refine the Execution Hub landing (`ExecutionLanding.tsx`) into a clean static orientation page that complements the Planning landing — consistent parchment surfaces, element-led cards (Orient/Operate/Reflect, not tool names), a "How to use this" callout + numbered step row, and a top-right "Open current sprint →" CTA — while removing the mock sprint/health/state content from the hub.

**Hard guardrails:**
- **Design + framing only.** Do NOT change routes or structure (#05 stays), do NOT edit the tool pages, do NOT touch the sidebar.
- **Preserve, don't delete.** The removed lifecycle/health blocks + `sp_sprint_*` fetch are destined for the home dashboard (V-08) — park them (commented block or a `_parked` module) and log their new location in `execution-hub-audit-inventory.md`. Leave the shared `useSprintState` hook in place.
- The hub renders **one static orientation view** — no sprint-state branching, no "Current Phase/Active" highlight, no mock identity/health blocks.
- Cards titled by **element** (Orient/Operate/Reflect) with framing copy — **not** by the pinned tool names.
- **AOS tokens**; match the Planning landing's surface/card/callout treatment (reuse its components where practical). TypeScript clean.

**Before coding:** study `PlanningLanding` (the skeleton to match) and the current `ExecutionLanding` (what to strip vs. keep). Verify the route targets `/orient` `/operate` `/reflect` exist (from #05) before linking the cards.

**When done:** verify every acceptance criterion (complementary to Planning; no mock/health/state content; consistent parchment, no white-on-parchment; element-led cards linking to the three routes; parked logic preserved + logged; routes/tools/sidebar unchanged; build clean), include a screenshot of the refined hub, and report back in the format the task spec specifies.
