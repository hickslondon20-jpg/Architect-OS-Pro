# Build-Agent Scope — MA-03: Tier-1 Wiki Synthesis Upgrade + Auto-Trigger

> The first **build** workstream in the arc (not a verification pass). Executes the Tier-1 synthesis
> design; MA-02 verifies afterward. Brains/engine split, serial, founder-reviewed checkpoints. Honors
> locks L1–L26. **Status: CLOSED 2026-07-08 (see MA-03-CLOSEOUT-HANDOFF.md + MA-03B).**

---

## Mission
Upgrade the 7 Tier-1 wiki pages from **mechanical templating** to **LLM synthesis** — a real readback of
the platform's understanding of each business area, cross-mapping platform sources — and wire
**auto-triggering**. **Additive, not a rewrite:** keep the existing source-loading, the
`replace_compiled_wiki_page` RPC, health validation, and `_project_to_ose`; replace the templating step
with synthesis, upgrade input-gathering, add the narrative + sourced-from output, fix projection, wire triggers.

## Confirmed decisions (baked in)
1. **Sonnet** synthesis. 2. Current Quarter/Sprint = **current + one prior sprint**. 3. **Open Questions**
= meta-synthesis over wiki validation/contradiction + thin/low-confidence signals. 4. **Thin-page**:
explicit "we don't know this yet," never fabricate. 5. **Compiled-synthesis base now; insight-accretion is
a follow-on.** 6. **Auto-trigger** async/debounced/page-scoped.

## Design constraints (locks)
- OS-Engine sole writer; python-backend-colocated **direct-Anthropic** lane; **reuse
  `DocWikiSynthesisService`**; LangSmith-wrapped.
- **Preserve provenance + citation contract** — `wiki-1.0` claims-with-evidence + Ep7 wiki-page→Tier-0
  resolution (L22/L23). Synthesis on top of evidence, never erases it.
- Build-time not query-time. **Source-extensible input model** (future MCP financial feed — design for it,
  don't build; L7).

## Environment / data
- Env + LangSmith wired. Brains/engine split. **Seeded test user
  `cd490873-99aa-4533-9240-f0aa04deb54f`** has one FK-valid row across all 7 pages' source tables incl.
  the `cc_version_horizon_snapshots.scenario_id → gvs_saved_growth_scenarios` link.
- **Additive, forward-only migrations permitted** (via Supabase MCP, no backfill — L10).

## Objectives (ordered)
**0.** Locate the narrative's home (extend `one_line`, a new column, or the digest — additive migration if
needed) + upgrade input-gathering to lead with the vertical AI outputs (`gm_assessment_gpt_outputs`,
`ae_assessment_insights`, `cc_synthesis`, `gvs_scenario_synthesis`), replacing the `.limit(3)`/3-field templating.
**1.** Insert the Sonnet synthesis step (reuse `DocWikiSynthesisService`): source bundle → narrative +
claims-with-evidence (preserved) + a "sourced-from" Tier-0 section. Thin-page policy when sparse.
**2.** Author the **7 per-page synthesis directives** (IP core — founder-reviewed). Growth Constraints merges
measured capability good-vs-current gaps (`variance_pct`/`rank_overall`/leverage) with the CC→GVS
horizon-scenario constraints. Open Questions is the meta page. Respect page **kind**. **→ Founder checkpoint.**
**3.** Fix `_project_to_ose` so the synthesized page lands in `ose_knowledge_pages`, and **embed** it
(`ose_knowledge_pages.embedding`, closing `DL-L1-EMBED`).
**4.** Wire the existing `event_rebuild_targets` events at platform write-points → `compile_event`,
async/debounced/page-scoped.

## Checkpoints
- After the 7 directives are drafted (before wiring) — founder reviews the IP.
- After the first page compiles end-to-end for the test user — prove the pattern before all 7.

## Out of scope
MCP live financial feed (design-for only); the insight-accretion loop; front-end rendering (§8); the GVS
`check_gvs_save_limit` bug (core-platform); MA-02 verification. Don't touch the document-wiki writer.

## Deliverables (then hand to MA-02)
Synthesis service + 7 reviewed directives + input upgrade + projection/embedding fix + auto-trigger · 7
compiled pages for the test user in `ose_knowledge_pages` · any additive migration applied ·
`Pro-Suite-Progress.md` updated. Locks L1–L26.
