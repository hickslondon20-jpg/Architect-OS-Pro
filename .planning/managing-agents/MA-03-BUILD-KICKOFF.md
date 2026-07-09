# Thread-Initiating Prompt — MA-03 / Tier-1 Wiki Synthesis Build Agent

> Historical record (MA-03 is CLOSED — see MA-03-CLOSEOUT-HANDOFF.md + MA-03B). Recreated 2026-07-08.

---

You are the **Tier-1 Wiki Synthesis build agent** for ArchitectOS Pro. This is a **build**, not a
verification pass: upgrade the 7 Tier-1 wiki pages from mechanical templating to **LLM synthesis** and wire
**auto-triggering**. **Additive, not a rewrite** — keep the existing source-loading, `replace_compiled_wiki_page`
RPC, health validation, and `_project_to_ose`; replace only the templating step, upgrade inputs, add the
narrative + sourced-from output, fix projection + embedding, and wire triggers.

**Read first:** `MA-03-tier1-synthesis-build-SCOPE.md`; the Tier-1 design (7 charters, output contract);
`MA-01-testing-verification-debt-SCOPE.md` (shared method); `MA-01-GATE1-FINDINGS.md` (two-writer correction);
`Pro-Suite-Progress.md`, `CLAUDE.md`, `.planning/INTELLIGENCE-LAYER-ARCHITECTURE.md`; and the code:
`python-backend/services/wiki_compilation.py`, `doc_wiki_synthesis.py`, `config/wiki_schema.json`.

**How you work:** brains/engine split (no internet — founder runs the compile; you write code, verify via
Supabase MCP + LangSmith, interpret logs). Confirmed decisions: Sonnet; current + one prior sprint; meta
Open Questions; explicit thin-page; compiled-synthesis base now (accretion follow-on); auto-trigger
async/debounced/page-scoped. Locks: OS-Engine sole writer; direct-Anthropic lane; reuse
`DocWikiSynthesisService`; preserve `wiki-1.0` claims-with-evidence + Ep7 citation; LangSmith-wrap; additive
forward-only migrations allowed (Supabase MCP, no backfill).

**Test account:** `cd490873-99aa-4533-9240-f0aa04deb54f` — seeded across all 7 pages' source tables incl.
the `cc_version_horizon_snapshots.scenario_id → gvs_saved_growth_scenarios` link.

**Objectives (order):** (0) narrative home + input-gathering upgrade leading with the vertical AI outputs;
(1) Sonnet synthesis step reusing `DocWikiSynthesisService` → narrative + claims-with-evidence + sourced-from;
(2) the **7 per-page directives** (Growth Constraints merges capability good-vs-current gaps with the CC→GVS
horizon-scenario constraints; Open Questions is the meta page); (3) fix `_project_to_ose` + **embed** the
projected page; (4) wire `event_rebuild_targets` → `compile_event`, async/debounced/page-scoped.

**Two mandatory founder checkpoints — stop and wait:** (1) after you draft the 7 directives, before wiring;
(2) after the first page compiles end-to-end for the test user.

**Out of scope:** MCP live financial (design-for only), insight-accretion loop, front-end (§8), the GVS
`check_gvs_save_limit` bug, MA-02 verification. Don't touch the document-wiki writer. Honor L1–L26.
