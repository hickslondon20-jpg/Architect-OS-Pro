# Tier-1 Wiki Synthesis Upgrade — Design Brief (First Pass)

> Authored 2026-07-08 by the orchestration agent, for founder shaping. This is the
> design-alignment artifact that precedes the build agent (sequence: **this brief → seed source
> tables → build agent → resume MA-02**). Grounded in the Gate 1 two-writer correction and the
> canonical `config/wiki_schema.json`. The **7 page charters (§5) are the heart — shape these.**

> **Build status (2026-07-08, MA-03):** §2-§4 (constraints, output contract, input-gathering) and
> §6 mechanics are implemented in `python-backend/services/wiki_compilation.py`. §5's 7 charters
> are implemented as `PAGE_SYNTHESIS_DIRECTIVES` in that file, grounded in the live schema
> (confirmed via Supabase MCP) — **founder-approved at checkpoint 1.** Checkpoint 2 (live compile
> proof) is now cleared on all 7 of 7 pages for the test user: every page live-verified with
> `synthesis_used=true`, zero `wiki_validation_findings()` rows, correct `ose_knowledge_pages`
> projection + embedding, and manual claim-by-claim narrative grounding review. §6 auto-trigger
> wiring (the event emission at platform write-points) is next. §9 open decisions below are
> resolved as: (1) Sonnet for all 7 pages, no per-page routing; (2) prior-sprint included (current
> + one prior); (3) confirmed meta-synthesis, no direct sources; (4) implemented — thin pages get
> an explicit "we don't know this yet" narrative, never a fabricated one; (5) compiled-synthesis
> base only, accretion loop out of scope for this build; (6) not yet decided — auto-trigger not
> wired yet.

---

## 1. What we're changing and why

Today `WikiCompilationService` compiles the 7 Tier-1 pages by **mechanical templating** — it pulls
≤3 rows × 3 fields per source table and formats them into claim strings. No LLM. It's also
**manual-trigger-only** (called by two endpoints; nothing fires it on platform events), and the
Tier-1→`ose_knowledge_pages` projection is currently missing for real accounts.

Aggregating Tier-0 answers "what rows exist," not "here's what we understand about your business."
The differentiator is **second-order synthesis**: an LLM reading the diagnostics, sprint, clarity
compass, financials, and market data *together* and giving a **readback of its understanding** of
each of the 7 business areas — each page answering a genuinely different question — while keeping a
**sourced-from Tier-0 section** so every claim stays grounded and citable.

**This is additive, not a rewrite:** reuse the existing source-table wiring, the
`replace_compiled_wiki_page` RPC, and `_project_to_ose`; insert an LLM synthesis step in the middle,
and wire the auto-trigger.

## 2. Design constraints (locks for the build agent)

1. **Stay in the OS-Engine-sole-writer, python-backend-colocated lane.** Model the synthesizer on
   the proven `DocWikiSynthesisService` (direct-Anthropic). Not N8N, not client-side. LangSmith-wrapped.
2. **Preserve provenance + the citation contract.** Keep the `wiki-1.0` claims-with-evidence model
   and Ep7 wiki-page→Tier-0 citation resolution (L22/L23). Synthesis sits **on top of** provenance,
   never erases it. Every material assertion carries `tier0_record` evidence (`path=table/id`).
3. **Prioritize the already-synthesized vertical outputs as prime inputs.** `gm_assessment_gpt_outputs`,
   `ae_assessment_insights`, `cc_synthesis`, `gvs_scenario_synthesis` already contain single-vertical
   AI synthesis. The Tier-1 job is to **cross-map** those + raw records — so pull fuller context than
   today's `.limit(3)`, weighted toward the synthesis tables.
4. **Build-time, not query-time.** Synthesis happens at compile; the CSO reads a finished page.
5. **Auto-trigger via the existing `event_rebuild_targets` map** (already in config). The build wires
   platform write-points to *emit* those events → `compile_event`. Debounce, page-scoped, async
   (don't block the founder's save); mind the per-synthesis cost (§3.4 metering).
6. **Source-extensible input model.** Design inputs so a future MCP live feed (e.g. QuickBooks →
   `financial_context`) slots in as another source with no redesign. Design now, build later (L7).

## 3. Per-page output contract (proposed)

Each page carries:
- **Frontmatter** (`page_key`, `wiki_version`, `last_compiled_at`, `tags`) — exists.
- **Synthesis narrative** (LLM) — the readback answering the page's question, explicitly cross-mapping
  sources and noting how this area connects to the others.
- **Claims-with-evidence** (preserved) — material assertions each tagged with Tier-0 evidence refs.
- **"Sourced from" section** — the Tier-0 records the synthesis drew on, human-readable + citable.
- **Confidence rollup + explicit thin-state** — if sources are absent/low, say "we don't know this
  yet," never fabricate.
- **Kind-aware behavior:** `compiled_base_only` pages (diagnostic_synthesis, current_quarter_sprint)
  are pure compiled base; `insight_accreting` pages (the other 5) leave a slot for founder-confirmed
  accreted insights layered on the base (see §9 — decide if that loop is in this build or a follow-on).

## 4. Input-gathering upgrade

Replace the `.limit(3)`/3-field templating with page-appropriate context gathering that leads with
the vertical synthesis tables, includes the key structured records, and stays bounded for cost. The
synthesizer receives a structured source bundle, not raw dumps.

## 5. The 7 page charters (FIRST PASS — shape these)

Each page answers a **distinct** question by compiling **across** platform areas.

**1. Business Context** · `insight_accreting`
- **Question:** Who is this business at its core — positioning, offer, model, and direction?
- **Primary inputs:** `cc_synthesis` (prime), `cc_versions`, `cc_version_horizon_snapshots`, `cc_drafts_global`.
- **Good synthesis:** a crisp readback of the founder's own articulated identity + direction,
  reconciled across clarity-compass versions (what's stable vs. still evolving).
- **Feeds:** the CSO's baseline "who am I advising"; context anchor most other pages and Domain Agents lean on.

**2. Diagnostic Synthesis** · `compiled_base_only`
- **Question:** Where does this business actually stand — AE Ladder stage and Growth Mastery
  capabilities, read *together*?
- **Primary inputs:** `ae_assessment_insights`, `vw_ae_dashboard_results`, `vw_ae_stage_context`;
  `gm_assessment_gpt_outputs`, `gm_capability_rankings`, checkpoint/capability scores.
- **Good synthesis:** reconcile AE stage with the GMA capability profile into one "here's your current
  standing + the 2–3 things the diagnostics agree are your strongest/weakest" — cross-mapped, not listed.
- **Feeds:** the CSO's maturity grounding; stage-calibrated advice; Domain-Agent baseline.

**3. Current Quarter / Sprint** · `compiled_base_only`
- **Question:** What is the founder working on right now, and toward what quarter priority?
- **Primary inputs:** `quarter_map_selections`, `sp_sprint_goals`, `sp_sprint_initiatives`, `sp_sprint_milestones`.
- **Good synthesis:** the active quarter priority + current sprint goal/initiatives/milestones and
  status, laddered together. **Decision:** include prior-sprint context for momentum? (You raised this.)
- **Feeds:** CSO situational awareness; sprint-aware Domain Agents; Reflection Review.

**4. Growth Constraints** · `insight_accreting`
- **Question:** What is actually holding this business back from its next stage?
- **The core mechanic (founder-specified — this is the heart of the page):** merge two signals.
  1. **Capability gaps** — the delta between *what good looks like* (the benchmark/target state per
     capability) and the founder's *self-reported current state*, from the Growth Mastery / MRA
     capability results. These are the **measured, known gaps** (good-vs-current per capability).
  2. **Horizon-scenario constraints** — each `cc_synthesis` is **linked to a GVS growth scenario**
     tied to the **Clarity Compass horizon the founder selected**; that scenario already flags the
     constraints that arise on that chosen path. Pull those scenario constraints via the
     `cc_synthesis → GVS scenario` link.
  The page's job is to **merge (1) + (2)** — reconcile the measured capability gaps with the
  scenario-specific constraints of their chosen horizon.
- **Primary inputs:** GMA/MRA capability scores + rankings + checkpoints (the good-vs-current deltas);
  `cc_synthesis` and its **linked** `gvs_saved_growth_scenarios` / `gvs_scenario_synthesis` /
  `gvs_comparison_runs` (traverse the CC→GVS link — confirm the exact FK during build);
  `quarter_map_selections`.
- **Good synthesis:** "here's what's most limiting your growth and why" — the measured capability
  gaps reconciled with the scenario constraints of their chosen horizon, prioritized. The highest-
  leverage advisory page; where accreted founder-confirmed insight matters most.
- **Feeds:** the CSO's core advisory lever; constraint-targeting Domain Agents.

**5. Financial Context** · `insight_accreting`
- **Question:** What do we know about this agency's financial shape and patterns?
- **Primary inputs:** `agency_snapshot_economic_foundation`/`revenue_model`/`delivery_architecture`,
  `agency_snapshots`, `founder_datasets`/`_rows` (uploaded P&Ls), financial `document_chunks`.
- **Good synthesis:** revenue model + economic foundation + any uploaded financials into a financial-
  shape readback; explicit about what's known vs. missing.
- **Feeds:** the Financial Domain Agent (P&L workflow); CSO financial questions.
- **Future hook:** **MCP live financials (QuickBooks, etc.) plug in here** as an added input — design
  the input model to accept it; **not built in this pass** (L7).

**6. Client / Market Position** · `insight_accreting`
- **Question:** Where does this agency sit in its market — who it serves, how it's positioned?
- **Primary inputs:** `agency_snapshot_market_footprint` + services/industries/agency-type refs +
  `revenue_model`; `gvs_growth_scenarios`/`gvs_scenario_synthesis`.
- **Good synthesis:** market footprint + service/industry mix + positioning + concentration into a
  "here's your market position" readback.
- **Feeds:** positioning/offer Domain Agents; CSO market questions.

**7. Open Questions & Unresolved Tensions** · `insight_accreting` · *(special — meta page)*
- **Question:** What don't we know yet, and where does the founder's context conflict?
- **Inputs:** none direct (empty source list). Synthesizes **over the other pages** — the wiki's own
  validation/contradiction signals (`event: wiki_validation_changed`) + thin/low-confidence pages.
- **Good synthesis:** the biggest unknowns + detected contradictions — "here's what we should resolve
  to understand you better." Drives the CSO's clarifying questions and the feeder loop.
- **Feeds:** CSO's next-question engine; the feeder model's "what to ask the founder."

## 6. Auto-trigger design (the map already exists)

`config/wiki_schema.json → event_rebuild_targets` already defines the event→page wiring:
`ae_ladder_run_updated`/`gm_audit_run_updated → diagnostic_synthesis`; `quarter_map_changed →
current_quarter_sprint + growth_constraints`; `sprint_planning_changed → current_quarter_sprint`;
`clarity_compass_changed → business_context + growth_constraints`; `diagnostic_constraint_changed →
growth_constraints`; `agency_snapshot_financial_changed`/`structured_upload_changed →
financial_context`; `agency_snapshot_market_changed → client_market_position`; `growth_velocity_changed
→ client_market_position + growth_constraints`; `wiki_validation_changed → open_questions`.
**The build:** emit these events at the platform write-points and call `compile_event`, async +
debounced + page-scoped. No new event taxonomy needed.

## 7. How these pages feed downstream

- **Virtual CSO** reads them via `ose_knowledge_pages` (`wiki_search`/`get_page`/`list`) — the grounded
  "what we know about you" the CSO reasons from.
- **Domain Agents** consult them as business context before producing (Ep6 connection-A).
- **Ep7 citations** resolve wiki-page claims back to their Tier-0 records.
- **Connection phase / cross-tier router** — these 7 pages *are* the Tier-1 layer escalation target.

## 8. Non-goals for this build
MCP live financial feeds (future); front-end rendering of the pages (§8); and — if we defer it —
the full founder-confirmed insight-accretion loop.

## 9. Open decisions for founder
1. **Synthesis model** per page — Sonnet for quality vs. a cheaper utility model? (Orchestration stays
   Claude per L12; this is utility synthesis, so a per-page routing choice is legitimate.)
2. **Prior-sprint inclusion** in Current Quarter / Sprint?
3. **`open_questions`** — confirm it's a meta-synthesis over wiki validation + thin/contradiction signals.
4. **Thin-page policy** — the explicit "we don't know this yet" presentation when sources are sparse.
5. **Insight-accretion loop** — build the founder-confirmed accreting layer now, or ship the compiled-
   synthesis base first and add accretion as a follow-on? (My lean: base now, accretion follow-on.)
6. **Refresh/debounce window** for auto-trigger (cost vs. freshness).
