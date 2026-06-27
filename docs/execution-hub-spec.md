# Execution Hub — Canonical Spec

> **Status:** Soft-locked v1 — 2026-06-19
> **Scope:** The Execution Hub experience and structure, from a locked sprint plan through sprint close.
> **Companions:** `docs/sprint-planning-flow-spec.md` (upstream Planning flow) and `docs/execution-hub-audit-inventory.md` (the page ledger this builds on).
> **Purpose:** Source of truth for the Execution area's intended experience, structure, and decisions. All routing/structure here is **target-state** — nothing is moved, re-routed, or delisted until logged in the inventory ledger (standing rule). Sidebar/nav cleanup is the LAST step.

---

## 1. Experience principle — Execution is the home base

Once the sprint plan is locked, **Execution is where the founder lives for the 90 days** — no need to re-enter Planning mid-sprint. It is the operational home: view, edit, and monitor the sprint and the work within it. Reflective/strategic reads (Momentum Synthesis) and organization-wide health live elsewhere (Intelligence Hub + the home dashboard). Execution stays focused on *running the current sprint*.

---

## 2. Hub-as-launchpad — mirrors the Planning Hub

The Execution Hub follows the **same pattern as the Planning Hub**: a landing that routes into three elements, with the tools living *inside* the elements — not bolted onto the hub page.

| Planning Hub | Execution Hub |
|---|---|
| Roadmap Review · Quarter Map · Sprint Planning | **Orient · Operate · Reflect** |

Mental model: **Planning is where you decide; Execution is where you do — in three beats.** Orient (what this sprint is) → Operate (run it) → Reflect (close it). Maps directly onto see / do / close. (Labels can be fine-tuned, but the three-beat structure is fixed.)

---

## 3. Surface map

```
Execution Hub  (landing — state-aware launchpad; lists the three elements, no tools on it)
  ├─ ORIENT    → Sprint Charter & Summary
  ├─ OPERATE   → Status Tracker
  └─ REFLECT   → sub-tabs:  Wind-Down · Retrospective · Reflection & Review

  Not in the Execution Hub:
    • Momentum Synthesis      → Intelligence Hub (relocated; logged)
    • Org-health dashboard    → home / Strategic Overview (single central dashboard)
```

| Element | Surface | What the founder sees / does | Source page (ledger) | Build status |
|---|---|---|---|---|
| **Orient** | **Sprint Charter & Summary** | A sprint-scoped **mini-dashboard / synthesis charter** — not a wall of text, not the full dashboard. Some of the main dashboard's component/visual language, focused on this sprint: goal, the 3P plan, owners, trajectory. The main alignment landing. **Exportable to PDF** to share with the team. | `SprintLaunch.tsx` (E-2) | Built UI, mock content; not on AOS |
| **Operate** | **Status Tracker** | The **standup tool** — fast inline edits to initiatives/milestones, pull owner updates, flag blockers / needs support. No card-clicking. | `StatusTracker.tsx` (E-3) | Built UI, mock data; not on AOS; duplicate of orphaned `ProgressPage` |
| **Reflect** | **Wind-Down** (sub-tab) | Structured pre-close decisions — Complete / Roll Over / Release. **The rollover output is the bridge that pre-seeds the next sprint's planning.** | `SprintWindDown.tsx` (E-5) | Built UI, mock; not on AOS |
| **Reflect** | **Retrospective** (sub-tab) | End-of-sprint close-out — "did we do what we said?", goal self-assessment, capability deltas; becomes a historical archive afterward. | `Retrospective.tsx` (E-6) | Built UI, mock; not on AOS |
| **Reflect** | **Reflection & Review** (sub-tab) | Quarterly reflection / 3P recalibration. | `ReflectionReview.tsx` (E-7) | **Placeholder stub**; rollover logic incomplete (CLAUDE.md) |

---

## 4. The single-dashboard rule

There is **one central organization-health dashboard**, and it lives on the **home / Strategic Overview page** — not in any hub. It carries maturity, readiness, pressure maps, sprint alignment, and the roadmap at a glance. **No competing per-area dashboards.** Hub sub-pages may carry small, **scoped result dashboards** only (e.g., the Sprint Charter mini-dashboard).

The full home dashboard is **downstream and out of scope now.** A directional mockup was shared (2026-06-19) — it is **non-canonical, sample data**, and the real version must reflect the platform's actual tracked data. Logged as `UI-PROGRESS.md` V-08.

---

## 5. Relocations — what leaves Execution

- **Momentum Synthesis → Intelligence Hub.** It is a weekly *reflective* read (insight + report generation), not an operational tool. It moves to Intelligence when that hub is built. Preserved in the ledger; not deleted.
- **Org-health dashboard content** (currently embedded in `ExecutionLanding`) **→ home / Strategic Overview.** Execution keeps only sprint-scoped, operational views.

---

## 6. Disposition of existing pages (resolved — from the ledger)

| Ledger | Page | Disposition |
|---|---|---|
| E-1 | `ExecutionLanding` | **Split.** Health/stats dashboard role → home/Strategic Overview. Lifecycle-aware launchpad role → the Execution Hub landing (Orient/Operate/Reflect). |
| E-2 | `SprintLaunch` | **Becomes Orient → Sprint Charter & Summary** (mini-dashboard + PDF export). |
| E-3 | `StatusTracker` | **Becomes Operate.** Reframe as standup quick-edit; absorb orphaned `pages/SprintPlanning/ProgressPage.tsx` (resolve the duplicate). |
| E-4 | `MomentumSynthesis` | **Relocate → Intelligence Hub** (later). |
| E-5 | `SprintWindDown` | **Becomes a Reflect sub-tab.** Preserve the rollover → Planning handoff. |
| E-6 | `Retrospective` | **Becomes a Reflect sub-tab.** |
| E-7 | `ReflectionReview` | **Becomes a Reflect sub-tab.** Build out from stub; address rollover logic. |
| — | "Sprint History" dead link (`/pro/execution/history`); `reflection-review` not in nav | Resolve during nav cleanup (last). Logged so not forgotten. |

---

## 7. Target routing (target-state — nothing moves until logged)

```
/pro/execution               → hub landing (Orient/Operate/Reflect launchpad)
/pro/execution/orient        → Sprint Charter & Summary      (from /launch)
/pro/execution/operate       → Status Tracker                (from /status-tracker)
/pro/execution/reflect       → Wind-Down · Retrospective · Reflection & Review (sub-tabs)
                               (from /wind-down, /retrospective, /reflection-review)
/pro/execution/synthesis     → DEPARTS to Intelligence Hub
```

Re-routing and any sidebar change happen later, with each move logged in the ledger per the standing rule.

---

## 8. Constraints / standing rules

- **Log before move/remove; sidebar/nav cleanup is LAST.** A delisted page stays in the repo with a ledger pointer — never deleted silently.
- **AOS pass required** — every Execution page is pre-design (Tailwind slate/blue).
- **No final AI/content wiring yet** — synthesis stays placeholder; sprint data flows through the existing `sp_sprint_goals/initiatives/milestones` tables + `useSprintState`.
- **Reuse existing components**; preserve pages in the ledger.

---

## 9. Open items / downstream

- Build the **home / Strategic Overview dashboard** (true-to-data; mockup is directional) — V-08.
- Decide the **nav home of the central dashboard** (app home Dashboard vs Pro Suite Overview) — V-09.
- Build the **Intelligence Hub** (inherits Momentum Synthesis; report/insight tools).
- **Wire sprint data end-to-end** (sp_* tables; the rollover handoff Reflect → Planning).
- Resolve **Status Tracker vs ProgressPage** duplication.
- **Sprint History** — build the page or remove the link.
- Define any additional **team-alignment tools** (seeded by the Sprint Charter export).
- **Historical sprint-artifacts store** — a Supabase table (e.g., `sp_sprint_artifacts`) to house past sprints' one-pagers for the Orient · Alignment "Historic" browser. Downstream; empty-state shell until users run multiple sprints (UI-PROGRESS V-10).
- **Operate Timeline date inputs** — the Timeline (Gantt-style) needs per-initiative/milestone **start + projected-completion** dates. Ensure Sprint Planning's initiative/milestone creation captures enough to feed it when wired; the Timeline must **degrade gracefully** where dates are missing/partial. Wiring-era dependency.
- **Working capability-score store + re-scoring loop** — stand up the evolving **working-score** table (seeded from the M&R/Growth Mastery assessment at record time); wire Reflection & Review to update **only** the working score (9 of 25 capabilities per sprint); point all live reads (3P, Quarter Map, dashboards) at the working score, not historical; full 125-point re-audit only on stage change. Downstream wiring (UI-PROGRESS V-11).

---

## 10. Decision log — full reasoning

> Canonical "why" for the Execution restructure. `execution-hub-audit-inventory.md` carries the page-level traceability; this carries intent.

**ED-01 — Execution is the home base.** After a plan is locked, the founder should operate from one place for 90 days without bouncing back to Planning. Execution holds the operational surfaces; reflective and org-wide views live in Intelligence and the home dashboard so Execution stays focused on running the sprint.

**ED-02 — The hub mirrors the Planning Hub.** Consistency across the Pro Suite makes the product learnable: every hub is a landing that routes into three elements, tools nested one level down. Planning proved the pattern; Execution reuses it.

**ED-03 — Three elements: Orient / Operate / Reflect.** They map to the natural arc of a sprint (understand it → run it → close it) and onto the see/do/close jobs. Three beats keep cognitive load low and give each tool a clear home.

**ED-04 — One central dashboard, on the home page.** Org health (maturity, readiness, pressure, sprint alignment, roadmap) belongs in a single Strategic Overview, not duplicated per area. Per-area dashboards would fragment the signal and multiply maintenance. Hubs get scoped result views only.

**ED-05 — Sprint Launch → Sprint Charter & Summary (mini-dashboard + PDF).** The team-alignment artifact shouldn't be a static text memo nor a second full dashboard. A sprint-scoped mini-dashboard reuses the main dashboard's visual language, doubles as the founder's alignment landing, and exports to PDF for the team — one source of truth, two presentations.

**ED-06 — Status Tracker = standup quick-edit; absorbs ProgressPage.** The during-sprint workhorse must support fast inline updates for a Monday standup, not card-by-card clicking. Two milestone trackers (StatusTracker + the orphaned ProgressPage) is redundant; one wins and the other is logged + retired.

**ED-07 — Reflect is one element with three sub-tabs.** Wind-Down, Retrospective, and Reflection & Review all serve "closing the sprint," so they consolidate under one Reflect element rather than three top-level surfaces — but all three are kept (not retired) because each does distinct work. Keeping Wind-Down preserves the rollover handoff that pre-seeds the next sprint's planning.

**ED-08 — Momentum Synthesis → Intelligence Hub.** It's a weekly reflective read fitting the insight/report pattern of Intelligence, not an operational tool. Relocating keeps Execution operational and gives Intelligence real first content.

**ED-09 — Tools nest inside elements, not on the hub page.** The hub landing is a launchpad (state-aware: which elements/tools are live by sprint phase). Putting tools directly on the hub would recreate the cluttered, do-everything page; the element layer keeps each surface focused.

**ED-10 — Orient is two sub-tabs (Overview/Synthesis + Alignment Tools & Resources).** Orient holds both the founder's interactive re-anchor view *and* the team-facing shareable artifact. Splitting them keeps the working dashboard uncluttered and gives the exportable one-pager (and its historical archive) a clear home that can grow into more alignment tools. Same sprint data, two purposes — orient yourself vs. align/record the team.

**ED-11 — Operate's Timeline is Gantt-*style*, not a true Gantt.** A true Gantt demands continuous date / dependency / duration hygiene this audience won't sustain — it becomes a chore, goes unmaintained, and the visual turns obsolete or misleading. Instead, a lightweight horizon view uses start + projected-completion dates as a duration *proxy* (no dependency graph, no exact durations) and **degrades gracefully on missing/partial data**, giving a "what's on the horizon / next few weeks" sense without the maintenance burden. (Distinct from the home dashboard, where Gantt is ruled out entirely.)

**ED-12 — Reflect rolls three things forward — work (Wind-Down), behaviors (Retrospective), capabilities (Reflection & Review) — and capability re-scoring writes a *working* score, never the historical record.** Separating the three currencies keeps each sub-tab distinct and non-redundant. Relocating capability re-scoring out of the Retrospective into Reflection & Review makes that surface earn its place as the maturity-recalibration step that closes the transformation loop (Diagnose → 3P → Execute → Re-score → next plan). The historical assessment stays immutable as a permanent baseline; an evolving **working score** (seeded from it at record time, updated 9-of-25 capabilities per sprint, re-audited fully only on stage change) is what every live surface reads — so progress compounds without forcing a 125-point re-audit. The whole layer is built **frictionless** (soft structure, sparing navy, low cognitive weight, never dumbed-down), because the founder only gets value from what they actually fill in.

**ED-13 — Wind-Down v2 is a two-panel cockpit (decide left, pre-stage right) and the wider-grid layout exemplar.** Closing the sprint and seeding the next happen side by side: completion decisions on the left, a directional carry-forward mini-3P on the right where rolled-over *initiatives* are dragged into next-sprint buckets. The carry-forward is intentionally a **sketch** — initiative-level, unenforced, directional — *distinct from Planning's 3P* (capability-level, enforced, the system of record); the difference is deliberate so it stays low-friction and never competes with the real prioritization. The finalize card keeps **live, real-time counts** so it feels like an actual wind-down, with Save (partial) and Lock & Complete. Wind-Down also **tests the wider/grid layout** (wider top bar, grid, less scroll) — evaluated on this exemplar before deciding whether to codify it globally (it bends the current 1440-max-width / single-column guide rules on purpose). Reading measure is still kept comfortable inside cards — wide is for structure/grids, not for stretching prose edge-to-edge.

**ED-14 — Retrospective v2 is a generated memo + at-a-glance recap, not a questionnaire.** Minimize required input (only Start/Stop/Continue + an optional "what else did we learn") so it actually gets done; synthesize the rest. The accomplishment recap is **read-only and pre-scoring** (baseline → focus → qualitative outcomes); the actual capability re-scoring stays in Reflection & Review — Retro *shows* the story, Reflection *makes* the change — which also respects the tab order (Retro before Reflection, so no deltas exist yet). Team recognition becomes AI-synthesized **by-the-numbers** rather than an open-text chore. **Lock generates the memo** (The Story). "What's Next" is compacted **forward guidance**, distinct from Wind-Down's work carry-forward. Net: the founder's required effort shrinks to two reflection inputs; everything else is a toggle, a synthesis, or a memo they sit with.

**ED-15 — Reflection & Review v2 re-scores at the checkpoint level, in a scroll-limited cockpit.** Re-rating happens at the **checkpoint level** (5 per capability) because the working score *is* the checkpoint responses — anything coarser couldn't honestly move maturity/readiness. **Default-carry + only the 9 worked capabilities** keeps it a light scan-and-bump (45 checkpoints, not the full 125). Vitals show **starting vs updated** maturity/readiness + **stage progression** (hero-metric obsidian) — and only those honest scores; **no fabricated revenue/ops**, so it stays a recalibration surface, not a dashboard. Layout is ¾ re-rating table / ¼ live evolution cards — the cockpit pattern (work left, watch movement right) the whole hub now uses.

---

## 11. Orient layer — detail (sub-tabs & content)

Orient is a **sub-tabbed element** (mirrors Quarter Map / Reflect) — a tabbed shell with two sub-tabs:

```
/pro/execution/orient   (tab shell)
  index       → redirect to overview
  /overview   → Overview / Synthesis         (interactive sprint mini-dashboard)
  /alignment  → Alignment Tools & Resources   (exportable one-pager + archive)
```

### Sub-tab 1 — Overview / Synthesis (Orient landing; interactive)
The founder's at-a-glance re-anchor. Reshapes today's `SprintLaunch` identity/at-a-glance material + sprint-scoped versions of the parked progress components. Components:
- Sprint identity: name · quarter · status · dates / days-remaining
- Sprint goal (primary + up to 2 supporting outcomes)
- Sprint theme / framing line
- 3P at-a-glance: Prioritize / Plant / Iterate capability areas + initiative counts (compact board snapshot)
- Owners / accountability summary
- Progress strip (placeholder): completion %, initiatives/milestones, blockers
- Quick links into Operate (tracker/board)

### Sub-tab 2 — Alignment Tools & Resources (shareable artifact + archive)
The one-pager IS essentially today's `SprintLaunch` executive-summary + 3P plan, reshaped export-friendly (single-column, print-ready, so it maps onto the N8N + Google Docs merge template later).
- **Current / Historic** pill.
- **Current** → rendered one-page charter: header (name · quarter · dates · lock date) · sprint goal (+ supporting) · theme · executive summary narrative · 3P execution plan (P / Plant / Iterate → initiatives + owners) · **Download** button (**shape only**; wires later via N8N + Google Docs → Supabase Storage per CLAUDE.md — NOT a frontend PDF library).
- **Historic** → table/list of past sprints (name · quarter · dates · goal-outcome · status); click a row → render that artifact read-only + download. **Empty-state shell now** (no data until users run multiple sprints).
- Reserved spot for future alignment tools (comms planning, buy-in) — noted, not built.

### Altitude note (avoid synthesis-surface sprawl)
Four "synthesis/overview" surfaces exist at distinct altitudes — keep them distinct, do not duplicate:
- **Home Strategic Overview** — org-level (V-08)
- **Quarter Map · Current Quarter Focus** — quarter-level
- **Orient · Overview** — sprint-level, *interactive*
- **Orient · one-pager** — sprint-level, *shareable artifact*

### Content split from existing `SprintLaunch`
Identity + at-a-glance → **Overview**; executive-summary narrative + 3P execution plan → the **one-pager**. `SprintLaunch.tsx` is preserved (not deleted) as source material; it becomes unused once reshaped — log it in the ledger.

### Build scope now
**Container + shape only** — placeholder data, no export wiring, history is an empty-state shell. (Handoff #07.)

---

## 12. Operate layer — detail (sub-tabs & content)

Operate is a **sub-tabbed element** (mirrors Orient / Reflect) — a tab shell with a **top sub-tab nav** and two sub-tabs. Names are clear over clever.

```
/pro/execution/operate   (tab shell — top nav: Timeline · Status Tracker)
  index            → redirect to timeline
  /timeline        → Timeline (Gantt-style horizon)
  /status-tracker  → Status Tracker (standup / bulk update)
```

### Sub-tab 1 — Timeline (Gantt-*style* horizon)
A quick visual read of **what's on the horizon, where things stand, and what's slated next** — not a project-manager Gantt.
- Lays initiatives/milestones across the sprint dates using **start + projected-completion** as a duration *proxy*. **No dependency graph, no exact durations, no drag-resize date editing.**
- **Resilient to partial/unknown data** — show what's known, mark undated/unknown items clearly, never break or look broken on missing dates. Incomplete data must not render the view obsolete (see ED-11).
- Purpose: a low-maintenance "next few weeks / what did we say we'd start when" sense. **Net-new; placeholder this pass.**

### Sub-tab 2 — Status Tracker (standup / bulk update)
The existing Status Tracker, **moved under Operate** as sub-tab 2 (it "comes down" from being the whole Operate page).
- **Functionality stays as drafted:** filter by milestone / initiative, flat/grouped views, standup mode, bulk + systematic updates. (No functional rework; wiring later.)
- **Visual reshape only:** it's already close on the white backdrop — apply the surface hierarchy, swap the **blue accents → brass / parchment** where they're accents, keep the **progress bar obsidian** (not the other blue), use **semantic status pills** and **Geist Mono** numbers.

### Order & landing
Per the workflow: Timeline is sub-tab 1 (the index/landing — see the horizon first), Status Tracker is sub-tab 2 (where you operate the updates).

### Build scope now
Operate **tab shell + top nav**; **Timeline placeholder** (Gantt-style, partial-data resilient); **Status Tracker reshaped** into sub-tab 2 (visual/accent only). No wiring. (Handoff #09.)

---

## 13. Reflect layer — detail (sub-tabs & content)

Reflect is the existing sub-tabbed element (from #05: `ExecutionReflectLayout` over wind-down / retrospective / reflection-review). This pass **reshapes the three sub-pages**. Reflect is **the last 2–3 weeks — equal parts closing this sprint and seeding the next**, so the founder rolls forward instead of re-planning from scratch. Each sub-tab carries a distinct **currency of rollforward**.

**Layer-wide design principle — frictionless, not a chore.** Value out = effort in: if it reads as administrative / non-insight work, the founder skips it and gets no value. Keep it intuitive, naturally flowing, low cognitive weight; **soft structure, not rigid templates; never dumb down the concepts.** Per the Surface Hierarchy, **navy used sparingly/earned — do not over-use the obsidian background.**

### Sub-tab 1 — Wind-Down — v2 cockpit (Handoff #11)
A two-panel **"close + pre-stage" cockpit**, not a scroll-form — and the **exemplar for the wider-grid layout** (wider top bar + grid + reduced scroll, evaluated here before any global codification; it deliberately bends the current max-width/single-column guide rules).
- **Top:** sprint goal + supporting goals (up to 2 cards; **N/A** placeholder if none — container stays for layout consistency).
- **Left — Completion Decisions** (Pressure-Map-style rows, in **Prioritize → Plant → Iterate** order): each initiative row expands to quick-update milestone statuses + set **Complete / Roll Over / Release**. A **"View full grid"** button opens a **pop-up of the Operate bulk-update workspace** (edit many milestones without leaving the page).
- **Right — Carry-Forward** (mini Prioritize/Plant/Iterate grid): tagging an initiative **Roll Over** populates a card here; **drag-and-drop** cards into the bucket you think they'll land next sprint. **Directional reference only** (helper text); rules NOT enforced. Cards move at the **initiative** level — *distinct* from Planning's real 3P, which moves at the **capability** level and is the system of record. Click a card → optional note + the **single-initiative record pop-up** (reuse the Planning workspace modal).
- **Bottom — Finalize** (navy card, CSO-insight style): **keeps live counts** (completing / rolling-over / releasing) that **update in real time** as decisions change, plus **Save** (partial — return later) and **Lock & Complete** (does NOT close the sprint).
- **Removed:** the "Looking ahead" forward-seeding questions **relocate to the Retrospective** (preserve + log; placed in the Retro pass).

### Sub-tab 2 — Retrospective — v2 memo, not questionnaire (Handoff #12)
Reframed from a fill-in questionnaire into a **generated memo + sprint-at-a-glance**, on the wider/cockpit layout. **The only required input is Start/Stop/Continue + an optional "what else did we learn."** Everything else is a quick toggle or AI-synthesized. Capability re-scoring is NOT here — **Retro *shows* the story; Reflection *makes* the change** (and Retro runs *before* Reflection, so it can't show score deltas yet).

Top → bottom:
- **Goals** (primary + 2 supporting) across the top — each with a *subtle inline* **Yes / Partially / We-Learned** toggle in the goal card (no separate "did we accomplish?" callout).
- **Sprint by the numbers** — full width.
- **Two-column band:**
  - **Left (~¾) — Accomplishment recap** (read-only, **pre-scoring**): the maturity/readiness **baseline we started at** → the **capability areas + initiatives we focused on** → **qualitative outcomes**. NOT a re-score (that's Reflection), NOT the milestone/outcomes table (seen in Wind-Down).
  - **Right — Team by-the-numbers:** each person + milestones/initiatives tagged + completed + a 2–3 sentence **AI-generated** contribution synthesis (produced at wind-down close). No open recognition text.
- **Start / Stop / Continue** — full width, **three columns**, intro on top, open text in each.
- **Additional notes — "what else did we learn"** (optional) — sits with S/S/C so all open text/reflection is in one place. **The relocated Wind-Down "Looking Ahead" forward-seeding questions land here.**
- **Lock / Approve retrospective** — **above** the generated summary; locking **generates the memo**.
- **The Story** — the generated memo (placeholder until wired; the earned navy moment).
- **What's Next** — compacted into one insightful container (synthesized forward guidance — NOT a re-staging of carry-forward items, which Wind-Down owns).
- **Historical archive** — Current/Historic pill (reuse Orient's Alignment pattern) to browse/download past retro memos (shell for now).

### Sub-tab 3 — Reflection & Review — v2 cockpit (Handoff #13)
The capability recalibration, simplified into a scroll-limited cockpit on the wider layout. Re-scoring is at the **checkpoint level** (honest — the working score *is* the checkpoint responses), **default-carried** so it's scan-and-bump, and only across the **9 worked capabilities** (not all 25) — a light effort.

Top → bottom:
- **Vitals — two-section + stage:** the **starting-state** maturity + readiness beside the **updated-state** maturity + readiness (after save) — the full maturity progression at a glance — plus a **stage-progression** element (the 5-stage bar Surviving → … → Compounding with the marker) showing how far they've moved and how close to the next stage. Hero-metric numbers → **obsidian** (per the parchment rule). **Only maturity / readiness / stage** — no revenue/ops; this is a recalibration surface, **not a dashboard**.
- **Two-column band:**
  - **Left (¾) — Re-rating table:** the **9 capability-area accordion cards** — each: title + short description → expands to **what good looks like** + previous score + the **5 checkpoints**, each with the **previous response** + a **re-rate** (default = previous; bump only what changed). Saving updates the working score.
  - **Right (¼) — Evolution cards:** the 9 capability areas, each a **compact line visual** — starting point → ending point, distance traveled, % change — **updating live** as you re-rate.
- *(No open-text section — confirmed deliberate. All reflective open text lives in the Retrospective; Reflection stays **pure re-scoring** to keep it the lowest-friction surface.)*
- **Sprint closed → Map your next sprint** — the closing handoff. (Retain the existing This-sprint/Past-sprints archive shell.)

*Note: the shipped build (#13) integrates the capability movement **inline per row** (START → NOW → Δ) rather than as a separate ¼ column — accepted as cleaner/more compact.*

### Working-score model (concept — wiring downstream)
- **Two tables:** immutable **historical** (assessment record) + evolving **working** score, the working **seeded from the assessment at record time**.
- Reflection & Review **only writes the working score**; never the historical.
- **All live surfaces** (score displays, 3P focus/priority/weighting, dashboards) **read the working score.**
- Structure: **25 capability areas × 5 checkpoints = 125**; a sprint re-scores **9 of 25**; the rest unchanged.
- **No full re-audit except on stage change** (when "what good looks like" recalibrates); within a stage, keep updating 9-of-25 per sprint until ~80–90% maturity/readiness.

### Build scope now
Reshape the three sub-pages on AOS + Surface Hierarchy; Reflection & Review built as the recalibration **shape/placeholder**; Current/Historic = empty shell; **no wiring** (the working-score table is downstream, V-11). (Handoff #10.)
