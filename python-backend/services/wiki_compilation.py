"""Compilation service for the ArchitectOS per-user wiki.

MA-03 (2026-07-08): upgraded from mechanical templating to LLM synthesis. Additive to the
wiki-1.0 contract: the source-loading entrypoint, replace_compiled_wiki_page RPC, health
validation, and _project_to_ose all still run every compile - only the middle step
(claims-from-a-.limit(3)-dump) is replaced with a Sonnet synthesis call, and two real
bugs found while wiring this up are fixed in place (see _project_to_ose docstring).
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any
from uuid import uuid4

import anthropic
from langsmith.wrappers import wrap_anthropic

from core.config import get_settings
from core.wiki_schema import event_rebuild_targets, get_wiki_schema, valid_page_key
from services.usage_events import anthropic_usage, log_ai_usage_event
from services.wiki_health import WikiHealthError, WikiHealthService
from services.vector_store import VectorStoreError

if TYPE_CHECKING:
    from services.vector_store import VectorStore


class WikiCompilationError(RuntimeError):
    pass


@dataclass(frozen=True)
class CompileResult:
    user_id: str
    page_key: str
    claim_count: int
    evidence_count: int
    thin: bool
    digest_generated_at: str
    rebuilt_pages: list[str]
    validation_counts: dict[str, int]
    synthesis_used: bool = False
    # Objective 4 (auto-trigger, 2026-07-08): true when this compile was skipped because the
    # page was already compiled inside RECOMPILE_DEBOUNCE_MINUTES and force=False. Kept as an
    # explicit, observable field for the same reason synthesis_model=mechanical_fallback is
    # observable - a skipped compile must never look indistinguishable from a real one.
    skipped: bool = False


# Objective 4 (auto-trigger, 2026-07-08): recency-guard debounce. The 10 event_rebuild_targets
# events are now emitted live by Postgres triggers (via pg_net) on the underlying platform
# tables - a founder editing the same sprint goal repeatedly, or a bulk CSV upload inserting
# hundreds of founder_dataset_rows, would otherwise fire one compile (and one billed Sonnet
# call) per row/edit. Rather than adding new queue/worker infrastructure, compile_page skips
# recompiling a page that was already compiled within this window, unless force=True. A rapid
# burst of writes still triggers a few compiles (not a perfect single coalesce), but the cost
# and DB-write profile stays bounded without introducing a new moving part.
RECOMPILE_DEBOUNCE_MINUTES = 10


# ---------------------------------------------------------------------------
# Objective 0: input-gathering upgrade.
#
# Leads with the already-synthesized vertical AI outputs (gm_assessment_gpt_outputs,
# ae_assessment_insights, cc_synthesis, gvs_scenario_synthesis, and the *_synthesis /
# synthesis_beat_* columns that already live on the agency_snapshot_* tables) rather than
# the raw structured rows beneath them. "Supporting" tables are the raw records used to
# ground/quantify those synthesized claims.
#
# growth_constraints and open_questions are NOT driven by this table map at all - both are
# handled by dedicated gather methods below (a live FK traversal, and a wiki-internal
# meta-gather, respectively) per the design brief's special-case charters.
# ---------------------------------------------------------------------------

PRIMARY_SOURCE_TABLES_BY_PAGE = {
    "business_context": ["cc_synthesis"],
    "diagnostic_synthesis": ["gm_assessment_gpt_outputs", "ae_assessment_insights"],
    "current_quarter_sprint": [],  # handled by _load_current_quarter_sprint_sources
    "growth_constraints": [],  # handled by _load_growth_constraints_sources
    "financial_context": ["agency_snapshot_economic_foundation", "agency_snapshot_revenue_model"],
    "client_market_position": ["agency_snapshot_market_footprint", "gvs_scenario_synthesis"],
    "open_questions": [],  # handled by _load_open_questions_sources
}

SUPPORTING_SOURCE_TABLES_BY_PAGE = {
    "business_context": ["cc_versions", "cc_version_horizon_snapshots"],
    "diagnostic_synthesis": [
        "vw_ae_dashboard_results",
        "vw_ae_stage_context",
        "gm_assessment_capability_scores",
        "gm_capability_rankings",
        "gm_assessment_pillar_scores",
        "gm_assessment_overall_scores",
    ],
    "financial_context": ["agency_snapshot_delivery_architecture", "founder_dataset_rows_v"],
    "client_market_position": [
        "agency_snapshot_agency_type_ref_table",
        "agency_snapshot_services_ref_table",
        "agency_snapshot_industries_ref_table",
    ],
}

# Legacy full source map, retained only for backward-compat call sites (none remain in this
# service after MA-03, but kept as documentation of the original mechanical scope).
SOURCE_TABLES_BY_PAGE = {
    page: PRIMARY_SOURCE_TABLES_BY_PAGE.get(page, []) + SUPPORTING_SOURCE_TABLES_BY_PAGE.get(page, [])
    for page in get_wiki_schema()["pages"]
}

SOURCE_OWNER_COLUMNS = {
    "gm_assessments": "respondent_user_id",
}

# Confirmed live 2026-07-08 via Supabase MCP (information_schema + FK introspection against
# project pwacpjqkntnovndhspxt): every ae_/gm_ assessment child table keys off
# ae_assessment_id/assessment_id only - none carry a user_id of their own. The pre-MA-03
# mechanical loader filtered all of these with .eq("user_id", user_id) by default, which
# silently returned zero rows for every one of them on real accounts (caught by the bare
# except). Fixed with an explicit two-hop resolution: look up the parent assessment ids
# owned by the user, then filter the child table by the FK column against that id set.
TWO_HOP_OWNER_JOIN: dict[str, tuple[str, str, str, str]] = {
    # table: (local_fk_column, parent_table, parent_pk_column, parent_owner_column)
    "ae_responses": ("ae_assessment_id", "ae_assessments", "ae_assessment_id", "user_id"),
    "ae_assessment_insights": ("ae_assessment_id", "ae_assessments", "ae_assessment_id", "user_id"),
    "ae_dimension_scores": ("ae_assessment_id", "ae_assessments", "ae_assessment_id", "user_id"),
    "ae_assessment_snapshots": ("assessment_id", "ae_assessments", "ae_assessment_id", "user_id"),
    "gm_assessment_responses": ("assessment_id", "gm_assessments", "assessment_id", "respondent_user_id"),
    "gm_assessment_checkpoint_scores": ("assessment_id", "gm_assessments", "assessment_id", "respondent_user_id"),
    "gm_assessment_capability_scores": ("assessment_id", "gm_assessments", "assessment_id", "respondent_user_id"),
    "gm_assessment_dimension_scores": ("assessment_id", "gm_assessments", "assessment_id", "respondent_user_id"),
    "gm_assessment_pillar_scores": ("assessment_id", "gm_assessments", "assessment_id", "respondent_user_id"),
    "gm_assessment_overall_scores": ("assessment_id", "gm_assessments", "assessment_id", "respondent_user_id"),
    "gm_assessment_gpt_outputs": ("assessment_id", "gm_assessments", "assessment_id", "respondent_user_id"),
    "gm_capability_rankings": ("assessment_id", "gm_assessments", "assessment_id", "respondent_user_id"),
}

# Tables that version their AI output and carry an is_current flag - always prefer the
# current run so stale synthesis never outranks the founder's latest state.
TABLES_WITH_IS_CURRENT_FLAG = {
    "cc_synthesis",
    "ae_assessment_insights",
    "gm_assessment_gpt_outputs",
    "agency_snapshot_economic_foundation",
    "agency_snapshot_revenue_model",
    "agency_snapshot_market_footprint",
    "gvs_scenario_synthesis",
}

# ose_knowledge_pages.page_type is CHECK-constrained; config/wiki_schema.json already
# declares the correct mapping per page (ose_page_type) - see _project_to_ose.
CATEGORY_BY_PAGE_KEY = {
    "business_context": "founder_identity",
    "diagnostic_synthesis": "org_health",
    "current_quarter_sprint": "operational",
    "growth_constraints": "org_health",
    "financial_context": "financial",
    "client_market_position": "client_market",
    "open_questions": "conversation_meeting",
}


# ---------------------------------------------------------------------------
# Objective 2: the 7 per-page synthesis directives (the IP core - founder-reviewed).
#
# Each directive names the actual source-bundle fields the model will receive (grounded in
# the live schema, confirmed via Supabase MCP on 2026-07-08) so the model is never guessing
# at what "the vertical AI outputs" means for a given page.
# ---------------------------------------------------------------------------

PAGE_SYNTHESIS_DIRECTIVES: dict[str, str] = {
    "business_context": """
Question this page answers: Who is this business at its core - positioning, offer, model, and
direction?

cc_synthesis is the founder's own articulated identity - vision_statement, mission_statement,
ultimate_vision_oneliner, horizon_12/24/36/ultimate_headline + horizon_12/24/36/ultimate_summary,
founder_arc, and the movement_* fields (movement_1_trajectory, movement_2_body/implies/requires,
movement_3_insight_1/2_headline+body, movement_4_north_star). Treat this as the anchor to
reconcile and read back, not raw material to paraphrase into something generic. cc_versions /
cc_version_horizon_snapshots show whether this identity has been revised across versions.

Synthesize a crisp readback of who this founder says they are and where they're going,
reconciling what's stable across versions (repeated themes) with what's still evolving (recent
changes). Quote or closely paraphrase the founder's own vision/mission language rather than
inventing new positioning words. If cc_synthesis is missing, or synthesis_status shows it's not
current, say that plainly rather than guessing.

This page anchors every other Tier-1 page and every Domain Agent's starting context - write it
as the "here's who I'm advising" briefing a new advisor would want first.
""".strip(),
    "diagnostic_synthesis": """
Question this page answers: Where does this business actually stand - AE Ladder stage and
Growth Mastery capabilities, read together?

ae_assessment_insights (tl_dr_paragraph, stage_brief_interpretation, strategic_insights_overall,
signal_headline_strength/friction/synthesis, the four *_dimension_insight fields, focus_point_1
through focus_point_4) and gm_assessment_gpt_outputs (content_title/content_text per slot_id) are
the AI's own prior readbacks of this founder's diagnostics - lead with these; don't re-derive
from raw scores if a synthesis field already says it. Cross-reference against
gm_assessment_capability_scores (maturity_pct, readiness_pct, variance_pct, rank_overall) and
gm_capability_rankings (rank_order, rank_value) for which specific named capabilities are
strongest/weakest.

Synthesize by reconciling the AE stage narrative with the GMA capability profile into ONE
standing, not two lists. Where the two diagnostics agree, that's your highest-confidence claim.
Where they diverge, say so as a claim in its own right - a real signal, not noise to smooth over.
Name the 2-3 capabilities the data agrees are strongest and weakest by their actual names and
scores, not generic language.
""".strip(),
    "current_quarter_sprint": """
Question this page answers: What is the founder working on right now, and toward what quarter
priority?

quarter_map_selections (synthesis_output, selections, quarter_name, status) is the active quarter
priority. The source bundle's sp_sprint_goals/sp_sprint_initiatives/sp_sprint_milestones rows are
already scoped upstream to the current sprint plus the one immediately prior sprint (by
kickoff_date) - use the prior sprint only for momentum context (what carried over, what got
resolved, what's still open), never present it as still active.

Ladder the quarter priority -> current sprint goal (goal_text, directional_framing, status) ->
initiatives (name, outcome_statement, status, three_p_tier) -> milestones (description, status)
into one coherent "here's what's in motion" readback. Cite actual status values, not just names.
If a current-sprint item shows no clear connection to the stated quarter priority, say so as a
claim - that's a real founder-facing signal.

This is a compiled_base_only page: pure compiled state, no accreted founder-insight layer.
""".strip(),
    "growth_constraints": """
Question this page answers: What is actually holding this business back from its next stage?

This is the platform's core advisory lever. Your job is to MERGE two distinct signal families
given to you in the source bundle - never just list them side by side.

(1) Measured capability gaps: gm_assessment_capability_scores rows carry maturity_pct (current
state) against maturity_band_label, readiness_pct/readiness_band_label, and critically
variance_pct - the delta between what good looks like and the founder's self-reported current
state - plus rank_overall and leverage_score from gm_capability_rankings. Read variance_pct and
rank_overall/leverage_score together to find which capabilities are both furthest from "good" and
highest-leverage. These are the measured, known gaps.

(2) Horizon-scenario constraints: the source bundle's cc_synthesis + cc_version_horizon_snapshots
row is the founder's SELECTED horizon (the horizon field tells you which: 12/24/36/ultimate); its
scenario_id links to a gvs_saved_growth_scenarios row (inputs, results, implications,
pressure_insights, gvi_score) and, where present, a gvs_scenario_synthesis row
(synthesis_headline, synthesis_structural_demands, synthesis_pressure_narrative,
synthesis_watch_signal_note, synthesis_scenario_framing). These are the constraints the
founder's own chosen growth path already surfaces.

Synthesize by naming, as your highest-confidence and highest-priority claims, any constraint that
shows up in BOTH families - a capability gap that is also a structural demand of the chosen
horizon scenario is the strongest possible signal this page can produce. Where only one family
has a signal, include it but say so. Prioritize by leverage, not by which table it came from.
Write it like the single most important thing a CSO would tell this founder about what's in
their way right now.

insight_accreting page: this compiled base is what founder-confirmed accretion will layer onto in
a future build - write it as a clean, evidence-first foundation, not a final verdict.
""".strip(),
    "financial_context": """
Question this page answers: What do we know about this agency's financial shape and patterns?

agency_snapshot_economic_foundation and agency_snapshot_revenue_model already carry their own AI
synthesis - economic_foundation_synthesis / revenue_model_synthesis (jsonb),
synthesis_beat_1/2/3 + matching headlines, synthesis_signal, financial_health_status,
cash_flow_health, concentration_risk_level. Lead with these vertical outputs, not the raw numeric
fields beneath them. Use the raw fields (monthly_revenue, profit_margin_percentage,
cash_runway_months, concentration_top5_pct, monthly_churn_rate, current_mrr, etc.) to ground and
quantify the synthesized claims, not to replace them. founder_dataset_rows_v carries any uploaded
P&L data the founder has provided directly.

Synthesize revenue model + economic foundation + any uploaded financials into one financial-shape
readback. Be explicit about what's known (has a real, is_complete snapshot/synthesis) versus
what's structurally missing (no uploaded financials, or a snapshot flagged incomplete) - this
page's future hook is a live MCP financial feed (e.g. QuickBooks), so naming what's missing
matters even though that feed isn't built in this pass.
""".strip(),
    "client_market_position": """
Question this page answers: Where does this agency sit in its market - who it serves, how it's
positioned?

agency_snapshot_market_footprint carries its own synthesis - market_footprint_synthesis (jsonb),
synthesis_beat_1/2/3 + headlines, synthesis_signal, positioning_context - alongside the raw
footprint fields (agency_types, services_offered, industries_served, geographic_footprint,
pricing_strategies). gvs_scenario_synthesis / gvs_growth_scenarios (synthesis_content,
implications) show how the founder's growth scenarios frame market positioning and concentration
risk going forward.

Synthesize market footprint + service/industry mix + positioning + any concentration signal into
one "here's your market position" readback that a client/market-facing Domain Agent could use as
its starting brief. If stated positioning (positioning_context - what the founder says) diverges
from structural footprint (what the services/industries data actually shows), name that gap as
its own claim - it's a genuinely useful signal, not noise.
""".strip(),
    "open_questions": """
Question this page answers: What don't we know yet, and where does the founder's context
conflict?

This page has NO Tier-0 source tables of its own - it is a meta-synthesis over the wiki's own
state. The source bundle instead contains: wiki_validation_findings() output (broken-provenance /
contested / stale-drifted / orphans / off-taxonomy findings from the other 6 pages), wiki_claims
rows with confidence in (low, medium) drawn from those pages, and wiki_pages rows so you can see
which pages compiled thin (no narrative yet).

Synthesize over these meta-signals only - never invent a new business fact that isn't already a
claim or finding you were given. Group into: (a) genuine unknowns (thin pages, orphan pages with
no claims - literally "we don't know this yet, here's what to ask the founder for"), and (b)
genuine tensions (contested claims, or findings from two different pages that read as
inconsistent with each other). Every claim here should cite back to the specific wiki_claims/
wiki_pages row it concerns from what you were given. End with the framing "here's what we should
resolve to understand you better" - this page drives the CSO's next-question engine, not a status
report.
""".strip(),
}


class WikiCompilationService:
    def __init__(self, store: "VectorStore") -> None:
        self.store = store
        self._anthropic_client_instance: "anthropic.Anthropic | None" = None

    @classmethod
    def from_env(cls) -> "WikiCompilationService":
        from services.vector_store import VectorStore

        return cls(VectorStore.from_env())

    # -- Objective 1: the synthesis step -------------------------------------------------

    def compile_page(self, user_id: str, page_key: str, *, force: bool = False) -> CompileResult:
        if not valid_page_key(page_key):
            raise WikiCompilationError("invalid_page_key")
        page_config = get_wiki_schema()["pages"][page_key]

        if not force:
            skip_result = self._check_recompile_debounce(user_id, page_key)
            if skip_result is not None:
                return skip_result

        source_bundle = self._load_sources(user_id, page_key)
        all_sources = source_bundle["primary"] + source_bundle["supporting"]
        valid_sources = {(item["table"], item["source_id"]) for item in all_sources}

        synthesis_used = False
        narrative = ""
        claims: list[dict[str, Any]] = []
        sourced_from: list[dict[str, Any]] = []

        parsed = self._synthesize_page(user_id, page_key, page_config, source_bundle) if all_sources else None
        if parsed is not None:
            candidate_narrative, candidate_claims, candidate_sourced_from, _thin = self._normalize_synthesis_output(
                user_id, page_key, parsed, valid_sources
            )
            # Founder tightening (2026-07-08, checkpoint 1): the narrative is what lands in
            # ose_knowledge_pages.content and is what the CSO actually reads and reasons
            # from - it must carry the same no-hallucination guarantee as the claims. Only
            # trust the LLM narrative when it has at least one grounded claim behind it; if
            # every claim got dropped by the evidence filter above, the narrative could be
            # asserting things nothing here actually backs, so discard it wholesale rather
            # than persist ungrounded prose.
            if candidate_claims:
                narrative = candidate_narrative
                claims = candidate_claims
                sourced_from = candidate_sourced_from
                synthesis_used = True
            else:
                import logging

                raw_claim_count = len(parsed.get("claims") or []) if isinstance(parsed.get("claims"), list) else -1
                logging.getLogger(__name__).warning(
                    "wiki_compilation: Tier-1 synthesis for page_key=%s user=%s returned %d raw claim(s) but 0 "
                    "survived evidence grounding; falling back to mechanical claims. narrative_preview=%r",
                    page_key,
                    user_id,
                    raw_claim_count,
                    (candidate_narrative or "")[:200],
                )

        if not claims:
            # Thin-page policy: fall back to the mechanical compiled claims so a synthesis
            # miss (LLM call failed, bad JSON, or zero groundable claims) never regresses
            # below the pre-MA-03 baseline, and a genuinely empty source set still produces
            # an honest thin statement rather than a fabricated one.
            claims = self._build_claims(user_id, page_key, all_sources)
            narrative = _one_line(page_config["title"], all_sources, claims)
            sourced_from = [
                {
                    "table": item["table"],
                    "source_id": item["source_id"],
                    "note": f"Tier 0 source table {item['table']}.",
                }
                for item in all_sources[:20]
            ]
        thin = not claims

        one_line = _short(narrative, 220) if narrative else _one_line(page_config["title"], all_sources, claims)

        page_embedding = self.store.embed_query(f"{page_config['title']}\n{one_line}")
        if claims:
            claim_embeddings = self.store._embed_texts([claim["text"] for claim in claims])
            for claim, embedding in zip(claims, claim_embeddings, strict=True):
                claim["embedding"] = embedding

        digest = self._build_digest_payload(user_id, page_key, page_config["title"], one_line, claims)
        # Founder tightening (2026-07-08, checkpoint 1): always record whether this compile
        # actually used the LLM synthesis or fell back to mechanical templating, so a page
        # can never silently look synthesized while it's actually templated - queryable via
        # wiki_pages.synthesis_model for verification (MA-02) without re-reading logs.
        digest["synthesis_model"] = self._resolve_synthesis_model() if synthesis_used else "mechanical_fallback"

        rpc_payload = {
            "p_user_id": user_id,
            "p_page_key": page_key,
            "p_title": page_config["title"],
            "p_page_kind": page_config["kind"],
            "p_one_line": one_line,
            "p_page_embedding": page_embedding,
            "p_claims": claims,
            "p_digest": digest,
            "p_narrative": narrative,
            "p_sourced_from": sourced_from,
        }
        try:
            self.store.client.rpc("replace_compiled_wiki_page", rpc_payload).execute()
        except Exception as exc:
            raise WikiCompilationError(f"Wiki compile write failed: {exc}") from exc

        try:
            validation_summary = WikiHealthService(self.store).run_post_compile(user_id, page_key)
        except WikiHealthError as exc:
            raise WikiCompilationError(f"Wiki post-compile validation failed: {exc}") from exc

        self._project_to_ose(
            user_id=user_id,
            page_key=page_key,
            page_title=page_config["title"],
            narrative=narrative,
            one_line=one_line,
            claims=claims,
            sourced_from=sourced_from,
        )

        return CompileResult(
            user_id=user_id,
            page_key=page_key,
            claim_count=len(claims),
            evidence_count=sum(len(claim["evidence"]) for claim in claims),
            thin=thin,
            digest_generated_at=digest["generated_at"],
            rebuilt_pages=[page_key],
            validation_counts=validation_summary.counts,
            synthesis_used=synthesis_used,
        )

    def _check_recompile_debounce(self, user_id: str, page_key: str) -> CompileResult | None:
        """Returns a skipped CompileResult if page_key was compiled within the debounce
        window for this user, else None (caller should proceed with a real compile)."""
        row = (
            self.store.client.table("wiki_pages")
            .select("last_compiled_at")
            .eq("user_id", user_id)
            .eq("page_key", page_key)
            .limit(1)
            .execute()
            .data
        )
        if not row or not row[0].get("last_compiled_at"):
            return None
        last_compiled_at = row[0]["last_compiled_at"]
        try:
            last_dt = datetime.fromisoformat(str(last_compiled_at).replace("Z", "+00:00"))
        except ValueError:
            return None
        age_minutes = (datetime.now(timezone.utc) - last_dt).total_seconds() / 60.0
        if age_minutes >= RECOMPILE_DEBOUNCE_MINUTES:
            return None
        import logging

        logging.getLogger(__name__).info(
            "wiki_compilation: skipping recompile of page_key=%s user=%s - last compiled %.1f min ago "
            "(debounce window=%d min); pass force=True to override.",
            page_key,
            user_id,
            age_minutes,
            RECOMPILE_DEBOUNCE_MINUTES,
        )
        return CompileResult(
            user_id=user_id,
            page_key=page_key,
            claim_count=0,
            evidence_count=0,
            thin=False,
            digest_generated_at=str(last_compiled_at),
            rebuilt_pages=[],
            validation_counts={},
            synthesis_used=False,
            skipped=True,
        )

    def compile_event(self, user_id: str, event: str, *, force: bool = False) -> list[CompileResult]:
        page_keys = event_rebuild_targets(event)
        if not page_keys:
            raise WikiCompilationError("event_has_no_rebuild_targets")

        results = [self.compile_page(user_id, page_key, force=force) for page_key in page_keys]

        # Objective 4 (auto-trigger, 2026-07-08): wiki_validation_changed's semantics are
        # "recompute open_questions whenever any of the other 6 pages compiles" (per the design
        # brief §6/§9 decision #6 - open_questions is a meta-synthesis over the other pages'
        # claims and wiki_validation_findings()). Rather than requiring every table-level
        # trigger to also separately emit a literal wiki_validation_changed event, chain it here:
        # any event whose targets don't already include open_questions triggers one afterwards,
        # respecting the same debounce (force is NOT propagated to this chained call, so a
        # forced recompile of e.g. financial_context doesn't also force-recompile
        # open_questions on every call).
        if "open_questions" not in page_keys:
            results.append(self.compile_page(user_id, "open_questions"))

        return results

    def rebuild_digest(self, user_id: str) -> dict[str, Any]:
        pages = self._load_pages_for_digest(user_id)
        claims_by_page = self._load_claims_for_digest(user_id)
        digest = _digest_from_rows(user_id, pages, claims_by_page)
        self.store.client.table("wiki_digest").upsert(
            {"user_id": user_id, "wiki_version": "wiki-1.0", "generated_at": digest["generated_at"], "digest": digest},
            on_conflict="user_id",
        ).execute()
        return digest

    # -- Synthesis call (reuses the DocWikiSynthesisService pattern: direct Anthropic,
    #    LangSmith-wrapped, JSON-only output, resolve_platform_model, usage logging) -----

    def _anthropic_client(self) -> "anthropic.Anthropic":
        if self._anthropic_client_instance is None:
            settings = get_settings()
            self._anthropic_client_instance = wrap_anthropic(
                anthropic.Anthropic(api_key=settings.anthropic_api_key or "")
            )
        return self._anthropic_client_instance

    def _resolve_synthesis_model(self) -> str:
        settings = get_settings()
        resolved = self.store.resolve_platform_model(
            setting_key="wiki_tier1_synthesis",
            fallback_model_name=settings.claude_synthesis_model,
            fallback_provider="anthropic",
        )
        if resolved.get("provider") != "anthropic":
            return settings.claude_synthesis_model
        return resolved["model_name"]

    def _synthesize_page(
        self,
        user_id: str,
        page_key: str,
        page_config: dict[str, Any],
        source_bundle: dict[str, Any],
    ) -> dict[str, Any] | None:
        directive = PAGE_SYNTHESIS_DIRECTIVES.get(page_key)
        if not directive:
            return None

        system_prompt = _tier1_system_prompt()
        user_prompt = _tier1_user_prompt(page_config["title"], page_key, directive, source_bundle)
        model = self._resolve_synthesis_model()

        try:
            response = self._anthropic_client().messages.create(
                model=model,
                # 2026-07-08 checkpoint 2 live finding: 3072 truncated a real diagnostic_synthesis
                # response mid-JSON-string (8 primary sources -> several multi-sentence claims +
                # narrative + sourced_from routinely exceeds 3072 output tokens). Raised with
                # headroom; growth_constraints pulls even more sources than diagnostic_synthesis.
                max_tokens=8192,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
        except Exception as exc:  # noqa: BLE001
            import logging

            logging.getLogger(__name__).warning(
                "wiki_compilation: Tier-1 synthesis call failed page_key=%s user=%s model=%s: %s",
                page_key,
                user_id,
                model,
                exc,
            )
            return None

        if getattr(response, "stop_reason", None) == "max_tokens":
            import logging

            logging.getLogger(__name__).warning(
                "wiki_compilation: Tier-1 synthesis for page_key=%s user=%s hit max_tokens and was "
                "truncated by the API (not a JSON-formatting bug) - raise max_tokens further if this "
                "recurs after the 8192 bump.",
                page_key,
                user_id,
            )
            return None

        try:
            usage = anthropic_usage(response)
            log_ai_usage_event(
                self.store.client,
                user_id=user_id,
                surface="os_engine",
                model=model,
                role="utility",
                provider="anthropic",
                input_tokens=usage.input_tokens,
                output_tokens=usage.output_tokens,
                capability_key="wiki_tier1_synthesis",
            )
        except Exception:
            pass

        text = _response_text(response)
        try:
            parsed = json.loads(_strip_json_fence(text))
        except json.JSONDecodeError as exc:
            import logging

            logging.getLogger(__name__).warning(
                "wiki_compilation: Tier-1 synthesis JSON parse failed page_key=%s user=%s: %s | raw_text=%r",
                page_key,
                user_id,
                exc,
                text[:2000],
            )
            return None
        if not isinstance(parsed, dict):
            import logging

            logging.getLogger(__name__).warning(
                "wiki_compilation: Tier-1 synthesis returned non-object JSON page_key=%s user=%s: %s",
                page_key,
                user_id,
                type(parsed).__name__,
            )
            return None
        return parsed

    def _normalize_synthesis_output(
        self,
        user_id: str,
        page_key: str,
        parsed: dict[str, Any],
        valid_sources: set[tuple[str, str]],
    ) -> tuple[str, list[dict[str, Any]], list[dict[str, Any]], bool]:
        narrative = str(parsed.get("narrative") or "").strip()
        raw_claims = parsed.get("claims") if isinstance(parsed.get("claims"), list) else []
        claims: list[dict[str, Any]] = []

        for raw_claim in raw_claims[:15]:
            if not isinstance(raw_claim, dict):
                continue
            text = str(raw_claim.get("text") or "").strip()
            if not text:
                continue
            raw_evidence = raw_claim.get("evidence") if isinstance(raw_claim.get("evidence"), list) else []
            evidence: list[dict[str, Any]] = []
            for item in raw_evidence:
                if not isinstance(item, dict):
                    continue
                table = str(item.get("source_table") or item.get("table") or "").strip()
                source_id = str(item.get("source_id") or "").strip()
                # Never fabricate: evidence must resolve to a source we actually fetched
                # this compile. Anything else is dropped, not trusted.
                if not table or not source_id or (table, source_id) not in valid_sources:
                    continue
                evidence.append(
                    {
                        "source_id": source_id,
                        "source_kind": "tier0_record",
                        "path": f"{table}/{source_id}",
                        "lines": None,
                        "weight": 1.0,
                        "note": str(item.get("note") or f"Synthesized from Tier 0 source table {table}.")[:300],
                    }
                )
            if not evidence:
                continue  # a claim with no resolvable evidence is dropped, not kept unsourced
            confidence = str(raw_claim.get("confidence") or "medium")
            if confidence not in ("high", "medium", "low"):
                confidence = "medium"
            claims.append(
                {
                    "id": str(uuid4()),
                    "user_id": user_id,
                    "page_key": page_key,
                    "text": text,
                    "class": "compiled",
                    "status": "active",
                    "confidence": confidence,
                    "recall_score": 0.82 if len(evidence) > 1 else 0.62,
                    "evidence": evidence,
                }
            )

        raw_sourced_from = parsed.get("sourced_from") if isinstance(parsed.get("sourced_from"), list) else []
        sourced_from: list[dict[str, Any]] = []
        for item in raw_sourced_from[:20]:
            if not isinstance(item, dict):
                continue
            table = str(item.get("table") or "").strip()
            source_id = str(item.get("source_id") or "").strip()
            if not table or not source_id or (table, source_id) not in valid_sources:
                continue
            sourced_from.append({"table": table, "source_id": source_id, "note": str(item.get("note") or "")[:300]})

        thin = bool(parsed.get("thin")) or not claims
        if not narrative:
            title = get_wiki_schema()["pages"][page_key]["title"]
            narrative = (
                f"{title} is thin: we don't know this yet. Provide more source data "
                "(assessments, sprint plans, financial uploads, or clarity compass answers) "
                "to build this out."
            )
        return narrative, claims, sourced_from, thin

    # -- Objective 0: page-appropriate, bounded source gathering -------------------------

    def _load_sources(self, user_id: str, page_key: str) -> dict[str, list[dict[str, Any]]]:
        if page_key == "current_quarter_sprint":
            return {"primary": self._load_current_quarter_sprint_sources(user_id), "supporting": []}
        if page_key == "growth_constraints":
            return self._load_growth_constraints_sources(user_id)
        if page_key == "open_questions":
            return self._load_open_questions_sources(user_id)

        cache: dict[str, list[str]] = {}
        primary = self._gather(PRIMARY_SOURCE_TABLES_BY_PAGE.get(page_key, []), user_id, 6, cache)
        supporting = self._gather(SUPPORTING_SOURCE_TABLES_BY_PAGE.get(page_key, []), user_id, 3, cache)
        return {"primary": primary, "supporting": supporting}

    def _gather(
        self, tables: list[str], user_id: str, limit: int, cache: dict[str, list[str]]
    ) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for table in tables:
            for row in self._fetch_rows(table, user_id, limit, cache):
                source_id = _source_id(table, row)
                if source_id:
                    rows.append({"table": table, "source_id": source_id, "row": row})
        return rows

    def _fetch_rows(
        self, table: str, user_id: str, limit: int, assessment_id_cache: dict[str, list[str]]
    ) -> list[dict[str, Any]]:
        two_hop = TWO_HOP_OWNER_JOIN.get(table)

        def _base():
            query = self.store.client.table(table).select("*")
            if two_hop:
                fk_column, parent_table, parent_pk, parent_owner_column = two_hop
                ids = assessment_id_cache.get(parent_table)
                if ids is None:
                    try:
                        parent_rows = (
                            self.store.client.table(parent_table)
                            .select(parent_pk)
                            .eq(parent_owner_column, user_id)
                            .execute()
                            .data
                            or []
                        )
                    except Exception:
                        parent_rows = []
                    ids = [str(row[parent_pk]) for row in parent_rows if row.get(parent_pk)]
                    assessment_id_cache[parent_table] = ids
                if not ids:
                    return None
                return query.in_(fk_column, ids)
            owner_column = SOURCE_OWNER_COLUMNS.get(table, "user_id")
            return query.eq(owner_column, user_id)

        try:
            if table in TABLES_WITH_IS_CURRENT_FLAG:
                try:
                    query = _base()
                    if query is None:
                        return []
                    return query.eq("is_current", True).limit(limit).execute().data or []
                except Exception:
                    pass
            query = _base()
            if query is None:
                return []
            return query.limit(limit).execute().data or []
        except Exception:
            return []

    def _load_current_quarter_sprint_sources(self, user_id: str) -> list[dict[str, Any]]:
        """Current + one prior sprint (confirmed decision #2)."""
        rows: list[dict[str, Any]] = []

        try:
            quarter_rows = (
                self.store.client.table("quarter_map_selections")
                .select("*")
                .eq("user_id", user_id)
                .order("updated_at", desc=True)
                .limit(2)
                .execute()
                .data
                or []
            )
        except Exception:
            quarter_rows = []
        for row in quarter_rows:
            source_id = _source_id("quarter_map_selections", row)
            if source_id:
                rows.append({"table": "quarter_map_selections", "source_id": source_id, "row": row})

        try:
            goal_rows = (
                self.store.client.table("sp_sprint_goals")
                .select("*")
                .eq("user_id", user_id)
                .order("kickoff_date", desc=True)
                .limit(2)
                .execute()
                .data
                or []
            )
        except Exception:
            goal_rows = []
        for row in goal_rows:
            source_id = _source_id("sp_sprint_goals", row)
            if source_id:
                rows.append({"table": "sp_sprint_goals", "source_id": source_id, "row": row})

        goal_ids = [str(g["id"]) for g in goal_rows if g.get("id")]
        if not goal_ids:
            return rows

        try:
            initiative_rows = (
                self.store.client.table("sp_sprint_initiatives")
                .select("*")
                .eq("user_id", user_id)
                .in_("sprint_goal_id", goal_ids)
                .limit(15)
                .execute()
                .data
                or []
            )
        except Exception:
            initiative_rows = []
        for row in initiative_rows:
            source_id = _source_id("sp_sprint_initiatives", row)
            if source_id:
                rows.append({"table": "sp_sprint_initiatives", "source_id": source_id, "row": row})

        initiative_ids = [str(i["id"]) for i in initiative_rows if i.get("id")]
        if initiative_ids:
            try:
                milestone_rows = (
                    self.store.client.table("sp_sprint_milestones")
                    .select("*")
                    .eq("user_id", user_id)
                    .in_("initiative_id", initiative_ids)
                    .limit(25)
                    .execute()
                    .data
                    or []
                )
            except Exception:
                milestone_rows = []
            for row in milestone_rows:
                source_id = _source_id("sp_sprint_milestones", row)
                if source_id:
                    rows.append({"table": "sp_sprint_milestones", "source_id": source_id, "row": row})

        return rows

    def _load_growth_constraints_sources(self, user_id: str) -> dict[str, list[dict[str, Any]]]:
        """Merge (1) measured capability good-vs-current gaps with (2) the CC-selected
        horizon's GVS scenario constraints, per the design brief's core Growth Constraints
        mechanic."""
        cache: dict[str, list[str]] = {}
        primary = self._gather(
            ["gm_assessment_capability_scores", "gm_capability_rankings", "gm_assessment_checkpoint_scores"],
            user_id,
            10,
            cache,
        )

        try:
            quarter_rows = (
                self.store.client.table("quarter_map_selections")
                .select("*")
                .eq("user_id", user_id)
                .order("updated_at", desc=True)
                .limit(1)
                .execute()
                .data
                or []
            )
        except Exception:
            quarter_rows = []
        for row in quarter_rows:
            source_id = _source_id("quarter_map_selections", row)
            if source_id:
                primary.append({"table": "quarter_map_selections", "source_id": source_id, "row": row})

        primary.extend(self._load_horizon_scenario_context(user_id))
        return {"primary": primary, "supporting": []}

    def _load_horizon_scenario_context(self, user_id: str) -> list[dict[str, Any]]:
        """Confirmed live FK chain (Supabase MCP, 2026-07-08, project pwacpjqkntnovndhspxt):
        cc_synthesis.version_id -> cc_versions.id
        cc_version_horizon_snapshots.version_id -> cc_versions.id
        cc_version_horizon_snapshots.scenario_id -> gvs_saved_growth_scenarios.id  (the
            founder-selected horizon's saved scenario)
        gvs_saved_growth_scenarios.runtime_scenario_id -> gvs_growth_scenarios.id
        gvs_scenario_synthesis.scenario_id -> gvs_growth_scenarios.id  (NOT saved_growth_
            scenarios.id - a common trap; gvs_scenario_synthesis keys off the runtime
            scenario, not the saved one)
        """
        rows: list[dict[str, Any]] = []
        try:
            synthesis_rows = (
                self.store.client.table("cc_synthesis")
                .select("*")
                .eq("user_id", user_id)
                .eq("is_current", True)
                .order("generated_at", desc=True)
                .limit(1)
                .execute()
                .data
                or []
            )
        except Exception:
            synthesis_rows = []
        if not synthesis_rows:
            return rows
        synthesis = synthesis_rows[0]
        synthesis_id = _source_id("cc_synthesis", synthesis)
        if synthesis_id:
            rows.append({"table": "cc_synthesis", "source_id": synthesis_id, "row": synthesis})

        version_id = synthesis.get("version_id")
        if not version_id:
            return rows

        try:
            snapshot_rows = (
                self.store.client.table("cc_version_horizon_snapshots")
                .select("*")
                .eq("user_id", user_id)
                .eq("version_id", version_id)
                .order("created_at", desc=True)
                .execute()
                .data
                or []
            )
        except Exception:
            snapshot_rows = []
        snapshot = next((row for row in snapshot_rows if row.get("scenario_id")), None)
        if not snapshot:
            return rows
        snapshot_id = _source_id("cc_version_horizon_snapshots", snapshot)
        if snapshot_id:
            rows.append({"table": "cc_version_horizon_snapshots", "source_id": snapshot_id, "row": snapshot})

        scenario_id = snapshot["scenario_id"]
        try:
            saved_rows = (
                self.store.client.table("gvs_saved_growth_scenarios")
                .select("*")
                .eq("user_id", user_id)
                .eq("id", scenario_id)
                .limit(1)
                .execute()
                .data
                or []
            )
        except Exception:
            saved_rows = []
        if not saved_rows:
            return rows
        saved_scenario = saved_rows[0]
        rows.append({"table": "gvs_saved_growth_scenarios", "source_id": str(saved_scenario["id"]), "row": saved_scenario})

        runtime_scenario_id = saved_scenario.get("runtime_scenario_id")
        if not runtime_scenario_id:
            return rows

        try:
            synth_rows = (
                self.store.client.table("gvs_scenario_synthesis")
                .select("*")
                .eq("user_id", user_id)
                .eq("scenario_id", runtime_scenario_id)
                .eq("is_current", True)
                .order("run_number", desc=True)
                .limit(1)
                .execute()
                .data
                or []
            )
        except Exception:
            synth_rows = []
        if synth_rows:
            scenario_synthesis = synth_rows[0]
            rows.append(
                {"table": "gvs_scenario_synthesis", "source_id": str(scenario_synthesis["id"]), "row": scenario_synthesis}
            )
        return rows

    def _load_open_questions_sources(self, user_id: str) -> dict[str, list[dict[str, Any]]]:
        """Meta page: no Tier-0 tables. Synthesizes over the wiki's own validation/
        contradiction signals plus thin/low-confidence pages, per the design brief."""
        primary: list[dict[str, Any]] = []

        try:
            findings = (
                self.store.client.rpc("wiki_validation_findings", {"p_user_id": user_id}).execute().data or []
            )
        except Exception:
            findings = []

        try:
            claim_rows = (
                self.store.client.table("wiki_claims")
                .select("id,page_key,text,confidence,status")
                .eq("user_id", user_id)
                .neq("page_key", "open_questions")
                .neq("status", "retired")
                .in_("confidence", ["low", "medium"])
                .limit(25)
                .execute()
                .data
                or []
            )
        except Exception:
            claim_rows = []
        for claim in claim_rows:
            primary.append({"table": "wiki_claims", "source_id": str(claim["id"]), "row": claim})

        cited_claim_ids = {item["source_id"] for item in primary}
        for finding in findings:
            claim_id = finding.get("claim_id")
            if claim_id and str(claim_id) not in cited_claim_ids:
                primary.append({"table": "wiki_claims", "source_id": str(claim_id), "row": finding})
                cited_claim_ids.add(str(claim_id))

        try:
            page_rows = (
                self.store.client.table("wiki_pages")
                .select("id,page_key,title,one_line,narrative,last_compiled_at,stale")
                .eq("user_id", user_id)
                .neq("page_key", "open_questions")
                .execute()
                .data
                or []
            )
        except Exception:
            page_rows = []
        for page in page_rows:
            primary.append({"table": "wiki_pages", "source_id": str(page["id"]), "row": page})

        return {"primary": primary, "supporting": []}

    # -- Mechanical fallback (kept as the thin-page safety net) --------------------------

    def _build_claims(self, user_id: str, page_key: str, sources: list[dict[str, Any]]) -> list[dict[str, Any]]:
        claims: list[dict[str, Any]] = []
        multi_source = len({source["table"] for source in sources}) > 1
        confidence = "high" if multi_source else "medium"
        recall_score = 0.82 if multi_source else 0.62
        for source in sources[:12]:
            text = _claim_text(page_key, source["table"], source["row"])
            if not text:
                continue
            claims.append(
                {
                    "id": str(uuid4()),
                    "user_id": user_id,
                    "page_key": page_key,
                    "text": text,
                    "class": "compiled",
                    "status": "active",
                    "confidence": confidence,
                    "recall_score": recall_score,
                    "evidence": [
                        {
                            "source_id": source["source_id"],
                            "source_kind": "tier0_record",
                            "path": f"{source['table']}/{source['source_id']}",
                            "lines": None,
                            "weight": 1.0,
                            "note": f"Compiled from Tier 0 source table {source['table']}.",
                        }
                    ],
                }
            )
        return claims

    # -- Objective 3: projection + embedding fix ------------------------------------------

    def _project_to_ose(
        self,
        user_id: str,
        page_key: str,
        page_title: str,
        narrative: str,
        one_line: str,
        claims: list[dict[str, Any]],
        sourced_from: list[dict[str, Any]],
    ) -> None:
        """Mirror a compiled Layer 1 wiki page into ose_knowledge_pages.

        MA-03 fix: Gate 1 found this projection silently missing for real accounts. Two
        real, confirmed (2026-07-08, Supabase MCP) bugs caused it:
          1. The previous page_type='compiled_intelligence' / category='compiled_intelligence'
             values are not in ose_knowledge_pages_page_type_check /
             ose_knowledge_pages_category_check - every insert violated a CHECK constraint.
          2. confidence was written as the string 'high'/'medium'/'low' into a numeric
             column - every insert would also have failed on type coercion.
        Both were swallowed by a bare `except Exception: pass`, so compile_page() appeared
        to succeed while the projection silently never landed. Fixed here to use the
        schema's own ose_page_type mapping (config/wiki_schema.json) and a numeric
        confidence value. A companion migration also narrowed
        ux_ose_knowledge_pages_core_page_type to canonical_key IS NULL, because
        current_quarter_sprint and growth_constraints both map to page_type=strategic_context
        and would otherwise collide with each other and with the seed_core_knowledge_pages()
        scaffold row on that unique index.

        Also now embeds the projected content (closes DL-L1-EMBED) so wiki_search finds it
        semantically.

        Non-fatal: wiki_pages/wiki_claims/wiki_evidence (written by the RPC above) remain
        the compilation's source of truth. This is a read-convenience mirror for the CSO/
        Domain Agents; if the upsert or embed fails here, compile_page() still succeeds.
        """
        schema = get_wiki_schema()
        page_type = schema["pages"].get(page_key, {}).get("ose_page_type", "custom")
        category = CATEGORY_BY_PAGE_KEY.get(page_key, "org_health")

        content_parts = [f"{page_title}\n\n{narrative or one_line}"]
        if sourced_from:
            sourced_lines = "\n".join(
                f"- {item['table']}/{item['source_id']}" + (f": {item['note']}" if item.get("note") else "")
                for item in sourced_from
            )
            content_parts.append(f"## Sourced From\n{sourced_lines}")
        for claim in claims:
            text = str(claim.get("text") or "").strip()
            if text:
                content_parts.append(text)
        content = "\n\n".join(content_parts)

        confidences = [claim.get("confidence", "medium") for claim in claims]
        if "high" in confidences:
            confidence_label = "high"
        elif claims:
            confidence_label = "medium"
        else:
            confidence_label = "low"
        confidence_numeric = {"high": 0.85, "medium": 0.6, "low": 0.3}[confidence_label]

        page_id: str | None = None
        try:
            result = (
                self.store.client.table("ose_knowledge_pages")
                .upsert(
                    {
                        "user_id": user_id,
                        "canonical_key": page_key,
                        "page_title": page_title,
                        "page_kind": "wiki_layer1",
                        "page_type": page_type,
                        "category": category,
                        "domain": None,
                        "content": content,
                        "status": "active",
                        "confidence": confidence_numeric,
                        "source_file_ids": [],
                        "word_count": len(content.split()),
                        "last_updated": _now(),
                        "updated_at": _now(),
                    },
                    on_conflict="user_id,canonical_key",
                )
                .execute()
            )
            rows = result.data or []
            if rows:
                page_id = str(rows[0]["id"])
        except Exception as exc:  # noqa: BLE001
            import logging

            logging.getLogger(__name__).warning(
                "wiki_compilation: _project_to_ose upsert failed user=%s page_key=%s: %s",
                user_id,
                page_key,
                exc,
            )
            return

        if not page_id or not content.strip():
            return

        try:
            embedding = self.store.embed_query(
                content[:24000],
                user_id=user_id,
                surface="os_engine",
                capability_key="ingestion_embeddings",
            )
            self.store.client.table("ose_knowledge_pages").update({"embedding": embedding}).eq("id", page_id).execute()
        except Exception as exc:  # noqa: BLE001
            import logging

            logging.getLogger(__name__).warning(
                "wiki_compilation: _project_to_ose embed failed page_id=%s: %s", page_id, exc
            )

    # -- Digest (unchanged from wiki-1.0) -------------------------------------------------

    def _build_digest_payload(
        self,
        user_id: str,
        page_key: str,
        title: str,
        one_line: str,
        claims: list[dict[str, Any]],
    ) -> dict[str, Any]:
        existing_pages = [page for page in self._load_pages_for_digest(user_id) if page.get("page_key") != page_key]
        existing_claims = self._load_claims_for_digest(user_id)
        existing_claims.pop(page_key, None)
        page_row = {
            "page_key": page_key,
            "title": title,
            "one_line": one_line,
            "claim_count": len(claims),
            "top_claim_ids": [claim["id"] for claim in claims[:3]],
            "confidence_rollup": _rollup(claims),
            "last_compiled_at": _now(),
            "stale": False,
        }
        pages = existing_pages + [page_row]
        existing_claims[page_key] = [
            {
                "id": claim["id"],
                "page_key": page_key,
                "text": claim["text"],
                "confidence": claim["confidence"],
                "class": "compiled",
                "status": "active",
            }
            for claim in claims
        ]
        return _digest_from_rows(user_id, pages, existing_claims)

    def _load_pages_for_digest(self, user_id: str) -> list[dict[str, Any]]:
        rows = (
            self.store.client.table("wiki_pages")
            .select("page_key,title,one_line,last_compiled_at,stale")
            .eq("user_id", user_id)
            .execute()
            .data
            or []
        )
        claims_by_page = self._load_claims_for_digest(user_id)
        pages = []
        for row in rows:
            claims = claims_by_page.get(row["page_key"], [])
            pages.append(
                {
                    "page_key": row["page_key"],
                    "title": row.get("title"),
                    "one_line": row.get("one_line") or "",
                    "claim_count": len(claims),
                    "top_claim_ids": [claim["id"] for claim in claims[:3]],
                    "confidence_rollup": _rollup(claims),
                    "last_compiled_at": row.get("last_compiled_at"),
                    "stale": bool(row.get("stale")),
                }
            )
        return pages

    def _load_claims_for_digest(self, user_id: str) -> dict[str, list[dict[str, Any]]]:
        rows = (
            self.store.client.table("wiki_claims")
            .select("id,page_key,text,class,status,confidence")
            .eq("user_id", user_id)
            .neq("status", "retired")
            .execute()
            .data
            or []
        )
        grouped: dict[str, list[dict[str, Any]]] = {}
        for row in sorted(rows, key=_claim_digest_sort):
            grouped.setdefault(row["page_key"], []).append(row)
        return grouped


# ---------------------------------------------------------------------------
# Prompt builders for the Tier-1 synthesis call.
# ---------------------------------------------------------------------------

def _tier1_system_prompt() -> str:
    return (
        "You are the ArchitectOS Tier-1 Wiki synthesis engine. You produce ONE compiled page's "
        "worth of second-order synthesis for an agency founder - a genuine readback of the "
        "platform's understanding of one business area, cross-mapping the sources given to you, "
        "never a restatement of raw data. Return only valid JSON, no markdown fences, no "
        "commentary.\n\n"
        "Output schema (write claims first, then narrative, so the narrative is composed from "
        "claims you've already committed to rather than the other way around):\n"
        '{"claims": [{"text": string, "confidence": "high"|"medium"|"low", '
        '"evidence": [{"source_table": string, "source_id": string, "note": string}]}], '
        '"sourced_from": [{"table": string, "source_id": string, "note": string}], '
        '"narrative": string, "thin": boolean}\n\n'
        "Hard rules:\n"
        "1. Every evidence source_table/source_id you cite MUST be copied exactly from the "
        "'Available sources' section below - never invent a table name or id. Evidence that "
        "doesn't match an available source will be discarded, so only cite what you were given.\n"
        "2. GROUNDING (strict): the narrative is what a founder and their advisor will read and "
        "reason from directly - it carries the exact same no-hallucination guarantee as the "
        "claims. Every factual assertion in the narrative MUST be traceable to one of the claims "
        "you emitted in this same response. Do not introduce a fact, number, or characterization "
        "in the narrative that isn't backed by a claim above it. If you don't have a grounded "
        "claim for something, leave it out of the narrative rather than asserting it loosely. "
        "Narratives with zero backing claims will be discarded entirely and replaced with a "
        "generic thin-page statement, so a claim-less narrative is wasted effort - always ground "
        "the claims first.\n"
        "3. If the available sources are empty or too sparse to say anything real, set thin=true "
        "and write a narrative that plainly says what's missing and what would help - never "
        "fabricate a confident-sounding page over thin evidence.\n"
        "4. Prefer few well-evidenced, high-confidence claims over many speculative ones - up to "
        "about 8 claims is usually plenty; keep each claim's text to 1-3 sentences (specific and "
        "cited beats long and explanatory). The narrative should be a tight readback, not an "
        "essay - a few dense paragraphs, not a report.\n"
        "5. The narrative should explicitly note how this business area connects to or is "
        "constrained by what you can see of the founder's other context, when the sources make "
        "that visible - but only when that connection is itself backed by a claim.\n"
        "6. Confidence should reflect actual evidence strength: high = multiple corroborating "
        "sources or a direct founder-authored/AI-synthesized statement; medium = a single clear "
        "source; low = thin, old, or partially conflicting evidence."
    )


def _tier1_user_prompt(page_title: str, page_key: str, directive: str, source_bundle: dict[str, Any]) -> str:
    primary_block = _render_source_block(source_bundle.get("primary", []))
    supporting_block = _render_source_block(source_bundle.get("supporting", []))
    return (
        f"# Page\n{page_title} (page_key={page_key})\n\n"
        f"# Page-specific synthesis directive\n{directive}\n\n"
        f"# Available sources (lead with these - the vertical AI-synthesized outputs)\n"
        f"{primary_block or 'None available.'}\n\n"
        f"# Supporting structured records\n{supporting_block or 'None available.'}\n\n"
        "# Instructions\nWrite this page now, following the directive and hard rules above."
    )


def _render_source_block(sources: list[dict[str, Any]]) -> str:
    lines = []
    for source in sources[:24]:
        row_json = json.dumps(source["row"], default=str)[:1400]
        lines.append(f"- table={source['table']} source_id={source['source_id']}\n  {row_json}")
    return "\n".join(lines)


def _response_text(response: Any) -> str:
    parts = []
    for block in getattr(response, "content", []) or []:
        text = getattr(block, "text", None)
        if text:
            parts.append(text)
    return "\n".join(parts)


def _strip_json_fence(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?", "", stripped).strip()
        stripped = re.sub(r"```$", "", stripped).strip()
    return stripped


def _digest_from_rows(user_id: str, pages: list[dict[str, Any]], claims_by_page: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    all_claims = [claim for claims in claims_by_page.values() for claim in claims]
    low_confidence = sum(1 for claim in all_claims if claim.get("confidence") == "low")
    quarantined = sum(1 for claim in all_claims if claim.get("status") == "quarantined")
    page_digests = sorted(pages, key=lambda row: row.get("page_key") or "")
    top_claims = [
        {
            "claim_id": claim["id"],
            "page_key": claim["page_key"],
            "text": claim["text"],
            "confidence": claim.get("confidence") or "medium",
        }
        for claim in sorted(all_claims, key=_claim_digest_sort)[:8]
    ]
    return {
        "user_id": user_id,
        "wiki_version": "wiki-1.0",
        "generated_at": _now(),
        "pages": page_digests,
        "top_claims": top_claims,
        "counts": {
            "contradictions": 0,
            "open_questions": len(claims_by_page.get("open_questions", [])),
            "low_confidence": low_confidence,
            "quarantined": quarantined,
        },
        "qualifiers": {
            "overall_confidence": _overall_confidence(page_digests, low_confidence, quarantined),
            "oldest_page_age": _oldest_age(page_digests),
        },
    }


def _claim_text(page_key: str, table: str, row: dict[str, Any]) -> str:
    preferred = [
        "tl_dr_paragraph",
        "content_text",
        "synthesis_headline",
        "vision_statement",
        "mission_statement",
        "financial_health_status",
        "synthesis_signal",
        "goal_text",
        "outcome_statement",
        "summary",
        "synthesis",
        "insight",
        "title",
        "name",
        "status",
        "stage_name",
        "dimension_name",
        "capability_name",
        "dataset_name",
        "file_name",
        "description",
    ]
    facts = []
    for key in preferred:
        value = row.get(key)
        if value not in (None, "", [], {}):
            facts.append(f"{key}: {_short(value)}")
        if len(facts) >= 3:
            break
    if not facts:
        for key, value in row.items():
            if key in {"id", "user_id", "created_at", "updated_at"} or value in (None, "", [], {}):
                continue
            facts.append(f"{key}: {_short(value)}")
            if len(facts) >= 3:
                break
    if not facts:
        return ""
    page_label = get_wiki_schema()["pages"][page_key]["title"]
    return f"{page_label} includes {table} evidence ({'; '.join(facts)})."


def _one_line(title: str, sources: list[dict[str, Any]], claims: list[dict[str, Any]]) -> str:
    if not sources:
        return f"{title} is thin: no current Tier 0 source rows were available at compile time."
    return f"{title} compiled from {len(sources)} Tier 0 source row(s) into {len(claims)} evidence-bearing claim(s)."


# Checkpoint-2 live finding, second pass (2026-07-08): even after reordering the flat
# priority list to put specific PK names ahead of generic parent-FK names, one more case
# broke it - gm_capability_rankings carries BOTH its own PK (capability_ranking_id) AND a
# capability_score_id column that is a FOREIGN KEY into gm_assessment_capability_scores
# (confirmed live). A flat priority list has no way to know that "capability_score_id"
# is the *right* answer for gm_assessment_capability_scores rows but the *wrong* answer
# for gm_capability_rankings rows - it collapsed two genuinely distinct claims (a
# capability score and its ranking) onto the same shared id. A single global ordering
# cannot be safe across tables that reference each other by id-shaped foreign keys; the
# only reliable fix is to know each table's own PK explicitly.
#
# Confirmed live via Supabase MCP (project pwacpjqkntnovndhspxt, 2026-07-08). Tables not
# listed here (cc_*, gvs_*, sp_*, quarter_map_selections, agency_snapshot_*, wiki_claims,
# wiki_pages) all use a plain `id` PK and fall through to the generic heuristic below,
# which already finds "id" first.
TABLE_PRIMARY_KEY_COLUMN: dict[str, str] = {
    "ae_assessments": "ae_assessment_id",
    "ae_assessment_insights": "ae_assessment_insight_id",
    "ae_responses": "ae_response_id",
    "ae_dimension_scores": "ae_assessment_dimension_score_id",
    "ae_assessment_snapshots": "id",
    "vw_ae_dashboard_results": "ae_assessment_id",  # view; one row per assessment, no other id
    "vw_ae_stage_context": "ae_assessment_id",  # view; one row per assessment, no other id
    "gm_assessments": "assessment_id",
    "gm_assessment_responses": "response_id",
    "gm_assessment_checkpoint_scores": "checkpoint_score_id",
    "gm_assessment_capability_scores": "capability_score_id",
    "gm_assessment_dimension_scores": "dimension_score_id",
    "gm_assessment_pillar_scores": "pillar_score_id",
    "gm_assessment_overall_scores": "overall_score_id",
    "gm_assessment_gpt_outputs": "gpt_output_id",
    "gm_capability_rankings": "capability_ranking_id",
}


def _source_id(table: str, row: dict[str, Any]) -> str | None:
    pk_column = TABLE_PRIMARY_KEY_COLUMN.get(table)
    if pk_column:
        value = row.get(pk_column)
        if value:
            return str(value)
        # Column absent from this select (shouldn't happen with select("*")) - fall
        # through to the generic heuristic below rather than returning None outright.
    preferred_keys = ("id", "snapshot_id", "run_id", "dataset_id", "document_id")
    for key in preferred_keys:
        value = row.get(key)
        if value:
            return str(value)
    for key, value in row.items():
        if key.endswith("_id") and value:
            return str(value)
    return None


def _rollup(claims: list[dict[str, Any]]) -> str:
    if not claims:
        return "low"
    if any(claim.get("confidence") == "low" for claim in claims):
        return "low"
    if all(claim.get("confidence") == "high" for claim in claims):
        return "high"
    return "medium"


def _overall_confidence(pages: list[dict[str, Any]], low_confidence: int, quarantined: int) -> str:
    if low_confidence or quarantined or any(page.get("confidence_rollup") == "low" for page in pages):
        return "low"
    if pages and all(page.get("confidence_rollup") == "high" for page in pages):
        return "high"
    return "medium"


def _oldest_age(pages: list[dict[str, Any]]) -> str:
    timestamps = [page.get("last_compiled_at") for page in pages if page.get("last_compiled_at")]
    if not timestamps:
        return "unknown"
    try:
        oldest = min(datetime.fromisoformat(str(value).replace("Z", "+00:00")) for value in timestamps)
    except ValueError:
        return "unknown"
    days = max(0, (datetime.now(timezone.utc) - oldest).days)
    return f"{days}d"


def _claim_digest_sort(claim: dict[str, Any]) -> tuple[int, int, str]:
    class_rank = {"override": 0, "compiled": 1, "insight": 2}.get(str(claim.get("class")), 9)
    confidence_rank = {"high": 0, "medium": 1, "low": 2}.get(str(claim.get("confidence")), 9)
    return (class_rank, confidence_rank, str(claim.get("id") or ""))


def _short(value: Any, max_chars: int = 160) -> str:
    text = " ".join(str(value).split())
    if len(text) <= max_chars:
        return text
    return f"{text[:max_chars].rstrip()}..."


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
