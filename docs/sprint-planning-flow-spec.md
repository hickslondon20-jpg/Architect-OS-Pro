# Planning & Strategy — Canonical Flow Spec

> **Status:** Soft-locked v2 — 2026-06-18
> **Scope:** The ProSuite Planning & Strategy step-down, from ProSuite entry through a locked sprint plan. Execution suite is referenced but specified separately.
> **Purpose:** Single source of truth for the intended user journey. All code reconciliation and build ordering is measured against this document — not chat history or memory. Revise this deliberately; do not let the build drift from it silently.

---

## 1. Design principle — low input, high handhold

The planning suite handholds the founder into a sprint plan. The system carries the context; the founder supplies judgment at a small number of decision points and otherwise reads, confirms, and optionally overrides.

Founder input is concentrated in **four moments**. Everything else is the system showing its work:

1. **Horizon declarations** — tag/confirm existing vision artifacts and lock.
2. **Sprint goal** — declare what this sprint's goals must be.
3. **3P** — declare + prioritize capability areas in light of the goal.
4. **Initiative / milestone build** — turn capabilities into executable commitments.

Anything that forces input outside these four moments is a candidate for removal as "planning tax." Anything that hides the system's reasoning at these four moments undercuts the handhold. Both failure modes are ship-blocking for UX.

---

## 2. Taxonomy — four distinct layers

The platform operates on a strict hierarchy. These are not interchangeable terms.

| Layer | Definition | Owned where |
|---|---|---|
| **Capability area** | High-level area of agency maturity (from the M&R / Growth Mastery audit). The unit of strategic focus. | Diagnostics → flows into 3P |
| **Initiative** | The actionable, measurable, tangible commitment made under a capability. The unit of execution intent. | Sprint Board |
| **Milestone** | The layer beneath an initiative that proves/validates the initiative's success. | Sprint Board (drill-down) |
| **Task** | The most granular layer of work. **Out of platform scope** — tasks live in ClickUp / Asana. | External |

The step-down the platform delivers: **Capability → Initiative → Milestone.** Tasks are intentionally excluded (see CLAUDE.md execution hierarchy rule).

---

## 3. End-to-end step-down

The journey spans three planning areas (Strategic Roadmap → Quarter Map → Sprint Planning) and hands off to Execution. Input type is marked **[INPUT]** (real founder decision), **[READ]** (system shows its work, no required input), or **[READ + OVERRIDE]** (read by default, optional context layering).

### Strategic Roadmap

**Step 1 — Declarations** · `[INPUT]`
Founder confirms/retags their 12 / 24 / 36-month horizon visions (quantitative + qualitative). These are **not created here** — they are pulled forward from Clarity Compass and GV Simulator outputs, tagged into the planning tools, and locked.
*Source:* Clarity Compass, GV Simulator. *Output:* locked horizon declarations.

**Step 2 — Horizon breakdown** · `[READ]`
System reverse-engineers from the ultimate vision backward: 36-month → 24-month → 12-month → current state. Shows what each horizon *implies* and how outcomes/horizon-states chain back to today.
*Source:* Step 1 declarations + system synthesis. *Output:* a working-backward narrative the founder reads/confirms.

### Quarter Map

**Step 3 — Quarter sequence** · `[READ + OVERRIDE]`
The 12-month horizon splits into four quarterly sprints. Founder sees the sequence and how the quarters break down.
*Source:* Step 2. *Output:* four-quarter sequence.

**Step 4 — Current quarter synthesis** · `[READ + OVERRIDE]`
Sprint 1 (current quarter) gets a general synthesis. The founder reads it and may layer in additional/overriding context on top of what the system already knows. **This screen does NOT run the 3P selection** (see §5 — 3P moves to Sprint Planning).
*Source:* Step 3 + accumulated context. *Output:* framed current-quarter focus.

### Sprint Planning

**Step 5 — Sprint goal** · `[INPUT]`
"Based on everything you've told us, what should this sprint's goals be?" The founder declares the sprint's goal. **First screen of Sprint Planning** (entry lands here, not the board).

*Design (single page, v2 — see handoff #04):*
- Collapsed-by-default CONTEXT (Context Re-Anchor · Four-Sprint Arc · Directional Focus) — available, not forced. Directional Focus is system-derived context that informs the starters, not a required input.
- "What a good goal sounds like" — static universal example(s) + guardrails (outcome not activity · changed operating reality · verifiable true/false). Teaches the shape; not selectable.
- "Starter goals for you" — personalized from vision/quarter/capabilities; selecting one SEEDS the editor (never one-click commit), preserving ownership.
- **Cardinality:** one **primary** goal (the north star / single success yardstick) + up to ~2 **optional supporting** outcomes for breadth. Success is judged on the primary.
- Inline pre-lock gut-check, then lock → 3P Prioritization.

*Source:* Steps 1–4. *Output:* locked primary goal (+ optional supporting outcomes). *Downstream:* persisted and passed to 3P, the board's sprint-goal banner, and AI tone/feedback (wiring is a later task; structure is placeholder now).

**Step 6 — 3P (one page)** · `[INPUT]`
Declaration **and** prioritization combined on a single page. Founder allocates capability areas across **Prioritize / Plant / (progressively) Iterate**, plus Parking Lot, in light of the goal + synthesis + capability scores. This is the relocated, Supabase-wired engine.
*Source:* M&R/Growth Mastery scores + Step 5 goal. *Output:* locked 3P selections (`quarter_map_selections` or successor table).

**Step 7 — Sprint Board** · `[INPUT]`
The 3P selections populate the board. Founder turns each prioritized **capability area into one or more initiatives** — actionable, measurable, tangible. The board reads real 3P output (not mock arrays).
*Source:* Step 6 selections. *Output:* initiatives mapped to capabilities within the 3P frame.

**Step 8 — Milestones** · `[INPUT]`
Founder drills into each initiative and defines milestones that validate it.
*Source:* Step 7 initiatives. *Output:* milestones under initiatives.

**Step 9 — Review / Lock → Sprint plan output** · `[INPUT → READ]`
Completeness + reflection gate, then lock. Locking generates the sprint posture synthesis and a **sprint-plan report / generative dashboard** mapping the full plan. This is the handoff artifact into Execution.
*Source:* Steps 5–8. *Output:* locked sprint plan + report/dashboard.

### Execution (separate suite — specified elsewhere)

Launch, team alignment, and long-term momentum. Its own major area. Out of scope for this spec beyond noting that the Step 9 output feeds it.

---

## 4. Section ownership & lock status

| Area | Status for this work | Notes |
|---|---|---|
| Strategic Roadmap (declarations, horizons, 12-month) | **Locked / built** — do not restructure | Steps 1–2 |
| Quarter Map — quarter sequence | **Locked / built** — do not restructure | Step 3 |
| Quarter Map — current quarter | **In scope:** demote from 3P-selection to synthesis/framing | Step 4 (see §5c) |
| Sprint Planning | **In scope:** primary build target | Steps 5–9 |
| Execution | Out of scope here | Future spec |

---

## 5. The 3P resolution — and the Current Quarter Focus restoration

**Build status (2026-06-18):** Relocation complete. The wired 3P exercise now lives in Sprint Planning (`/sprint-planning/prioritization`); the Sprint Planning 3P page and the Sprint Board are **soft-locked** as the canonical working surfaces. Lock-state gating was removed and fallback capabilities added so the exercise renders reliably.

How the original three-move plan resolved:

- **(a) Relocate — DONE.** `ThreePExercise` is the single 3P engine and is now **Sprint-Planning-only** (no `surface` prop, no Quarter Map concerns).
- **(b) Collapse — DROPPED.** Unnecessary; there is one 3P page.
- **(c) Demote — DROPPED as overkill.** Replaced by a cleaner action: **remove 3P from Quarter Map entirely** and restore the `current-quarter` tab to its intended purpose — a **read-only quarter-level synthesis / checkpoint** (Step 4). It reuses existing components (`QuarterPostureBlock` + `ReferenceStrip`); content is placeholder until synthesis is wired (n8n + Anthropic, downstream). See handoff #03.

This restoration also settles the **dual-synthesis** question: the quarter-level readback (Current Quarter Focus, a pre-Sprint-Planning checkpoint) and the sprint-level posture (`SprintPostureSynthesis`, after the board is locked) are different altitudes — both belong.

Still pending (separate future tasks): wiring the Sprint Board to real 3P selections; internal 3P refinements; the Sprint Goal widget pass; real quarter-synthesis content wiring.

---

## 6. Route map — current → target

Current (`App.tsx`):

```
/pro/planning/roadmap/{orientation,horizons,12-month-plan}   ← Strategic Roadmap (keep)
/pro/planning/quarter-map/sequence                           ← Quarter sequence (keep)
/pro/planning/quarter-map/current-quarter                    ← 3P engine (MOVE OUT)
/pro/planning/sprint-planning/  → index redirects to board   ← (RE-POINT to goal)
/pro/planning/sprint-planning/sprint-goal                    ← 5-step wizard (CONSOLIDATE)
/pro/planning/sprint-planning/board                          ← mock 3P board (WIRE to real 3P)
/pro/planning/sprint-planning/board/:id                      ← capability → initiative (keep)
/pro/planning/sprint-planning/review                         ← review/lock (keep)
/pro/planning/sprint-planning/synthesis                      ← posture synthesis (keep)
/pro/planning/sprint-planning/initiative-library             ← routed, not in nav (RESOLVE)
/pro/planning/sprint-planning/milestone-builder              ← routed, not in nav (RESOLVE)
```

Target (intended sequence under Sprint Planning):

```
/pro/planning/quarter-map/current-quarter   → Step 4: synthesis/framing only (3P removed)
/pro/planning/sprint-planning/  (index)      → redirect to sprint-goal
  sprint-goal      → Step 5: consolidated single-screen goal flow
  3p (new)         → Step 6: relocated 3P declaration + prioritization (one page)
  board            → Step 7: capabilities → initiatives, reads real 3P
  board/:id        → Step 7 detail: per-capability initiative creation
  (milestones)     → Step 8: under initiatives
  review           → Step 9a: completeness + reflection gate
  synthesis        → Step 9b: locked posture + sprint-plan report/dashboard
```

---

## 7. Open flags (tracked, not yet decided)

- **Nav bug 1:** `SprintGoalFlowPage.tsx:23` → `/pro/planning/sprint-board` (dead). Target: `/pro/planning/sprint-planning/board`.
- **Nav bug 2:** `SprintReviewLockPage.tsx:23` → `/pro/planning/sprint-synthesis` (dead). Target: `/pro/planning/sprint-planning/synthesis`.
- **Dual synthesis surfaces:** quarter-level mock (in `CurrentQuarterFocusTab`) vs sprint-level mock (`SprintPostureSynthesis`). Decide which survive once 3P moves.
- **InitiativeLibrary / MilestoneBuilder:** routed but not in nav. Confirm role or retire.
- **ProgressPage (orphaned):** complete milestone tracker, not routed; overlaps Execution's `StatusTracker`. Decide ownership of progress tracking.
- **Terminal artifact:** the Step 9 sprint-plan report / generative dashboard is named but not yet specified or built.
- **Goal ↔ 3P order:** RESOLVED — goal first (Step 5), then 3P (Step 6).
- **3P surface presentation — RESOLVED (differently than first planned):** lock-state gating was removed entirely and `ThreePExercise` is now Sprint-Planning-only. Quarter Map no longer renders it; Current Quarter Focus gets its own read-only synthesis composition (handoff #03). No `surface` prop.
- **3P data lifecycle (OPEN):** Sprint Planning and Quarter Map currently share one `quarter_map_selections` row. Whether Sprint Planning eventually gets an independent 3P record (per sprint) rides with the demote decision. Until then, the shared row stays; only presentation diverges by surface.

---

## 8. Constraints honored

- No code changes made in producing this spec.
- No final AI/content wiring assumed; synthesis layers remain mocked until wired.
- Left sidebar not restructured.
- Completed Strategic Roadmap and Quarter Sequence work not restructured (the `current-quarter` change is a 3P **removal + synthesis restoration**, not a rebuild — see D-03).
- Every Sprint Planning step is justified by its place in the §1 input/handhold model.

---

## 9. Decision log — full reasoning

> The canonical "why" behind each major decision in this restructure, so intent isn't lost as the build continues. `UI-PROGRESS.md` Session 8 carries the at-a-glance version (D-01…D-10); this section carries the full reasoning.

**D-01 — 3P lives in Sprint Planning, not Quarter Map.** 3P (Prioritize / Plant / Progressively Iterate) is the act of deciding which capability areas earn effort *this sprint* — sprint-execution prioritization. Quarter Map is long-range framing (vision → horizons → quarters). Having 3P inside Quarter Map conflated strategic framing with sprint execution and forced the founder to prioritize capabilities before setting a sprint goal. Relocating it *after* the goal makes prioritization happen in light of the goal.

**D-02 — "Collapse" dropped.** The original plan assumed two 3P touchpoints (initial declaration + prioritize-in-light-of-goal) that needed merging. In reality there is one 3P engine/page, so there was nothing to collapse.

**D-03 — "Demote" dropped; Current Quarter Focus restored instead.** Converting Current Quarter Focus into a newly-built synthesis view was overkill. The simpler, correct move: remove the misplaced 3P and restore the tab to the read-only checkpoint it was always meant to be, reusing existing components (`QuarterPostureBlock` + `ReferenceStrip`).

**D-04 — Current Quarter Focus = read-only quarter synthesis.** A review/confirm/align checkpoint, not an input surface. It reads back the drill-down (ultimate vision → 36/24/12-month → four quarters → this quarter's immediate next steps/focus areas) so the founder enters Sprint Planning already oriented. No 3P, no selection, no lock. (Later, optionally, a place to sense-check or correct.)

**D-05 — Sprint Goal = single page.** Because Current Quarter Focus now anchors context immediately upstream, the five-screen wizard's first two re-anchoring steps were redundant — "planning tax." Consolidating to one page keeps grounding available (collapsed) while focusing the founder on the real decision: the goal.

**D-06 — Goal cardinality = one primary + up to two optional supporting outcomes.** A single primary goal preserves one clear "did we win this sprint?" yardstick and low cognitive load. But a sprint spans multiple capability areas, so up to two optional supporting outcomes add breadth without diluting the verdict. Success is judged on the primary; supporting outcomes are secondary signals.

**D-07 — Starters seed, never commit.** The original instinct was a button-click goal selection to standardize what a goal should look/sound like. But a pure click isn't insightful enough for this audience, and the system never has the founder's full context. Resolution: static examples teach the *shape*; personalized starters *seed* the editable field so the founder refines and owns it. Standardization without narrowing.

**D-08 — `ThreePExercise` is Sprint-Planning-only.** Once Quarter Map stopped rendering 3P, the shared component no longer needs a dual-context `surface` prop — it's a single-purpose engine for the Sprint Planning prioritization page. (The lock-state gating that briefly caused a cross-surface display bug was removed entirely.)

**D-09 — Dual synthesis is intentional.** Two synthesis surfaces exist and both belong: the quarter-level readback (Current Quarter Focus, a pre-Sprint-Planning checkpoint) and the sprint-level posture (`SprintPostureSynthesis`, after the board is locked). Different altitudes, different purposes.

**D-10 — 3P data lifecycle left OPEN.** Sprint Planning currently owns the `quarter_map_selections` row. Whether it eventually keys per-sprint (independent of any Quarter Map record) is deferred to the wiring/persistence pass — not blocking now.
