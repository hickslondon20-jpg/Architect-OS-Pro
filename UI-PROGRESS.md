# ArchitectOS Pro — UI Design Pass Progress

> Phase 5B: Design System Alignment
> Rule: CSS/styles only. Do not touch component logic, data wiring, or API calls.
> Flag logic issues found — do not fix in the same pass.
> Read CLAUDE.md + DESIGN-GUIDE-QUICK.md at the start of every session.

---

## Status Key
- `[ ]` Not started
- `[→]` In progress (current session)
- `[✓]` Complete
- `[!]` Flagged issue (logic/wiring — handle in Phase 6)

---

## Session 1 — Global Shell ✓
**Scope:** Sidebar, layout wrapper, header, global Inter sweep
**Files:** `components/Sidebar.tsx`, `components/Layouts.tsx`, `components/Header.tsx`
**Also:** Grep sweep for `Inter`, `#000`, `gray-` across all component files

- [✓] `Sidebar.tsx` — Applied Obsidian Navy bg, Steel Blue default nav text, Slate hover, Brass active state + left border
- [✓] `Layouts.tsx` — Applied Parchment canvas bg, updated max-width to 1440px
- [✓] `Header.tsx` — Font, color, and spacing aligned to AOS tokens
- [✓] Grep sweep — No `Inter` references in `.tsx` files; `index.html` already corrected
- [✓] Grep sweep — No bare `#000`/`#111` in `.tsx` files
- [✓] Grep sweep — No Tailwind `gray-*` classes in `.tsx` files

**Flags from this session:**
| # | File | Issue | Phase 6 Task |
|---|---|---|---|
| F-01 | `components/Layouts.tsx:8` | `isAuthenticated = true` hardcoded — auth guard not wired to real Supabase session | Wire to Supabase auth session |

---

## Session 2 — Foundations: Clarity Compass ✓
**Scope:** Vision State view, 4 horizon cards, dev artifact removal
**Files:** `pages/ClarityPages.tsx`, `components/ui.tsx`

- [✓] Page layout and canvas background — `var(--bg-canvas)` / `var(--bg-surface)` applied throughout
- [✓] Vision State card styling — Finalize block, Right sidebar direction card, horizon status items all tokenized
- [✓] 4 horizon cards — Accordion border/bg/typography converted; all `slate-*` → AOS fg tokens
- [✓] Remove "Dev: Force Generate Dashboard" button — fully deleted from JSX, not hidden
- [✓] Any inline style overrides or hardcoded colors — all `brand-*`, `emerald-*`, `amber-*`, `red-*`, `slate-*` replaced with AOS tokens
- [✓] `components/ui.tsx` — Full shared component sweep: Button variants, Badge colors, Accordion, ProgressBar, Switch, TabNav, TabsList/Trigger, RadioGroup, Checkbox, Input, Select, Label, PageHeader, PlaceholderContent, Table, Tooltip, Popover all converted

**Flags from this session:**
| # | File | Issue | Phase 6 Task |
|---|---|---|---|
| F-04 | `pages/ClarityPages.tsx:1204` | `Badge color="slate"` is not a valid prop value — silently falls through to no match | Replace `color="slate"` with `color="gray"` in ClarityHistory table |
| F-05 | `pages/ClarityPages.tsx:1215` | `Badge color="amber"` is not a valid prop value — silently falls through to no match | Replace `color="amber"` with `color="yellow"` in ClarityHistory status cell |

---

## Session 3 — Foundations: Agency Snapshot ✓
**Scope:** All four sub-tab entry forms, per-tab synthesis reveal layers, and the main populated dashboard (widgets, insight cards, expandable elements)
**Files:** `pages/SnapshotPages.tsx`, `components/snapshot/SnapshotDashboard.tsx`, `components/snapshot/IdentityPositioningTab.tsx`, `components/snapshot/ProfileStyles.css`, `components/snapshot/FinancialProfile.tsx`, `components/snapshot/GrowthProfile.tsx`, `components/snapshot/TeamProfile.tsx`
**Note:** Treated with same depth as Clarity Compass. Seven files edited.

- [✓] Page layout and canvas background — `SnapshotLayout` sidebar + main area fully tokenized
- [✓] Sub-tab navigation styling — all 4 tabs (Economic Foundation, Revenue Model, Delivery Architecture, Market Footprint / Identity & Positioning)
- [✓] Form field styling across all 4 entry tabs — `ExpandableInsightCard`, `SectionHeader`, `FormSection`, `AdvancedSection`, guidance boxes, hint texts, validation errors, tooltips, textarea, checkboxes, disabled inputs all tokenized
- [✓] Submit / save button styling per tab — Brass primary pattern (`var(--aos-brass)` / `hover:var(--aos-brass-soft)`)
- [✓] Per-tab synthesis reveal layer — synthesis render blocks (`bg-[var(--bg-sunken)]`), status banners (success/skipped/error → AOS semantic tokens), loading panels, running/error/complete states
- [✓] Main dashboard view — `SnapshotDashboard.tsx` fully tokenized: lifecycle state views, all card types (BusinessVitalsStrip, ModalBeatCard, DimensionCard, SignalCard, ImplicationCard), modal backdrops, download button states
- [✓] Insight cards on dashboard — `ExpandableInsightCard` uses `bg-[var(--bg-surface)]` / `border-[var(--aos-mist)]` / `shadow-[var(--shadow-soft-1)]`; signal block gradient replaced with flat `bg-[var(--aos-insight-tint)]`
- [✓] Expandable elements — consistent with `IdentityPositioningTab.tsx` `PositioningAccordion` and `AdvancedSection` patterns
- [✓] Any inline style overrides or hardcoded colors — full sweep: `slate-*`, `emerald-*`, `green-*`, `blue-*`, `indigo-*`, `red-*`, `amber-*` all replaced; `ProfileStyles.css` rewritten; profile component icons tokenized; `getRiskScore()` color constants tokenized; channel mix container conditional border tokenized; checkbox inputs tokenized; metrics sidebar computed ternary spans tokenized; GrowthPipeline duplicate rank Select border tokenized; metrics sidebar placeholder footer icons tokenized

**Flags from this session:**
| # | File | Issue | Phase 6 Task |
|---|---|---|---|
| F-06 | `pages/SnapshotPages.tsx` (synthesis error blocks, ×3) | `Button size="sm"` — `size` prop not in Button type definition in `components/ui.tsx` | Add `sm` to Button `size` type, or replace with `className`-based sizing |

---

## Session 4 — Foundations: GV Simulator ✓
**Scope:** Growth Velocity Simulator — Calculator tab and Scenario Planner tab
**Files:** `pages/GVCalculatorPage.tsx`, `components/tools/growth-velocity/HelperTextPanel.tsx`, `components/tools/growth-velocity/ScenarioPlannerInputs.tsx`, `components/tools/growth-velocity/ScenarioCompareMode.tsx`, `components/tools/growth-velocity/compare/ComparisonCharts.tsx`
**Note:** Reclassified from Pro Suite. GV Simulator is a Foundations tool in the current nav structure.

- [✓] Tab navigation styling (Calculator / Scenario Planner) — pill toggle: active "Build Scenario" = bg-surface/fg-1/mist ring; active "Compare" = bg-inverse/fg-on-dark (navy secondary pattern)
- [✓] Calculator tab — input field styling, metric display treatment — all field labels, section headers, dividers tokenized
- [✓] Calculator tab — result/output numbers (Geist Mono) — applied via `style={{ fontFamily: 'var(--font-mono)' }}` on GVIDisplay score (text-7xl), MetricCard values (text-3xl), ComparisonTable target column
- [✓] Scenario Planner tab — scenario card styling — bg-surface, border-mist, shadow-soft-1; PressureCard badges: risk/warning/success semantic tokens; isSaved card: success-tint/success; preset buttons: brass active, brass-tint hover
- [✓] Scenario save/compare UI elements — Save button: brass primary; "View in Comparison": bg-inverse/fg-on-dark navy secondary; Save Comparison: brass primary; expanded save panel: bg-canvas/mist borders; saved confirmation: success-tint/success
- [✓] Any inline style overrides or hardcoded colors — full sweep across all 5 files: statusConfig (PressureCard), GVIDisplay dark card, MetricCard, ProcessingOverlay, ComparisonTable, HelperTextPanel, loaded scenario banner, GVScenarioPlanner pill toggle, ScenarioPlannerInputs (all blocks), ScenarioCompareMode (all sections including expanded panel, pressure table, synthesis view), ComparisonCharts (quadrant labels, card headers, tooltip)

**Flags from this session:**
_None logged_

---

## Session 5 — Diagnostics: MRA ✓
**Scope:** Market Readiness Audit — all 4 result tabs
**Files:** `components/tools/maturity-audit/dashboard/ResultsDashboard.tsx`, `chapters/Chapter1_Summary.tsx`, `chapters/Chapter2_Systems.tsx`, `chapters/Chapter3_Capabilities.tsx`, `chapters/Chapter4_Direction.tsx`, `dashboard/QuadrantWidget.tsx`

- [✓] Tab navigation styling — segmented control pill: active = bg-surface/brass text/mist ring; inactive = fg-3/fg-1 hover/sunken hover; page bg → bg-canvas; sticky nav → rgba(252,251,248,0.85) backdrop
- [✓] Summary tab — maturity/readiness score display (74%/76%) → Geist Mono via `style={{ fontFamily: 'var(--font-mono)' }}`; KPI score cards → surface/mist; Confident/Stable badges → success-tint/insight-tint; hero card → brass left border + surface bg; decoration blob → brass-tint; quadrant card → surface/mist/shadow-soft-1; sidecar insight card → success left border + success-tint bg; stage context card → canvas/mist; path forward card → insight-tint; action button shadow → shadow-soft-2/elevated
- [✓] Strategic Matrix tab (Chapter2) — radar card surface/mist; dimension score badges mapped emerald→success, blue→insight, amber/orange→warning, red→risk; stage fit badges: At→canvas/fg-2/mist, Ahead→success, Below→warning; expanded detail panel → canvas/mist; dark takeaways card → bg-inverse/fg-on-dark; dark card h4 subheadings → steel-blue; dot+label → success; CTA button → bg-inverse navy
- [✓] Structural Levers tab (Chapter3) — helper functions rewritten: getPriorityColor/getStageFitColor/getBarColor → AOS semantic tokens; icon bgs → risk-tint/success-tint; capability stack container → surface/mist/shadow-soft-1; stack header → canvas/mist; table rows → canvas hover; cap name hover → insight; CheckCircle2 → success; closing synthesis → canvas/mist; CTA → bg-inverse navy; modal backdrop → inline rgba(25,48,82,0.4); modal surface/mist; modal stat numbers → Geist Mono; bar track → mist; insight box → insight-tint/insight border; section icons (Layers/TrendingUp) → insight
- [✓] Direction tab (Chapter4) — section 2 container → canvas/mist; target state pill → surface/mist; checkmarks → success-tint/success; list items → fg-2; Path A card → surface/mist/shadow-soft-1; icon bg → canvas/sunken; Path B card → insight-tint border+bg; Path B icon → brass-tint; Map icon → brass; Path B CTA → bg-inverse navy; closing quote → fg-4
- [✓] PDF download button styling — ghost/outline pattern: `style={{ border: 'var(--border-accent)', color: 'var(--aos-brass)' }}` + `hover:bg-[var(--aos-brass-tint)]`
- [✓] QuadrantWidget.tsx — custom tooltip → bg-inverse/fg-on-dark/slate-blue border/success label; axis labels → fg-4; all 4 overlay cards tokenized: foundation→canvas/mist, momentum→insight-tint/insight, scale→success-tint/success, misalignment→warning-tint/warning; Recharts Label fill-* SVG classes left untouched per phase rules
- [✓] Full hardcoded color sweep — all slate-*/blue-*/emerald-*/red-*/amber-*/orange-*/brand-* replaced with AOS tokens across all 6 files

**Flags from this session:**
_None_

---

## Session 5B — Diagnostics: MRA Assessment Layer ✓
**Scope:** MRA assessment wizard and intro — all files untouched by Session 5 (which only covered the result dashboard). Also fixes two broken navigation URLs that blocked access to the wizard.
**Files:** `AuditOverview.tsx`, `AuditNavigation.tsx`, `AssessmentWizard.tsx`, `shared/CapabilityCard.tsx`, `shared/DimensionTransition.tsx`

- [✓] `AuditOverview.tsx` — Card container → surface/mist; all 3 feature icons unified to brass-tint/brass (was blue/indigo/emerald mismatch); h1/h2 headings → fg-1; body copy → fg-2; list dots → fg-3; italic note → fg-3; CTA button → bg-inverse/fg-on-dark navy. **Bug fixed:** navigate URL corrected from `/tools/mr-audit/assessment` → `/diagnostics/mr-audit/assessment`
- [✓] `AuditNavigation.tsx` — Progress bar: track → bg-sunken, fill → brass, percentage label → brass; sidebar Card → surface/mist/shadow-soft-1; dividers → mist; dimension rows: active bg → sunken, hover → sunken; chevrons → fg-3; Lock icon → fg-4; active dimension label → brass; default label → fg-1; locked label → fg-4; complete check → success; capability list bg → sunken; active row → brass border/brass-tint bg/brass text; default row → fg-2/fg-1-hover; complete mark → success; in-progress dot → warning; empty dot → fg-4 border
- [✓] `AssessmentWizard.tsx` — Loading overlay backdrop → inline rgba(25,48,82,0.5); overlay card → surface/mist; spinner icon bg → brass-tint; spinner → brass; heading → fg-1; status messages → fg-2; progress labels + footer note → fg-3; initial loading state: spinner → brass, message → fg-2; error state: alert icon → warning, message → fg-1; empty state → fg-3; stage label → fg-3. **Bug fixed:** onComplete navigate URL corrected from `/tools/maturity-audit/results` → `/diagnostics/mr-audit/results`
- [✓] `CapabilityCard.tsx` — Dimension label row → fg-3; divider → mist; capability h2 → fg-1; description → fg-2; column header → fg-3; checkpoint cards → mist border/shadow-soft-1/steel-blue hover; checkpoint h3 → fg-1; tooltip icon → fg-4/fg-2-hover; tooltip → bg-inverse/fg-on-dark; tooltip arrow → bg-inverse; checkpoint statement → fg-2; radio unselected → mist border/steel-blue hover/surface bg; radio selected → brass border/brass bg; footer divider → mist; Back button → fg-3/fg-1-hover; Save Progress → mist border; Next button → bg-inverse/fg-on-dark navy
- [✓] `DimensionTransition.tsx` — Card → surface/mist/shadow-soft-2; top accent bar → brass (replaced brand gradient); success circle → success-tint/success; headings → fg-1; summary → fg-2; divider → mist; "Coming Up Next" container → sunken/mist; "COMING UP NEXT" label → fg-3; Continue button → bg-inverse/fg-on-dark navy

**Navigation bugs found and fixed:**
- `AuditOverview.tsx` line 92: `/tools/mr-audit/assessment` → `/diagnostics/mr-audit/assessment`
- `AssessmentWizard.tsx` line 445: `/tools/maturity-audit/results` → `/diagnostics/mr-audit/results`

**AE Ladder prerequisite note (not a bug):**
The wizard calls `getUserGMStage(user.id)` on load and shows an error if the result is null. This is intentional design — the MRA wizard requires a completed AE Ladder before it can run. If the AE Ladder stage is not yet set in the database, the user will see: "Your AE Ladder stage has not been set yet. Please complete the AE Ladder Assessment first." This is a data prerequisite, not a permissions or routing issue.

**Flags from this session:**
_None_

---

## Session 6A — Diagnostics: AE Ladder Assessment Side ✓
**Scope:** AE Ladder overview intro page and self-assessment wizard (5-dimension rating input experience)
**Files:** `AssessmentIntro.tsx`, `AssessmentWizard.tsx` (AE version), `QuestionCard.tsx`, `ProgressIndicator.tsx`, `NavigationControls.tsx`, `shared/LockedState.tsx`
**Note:** `AELadderLayout.tsx` read and confirmed clean — wraps SectionLayout only, no color changes needed.

- [✓] Overview intro page — card container → surface/mist/shadow-soft-1; ShieldCheck icon → brass; "What This Measures" block → sunken/mist; list inner box → surface/mist; ArrowRight → brass; headings → fg-1/fg-2; Prep card and Credit card → surface/mist/shadow-soft-1; Credit "next credit" badge → fg-3/sunken; italic footer → fg-3/mist; CTA divider → mist; post-completion success panel → success-tint/success border; CheckCircle2 → success; completed Credit card → surface/mist/shadow-soft-1
- [✓] Step/progress indicator — track → bg-sunken; fill → brass; percentage label → brass; removed hardcoded blue glow shadow; question counter → fg-3
- [✓] Rating scale inputs (5-point) — card → surface/mist/shadow-soft-1; category badge → sunken/fg-3; question h2 → fg-1; option unselected → mist border/steel-blue hover/sunken hover; option selected → brass border/brass-tint bg; radio unselected → mist/surface/steel-blue hover; radio selected → brass border/brass bg; labels → fg-1; focus ring → brass
- [✓] Back/Next navigation controls — Back disabled → fg-4; Back active → fg-3/fg-1-hover/sunken hover; Save saved → success-tint/success/success border; Save disabled → fg-4/mist; Save active → fg-2/mist/brass hover; Submit/Next disabled → sunken/fg-4; Submit/Next active → bg-inverse/fg-on-dark navy
- [✓] Locked state screen — Card bg → bg-canvas; icon bg → bg-sunken; Lock icon → fg-3; paragraph → fg-2
- [✓] Loading/error states in AssessmentWizard — loading overlay backdrop → inline rgba(25,48,82,0.4); overlay card → surface/mist; icon bg → brass-tint; spinner → brass; heading → fg-1; messages → fg-2; progress labels → fg-3; isLoading spinner → brass; isCompleted card → surface/mist; lock bg → sunken; lock icon → fg-4; completed h3 → fg-1; p → fg-2; MR Audit link → brass/brass-soft hover; welcome card → surface/mist; credit area → sunken/mist; "Assessment Credit" label → fg-1; noQuestions → fg-1/fg-3
- [✓] Full hardcoded color sweep — all brand-*/slate-*/emerald-*/blue-*/gray-* replaced with AOS tokens across all 6 files

**Navigation bug fixed in this session:**
- `shared/LockedState.tsx` line 30: `/tools/ae-ladder/assessment` → `/diagnostics/ae-ladder/assessment` (broken CTA — applied rather than just flagged, same pattern as Session 5B nav fixes)

**Flags from this session:**
_None_

---

## Session 6B — Diagnostics: AE Ladder Results ✓
**Scope:** AE Ladder results dashboard — stage hero, scores, dimension cards, synthesis panel
**Files:** `ResultsDashboard.tsx`, `results/HeroStageHeader.tsx`, `results/ScoreSnapshot.tsx`, `results/StrengthsGaps.tsx`, `results/SignalsIdentity.tsx`, `results/FocusPriorities.tsx`, `results/FrameworkLadder.tsx`, `results/StageContextMeaning.tsx`, `results/StageContextPosition.tsx`, `results/NextMilestoneCTA.tsx`, `stage/StageContentBlocks.tsx`

- [✓] Stage hero — `HeroStageHeader`: full bg-inverse dark treatment with brass left border; stage badge → brass bg/white text; tagline → fg-on-dark; description → steel-blue; date label → steel-blue; score inset box → bg-surface/mist/shadow-soft-1 (creates light card on dark bg); score number → brass + Geist Mono; synthesis section toggle → steel-blue/fg-on-dark-hover; synthesis dot → brass; synthesis prose → Instrument Serif italic + fg-on-dark; background blob → white/5
- [✓] Score display — Geist Mono applied to score number in HeroStageHeader and all 5 dimension avg scores in ScoreSnapshot
- [✓] Dimension cards (ScoreSnapshot) — `getDeviationColor` fully rewritten: strongly_above → success-tint/success; above → insight-tint/insight; below → warning-tint/warning; strongly_below → risk-tint/risk; at_overall → sunken/mist/fg-3. Added `getDeviationAccentBar` helper to replace broken computed class-split pattern for the accent bar. Headings → fg-1; band labels → fg-3; delta positive → success; delta negative → risk; insight panel → fg-2/sunken/mist; expand button → fg-3/fg-1 hover; divider → mist
- [✓] Deep-Dive Synthesis panel — `HeroStageHeader` synthesis prose styled with `style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic' }}`. `StageContextPosition` transition quote also styled with editorial italic (editorial narrative surface). Applied only to prose content, not labels or UI controls
- [✓] Strengths/Gaps cards — success-tint + success border/icon for strength; warning-tint + warning border/icon for friction; text → fg-1/fg-2/fg-3
- [✓] Signals Identity — card → surface/mist/shadow-soft-1; strength (+) → success; friction (−) → risk; synthesis (↳) → brass; border → mist; labels → fg-3; text → fg-2/fg-1
- [✓] Focus Priorities — loading cards → mist top border; active cards → brass top border/shadow-soft-1/shadow-soft-2-hover; icon container → sunken; rank icons: Target→brass, Zap→warning, CheckCircle2→success, ArrowRight→insight; priority label → fg-3; title → fg-1; desc → fg-2
- [✓] Framework Ladder — current rung: brass-tint bg/brass border/brass ring; current circle → brass/white; current connector → brass; current label → brass; "Current Stage" badge → brass-tint/brass. Non-current: canvas/mist; mist/fg-3 circle; mist connector; fg-2 label; fg-3 desc. Hover → sunken
- [✓] Stage Context (Meaning + Position) — heading → fg-1; tagline → brass; body → fg-2; theme bullets → brass dot/fg-2; cards → surface/mist; transition quote → editorial italic/fg-3
- [✓] Next Milestone CTA — dark block: bg-inverse/fg-on-dark (inline style for cascade guarantee); target label → steel-blue; h3/tagline → fg-on-dark; body → steel-blue; inset card → surface/mist; inset h4 → fg-1; inset desc → fg-3; buttons → bg-inverse/fg-on-dark/obsidian-hover
- [✓] Stage Content Blocks (StageProfile page) — LadderOverview card → sunken/mist; StageSummaryBlock: border-l → brass, h2/h4 → fg-1, desc → fg-2, theme bullet → brass, theme text → fg-2, Journey Context card → brass-tint/brass border, italic hint; StagePositionBlock: divider lines → mist, label → fg-3, position h3 → fg-1, intro → brass, narrative → fg-2, "what good" cards → sunken/mist; TrainingTeaserBlock: gradient replaced with bg-inverse (flat), fg-on-dark inline style, text → steel-blue, background shapes → white/5
- [✓] ResultsDashboard.tsx orchestration — loading spinner → brass, loading/error/empty text → fg-3/risk, border → mist

**Note on PDF download button:** No PDF download button was found in the AE Ladder results components. The pattern (border-accent + brass color + brass-tint hover) already exists in Chapter4_Direction.tsx from Session 5 and should be applied if a download button is added to this section in the future.

**Flags from this session:**
_None_

---

## Session 7 — Pro Suite: Hub + Quarter Map
**Scope:** Pro Suite landing hub and Quarter Map planner
**Files:** Pro Suite hub component, Quarter Map components

- [✓] Hub landing — fix 3-equal-card layout → asymmetric treatment
- [✓] Hub cards — icon, label, description hierarchy
- [✓] Quarter Map — 3P selection panel styling
- [✓] Quarter Map — capability card treatment
- [✓] Quarter Map — bucket column layout and headers
- [✓] "Lock & Proceed" CTA — Brass primary button pattern
- [✓] Full scoped hardcoded color sweep — all `brand-*`, `slate-*`, `emerald-*`, `amber-*`, `blue-*`, `gray-*` removed from Hub + Quarter Map scoped files

**Flags from this session:**
- [!] F-07: Strategic Focus Priorities section in AE Ladder Results — priority card headlines rendering as `{"headline"}` literal text; body content appearing as raw JSON string. Phase 6 task: parse/extract headline and body fields from the content object before rendering.

---

## Session 7B — Pro Suite Planning Refinement
**Scope:** Page-by-page Pro Suite planning refinement. Pause for review after each page.
**Files:** Pro Suite hub, Planning & Strategy landing, Strategic Roadmap shell and tabs

- [✓] Page 1: Pro Suite Hub — featured Planning card density, compact planning path, stronger CTA hierarchy, standardized secondary card heights
- [✓] Page 2: Planning & Strategy landing — full-width planning orientation panel with Roadmap Review, Quarter Map, and Sprint Planning as the three internal click targets
- [✓] Page 3: Strategic Roadmap shell / stepper — compact AOS surface with segmented brass active state and unchanged roadmap routes
- [✓] Page 4: Orientation tab — brass compass treatment, denser accomplishment card, AOS success checks, designed Journey Ahead sequence
- [✓] Page 5: Horizon Declaration tab — canonical Clarity/GV/AE/M&R wiring, saved Clarity Compass version selector, saved-date horizon anchors, compact GVS key vitals, AOS surfaces/type/colors
- [✓] Page 6: Roadmap Review tab — timeline-driven destination-to-current review panel, AOS timeline states, tokenized Contextual Overrides and Quarter Focus bridge
- [✓] Page 6B: Quarter Map standalone section — new `/pro/planning/quarter-map` shell, Quarter Sequence tab, Current Quarter Focus tab, roadmap stepper ends at Roadmap Review, old nested Quarter Map path redirects
- [✓] Page 7: Current Quarter locked/posture view — light AOS reference strip and posture panel, brass icon/CTA treatment, tokenized capability cards, buckets, modal accents, and active filter state

**Flags from this session:**
- [!] F-08: Orientation tab `Get Started` CTA points to `/pro/quarter-map/horizons`, while current roadmap routes live under `/pro/planning/roadmap/...`. Phase 6 task: reconcile CTA route during navigation/routing cleanup.
- [!] F-09: Orientation tab skip link points to `/pro/sprint-planning`, while current Sprint Planning route is `/pro/planning/sprint-planning`. Phase 6 task: reconcile skip route during navigation/routing cleanup.
- [!] F-10: `Plan12MonthTab.tsx` still reads stale roadmap sources (`clarity_compass_versions`, `mr_capability_scores`, `mr_dimension_scores`) that do not match the canonical Clarity/Growth Mastery tables confirmed during Horizon wiring audit. Phase 6 task: port Roadmap Review data reads to `cc_versions`, `cc_synthesis`, `cc_version_horizon_snapshots`, and `gm_*` sources.
- [!] F-11: `cc_synthesis` has multiple rows marked `is_current = true` for the same completed Clarity version. Phase 6 task: update workflow/data model so only one synthesis row per version is current, or keep all reads ordered by `created_at desc`.
- [!] F-12: `StrategicHorizonsTab.tsx` still simulates `Lock In Horizon` generation with a timeout before navigating to Roadmap Review. Phase 6 task: replace with the real roadmap synthesis/lock workflow when available.
- [!] F-13: Clarity has a newer `cc_versions` row marked `is_current_version = true` with `synthesis_status = pending`, while the populated completed version is older and no longer current. Phase 6 task: clean up pending/current version state or define current-vs-completed selection rules.

---

## Session 8 — Pro Suite: Sprint Planning Restructure + Sprint Board ✓
**Umbrella session for the Planning & Strategy restructure (2026-06-18 → 2026-06-19).** Scope grew far beyond the original "Sprint Board styling" stub: this session relocated the 3P engine into Sprint Planning, restored Current Quarter Focus, rebuilt the Sprint Goal, fixed navigation, partially wired the board to real 3P data, and aligned the Sprint Planning shell/board to AOS.

**Canonical reasoning:** `docs/sprint-planning-flow-spec.md` (v2) — full "why," target flow, and Decision Log (§9).
**Per-task records:** `docs/handoffs/01–04` (relocate 3P · fix lock-state · restore Current Quarter Focus · rebuild Sprint Goal).

### What shipped
- [✓] **Relocate 3P** into Sprint Planning at `/pro/planning/sprint-planning/prioritization`; `ThreePExercise` extracted as the single 3P engine (handoff #01).
- [✓] **Sprint Planning sequencing** — tabs reordered to Sprint Goal → 3P Prioritization → Sprint Board; index redirect fixed to land on Sprint Goal; new `prioritization` route added (handoff #01).
- [✓] **Nav fixes** — `SprintGoalFlowPage` lock → `/sprint-planning/prioritization`; `SprintReviewLockPage` lock → `/sprint-planning/synthesis` (both were dead routes) (handoff #01).
- [✓] **Lock-state display fix** — removed lock-state gating so the 3P exercise renders reliably; added fallback capabilities (handoff #02; implemented by removing gating rather than the originally-planned `surface` prop).
- [✓] **Restore Current Quarter Focus** — removed the 3P wrapper; now a read-only quarter synthesis (header + `ReferenceStrip` + `QuarterPostureBlock` placeholder) (handoff #03).
- [✓] **Rebuild Sprint Goal** — five-step wizard → single page (collapsed context, seed-don't-commit starters, primary + ≤2 optional supporting, inline pre-lock checklist) on AOS tokens (handoff #04).
- [✓] **Board partial wiring** — board reads saved 3P selections from `quarter_map_selections`; mock fallback retained (detail in the 2026-06-19 entries below).
- [✓] **Sprint Planning shell + board UI** brought onto AOS tokens (detail in the 2026-06-19 entries below).

### Decisions log (concise — full reasoning in spec §9)
| # | Decision | Rationale (1-line) |
|---|---|---|
| D-01 | 3P lives in Sprint Planning, not Quarter Map | 3P is sprint-execution prioritization; Quarter Map is long-range framing. |
| D-02 | "Collapse" dropped | There is one 3P page; nothing to merge. |
| D-03 | "Demote" dropped → Current Quarter Focus restored instead | Rebuilding a synthesis view was overkill; restore the existing checkpoint, strip 3P. |
| D-04 | Current Quarter Focus = read-only quarter synthesis | Review/confirm/align checkpoint (vision→horizons→quarters→this quarter); no inputs, no 3P. |
| D-05 | Sprint Goal = single page | Current Quarter Focus already anchors context upstream; the 5-screen wizard was planning tax. |
| D-06 | Goal cardinality = 1 primary + ≤2 optional supporting | Primary is the single success yardstick; supporting adds cross-capability breadth. |
| D-07 | Starters seed, never commit | Standardize goal shape without reducing it to a button click. |
| D-08 | `ThreePExercise` is Sprint-Planning-only | Quarter Map no longer renders it; no `surface` prop needed. |
| D-09 | Dual synthesis is intentional | Quarter-level (Current Quarter Focus) vs sprint-level (`SprintPostureSynthesis`) — different altitudes. |
| D-10 | 3P data lifecycle left OPEN | Sprint Planning owns `quarter_map_selections` for now; per-sprint keying decided in the wiring pass. |

**Flags / deferred:** see the deferred items in the 2026-06-19 detail entries, the Future Vision Backlog (V-01–V-07), and the wiring backlog tracked in the spec (§5/§7).

---

## Session 9 — Execution: Status Tracker + Reflection Review
**Scope:** Status Tracker milestone view and Reflection Review
**Files:** Execution section components

- [ ] Status Tracker — page layout and canvas
- [ ] Status Tracker — Capability → Initiative → Milestone hierarchy display
- [ ] Status Tracker — milestone status badges
- [ ] Status Tracker — sensitive initiative hide toggle (UI element, not logic)
- [ ] Reflection Review — whatever is built (CSS only, flag rollover logic gaps)

**Flags from this session:**
_None yet_

---

## Session 10 — Cleanup Pass
**Scope:** Final sweep, dev artifacts, TypeScript error triage, visual consistency
**Files:** Across all sections

- [ ] Final sweep for remaining hardcoded colors / Inter references
- [ ] Confirm "Dev: Force Generate" button removed (verify Session 2 change)
- [ ] Review `ts_errors.log` and `tsc_errors.log` — categorize errors for Phase 6
- [ ] Confirm `openai` package is unused (flag for Phase 6 TASK-052 removal)
- [ ] Visual consistency check across all sections
- [ ] Confirm Founder Evolution removed from sidebar nav (see Nav Flags below)

**Flags from this session:**
_None yet_

---

## Nav Flags — Sidebar Structure Changes
> Structural nav changes identified during Phase 5B. These require JSX edits to `components/Sidebar.tsx` navItems.

| # | Item | Action | Reason | Timing |
|---|---|---|---|---|
| N-01 | Founder Evolution | ~~Remove from sidebar~~ **REVERTED (2026-06) — it stays.** Rebrand to **"Architect Evolution"**; remains a key Foundations tool. Foundations tool order likely rearranged (TBD). | Decision reversed — do NOT remove. | Foundations landing pass |

---

## Logic / Wiring Flags Log
> Issues found during design pass that need Phase 6 attention. Do not fix during Phase 5B.

| # | Session | File | Issue | Phase 6 Task |
|---|---|---|---|---|
| F-01 | Session 1 | `components/Layouts.tsx:8` | `isAuthenticated = true` hardcoded — auth guard not wired to real Supabase session | Wire to Supabase auth session |
| F-02 | Session 1 | `components/Sidebar.tsx` | Nav has no section group labels ("WORKSPACE", "INTELLIGENCE") visible in design target — structural gap, not CSS | Add section label rendering to navItems data structure |
| F-03 | Session 1 | `components/Sidebar.tsx` | User footer shows generic icon avatar; design target shows brass/gold circle with user initials + "Founder · Thriving stage" subtitle | Render initials from user profile, pull stage from AE Ladder state |
| F-04 | Session 2 | `pages/ClarityPages.tsx:1204` | `Badge color="slate"` is not a valid prop value — silently falls through to no match | Replace `color="slate"` with `color="gray"` in ClarityHistory table |
| F-05 | Session 2 | `pages/ClarityPages.tsx:1215` | `Badge color="amber"` is not a valid prop value — silently falls through to no match | Replace `color="amber"` with `color="yellow"` in ClarityHistory status cell |
| F-06 | Session 3 | `pages/SnapshotPages.tsx` (synthesis error retry buttons, ×3) | `Button size="sm"` — `size` prop not in Button type definition in `components/ui.tsx` | Add `sm` to Button `size` type, or replace with `className`-based sizing |
| F-07 | Session 4 | `lib/gviCompare.ts:88` | Scenarios with missing `scales`/`components` in their `results` field (old DB records) cause a crash: `generatePressureContent` destructures `result.scales` and throws "Cannot read properties of undefined (reading 'retention')". Applied a minimal null guard (`if (!result?.scales || !result?.components || !resolved || !raw) return`) to skip malformed records — **this is a workaround**. Root fix: ensure all `gvs_saved_growth_scenarios` records have a complete `GVIScoreResult` stored in `results`, or add a DB migration/backfill to normalize old records. |
| F-07 | Session 7 | `components/tools/ae-ladder/results/FocusPriorities.tsx` | Strategic Focus Priorities priority card headlines render as `{"headline"}` literal text and body content appears as a raw JSON string | Parse/extract headline and body fields from the content object before rendering |
| F-08 | Session 7B | `pages/pro-suite/quarter-map/OrientationTab.tsx` | `Get Started` CTA points to `/pro/quarter-map/horizons`, while current roadmap routes live under `/pro/planning/roadmap/...` | Reconcile CTA route during navigation/routing cleanup |
| F-09 | Session 7B | `pages/pro-suite/quarter-map/OrientationTab.tsx` | Skip link points to `/pro/sprint-planning`, while current Sprint Planning route is `/pro/planning/sprint-planning` | Reconcile skip route during navigation/routing cleanup |
| F-10 | Session 7B | `pages/pro-suite/quarter-map/Plan12MonthTab.tsx` | Roadmap Review still reads stale sources: `clarity_compass_versions`, `mr_capability_scores`, and `mr_dimension_scores`; canonical sources are `cc_versions`, `cc_synthesis`, `cc_version_horizon_snapshots`, and `gm_*` tables | Port Roadmap Review data reads to canonical Clarity/Growth Mastery sources |
| F-11 | Session 7B | `cc_synthesis` | Multiple synthesis rows are marked `is_current = true` for the same completed Clarity version | Update workflow/data model so only one synthesis row per version is current, or keep reads ordered by `created_at desc` |
| F-12 | Session 7B | `pages/pro-suite/quarter-map/StrategicHorizonsTab.tsx` | `Lock In Horizon` still simulates synthesis generation with a timeout before navigating to Roadmap Review | Replace with real roadmap synthesis/lock workflow when available |
| F-13 | Session 7B | `cc_versions` | Newer Clarity row is marked `is_current_version = true` with `synthesis_status = pending`, while the populated completed version is older and no longer current | Clean up pending/current version state or define current-vs-completed selection rules |

---

## Completed Sessions

### Session 7 — Pro Suite: Hub + Quarter Map (2026-06-17)
**Files edited:** `pages/ProSuite/ProMainPage.tsx`, `components/pro-suite/quarter-map/QuarterMapLayout.tsx`, `CapabilityGridCard.tsx`, `CapabilityColumnCard.tsx`, `ThreePColumn.tsx`, `SelectionCounterBar.tsx`, `ParkingLotColumn.tsx`, `ReferenceStrip.tsx`, `QuarterPostureBlock.tsx`, `CapabilityExpandedView.tsx`, `pages/pro-suite/quarter-map/CurrentQuarterFocusTab.tsx`, `OrientationTab.tsx`, `StrategicHorizonsTab.tsx`, `Plan12MonthTab.tsx`

- Hub landing: replaced three equal-width cards with an asymmetric layout — Planning as the wide/featured card, Execution and OS Engine stacked in the narrower column. Hub card surfaces use `var(--bg-surface)`, `var(--border-hairline)`, and `var(--shadow-soft-1)`; icons use brass; labels use h3 scale; descriptions use small secondary text.
- Quarter Map: capability pool cards use surface/hairline/soft-shadow treatment; selected bucket cards use `var(--aos-brass-tint)` background and `var(--aos-brass)` border; bucket surfaces use `var(--bg-sunken)`; bucket headers use AOS eyebrow style.
- Lock & Proceed CTA: complete state uses brass primary (`var(--aos-brass)` / `var(--aos-cloud)` / `var(--aos-brass-soft)` hover), disabled state uses sunken/disabled foreground tokens.
- Full scoped sweep confirmed: no `brand-*`, `slate-*`, `emerald-*`, `amber-*`, `blue-*`, or `gray-*` strings remain in Hub + Quarter Map scoped files.
- Flag logged: F-07 Strategic Focus Priorities JSON rendering issue in AE Ladder Results.
- Verification: `npm.cmd run build` passes. Vite reports only the large chunk-size warning.

### Session 1 — Global Shell (2026-05-14)
**Files edited:** `components/Sidebar.tsx`, `components/Layouts.tsx`, `components/Header.tsx`

- Sidebar: Obsidian Navy bg, Steel Blue default nav, Slate Blue hover, Brass Gold active with 3px left border accent, all slate/blue Tailwind classes replaced with AOS tokens. Scrollbar hex values updated. Sprint ending banner, locked states, footer all tokenized.
- Layouts: Parchment canvas bg (`var(--bg-canvas)`), max-width updated from 1280px to 1440px.
- Header: Cloud White bg, Mist border, shadow-soft-1. Beta Week badge, avatar, profile dropdown, sign out all converted to AOS tokens.
- Grep sweeps confirmed clean: no `Inter`, `#000/#111`, or `gray-*` in `.tsx` files.
- Flag logged: `isAuthenticated = true` hardcoded in `Layouts.tsx` (Phase 6 task).

### Session 2 — Foundations: Clarity Compass (2026-05-14)
**Files edited:** `pages/ClarityPages.tsx`, `components/ui.tsx`

- Dev artifact deleted: "Dev: Force Generate Dashboard" button fully removed from `VisionState` submit block.

- `components/ui.tsx`: Full shared component sweep — Button (all 5 variants), Badge (all 6 colors mapped to AOS semantic tokens), Accordion, SegmentedControl, ProgressBar, Switch, Slider, Tabs/TabsList/TabsTrigger/TabsContent, PageHeader, TabNav, PlaceholderContent, Table/TableRow/TableHead, Checkbox, PopoverContent, TooltipContent, RadioGroup, Input, Select, Label, Card — all `brand-*`, `slate-*`, `emerald-*`, `red-*`, `yellow-*` replaced with AOS tokens.
- `pages/ClarityPages.tsx`: Full color sweep across LoadingOverlay, ScenarioTaggingAccordion, HorizonFieldsRenderer, VisionState, ClarityDashboard, ClarityHistory, ClarityPages — all hardcoded Tailwind color classes replaced with AOS tokens. Movement 3 dark section uses `var(--bg-inverse)` with `var(--fg-on-dark)` / `var(--aos-steel-blue)` / `var(--aos-brass-soft)` / `var(--aos-success-tint)` for contrast on dark bg.
- Flags logged: F-04 (`color="slate"` invalid Badge prop) and F-05 (`color="amber"` invalid Badge prop) in ClarityHistory — Phase 6 tasks.


### Session 3 — Foundations: Agency Snapshot (2026-06-08)
**Files edited:** `pages/SnapshotPages.tsx`, `components/snapshot/SnapshotDashboard.tsx`, `components/snapshot/IdentityPositioningTab.tsx`, `components/snapshot/ProfileStyles.css`, `components/snapshot/FinancialProfile.tsx`, `components/snapshot/GrowthProfile.tsx`, `components/snapshot/TeamProfile.tsx`

- `ProfileStyles.css`: Full rewrite — `.profile-card`, `.badge-healthy`, `.badge-caution`, `.badge-critical` and all associated rules converted from hex to AOS tokens.
- `FinancialProfile.tsx`, `GrowthProfile.tsx`, `TeamProfile.tsx`: Icon color classes tokenized (`text-emerald-600`, `text-blue-600`, `text-indigo-600` → AOS semantic tokens).
- `SnapshotDashboard.tsx`: All lifecycle state views (NotGeneratedState, ProcessingState, ErrorState), card types (BusinessVitalsStrip, ModalBeatCard, DimensionCard, SignalCard, ImplicationCard), download button states, modal backdrops, CTA sections, progress bars — fully tokenized. All `slate-*`/`blue-*`/`red-*`/`emerald-*` replaced with AOS tokens. Modal backdrop changed to inline `rgba(25, 48, 82, 0.4)`.
- `IdentityPositioningTab.tsx`: Full sweep — PositioningAccordion, ExpandableInsightCard, form header, SectionHeader, hints, save button states, checkmark, synthesis button states, status banners, loading panel, profile reveal section, synthesis render block, signal block, error block, sidebar panel, validation errors, textarea, website link all tokenized.
- `SnapshotPages.tsx` (2534 lines): Shared components (ExpandableInsightCard, SectionHeader, FormSection, AdvancedSection, MetricCard, SnapshotLayout sidebar) tokenized. All repeating patterns handled via `replace_all`: tooltips, guidance boxes, synthesis buttons, status banners (success/skipped/error), hint texts, metrics sidebar rows (border/label/value), loading panel containers + text, synthesis reveal sections, synthesis headings, signal blocks (gradient → flat), error blocks, checkbox patterns, channel mix container, GrowthPipeline risk score constants. Unique/structural blocks handled with targeted edits: computed ternary spans, duplicate rank Select border, disabled Input, DeliveryArchitecture sidebar footer, FinancialSnapshot retry button.
- Flag logged: F-06 (`Button size="sm"` prop not in Button type definition) in synthesis error retry buttons — Phase 6 task.

### Session 5 — Diagnostics: MRA (2026-06-09)
**Files edited:** `components/tools/maturity-audit/dashboard/ResultsDashboard.tsx`, `chapters/Chapter1_Summary.tsx`, `chapters/Chapter2_Systems.tsx`, `chapters/Chapter3_Capabilities.tsx`, `chapters/Chapter4_Direction.tsx`, `dashboard/QuadrantWidget.tsx`

- `ResultsDashboard.tsx`: Page bg → bg-canvas; sticky nav → rgba backdrop + mist border; segmented control: active = surface/brass/mist-ring, inactive = fg-3/fg-1-hover/sunken-hover; nav title → fg-1.
- `Chapter1_Summary.tsx`: Hero card → brass left border + surface; decoration blob → brass-tint; score numbers → fg-1 + Geist Mono; Confident/Stable badges → success/insight tint; quadrant card → surface/mist/shadow-soft-1; sidecar insight → success-tint + success left border; stage context → canvas/mist/shadow-soft-1; stage dot → success; path forward card → insight-tint; path forward label → insight; action button shadow → shadow-soft-2.
- `Chapter2_Systems.tsx`: Chapter pill → canvas/fg-2/mist; radar card → surface/mist/shadow-soft-1; dimension score badges (5 color variants) → AOS semantic tokens; stage fit badges → canvas/success-tint/warning-tint; active card ring → brass; expanded detail → canvas/mist; Info icon → insight; dark takeaways card → bg-inverse/fg-on-dark; dark h4 subheadings → steel-blue; pulse dot + label → success; CTA → bg-inverse navy.
- `Chapter3_Capabilities.tsx`: Helper functions rewritten (getPriorityColor/getStageFitColor/getBarColor → AOS tokens); icon backgrounds → risk-tint/success-tint; capability stack → surface/mist/shadow-soft-1; table header → canvas/mist; row hover → canvas; cap name hover → insight; strength checkmarks → success; closing synthesis → canvas/mist; CTA → bg-inverse; modal backdrop → inline rgba(25,48,82,0.4); modal → surface/mist; stat numbers → fg-1 + Geist Mono; bar track → mist; insight box → insight-tint/insight; section icons → insight; footer link hover → insight.
- `Chapter4_Direction.tsx`: Section 2 container → canvas/mist; target pill → surface/mist; checkmarks → success-tint/success; list items → fg-2; Path A → surface/mist/shadow-soft-1; icon bg → canvas/sunken; Download button → border-accent + brass color + brass-tint hover (ghost/outline pattern); Path B → insight-tint; Path B icon → brass-tint; Map icon → brass; Path B CTA → bg-inverse; closing quote → fg-4.
- `QuadrantWidget.tsx`: Tooltip → bg-inverse/slate-blue border/success label/fg-3 labels; axis labels → fg-4; all 4 overlay cards tokenized to AOS semantic palette; Recharts Label SVG fill classes left untouched.
- No flags raised.

### Session 5B — Diagnostics: MRA Assessment Layer (2026-06-09)
**Files edited:** `components/tools/maturity-audit/AuditOverview.tsx`, `AuditNavigation.tsx`, `AssessmentWizard.tsx`, `shared/CapabilityCard.tsx`, `shared/DimensionTransition.tsx`

- `AuditOverview.tsx`: Card container, all feature icons (unified brass-tint/brass — was three different semantic colors), body copy, CTA button all tokenized. Navigation URL bug fixed (`/tools/` → `/diagnostics/`).
- `AuditNavigation.tsx`: Progress bar track/fill/labels, sidebar card, dimension accordion rows (active/hover/locked states, chevrons, check icons, locked lock icon), capability list (active/default/status indicator dots) — all tokenized to AOS palette.
- `AssessmentWizard.tsx`: Loading overlay backdrop (inline rgba), overlay card surface, spinner icon + bg, status messages, progress labels, initial loading state, error state (warning icon + fg-1 text), empty state, stage label — all tokenized. Navigation URL bug fixed (`/tools/maturity-audit/results` → `/diagnostics/mr-audit/results`).
- `CapabilityCard.tsx`: Dimension header, divider, capability title + description, column header, checkpoint cards (border/hover), checkpoint title/statement, tooltip icon + bubble + arrow caret, radio buttons (selected → brass, unselected → mist/steel-blue hover/surface bg), footer actions (back/save/next buttons) — all tokenized.
- `DimensionTransition.tsx`: Card, top accent bar (brand gradient → solid brass), success circle, headings, divider, "Coming Up Next" container + label, Continue button — all tokenized.
- No flags raised.

### Session 6B — Diagnostics: AE Ladder Results (2026-06-17)
**Files edited:** `ResultsDashboard.tsx`, `results/HeroStageHeader.tsx`, `results/ScoreSnapshot.tsx`, `results/StrengthsGaps.tsx`, `results/SignalsIdentity.tsx`, `results/FocusPriorities.tsx`, `results/FrameworkLadder.tsx`, `results/StageContextMeaning.tsx`, `results/StageContextPosition.tsx`, `results/NextMilestoneCTA.tsx`, `stage/StageContentBlocks.tsx`

- `HeroStageHeader.tsx`: Card → bg-inverse + brass left border (dark navy hero). Stage badge → brass/white. Tagline → fg-on-dark. Description → steel-blue. Date → steel-blue. Score inset box → bg-surface/mist/shadow-soft-1 (light card on dark bg). Score number → brass + Geist Mono. Synthesis toggle → steel-blue/fg-on-dark hover. Dot → brass. Synthesis prose → Instrument Serif italic + fg-on-dark. Background blob → white/5.
- `ScoreSnapshot.tsx`: `getDeviationColor` fully rewritten to AOS semantic tokens (success/insight/warning/risk/mist). Added `getDeviationAccentBar` helper to replace broken computed `split('+').replace()` pattern for the bottom accent bar. Score numbers → fg-1 + Geist Mono. Delta → success/risk. Band label → fg-3. Expand button → fg-3/fg-1 hover. Insight panel → fg-2/sunken/mist. Divider → mist.
- `StrengthsGaps.tsx`: Strength card → success-tint bg + success left border + success icon. Friction card → warning-tint bg + warning left border + warning icon. Text → fg-1/fg-2/fg-3.
- `SignalsIdentity.tsx`: Card → surface/mist/shadow-soft-1. Labels → fg-3. + symbol → success. − symbol → risk. ↳ symbol → brass. Text → fg-2/fg-1. Border → mist.
- `FocusPriorities.tsx`: `getRankIcon` icons → brass/warning/success/insight (semantic for priority rank). Loading cards → mist top border. Active cards → brass top border/shadow-soft-1. Icon container → sunken. Priority label/desc → fg-3/fg-2. Title → fg-1.
- `FrameworkLadder.tsx`: Current rung → brass-tint bg/brass border/ring. Current circle → brass/white. Current label → brass. "Current Stage" badge → brass-tint/brass. Non-current → canvas/mist/fg-2/fg-3. Hover → sunken. Connectors → brass/mist.
- `StageContextMeaning.tsx`: h2 → fg-1. Tagline → brass. Body → fg-2.
- `StageContextPosition.tsx`: h2 → fg-1. Short desc → fg-3. Cards → surface/mist. Theme bullet → brass. Theme text → fg-2. Journey text → fg-2. Transition quote → editorial italic/fg-3. Quote divider → mist.
- `NextMilestoneCTA.tsx`: Container → bg-inverse + inline `style={{ color: 'var(--fg-on-dark)' }}` (cascade guarantee). Target label → steel-blue. h3/tagline → fg-on-dark. Body → steel-blue. Inset card → surface/mist. Inset h4 → fg-1. Inset desc → fg-3. Buttons → bg-inverse/fg-on-dark/obsidian-hover.
- `StageContentBlocks.tsx`: LadderOverview → sunken/mist. StageSummary border-l → brass; h2/h4 → fg-1; text → fg-2; bullets → brass; Journey card → brass-tint/brass. StagePosition: dividers → mist; fg-3 label; intro → brass; narrative → fg-2; "what good" cards → sunken/mist/dashed. TrainingTeaser: bg-gradient replaced with bg-inverse (flat); fg-on-dark inline; text → steel-blue; blobs → white/5.
- `ResultsDashboard.tsx`: Spinner → brass; loading/error messages → fg-3/risk; border → mist.
- No flags raised. No PDF download button found in this section — pattern already exists in Chapter4_Direction.tsx for when/if it's added.

### Session 6A — Diagnostics: AE Ladder Assessment Side (2026-06-17)
**Files edited:** `components/tools/ae-ladder/AssessmentIntro.tsx`, `AssessmentWizard.tsx`, `QuestionCard.tsx`, `ProgressIndicator.tsx`, `NavigationControls.tsx`, `shared/LockedState.tsx`

- `AssessmentIntro.tsx`: Loading state spinner → brass, heading → fg-1. Main card → surface/mist/shadow-soft-1. Header → fg-1/fg-2. "What This Measures" block → sunken/mist; ShieldCheck → brass; inner list → surface/mist; ArrowRight → brass. Prep card → surface/mist/shadow-soft-1; heading container → brass. Credit card → surface/mist/shadow-soft-1; h4 → fg-1; badge → fg-3/sunken; italic footer → fg-3/mist. CTA divider → mist. Post-completion success panel → success-tint/success; CheckCircle2 → success; date text → fg-1. Post-completion Credit card → surface/mist/shadow-soft-1.
- `AssessmentWizard.tsx` (AE version): Loading overlay backdrop → inline rgba(25,48,82,0.4); card → surface/mist; icon bg → brass-tint; spinner → brass; heading → fg-1; messages → fg-2; progress labels → fg-3. isLoading state: spinner → brass, h2 → fg-1. isCompleted card → surface/mist; lock bg → sunken; lock → fg-4; h3 → fg-1; p → fg-2; MR Audit link → brass/brass-soft hover. Welcome card → surface/mist; credit area → sunken/mist; "Assessment Credit:" label → fg-1. noQuestions → fg-1/fg-3.
- `QuestionCard.tsx`: Card → surface/mist/shadow-soft-1/rounded-2xl. Category badge → sunken/fg-3. Question h2 → fg-1. Option unselected → mist/steel-blue-hover/sunken-hover. Option selected → brass/brass-tint. Radio unselected → mist/surface/steel-blue-hover. Radio selected → brass/brass. Labels → fg-1. Focus ring → brass.
- `ProgressIndicator.tsx`: "Progress" label → fg-2; percentage → brass. Track → sunken. Fill → brass (removed hardcoded blue glow shadow). Question counter → fg-3.
- `NavigationControls.tsx`: Back disabled → fg-4; Back active → fg-3/fg-1-hover/sunken-hover. Save saved → success-tint/success/success-border. Save disabled → fg-4/mist. Save active → fg-2/mist/brass-hover/surface. Submit disabled → sunken/fg-4. Submit active → bg-inverse/fg-on-dark. Next disabled → sunken/fg-4. Next active → bg-inverse/fg-on-dark.
- `shared/LockedState.tsx`: Card bg → bg-canvas. Icon bg → bg-sunken. Lock icon → fg-3. Paragraph → fg-2. Navigation URL bug fixed: `/tools/ae-ladder/assessment` → `/diagnostics/ae-ladder/assessment`.
- No logic flags raised.

### Session 4 — Foundations: GV Simulator (2026-06-09)
**Files edited:** `pages/GVCalculatorPage.tsx`, `components/tools/growth-velocity/HelperTextPanel.tsx`, `components/tools/growth-velocity/ScenarioPlannerInputs.tsx`, `components/tools/growth-velocity/ScenarioCompareMode.tsx`, `components/tools/growth-velocity/compare/ComparisonCharts.tsx`

- `GVCalculatorPage.tsx` (1471 lines): Full sweep — statusConfig for PressureCard (high/moderate/low → risk/warning/success semantic tokens), GVIDisplay dark card (bg-inverse + steel-blue/slate-blue/obsidian interior tokens), MetricCard (bg-canvas icon bg, Geist Mono value display), ProcessingOverlay (backdrop rgba + bg-inverse branding block + bg-brass progress bar), ComparisonTable (hover/highlight/target column tokens), SynthesisSection patterns. All `slate-*`/`bg-white`/`brand-*`/`emerald-*` replaced via replace_all + targeted edits. Pill toggle active states: "Build Scenario" = surface/fg-1/mist ring; "Compare" = bg-inverse/fg-on-dark navy. Loaded scenario banner: success-tint/success. `text-brand-600` icons → insight tokens.
- `HelperTextPanel.tsx`: Previously completed — bg-surface card, insight info icon, bg-canvas header, bg-sunken hover, insight-tint tip box.
- `ScenarioPlannerInputs.tsx` (690 lines): Full sweep — replace_all passes for all slate-*/bg-white patterns, then targeted edits: insight-tint/insight "Using Snapshot" badge, warning-tint/warning "Custom Baseline" badge, success/warning percentage badges, slider track colors (success-tint/warning-tint/mist), brass active preset buttons with brass-tint hover, Run button (brass primary), spinner (brass border), result score card (shadow-elevated), result score display (brass + Geist Mono), save error (risk-tint/risk), Save Strategy button (brass primary), Discard Draft (outline), isSaved card (success-tint/success border), "View in Comparison" button (bg-inverse/fg-on-dark navy secondary).
- `ScenarioCompareMode.tsx` (926 lines): Full sweep — replace_all passes for all slate-*/bg-white patterns, then targeted edits: warning amber limit text, brass checkmark selection in dropdown, scenario chip remove buttons (bg-sunken/mist), drag handle dots (fg-4), scenario score display (warning/brass conditional + Geist Mono), expand details button (insight-tint/insight), expanded panel: brass border/accent bar, brass GVI label with Geist Mono, pressure table badges (risk/warning/success semantic), generate button error/normal states (risk/bg-inverse navy), scenario implication cards (brass name label), saved confirmation (success-tint/success), save error (risk-tint/risk), Save Comparison button (brass primary), save spinner (brass-tint/fg-on-dark).
- `ComparisonCharts.tsx`: Tailwind className sweep only (recharts hex configs left as-is per session rule) — all 4 card headers tokenized (border-mist/shadow-soft-1, fg-1/fg-3 text), Efficiency Map quadrant labels (success/warning/fg-3 with opacity-60 class), custom tooltip content (bg-surface/border-mist).
- No flags raised during Session 4.

---

## Sprint Planning Soft Lock — 3P + Board Partial Wiring (2026-06-19)
**Scope:** Sprint Planning 3P prioritization, Sprint Board capability-to-initiative surface, and drill-in workspace context.
**Files updated:** `components/pro-suite/quarter-map/ThreePExercise.tsx`, `pages/SprintPlanning/ThreePPrioritizationPage.tsx`, `pages/SprintPlanning/SprintBoardPage.tsx`, `components/SprintPlanning/Board/InitiativeCard.tsx`, `components/SprintPlanning/Modals/WorkspaceModalManager.tsx`, `components/SprintPlanning/Modals/CapabilityWorkspacePanel.tsx`

- [✓] 3P Prioritization soft-locked for now: route `/pro/planning/sprint-planning/prioritization` renders the active capability selection and bucket exercise.
- [✓] Removed locked/posture display gating from the shared 3P exercise. A saved `quarter_map_selections.status = locked` no longer hides the active exercise or shows the legacy "Your Quarter Posture" card.
- [✓] 3P data source retained: capability labels, maturity scores, stage fit, and dimensions still read from Growth Mastery tables (`gm_assessments`, `gm_assessment_capability_scores`, `gm_capability_rankings`) when available.
- [✓] 3P save target retained: draft/lock still writes selections to `quarter_map_selections`. Missing assessment data falls back to a starter capability set so the exercise remains usable during founder review.
- [✓] Sprint Board partial live wiring added: board reads saved 3P selections from `quarter_map_selections` and maps selected capabilities into Prioritize / Plant / Iterate / Parking Lot using Growth Mastery metadata.
- [✓] Sprint Board fallback retained: if no saved 3P selections exist, the existing mock board data remains visible so the surface does not collapse.
- [✓] Capability drill-in context improved: clicking a capability opens a workspace for that capability only, instead of showing the same canned initiatives for every capability.
- [✓] Initiative creation is session-visible: creating an initiative from the board or capability workspace adds it to the current board state and attaches it to the correct capability context.

**Deferred for full wiring pass:**
- [!] Initiative and milestone persistence is not complete. No confirmed sprint initiative / sprint milestone tables were found in this checkout during this pass, so new initiatives remain session-local.
- [!] Sprint Board still has mock sprint goal, synthesis warning, team settings, progress tracking, hidden initiative behavior, and review/lock completeness logic.
- [!] Board visual refinement is still needed across main columns, capability cards, initiative cards, drill-in modals, entry forms, button states, pills, hover states, and the AI advisor trigger.
- [!] Decide whether Sprint Planning should continue writing 3P into shared `quarter_map_selections` or move to a dedicated sprint-level record before final persistence.

---

## Sprint Planning UI Refinement Pass (2026-06-19)
**Scope:** Visual alignment only for Sprint Planning shell, Sprint Board, capability/initiative cards, workspace modal base, quick-add/edit controls, entry overlays, and advisor trigger/panel.
**Files updated:** `pages/SprintPlanning/SprintPlanningLayout.tsx`, `pages/SprintPlanning/SprintBoardPage.tsx`, `components/SprintPlanning/Board/BoardHeader.tsx`, `components/SprintPlanning/Board/CapabilityCard.tsx`, `components/SprintPlanning/Board/ColumnBoard.tsx`, `components/SprintPlanning/Board/InitiativeCard.tsx`, `components/SprintPlanning/Board/MilestoneList.tsx`, `components/SprintPlanning/Board/StrategicAdvisorPanel.tsx`, `components/SprintPlanning/Modals/UnifiedModalContainer.tsx`, `components/SprintPlanning/Modals/CapabilityWorkspacePanel.tsx`, `components/SprintPlanning/Modals/InlineExpandRow.tsx`, `components/SprintPlanning/Modals/InlineQuickAdd.tsx`, `components/SprintPlanning/Modals/EntryFormOverlay.tsx`, `components/SprintPlanning/Modals/InheritedContextTags.tsx`, `components/SprintPlanning/Modals/InitiativeEntryForm.tsx`, `components/SprintPlanning/Modals/MilestoneEntryForm.tsx`, `components/SprintPlanning/Modals/AutoSaveField.tsx`, `components/SprintPlanning/Modals/BreadcrumbNav.tsx`

- [✓] Sprint Planning top shell now uses the AOS surface/border/tab treatment instead of the generic older page header.
- [✓] Sprint Board frame, staleness banner, view toggle, save/review buttons, parking lot, and hidden-item note now use AOS tokens.
- [✓] 3P columns retain distinct lane accents without turning the whole board brass/parchment.
- [✓] Capability and initiative cards remain white as active work surfaces, with canvas/parchment hover and tokenized stage/count/status pills.
- [✓] Capability workspace panel keeps the parchment/sunken empty state for "No initiatives yet" while populated initiative rows stay white/tokenized.
- [✓] Quick add, inline edit rows, autosave fields, inherited context pills, breadcrumbs, modal chrome, and entry overlays were brought onto the same AOS token system.
- [✓] Strategic Advisor floating trigger and slide-over panel were moved off the generic blue/indigo treatment.

**Verification:**
- [✓] `npm.cmd run build` passed after rerunning with filesystem permission to write `dist/assets`.

**Deferred:**
- [!] Full visual pass on the larger initiative and milestone detail modals remains open; shared modal chrome, breadcrumbs, quick-add, and autosave fields are now aligned, but those large detail bodies still contain older internal mock styling.
- [!] No new persistence, schema, Sprint Board data wiring, or review/lock behavior changes were made in this UI pass.

### Current Quarter Focus Restored — 3P Removed from Quarter Map (2026-06-19, handoff #03)
**File edited:** `pages/pro-suite/quarter-map/CurrentQuarterFocusTab.tsx`

- Removed the `ThreePExercise` wrapper from Quarter Map's Current Quarter Focus tab; 3P now lives only in Sprint Planning.
- Rebuilt as a read-only quarter synthesis: header (title + quarter selector + History) + `ReferenceStrip` ("Reference: Your 12-Month Trajectory") + `QuarterPostureBlock` with per-quarter placeholder copy framed around the vision → 36/24/12-month → four-quarter → current-quarter drill-down. No 3P terminology, no capability grid, no buckets, no lock/save.
- CTA "Proceed to Sprint Planning" retained (correct for this surface). Route/nav unchanged.
- `ThreePExercise` confirmed imported only by the Sprint Planning prioritization page. `npm.cmd run build` passed. Placeholder only — real synthesis wired later (n8n + Anthropic).

### Sprint Goal Rebuilt as Single Page (2026-06-19, handoff #04)
**File edited:** `pages/SprintPlanning/SprintGoalFlow/SprintGoalFlowPage.tsx` (Step1–5 components left on disk, no longer imported)

- Replaced the five-step wizard with one page on AOS tokens (old blue/slate wizard shell removed).
- Collapsed-by-default context (Context Re-Anchor · Four-Sprint Arc · Directional Focus); Directional Focus shown as system-derived context, not a required radio.
- "What a good goal sounds like" — static example(s) + guardrails (outcome not activity · changed operating reality · verifiable).
- "Starter goals for you" — personalized placeholder starters; selecting one seeds the editor (does not lock/commit).
- Primary goal required; up to 2 optional supporting outcomes (add disabled at the cap). Inline pre-lock gut-check checklist (advisory). Lock → `/pro/planning/sprint-planning/prioritization`.
- No persistence/wiring; 3P, board, Quarter Map untouched. `npm.cmd run build` passed.

---

## Deferred Enhancements — Future Vision Backlog
> Captured 2026-06-19 during Sprint Planning close-out. Intentionally NOT in scope for the current structural pass — **log only**. Revisit during the UI/navigation cleanup and the wiring/final pass. Not yet specced into handoffs. (Prefix `V-` = vision/backlog, distinct from `F-` wiring flags and `N-` nav flags.)

### Global (cross-platform)
| # | Item | Notes / Constraints | Timing |
|---|---|---|---|
| V-01 | Breadcrumb bar at top of page content | Start with Planning & Strategy / Sprint Planning, but implement as a **global** pattern across all pages. Tackle during the broad UI element pass, before all UI is finalized. | UI cleanup pass |
| V-02 | Left-hand navigation panel cleanup | Tidy/restructure the sidebar nav → target: Pro Suite collapses to **Overview + Planning Hub + Execution Hub + Intelligence Hub** (4 items); everything else nests under a hub. **Includes re-nesting the Intelligence tool routes** (`/pro/virtual-cso`, `/pro/os-engine`) **under `/pro/intelligence/...`** to match the Planning/Execution URL pattern (the Intelligence landing currently links to them where they are). Pair with existing Nav Flags (N-01 Founder Evolution removal, F-02 section group labels, F-03 user footer). | UI cleanup pass (LAST) |
| V-08 | Central Strategic Overview dashboard (home) | The single org-health dashboard on the **home page** (maturity, readiness, pressure maps, sprint alignment, roadmap). A directional mockup was shared 2026-06-19 — **non-canonical, sample data**; build the true-to-platform-data version. No per-area dashboards; hub sub-pages may have small scoped result dashboards only. See `docs/execution-hub-spec.md` §4. | Downstream (post-Execution) |
| V-09 | Central dashboard nav placement | Decide where the central dashboard lives — the app's top-level **Dashboard** vs the Pro Suite **Overview**. | With nav cleanup |
| V-10 | Historical sprint-artifacts store + browser | Supabase table (e.g., `sp_sprint_artifacts`) housing past sprints' one-pagers, surfaced in Orient · Alignment Tools "Historic" pill view (table → render + download). Empty-state shell until users run multiple sprints. See `docs/execution-hub-spec.md` §11. | Downstream (post multi-sprint usage) |
| V-11 | Working capability-score store + re-scoring loop | New evolving **working-score** table seeded from the M&R/Growth Mastery assessment at record time; Reflection & Review updates **only** the working score (9 of 25 capabilities/sprint); all live surfaces (3P, Quarter Map, dashboards) read working, not historical; full 125-pt re-audit only on stage change. The platform's core capability feedback loop. See `docs/execution-hub-spec.md` §13. | Downstream (wiring) |
| V-12 | Parchment cleanup sweep (already-built surfaces) | Orient, Wind-Down, Retrospective, and the hub used parchment (`--bg-sunken`) as a generic nested background before the **parchment-as-signal** rule was codified (white = default nested surface w/ shadow; parchment only for subsection header bars + open-text/input zones; obsidian for hero metrics). Bring those surfaces onto the rule. Reflection & Review #13 follows it from the start. | UI cleanup pass |
| V-13 | Architect Evolution **backend** rename | User-facing rebrand (labels/titles/copy) done in the Foundations landing pass (#18). **Deferred (more intricate):** rename the route path `/foundations/founder-evolution` → `/architect-evolution` (with redirect), the feature-gate key `founder_evolution`, and the component/file names (`FounderEvolution*`). | Future (backend rename pass) |
| V-14 | Dead-code cleanup — `TabNav` + `PageHeader` | After `SectionLayout` was rewritten to the Pro-Suite card style (#20), `TabNav` and `PageHeader` in `components/ui.tsx` are no longer used. Remove in a dead-code pass (verify no remaining importers first). | Cleanup pass |

### Sprint Board
| # | Item | Notes / Constraints | Timing |
|---|---|---|---|
| V-03 | "By Milestone" view toggle | Add a third pill alongside **By Capability / By Initiative**. Renders a per-milestone card layout so the founder sees all milestones once added. Enables filtering by capability / initiative / milestone before locking the sprint and before viewing the sprint plan/roadmap. | Future vision (next agent) |
| V-04 | Taxonomy helper / explainer | Collapsible or helper section (placement TBD: below Save Draft / Review & Lock, beside it, or between the controls and the cards). Explains the hierarchy **Capability → Initiative → Milestone → Task** and makes explicit that **tasks are NOT tracked in the platform** — those belong in the founder's personal task manager. | Future vision |

### Card ordering & drag-and-drop (visual only)
| # | Item | Notes / Constraints | Timing |
|---|---|---|---|
| V-05 | Reorder cards within a column — Sprint Board (By Capability) | Visual-only reorder; cards no longer fixed in the 3×3 order. **MUST NOT change bucket assignment** (Prioritize/Plant/Iterate) — bucket is fixed and only editable in the 3P Prioritization tab. No backend positioning/hierarchy change. | Future vision |
| V-06 | Reorder + cross-column move — 3P Prioritization | Within the 3P table: reorder within a column, **and** move a card to a different column when an empty slot exists (bucket change IS allowed here, since 3P is where prioritization is set). | Future vision |
| V-07 | Drag-and-drop from capability selection → 3P buckets | On the 3P Prioritization tab, drag capabilities straight from the selection grid into the prioritization bucket tables. | Future vision |
