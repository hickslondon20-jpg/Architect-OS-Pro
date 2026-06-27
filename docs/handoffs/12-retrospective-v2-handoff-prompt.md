# Handoff Prompt — #12: Retrospective v2 (memo, not questionnaire)

Paste the following to the executing agent. **This revises/replaces the Retrospective built in handoff #10.**

---

You are working in the ArchitectOS Pro codebase (`C:\Users\Hicks\ArchitectOS Pro_beta`) as the implementing agent. **You are revising and replacing the existing Retrospective (`pages/ProSuite/Retrospective.tsx`, built in #10).** Layout + content revision, **shape/placeholder, no wiring.** Stay within scope; flag ambiguity rather than improvising.

**Read first, in order:**
1. `docs/execution-hub-spec.md` — **§13 Sub-tab 2 (Retrospective v2)** and **ED-14**.
2. `DESIGN-GUIDE-QUICK.md` — Surface Hierarchy + **Width & density** (the codified wider/cockpit standard).
3. `docs/handoffs/12-retrospective-v2-task-spec.md` — the exact task, structure, scope, and acceptance criteria.
Also look at the finished **Wind-Down** (`SprintWindDown.tsx`) for the container width/proportion to match.

**The shift in one sentence:** turn the Retrospective from a fill-in questionnaire into a **generated memo + sprint-at-a-glance**, where the *only* required input is **Start/Stop/Continue + an optional "what else did we learn"** — everything else is a quick toggle or AI-synthesized placeholder.

**Structure (wider/cockpit layout):** Goals top (primary + 2 supporting, each with a subtle inline **Yes/Partially/We-Learned**; remove the separate "did we accomplish?" callout) → **Sprint by the numbers** full width → **two-column band**: left = **read-only accomplishment recap** (baseline → capability areas/initiatives focused on → qualitative outcomes; NOT a re-score, NOT the table), right = **team by-the-numbers + 2–3 sentence AI-synthesis placeholder** (no open recognition text) → **Start/Stop/Continue** full-width **three columns** → **optional "what else did we learn"** (this is where the **relocated Wind-Down "Looking Ahead" questions** go) → **Lock/Approve above** → **The Story** generated memo (placeholder) → compact **What's Next** (forward guidance, not item re-staging) → **Historical** Current/Historic pill (shell).

**Hard guardrails:**
- **Capability re-scoring is NOT here** — it's Reflection & Review. Retro *shows* the story; Reflection *makes* the change. And Retro runs *before* Reflection, so **do not show score deltas** — the recap is read-only/pre-scoring.
- **Shape/placeholder, no wiring** — team synthesis + memo are placeholders; lock triggers placeholder generation; nothing persists.
- **Move the parked "Looking Ahead" questions out of `SprintWindDown.tsx` into Retro**, clear the parked comment there, and **log the completed relocation** in `docs/execution-hub-audit-inventory.md`.
- **Reduce open text to S/S/C + the optional note** — no other free-text chores.
- **Navy sparingly** — The Story memo is the earned navy moment.
- Touch nothing else (Reflection/Orient/Operate/hub). **Do not change the design guide.** AOS tokens; Width & density standard; Geist Mono numbers; readable measure. TypeScript clean.

**Before coding:** review the current `Retrospective.tsx`, the parked Looking-Ahead block in `SprintWindDown.tsx`, the Wind-Down container width, and how Orient's Alignment did Current/Historic. Verify before changing.

**When done:** verify every acceptance criterion (wider layout; inline goal toggles; read-only pre-scoring recap that isn't the table; team by-the-numbers w/ synthesis placeholder, no open text; S/S/C three columns; Looking-Ahead relocated into Retro + removed from Wind-Down + logged; lock-above → placeholder memo → The Story; compact What's Next; historical shell; required input only S/S/C + optional note; no wiring; nothing else changed; guide untouched; build clean), include screenshots of the full Retro and the Historic state, and report back in the format the task spec specifies.
