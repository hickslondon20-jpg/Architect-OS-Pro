# Execution Hub — Audit & Page Inventory Ledger

> **Status:** Updated 2026-06-19 — Handoff #09 (Operate layer) applied. See route change log below.
> **Purpose:** Traceability ledger for the Execution area. **Standing rule: no page is moved, removed, demoted, or delisted (from the sidebar OR a hub page) until it is logged here with its route, file path, and purpose.** A delisted page stays in the repo with a pointer here — never deleted silently. Nav/sidebar cleanup is the LAST step, after everything below is settled.
> **Next:** This ledger is the foundation for the Execution experience conversation (what the founder needs to see / do / experience), then the Execution Hub page build, then downstream sub-pages, then nav cleanup.

---

## Route map (App.tsx, `/pro/execution`)

| Route | Component | Gate |
|---|---|---|
| `/pro/execution` (index) | `ExecutionLanding` | `sprint_launch` |
| `/pro/execution/launch` | `SprintLaunch` | `sprint_launch` |
| `/pro/execution/operate` (index) | `OperateLayout` → redirect to `timeline` | `status_tracker` |
| `/pro/execution/operate/timeline` | `OperateTimelinePage` | — |
| `/pro/execution/operate/status-tracker` | `StatusTracker` | — |
| `/pro/execution/status-tracker` | redirect → `/pro/execution/operate/status-tracker` | — |
| `/pro/execution/synthesis` | `MomentumSynthesis` | `momentum_synthesis` |
| `/pro/execution/wind-down` | `SprintWindDown` | `retrospective` |
| `/pro/execution/retrospective` | `Retrospective` | `retrospective` |
| `/pro/execution/reflection-review` | `ReflectionReview` | `retrospective` |

**Sidebar behavior (`components/Sidebar.tsx` → `getExecutionLinks`):** the left-nav Execution links are **dynamic by sprint state** (`useSprintState`). Base shows "Execution Hub"; ACTIVE adds Sprint Launch + Status Tracker + Synthesis; WIND_DOWN adds Wind-Down; closed states add Retrospective + a "Sprint History" link. This phase-aware nav is relevant context for the eventual nav cleanup (the target is to collapse Pro Suite to Overview + 3 hubs and let the hub overview do this wayfinding instead of the sidebar).

---

## Page inventory

All files live in `pages/ProSuite/`. **None are on AOS tokens yet** — they all still use Tailwind slate/blue/amber (they predate the design pass; UI-PROGRESS Session 9 "Execution" design pass is still unchecked).

| # | Page | File | What it does | Build status | Disposition (TBD — confirm in experience convo) |
|---|---|---|---|---|---|
| E-1 | **Execution Landing / Hub** | `ExecutionLanding.tsx` | The Execution hub page. Title "Execution & Review." A **sprint-lifecycle state machine** (`useSprintState`: NO_SPRINT · PRE_LAUNCH · ACTIVE · WIND_DOWN · CLOSED_RETRO_PENDING · CLOSED_COMPLETE), rendering different banners + NavCards per state. Sprint identity block (rename, kickoff date), health bar, completion summary, celebration/forward-CTA at close. | **Partially wired.** Reads `sp_sprint_goals`, `sp_sprint_initiatives`, `sp_sprint_milestones` for live stats; writes sprint name + kickoff_date. Some blocks still mock (celebration, summary strip "38/3/Achieved"). Tailwind, not AOS. | **Keep — this is the Execution Hub overview.** Becomes the execution analog of the Planning & Strategy summary. Needs AOS pass + finish wiring. |
| E-2 | **Sprint Launch** | `SprintLaunch.tsx` | Team-alignment document / executive summary of the locked sprint — sprint identity, exec summary narrative, the 3P execution plan, intended to be shared with the team. | Built UI, **all mock content** (hardcoded goal, narrative, names). No data reads. Tailwind. | Keep (launch readiness / team alignment). Wire to real sprint data. |
| E-3 | **Status Tracker** | `StatusTracker.tsx` | "Operational heartbeat" — milestone progress table, flat/grouped views, blockers, **Standup Mode** for screen-sharing. | Built UI, **mock milestones**. No data reads. Tailwind. | Keep (the during-sprint workhorse). **Overlap flag:** duplicates the orphaned `pages/SprintPlanning/ProgressPage.tsx` (a full milestone tracker, not routed). Reconcile the two. Wire. |
| E-4 | **Momentum Synthesis** | `MomentumSynthesis.tsx` | On-demand mid-sprint strategic read — progress narrative, attention/observation signal, encouragement layer, generation history. "Generate New Synthesis" button. | Built UI, **mock synthesis + history**; generate button not wired. Tailwind. | **Taxonomy open (your question):** keep as its own surface vs. fold into the hub/status. Real synthesis = n8n + Anthropic later. |
| E-5 | **Sprint Wind-Down** | `SprintWindDown.tsx` | Structured closing process before sprint end — per-initiative decisions (Complete / Roll Over / Release), rollover reflection, forward-seeding. | Built UI, **mock initiatives + decisions state**. Tailwind. | Keep, but **overlaps** Retrospective + Reflection Review — taxonomy decision needed (see below). |
| E-6 | **Retrospective** | `Retrospective.tsx` | Full sprint close-out — three-act account (what we did / how we grew / what's next), goal self-assessment (Yes / Partially / We Learned), capability deltas, team completion. | Built UI, **mock data**. Tailwind. | Keep (the close-out). Resolve overlap with Wind-Down + Reflection Review. |
| E-7 | **Reflection & Review** | `ReflectionReview.tsx` | Stub only — `PlaceholderContent`: "Quarterly Retrospective and 3P Recalibration Interface." | **Placeholder, essentially unbuilt.** CLAUDE.md flags its rollover logic as incomplete. Tailwind. | Likely **merge/retire into Retrospective** (overlapping concept, not built) — but preserved here per the rule; do not delete silently. |

---

## Cross-cutting observations

1. **Real sprint-state infrastructure already exists.** `useSprintState` + the `sp_sprint_goals` / `sp_sprint_initiatives` / `sp_sprint_milestones` tables drive the hub. This is the data spine the whole Execution layer (and the Sprint Board persistence noted in spec §5/§7) should share. Worth confirming these are the canonical sprint tables before wiring more.

2. **Taxonomy overlap among the closing surfaces.** Wind-Down (E-5), Retrospective (E-6), and Reflection & Review (E-7) all occupy the "closing the sprint" space, and E-7 is just a stub. This is exactly the taxonomy question to resolve in the experience conversation — including your open question on whether **Momentum Synthesis** stays a distinct level.

3. **Status tracking exists in two places.** `StatusTracker` (E-3) and the orphaned `pages/SprintPlanning/ProgressPage.tsx` are both milestone trackers. One should win; the other gets logged + retired (not lost).

4. **"Sprint History" dead link.** The sidebar's closed-state nav points to `/pro/execution/history`, but no `history` route/component exists in `App.tsx`. Either build it or remove the link — logged so it isn't forgotten.

5. **`reflection-review` is routed but not in the sidebar nav** — reachable only by URL.

6. **No AOS yet.** Every Execution page is pre-design-pass (Tailwind slate/blue). The visual pass (UI-PROGRESS Session 9) will need to bring them onto AOS tokens, same as we did for Sprint Planning.

---

## Route change log (Handoff #09 — 2026-06-19)

**Before:** `/pro/execution/operate` was a leaf route mounting `StatusTracker` directly (gated `status_tracker`). `/pro/execution/status-tracker` redirected to `/pro/execution/operate`.

**After (Handoff #09):**
- `/pro/execution/operate` → `OperateLayout` (two-sub-tab shell; gated `status_tracker`)
  - index → redirect to `timeline`
  - `/pro/execution/operate/timeline` → `OperateTimelinePage` (Gantt-style horizon placeholder)
  - `/pro/execution/operate/status-tracker` → `StatusTracker` (moved here; visually reshaped)
- `/pro/execution/status-tracker` redirect updated: now points to `/pro/execution/operate/status-tracker`

**New files:** `pages/ProSuite/OperateLayout.tsx`, `pages/ProSuite/OperateTimelinePage.tsx`
**Modified files:** `pages/ProSuite/StatusTracker.tsx` (visual reshape only — functionality unchanged), `pages/ProSuite/index.ts`, `App.tsx`, this ledger.

---

## Open taxonomy questions for the experience conversation

- Does **Momentum Synthesis** stay a top-level execution surface, or fold into the hub / status view?
- How do **Wind-Down**, **Retrospective**, and **Reflection & Review** consolidate? (Likely fewer than three closing surfaces.)
- Is **Status Tracker** the single source of truth for milestone progress (absorbing `ProgressPage`)?
- What does the **Execution Hub overview** itself need to frame coming off a locked sprint plan — and how much of the existing lifecycle-state machine survives?

## Dispositions — RESOLVED (2026-06-19)

The experience conversation is complete; dispositions are now decided and live in `docs/execution-hub-spec.md` (§6). Summary — nothing has been moved yet; this is the agreed target, and each actual move will still be logged here when executed:

- **E-1 ExecutionLanding** → **Split**: health/stats dashboard → home/Strategic Overview; lifecycle launchpad → Execution Hub landing (Orient/Operate/Reflect).
- **E-2 SprintLaunch** → **Orient** = Sprint Charter & Summary (mini-dashboard + PDF export).
- **E-3 StatusTracker** → **Operate** = standup quick-edit; absorb orphaned `pages/SprintPlanning/ProgressPage.tsx`.
- **E-4 MomentumSynthesis** → **Relocate to Intelligence Hub** (later).
- **E-5 SprintWindDown** → **Reflect** sub-tab (preserves rollover → Planning handoff).
- **E-6 Retrospective** → **Reflect** sub-tab.
- **E-7 ReflectionReview** → **Reflect** sub-tab (build out from stub; address rollover logic).
- **"Sprint History" dead link / `reflection-review` not in nav** → resolve during nav cleanup (last).

Structure target: **Execution Hub = launchpad → Orient · Operate · Reflect**, tools nested inside elements (mirrors the Planning Hub). Full reasoning in `execution-hub-spec.md` §10.

## Handoff #12 — Retrospective v2 (memo, not questionnaire) (2026-06-20)

**Files changed:** `pages/ProSuite/Retrospective.tsx` (full replacement), `pages/ProSuite/SprintWindDown.tsx` (parked comment cleared)

**"Looking Ahead" forward-seeding questions — RELOCATION COMPLETE:**
The three forward-seeding questions parked as a comment block in `SprintWindDown.tsx` (Handoff #11) have been **moved into `Retrospective.tsx`** as the `LOOKING_AHEAD_PROMPTS` const, rendered in the "What else did we learn?" section as reference prompts. The parked comment in `SprintWindDown.tsx` has been replaced with a one-line relocation note. This completes the relocation chain: Wind-Down (origin, Handoff #10) → parked in SprintWindDown (Handoff #11) → live in Retrospective (Handoff #12).

**Retrospective v2 structure:**
- **Current/Historic toggle** — "Sprint 1" / "Archive" pill; Historic = empty-state shell.
- **Goals top** — primary goal (brass bar) with inline Yes/Partially/We-Learned toggles; 2 supporting goal cards each with stacked toggles. No separate "did we accomplish?" callout.
- **Sprint by the numbers** — full-width stat strip; Geist Mono numbers.
- **Two-column band:** left = read-only accomplishment recap (baseline maturity → capability areas/initiatives focused on → qualitative outcomes; explicitly **not** a re-score, **not** the initiative table); right = team by-the-numbers (initiatives + milestones completion) + AI-synthesis placeholder per person (no open recognition text).
- **Start/Stop/Continue** — three columns full-width; open textarea per column; only required input.
- **What else did we learn?** — optional section; free-text + Looking Ahead prompts panel.
- **Lock & Approve** — above The Story; clicking generates placeholder memo and shows Approved chip.
- **The Story** — earned navy panel; locked state shows placeholder memo + forward guidance + Instrument Serif editorial line; unlocked state shows "approve above to generate" placeholder.
- **What's Next** — compact single card: forward guidance prose + two navigational signposts (Reflection & Review → Sprint Planning). No item re-staging (Wind-Down owns that).

**No wiring:** all state is local; memo generation is placeholder (toggle on lock); nothing persists.

---

## Handoff #11 — Wind-Down v2 cockpit + wider-grid exemplar (2026-06-20)

**Files changed:** `pages/ProSuite/SprintWindDown.tsx` (full replacement), `pages/ProSuite/ExecutionReflectLayout.tsx` (top bar widened — shared component, applies to all three Reflect sub-tabs)

**"Looking Ahead" forward-seeding questions (from Handoff #10 Wind-Down) — PARKED:**
The three forward-seeding reflection questions are **removed from Wind-Down** and **preserved as a commented-out constant** at the top of `pages/ProSuite/SprintWindDown.tsx`. They relocate to the Retrospective in a later pass. They are not deleted.

**Top-bar widening (shared layout):**
`ExecutionReflectLayout.tsx` — `max-w-7xl` changed to `max-w-[1600px]` for both the sticky top-bar container and the main content area. This is a shared component and the widening applies consistently to all three Reflect sub-tabs (Wind-Down, Retrospective, Reflection & Review). This intentionally bends the guide's single-column/max-width rules as a deliberate layout test; the design guide was not changed.

**Wind-Down v2 — two-panel cockpit:**
- **Top:** Primary sprint goal (brass accent bar) + 2 supporting-goal cards (2-column); N/A fallback if no goals set.
- **Left panel (Completion Decisions):** Pressure-map-style initiative rows in Prioritize → Plant → Iterate order; expand row → milestone status quick-update (inline selects); Complete / Roll Over / Release decision buttons; "View full grid" button → `BulkGridModal` (Operate bulk-update workspace table, self-contained).
- **Right panel (Carry-Forward):** Mini 3-column Prioritize / Plant / Iterate DnD grid; Roll Over tagging populates a card; cards are draggable (HTML5 drag-and-drop, local state only); click a card → `InitiativeRecordModal` (Planning workspace single-initiative pop-up with rollover note, milestone list, metadata).
- **Bottom:** Navy finalize card with live real-time counts (completing / rolling over / releasing / undecided, update as decisions change) + Save progress + Lock & Complete (disabled until undecided = 0).
- **No wiring** — all state is local; nothing persists.

**No wiring:** decisions, milestone statuses, DnD positions, card notes, and counts do not persist.

---

## Handoff #10 — Reflect layer reshape (2026-06-20)

**Files changed:** `pages/ProSuite/SprintWindDown.tsx`, `pages/ProSuite/Retrospective.tsx`, `pages/ProSuite/ReflectionReview.tsx`

**Capability score movement relocation (code preserved):**
The "Act 2: The Development" capability-score section previously in `Retrospective.tsx` (the `MOCK_CAPABILITIES` delta data and the visual bar chart section) has been **relocated to `ReflectionReview.tsx`** where it now appears as the "Capability movement" section below the 9-capability re-scoring interface. The original code is not deleted — it is preserved verbatim in `ReflectionReview.tsx` as `CAPABILITY_DELTAS` and rendered in the current-view. The `Retrospective.tsx` file retains only a comment pointing to this ledger entry.

**Changes per file:**
- `SprintWindDown.tsx` — AOS token pass; numbered steps (1/2/3) replaced with natural section headings; finalize panel converted to one earned navy (`var(--bg-inverse)`) panel; semantic decision chips; Geist Mono on metrics.
- `Retrospective.tsx` — Act 2 (capability development) removed and relocated; "Act N:" labels replaced with natural section names; Start/Stop/Continue section added between The Account and The Team; The Story retains its earned navy panel; AOS tokens throughout.
- `ReflectionReview.tsx` — Built from stub into the capability recalibration interface: 9 worked capabilities with "what good looks like" + No/Somewhat/Yes re-rate (shape only, no persistence); relocated capability movement / deltas view; notes/key learnings with Virtual CSO reference (not embedded); Current/Historic toggle (Historic = empty-state shell); closing handoff to Planning.

**No wiring:** re-ratings, decisions, and notes do not persist. The working-score table is downstream (V-11).

---

## Executed route moves - 2026-06-19

Structural pass #05 stood up the Execution Hub as **Orient / Operate / Reflect** and preserved the old flat routes as redirects. No pages were deleted; `/pro/execution/synthesis` remains live pending later Intelligence relocation.

| Old route | New home / status |
|---|---|
| `/pro/execution/launch` | `/pro/execution/orient` |
| `/pro/execution/status-tracker` | `/pro/execution/operate` |
| `/pro/execution/wind-down` | `/pro/execution/reflect/wind-down` |
| `/pro/execution/retrospective` | `/pro/execution/reflect/retrospective` |
| `/pro/execution/reflection-review` | `/pro/execution/reflect/reflection-review` |
| `/pro/execution/synthesis` | Unchanged; still live pending Intelligence relocation |

## Parked Execution Hub lifecycle/health logic - 2026-06-19

Refinement pass #06 removed the sprint identity, lifecycle banners, completion/health strip, completion summary, celebration/forward CTA, sprint-history placeholder, and `sp_sprint_*` stats fetch from the live Execution Hub landing. The prior implementation is preserved in `pages/ProSuite/_parked/ExecutionHubLifecycleBlocks.tsx` for the downstream home Strategic Overview dashboard work (V-08). The shared `useSprintState` hook remains in place; routes, redirects, `/synthesis`, tool pages, and sidebar behavior were not changed in this pass.

## Handoff #17 — Sidebar cleanup + Intelligence re-nesting (2026-06-21)

**Files changed:** `components/Sidebar.tsx`, `App.tsx`, `pages/ProSuite/IntelligenceLanding.tsx`, `pages/ProSuite/ProMainPage.tsx`

**Sidebar:** Pro Suite nav collapsed to four items — Overview / Planning / Execution / Intelligence. Removed `getExecutionLinks()` dynamic logic, removed `useSprintState` import and sprint wind-down banner from sidebar, removed Virtual CSO / OS Engine / Sprint Launch / Status Tracker / Synthesis as individual nav entries. **No pages or routes deleted.**

**Route moves:**

| Old route | New route | Redirect added |
|---|---|---|
| `/pro/virtual-cso` | `/pro/intelligence/virtual-cso` | ✅ `/pro/virtual-cso` → `/pro/intelligence/virtual-cso` |
| `/pro/os-engine` | `/pro/intelligence/os-engine` | ✅ `/pro/os-engine` → `/pro/intelligence/os-engine` |

**Internal links updated:** `IntelligenceLanding.tsx` (resource card hrefs + "Talk to your Virtual CSO" CTA), `ProMainPage.tsx` (Intelligence sub-cards).

---

## Orient source reshape - 2026-06-19

Structural pass #07 replaced `/pro/execution/orient` as a direct `SprintLaunch.tsx` mount with a two-tab Orient layer: `/pro/execution/orient/overview` and `/pro/execution/orient/alignment`. `SprintLaunch.tsx` is preserved on disk as the source material for the reshape and is now superseded by the Orient sub-pages; no tool page was deleted. The old `/pro/execution/launch` redirect still lands in Orient, and export/history behavior remains shape-only for downstream wiring.
