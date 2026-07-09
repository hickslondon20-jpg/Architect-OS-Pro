# Tier-1 Wiki Synthesis Upgrade — Design Brief

> The design that MA-03 executed. Recreated 2026-07-08 from the strategy-thread record after the original was
> lost in the incident. **Status: EXECUTED — MA-03 closed 2026-07-08** (7 pages live on real Sonnet synthesis
> + embeddings + auto-trigger + anti-clobber guard for test user `cd490873-…`). Kept as the design-of-record.

---

## 1. What changed and why
`WikiCompilationService` compiled the 7 Tier-1 pages by **mechanical templating** (≤3 rows × 3 fields per
source table → claim strings; no LLM), manual-trigger-only. Aggregating Tier-0 answers "what rows exist," not
"here's what we understand about your business." The differentiator is **second-order synthesis**: an LLM
reading the diagnostics, sprint, clarity compass, financials, and market data *together* into a readback of
each business area — each page a distinct question — while keeping a **sourced-from Tier-0 section** so every
claim stays grounded and citable. Additive, not a rewrite (reuse source-loading, `replace_compiled_wiki_page`
RPC, `_project_to_ose`; insert an LLM step; wire the auto-trigger).

## 2. Design constraints (locks)
1. OS-Engine-sole-writer, python-backend-colocated **direct-Anthropic** lane; model on `DocWikiSynthesisService`;
   LangSmith-wrapped.
2. Preserve provenance + citation contract (`wiki-1.0` claims-with-evidence + Ep7 wiki-page→Tier-0, L22/L23).
   Synthesis on top of evidence, never erases it.
3. Prioritize the already-synthesized vertical outputs (`gm_assessment_gpt_outputs`, `ae_assessment_insights`,
   `cc_synthesis`, `gvs_scenario_synthesis`) as prime inputs.
4. Build-time, not query-time.
5. Auto-trigger via the existing `event_rebuild_targets` map; async, debounced, page-scoped.
6. Source-extensible input model (future MCP financial feed slots in; design for it, don't build — L7).

## 3. Per-page output contract
Frontmatter · **synthesis narrative** (LLM, grounded — may only assert what its claims support) ·
**claims-with-evidence** (each tagged with a Tier-0 evidence ref) · **"sourced-from" section** · confidence
rollup + explicit thin-state · kind-aware (`compiled_base_only` vs `insight_accreting`).

## 4. The 7 page charters
1. **Business Context** (`insight_accreting`) — who this business is at its core (positioning, offer, model,
   direction), from `cc_synthesis` reconciled across versions. Anchors every other page.
2. **Diagnostic Synthesis** (`compiled_base_only`) — where the business stands: AE stage + GMA capabilities read
   together; agreement = highest-confidence claim, divergence = a claim in its own right.
3. **Current Quarter / Sprint** (`compiled_base_only`) — quarter priority → sprint goal → initiatives →
   milestones; prior sprint for momentum only. No accretion.
4. **Growth Constraints** (`insight_accreting`) — MERGE (1) measured capability gaps = `variance_pct`
   (good-vs-current delta) + `rank_overall`/leverage, with (2) horizon-scenario constraints reached via
   `cc_synthesis → cc_version_horizon_snapshots.scenario_id → gvs_saved_growth_scenarios` for the founder's
   selected horizon. Anything in both families = top-priority claim. The core advisory page.
5. **Financial Context** (`insight_accreting`) — revenue model + economic foundation + uploaded financials;
   explicit about what's missing. **Future MCP financial-feed hook.**
6. **Client / Market Position** (`insight_accreting`) — market footprint + positioning + concentration; flags a
   claim when stated positioning diverges from structural data.
7. **Open Questions** (`insight_accreting`, meta) — synthesizes only over the wiki's validation/contradiction +
   thin/low-confidence signals from the other 6; never invents a new business fact.

## 5. Auto-trigger
The `event_rebuild_targets` map already exists in `config/wiki_schema.json`. The build emits those events at
platform write-points → `compile_event`, async/debounced/page-scoped. `open_questions` recompiles after any of
the other 6.

## 6. Confirmed decisions (founder, 2026-07-08)
Sonnet synthesis · current + one prior sprint · Open Questions = meta · explicit thin-page (never fabricate) ·
compiled-synthesis base now, insight-accretion follow-on · auto-trigger async/debounced/page-scoped.

## 7. Non-goals (this build)
MCP live financial feed (design-for only); front-end rendering (§8); the founder-confirmed insight-accretion loop.
