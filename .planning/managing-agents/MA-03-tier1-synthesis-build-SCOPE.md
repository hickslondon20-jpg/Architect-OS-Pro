# Build-Agent Scope — MA-03: Tier-1 Wiki Synthesis Upgrade + Auto-Trigger

> Draft for founder review. **Not yet spun up.** Authored 2026-07-08. This is a **build**
> workstream (the first in the arc), not a verification pass. It executes the design brief;
> MA-02 verifies the result afterward. Same operating model: brains/engine split, serial,
> founder-reviewed checkpoints. Honors locks L1–L26.

---

## Mission

Upgrade the 7 Tier-1 wiki pages from **mechanical templating** to **LLM synthesis** — an actual
readback of the platform's understanding of each business area, cross-mapping platform sources —
and wire **auto-triggering**. **Additive, not a rewrite:** keep the existing source-loading, the
`replace_compiled_wiki_page` RPC, health validation, and `_project_to_ose`; replace the templating
step with synthesis, upgrade input-gathering, add the narrative + sourced-from output, fix the
projection, and wire triggers.

**Governing input:** `.planning/wiki-system/TIER1-SYNTHESIS-UPGRADE-DESIGN-BRIEF.md` — the build
executes it. The 6 confirmed decisions are baked in below.

## Read first
1. `TIER1-SYNTHESIS-UPGRADE-DESIGN-BRIEF.md` — the design (charters, constraints, output contract).
2. `MA-01-testing-verification-debt-SCOPE.md` — shared method (brains/engine split, LangSmith bar, locks).
3. `MA-01-GATE1-FINDINGS.md` — the two-writer correction (document writer vs. this Tier-1 path).
4. `Pro-Suite-Progress.md`, `CLAUDE.md`, `.planning/INTELLIGENCE-LAYER-ARCHITECTURE.md`.
5. Code: `python-backend/services/wiki_compilation.py` (the compiler you're upgrading),
   `python-backend/services/doc_wiki_synthesis.py` (the proven synthesis pattern to reuse),
   `config/wiki_schema.json` (pages, kinds, `event_rebuild_targets`).

## Confirmed decisions (baked in)
1. **Sonnet** for page synthesis. 2. Current Quarter/Sprint includes **current + one prior sprint**.
3. **Open Questions** = meta-synthesis over wiki validation/contradiction + thin/low-confidence signals.
4. **Thin-page policy**: explicit "we don't know this yet / provide X" — never fabricate.
5. **Compiled-synthesis base now; founder-confirmed insight-accretion is a follow-on** (not this build).
6. **Auto-trigger**: async, debounced, page-scoped; never blocks the founder's save.

## Design constraints (locks)
- **OS Engine sole writer**; python-backend-colocated **direct-Anthropic** lane; **reuse
  `DocWikiSynthesisService`** patterns; **LangSmith-wrapped** (standing bar).
- **Preserve provenance + the citation contract** — keep `wiki-1.0` claims-with-evidence and Ep7
  wiki-page→Tier-0 resolution (L22/L23). Synthesis sits on top of evidence, never erases it.
- **Build-time, not query-time.** **Source-extensible input model** (future MCP financial feed
  slots in — design for it, don't build it, L7).

## Environment / data
- Env + LangSmith already wired. **Brains/engine split:** you never boot the backend — the founder
  runs the live compile on their machine; you write code + scripts, verify via **Supabase MCP** +
  LangSmith, interpret logs.
- **Seeded test user: `cd490873-99aa-4533-9240-f0aa04deb54f`** has one FK-valid row across all 7
  pages' source tables (incl. the `cc_version_horizon_snapshots.scenario_id → gvs_saved_growth_scenarios`
  link for Growth Constraints). Compile/verify against this user.
- **Additive, forward-only migrations are permitted** for this build (unlike the verification passes)
  — applied via Supabase MCP, no backfill (L10). E.g. a new column if the synthesized narrative needs a home.

## Objectives (ordered)

**0. Locate the narrative's home + upgrade input-gathering.** Decide where the synthesized narrative
lives without breaking the RPC/`wiki-1.0` contract (extend `one_line`, a new column, or the digest —
additive migration if needed). Replace the `.limit(3)`/3-field templating in `_load_sources`/
`_claim_text` with **page-appropriate, bounded** gathering that **leads with the vertical AI outputs**
(`gm_assessment_gpt_outputs`, `ae_assessment_insights`, `cc_synthesis`, `gvs_scenario_synthesis`).

**1. The synthesis step (reuse `DocWikiSynthesisService`).** Insert an LLM (Sonnet) synthesis call
in `compile_page` between source-loading and the RPC write: source bundle → synthesis → **(a)
narrative readback, (b) claims-with-evidence preserved (each claim keeps its `tier0_record` evidence
ref), (c) a "sourced-from" Tier-0 section.** Thin-page policy applies when sources are sparse.

**2. The 7 per-page synthesis directives (the IP core — founder-reviewed).** Author page-specific
prompts implementing the §5 charters. Two need special care:
- **Growth Constraints:** merge (a) measured capability gaps (good-vs-current from GMA/MRA) with
  (b) the horizon-scenario constraints reached via `cc_synthesis → cc_version_horizon_snapshots.scenario_id
  → gvs_saved_growth_scenarios` for the founder's selected horizon.
- **Open Questions:** meta-synthesis over the wiki's validation/contradiction + thin/low-confidence
  signals (no Tier-0 table of its own).
- Respect page **kind** (`compiled_base_only` vs `insight_accreting`).
**→ Founder checkpoint: review the 7 directives before wiring them in.**

**3. Projection + embedding.** Fix `_project_to_ose` so the synthesized page lands in
`ose_knowledge_pages` (Gate 1 found this missing for real accounts), and **embed the projected page**
(`ose_knowledge_pages.embedding`) so `wiki_search` finds it semantically (closes `DL-L1-EMBED`).

**4. Auto-trigger wiring.** Emit the existing `event_rebuild_targets` events at the platform
write-points (assessment complete, sprint saved, quarter map / clarity compass / agency snapshot /
structured upload changed) → `compile_event`, **async + debounced + page-scoped.** No new event taxonomy.

## Checkpoints
- **After the 7 directives are drafted** (before wiring) — founder reviews the IP.
- **After the first page compiles end-to-end** for the test user (prove the pattern: synthesis →
  claims-with-evidence → narrative → projection → embedding → LangSmith trace) before doing all 7.
- Structural surprises surface immediately.

## Out of scope
MCP live financial feed (design-for only); the insight-accretion loop (follow-on); front-end
rendering of pages (§8); the GVS `check_gvs_save_limit` bug (core-platform, logged in CONCERNS);
MA-02 verification (separate pass). Don't touch the document-wiki writer (already proven).

## Deliverables (then hand to MA-02)
Synthesis service + 7 reviewed directives + upgraded input-gathering + projection/embedding fix +
auto-trigger wiring · 7 compiled pages for the test user in `ose_knowledge_pages` (narrative +
claims-with-evidence + sourced-from), LangSmith-traced · any additive migration applied ·
`Pro-Suite-Progress.md` + design brief status updated. **Then MA-02 verifies (Obj. 2b).**

## Locks
L1–L26; especially OS-Engine-sole-writer, L22/L11 (citation currency + curated trace), three-lane
synthesis, Claude-locked orchestration, L7 (MCP scaffold-only), L10 (forward-only, no backfill).

## Open items for founder before spin-up
1. Confirm you'll review the **7 synthesis directives** at the Objective-2 checkpoint (the IP gate).
2. Confirm the narrative-storage approach is the build agent's call (extend `one_line` vs. new
   column), provided it stays additive and preserves the `wiki-1.0` contract.
