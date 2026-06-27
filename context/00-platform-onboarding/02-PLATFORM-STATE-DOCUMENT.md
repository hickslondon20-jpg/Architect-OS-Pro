# ARCHITECT OS — PLATFORM STATE DOCUMENT

> **Maintenance Note:** This document is updated at meaningful milestones — typically when a feature area has been completed or significantly advanced. When updating, replace outdated content rather than appending. Do not stack changelogs. Keep it current, honest, and lean.

---

## Platform Overview

Architect OS is a strategic operating system for independent agency founders. It is not a project management tool, a CRM, or a generic business dashboard. It is the orchestration layer that sits above operational tools — codifying the Architect Method into a continuous execution engine designed to eliminate strategic drift, prevent shelfware, and enable genuine team alignment and change management.

The core problem it solves is structural: most agencies have access to good strategic advice, but no system to translate that advice into sustained execution. Plans get made. Plans get shelved. Quarters drift. Architect OS closes that loop by connecting diagnosis, planning, and execution into a quarterly rhythm that compounds over time — so each quarter builds on the last rather than starting from scratch.

The platform serves agency founders across four tiers of access. **Free (Tier 0)** gives open access to the Growth Velocity Simulator and foundational orientation tools for lead capture and awareness. **AE Ladder Snapshot (Tier 1)** provides stage placement and a basic growth diagnostic. **Full Diagnostic (Tier 2)** unlocks the complete 125-question Maturity & Readiness Audit with weighted recommendations. **Architect OS Pro (Tier 3)** is the full execution suite — roadmap planning, sprint management, progress tracking, the Virtual CSO, financial trend analysis, and the quarterly review engine — designed to run continuously as a recurring service.

---

## Feature Areas

---

### 1. Platform Shell & Navigation

**Vision**
The platform shell provides the structural foundation for the entire user experience. It handles authentication, tier-based access control, routing across all sections, and a consistent navigation architecture. The shell is intentionally minimal — the goal is to make the tool feel precise and purposeful, not feature-heavy.

**Current State**
The shell is functional and structurally complete. Authentication is implemented via Supabase through a dedicated `AuthContext`, with a `ProtectedRoute` component wrapping all authenticated paths. Routing is handled with React Router (hash-based, via `HashRouter`), and the full route tree is defined in `App.tsx` — covering Foundations, Diagnostics, Pro Suite, Resources, and Settings. A `Sidebar` component and `DashboardLayout` / `SectionLayout` wrappers provide consistent navigation chrome across sections. A shared `ErrorBoundary` component is in place. The Settings section includes Account, Subscription, Data Manager, Privacy, and Referrals routes, though most of these pages are structural shells without functional backend logic.

Tier-based access control is architecturally present via `AuthContext` and `AppContext`, but gating logic (restricting specific routes or features based on subscription tier) has not been fully enforced in the UI. Users can navigate to Pro Suite routes regardless of tier in the current build.

**Remaining Work**
- [ ] Implement tier-based route gating so Free and Tier 1 users are redirected or shown upgrade prompts when accessing Tier 2 / Pro content
- [ ] Connect Subscription settings tab to Stripe or equivalent payment system for live tier management
- [ ] Build out Account, Data Manager, Privacy, and Referrals settings pages beyond structural shells
- [ ] Add an onboarding flow for new users (post sign-up orientation before reaching the dashboard)
- [ ] Confirm that the `DashboardPage` provides meaningful orientation for users at different tiers — currently it is a minimal placeholder

---

### 2. Agency Snapshot

**Vision**
The Agency Snapshot is the platform's foundational profile builder. It captures current-state vitals for the agency — its market identity, financial structure, revenue model, and delivery architecture. This is not a static form. It is the data layer that powers contextual intelligence across the rest of the platform, including the Clarity Compass, the GV Simulator, and the Virtual CSO. Without a populated Snapshot, the platform cannot personalize its guidance.

**Current State**
The Agency Snapshot is among the most complete feature areas in the build. It is a multi-tab section with four active input tabs — **Market Footprint**, **Economic Foundation**, **Revenue Model**, and **Delivery Architecture** — plus a **Dashboard** overview tab. All tabs have functional form fields with save logic wired to Supabase. The save operations have been tested and debugged, including JSONB payload structures and foreign key relationships. A `SnapshotDashboard` view renders a summary of the saved profile.

The data saved in the Snapshot is accessible to downstream tools. Field mappings and naming conventions are documented in a dedicated context folder (`context/agency-snapshot/`), and a PRD exists codifying the feature's philosophy and data model.

**Remaining Work**
- [ ] Wire Snapshot data into the GV Simulator auto-population so Block 1 fields pre-fill from saved profile data
- [ ] Wire Snapshot data into the Virtual CSO's context layer so the AI advisor has access to the agency's profile
- [ ] Confirm that all four tabs surface their saved data correctly on return visits (data persistence / re-hydration)
- [ ] Evaluate whether the Snapshot Dashboard provides enough summary value, or whether it needs richer rendering of the saved profile
- [ ] Flag: The Snapshot does not currently include a Clarity Compass integration — the two tools should share positional context but the connection is not yet built

---

### 3. Growth Velocity Calculator (GV Simulator)

**Vision**
The Growth Velocity Simulator is the platform's free-tier diagnostic tool. It models growth velocity by surfacing the six Pressure Families acting on the agency and reveals the structural constraints on revenue growth. It is designed to function as an educational lead magnet — giving founders genuine insight before they commit to a paid tier — while capturing enough context to feed into more advanced platform features.

**Current State**
The GV Simulator is one of the most developed features in the build. The **Calculator** tab (`GVCalculatorPage.tsx`) is functionally complete: it accepts structured inputs, runs the velocity model, and renders output. The UI has been through multiple rounds of refinement, including field alignment improvements and form layout polish. A **Scenario Planner** tab exists alongside the calculator, offering Build Mode and Compare Mode for modeling multiple growth scenarios. The Scenario Planner has functional save logic for both scenarios and comparisons, wired to Supabase via a migrated schema. Visual analysis (Recharts-based) and a GPT Synthesis section exist in Compare Mode, though the GPT Trigger is not yet connected to a live workflow. A Supabase schema migration for GVS tables has been completed and documented.

The Scenario Planner's four preset growth scenarios have been updated to match the PRD. Auto-population of Scenario Planner Block 1 from Agency Snapshot data was scoped but not yet implemented.

**Remaining Work**
- [ ] Wire GPT Trigger in Compare Mode to the appropriate n8n workflow or direct AI call for strategic synthesis
- [ ] Auto-populate Block 1 of the Scenario Planner from saved Agency Snapshot data
- [ ] Implement lead capture logic at the Free tier boundary (GVS results as email gate or tier upgrade prompt)
- [ ] Validate that Scenario Planner save logic handles all edge cases (unique constraint violations, duplicate prevention) consistently
- [ ] Confirm the Pressure Family output logic surfaces the correct frictions for each scenario result profile

---

### 4. Clarity Compass

**Vision**
The Clarity Compass is the vision and positioning clarity tool. It guides the founder through a time-horizoned reflection process — defining their 12-month, 24-month, and 36-month visions alongside an ultimate vision — and synthesizes these inputs into a strategic positioning statement. The goal is to make the founder's vision explicit, legible to the platform, and connected to the rest of the execution system.

**Current State**
The Clarity Compass has a functionally structured frontend. The **Vision State** tab (`ClarityPages.tsx`) contains the multi-horizon input form with a full field set. A **Dashboard** tab renders a summary view, and a **History** tab provides an archive of prior submissions. The backend schema for Clarity Compass was recently migrated to Supabase (six tables, with RLS policies applied). The save flow and submit logic have been implemented and debugged, including integration with an n8n webhook for generating AI synthesis. A `LoadingOverlay` component provides visual feedback during synthesis generation, with a Supabase Realtime listener signaling completion.

A detailed spec document exists at `context/clarity-compass/00-clarity-compass-spec` covering the full input structure, horizon frameworks, and synthesis logic. Draft content for each horizon phase has also been written into the context folder.

The synthesis generation via n8n is wired but should be treated as partially functional — dependent on the n8n workflow being active and correctly configured. The History tab exists as a structural route but its data rendering completeness should be verified.

**Remaining Work**
- [ ] Verify that the n8n synthesis webhook is stable and returns expected GPT output to the Supabase `synthesis_output` field correctly
- [ ] Confirm the History tab renders archived submissions with correct hierarchy and display formatting
- [ ] Connect Clarity Compass positioning output to the Agency Snapshot context layer (so the two tools share strategic identity data)
- [ ] Evaluate whether the Clarity Compass Dashboard view provides sufficient insight value after synthesis is generated
- [ ] Flag: The Clarity Compass does not yet feed into the Virtual CSO knowledge base — this connection is deferred but must be tracked

---

### 5. AE Ladder Assessment

**Vision**
The AE Ladder Assessment is the 19-question stage orientation diagnostic. It places the agency on one of five maturity stages — Rising, Striving, Thriving, Driving, or Arriving — and produces a stage placement with associated narrative guidance. It is the first paid diagnostic (Tier 1), designed to give founders language for what they are experiencing and a calibrated starting point for deeper work.

**Current State**
The AE Ladder Assessment is functionally built. The assessment flow includes an **Intro** page, a multi-step **Assessment** wizard (`Tools.AEAssessment`) that delivers the 19 questions, and a results routing flow. The wizard includes a `LoadingOverlay` with progress animation and redirects to the results dashboard on completion. Submission logic writes to Supabase, and a scoring function has been implemented and tested. The scoring function has been audited against raw response data and cross-validated for correctness.

A detailed context file at `context/aeladder_assessment/00-ae-ladder-assessment-dashboard-config` contains the full assessment question set, scoring logic, and stage output configuration. Associated context docs cover the dashboard spec and Stage Deep Dive tab spec.

**Remaining Work**
- [ ] Verify that `created_at` timestamps populate correctly on all `ae_assessments` records during the scoring function update flow
- [ ] Confirm that the assessment blocks re-entry or correctly handles a user who has already completed it (retake logic or lock state)
- [ ] Wire tier gating so that Tier 0 users are prompted to upgrade before accessing the assessment
- [ ] Validate the full end-to-end flow: submission → scoring → redirect → results dashboard → correct stage placement display

---

### 6. AE Ladder Dashboard

**Vision**
The AE Ladder Dashboard renders the results of the stage assessment. It shows the agency's placed stage, the characteristics and demands of that stage, and provides a Stage Deep Dive tab that expands into structural guidance and dimension-level insight. It is the first results interface the user sees after completing a diagnostic, and it sets the tone for the rest of the platform.

**Current State**
The AE Ladder Results Dashboard (`Tools.AEResultsDashboard`) is built and routed. A blank screen error that previously blocked access was debugged and resolved. The **Stage Profile** tab (`Tools.AEStageProfile`) is also routed at `/diagnostics/ae-ladder/stage-profile`. The dashboard reads stage placement data from Supabase and renders the appropriate stage content. A Stage Deep Dive tab is specified in the context documentation and its structure is defined in `context/aeladder_assessment/02-ae-ladder-context-tab-spec`.

The dashboard spec (`01-ae-ladder-dashboard-spec`) documents the intended layout, content structure, and capability area display logic in detail.

**Remaining Work**
- [ ] Verify that the Stage Deep Dive tab is fully rendered and not a structural shell — confirm it surfaces dimension-level narrative, not placeholder text
- [ ] Confirm the `NextMilestoneCTA` component styling is correctly rendering (dark blue main background, white/gray callout section) as the previous styling fix should be validated
- [ ] Add a clear pathway from the AE Ladder Dashboard into the M&R Audit (the natural next step for Tier 2 upgrade)
- [ ] Confirm the dashboard handles a user with no assessment data gracefully (empty state vs. redirect)
- [ ] Flag: n8n-generated AI insights are not yet wired into the AE Ladder Dashboard — this is intentionally deferred

---

### 7. Maturity & Readiness Audit

**Vision**
The Maturity & Readiness Audit is the platform's comprehensive 125-question diagnostic. Organized across 5 Dimensions, 25 Capability Areas, and 125 Checkpoints, it produces a full capability maturity score, pillar-level scores, and dimension-level scores — calibrated to the agency's AE Ladder stage. It is the Tier 2 diagnostic that unlocks weighted, prioritized recommendations and forms the data foundation for the Pro Suite execution engine.

**Current State**
The M&R Audit assessment flow is routed and structurally built. The **Overview** page (`Tools.MRAuditOverview`), **Assessment** wizard (`Tools.MRAssessment`), and **Results** page (`Tools.MRResults`) are all defined and accessible. The Supabase schema for the M&R Audit is comprehensive and documented in detail at `context/mr-audit/03-MR-Audit-schema-and-scoring-logic`, covering all score tables (capability, pillar, dimension, overall). A scoring engine has been implemented and audited — scores and tags were cross-validated against raw response data for the test assessment, with discrepancies identified and resolved.

The checkpoint data model (`context/mr-audit/01-MR-Checkpoint-data-model`) and scoring engine spec (`context/mr-audit/02-MR-Assessment-Scoring-Engine`) exist as detailed reference documents. The dashboard spec is documented at `context/mr-audit/MR-audit-dashboard`.

The assessment front-end (125 questions across multi-step wizard) and submission flow are built, though the full fidelity of question rendering, section progression, and submission confirmation should be verified end-to-end.

**Remaining Work**
- [ ] End-to-end test the full 125-question assessment: section progression, answer persistence, and final submission
- [ ] Verify the submission flow correctly triggers the scoring function and populates all score tables
- [ ] Wire tier gating — M&R Audit should require Tier 2 access; confirm the gate is enforced
- [ ] Confirm the assessment handles session interruption (partial save / resume logic) or document that this is not yet supported
- [ ] Flag: The M&R Audit does not yet support re-assessment with milestone-driven score updates — this is a core Pro Suite feature that must be addressed in that phase

---

### 8. Maturity & Readiness Dashboard

**Vision**
The M&R Dashboard renders the full diagnostic output for the 125-question audit. It surfaces overall maturity scores by Dimension and Capability Area, provides ranked recommendations weighted by urgency and stage relevance, and enables the founder to identify the highest-leverage focus areas before entering the Pro Suite planning phase. This dashboard is the bridge between diagnosis and execution.

**Current State**
The M&R Results page (`Tools.MRResults`) is routed. Detailed dashboard specifications exist in the context file `MR-audit-dashboard`, covering the intended layout: capability rankings, dimension-level views, a recommendations panel with weighted prioritization, and a Tier 2 / Pro suite gating prompt. However, the implementation fidelity of this dashboard against the spec has not been confirmed. It is unclear whether the current build renders scored capability data, or whether the results page is a structural shell awaiting full wiring to the Supabase score tables.

**Remaining Work**
- [ ] Audit the current `MRResults` component against the dashboard spec — identify what is rendered vs. what is placeholder
- [ ] Implement capability area score rendering, Dimension-level breakdown, and weighted recommendation display
- [ ] Wire the dashboard to read live data from the Supabase capability, pillar, dimension, and overall score tables
- [ ] Build a clear pathway from M&R Dashboard into Pro Suite — specifically, tie the 3P Framework selection in the Roadmap Tool to the top-ranked Capability Areas from this dashboard
- [ ] Flag: AI-generated synthesis (narrative insight over scores) is intentionally deferred and should remain clearly decoupled from the base dashboard build

---

### 9. GPT Synthesis & n8n Workflows

**Vision**
The AI synthesis layer is the intelligence engine that converts raw assessment and input data into narrative insight. It operates invisibly — triggered on form submission, running asynchronously via n8n workflows, and writing results back to Supabase where the UI is listening for updates. It is what makes the platform feel like a strategic advisor rather than a form tool.

**Current State**
This layer is intentionally deferred and not yet fully wired across the platform. The architectural pattern is established: an n8n webhook is called on submission, the workflow generates GPT-based output, and results are written back to a Supabase column that the frontend listens for via Realtime subscription. This pattern was implemented and partially tested for the **Clarity Compass** synthesis flow, where a `LoadingOverlay` component monitors the Supabase update. The GV Simulator Compare Mode has a GPT Trigger button in the UI but it is not yet connected to a live workflow. No AI synthesis is wired into the AE Ladder Dashboard or the M&R Dashboard.

**Remaining Work**
- [ ] Verify and stabilize the Clarity Compass n8n webhook — confirm consistent output writing to Supabase
- [ ] Wire the GV Simulator Compare Mode GPT Trigger to its n8n workflow
- [ ] Design and build the n8n workflow that generates AE Ladder stage narrative insight (deferred, no timeline set)
- [ ] Design and build the n8n workflow that generates M&R Audit synthesis output (deferred, no timeline set)
- [ ] Document the standard webhook payload schema and Supabase Realtime listener pattern as a reusable internal template, so each new synthesis feature can be added consistently
- [ ] Flag: Until n8n workflows are stable and reliably triggered, dashboards must function fully with raw data rendering — AI output is an enhancement layer, not a dependency

---

### 10. Pro Suite — Sprint Planning

**Vision**
Sprint Planning is the quarterly initiative and milestone planning workspace inside the Pro Suite. It is where the agency translates its Roadmap focus areas into executable initiatives with clear milestones. It is designed around the 3P Framework (Prioritize / Plant / Progressively Iterate) and connects directly to the M&R Audit's ranked Capability Areas to ensure planning is calibrated to actual maturity gaps.

**Current State**
Sprint Planning is highly functional. The **SprintBoardPage** and **Roadmap Tool** (`/pro/planning/roadmap`) are active. The Roadmap Tool features a polished 5-column layout with simplified dimension tags. The interactive Initiative Workspace (Initiative Card Modals) is complete, featuring inline `FieldEditor` capabilities and a working, timestamped `ChangeLog` for tracking edits. Milestone creation and linking within initiatives are fully functional, with the "Add Milestone" flow wired up.

**Remaining Work**
- [ ] Connect Sprint Planning milestones directly to the capability maturity score updating mechanisms (Progress Tracking flow)
- [ ] Build out the Initiative Library page with ranked Capability Area display, seeded and filtered by M&R Audit results
- [ ] Audit the SprintBoardPage and ProgressPage against intended spec — identify what is functional vs. visually complete but unhooked

---

### 11. Pro Suite — Execution Overview

**Vision**
The Execution Overview serves as the operational home during the 12-week sprint, holding the plan steady while the quarter unfolds. It acts as the dynamic navigation hub driving the 5 moments (Sprint Launch, Status Tracker, Momentum Synthesis, Sprint Wind-Down, Retrospective) and adapts smoothly across 6 defined sprint states (from No Sprint to Closed Complete).

**Current State**
The Execution Overview (`ExecutionLanding.tsx`) is built and wired to fetch live initiatives and milestones directly from Supabase. Core components including the `SprintIdentityBlock`, `HealthBarStrip`, and `CompletionSummaryBlock` successfully reflect real active sprint data. State management via the `useSprintState` hook has been overhauled to provide live context.

**Remaining Work**
- [ ] Build out the deep links from the Execution Overview cards into their respective functional sub-pages (Momentum Synthesis, Sprint Wind-Down, Retrospective)
- [ ] Implement dynamic UI gating based on actual sprint states (currently temporarily overridden to 'ACTIVE' for testing and development)

---

### 12. Pro Suite — Virtual CSO

**Vision**
The Virtual CSO is the AI strategic advisor embedded in the Intelligence section of the Pro Suite. It is context-aware — knowing the agency's stage, maturity scores, active initiatives, financial data, and any documents uploaded via Trend Analysis. It is designed to give the founder a strategic sounding board that understands their specific situation, not a generic chatbot.

**Current State**
The Virtual CSO is a structural shell. The `VirtualCSOStrategy` page exists with a two-column layout — a Session History sidebar and a Strategy Session main panel — but both panels render `PlaceholderContent` text. No chat interface, no AI integration, and no context injection are implemented. The route at `/pro/intelligence/virtual-cso` is functional and the page renders, but it contains no working logic.

A context specification exists at `context/virtual-cso/` and a broader Pro Suite overview document references the intended RAG (Retrieval-Augmented Generation) architecture. This feature is explicitly classified as deferred — it requires the AI context layer (Stage, Scores, Initiatives, Financials, Documents) to be fully populated before meaningful implementation begins.

**Remaining Work**
- [ ] Defer until the context layers are available: AE Ladder stage data, M&R Audit scores, Sprint Planning initiatives, and Financial Trend Analysis uploads must all be accessible
- [ ] Design the RAG architecture: document ingestion pipeline, vector store schema, and context assembly logic
- [ ] Build the chat interface with session history
- [ ] Implement context injection so the AI advisor has access to the full agency profile at query time
- [ ] Flag: This feature should not be partially built — it either works with genuine contextual intelligence or it should not be surfaced to users at all

---

### 13. Pro Suite — Financial Analysis

**Vision**
Financial Analysis (referred to in the platform as Trend Analysis) allows the founder to upload P&L data and financial snapshots, surface trend insights, and feed that financial intelligence into the Virtual CSO's knowledge base. It makes the platform financially aware — so strategic guidance can be calibrated to actual economic reality, not just operational structure.

**Current State**
Trend Analysis is accessible at `/pro/intelligence/trend-analysis`, mapped to the `VirtualCSOBI` page component. Like the Virtual CSO Strategy page, this is a structural shell — the route and layout are in place but the page renders placeholder content only. No P&L upload functionality, no trend calculation logic, and no AI-assisted financial insight have been implemented.

**Remaining Work**
- [ ] Design the P&L upload flow: file format support, parsing logic, and storage schema in Supabase
- [ ] Build trend calculation logic: period-over-period revenue, margin, and expense tracking
- [ ] Implement AI-assisted insight generation for uploaded financials (n8n workflow pattern)
- [ ] Wire uploaded financial data and generated insights into the Virtual CSO document library
- [ ] Flag: This feature has a meaningful dependency on the n8n AI synthesis pattern — the Clarity Compass implementation can serve as the reference architecture

---

### 14. Pro Suite — Progress Tracking & Maturity Updates

**Vision**
Progress Tracking is the team-facing execution view inside the Pro Suite. It allows team members to check off milestones, and each milestone completion automatically updates the agency's maturity scores in Supabase — removing the need to retake the 125-question audit every quarter. It is the mechanism that makes the platform a living operating system rather than a point-in-time diagnostic.

**Current State**
A `ProgressPage` exists within Sprint Planning (`pages/SprintPlanning/ProgressPage.tsx`, 8.6KB) and is routed at `/pro/execution/status-tracker`. The milestone data models are now live via Supabase, moving this feature closer to realization. However, its fidelity against the target spec — milestone checklist display, team-facing view, and auto-score updating logic — has not been confirmed. 

**Remaining Work**
- [ ] Audit the ProgressPage component against the intended spec — confirm what is functionally working vs. structurally rendered
- [ ] Design and implement the milestone completion → score update trigger in Supabase (function or trigger)
- [ ] Confirm the view is appropriate for team-level use (not requiring founder-level platform access)
- [ ] Wire milestone status updates to reflect correctly in the Sprint Board view
- [ ] Flag: Sprint Planning milestones *can* now be created, transitioning the focus to the backend triggers that update maturity scores upon milestone completion.

---

### 15. Pro Suite — Reflection & Review

**Vision**
The Reflection & Review engine is the end-of-quarter recalibration tool. It prompts the founder to reflect on what was completed, surfaces incomplete initiatives for deliberate rollover decisions, and prepares the system for the next quarter's planning cycle. It is the mechanism that closes the quarterly loop and prevents strategic drift from accumulating across quarters.

**Current State**
Reflection & Review is a placeholder. The `ReflectionReview` page is routed at `/pro/execution/reflection-review` and the route is functional, but the component file (`pages/ProSuite/ReflectionReview.tsx`, 576 bytes) is a structural shell containing only `PlaceholderContent`.

**Remaining Work**
- [ ] Design the reflection prompt flow: what questions are asked, what data is surfaced during review (incomplete initiatives, score changes, etc.)
- [ ] Build the rollover decision UI: deliberate choice to continue, deprioritize, or close each incomplete initiative
- [ ] Implement "zombie initiative" prevention — incomplete items from prior quarters should not silently carry forward without an explicit decision
- [ ] Wire the updated scores and rollover decisions to pre-populate the next quarter's planning session
- [ ] Flag: This feature is meaningfully dependent on Sprint Planning and Progress Tracking being functional first

---

### 16. Resource Library

**Vision**
The Resource Library is the framework and template reference area for platform users. It provides access to the Architect Advantage frameworks, field guides, and supplemental materials that support the broader methodology — giving users reference material they can apply outside of the platform's structured tools.

**Current State**
The Resource Library is routed at `/resources` and renders via `ResourcesPage.tsx` (1.2KB). This is a structural shell — the route is live but the page contains no meaningful content or functional document delivery. The broader platform knowledge base exists in the `knowledgebase/` directory (30 subdirectories/files), but there is no front-end interface connecting this content to the Resources route.

**Remaining Work**
- [ ] Define the content architecture for the Resource Library — what categories of resources will be surfaced, organized by what taxonomy
- [ ] Build a document browser or card-based display for available frameworks, templates, and guides
- [ ] Determine whether resource access is gated by tier or universally available
- [ ] Connect the existing knowledgebase content (from `knowledgebase/`) or equivalent to the front-end view
- [ ] Flag: The Resource Library has been deprioritized in favor of the core diagnostic and execution flows — it should remain low priority until those are solid
