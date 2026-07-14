"""Deterministic cheapest-first source routing for the Virtual CSO.

Phase 3 selects read-only sources only.  It never narrows the registry tool
bag, delegates work, writes the wiki, or attempts live-external retrieval.
"""

from __future__ import annotations

import fnmatch
import json
import re
from dataclasses import asdict, dataclass
from typing import Any, Callable

from services.citations.normalize import from_retrieved_chunk
from services.doc_wiki_read_service import DocWikiReadError, DocWikiReadService
from services.folder_navigation import KbNavigationError, KbNavigationService
from services.retrieval import RetrievalService
from services.wiki_read import WikiReadError, WikiReadService


SOURCE_ROUTING_SCHEMA_VERSION = "vcso_source_routing_v1"
TIER_LABELS = {
    0: "structured platform records",
    1: "compiled wiki components",
    2: "hybrid semantic search",
    3: "raw document explorer",
    4: "live external source (Phase 5 no-op)",
}
FIXED_LAYER_ONE_KEYS = (
    "business_context",
    "client_market_position",
    "current_quarter_sprint",
    "diagnostic_synthesis",
    "financial_context",
    "growth_constraints",
    "open_questions",
)
FIXED_KEYWORDS = {
    "financial_context": ("margin", "revenue", "profit", "cash", "financial", "p&l", "cost"),
    "client_market_position": ("client", "concentration", "market", "position", "offer", "retainer"),
    "current_quarter_sprint": ("quarter", "sprint", "initiative", "milestone", "priority"),
    "growth_constraints": ("growth", "constraint", "bottleneck", "capacity", "scale"),
    "diagnostic_synthesis": ("diagnostic", "mra", "ladder", "assessment", "capability"),
    "open_questions": ("unknown", "question", "uncertain", "missing", "risk"),
}
RAW_EVIDENCE_PATTERNS = (
    r"\bwhat does (?:the )?(?:document|file|upload)\b",
    r"\baccording to (?:the )?(?:document|file|upload)\b",
    r"\b(?:read|open|quote|verify) (?:the |this )?(?:document|file|upload)\b",
)
RECORD_SIGNALS = {
    "mra": ("mra", "growth model audit", "maturity", "readiness", "checkpoint score"),
    "ae_ladder": ("ae ladder", "agency evolution", "ladder position", "dimension score"),
    "sprint": ("sprint", "initiative", "milestone"),
    "quarter_map": ("quarter map", "quarter priority", "priority area"),
}


@dataclass(frozen=True)
class RoutingPlan:
    start_tier: int
    escalation_plan: tuple[int, ...]
    reason_code: str


@dataclass(frozen=True)
class SourceRoutingDecision:
    schema_version: str
    status: str
    start_tier: int
    escalation_plan: list[int]
    tiers_consulted: list[int]
    stop_tier: int | None
    reason_code: str
    selected_sources: list[dict[str, Any]]
    live_tier_hook: str = "phase_5_noop"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class SourceRoutingResult:
    decision: SourceRoutingDecision
    components: list[dict[str, Any]]
    source_refs: list[dict[str, Any]]


def plan_source_route(message: str, intent: dict[str, Any] | None = None) -> RoutingPlan:
    """Choose a deterministic start and ordered internal-tier plan."""

    lowered = str(message or "").casefold()
    if any(re.search(pattern, lowered) for pattern in RAW_EVIDENCE_PATTERNS):
        return RoutingPlan(3, (3,), "raw_evidence_requested")
    if _record_domains(lowered):
        return RoutingPlan(0, (0, 1, 2, 3), "structured_record_signal")

    classified = bool(intent and intent.get("status") == "classified")
    move_type = str((intent or {}).get("move_type") or "")
    if classified and move_type == "ambient":
        return RoutingPlan(1, (1,), "ambient_component_context")
    if classified and move_type == "lookup":
        return RoutingPlan(1, (1, 2, 3), "lookup_without_record_signal")
    if classified:
        return RoutingPlan(1, (1, 2, 3), f"intent_{move_type or 'strategic_synthesis'}")
    # Phase 2 is independently flagged.  Missing/uncertain intent must not buy
    # a cheaper path at the expense of quality.
    return RoutingPlan(1, (1, 2, 3), "intent_unavailable_conservative")


class TierOneComponentComposer:
    """Two-source, modular Tier-1 read with compact provenance."""

    def __init__(self, store: Any) -> None:
        self.store = store
        self.supabase = store.client

    def compose(self, user_id: str, message: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        components: list[dict[str, Any]] = []
        refs: list[dict[str, Any]] = []
        layer_one = WikiReadService(self.store)
        for page_key in _select_fixed_keys(message):
            try:
                result = layer_one.get_page(user_id, page_key)
            except WikiReadError:
                continue
            finding = (result.get("findings") or [{}])[0]
            claims = list(finding.get("claims") or [])[:6]
            citations = list(result.get("citations") or [])[:16]
            components.append(
                {
                    "id": finding.get("page_key"),
                    "resource_ref": finding.get("page_key"),
                    "page_key": finding.get("page_key"),
                    "canonical_key": finding.get("page_key"),
                    "title": finding.get("title"),
                    "page_title": finding.get("title"),
                    "page_kind": "wiki_layer1",
                    "page_type": "wiki_layer1",
                    "claims": claims,
                    "citations": citations,
                    "source_service": "WikiReadService",
                }
            )
            refs.extend(citations)

        index_rows = (
            self.supabase.table("ose_knowledge_pages")
            .select(
                "id,page_title,page_type,canonical_key,page_kind,domain,category,status,confidence,last_updated"
            )
            .eq("user_id", user_id)
            .neq("status", "deleted")
            .neq("page_kind", "wiki_layer1")
            .order("last_updated", desc=True)
            .limit(100)
            .execute()
            .data
            or []
        )
        selected_ids = _select_modular_pages(message, index_rows)
        doc_wiki = DocWikiReadService(self.store)
        for row in index_rows:
            if str(row.get("id")) not in selected_ids:
                continue
            try:
                result = doc_wiki.get_page(user_id, page_id=str(row["id"]))
            except DocWikiReadError:
                continue
            finding = (result.get("findings") or [{}])[0]
            canonical_key = finding.get("canonical_key")
            component = {
                "id": finding.get("page_id"),
                "resource_ref": canonical_key or finding.get("page_id"),
                "canonical_key": canonical_key,
                "title": finding.get("title"),
                "page_title": finding.get("title"),
                "page_kind": finding.get("page_kind"),
                "page_type": "emergent_layer2",
                "content": str(finding.get("content") or "")[:4000],
                "citations": result.get("citations") or [],
                "source_service": "DocWikiReadService",
            }
            components.append(component)
            refs.append(
                {
                    "source_kind": "wiki_page",
                    "source_id": canonical_key or finding.get("page_id"),
                    "source_label": finding.get("title"),
                    "source_metadata": {
                        "page_key": canonical_key,
                        "page_kind": finding.get("page_kind"),
                    },
                    "citation_payload": {
                        "locator": {"kind": "page_key", "page_key": canonical_key}
                    },
                }
            )
        return components[:8], _dedupe_refs(refs)


class SourceRouter:
    """Execute the deterministic plan, stopping at the first available tier."""

    def __init__(
        self,
        store: Any,
        *,
        tier_readers: dict[int, Callable[[str, str], tuple[list[dict[str, Any]], list[dict[str, Any]]]]] | None = None,
    ) -> None:
        self.store = store
        self.supabase = store.client
        self._tier_readers = tier_readers or {
            0: self._read_tier_zero,
            1: TierOneComponentComposer(store).compose,
            2: self._read_tier_two,
            3: self._read_tier_three,
        }

    def route(
        self,
        *,
        user_id: str,
        message: str,
        intent: dict[str, Any] | None = None,
    ) -> SourceRoutingResult:
        plan = plan_source_route(message, intent)
        consulted: list[int] = []
        components: list[dict[str, Any]] = []
        refs: list[dict[str, Any]] = []
        stop_tier: int | None = None
        for tier in plan.escalation_plan:
            consulted.append(tier)
            tier_components, tier_refs = self._tier_readers[tier](user_id, message)
            if tier_components:
                components = tier_components
                refs = _dedupe_refs(tier_refs)
                stop_tier = tier
                break

        selected = [
            {
                "tier": stop_tier,
                "source_kind": ref.get("source_kind"),
                "source_id": ref.get("source_id"),
                "source_label": ref.get("source_label"),
            }
            for ref in refs[:20]
        ]
        decision = SourceRoutingDecision(
            schema_version=SOURCE_ROUTING_SCHEMA_VERSION,
            status="selected" if stop_tier is not None else "available_to_tool_loop",
            start_tier=plan.start_tier,
            escalation_plan=list(plan.escalation_plan),
            tiers_consulted=consulted,
            stop_tier=stop_tier,
            reason_code=plan.reason_code,
            selected_sources=selected,
        )
        return SourceRoutingResult(decision=decision, components=components, source_refs=refs)

    def _read_tier_zero(self, user_id: str, message: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        domains = _record_domains(message.casefold())
        rows: list[tuple[str, str, str, dict[str, Any]]] = []
        if "mra" in domains:
            assessments = (
                self.supabase.table("gm_assessments")
                .select("assessment_id,respondent_user_id,assessment_type,status,submitted_at,scored_at,agency_name")
                .eq("respondent_user_id", user_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
                .data
                or []
            )
            if assessments:
                assessment = assessments[0]
                rows.append(("gm_assessments", "assessment_id", "MRA assessment", assessment))
                assessment_id = assessment.get("assessment_id")
                scores = (
                    self.supabase.table("gm_assessment_checkpoint_scores")
                    .select("checkpoint_score_id,assessment_id,checkpoint_id,maturity_pct,readiness_pct,criticality,impact,attention_posture,updated_at")
                    .eq("assessment_id", assessment_id)
                    .order("updated_at", desc=True)
                    .limit(12)
                    .execute()
                    .data
                    or []
                )
                rows.extend(
                    ("gm_assessment_checkpoint_scores", "checkpoint_score_id", "MRA checkpoint score", row)
                    for row in scores
                )
        if "ae_ladder" in domains:
            assessments = (
                self.supabase.table("ae_assessments")
                .select("ae_assessment_id,user_id,overall_score,ae_frontend_stage_id,ae_backend_stage_id,submitted_at,assessment_complete_flag")
                .eq("user_id", user_id)
                .order("submitted_at", desc=True)
                .limit(1)
                .execute()
                .data
                or []
            )
            if assessments:
                assessment = assessments[0]
                rows.append(("ae_assessments", "ae_assessment_id", "AE Ladder assessment", assessment))
                dimension_rows = (
                    self.supabase.table("ae_dimension_scores")
                    .select("ae_assessment_dimension_score_id,ae_assessment_id,ae_dimension_id,avg_score,ae_band_id,ae_dimension_band_id,created_at")
                    .eq("ae_assessment_id", assessment.get("ae_assessment_id"))
                    .limit(12)
                    .execute()
                    .data
                    or []
                )
                rows.extend(
                    ("ae_dimension_scores", "ae_assessment_dimension_score_id", "AE dimension score", row)
                    for row in dimension_rows
                )
        if "sprint" in domains:
            goals = (
                self.supabase.table("sp_sprint_goals")
                .select("id,user_id,quarter,goal_text,directional_framing,status,name,kickoff_date,updated_at")
                .eq("user_id", user_id)
                .order("updated_at", desc=True)
                .limit(2)
                .execute()
                .data
                or []
            )
            rows.extend(("sp_sprint_goals", "id", "Sprint goal", row) for row in goals)
            goal_ids = [row["id"] for row in goals]
            if goal_ids:
                initiatives = (
                    self.supabase.table("sp_sprint_initiatives")
                    .select("id,user_id,sprint_goal_id,quarter,capability_name,three_p_tier,name,outcome_statement,status,updated_at")
                    .eq("user_id", user_id)
                    .in_("sprint_goal_id", goal_ids)
                    .limit(12)
                    .execute()
                    .data
                    or []
                )
                rows.extend(("sp_sprint_initiatives", "id", "Sprint initiative", row) for row in initiatives)
        if "quarter_map" in domains:
            selections = (
                self.supabase.table("quarter_map_selections")
                .select("id,user_id,quarter_name,selections,status,synthesis_output,updated_at")
                .eq("user_id", user_id)
                .order("updated_at", desc=True)
                .limit(1)
                .execute()
                .data
                or []
            )
            rows.extend(("quarter_map_selections", "id", "Quarter Map selection", row) for row in selections)

        components: list[dict[str, Any]] = []
        refs: list[dict[str, Any]] = []
        for table, id_column, label, row in rows[:20]:
            row_id = row.get(id_column)
            if row_id is None:
                continue
            components.append(
                {
                    "id": str(row_id),
                    "resource_ref": f"{table}/{row_id}",
                    "title": label,
                    "page_title": label,
                    "page_kind": "tier0_record",
                    "page_type": "tier0_record",
                    "content": json.dumps(row, ensure_ascii=True, default=str)[:2500],
                    "source_service": "SourceRouter.Tier0",
                }
            )
            refs.append(
                {
                    "source_kind": "tier0_record",
                    "source_id": f"{table}/{row_id}",
                    "source_label": label,
                    "source_metadata": {
                        "record_path": f"{table}/{row_id}",
                        "record_id_column": id_column,
                    },
                    "citation_payload": {
                        "locator": {"kind": "record_path", "record_path": f"{table}/{row_id}"}
                    },
                }
            )
        return components, refs

    def _read_tier_two(self, user_id: str, message: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        chunks = RetrievalService(self.store).hybrid_search(user_id, message, match_count=4)
        components: list[dict[str, Any]] = []
        refs: list[dict[str, Any]] = []
        for chunk in chunks[:4]:
            citation = from_retrieved_chunk(chunk)
            components.append(
                {
                    "id": chunk.chunk_id,
                    "resource_ref": chunk.chunk_id,
                    "title": chunk.metadata.get("document_title") or "Relevant document passage",
                    "page_title": chunk.metadata.get("document_title") or "Relevant document passage",
                    "page_kind": "tier2_chunk",
                    "page_type": "tier2_chunk",
                    "content": chunk.content[:3000],
                    "source_service": "RetrievalService.hybrid_search",
                }
            )
            refs.append(citation.to_agent_source_ref_dict())
        return components, refs

    def _read_tier_three(self, user_id: str, message: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        nav = KbNavigationService(self.store)
        hint = _document_hint(message)
        try:
            tree = nav.execute_tree(user_id, None, depth=10, limit=300)
        except KbNavigationError:
            return [], []
        files = _flatten_tree(getattr(tree, "tree", []) or [])
        if hint:
            matches = [item for item in files if _filename_matches(item["name"], hint)]
        else:
            matches = files[:1]
        if not matches:
            return [], []
        match = matches[0]
        try:
            result = nav.execute_read(user_id, match["id"], 1, 500)
        except KbNavigationError:
            return [], []
        content = str(result.content or "")
        component = {
            "id": result.document_id,
            "resource_ref": result.document_id,
            "title": result.name,
            "page_title": result.name,
            "page_kind": "tier3_raw_document",
            "page_type": "tier3_raw_document",
            "content": content[:12000],
            "source_service": "KbNavigationService.execute_read",
        }
        ref = {
            "source_kind": "raw_document",
            "source_id": result.document_id,
            "source_label": result.name,
            "source_metadata": {
                "document_id": result.document_id,
                "start_line": result.start_line,
                "end_line": result.end_line,
            },
            "citation_payload": {
                "verbatim": content[:4000],
                "locator": {
                    "kind": "lines",
                    "path": result.name,
                    "lines": {"start": result.start_line, "end": result.end_line},
                },
            },
        }
        return [component], [ref]


def _record_domains(lowered: str) -> list[str]:
    return [domain for domain, signals in RECORD_SIGNALS.items() if any(signal in lowered for signal in signals)]


def _select_fixed_keys(message: str) -> list[str]:
    lowered = message.casefold()
    selected = [key for key, keywords in FIXED_KEYWORDS.items() if any(word in lowered for word in keywords)]
    if not selected:
        selected = ["business_context"]
    elif "business_context" not in selected:
        selected.insert(0, "business_context")
    return [key for key in FIXED_LAYER_ONE_KEYS if key in selected][:4]


def _select_modular_pages(message: str, rows: list[dict[str, Any]]) -> set[str]:
    words = _tokens(message)
    scored: list[tuple[int, str]] = []
    for row in rows:
        metadata = " ".join(
            str(row.get(key) or "")
            for key in ("page_title", "page_type", "canonical_key", "page_kind", "domain", "category")
        )
        score = sum(2 for word in _tokens(metadata) if word in words)
        if score:
            scored.append((score, str(row.get("id"))))
    scored.sort(key=lambda item: (-item[0], item[1]))
    return {row_id for _score, row_id in scored[:4]}


def _document_hint(message: str) -> str:
    quoted = re.search(r"[\"']([^\"']{2,120})[\"']", message)
    if quoted:
        return quoted.group(1).strip()
    match = re.search(
        r"(?:document|file|upload)\s+(?:named\s+|called\s+)?(?P<name>[^?.!,]{2,120})",
        message,
        re.IGNORECASE,
    )
    return match.group("name").strip() if match else ""


def _flatten_tree(nodes: list[Any]) -> list[dict[str, str]]:
    files: list[dict[str, str]] = []
    for node in nodes:
        if getattr(node, "type", None) == "file":
            files.append({"id": str(node.id), "name": str(node.name)})
        files.extend(_flatten_tree(list(getattr(node, "children", None) or [])))
    return files


def _filename_matches(name: str, hint: str) -> bool:
    normalized_name = re.sub(r"[^a-z0-9]+", " ", name.casefold()).strip()
    normalized_hint = re.sub(r"[^a-z0-9]+", " ", hint.casefold()).strip()
    return bool(normalized_hint) and (
        normalized_hint in normalized_name
        or fnmatch.fnmatchcase(name.casefold(), f"*{hint.casefold()}*")
    )


def _tokens(value: str) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9]+", value.casefold()) if len(token) >= 3}


def _dedupe_refs(refs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for ref in refs:
        key = (str(ref.get("source_kind") or ""), str(ref.get("source_id") or ""))
        if key in seen:
            continue
        seen.add(key)
        result.append(ref)
    return result
