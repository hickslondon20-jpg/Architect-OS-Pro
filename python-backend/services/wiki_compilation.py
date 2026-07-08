"""Compilation service for the ArchitectOS per-user wiki.

MA-03 (2026-07-08, rebuilt after a lost-in-sync incident on the same date - see
Pro-Suite-Progress.md and .planning/codebase/Concerns.md for the incident writeup): upgraded
from mechanical templating to LLM synthesis. Additive to the wiki-1.0 contract: the
source-loading entrypoint, replace_compiled_wiki_page RPC, health validation, and
_project_to_ose all still run every compile - only the middle step (claims-from-a-.limit(3)-dump)
is replaced with a Sonnet synthesis call, and several real bugs found while wiring this up are
fixed in place (see _project_to_ose and _source_id docstrings/comments).
"""

from __future__ import annotations

import json
import re
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any
from uuid import uuid4

import anthropic

try:
    from langsmith.wrappers import wrap_anthropic
except Exception:  # pragma: no cover - defensive: never let optional tracing take the app down
    def wrap_anthropic(client):  # type: ignore[no-redef]
        return client

from core.config import get_settings
from core.wiki_schema import event_rebuild_targets, get_wiki_schema, valid_page_key
from services.vector_store import VectorStoreError
from services.wiki_health import WikiHealthError, WikiHealthService

if TYPE_CHECKING:
    from services.vector_store import VectorStore

logger = logging.getLogger(__name__)


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
    # Objective 4 (auto-trigger): true when this compile was skipped because the page was
    # already compiled inside RECOMPILE_DEBOUNCE_MINUTES and force=False. Kept as an explicit,
    # observable field for the same reason synthesis_model=mechanical_fallback is observable -
    # a skipped compile must never look indistinguishable from a real one.
    skipped: bool = False


# Objective 4 (auto-trigger): recency-guard debounce. The 10 event_rebuild_targets events are
# emitted live by Postgres triggers (via pg_net) on the underlying platform tables - a founder
# editing the same sprint goal repeatedly, or a bulk CSV upload inserting hundreds of
# founder_dataset_rows, would otherwise fire one compile (and one billed Sonnet call) per
# row/edit. Rather than adding new queue/worker infrastructure, compile_page skips recompiling
# a page that was already compiled within this window, unless force=True.
RECOMPILE_DEBOUNCE_MINUTES = 10


# ---------------------------------------------------------------------------
# Objective 0: input-gathering upgrade.
#
# Leads with the already-synthesized vertical AI outputs (gm_assessment_gpt_outputs,
# ae_assessment_insights, cc_synthesis, gvs_scenario_synthesis, and the *_synthesis /
# synthesis_beat_* columns that already live on the agency_snapshot_* tables) rather than the
# raw structured rows beneath them. "Supporting" tables are the raw records used to
# ground/quantify those synthesized claims.
#
# current_quarter_sprint, growth_constraints, and open_questions are NOT driven by this table
# map at all - each is handled by a dedicated gather method below (a sprint-scoped traversal, a
# live FK traversal through the horizon/scenario chain, and a wiki-internal meta-gather,
# respectively) per the design brief's special-case charters.
# ---------------------------------------------------------------------------

PRIMARY_SOURCE_TABLES_BY_PAGE: dict[str, list[str]] = {
    "business_context": ["cc_synthesis"],
    "diagnostic_synthesis": ["gm_assessment_gpt_outputs", "ae_assessment_insights"],
    "current_quarter_sprint": [],  # handled by _load_current_quarter_sprint_sources
    "growth_constraints": [],  # handled by _load_growth_constraints_sources
    "financial_context": ["agency_snapshot_economic_foundation", "agency_snapshot_revenue_model"],
    "client_market_position": ["agency_snapshot_market_footprint", "gvs_scenario_synthesis"],
    "open_questions": [],  # handled by _load_open_questions_sources
}

SUPPORTING_SOURCE_TABLES_BY_PAGE: dict[str, list[str]] = {
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

# Tables whose owner is one hop away (a parent assessment row), not a direct user_id column.
# Confirmed live via Supabase MCP: none of the ae_*/gm_* assessment child tables carry their own
# user_id - the pre-MA-03 mechanical loader's default .eq("user_id", user_id) silently returned
# zero rows for all of them on real accounts. Shape: {table: (local_fk_column, parent_table,
# parent_pk_column, parent_owner_column)}.
TWO_HOP_OWNER_JOIN: dict[str, tuple[str, str, str, str]] = {
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

# Tables that carry an is_current flag worth filtering on when gathering "the live record", with
# a fallback to the unfiltered set if filtering returns nothing (handles accounts mid-transition).
TABLES_WITH_IS_CURRENT_FLAG = {
    "cc_synthesis",
    "ae_assessment_snapshots",
}

# ose_knowledge_pages.category per page_key - confirmed against the live CHECK constraint via
# Supabase MCP. The pre-MA-03 _project_to_ose wrote category='compiled_intelligence' for every
# page, which is not a valid value; this map is the fix.
CATEGORY_BY_PAGE_KEY: dict[str, str] = {
    "business_context": "founder_identity",
    "diagnostic_synthesis": "org_health",
    "current_quarter_sprint": "operational",
    "growth_constraints": "org_health",
    "financial_context": "financial",
    "client_market_position": "client_market",
    "open_questions": "conversation_meeting",
}

# Explicit per-table primary-key map, replacing a flat "try common id-suffixed column names"
# heuristic. Several tables carry a same-shaped *_id column that is a foreign key into a
# *different* sibling table, not their own PK (e.g. gm_capability_rankings has both its own
# capability_ranking_id AND a capability_score_id FK into gm_assessment_capability_scores - a
# flat priority list can't safely tell those apart). All names confirmed live via Supabase MCP.
TABLE_PRIMARY_KEY_COLUMN: dict[str, str] = {
    "ae_assessments": "ae_assessment_id",
    "ae_assessment_insights": "ae_assessment_insight_id",
    "ae_responses": "ae_response_id",
    "ae_dimension_scores": "ae_assessment_dimension_score_id",
    "ae_assessment_snapshots": "id",
    "vw_ae_dashboard_results": "ae_assessment_id",
    "vw_ae_stage_context": "ae_assessment_id",
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


PAGE_SYNTHESIS_DIRECTIVES: dict[str, str] = {
    "business_context": """
Question this page answers: Who is this founder, what are they building, and what future are
they steering toward?

Primary source is cc_synthesis (the Clarity Compass AI synthesis) - vision/mission statements,
founder arc, movement narratives, and horizon headlines/summaries. Supporting sources
(cc_versions, cc_version_horizon_snapshots) tell you whether there is version history to compare
and which horizons (12/24/36/ultimate) are actually on record.

Thin-page policy (strict): some accounts (including the seeded test account) carry literal
placeholder text (e.g. fields containing "SEED -" or similar stub markers) instead of real
founder-authored content. If you detect placeholder/stub content, do NOT synthesize a founder
identity from it - instead produce claims that honestly describe what's actually on record (e.g.
"the synthesis record is a placeholder; no genuine vision/mission content exists yet") and let the
narrative say plainly that this is not yet known. Never invent vision, mission, or founder-arc
content that isn't genuinely present in the source data.
""".strip(),
    "diagnostic_synthesis": """
Question this page answers: What do the AE Ladder and Growth Model Audit actually say about this
founder's current stage and constraints?

Primary sources are the two vertical AI outputs: gm_assessment_gpt_outputs (the GMA's own
narrative synthesis) and ae_assessment_insights (the AE Ladder's own narrative synthesis).
Supporting sources ground and quantify those narratives: vw_ae_dashboard_results/
vw_ae_stage_context (AE stage placement), gm_assessment_capability_scores/gm_capability_rankings
(capability-level maturity and priority ranking), gm_assessment_pillar_scores/
gm_assessment_overall_scores (pillar and overall maturity rollups).

Synthesize a coherent picture of where this founder sits across both instruments. If the AE stage
and the GMA maturity band read as being in tension (e.g. AE says near-readiness to progress while
GMA reads as mid-development), say so explicitly - that tension is itself a genuinely useful
signal, not noise.
""".strip(),
    "current_quarter_sprint": """
Question this page answers: What is this founder actually executing on right now, and why does it
matter?

Sources are gathered via a dedicated sprint-scoped traversal (not the generic table map): the
current sprint goal plus one prior sprint goal for carryover context (sp_sprint_goals ordered by
kickoff_date desc, limit 2), the initiatives scoped to those goals (sp_sprint_initiatives), and
the milestones scoped to those initiatives (sp_sprint_milestones).

Synthesize the active quarter priority, the sprint goal it's framed around, the initiative(s)
driving it, and any known constraints or blockers on those initiatives. If there is no
prior-sprint data on record, say so plainly rather than fabricating carryover/resolution context -
that absence is itself informative (this may be the founder's first tracked sprint). Connect the
initiative's "done" definition to what it actually unlocks next, when that's stated in the data.
""".strip(),
    "growth_constraints": """
Question this page answers: What is actually constraining this founder's growth right now, at the
capability level?

Sources are gathered via a dedicated live FK traversal (not the generic table map), confirmed
against the real schema: cc_synthesis.version_id -> cc_versions.id gives the founder's current
Clarity Compass version; cc_version_horizon_snapshots.scenario_id -> gvs_saved_growth_scenarios.id
gives the founder's selected horizon scenario; gvs_saved_growth_scenarios.runtime_scenario_id ->
gvs_growth_scenarios.id gives the underlying runtime scenario; gvs_scenario_synthesis.scenario_id
keys off that *runtime* scenario id (not the saved-scenario id - a confirmed trap). Merge this
horizon/scenario context with gm_assessment_capability_scores and gm_capability_rankings
(good-vs-current variance_pct and rank_overall) to identify the capability actually gating growth.

Synthesize which capability is the binding constraint, how far it is from where it needs to be,
and how that connects to the growth scenario the founder has actually selected. Do not conflate
"a capability with a low score" with "the capability that's actually ranked as the priority
constraint" - use the ranking data to distinguish them.
""".strip(),
    "financial_context": """
Question this page answers: What is this founder's actual financial position, and how stable is
it structurally?

Primary sources are agency_snapshot_economic_foundation and agency_snapshot_revenue_model (the
platform's own financial synthesis - health status, cash flow health, revenue/AGI/margin
figures). Supporting sources are agency_snapshot_delivery_architecture (team/delivery structure)
and founder_dataset_rows_v (founder-uploaded structured financial data, e.g. an uploaded P&L).

Synthesize the real financial picture: revenue composition (recurring vs. project), margin
structure after real costs, cash runway and liquidity buffer, client concentration risk, and
churn/retention dynamics - wherever the source data actually supports each of these. If only a
single point-in-time snapshot exists (no multi-period trend, no live accounting feed), say so
explicitly rather than implying a verified trend. Never compute or assert a financial figure that
isn't directly present in or a plain arithmetic derivation of the source rows.
""".strip(),
    "client_market_position": """
Question this page answers: How does this founder actually position in the market, and does that
match their real structural footprint?

Primary sources are agency_snapshot_market_footprint (stated positioning, target market) and
gvs_scenario_synthesis (the growth scenario's own signal about niche/positioning). Supporting
sources are three reference tables (agency_snapshot_agency_type_ref_table,
agency_snapshot_services_ref_table, agency_snapshot_industries_ref_table) - note these ref tables
carry no user_id of their own and may legitimately contribute zero rows for a given account; treat
that as expected, not an error.

Synthesize the founder's stated market identity against their actual structural footprint (service
lines, industry concentration, geography). If there's a gap - e.g. a broad stated positioning
against a narrow, concentrated actual footprint - surface that tension explicitly; it's exactly
the kind of insight this page exists to produce, not something to smooth over.
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
            # Grounding rule: the narrative is what lands in ose_knowledge_pages.content and is
            # what the CSO actually reads and reasons from - it must carry the same
            # no-hallucination guarantee as the claims. Only trust the LLM narrative when it has
            # at least one grounded claim behind it; if every claim got dropped by the evidence
            # filter, the narrative could be asserting things nothing here actually backs, so
            # discard it wholesale rather than persist ungrounded prose.
            if candidate_claims:
                narrative = candidate_narrative
                claims = candidate_claims
                sourced_from = candidate_sourced_from
                synthesis_used = True
            else:
                raw_claim_count = len(parsed.get("claims") or []) if isinstance(parsed.get("claims"), list) else -1
                logger.warning(
                    "wiki_compilation: Tier-1 synthesis for page_key=%s user=%s returned %d raw claim(s) but 0 "
                    "survived evidence grounding; falling back to mechanical claims. narrative_preview=%r",
                    page_key,
                    user_id,
                    raw_claim_count,
                    (candidate_narrative or "")[:200],
                )

        if not claims:
            # Thin-page policy: fall back to the mechanical compiled claims so a synthesis miss
            # (LLM call failed, bad JSON, or zero groundable claims) never regresses below the
            # pre-MA-03 baseline, and a genuinely empty source set still produces an honest thin
            # statement rather than a fabricated one.
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
        # Always record whether this compile actually used the LLM synthesis or fell back to
        # mechanical templating, so a page can never silently look synthesized while it's
        # actually templated - queryable via wiki_pages.synthesis_model for verification.
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
        """Returns a skipped CompileResult if page_key was compiled within the debounce window
        for this user, else None (caller should proceed with a real compile)."""
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
        logger.info(
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

        # wiki_validation_changed's semantics are "recompute open_questions whenever any of the
        # other 6 pages compiles" (open_questions is a meta-synthesis over the other pages'
        # claims and wiki_validation_findings()). Rather than requiring every table-level trigger
        # to also separately emit a literal wiki_validation_changed event, chain it here: any
        # event whose targets don't already include open_questions triggers one afterwards,
        # respecting the same debounce (force is NOT propagated to this chained call, so a forced
        # recompile of e.g. financial_context doesn't also force-recompile open_questions).
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
    #    LangSmith-wrapped, JSON-only output, resolve_platform_model, structured logging) ------

    def _anthropic_client(self) -> "anthropic.Anthropic":
        if self._anthropic_client_instance is None:
            settings = get_settings()
            self._anthropic_client_instance = wrap_anthropic(
                anthropic.Anthropic(api_key=settings.anthropic_api_key or "")
            )
        return self._anthropic_client_instance

    def _resolve_synthesis_model(self) -> str:
        resolved = self.store.resolve_platform_model(
            setting_key="wiki_tier1_synthesis",
            fallback_model_name="claude-sonnet-4-5-20250929",
            fallback_provider="anthropic",
        )
        return resolved["model_name"]

    def _synthesize_page(
        self,
        user_id: str,
        page_key: str,
        page_config: dict[str, Any],
        source_bundle: dict[str, list[dict[str, Any]]],
    ) -> dict[str, Any] | None:
        model_name = self._resolve_synthesis_model()
        system_prompt = self._tier1_system_prompt(page_key, page_config)
        user_prompt = self._tier1_user_prompt(page_key, source_bundle)

        try:
            response = self._anthropic_client().messages.create(
                model=model_name,
                max_tokens=8192,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
        except Exception as exc:
            logger.warning(
                "wiki_compilation: Tier-1 synthesis API call failed for page_key=%s user=%s: %s",
                page_key,
                user_id,
                exc,
            )
            return None

        if getattr(response, "stop_reason", None) == "max_tokens":
            logger.warning(
                "wiki_compilation: Tier-1 synthesis for page_key=%s user=%s hit max_tokens truncation.",
                page_key,
                user_id,
            )

        text = _response_text(response)
        try:
            parsed = json.loads(_strip_json_fence(text))
        except json.JSONDecodeError as exc:
            logger.warning(
                "wiki_compilation: Tier-1 synthesis JSON parse failed for page_key=%s user=%s: %s | raw_preview=%r",
                page_key,
                user_id,
                exc,
                text[:300],
            )
            return None

        if not isinstance(parsed, dict):
            logger.warning(
                "wiki_compilation: Tier-1 synthesis for page_key=%s user=%s returned non-dict JSON (%s).",
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
        raw_sourced_from = parsed.get("sourced_from") if isinstance(parsed.get("sourced_from"), list) else []

        claims: list[dict[str, Any]] = []
        for raw_claim in raw_claims:
            if not isinstance(raw_claim, dict):
                continue
            text = str(raw_claim.get("text") or "").strip()
            if not text:
                continue
            confidence = raw_claim.get("confidence") if raw_claim.get("confidence") in ("high", "medium", "low") else "medium"

            raw_evidence = raw_claim.get("evidence") if isinstance(raw_claim.get("evidence"), list) else []
            evidence: list[dict[str, Any]] = []
            for raw_ev in raw_evidence:
                if not isinstance(raw_ev, dict):
                    continue
                table = str(raw_ev.get("table") or "")
                source_id = str(raw_ev.get("source_id") or "")
                # Hard-filter every claim's evidence against the actual fetched source set
                # (table+id) so the model cannot fabricate a citation.
                if (table, source_id) not in valid_sources:
                    continue
                evidence.append(
                    {
                        "source_id": source_id,
                        "source_kind": "tier0_record",
                        "path": f"{table}/{source_id}",
                        "lines": None,
                        "weight": 1.0,
                        "note": str(raw_ev.get("note") or f"Cited from {table}."),
                    }
                )

            # A claim with zero resolvable evidence is dropped entirely rather than kept
            # unsourced - never fabricate.
            if not evidence:
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
                    "recall_score": 0.82 if len(evidence) > 1 else 0.68,
                    "evidence": evidence,
                }
            )

        sourced_from: list[dict[str, Any]] = []
        for raw_source in raw_sourced_from:
            if not isinstance(raw_source, dict):
                continue
            table = str(raw_source.get("table") or "")
            source_id = str(raw_source.get("source_id") or "")
            if (table, source_id) not in valid_sources:
                continue
            sourced_from.append(
                {
                    "table": table,
                    "source_id": source_id,
                    "note": str(raw_source.get("note") or f"Tier 0 source table {table}."),
                }
            )
        if not sourced_from:
            sourced_from = [
                {"table": table, "source_id": source_id, "note": f"Tier 0 source table {table}."}
                for table, source_id in list(valid_sources)[:20]
            ]

        return narrative, claims, sourced_from, not claims

    # -- Objective 0: input-gathering upgrade --------------------------------------------

    def _load_sources(self, user_id: str, page_key: str) -> dict[str, list[dict[str, Any]]]:
        if page_key == "current_quarter_sprint":
            return self._load_current_quarter_sprint_sources(user_id)
        if page_key == "growth_constraints":
            return self._load_growth_constraints_sources(user_id)
        if page_key == "open_questions":
            return self._load_open_questions_sources(user_id)

        primary = self._gather(user_id, PRIMARY_SOURCE_TABLES_BY_PAGE.get(page_key, []))
        supporting = self._gather(user_id, SUPPORTING_SOURCE_TABLES_BY_PAGE.get(page_key, []))
        return {"primary": primary, "supporting": supporting}

    def _gather(self, user_id: str, tables: list[str]) -> list[dict[str, Any]]:
        gathered: list[dict[str, Any]] = []
        for table in tables:
            gathered.extend(self._fetch_rows(table, user_id))
        return gathered

    def _fetch_rows(self, table: str, user_id: str, *, limit: int = 5) -> list[dict[str, Any]]:
        two_hop = TWO_HOP_OWNER_JOIN.get(table)
        rows: list[dict[str, Any]] = []

        if two_hop:
            local_fk_column, parent_table, parent_pk_column, parent_owner_column = two_hop
            try:
                parent_rows = (
                    self.store.client.table(parent_table)
                    .select(parent_pk_column)
                    .eq(parent_owner_column, user_id)
                    .execute()
                    .data
                    or []
                )
            except Exception:
                parent_rows = []
            parent_ids = [str(row[parent_pk_column]) for row in parent_rows if row.get(parent_pk_column)]
            if not parent_ids:
                return []
            try:
                rows = (
                    self.store.client.table(table)
                    .select("*")
                    .in_(local_fk_column, parent_ids)
                    .limit(limit)
                    .execute()
                    .data
                    or []
                )
            except Exception:
                rows = []
        else:
            try:
                query = self.store.client.table(table).select("*").eq("user_id", user_id)
                if table in TABLES_WITH_IS_CURRENT_FLAG:
                    query = query.eq("is_current", True)
                rows = query.limit(limit).execute().data or []
                if not rows and table in TABLES_WITH_IS_CURRENT_FLAG:
                    # Fallback for accounts mid-transition: no row flagged current, but rows exist.
                    rows = (
                        self.store.client.table(table)
                        .select("*")
                        .eq("user_id", user_id)
                        .limit(limit)
                        .execute()
                        .data
                        or []
                    )
            except Exception:
                rows = []

        results = []
        for row in rows:
            source_id = _source_id(table, row)
            if not source_id:
                continue
            results.append({"table": table, "source_id": source_id, "row": row})
        return results

    def _load_current_quarter_sprint_sources(self, user_id: str) -> dict[str, list[dict[str, Any]]]:
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

        primary: list[dict[str, Any]] = []
        supporting: list[dict[str, Any]] = []
        goal_ids: list[str] = []
        for i, row in enumerate(goal_rows):
            source_id = _source_id("sp_sprint_goals", row)
            if not source_id:
                continue
            goal_ids.append(source_id)
            bucket = primary if i == 0 else supporting
            bucket.append({"table": "sp_sprint_goals", "source_id": source_id, "row": row})

        initiative_ids: list[str] = []
        if goal_ids:
            try:
                initiative_rows = (
                    self.store.client.table("sp_sprint_initiatives")
                    .select("*")
                    .in_("sprint_goal_id", goal_ids)
                    .limit(10)
                    .execute()
                    .data
                    or []
                )
            except Exception:
                initiative_rows = []
            for row in initiative_rows:
                source_id = _source_id("sp_sprint_initiatives", row)
                if not source_id:
                    continue
                initiative_ids.append(source_id)
                primary.append({"table": "sp_sprint_initiatives", "source_id": source_id, "row": row})

        if initiative_ids:
            try:
                milestone_rows = (
                    self.store.client.table("sp_sprint_milestones")
                    .select("*")
                    .in_("initiative_id", initiative_ids)
                    .limit(20)
                    .execute()
                    .data
                    or []
                )
            except Exception:
                milestone_rows = []
            for row in milestone_rows:
                source_id = _source_id("sp_sprint_milestones", row)
                if not source_id:
                    continue
                supporting.append({"table": "sp_sprint_milestones", "source_id": source_id, "row": row})

        return {"primary": primary, "supporting": supporting}

    def _load_growth_constraints_sources(self, user_id: str) -> dict[str, list[dict[str, Any]]]:
        primary: list[dict[str, Any]] = []
        supporting: list[dict[str, Any]] = []

        supporting.extend(self._load_horizon_scenario_context(user_id))

        for table in ("gm_assessment_capability_scores", "gm_capability_rankings"):
            primary.extend(self._fetch_rows(table, user_id))

        return {"primary": primary, "supporting": supporting}

    def _load_horizon_scenario_context(self, user_id: str) -> list[dict[str, Any]]:
        """Live FK traversal, confirmed against the real schema:
        cc_synthesis.version_id -> cc_versions.id (the founder's current CC version)
        cc_version_horizon_snapshots.scenario_id -> gvs_saved_growth_scenarios.id (selected horizon)
        gvs_saved_growth_scenarios.runtime_scenario_id -> gvs_growth_scenarios.id (runtime scenario)
        gvs_scenario_synthesis.scenario_id keys off that *runtime* id, not the saved-scenario id.
        """
        results: list[dict[str, Any]] = []
        try:
            cc_rows = (
                self.store.client.table("cc_synthesis")
                .select("version_id")
                .eq("user_id", user_id)
                .eq("is_current", True)
                .limit(1)
                .execute()
                .data
                or []
            )
        except Exception:
            cc_rows = []
        version_id = cc_rows[0].get("version_id") if cc_rows else None
        if not version_id:
            return results

        try:
            snapshot_rows = (
                self.store.client.table("cc_version_horizon_snapshots")
                .select("scenario_id")
                .eq("version_id", version_id)
                .limit(5)
                .execute()
                .data
                or []
            )
        except Exception:
            snapshot_rows = []
        saved_scenario_ids = [row["scenario_id"] for row in snapshot_rows if row.get("scenario_id")]
        if not saved_scenario_ids:
            return results

        try:
            saved_rows = (
                self.store.client.table("gvs_saved_growth_scenarios")
                .select("*")
                .in_("id", saved_scenario_ids)
                .limit(5)
                .execute()
                .data
                or []
            )
        except Exception:
            saved_rows = []
        for row in saved_rows:
            source_id = _source_id("gvs_saved_growth_scenarios", row)
            if source_id:
                results.append({"table": "gvs_saved_growth_scenarios", "source_id": source_id, "row": row})

        runtime_scenario_ids = [row["runtime_scenario_id"] for row in saved_rows if row.get("runtime_scenario_id")]
        if not runtime_scenario_ids:
            return results

        try:
            synthesis_rows = (
                self.store.client.table("gvs_scenario_synthesis")
                .select("*")
                .in_("scenario_id", runtime_scenario_ids)
                .limit(5)
                .execute()
                .data
                or []
            )
        except Exception:
            synthesis_rows = []
        for row in synthesis_rows:
            source_id = _source_id("gvs_scenario_synthesis", row)
            if source_id:
                results.append({"table": "gvs_scenario_synthesis", "source_id": source_id, "row": row})

        return results

    def _load_open_questions_sources(self, user_id: str) -> dict[str, list[dict[str, Any]]]:
        primary: list[dict[str, Any]] = []

        try:
            findings = self.store.client.rpc("wiki_validation_findings", {"p_user_id": user_id}).execute().data or []
        except Exception:
            findings = []
        for i, row in enumerate(findings[:20]):
            source_id = str(row.get("id") or f"finding-{i}")
            primary.append({"table": "wiki_validation_findings", "source_id": source_id, "row": row})

        try:
            low_medium_claims = (
                self.store.client.table("wiki_claims")
                .select("*")
                .eq("user_id", user_id)
                .in_("confidence", ["low", "medium"])
                .neq("status", "retired")
                .limit(30)
                .execute()
                .data
                or []
            )
        except Exception:
            low_medium_claims = []
        for row in low_medium_claims:
            source_id = str(row.get("id") or "")
            if source_id:
                primary.append({"table": "wiki_claims", "source_id": source_id, "row": row})

        try:
            page_rows = (
                self.store.client.table("wiki_pages")
                .select("page_key,title,one_line,narrative,last_compiled_at")
                .eq("user_id", user_id)
                .execute()
                .data
                or []
            )
        except Exception:
            page_rows = []
        for row in page_rows:
            page_key = row.get("page_key")
            if page_key and page_key != "open_questions":
                primary.append({"table": "wiki_pages", "source_id": page_key, "row": row})

        return {"primary": primary, "supporting": []}

    # -- Objective 3: projection + embedding fix -------------------------------------------

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

        Uses the schema's own ose_page_type mapping and a page-specific category (the pre-MA-03
        version wrote page_type='compiled_intelligence'/category='compiled_intelligence' for
        every page - neither value is in the real CHECK constraints, and the write was silently
        swallowed by a bare except: pass). confidence is written as a real numeric value (the
        pre-MA-03 version wrote a string into a numeric column). Also embeds the projected
        content (closes the previously-missing embedding gap). Non-fatal: if the upsert fails,
        compile_page() still succeeds.
        """
        content_parts = [f"{page_title}\n\n{narrative or one_line}"]
        for claim in claims:
            text = claim.get("text", "").strip()
            if text:
                content_parts.append(text)
        content = "\n\n".join(content_parts)

        confidence_map = {"high": 0.9, "medium": 0.6, "low": 0.35}
        confidences = [confidence_map.get(claim.get("confidence", "medium"), 0.6) for claim in claims]
        confidence = max(confidences) if confidences else 0.3

        page_config = get_wiki_schema()["pages"].get(page_key, {})
        ose_page_type = page_config.get("ose_page_type", "strategic_context")
        category = CATEGORY_BY_PAGE_KEY.get(page_key, "operational")

        try:
            embedding = self.store.embed_query(content[:8000])
        except Exception:
            embedding = None

        try:
            self.store.client.table("ose_knowledge_pages").upsert(
                {
                    "user_id": user_id,
                    "canonical_key": page_key,
                    "page_title": page_title,
                    "page_kind": "wiki_layer1",
                    "page_type": ose_page_type,
                    "category": category,
                    "domain": None,
                    "content": content,
                    "status": "active",
                    "confidence": confidence,
                    "word_count": len(content.split()),
                    "source_file_ids": [],
                    "embedding": embedding,
                    "last_updated": _now(),
                },
                on_conflict="user_id,canonical_key",
            ).execute()
        except Exception as exc:
            logger.warning(
                "wiki_compilation: _project_to_ose failed for page_key=%s user=%s: %s",
                page_key,
                user_id,
                exc,
            )

    # -- Digest helpers (unchanged mechanical rollup utilities) ----------------------------

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

    # -- Mechanical fallback (thin-page / synthesis-miss safety net) -----------------------

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

    # -- Prompt construction -----------------------------------------------------------------

    def _tier1_system_prompt(self, page_key: str, page_config: dict[str, Any]) -> str:
        directive = PAGE_SYNTHESIS_DIRECTIVES.get(page_key, "")
        return f"""You are the ArchitectOS Tier-1 Wiki synthesis engine, compiling the "{page_config['title']}" page for one founder's per-user strategic wiki.

{directive}

You will be given the actual source rows fetched from the platform's live tables for this founder. Respond with a single JSON object and nothing else - no prose before or after, no markdown code fences - matching this schema:

{{
  "claims": [
    {{
      "text": "a specific, factual claim grounded in the source data (1-3 sentences)",
      "confidence": "high" | "medium" | "low",
      "evidence": [
        {{"table": "exact_table_name_from_sources", "source_id": "exact_id_from_sources", "note": "why this row supports the claim"}}
      ]
    }}
  ],
  "narrative": "a few dense paragraphs synthesizing the claims into a coherent read on this page's question - not a report, not a bullet list",
  "sourced_from": [
    {{"table": "exact_table_name_from_sources", "source_id": "exact_id_from_sources", "note": "brief note"}}
  ]
}}

Hard rules:
1. NEVER fabricate a fact, number, or table/source_id that isn't literally present in the source rows you were given. Every evidence entry's table+source_id MUST exactly match one of the sources provided - fabricated citations will be discarded and only hurt this page's grounding.
2. GROUNDING (strict): every factual assertion in the narrative MUST be traceable to one of the claims you emitted in this same response. Do not introduce a fact in the narrative that isn't backed by a claim. Narratives with zero backing claims will be discarded entirely.
3. THIN-PAGE HONESTY: if the source data is sparse, placeholder, or missing, say so plainly in the narrative and in your claims (e.g. "no genuine X exists yet on record") rather than inventing plausible-sounding content.
4. CONCISION: up to about 8 claims is usually plenty; keep each claim's text to 1-3 sentences. The narrative should be a few dense paragraphs, not a report.
5. If two sources conflict, surface the tension explicitly rather than silently picking one.
"""

    def _tier1_user_prompt(self, page_key: str, source_bundle: dict[str, list[dict[str, Any]]]) -> str:
        primary_block = self._render_source_block(source_bundle.get("primary", []))
        supporting_block = self._render_source_block(source_bundle.get("supporting", []))
        return (
            f"PRIMARY SOURCES (weight these most heavily):\n{primary_block}\n\n"
            f"SUPPORTING SOURCES (use to ground/quantify primary claims):\n{supporting_block}\n\n"
            "Compile this page now, following the system prompt's directive and hard rules exactly."
        )

    def _render_source_block(self, sources: list[dict[str, Any]]) -> str:
        if not sources:
            return "(none available)"
        lines = []
        for item in sources[:40]:
            row_preview = {k: v for k, v in item["row"].items() if v not in (None, "", [], {})}
            lines.append(f"- table={item['table']} source_id={item['source_id']} row={json.dumps(row_preview, default=str)[:1200]}")
        return "\n".join(lines)


def _response_text(response: Any) -> str:
    parts = []
    for block in getattr(response, "content", []) or []:
        text = getattr(block, "text", None)
        if text:
            parts.append(text)
    return "".join(parts)


def _strip_json_fence(text: str) -> str:
    stripped = text.strip()
    match = re.match(r"^```(?:json)?\s*(.*?)\s*```$", stripped, re.DOTALL)
    if match:
        return match.group(1)
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
        "text",
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


def _source_id(table: str, row: dict[str, Any]) -> str | None:
    """Table-aware primary-key resolution. Replaces a flat "try common id-suffixed column
    names" heuristic: several tables carry a same-shaped *_id column that is a foreign key into
    a *different* sibling table, not their own PK (see TABLE_PRIMARY_KEY_COLUMN docstring)."""
    pk_column = TABLE_PRIMARY_KEY_COLUMN.get(table)
    if pk_column:
        value = row.get(pk_column)
        if value:
            return str(value)
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


def _overall_confidence(page_digests: list[dict[str, Any]], low_confidence: int, quarantined: int) -> str:
    if not page_digests:
        return "low"
    if quarantined:
        return "low"
    rollups = [page.get("confidence_rollup") for page in page_digests]
    if all(r == "high" for r in rollups):
        return "high"
    if any(r == "low" for r in rollups) or low_confidence > 3:
        return "low"
    return "medium"


def _oldest_age(page_digests: list[dict[str, Any]]) -> str | None:
    timestamps = [page.get("last_compiled_at") for page in page_digests if page.get("last_compiled_at")]
    if not timestamps:
        return None
    return min(timestamps)


def _claim_digest_sort(claim: dict[str, Any]) -> tuple[int, str]:
    order = {"high": 0, "medium": 1, "low": 2}
    return (order.get(claim.get("confidence"), 1), str(claim.get("page_key") or ""))


def _short(value: Any, limit: int = 140) -> str:
    text = str(value)
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
