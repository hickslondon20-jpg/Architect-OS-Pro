# Handoff Prompt — #11: Wind-Down v2 (two-panel cockpit + wider-grid exemplar)

Paste the following to the executing agent. **This revises/replaces the Wind-Down you (or a prior assistant) built in #10.**

---

You are working in the ArchitectOS Pro codebase (`C:\Users\Hicks\ArchitectOS Pro_beta`) as the implementing agent. **You are revising and replacing the existing Wind-Down (`pages/ProSuite/SprintWindDown.tsx`, built in handoff #10)** with a new layout + interaction. Shape/placeholder, **no wiring.** Stay within scope; flag ambiguity rather than improvising.

**Read first, in order:**
1. `docs/execution-hub-spec.md` — **§13 Sub-tab 1 (Wind-Down v2)** and **ED-13**.
2. `DESIGN-GUIDE-QUICK.md` — Surface Hierarchy.
3. `docs/handoffs/11-winddown-v2-cockpit-task-spec.md` — the exact task, layout, scope, and acceptance criteria.

**What you're replacing:** the current single-column scroll (goal → completion decisions → carrying forward → looking ahead → finalize).

**What it becomes — a two-panel "close + pre-stage" cockpit:**
- **Top:** sprint goal + up to 2 supporting goals (N/A fallback).
- **Left — Completion Decisions:** Pressure-Map-style rows in Prioritize→Plant→Iterate order; expand a row to quick-update milestones + set Complete/Roll Over/Release; a **"View full grid"** button opens a **pop-up of the Operate bulk-update workspace**.
- **Right — Carry-Forward:** a mini Prioritize/Plant/Iterate grid; tagging Roll Over populates a card; **drag-and-drop** initiative cards into next-sprint buckets — **directional reference only, rules NOT enforced** (helper text says so); click a card → optional note + the **single-initiative record pop-up**.
- **Bottom — Finalize:** the navy card, **keeping its live counts that update in real time**, with **Save** (partial) and **Lock & Complete**.
- **Remove "Looking ahead"** — it relocates to the Retrospective later; **preserve + log it, don't delete.**

**Hard guardrails:**
- **Shape/placeholder, no wiring** — DnD, decisions, notes, counts are local state only.
- **Carry-forward is a directional sketch at the *initiative* level — intentionally different from Planning's 3P** (capability-level, enforced, system of record). Don't make it enforce 3P rules.
- **Wider layout is a deliberate test** that bends the guide's max-width/single-column rules — that's expected. **Do NOT edit the design guide.** Keep prose at a comfortable reading measure inside cards (wide is for structure/grids, not stretched text).
- **Navy = the finalize card only** (earned); sparing elsewhere. Reuse the existing modals (Operate bulk-update table; Planning workspace pop-up) — don't build new ones.
- Touch nothing else's content (Retro/Reflection/Orient/Operate) except a *shared* top-bar widening applied consistently. AOS tokens; semantic pills; Geist Mono numbers. TypeScript clean. Log the looking-ahead relocation in the ledger.

**Before coding:** review the current `SprintWindDown.tsx`, the Operate Status-Tracker table + the Planning workspace modal (the two pop-ups to reuse), and §13/ED-13. Verify before changing.

**When done:** verify every acceptance criterion (two-panel cockpit; goal+supporting w/ N/A; pressure-map decisions + View-full-grid pop-up; carry-forward DnD mini-3P directional + record pop-up; navy finalize with live counts + Save + Lock & Complete; looking-ahead removed + preserved/logged; wider top bar + grid + less scroll with readable measure; no wiring; nothing else redesigned; design guide untouched; build clean), include screenshots of the full Wind-Down and both pop-ups, and report back in the format the task spec specifies.
