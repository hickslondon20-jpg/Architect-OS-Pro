# Content Provenance Manifest

> **Status:** Living document — started 2026-06-22 (wiring phase).
> **Purpose:** A page-by-page map of *where every piece of rendered content comes from*. For each tool we transcribe each page as if to markdown (H1/H2/H3, body, graphics, charts, inputs, buttons) and tag every element with its source type, origin, fetch, render rule, and current state. This is the content-level companion to `docs/execution-hub-audit-inventory.md` (which tracks routes/pages). The audit inventory says *where pages live*; this says *where each page's content comes from*.
> **Why:** Before we wire a page, we confirm the right Supabase tables/fields/relations exist and that nothing static-placeholder is silently standing in for something meant to be wired. The manifest is the front half of each tool's wiring pass and stays as the traceable record afterward.
> **Companions:** `docs/sprint-planning-flow-spec.md`, `docs/execution-hub-spec.md`, `docs/execution-hub-audit-inventory.md`, `UI-PROGRESS.md`, `DESIGN-GUIDE-QUICK.md`, `CLAUDE.md`.

---

## How to read / maintain this doc

We work **one tool at a time, in the order London sets.** For each tool:

1. Log the tool: a short summary + its pages, each with its **URL path/route**.
2. For each page, build a table that walks the page top-to-bottom as markdown, one row per content element.
3. London gives directional guidance per page; schema is verified **live against Supabase (MCP)**; wiring logic is talked through.
4. Gaps (placeholders, missing fields, decisions) are noted and roll up to the **Go-Live Gaps** list.
5. The tool is checked off as **addressed / wired**. Actual wiring still runs through the numbered handoff loop (`docs/handoffs/`, #23+).

Each tool section carries: a brief **Summary** (what it is / does / where it sits in the journey — a snapshot, not a deep dive), its **Pages & routes**, the per-page **tables**, and a **Notes** section for distinctions, backend caveats, and things to circle back to.

### Scope — what gets a manifest entry (and what does not)

- **In scope:** page-specific content only — everything inside the page body.
- **Out of scope (logged separately, later pass):** the **left sidebar**, the **top-bar / in-area sub-nav**, and **breadcrumbs**. These repeat across pages; mapping them per-page would bloat the manifest. They get their own section/pass.
- **Assessments:** we do **not** enumerate every question. Question items are structurally identical — wire one, wire all. We log the assessment shell and the *pattern*, and make judgment calls so the manifest captures what's useful and actionable, not every repeated row.

### Source types (the "where it comes from" buckets)

| Type | Meaning |
|---|---|
| **Static** | Identical for every user, every render. UI copy, headers, labels, instructional text, universal examples. Lives in the component/code, not Supabase. |
| **Persisted user data** | What the user / their journey created: goals, initiatives, milestones, scores, profile fields. Read from Supabase, keyed to the user. |
| **Conditional / relational library** | *Pre-written* content the backend selects the right variant of by stage/profile/relational context (e.g. the stage-calibrated MRA checkpoint definitions). System chooses it; user didn't create it. |
| **AI synthesis** | Generated via n8n → Claude (or the Virtual CSO Vercel exception), written back to Supabase, then rendered by context. Not pre-written. |
| **Derived / computed** | Calculated from other data, not stored as content: counts, completion %, deltas, maturity/readiness rollups, days-remaining, live tallies. |

### State (current reality of each element)

`Wired` · `Placeholder` · `Mock` · `Missing-fields`

### Per-page table columns

| Element | What the user sees | Source type | Origin | Fetch | Render rule | State | Notes / gaps |
|---|---|---|---|---|---|---|---|

- **Element** — the markdown line: `H1: "…"`, `Body`, `Chart`, `Button`, `Input`, `Image`, etc.
- **Origin** — Supabase `table.field` / n8n workflow / static component / computed-from.
- **Fetch** — the hook/query that pulls it.
- **Render rule** — the conditional logic that decides what shows.

---

## Tools — status

| # | Tool / area | Pages | Manifest status |
|---|---|---|---|
| 1 | Architect Evolution (Foundations) | 3 | **Complete (#23–#27)** — backend + frontend wired & verified, single-question wizard; 4 Go-Live items remain (live QA, PDFs/buttons, gate flip) |
| 2 | Agency Snapshot (Foundations) | 5 | **In progress** — Market Footprint **wired + verified + soft-locked (#29)**; Economic Foundation / Revenue Model / Delivery Architecture / Dashboard pending |

---

## 1. Architect Evolution

> **Area:** Foundations.
> **Summary:** The foundational tool for the founder to understand where they currently stand as a leader — how they show up and how they bring value to the business — and to get their first read on whether their role and identity are fit for purpose for where they are and where they're trying to go. Sits early in the Foundations journey and produces downstream context that other tools and platform AI layers use to better understand the user (capabilities, focus areas, goals).

### Pages & routes

| Page | Route | Component | Gate |
|---|---|---|---|
| Overview | `/foundations/architect-evolution` (redirect from `/founder-evolution`) | `ArchitectEvolutionLanding` | `architect_evolution` |
| Assessment | `/foundations/architect-evolution/assessment` (redirect from old) | `ArchitectEvolutionAssessment` | `architect_evolution` |
| Results | `/foundations/architect-evolution/results` (redirect from old) | `ArchitectEvolutionResults` | `architect_evolution` *(temp; pre-launch → `architect_evolution_dashboard`)* |

> Routes/gates/components renamed in #25 (V-13). Component file is `pages/ArchitectEvolutionPages.tsx`. Backend tables/functions are `fe_*` (#24).

> **Flag spotted in `App.tsx`:** the Results route is **temporarily gated `founder_evolution`** for wireframe review, with an inline note to **revert to `founder_evolution_dashboard` before launch.** Logged here so it isn't missed → Go-Live Gaps.

### Page tables

- [x] Overview — content table
- [x] Assessment — content table
- [x] Results — content table

#### Overview — `/foundations/founder-evolution`

> Component: `pages/FounderEvolutionPages.tsx › FounderEvolutionLanding`. Entirely static — no data reads; all copy hardcoded in the component. Origin for every row below is this component; Fetch is n/a (hardcoded); Render rule is Always. "State = Static" means final as-is, no wiring required.

| Element | What the user sees | Source type | State | Notes / gaps |
|---|---|---|---|---|
| Graphic | Compass icon (brass) | Static | Static | Decorative |
| H1 | "Architect Evolution" | Static | Static | — |
| Subhead | "Understand how you currently show up in your business" | Static | Static | — |
| Body | Intro: "This quick assessment helps identify your current founder role and operating style. There are no right or wrong roles…" | Static | Static | — |
| Card · H3 + body | "What This Is For" — identifies how you currently operate (functional role + operating style) | Static | Static | — |
| Card · H3 + body | "What This Isn't" — not about right/wrong roles; a snapshot of how you operate today | Static | Static | — |
| Card · H3 + body | "What Happens Next" — you'll receive your **Founder Identity** (role stage) + **Founder Type** (operating orientation); becomes the interpretive lens for downstream diagnostics/insights/planning | Static | Static | Names the two result outputs + the downstream-context role (see Notes) |
| Button | "Start Assessment" → `/foundations/founder-evolution/assessment` | Static | Static | Internal nav |
| Card · H3 | "Assessment Details" (clock icon) | Static | Static | Sidebar panel |
| List | "Takes about 3 minutes" · "13 questions" · "Multiple choice" | Static | Static | **Hardcoded** — "13 questions" / "3 minutes" must be updated by hand if the assessment changes (candidate to derive from the question set later) |

#### Assessment — `/foundations/founder-evolution/assessment`

> Component: `pages/FounderEvolutionPages.tsx › FounderEvolutionAssessment`. **Shell only — questions are not enumerated** (wire one, wire all). The page is two sections (Role · Style), each a header + a repeating question card (question text + multiple-choice options). **Target:** the question set and the selection options move to **two Supabase tables** — a questions table and an options/answers table — keyed for scoring, so questions can be added / reworded / re-weighted without code changes. Currently the `questions` array (incl. each question's `section` and `options`) is **hardcoded in the component**.

| Element | What the user sees | Source type | Origin (current → target) | State | Notes / gaps |
|---|---|---|---|---|---|
| Progress label | "Question X of Y" + "% Complete" | Derived / computed | `answeredCount` / `totalQuestions` (local state) | Wired | `totalQuestions` derives from the question set — once questions move to Supabase it should come from the row count |
| Graphic | Progress bar | Derived / computed | same as above | Wired | — |
| H2 (Section 1) | "Your Founder Role" | Static | component | Static | Section grouping keys off each question's `section` field (`role`/`style`) — may move to the questions table |
| Body | "These questions explore where you spend time and how responsibility flows." | Static | component | Static | — |
| H2 (Section 2) | "Your Operating Style" | Static | component | Static | — |
| Body | "These questions explore how you naturally show up and where you prefer to engage." | Static | component | Static | — |
| Question (pattern — all questions) | Question text in each card | Conditional / relational library | hardcoded `questions[]` → **Supabase questions table** | Mock | Pre-written, system-served (not user-created). Not enumerated here; wire the pattern once. Table keyed for scoring + section. |
| Options (pattern — all questions) | Multiple-choice radio options per question | Conditional / relational library | hardcoded per-question `options[]` → **Supabase options/answers table** | Mock | Keyed to questions; carries the scoring value per option |
| Selected answer (user input) | The founder's chosen option per question | Persisted user data | local `answers` useState → **must persist to results on submit** | Missing-fields | **Not persisted today** — answers live only in local state |
| Button | "Back" → `/foundations/founder-evolution` | Static | component | Static | — |
| Button | "Complete Assessment" (disabled until all answered) → `/results` | Static (control) | component | Mock | **Wiring gap:** on click it only `navigate()`s — no save. Needs to persist answers + trigger scoring → `founder_evolution_results` before routing to Results |

#### Results — `/foundations/founder-evolution/results`

> Component: `pages/FounderEvolutionPages.tsx › FounderEvolutionResults`. **Directional log — exact tables/fields confirmed in the wiring pass.** The page mixes static frame content with per-result content. Two directional sources:
> - **Results row** (`founder_evolution_results`, directional): the user's scored outcome — identity/role + type + score → a `profileKey` (`{founder_identity}_{founder_type}`).
> - **Cross-section profile row** (`founder_evolution_profiles`, directional): one of **15 cross-section possibilities**, keyed by `profileKey`; holds all the pre-written profile content + the companion-guide PDF location.
> Build today uses `MOCK_PROFILE` + `MOCK_RESULT` (component has the live-query TODO). Dynamic rows below are **State = Mock** until wired. Field-level mapping is the next-pass task.

| Element | What the user sees | Source type | Origin (directional) | State | Notes / gaps |
|---|---|---|---|---|---|
| H1 (archetype) | "The Steady Hand" | Conditional / relational library | cross-section row (name), selected by score-derived `profileKey` | Mock | The cross-section title |
| Pills (2) | "Manager" (identity/role) · "Strategist" (type) | Persisted user data | results row (founder_identity, founder_type) | Mock | Referenced by score, not freely derived |
| Tagline (italic) | One-line summary of the cross-section | Conditional / relational library | same cross-section row | Mock | Lives on the cross-section record |
| H3 + body | "What is the Architect Evolution?" explainer | Static | component | Static | — |
| List · Founder Identity | 5 identities + icons + descriptions | Static | component (`identityOptions`) | Static | Reference legend, same for all users |
| List · Founder Type | 3 types + icons + descriptions | Static | component (`typeOptions`) | Static | — |
| Axis labels | 2×2 labels (Identity · Type · Involvement→Ownership · Execution→Direction) | Static | component | Static | — |
| Graphic | The dot on the 2×2 visual | Derived / computed | result score → axis coordinates | Missing-fields | **Build the score→dot-placement logic** (score result → x/y position). New functionality. |
| Section label + intro | "Your Profile" · "What your {identity} × {type} cross-section means…" | Static template + dynamic insert | template static; `{identity}`/`{type}` from results row | Mock | Label tokens from the results row |
| Body | Profile summary paragraph | Conditional / relational library | cross-section row (summary) | Mock | 1 of 15 |
| Cards (4) | "How This Shows Up" — 4 statements | Conditional / relational library | cross-section row | Mock | Pre-written per cross-section |
| List (3) | "Where This Creates Leverage" — 3 statements | Conditional / relational library | cross-section row | Mock | — |
| List (3) | "Where This Creates Tension" — 3 statements | Conditional / relational library | cross-section row | Mock | — |
| List (4) | "Thought Starters" — 4 numbered | Conditional / relational library | cross-section row | Mock | — |
| Navy section | "The Fit-For-Purpose Frame" — heading + 3 columns (Aligned · Drifted · The Real Transformation) | Static | component | Static | Same for all users |
| Card text | "What's Next" · Companion Guide title + description | Static | component | Static | — |
| Button | "Download Guide" | Persisted user data (Storage URL) | cross-section row → Supabase **Storage** path | Missing-fields | Per-cross-section PDF uploaded to Storage; URL stored on the cross-section record; wired into the button at result population; re-wires when reassessed. **PDFs need creating/uploading.** |
| Card text + button | "Book Your Discovery Call" card + button + "Already scheduled?…" | Static | component (fixed external URL) | Missing-fields | Pre-wired fixed booking URL — **add the correct URL**, then locked (does not change per user) |

### Notes

- **First-person & identity-oriented.** This tool is about the *founder/leader themselves* — their role, identity, and how they add value — distinct from the agency-**maturity** diagnostics (M&R Audit / AE Ladder), which assess the business. Keep the two altitudes separate when wiring.
- **Downstream context provider.** Results feed other tools and platform AI layers as reusable user context (capabilities, focus areas, goals). Treat the output as a context source, not a dead-end results screen.
- **Backend naming (V-13 + table prefix).** User-facing name is **"Architect Evolution"**; legacy backend naming is **`founder-evolution` / `FounderEvolution` / `founder_evolution_*`**. Decision (2026-06-23): **abbreviate the tables to the `fe_` prefix** (`fe_questions`, `fe_responses`, `fe_results`, `fe_profiles`) — `AE` is taken by Agency Evolution / AE Ladder. Going forward, refer to FE for tables and **"Architect Evolution"** for user-facing naming. Backend rename (tables + functions + route path + `founder_evolution` gate key + `FounderEvolution*` files) to be executed in a coordinated pass — see Wiring Log; relates to UI-PROGRESS V-13.

### Wiring Log

**#23 — Scoring engine + backend (applied + verified 2026-06-23).** Source: `docs/architect-evolution-scoring-spec.md`; handoff `docs/handoffs/23-architect-evolution-scoring-backend-*`.
- 4 migrations: section fix (q6/q7 → `role`; now 7 role / 6 style ✓); `scores` weights embedded in all 13 questions' `options` jsonb; `score_founder_evolution(p_response_id)` + `submit_founder_evolution(p_answers)` (SECURITY INVOKER, EXECUTE→authenticated); `founder_evolution_profiles` table (23 cols, UNIQUE `cross_section_key`, RLS read); plus a `UNIQUE(response_id)` on `founder_evolution_results` (needed for upsert).
- **Independently verified (live SQL):** section split; multi-bucket weights (q3/q6/q7/q13) match spec §3 exactly; both function signatures + INVOKER security; profiles structure/constraints/RLS; a live **Type-tie test** (Builder 5 = Strategist 5 → primary Builder ✓); seed re-score recomputed from the weight map → `Practitioner_Visionary` ✓. Test rows cleaned up.
**Post-#23 cleanup (2026-06-23):**
- **Seed rows deleted** — old `fe results` + `fe responses` test rows removed (fresh slate; new test records created as we go). Resolves the stale-seed-fields flag.
- **Profiles seeded by London** — 15 rows, all with working MVP taglines. ✓
- **Key-case mismatch found** — profiles keys are **lowercase** (`ceo_builder`) but the scorer emits **TitleCase** (`CEO_Builder`); case-sensitive join would fail. Decision pending: recommend **lowercase canonical** → scorer `lower()`s the written key (vs re-casing 15 rows).
- **Queued for the next backend pass (before frontend):** drop the unused result columns (recommend all six: `identity_confidence`, `type_confidence`, `centrality_signal`, `architect_posture`, `interpretation_text`, `call_prep_text`); rename `founder_evolution_*` → `fe_*` (tables + functions); apply the key-case fix. Then the frontend handoff wires once against final names.

**#24 — Backend cleanup + rename + key-case (applied + verified 2026-06-23).** Handoff `docs/handoffs/24-fe-backend-cleanup-rename-*`. 3 migrations.
- **Tables renamed** → `fe_questions` (13), `fe_responses` (0), `fe_results` (0), `fe_profiles` (15). Legacy `founder_evolution_*` names gone; data/PK/FK/UNIQUE/RLS/grants intact (verified).
- **6 unused columns dropped** from `fe_results` → now 10 columns (id, user_id, response_id, identity_primary, identity_secondary, type_primary, type_secondary, cross_section_key, raw_scores, created_at).
- **Functions renamed** → `fe_score_assessment(p_response_id)` + `fe_submit_assessment(p_answers)` (INVOKER, EXECUTE→authenticated); old names dropped.
- **Key-case fixed** → scorer writes lowercase `cross_section_key`; `identity_primary`/`type_primary`/`raw_scores` stay TitleCase. **Live join proven:** crafted response → `ceo_builder` → joins `fe_profiles` → "The Execution Engine". Test row cleaned up.
- **Not testable in SQL (deferred to #26):** `fe_submit_assessment` round-trip (INVOKER + `auth.uid()` needs a real auth context — confirm end-to-end in frontend wiring).
- **Noted for #26:** `fe_profiles` has a `cross_section_profile_display` (NOT NULL) column London added (e.g. "Practitioner + Visionary") — available to the Results wiring if useful.
- **All backend tables/functions for this feature now use the `fe_` prefix** (the page-table Origin cells below predate the rename; read them as `fe_*`).

**#25 — V-13 naming alignment (applied + verified 2026-06-23).** Handoff `docs/handoffs/25-architect-evolution-v13-rename-*`.
- **Route:** `/foundations/founder-evolution/*` → `/foundations/architect-evolution/*`; 3 redirect routes added for the old paths (verified in `App.tsx`).
- **Gate keys:** `founder_evolution` → `architect_evolution`, `founder_evolution_dashboard` → `architect_evolution_dashboard` across `featureGates.ts` (`FeatureKey` union, `FEATURE_GATES`, `PATH_FEATURE_GATES`) + `App.tsx` gates + `Sidebar`. (Code-based gating; no `beta_feature_gates` table exists.)
- **Components/files:** `FounderEvolutionPages.tsx` → `ArchitectEvolutionPages.tsx`; `FounderEvolution{Landing,Assessment,Results}` + `FounderEvolutionProfile` type → `ArchitectEvolution*`; `App.tsx` import + all consumers updated.
- **Verified (grep + read):** active `.ts/.tsx` clean of `founder_evolution`/`FounderEvolution`/`founder-evolution` except the 4 required redirect lines in `App.tsx`; new file + 3 renamed exports present; **framework vocabulary intact** ("Founder Identity/Type", "Your Founder Role", role/type labels untouched); `architect_evolution` keys present in `featureGates.ts`. (`.claude/worktrees/**` stale copies ignored.)
- **Minor cleanup for #26:** the legacy stub `pages/FounderEvolutionPages.tsx` (`export * from './ArchitectEvolutionPages'`) has **no importers** — delete it during #26.

**#26 — Frontend wiring (applied + code-verified 2026-06-23). Feature online.** Handoff `docs/handoffs/26-architect-evolution-frontend-wiring-*`.
- **Assessment** reads `fe_questions` (`is_active`, `sort_order`; options mapped to strip `scores`); "Complete" → `supabase.rpc('fe_submit_assessment', {p_answers})` → routes to Results; loading/error handled; hardcoded `questions[]` removed.
- **Results** reads latest `fe_results` (own-row, `maybeSingle`) ⋈ `fe_profiles` by `cross_section_key`; renders all dynamic content; `toLowerId()` maps TitleCase primaries → lowercase ids for the dot; **empty state** with "Start the Assessment" CTA when no result; `MOCK_PROFILE`/`MOCK_RESULT` removed.
- **Inert buttons:** Download Guide + Book Your Discovery Call are `disabled` with Go-Live TODOs (deferred — wired together once PDFs uploaded + URLs supplied).
- **Stub deleted:** `pages/FounderEvolutionPages.tsx` removed (no importers; confirmed via grep + glob).
- **Verified (grep + read):** all of the above present in `ArchitectEvolutionPages.tsx`; no `MOCK_*`/hardcoded `questions[]`; stub gone; no new TS errors.
- **PENDING — live logged-in QA:** the full browser round-trip (auth session → `fe_submit_assessment` → results render) can't be exercised via SQL/MCP because the function uses `auth.uid()`. Confirm in a logged-in app session.

**#27 — One-question-at-a-time assessment wizard (applied + verified 2026-06-23).** Handoff `docs/handoffs/27-architect-evolution-assessment-wizard-*`.
- `ArchitectEvolutionAssessment` refactored to a single-question wizard: `ProgressIndicator` **reused** from AE Ladder (prop-driven, untouched); `FEQuestionCard` + `FENavigationControls` **mirrored locally** (AE Ladder's QuestionCard hardcodes a 1–5 Likert; FE has string-value options).
- Behavior: auto-advance on select (320ms), Back persists both directions, `canAdvance` gates Next + Complete until answered → submitting with gaps impossible. Lightweight submit state (no heavy overlay).
- **Section distinction removed** — grep confirms zero "Your Founder Role" / "Your Operating Style" in the component; every question uniform. Results framework terms ("Founder Identity/Type") untouched.
- **Data path unchanged from #26** (verified): `fe_questions` fetch, `answers` keyed by `question_key`, `fe_submit_assessment` RPC, routing. No backend/Results/AE-Ladder changes; no new TS errors.

### Go-Live checklist (Architect Evolution)

The tool is wired and verified (#23–#27). Remaining pre-launch items:

1. **Live logged-in QA** — confirm the browser round-trip (auth session → `fe_submit_assessment` → results render).
2. **Companion-guide PDFs** — create the 15 PDFs, upload to Supabase Storage, backfill `fe_profiles.pdf_url`.
3. **Wire the two buttons** — "Download Guide" (from `pdf_url`) + "Book Your Discovery Call" (booking URL); done together once #2 + the URL are ready.
4. **Gate flip** — Results route `architect_evolution` → `architect_evolution_dashboard` before launch.
5. **One-question-at-a-time assessment UX** — ✅ **DONE (#27, verified).** Single-question wizard, no role/style distinction, auto-advance + Back persistence, gated submit. (Was item 5; now complete — four pre-launch items remain above.)

---

## 2. Agency Snapshot

> **Area:** Foundations. **Route base:** `/foundations/snapshot` · **Gate:** `agency_snapshot` (code-based `featureGates.ts`; no `beta_feature_gates` table).
> **Summary:** A re-runnable, multi-section intake-and-synthesis tool. The founder completes four intake sub-tabs — Market Footprint, Economic Foundation, Revenue Model, Delivery Architecture — each writing to its own section table and firing its **own n8n synthesis workflow** that writes a section-level **mini-synthesis** back to Supabase. All sub-tabs roll up into a **full Dashboard synthesis** across the sections. AI synthesis routes through n8n (architecture rule #1). Re-runnable over time with **two independent run counters** (per-sub-tab and dashboard — see Notes → Versioning).

### Pages & routes

| Page | Route | Component | Gate |
|---|---|---|---|
| Dashboard | `/foundations/snapshot/dashboard` | `SnapshotDashboard` | `agency_snapshot` |
| Market Footprint | `/foundations/snapshot/market-footprint` | `IdentityPositioning` → `IdentityPositioningTab` | `agency_snapshot` |
| Economic Foundation | `/foundations/snapshot/economic-foundation` | `FinancialSnapshot` | `agency_snapshot` |
| Revenue Model | `/foundations/snapshot/revenue-model` | `GrowthPipeline` | `agency_snapshot` |
| Delivery Architecture | `/foundations/snapshot/delivery-architecture` | `DeliveryArchitectureTab` | `agency_snapshot` |

> `pages/SnapshotPages.tsx › IdentityPositioning` is a thin wrapper that renders `components/snapshot/IdentityPositioningTab.tsx`, where all Market Footprint logic lives.

### Page tables

- [x] Market Footprint — mapped + wired + verified + soft-locked (#29)
- [x] Economic Foundation — mapped + wired + verified + in-app tested (#30); mock cash figure to correct ($7K→$700K)
- [x] Revenue Model — mapped + wired + verified + in-app tested (#31)
- [x] Delivery Architecture — mapped + wired + verified + in-app tested (#32)
- [x] Dashboard — mapped (this pass)

#### Market Footprint — `/foundations/snapshot/market-footprint`

> Component: `components/snapshot/IdentityPositioningTab.tsx`. Backed by `agency_snapshot_market_footprint` (writes + reads), three ref tables feeding dropdowns, and the readable view `agency_snapshot_market_footprint_readable` feeding **n8n** (not the frontend). Layout: left intake form + post-save profile/synthesis block; right "Positioning Analysis" sidebar is static/vestigial.

**Intake form → save targets** — all write to `agency_snapshot_market_footprint`, keyed on `user_id` via `handleSave`. Intake elements are bidirectional: Source type = Persisted user data; the **Save target** column is the write destination.

| Element (label) | Input | Save target (column) | Type | Req | State | Notes |
|---|---|---|---|---|---|---|
| Agency Focus (Primary Services) * | MultiSelect | `agency_types` | `uuid[]` | ✔ | Wired | `'other'`/`'generalist'` UI flags stripped on save |
| Specify agency focus (Other) | Text | `agency_types_other` | text | — | Wired | conditional on `other` selected |
| Services Offered (Secondary) | MultiSelect | `services_offered` | `uuid[]` | — | Wired | `'Other'` added client-side |
| Specify other services | Text | `services_offered_other` | text | — | Wired | conditional |
| Primary Industries Served * (Max 10) | MultiSelect | `industries_served` | `uuid[]` | ✔ | Wired | `'Generalist'`/`'Other'` added client-side; max 10 |
| Specify other industries | Text | `industries_served_other` | text | — | Wired | conditional |
| Geographic Footprint * | Select | `geographic_footprint` | text (enum) | ✔ | Wired | static enum `local/regional/national/international` |
| Overall Pricing Strategy * | MultiSelect | `pricing_strategies` | `text[]` (enum) | ✔ | Wired | static 7 enum codes `value_based/retainer/project_based/hourly/cost_plus/performance/hybrid` |
| Website URL | Input (url) | `website_url` | text | — | Wired | Positioning accordion |
| Additional Positioning Context | Textarea (≤500) | `positioning_context` | text | — | Wired | Positioning accordion |
| *(code-set on save)* | — | `snapshot_instance_id`, `is_complete=true`, `updated_at`, `user_id` | — | — | Wired | `snapshot_instance_id` = client `crypto.randomUUID()`, persisted + reused |

**Dropdown / option sources**

| Field | Option source | Source type | State |
|---|---|---|---|
| Agency Focus | `agency_snapshot_agency_type_ref_table` (`is_active`, `sort_order`) | Relational library | Wired |
| Services | `agency_snapshot_services_ref_table` | Relational library | Wired (+ client `Other`) |
| Industries | `agency_snapshot_industries_ref_table` | Relational library | Wired (+ client `Generalist`/`Other`) |
| Geographic Footprint | hardcoded `<option>`s in component | Static | Wired |
| Pricing | hardcoded `PRICING_OPTIONS` const | Static | Wired |

**Profile + synthesis render** — profile block (`showProfile`, after save) renders from local `formData`, resolving UUID→label via in-memory ref maps; synthesis block reads flat columns hydrated on load.

| Element | What the user sees | Source type | Origin column | State | Notes |
|---|---|---|---|---|---|
| Market Footprint Profile | Echo of saved selections (focus, geo, industries, services, pricing, site, context) | Persisted user data | `formData` (hydrated from the loaded row) | Wired | **client-side** label resolution; not from the readable view |
| Market Footprint Insights | 3 expandable insight cards | AI synthesis (n8n) | `synthesis_beat_{1,2,3}` + `synthesis_beat_{1,2,3}_headline` | Render wired / n8n-dependent | rendered via `ExpandableInsightCard` |
| The Signal | Italic callout | AI synthesis (n8n) | `synthesis_signal` | Render wired / n8n-dependent | — |
| Status / error chips | Synthesis state messaging | Derived (async envelope) | `synthesis_status`, `synthesis_error` | Wired | `pollSynthesisStatus` polls the row every 3s by `snapshot_instance_id` |
| Right "Positioning Analysis" sidebar | "Analysis will appear here after saving" | Static | component | Placeholder | vestigial — never reflects real synthesis |

**Synthesis trigger:** "Submit for Synthesis" → fire-and-forget `POST ${VITE_N8N_WEBHOOK_URL}/agency-snapshot/market-footprint/synthesize`, header `x-architectos-secret` (hardcoded literal), body `{snapshot_instance_id, user_id, force}`; then poll until `synthesis_status` ∈ {complete, error}. Gated until a saved record exists with no unsaved changes.

**Columns not consumed by the frontend:** `market_footprint_synthesis` (jsonb), `synthesis_payload` (jsonb), `synthesis_model`, `prompt_version`, `synthesis_generated_at`, `input_hash`, `website_scraped_content` (jsonb — n8n web-scrape enrichment, derived). The readable view `agency_snapshot_market_footprint_readable` resolves the UUID arrays + enum codes to label text and is consumed by **n8n**, not the frontend.

### Notes (Agency Snapshot / Market Footprint)

- **Readable view = Market-Footprint-only n8n bridge.** `agency_snapshot_market_footprint_readable` exists only because MF is the one sub-tab with multi-select **FK arrays** (agency types, services, industries) that must be flattened to readable text for the Anthropic nodes in n8n (pulled Supabase→n8n at synthesis time). The other three sections store open text or single-select-as-text (no FK), so they will **not** need readable views — do not add them.
- **Versioning — two independent run counters (design intent).** (a) **Per-sub-tab runs:** each sub-tab has its own n8n workflow; each save+synthesis is one run, retained/versioned, `is_current=true` marking the rendered version. (b) **Dashboard runs:** a separate counter for the full cross-section synthesis; any sub-tab update **stales** the dashboard and requires a new dashboard synthesis. Both counters viewable/measurable.
- **Parent `agency_snapshots` is a dashboard-phase construct.** Its `run_number` + section FKs belong to the full-dashboard run, not the sub-tab save — which is why the MF form never writes it. (Resolves the earlier parent-linkage flag for this unit.)
- **Current persistence ≠ intended model (gap).** Today the code is single-row-per-user overwrite: load `select('*').eq('user_id').maybeSingle()` (no `is_current` filter/order); save = UPDATE-by-`user_id` if a row exists else INSERT. `maybeSingle()` will throw once a second row exists. Rework needed: insert a new row per save, flip `is_current`, render `is_current=true`. Per London, the `is_current` flip is intended to live as an **innate n8n workflow step** (recording a new synthesis flips prior rows to `false`) — confirm the built workflow does this. *(Live data 2026-06: 4 rows, **0** `is_current=true`, one user with 2 rows → `maybeSingle()` already breaks for that user; render-on-return loads empty.)*
- **No per-section run column.** `agency_snapshot_market_footprint` has `is_current` + `snapshot_instance_id` + timestamps but no `run_number`/counter — per-sub-tab run count is currently neither stored nor numbered. Build decision pending: derive (row count) vs add an explicit column.
- **`snapshot_instance_id`** is a client-generated GUID, persisted and reused across updates; used as the synthesis poll key + webhook payload. It is **not** `agency_snapshots.id`, and the section has no FK to the parent (only `user_id` has a FK; `id` is PK).
- **Profile renders from form state, not the readable view** — acceptable (the view's job is the n8n bridge). On return, `formData` hydrates from the loaded row, so the profile reflects the saved record.
- **Hardcoded webhook secret** (`x-architectos-secret`, `IdentityPositioningTab.tsx` ~line 421) ships in the client bundle. Low risk for founder-only beta; config improvement parked (a `VITE_` env var is tidier but still client-exposed; true secrecy needs a server-side proxy).
- **Dead code:** `SERVICE_OPTIONS` + `INDUSTRY_OPTIONS` consts (lines 46–75) are unused (ref tables supplant them); the right-panel "Positioning Analysis" sidebar is a static placeholder.

- **Synthesis pipeline (WF-AS-01) — assessed 2026-06-24.** Workflow `JZlFwB65zkntPdIE`, **Railway** host (`primary-production-fab5.up.railway.app/webhook` — *not* n8n.cloud; confirm `VITE_N8N_WEBHOOK_URL` resolves there). Success path writes `synthesis_status='complete'` + all beats/headlines/signal + payload + model + `prompt_version` + `generated_at` **atomically** (finding #2 contract met); error path writes `status='error'` + `synthesis_error`; status strings match the frontend union. **Defects:** idempotency hash is **degenerate** — computed over an empty payload (`{website_url, positioning_context, *_other}`, none of which the client sends) → a constant → re-runs of a changed footprint **skip silently**; **no versioning / no `is_current` demotion** (every op is UPDATE-in-place by `snapshot_instance_id`); model-label stamp `claude-sonnet-4-6` ≠ actual id `claude-sonnet-4-20250514`; prompt inline (registry seed).
- **Versioning model decided (2026-06-24) → specced in #29.** Content-addressed versioning, **Option A**: one row per unique input combination per user; frontend-owned canonical `input_hash`; `is_current` enforced by a Supabase trigger + partial unique index; reactivating a prior combination re-promotes its row **without** re-synthesizing (no workflow call); net-new inserts + promotes-on-insert + synthesizes (running/error states shown); explicit `version_number` run count; `snapshot_instance_id` is **dashboard-owned** (dropped from the sub-tab — a sub-tab change invalidates the dashboard's combination, handled in the dashboard spec). Workflow simplified to **synthesize-and-writeback keyed on row `id`** — **manual** n8n edits in `docs/handoffs/29-mf-versioning-rework-n8n-manual-walkthrough.md`.

### Open build items (Market Footprint)

> Items 1, 2, and 6 are **specced in #29** — `29-mf-versioning-rework-{task-spec,handoff-prompt}.md` (frontend + DB trigger) + `…-n8n-manual-walkthrough.md` (manual workflow edits). Items 3–5 remain open.

1. **Versioning rework** — single-row overwrite → `is_current` versioning (insert new row per save, flip flag, render `is_current=true`); covers intake + section synthesis. Coupled to the run-count decision. The `is_current` flip is intended as an **innate n8n workflow step** — verify in the built workflow.
2. **Per-section run-count storage** — derive (row count) vs explicit column on the section table.
3. **Dashboard staleness rule** — a sub-tab update must mark the dashboard synthesis stale / require a rerun (dashboard-phase, two-tier counters).
4. **Webhook secret config** — env var vs server-side proxy vs leave as-is (parked).
5. **Dead-code cleanup** — remove unused `SERVICE_OPTIONS`/`INDUSTRY_OPTIONS`; decide fate of the static right-panel sidebar.
6. **Synthesis write-contract (n8n).** The render couples `synthesis_status` and the beat columns separately and breaks **silently** when they disagree — live data shows `complete`-but-no-beats (→ blank insights block) and beats-but-`null`-status (→ existing beats hidden behind the idle message). The workflow must write `synthesis_status='complete'` **and** `synthesis_beat_1..3` (+ headlines) + `synthesis_signal` **atomically**, plus the Claude `synthesis_model` + `prompt_version` + `synthesis_generated_at`; on failure set `synthesis_status='error'` + `synthesis_error`. Verify against the built workflow.

#### Economic Foundation — `/foundations/snapshot/economic-foundation`

> Component: `pages/SnapshotPages.tsx › FinancialSnapshot` (form + live metric sidebar + synthesis), with the saved-profile block rendered by `components/snapshot/FinancialProfile.tsx`. Backed by `agency_snapshot_economic_foundation`. **No ref tables, no readable view** (all inputs numeric or single-select-as-text — n8n reads the base table directly). Same synthesis/envelope columns + `is_current`/`snapshot_instance_id`/`input_hash` as MF.

**Intake form → save targets** — all write to `agency_snapshot_economic_foundation`; **save always INSERTs a new row** (after demoting the user's other rows to `is_current=false`). Source type = Persisted user data.

| Element (label) | Input | Save target | Type | Section | Notes |
|---|---|---|---|---|---|
| Monthly Revenue | CurrencyInput | `monthly_revenue` | numeric | Core | |
| Monthly AGI (Agency Gross Income) | CurrencyInput | `monthly_agi` | numeric | Core | |
| Monthly Payroll (Unburdened) | CurrencyInput | `monthly_payroll` | numeric | Core | |
| Typical Profit Margin | PercentageInput | `profit_margin_percentage` | numeric | Core | **entered, not calculated** |
| Cash Available for Operations | CurrencyInput | `cash_available` | numeric | Core | |
| Financial Health Status | Select | `financial_health_status` | varchar (enum) | Core | static enum: stressed/tight/stable/healthy/excellent |
| Pass-Through Costs (Monthly) | CurrencyInput | `monthly_passthrough_costs` | numeric | Advanced | |
| SG&A / Overhead (Monthly) | CurrencyInput | `monthly_overhead` | numeric | Advanced | |
| Owner/Founder Compensation | CurrencyInput | `owner_compensation` | numeric | Advanced | |
| Gross Margin (%) | PercentageInput | `gross_margin_percentage` | numeric | Advanced | **entered, not calculated** |
| Accounts Receivable | CurrencyInput | `accounts_receivable` | numeric | Advanced | |
| Accounts Payable | CurrencyInput | `accounts_payable` | numeric | Advanced | |
| Cash Flow Health | Select | `cash_flow_health` | varchar (enum) | Advanced | static enum: tight/strained/smooth/predictable |
| *(code-set on save)* | — | `user_id`, `snapshot_instance_id` (client GUID, reused), `is_complete=true`, `is_current=true` | — | — | |

**Calculated metrics — derived in-component, persisted on save** (Source type = Derived/computed; written to the table):

| Metric | Formula | Save target |
|---|---|---|
| AGI Percentage | `monthly_agi / monthly_revenue * 100` | `agi_percentage_calculated` |
| Annual Revenue Run Rate | `monthly_revenue * 12` | `annual_revenue_run_rate` |
| Annual AGI Run Rate | `monthly_agi * 12` | `annual_agi_run_rate` |
| Monthly Operating Profit | `monthly_agi * (profit_margin_percentage / 100)` | `monthly_operating_profit` |
| Monthly Operating Expenses | `monthly_agi - monthly_operating_profit` | `monthly_operating_expenses` |
| Cash Runway (months) | `cash_available / monthly_operating_expenses` | `cash_runway_months` |

**Render sources**

| Surface | What renders | Source |
|---|---|---|
| Right sidebar metrics | the 6 calculated metrics, live | **derived from current form state** (recompute as you type; not from DB) |
| Economic Foundation Profile (`FinancialProfile`, after save) | inputs + persisted calc columns + benchmark badges + health label | **the saved row** (`profileData`); via `SnapshotProfileUtils` (`formatCurrency/Date/HealthStatus`, `renderBenchmarkBadge` = static benchmark thresholds in code) |
| Economic Foundation Insights | 3 beat cards + "The Signal" | AI synthesis (n8n) — `synthesis_beat_{1,2,3}` + `_headline`, `synthesis_signal` |
| status / error chips | synthesis state | `synthesis_status`, `synthesis_error` |

**Synthesis trigger:** `Submit for Synthesis` → `POST ${VITE_N8N_WEBHOOK_URL}/agency-snapshot/economic-foundation/synthesize`, hardcoded `x-architectos-secret`, body `{snapshot_instance_id, user_id, force}`; awaits the response (handles a `skipped` status), else polls the row by `snapshot_instance_id` every 3s. **Not written by the frontend:** `economic_foundation_synthesis`, `synthesis_payload`, all `synthesis_*` envelope, `input_hash`, `synthesis_model`, `prompt_version`, `synthesis_generated_at`.

**Notes — persistence state vs the #29 model (the EF rework delta):**
- EF is **partly ahead of MF's old code**: load already filters `is_current=true`; save already **inserts a new row + demotes the others** (frontend `UPDATE … is_current=false`). Basic versioning exists.
- **Missing vs #29:** (1) **no `input_hash`** → no content-addressed dedup/reactivation (every save creates a new row even if unchanged); (2) **no `version_number` column** on the table; (3) **no DB trigger / partial unique index** — demotion is frontend-side, so no DB guarantee of one current per user and no reactivation-without-save path; (4) **keyed on `snapshot_instance_id`** (client GUID, reused across versions) for poll + synthesis, same `.single()` fragility — should move to row `id`; (5) synthesis payload `{snapshot_instance_id, user_id, force}` → should become `{id, user_id}`.
- **Workflow WF-AS-02 (assessed 2026-06-24, id `bFSs8k8vibjXTPix`, Railway).** Pre-rework structure (idempotency cluster present; every Supabase node keyed on `snapshot_instance_id`). **Already correct:** model `claude-sonnet-4-6` (no 404 like WF-AS-01 had); reads all financial columns directly from the base table (`Fetch Economic Foundation Data` — confirms no readable view needed); atomic success writeback. **Needs the WF-AS-01 refinements:** delete idempotency cluster; rewire Check Validation→Upsert Running; simplify Validate to `{id, user_id}`; rekey all Supabase nodes `snapshot_instance_id`→`id`; Parse carry `id` + robust error extraction; Supabase-Success drop `is_current`/`input_hash`; Anthropic `onError='continueRegularOutput'`; Error Response 500 `snapshot_instance_id`→`id`.
- **EF active bug (worse than MF was) — confirmed from code + workflow:** the frontend INSERTs a new row per save but **reuses** `snapshot_instance_id`, so multiple rows share one `snapshot_instance_id`. The workflow's `snapshot_instance_id`-keyed `Fetch` (limit 1) can then read a **stale version**, and its `update`s (unfiltered by version) write synthesis to **all** rows with that id. Moving the key to row `id` (the rework) resolves it. RLS verified (own-row INSERT/SELECT/UPDATE; no DELETE policy — fine for versioning). Structural gaps verified live: `version_number` absent; only an `updated_at` trigger (no `is_current` demotion trigger); `idx_economic_foundation_current` is a plain index, not a partial unique.

**Open build items (Economic Foundation) — mirror #29 → specced in #30** (`30-ef-versioning-rework-{task-spec,handoff-prompt}.md` (frontend + DB trigger) + `…-n8n-manual-walkthrough.md` (manual WF-AS-02 edits)):
1. Add `input_hash` (canonical hash over the 13 inputs) + reactivate-or-insert save (load-on-`is_current` already in place).
2. Add `version_number` column + the `is_current` demotion **trigger** + partial unique index (same pattern as `fn_mf_versioning`).
3. Re-key poll + synthesis to row `id`; payload `{id, user_id}`.
4. Economic-foundation workflow refinements to match WF-AS-01.
5. Confirm whether the persisted calc-metric columns are the source of truth for the dashboard/n8n (they're frontend-computed today).

#### Revenue Model — `/foundations/snapshot/revenue-model`

> Component: `pages/SnapshotPages.tsx › GrowthPipeline` (form + live metric sidebar + synthesis); saved-profile block via `components/snapshot/GrowthProfile.tsx`. Backed by `agency_snapshot_revenue_model` (50 cols). **No ref tables, no readable view.** Same synthesis/envelope + `is_current`/`snapshot_instance_id`/`input_hash` columns. **Cross-tab dependency:** the calculated metrics need `monthly_agi`, fetched live from `agency_snapshot_economic_foundation`.

**Intake form → save targets** — all write to `agency_snapshot_revenue_model`. Source = Persisted user data.

| Element | Input | Save target | Type | Section | Notes |
|---|---|---|---|---|---|
| Revenue Mix (% MRR) | PercentageInput | `revenue_mix_mrr_percentage` | numeric | Baseline | Project % = 100−MRR shown disabled (derived display, not stored) |
| Active Client Count | number | `active_client_count` | integer | Baseline | |
| Client Tier Mix | Select | `client_tier_mix` | varchar (enum) | Baseline | local/mid/enterprise/mixed |
| Monthly Churn Rate | PercentageInput | `monthly_churn_rate` | numeric | Baseline | |
| Average Client Lifetime | number (months) | `average_client_lifetime_months` | integer | Baseline | |
| Typical Win Rate | PercentageInput | `typical_win_rate` | numeric | Advanced | |
| Average Sales Cycle | Select | `average_sales_cycle` | varchar (enum) | Advanced | very_short/short/moderate/long/very_long/varies |
| Channel Mix — Referrals / Partnerships / Content / Paid / Outbound | 5× Select (rank) | `channel_referrals_rank`, `channel_partnerships_rank`, `channel_content_rank`, `channel_paid_rank`, `channel_outbound_rank` | varchar each | Advanced | rank `1`–`5` or `0`=Not at all; in-form duplicate-rank validation (1–5 unique, 0 reusable) |
| Concentration — Top 5 / 10 / 20 | 3× PercentageInput | `concentration_top5_pct`, `concentration_top10_pct`, `concentration_top20_pct` | numeric | Advanced | |
| *(code-set on save)* | — | `user_id`, `snapshot_instance_id` (client GUID, reused), `is_complete=true`; `revenue_model_synthesis=null`, `synthesis_generated_at=null` | — | — | **`is_current` NOT set** (relies on default) |

**Calculated metrics — derived in-component (require EF `monthly_agi`), persisted on save:**

| Metric | Formula | Save target |
|---|---|---|
| Avg Client Value (ACV) | `monthly_agi / active_client_count` | `average_client_value_monthly` |
| Current MRR | `monthly_agi * (mrr% / 100)` | `current_mrr` |
| Recurring Revenue (annual) | `current_mrr * 12` | `recurring_revenue_annual` |
| Project Revenue (monthly) | `monthly_agi * ((100−mrr%) / 100)` | `project_revenue_monthly` |
| Project Revenue (annual) | `project_revenue_monthly * 12` | `project_revenue_annual` |
| Annual Churn Rate | `monthly_churn_rate * 12` | `annual_churn_rate_percent` |
| Churned Clients / Year | `round(active_client_count * annual_churn/100)` | `churned_clients_per_year` |
| Replacement Revenue (monthly) | `current_mrr * (monthly_churn/100)` | `replacement_revenue_monthly` |
| Replacement Revenue (annual) | `× 12` | `replacement_revenue_annual` |
| Replacement Clients (monthly) | `active_client_count * (monthly_churn/100)` | `replacement_clients_monthly` |
| Replacement Clients (annual) | `× 12` | `replacement_clients_annual` |
| Replacement Rate (legacy) | `= monthly_churn_rate` | `calculated_replacement_rate` |
| Concentration Risk Level | thresholds: top5>70 ∨ top10>85 ∨ top20>95 → HIGH; >50/>70/>85 → MEDIUM; else LOW | `concentration_risk_level` |

**Render sources**

| Surface | What renders | Source |
|---|---|---|
| Right sidebar metrics | ACV, recurring/project rev (monthly+annual), annual churn, churned clients, replacement rev/clients (monthly+annual), concentration risk | **derived from form state + fetched EF `monthly_agi`** (live; not from DB) |
| Revenue Model Profile (`GrowthProfile`, after save) | `current_mrr`, `active_client_count`, `average_client_value_monthly`, `project_revenue_monthly`, `monthly_churn_rate` (+ churn benchmark badge), `average_client_lifetime_months`, `churned_clients_per_year` | **the saved row** (`profileData`); via `SnapshotProfileUtils` |
| Revenue Model Insights | 3 beat cards + "The Signal" | AI synthesis (n8n) — `synthesis_beat_{1,2,3}` + `_headline`, `synthesis_signal` |

**Synthesis trigger:** `POST ${VITE_N8N_WEBHOOK_URL}/agency-snapshot/revenue-model/synthesize`, hardcoded `x-architectos-secret`, body `{snapshot_instance_id, user_id, force}`; polls the row by `snapshot_instance_id` every 3s (20-retry timeout).

**Notes — persistence state vs #29 (RM is the least aligned — biggest delta):**
- **Load** `…eq('user_id').order('created_at' desc).limit(1).single()` — does **not** filter `is_current`; uses newest by `created_at`.
- **Save** is INSERT-only; does **not** set `is_current` and does **not** demote prior rows → every row stays `is_current=true` (multiple current rows accumulate, masked only because the load ignores the flag). Stale code comment claims the `is_current` column doesn't exist (it does, default true).
- **No `input_hash`** computed/written; **no `version_number` column**; **no trigger / partial unique index**. `snapshot_instance_id` reused across saves → same workflow collision risk as EF (Fetch/update by `snapshot_instance_id` ambiguous across versions).
- **Cross-tab:** pulls EF `monthly_agi` by `created_at desc` (not `is_current`) — should read EF's `is_current` AGI post-rework. Note staleness nuance: reactivating an RM combination reuses synthesis computed under whatever AGI was current then (dashboard-staleness guard covers the higher level).
- **UX quirk:** Save button is disabled when `synthesisStatus==='complete'`.
- **Backend sense-check (2026-06-24):** RLS has only **INSERT + SELECT** own-row policies — **no UPDATE or DELETE policy.** The #31 rework (reactivation `update is_current=true` + the demotion trigger, which runs as the invoking user) is **RLS-blocked without an own-row UPDATE policy** → must be added in the migration. Triggers: only `update_growth_pipeline_updated_at`; indexes: pkey + `idx_revenue_model_user_created` (no `is_current` index); `version_number` absent.
- **Workflow WF-AS-03 (assessed 2026-06-24, id `Pqv8S2H5TxipBthq`, Railway):** pre-rework structure (idempotency cluster; all Supabase nodes keyed on `snapshot_instance_id`; degenerate `{snapshot_instance_id,user_id}` hash). **Already correct:** model `claude-sonnet-4-6`; reads all fields from the base table (`Fetch Revenue Model Data` — no readable view); atomic success writeback. **Needs the WF-AS-01/02 refinements:** delete idempotency cluster, rekey every node to `id`, drop `is_current`/`input_hash` from Success, Parse carry `id` + robust error extraction, `onError='continueRegularOutput'`, Error Response → `id` (+ optional Supabase-Error `synthesis_generated_at`). Same `snapshot_instance_id`-collision bug as EF (shared id across versions), fixed by `id`-keying.

**Open build items (Revenue Model) — mirror #29 (largest delta) → specced in #31** (`31-rm-versioning-rework-{task-spec,handoff-prompt}.md` (frontend + DB trigger + UPDATE RLS + cross-tab) + `…-n8n-manual-walkthrough.md` (manual WF-AS-03 edits)):
1. `is_current` end-to-end: load filter + DB demotion trigger (`fn_rm_versioning`) + partial unique index + add `version_number` column **+ add an own-row UPDATE RLS policy** (currently missing — blocks the reactivation update + trigger demotion).
2. `input_hash` over the intake fields (incl. channel ranks + concentration) + reactivate-or-insert save.
3. `id`-keying: capture `currentRowId` on load, poll by `id`, payload `{id, user_id}`.
4. Cross-tab fix: fetch EF `monthly_agi` by `is_current` (not `created_at desc`).
5. WF-AS-03 (revenue-model) workflow refinements to match WF-AS-01/02 (assess when we wire).
6. Minor: resolve the save-disabled-on-`complete` quirk; confirm calc-metric columns as source of truth for the dashboard.

#### Delivery Architecture — `/foundations/snapshot/delivery-architecture`

> Component: `pages/SnapshotPages.tsx › DeliveryArchitectureTab`; saved-profile block via `components/snapshot/TeamProfile.tsx`. Backed by `agency_snapshot_delivery_architecture` (37 cols). **No ref tables, no readable view** (the two `ARRAY` cols are plain `text[]` multi-selects, not FK). Same synthesis/envelope + `is_current`/`snapshot_instance_id`/`input_hash`. **Cross-tab:** `agi_per_fte` needs EF `monthly_agi` (already fetched by `is_current`). Shape ≈ EF's pre-#30 state (load-on-`is_current` + insert+demote already present).

**Intake form → save targets** — all write to `agency_snapshot_delivery_architecture`; save does blanket demote + INSERT. Source = Persisted user data.

| Element | Input | Save target | Type | Section |
|---|---|---|---|---|
| Total Team Size (FTE) | number | `total_team_size_fte` | numeric | Baseline |
| Billable Staff Count | number | `billable_staff_count` | integer | Baseline |
| Non-Billable Staff Count | number | `non_billable_staff_count` | integer | Baseline |
| Team Structure Type | Select | `team_structure_type` | varchar (enum) | Baseline |
| Founder Time Allocation | Select | `founder_time_allocation` | varchar (enum) | Baseline |
| Average Team Utilization | Select | `average_team_utilization` | varchar (enum) | Baseline |
| Average Contractor Count | number | `average_contractor_count` | integer | Baseline |
| Key Leadership Roles | Multi-select | `key_leadership_roles` | `text[]` | Advanced |
| Management Layers | Select | `management_layers` | varchar (enum) | Advanced |
| Specialized Roles | Multi-select | `specialized_roles` | `text[]` | Advanced |
| Average Team Experience | Select | `average_team_experience` | varchar (enum) | Advanced |
| *(code-set on save)* | — | `user_id`, `snapshot_instance_id` (client GUID, reused), `is_complete=true`, `is_current=true` | — | — |

**Calculated metrics — derived in-component (AGI/FTE needs EF `monthly_agi`), persisted on save:**

| Metric | Formula | Save target |
|---|---|---|
| AGI per FTE (monthly) | `monthly_agi / total_team_size_fte` | `agi_per_fte_monthly` |
| AGI per FTE (annual) | `× 12` | `agi_per_fte_annual` |
| Billable : Non-Billable Ratio | `billable_staff_count / non_billable_staff_count` | `billable_ratio_calculated` |
| Contractor % | `contractor / (team_size + contractor) * 100` | `contractor_percentage_calculated` |

**Render sources:** right sidebar metrics = live from form state + EF AGI (derived); **Delivery Architecture Profile** (`TeamProfile`, after save) = the saved row (team composition, delivery model via `formatDeliveryModel`, `agi_per_fte_monthly` + badge, `billable_ratio_calculated` + badge); **Delivery Architecture Insights** = n8n `synthesis_beat_{1,2,3}` + `_headline`, `synthesis_signal`.

**Synthesis trigger:** `POST ${VITE_N8N_WEBHOOK_URL}/agency-snapshot/delivery/synthesize` (path is `delivery`, not `delivery-architecture`), hardcoded secret, body `{snapshot_instance_id, user_id, force}`; poll by `snapshot_instance_id` (20-retry).

**Notes — persistence state vs #29 (Delivery ≈ EF pre-#30):**
- Load filters `is_current` ✓; EF `monthly_agi` fetched by `is_current` ✓ (**cross-tab already correct — no fix needed, unlike RM**). Save does blanket `update is_current=false where user_id` + insert `is_current=true` (basic versioning present).
- **Missing vs #29:** `input_hash` (no dedup/reactivation); `version_number` column; **trigger + partial unique index** (demotion is frontend-side; `idx_delivery_architecture_user_current` is plain, not unique; the table has **no triggers at all**, not even `updated_at`); `id`-keying (poll + synthesis use `snapshot_instance_id`, reused → same collision risk as EF/RM).
- **Backend sense-check (2026-06-25):** RLS own-row SELECT/INSERT/UPDATE/DELETE all present (**UPDATE policy exists — no RM-style gap**), but with **redundant duplicate** INSERT/UPDATE/SELECT policies ("team data" + "team delivery snapshots"); indexes pkey + `idx_delivery_architecture_user_id` + `idx_delivery_architecture_user_current` (plain); no `version_number`; no triggers.
- **Workflow WF-AS-04 (id `pFCdviu2Y2wx284v`, Railway, updatedAt 2026-05-14):** pre-rework (untouched since WF-AS-02/03 era); endpoint `/agency-snapshot/delivery/synthesize`. Expected identical pre-rework structure (idempotency cluster, `snapshot_instance_id` keying, model `claude-sonnet-4-6`, reads base table) — exact nodes to confirm when writing the #32 walkthrough.

**Open build items (Delivery Architecture) — mirror #30 (EF) → specced in #32** (`32-da-versioning-rework-{task-spec,handoff-prompt}.md` + `…-n8n-manual-walkthrough.md`):
1. `input_hash` over the 11 intake fields (incl. the 2 sorted `text[]` arrays) + reactivate-or-insert (replace blanket demote; load-on-`is_current` already in place).
2. `version_number` column + `fn_da_versioning` trigger + partial unique index `uq_da_one_current_per_user`. (UPDATE RLS policy already present — none to add.)
3. `id`-keying: capture `currentRowId` on load, poll by `id`, payload `{id, user_id}`.
4. WF-AS-04 refinements to match WF-AS-01/02/03.
5. **No cross-tab AGI fix needed** (already `is_current`). Minor: optionally dedupe the redundant RLS policies; webhook path stays `/delivery/`.

#### Dashboard — `/foundations/snapshot/dashboard`

> Component: `components/snapshot/SnapshotDashboard.tsx`. **Output-only — no intake form.** The full cross-section "what does it all mean together" readout. Renders from the view `agency_snapshot_dashboard_view`. Backed by `agency_snapshot_dashboard` (synthesis output) + parent `agency_snapshots` (the run/instance). **The frontend is read-only + a webhook trigger — every write (parent-run creation, `input_payload` assembly, the two Anthropic calls, `is_current`/run/prior-run handling, PDF) happens in WF-AS-05.** Unlike the sub-tabs, no frontend versioning rework is expected here.

**Run-model tables:**
- `agency_snapshots` (parent run): `run_number`, `label`, the four **frozen** section FKs (`market_footprint_id` / `economic_foundation_id` / `revenue_model_id` / `delivery_architecture_id` = the sub-tab row IDs used in this run), `status`. **No `is_current`.**
- `agency_snapshot_dashboard` (output): `snapshot_id` → parent (NOT NULL), `run_number`, `is_current`, `prior_run_id`, `days_since_prior_run`, `input_payload` (jsonb, NOT NULL — assembled four-section inputs), `status` (`pending`/`processing_call_1`/`processing_call_2`/`complete`/`failed_call_1`/`failed_call_2`), AI outputs, `pdf_url` + `pdf_generated_at`, provenance (`gpt_model_used`, `gpt_tokens_consumed`, `prompt_version`, `error_message`).

**View `agency_snapshot_dashboard_view` (render contract):** `dashboard d JOIN agency_snapshots s ON s.id=d.snapshot_id LEFT JOIN the 4 sub-tabs ON their id = s.<section>_id WHERE d.is_current=true`. So it joins sub-tabs by the **frozen** parent IDs (historical integrity) and returns **only the current** dashboard.

**Render elements → source:**

| Element | Source |
|---|---|
| Page header (snapshot label, last updated) | view `snapshot_label` (from parent `s.label`), `generated_at` |
| Download Report | `pdf_url` (Supabase Storage; n8n + Google Docs pattern) |
| Previous Snapshots modal | base `agency_snapshot_dashboard` by user, `generated_at` desc (label + `pdf_url`); **historical = PDF-only** (view returns current only) |
| Business Vitals strip (deterministic) | view joins: `ef.annual_revenue_run_rate`, `ef.annual_agi_run_rate`, `ef.profit_margin_percentage`, `da.total_team_size_fte`, `rm.active_client_count`, `rm.monthly_churn_rate` |
| At-a-Glance (per sub-tab) | view joins: `mf/ef/rm/da` `synthesis_signal` + `synthesis_beat_{1,2,3}` (+ headlines) — the sub-tabs' own synthesis |
| Executive headline + summary | AI **Call 1** — `executive_headline`, `executive_summary` |
| 5 Signals (headline / body / so-what) | AI **Call 1** — `signal_1..5_*` |
| 3 Implications (headline / body) | AI **Call 2** — `implication_1..3_*` |
| Synthesis statement | AI **Call 2** — `synthesis_statement` |

**Trigger / load:** Generate → `POST ${VITE_N8N_WEBHOOK_URL}/agency-snapshot/dashboard/synthesize` body `{ user_id, force }` (fire-and-forget; uses the `WEBHOOK_SECRET` const). Poll `agency_snapshot_dashboard` by `user_id` + `is_current` → `{id, status}`; on `complete` load the view by `dashboard_id`. Status drives the lifecycle UI (`not_generated`/`processing_call_1`/`processing_call_2`/`complete`/`failed_call_1`/`failed_call_2`).

**Notes — run model + design questions (align before WF-AS-05 work):**
- **WF-AS-05 owns the whole run model.** On generate it must: create the parent `agency_snapshots` row capturing the four **current** (`is_current`) sub-tab row IDs; set `run_number`; create the `agency_snapshot_dashboard` row (`snapshot_id`, `run_number`, `is_current=true` + **demote prior dashboard**, `prior_run_id` + `days_since_prior_run`); assemble `input_payload`; run **Anthropic Call 1** (exec headline/summary + 5 signals) → write; run **Call 2** (3 implications + synthesis statement) → write; drive the `status` transitions; then generate the **PDF** (Google Docs merge → Storage → `pdf_url`).
- **Frontend already correct:** read-only, polls by `is_current`; no rework expected.
- **View join verified:** by frozen parent IDs, `is_current` only.
- **Run-model decisions (soft-locked 2026-06-25):**
  - **New run per generate** — each dashboard generation = a new dashboard run; the parent `agency_snapshots` row **freezes the four current (`is_current`) sub-tab version IDs** that fed it. The two run counters (`agency_snapshots.run_number` / `agency_snapshot_dashboard.run_number`) move together (one parent run = one dashboard run).
  - **Forward-only regenerate** — regenerate uses the current `is_current` sub-tabs → new run; prior runs persist as historical rows with frozen provenance + PDF. "Revert" = regenerate; **no per-version self-selection UI**.
  - **Provenance visibility** — surface per dashboard run which sub-tab versions composed it (resolve the parent's frozen FKs → each section's `version_number`), shown in Previous Snapshots (and optionally on the current dashboard).
  - **Staleness flag** — when the current dashboard's frozen section IDs differ from the user's current `is_current` section rows, show "sub-tabs changed since this was generated — regenerate."
  - **Integrity guarantee:** sub-tab version rows referenced by any `agency_snapshots` run must **never be deleted** (else a historical dashboard's frozen-join nulls out). Verify `agency_snapshots → section` FKs are `ON DELETE RESTRICT`/`NO ACTION` (not CASCADE/SET NULL); exclude run-referenced rows from any future cleanup. WF-AS-05 must capture the **current `is_current`** section IDs at generation.
  - `is_current` lives on the dashboard only (not the parent) — sufficient (parent is identified via `dashboard.snapshot_id`).
- **WF-AS-05 risks to check (as with the sub-tabs):** model id (`claude-sonnet-4-6`?) on **both** calls; `onError` hardening on both; atomic writes per call; correct `status` transitions incl. `failed_call_1/2`; the PDF path; and the parent-creation + `is_current` demotion + `prior_run` linkage logic. (Provenance cols named `gpt_*` — legacy naming.)

**Open build items (Dashboard):**
1. Pull + critique **WF-AS-05** (parent creation, payload assembly, two-call synthesis, `is_current`/`run_number`/`prior_run`, status transitions, PDF) — the bulk of the work; manual n8n edits.
2. Resolve the run-model design Qs (staleness, dedup, run counters) with London.
3. Possible minor frontend follow-ups only if a staleness indicator is wanted (otherwise none).

### Wiring Log (Agency Snapshot)

**#29 — Market Footprint versioning + `is_current` rework (frontend + DB trigger applied + verified 2026-06-24; n8n + end-to-end pending).** Handoff `docs/handoffs/29-mf-versioning-rework-*`.
- **Migration applied:** `version_number` column; backfill (per-user version numbers + most-recent row set current, nothing deleted); `fn_mf_versioning` + `trg_mf_versioning` (BEFORE INSERT OR UPDATE — assigns `version_number`, demotes siblings when a row goes current); partial unique index `uq_mf_one_current_per_user UNIQUE(user_id) WHERE is_current IS TRUE`.
- **Independently verified (live SQL):** all four objects present; backfill = one current per user, sequential version numbers; **real INSERT test** (existing user) → trigger assigned `version_number=2`, set current, demoted prior to `false`; **reactivation** (re-promote v1) → v2 demoted, 2 rows / 1 current throughout; test row deleted, user restored.
- **Frontend verified (code read — `components/snapshot/IdentityPositioningTab.tsx`):** `snapshot_instance_id` removed (only a comment remains); load filters `is_current=true` (`maybeSingle` now safe); `computeInputHash` canonical (sorted, `other`/`generalist`-filtered arrays + trimmed→null scalars, fixed key order → SHA-256 hex); save = reactivate-or-insert by `(user_id, input_hash)` (resurfaced → `update is_current=true` + hydrate cached synthesis, no workflow; net-new → insert, promote-on-insert); insert omits `version_number`/`snapshot_instance_id`/`synthesis_status`; synthesis POST `{ id, user_id }`; poll by `id`. TS-clean per build report (pre-existing errors only, unrelated files).
- **Observation (not a defect):** existing rows carry **legacy** short `input_hash` values (e.g. `f62`) from the prior workflow, not canonical SHA-256 — so pre-migration rows won't dedupe against newly-computed hashes (a returning user re-entering an old combination creates a new version instead of reactivating the legacy row). Benign (seed/test rows; save gated on `hasChanges`); recompute or clear seed before beta.
- **n8n verified (live read 2026-06-24):** WF-AS-01 edits applied correctly — idempotency cluster (5 nodes) removed; `Check Validation` → `Upsert Status Running` rewired; `Validate & Normalize` requires `{id, user_id}` only; all Supabase nodes filter on `id`; `Supabase - Success` no longer writes `is_current`/`input_hash`; `Parse & Validate JSON` carries `id`; Anthropic reads `website_url`/`positioning_context` from the readable view. Production webhook: `https://primary-production-fab5.up.railway.app/webhook/agency-snapshot/market-footprint/synthesize`. **Minor open (cosmetic):** `Error Response (500)` body still references `snapshot_instance_id` (now always null); `synthesis_model` stamp `claude-sonnet-4-6` ≠ actual id `claude-sonnet-4-20250514`.
- **Config confirmed (2026-06-24):** `VITE_N8N_WEBHOOK_URL = https://primary-production-fab5.up.railway.app/webhook` (per `.env.local`).
- **Readable-view resolution proven (2026-06-24):** inserted a realistic temp row → `agency_snapshot_market_footprint_readable` returned correct labels for all fields (agency types, services, industries, geo label, pricing labels, website, context); temp row deleted.
- **Worker + model fixes → end-to-end VERIFIED (2026-06-24).** Two infra issues surfaced and were fixed: (1) the Railway n8n **queue worker was down** (jobs stuck `new`, backlog to May 26) → redeployed; (2) first real run hit a **model 404** — `Anthropic Call 1` was set to `claude-sonnet-4-20250514` (not available) → updated to **`claude-sonnet-4-6`** (matches the `Supabase - Success` stamp, resolving the earlier label mismatch). Re-run **execution #9227 succeeded (16s)**: row `44589d4f…` (user 4ef8c0e3 v2) written back **complete** with all 3 beats + headlines + `synthesis_signal` + `synthesis_payload` + `synthesis_model=claude-sonnet-4-6` + `prompt_version=v1` + `synthesis_generated_at`, `is_current=true`. Finding-#2 atomic writeback contract satisfied **live**.
- **Reactivation VERIFIED live (2026-06-24).** In-app: removing an agency-focus selection created a new version (v3 `de97fd7a`, canonical 64-char hash, no synthesis, promoted current); re-adding it re-matched v2's hash → **reactivated v2** (`44589d4f`, cached synthesis) as current, demoted v3, **no duplicate row and no workflow call**. DB confirms user 4ef8c0e3: v2 `is_current=true` (complete + beats), v3 `is_current=false` (null synthesis). Option A reactivation works end-to-end.
- **`Error Response (500)` fixed + verified (2026-06-24):** response body now returns `id` (no `snapshot_instance_id`).
- **Failure hardening VERIFIED (2026-06-24):** `Anthropic Call 1` `onError='continueRegularOutput'` + `Parse & Validate JSON` robust string-or-object error extraction — confirmed in the published workflow. A thrown Anthropic call routes its error item into `Parse` → `Supabase - Error` (writes `synthesis_status='error'` + `synthesis_error`) instead of stranding the row on `running`; the frontend's error+Retry state takes over. (Forced-failure live test optional — config + the proven `Parse → Switch → Supabase-Error` path are sound.)
- **MARKET FOOTPRINT — SOFT-LOCKED (2026-06-24).** End-to-end verified live: intake save → versioned `is_current` row → webhook → n8n synthesis (`claude-sonnet-4-6`) → atomic writeback → render; reactivation re-promotes cached versions with no workflow call; failure path writes `error`. **Housekeeping done (2026-06-24):** seed cleared across all Agency Snapshot data tables — `dashboard`, `snapshots`, `economic_foundation`, `revenue_model`, `delivery_architecture` all emptied; `market_footprint` reduced to the single real entry `44589d4f` (user 4ef8c0e3, `is_current`, complete) kept for the eventual full-dashboard run; ref/library tables untouched. Optional remaining: forced-failure live test.
- **Replication template for the remaining sub-tabs (Economic Foundation, Revenue Model, Delivery Architecture).** Each follows the Market Footprint pattern: map intake→table save targets + render/synthesis provenance; frontend versioning rework (canonical `input_hash`, reactivate-or-insert, `is_current` load, poll/POST by row `id`) + the shared DB-trigger model; n8n workflow refinements (drop idempotency cluster, key every node on `id`, atomic success writeback, `onError='continueRegularOutput'`); then verify + live-test. Note the Delivery webhook path is `/delivery/synthesize` (not `/delivery-architecture/`). The three text/single-select sub-tabs won't need readable views (MF-only).

**#30 — Economic Foundation versioning + `is_current` rework (frontend + DB trigger + WF-AS-02 applied + verified 2026-06-24; in-app live synthesis pending).** Handoff `docs/handoffs/30-ef-versioning-rework-*`.
- **Migration applied:** `version_number` column; `fn_ef_versioning` + `trg_ef_versioning` (BEFORE INSERT OR UPDATE — assigns `version_number`, demotes siblings when a row goes current); partial unique index `uq_ef_one_current_per_user UNIQUE(user_id) WHERE is_current` (plain `idx_economic_foundation_current` left in place). Table was empty → backfill no-op.
- **Independently verified (live SQL):** real INSERT test (existing user) → A=v1, B=v2 with B current + A demoted; reactivation (re-promote A) → A current, B demoted, 2 rows / 1 current throughout; test rows deleted (EF table back to empty).
- **Frontend verified (code read — `pages/SnapshotPages.tsx › FinancialSnapshot`):** `computeEFInputHash` (13 inputs, fixed order, normalized → SHA-256); load captures `currentRowId` (`is_current` filter already present); save = reactivate-or-insert by `(user_id, input_hash)`, blanket demote removed; insert omits `version_number`/`snapshot_instance_id`/`synthesis_status`; synthesis POST `{id, user_id}`; poll by `id`; `snapshot_instance_id` only a comment (remaining hits in `SnapshotPages.tsx` are the other two sub-tabs). TS-clean per build report.
- **WF-AS-02 verified (live read):** idempotency cluster removed; all Supabase nodes filter on `id`; `Validate` requires `{id, user_id}`; `Supabase - Success` drops `is_current`/`input_hash`; `Parse` carries `id` + robust string-or-object error extraction; `Anthropic Call 1` `onError='continueRegularOutput'`, model `claude-sonnet-4-6`; `Supabase - Error` writes `synthesis_generated_at`; Error Response uses `id`.
- **In-app live test PASSED (2026-06-24, exec #9228):** net-new save → versioned row `f47ab8d3` (v1, `is_current`, canonical 64-char hash) → WF-AS-02 synthesis (`claude-sonnet-4-6`) → atomic writeback `complete` with beats + signal, rendered in-app. EF active-bug (shared `snapshot_instance_id`) resolved by `id`-keying. **Economic Foundation — wired + verified end-to-end.**
- **Mock-data note:** the test entry saved `cash_available = $7,000` (intended $700,000) → `cash_runway_months ≈ 0.0` (Critical) and the synthesis built a 'near-zero cash / liquidity locked in billing cycle' narrative — internally consistent with the input but not the intended mock. Recommend correcting to $700,000 (re-save → new version + re-synthesize) before the full dashboard run so the mock agency reads coherently.

**#31 — Revenue Model versioning + `is_current` rework (frontend + DB trigger + RLS applied + verified 2026-06-25; WF-AS-03 needs publish — see flag).** Handoff `docs/handoffs/31-rm-versioning-rework-*`.
- **Migration applied + verified (live SQL):** `version_number`; **own-row UPDATE RLS policy** added (was missing — INSERT/SELECT only before); `fn_rm_versioning` + `trg_rm_versioning`; partial unique index `uq_rm_one_current_per_user` (plain `idx_revenue_model_user_created` left). Real INSERT test (existing user) → A=v1, B=v2 (B current, A demoted); reactivation → A current, B demoted, no third row; test rows deleted (RM table empty).
- **Frontend verified (code read — `pages/SnapshotPages.tsx › GrowthPipeline`):** `computeRMInputHash` (15 inputs); load by `is_current` + `currentRowId`; **EF `monthly_agi` fetched by `is_current`** (cross-tab fix); reactivate-or-insert by `(user_id, input_hash)` (update match else insert); insert omits `version_number`/`snapshot_instance_id`/synthesis; POST `{id, user_id}`; poll by `id`; **Save gated on dirty/validity** (not `synthesisStatus==='complete'`); no `snapshot_instance_id` in `GrowthPipeline`. TS: RM-clean (pre-existing EF/Delivery `Button size`-prop errors remain — see Go-Live).
- **WF-AS-03 — published + verified working (2026-06-25):** `Upsert Status Running` keyName fixed to `id` and the workflow republished. First in-app attempt (exec #9230) hit `Validation Failed` because the **frontend bundle was stale** (posted the old `{snapshot_instance_id, force}` shape); resolved by restarting the dev server + hard refresh. Re-run then posted `{id, user_id}`, validated, and wrote back `complete` with beats + signal to the `is_current` row (`ceb9f0d9`). **Revenue Model — wired + verified end-to-end.**
- **Mock-row hygiene (minor):** the RM mock row (`ceb9f0d9`) was first saved on the stale bundle, so it carries an old-style `snapshot_instance_id` + null `input_hash` (synthesis later completed on it by `id`). Renders + is current; just won't participate in hash-dedup/reactivation. Optional cleanup (tweak-and-resave on the fresh bundle, or null its `snapshot_instance_id`); harmless for the dashboard run.

**#32 — Delivery Architecture versioning + `is_current` rework (frontend + DB trigger applied + verified 2026-06-25; WF-AS-04 fixes pending).** Handoff `docs/handoffs/32-da-versioning-rework-*`.
- **Migration applied + verified (live SQL):** `version_number`; `fn_da_versioning` + `trg_da_versioning`; partial unique index `uq_da_one_current_per_user` (plain `idx_delivery_architecture_user_current` left); own-row UPDATE RLS policy already existed (none added). Real INSERT test (existing user) → A=v1, B=v2 (B current, A demoted); reactivation → A current, B demoted, no third row; test rows deleted (DA table empty). *(Building agent used the Supabase CLI fallback — MCP `apply_migration` timed out; objects confirmed present via MCP `execute_sql`.)*
- **Frontend verified (code read — `DeliveryArchitectureTab`):** `computeDAInputHash` (11 inputs incl. sorted `key_leadership_roles`/`specialized_roles`); load by `is_current` + `currentRowId`; EF `monthly_agi` fetch already `is_current` (unchanged); save = reactivate-or-insert by `(user_id, input_hash)`, blanket demote removed; insert omits `version_number`/`snapshot_instance_id`/synthesis; POST `{id, user_id}`; poll by `id`. Whole `SnapshotPages.tsx` now has **zero** `snapshot_instance_id`/`crypto.randomUUID` usage (only comments). TS: DA-clean (the EF retry `Button size` prop at ~line 1094 remains — pre-existing, in Go-Live).
- **WF-AS-04 — fixed + published + verified working (2026-06-25):** the `Parse & Validate JSON` stray `{{ $now.toISO() }}` was restored to the robust error check, `Anthropic Call 1` `onError='continueRegularOutput'` set, and the workflow republished. In-app test (exec #9232, 16.6s, full green path → `Supabase - Success`) wrote back `complete` with beats + signal to a clean new-model row (`c97fd311`: `input_hash` 64-char, `snapshot_instance_id` null, `version_number=1`, `is_current=true`). **Delivery Architecture — wired + verified end-to-end.** Mock row is clean (no residue) — good for the dashboard run.

---

## Go-Live Gaps (running list)

| Tool / page | Gap | Source |
|---|---|---|
| Architect Evolution · Results | Route temporarily gated `architect_evolution`; flip to `architect_evolution_dashboard` before launch | `App.tsx` inline note |
| Architect Evolution · Assessment | Scoring weights now live on `founder_evolution_questions.options` (#23 ✓). Frontend still hardcodes the question set — wire read-from-table in #24 | `FounderEvolutionAssessment` |
| Architect Evolution · Assessment | Backend persist+score is built (`submit_founder_evolution`, #23 ✓). Frontend still navigates without saving — wire the RPC call in #24 | `FounderEvolutionAssessment` |
| Architect Evolution · backend | ✅ RESOLVED (#24) — 6 columns dropped, tables+functions renamed to `fe_*`, key-case lowercased; `fe_results ⋈ fe_profiles` join verified live | #24 |
| Architect Evolution · naming (V-13) | ✅ RESOLVED (#25) — route + redirects, both gate keys, components/files, and tool-name copy aligned to "Architect Evolution"; framework vocab preserved | #25 |
| Architect Evolution · cleanup | Delete the now-orphaned legacy stub `pages/FounderEvolutionPages.tsx` (no importers) | fold into #26 |
| Architect Evolution · Assessment/Results | ✅ RESOLVED (#26) — wired to `fe_questions` / `fe_submit_assessment` / `fe_results ⋈ fe_profiles`; mock removed; stub deleted | #26 |
| Architect Evolution · live QA | Confirm the full logged-in round-trip (browser → `fe_submit_assessment` → results render) in an authenticated app session — not testable via SQL (`auth.uid()`) | QA before launch |
| Architect Evolution · buttons | Download Guide + Discovery Call are inert; wire both once PDFs are uploaded to Storage + booking URL supplied (the final pass for this tool) | Go-Live |
| Architect Evolution · Assessment UX | ✅ RESOLVED (#27) — one-question-at-a-time wizard; no role/style distinction; wiring unchanged | #27 |
| Architect Evolution · Profiles | `pdf_url` empty for all 15; backfill after companion-guide PDFs created + uploaded to Storage | Storage |
| Architect Evolution · Overview | "13 questions" / "3 minutes" hardcoded in landing copy; won't track changes to the question set (candidate to derive) | `FounderEvolutionLanding` |
| Architect Evolution · Results | Whole page renders from `MOCK_PROFILE` / `MOCK_RESULT`; wire to live results row + cross-section profile row (15 cross-sections), keyed by `profileKey` | `FounderEvolutionResults` |
| Architect Evolution · Results | Score → 2×2 dot-placement logic needs to be built (result → x/y coordinates) | `FounderEvolutionResults` |
| Architect Evolution · Results | 15 cross-section Companion Guide PDFs need to be created + uploaded to Supabase Storage; URL stored on each cross-section record and wired into "Download Guide" | `FounderEvolutionResults` |
| Architect Evolution · Results | Discovery Call booking URL needs to be added (then locked) | `FounderEvolutionResults` |
| Agency Snapshot · Market Footprint | Persistence is single-row-per-user overwrite; rework to `is_current` versioning (insert new row per save, flip flag, render `is_current=true`) for intake + synthesis | `IdentityPositioningTab` |
| Agency Snapshot · Market Footprint | No per-section run-count column; decide derive (row count) vs explicit `run_number` on the section table | schema |
| Agency Snapshot · Market Footprint | Hardcoded `x-architectos-secret` ships in the client bundle; decide env var vs server-side proxy vs leave (founder-only beta) | `IdentityPositioningTab` |
| Agency Snapshot · Market Footprint | Dead consts `SERVICE_OPTIONS`/`INDUSTRY_OPTIONS` unused; static right-panel "Positioning Analysis" sidebar never reflects synthesis | `IdentityPositioningTab` |
| Agency Snapshot · Dashboard | Any sub-tab update must stale / require a new full-dashboard synthesis (two-tier run counters) | dashboard phase |
| Agency Snapshot · Market Footprint | n8n write-contract: workflow must set `synthesis_status='complete'` + all beat/headline/signal columns **atomically** (+ model/prompt_version/generated_at; error→status+error). Render breaks silently when status and beats disagree (confirmed in live data) | `IdentityPositioningTab` / n8n |
| Agency Snapshot · infra (n8n / Railway) | **MONITOR** — Serverless/App-Sleeping disabled on the n8n worker + main (Option A, 2026-06-24) so the worker stops sleeping & the queue stops stalling. Watch for Hobby-plan edge-case sleeps; **upgrade to a Pro/always-on tier before go-live**; never set an HTTP healthcheck on the worker. (Alt for later: `EXECUTIONS_MODE=regular` to drop the worker entirely.) | Railway settings |
| Agency Snapshot · Revenue Model | **WF-AS-03 not live** — reworked draft unpublished; active version is half-reworked and breaks the writeback (`snapshot_instance_id` keys vs simplified `Validate`). Fix `Upsert Status Running` keyName → `id`, then Publish | n8n WF-AS-03 |
| Snapshot components · TypeScript | Pre-existing TS errors in `SnapshotPages.tsx`: EF + Delivery retry buttons pass a `size` prop `Button` doesn't accept. Resolve for a TS-clean build (RM retry already fixed in #31) | `SnapshotPages.tsx` |
| Platform · build | `npm run build` hits a Vite/Rollup emitted-HTML path issue (relative-path resolution under the repo); pre-existing, investigate before go-live | build config |
